import { useState, useEffect, useCallback, useRef } from "react";
import { StreamingAudioEngine } from "@/lib/streaming-audio-engine";
import type { SongWithTracks } from "@shared/schema";
import { AudioFileStorage } from "@/lib/audio-file-storage";
import { LocalSongStorage } from "@/lib/local-song-storage";
interface UseAudioEngineProps {
  song?: SongWithTracks;
  onDurationUpdated?: (songId: string, duration: number) => void;
  userEmail?: string;
}

export function useAudioEngine(songOrProps?: SongWithTracks | UseAudioEngineProps) {
  // Handle both old and new calling patterns for backwards compatibility
  let song: SongWithTracks | undefined;
  let onDurationUpdated: ((songId: string, duration: number) => void) | undefined;
  let userEmail: string | undefined;
  
  if (songOrProps && 'song' in songOrProps) {
    // New calling pattern: useAudioEngine({ song, onDurationUpdated, userEmail })
    song = songOrProps.song;
    onDurationUpdated = songOrProps.onDurationUpdated;
    userEmail = songOrProps.userEmail;
  } else {
    // Old calling pattern: useAudioEngine(song)
    song = songOrProps as SongWithTracks | undefined;
  }
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioLevels, setAudioLevels] = useState<Record<string, number>>({});
  const [masterStereoLevels, setMasterStereoLevels] = useState<{ left: number; right: number }>({ left: 0, right: 0 });
  const [cpuUsage, setCpuUsage] = useState(23);
  const [isAudioEngineOnline, setIsAudioEngineOnline] = useState(true);
  const [masterVolume, setMasterVolume] = useState(85);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);

  const audioEngineRef = useRef<StreamingAudioEngine | null>(null);
  const animationFrameRef = useRef<number>();

  const stop = useCallback(() => {
    if (audioEngineRef.current) {
      audioEngineRef.current.stop();
      setIsPlaying(false);
      setCurrentTime(0);
    }
  }, []);

  // Initialize audio engine
  useEffect(() => {
    const initAudioEngine = async () => {
      try {
        audioEngineRef.current = new StreamingAudioEngine();
        
        // Set up callback for automatic song end (same path as stop button)
        audioEngineRef.current.setOnSongEndCallback(() => {
          console.log('🔄 Song ended automatically - using same path as stop button');
          stop();
        });
        
        // Set up state listener for duration updates
        const unsubscribe = audioEngineRef.current.subscribe(() => {
          if (audioEngineRef.current) {
            const state = audioEngineRef.current.getState();
            if (state.duration > 0 && state.duration !== duration) {
              const roundedDuration = Math.round(state.duration);
              console.log(`Duration updated from streaming engine: ${roundedDuration}s`);
              setDuration(roundedDuration);
              
              // Save duration to database if callback provided and song is loaded
              if (song && onDurationUpdated) {
                console.log(`Saving updated duration ${roundedDuration}s to database for song: ${song.title}`);
                onDurationUpdated(song.id, roundedDuration);
              }
            }
          }
        });
        
        // Store unsubscribe function
        (audioEngineRef.current as any).unsubscribe = unsubscribe;
        setIsAudioEngineOnline(true);
      } catch (error) {
        console.error('Failed to initialize audio engine:', error);
        setIsAudioEngineOnline(false);
      }
    };

    initAudioEngine();

    return () => {
      if (audioEngineRef.current) {
        // Call unsubscribe if it exists
        if ((audioEngineRef.current as any).unsubscribe) {
          (audioEngineRef.current as any).unsubscribe();
        }
        audioEngineRef.current.dispose();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [stop]);

  // Set up song and load tracks for streaming playback
  useEffect(() => {
    if (song && audioEngineRef.current) {
      console.log(`Song selected: "${song.title}" with ${song.tracks.length} tracks - loading for streaming`);
      
      // Use existing duration from database
      setDuration(song.duration);
      setCurrentTime(0);
      setIsPlaying(false);
      
      // Setup streaming tracks (non-blocking background setup)
      console.log(`Setting up streaming for: "${song.title}" - UI stays responsive`);
      
      // Convert song tracks to track data format and setup streaming
      const setupStreamingAsync = async () => {
        try {
          if (!userEmail) {
            console.warn('No userEmail available - mute regions will not be loaded');
          }
          
          const audioStorage = AudioFileStorage.getInstance(userEmail || 'default@user.com');
          
          // Step 1 & 2: Load all tracks with their audio URLs
          // Step 3: Load mute regions for each track
          const trackDataPromises = song.tracks.map(async (track) => {
            const audioUrl = await audioStorage.getAudioUrl(track.id);
            
            // Get mute regions for this track
            let muteRegions: any[] = [];
            if (userEmail) {
              try {
                const regions = await LocalSongStorage.getMuteRegions(userEmail, song.id, track.id);
                if (regions && regions.length > 0) {
                  muteRegions = regions;
                  console.log(`🔇 Loaded ${muteRegions.length} mute regions for track: ${track.name}`);
                }
              } catch (error) {
                console.warn(`Failed to load mute regions for track ${track.name}:`, error);
              }
            }
            
            return audioUrl ? {
              id: track.id,
              name: track.name,
              url: audioUrl,
              muteRegions: muteRegions // Attach mute regions directly to track data
            } : null;
          });
          
          const trackDataResults = await Promise.all(trackDataPromises);
          const trackData = trackDataResults.filter(track => track !== null);
          
          // Step 5: Send everything to the audio engine (mute regions will be scheduled automatically)
          audioEngineRef.current?.loadTracks(trackData);
          
          // Auto-generate waveform in background (restored functionality from AudioEngine)
          if (audioEngineRef.current && typeof (audioEngineRef.current as any).autoGenerateWaveform === 'function') {
            (audioEngineRef.current as any).autoGenerateWaveform(song, userEmail);
          }
          
          console.log(`✅ Streaming ready for "${song.title}" - instant playback available`);
        } catch (error) {
          console.error(`❌ Streaming setup failed for "${song.title}":`, error);
        }
      };
      
      // Run setup in background without blocking UI
      setupStreamingAsync();
    }
  }, [song?.id, song?.tracks?.length, userEmail]);

  // Animation loop for real-time updates

  useEffect(() => {
    // Fast update for playback time (60fps)
    const animateTime = () => {
      if (audioEngineRef.current && song) {
        const state = audioEngineRef.current.getState();
        
        // Use audio engine's state to determine if we should update time
        const engineIsPlaying = state.isPlaying;
        if (engineIsPlaying) {
          const time = state.currentTime;
          setCurrentTime(time);
          
          // Simulate CPU usage fluctuation
          setCpuUsage(20 + Math.random() * 10);
          
          // Auto-stop at end - only if duration is properly detected
          if (duration > 0 && time >= duration) {
            console.log(`Auto-stopping playback - time: ${time.toFixed(2)}s, duration: ${duration}s`);
            setIsPlaying(false);
            setCurrentTime(duration);
          }
        }
        
        // Sync React state with audio engine state
        if (isPlaying !== engineIsPlaying) {
          setIsPlaying(engineIsPlaying);
        }
      }
      
      animationFrameRef.current = requestAnimationFrame(animateTime);
    };

    // Slower update for VU meters (20fps) to improve performance
    const updateVUMeters = () => {
      if (audioEngineRef.current && song && isPlaying) {
        // Update track levels
        const levels: Record<string, number> = {};
        song.tracks.forEach(track => {
          const trackLevels = audioEngineRef.current!.getTrackLevels(track.id);
          // Engine now returns 0-100 range directly, use as-is
          levels[track.id] = Math.max(trackLevels.left, trackLevels.right);
        });
        setAudioLevels(levels);
        
        const masterLevels = audioEngineRef.current.getMasterLevels();
        // Engine now returns 0-100 range directly, use as-is
        setMasterStereoLevels(masterLevels);
      }
    };

    animationFrameRef.current = requestAnimationFrame(animateTime);
    
    // Update VU meters at 40fps for responsive bouncing
    const vuInterval = setInterval(updateVUMeters, 25);
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      clearInterval(vuInterval);
    };
  }, [song?.id, isPlaying]);

  const play = useCallback(async () => {
    if (!audioEngineRef.current || !song) return;
    
    // Wait for tracks to be loaded if they're not already
    if (!audioEngineRef.current.isReady) {
      console.log('Tracks not loaded, cannot start playback yet');
      return;
    }
    
    try {
      await audioEngineRef.current.play();
      setIsPlaying(true);
    } catch (error) {
      console.error('Failed to start playback:', error);
      setIsPlaying(false);
    }
  }, [song]);

  const pause = useCallback(() => {
    if (audioEngineRef.current) {
      audioEngineRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const seek = useCallback(async (time: number) => {
    if (audioEngineRef.current) {
      audioEngineRef.current.seek(time);
      setCurrentTime(Math.round(time * 10) / 10);
    }
  }, []);

  const updateTrackVolume = useCallback(async (trackId: string, volume: number) => {
    if (audioEngineRef.current) {
      audioEngineRef.current.setTrackVolume(trackId, volume);
    }
    // Note: Volume updates are handled by TrackManager component via LocalSongStorage
  }, []);

  const updateTrackBalance = useCallback(async (trackId: string, balance: number) => {
    if (audioEngineRef.current) {
      audioEngineRef.current.setTrackBalance(trackId, balance);
    }
    // Note: Balance updates are handled by TrackManager component via LocalSongStorage
  }, []);

  const updateTrackMute = useCallback(async (trackId: string) => {
    if (audioEngineRef.current) {
      audioEngineRef.current.toggleTrackMute(trackId);
    }
    // Note: Mute state updates are handled by TrackManager component via LocalSongStorage
  }, []);

  const updateTrackSolo = useCallback(async (trackId: string) => {
    if (audioEngineRef.current) {
      audioEngineRef.current.toggleTrackSolo(trackId);
    }
    // Note: Solo state updates are handled by TrackManager component via LocalSongStorage
  }, []);

  const updateMasterVolume = useCallback((volume: number) => {
    if (audioEngineRef.current) {
      audioEngineRef.current.setMasterVolume(volume / 100); // Convert percentage to 0-1 range
      setMasterVolume(volume);
    }
  }, []);


  return {
    isPlaying,
    currentTime,
    duration,
    audioLevels,
    masterStereoLevels,
    cpuUsage,
    isAudioEngineOnline,
    masterVolume,
    isLoadingTracks,
    audioEngine: audioEngineRef.current, // Expose audio engine for direct access
    play,
    pause,
    stop,
    seek,
    updateTrackVolume,
    updateTrackBalance,
    updateTrackMute,
    updateTrackSolo,
    updateMasterVolume,
  };
}
