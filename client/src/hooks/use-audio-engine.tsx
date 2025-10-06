import { useState, useEffect, useCallback, useRef } from "react";
import { StreamingAudioEngine } from "@/lib/streaming-audio-engine";
import type { SongWithTracks } from "@shared/schema";
import { AudioFileStorage } from "@/lib/audio-file-storage";
import { LocalSongStorage } from "@/lib/local-song-storage";
import { useStorage } from "@/contexts/StorageContext";
interface UseAudioEngineProps {
  song?: SongWithTracks;
  onDurationUpdated?: (songId: string, duration: number) => void;
  userEmail?: string;
}

export function useAudioEngine(songOrProps?: SongWithTracks | UseAudioEngineProps) {
  // Get storage context to know when it's initialized
  const { isInitialized: storageInitialized, audioStorage: storageAudioStorage } = useStorage();
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
  const [audioLevels, setAudioLevels] = useState<Record<string, { left: number; right: number }>>({});
  const [masterStereoLevels, setMasterStereoLevels] = useState<{ left: number; right: number }>({ left: 0, right: 0 });
  const [cpuUsage, setCpuUsage] = useState(23);
  const [isAudioEngineOnline, setIsAudioEngineOnline] = useState(true);
  const [masterVolume, setMasterVolume] = useState(85);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);

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
        if (song && audioEngineRef.current) {
          console.log(`✅ Storage initialized! Loading song: "${song.title}" with ${song.tracks.length} tracks`);
          setIsLoadingTracks(true);
          setAudioError(null);
          setDuration(song.duration);
          setCurrentTime(0);
          setIsPlaying(false);
          console.log(`Setting up streaming for: "${song.title}" - UI stays responsive`);
          try {
            const finalUserEmail = userEmail || 'default@user.com';
            if (!finalUserEmail || finalUserEmail === 'default@user.com') {
              console.warn('No userEmail available - mute regions will not be loaded');
            }
            audioEngineRef.current?.setSongContext(finalUserEmail, song.id);
            const audioStorage = storageAudioStorage || AudioFileStorage.getInstance(finalUserEmail);
            const trackDataPromises = song.tracks.map(async (track) => {
              const audioUrl = await audioStorage.getAudioUrl(track.id);
              let muteRegions: any[] = [];
              if (finalUserEmail && finalUserEmail !== 'default@user.com') {
                try {
                  const regions = await LocalSongStorage.getMuteRegions(finalUserEmail, song.id, track.id);
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
                volume: track.volume != null ? track.volume : 50,
                balance: track.balance != null ? track.balance : 0,
                isMuted: track.isMuted || false,
                isSolo: track.isSolo || false,
                muteRegions: muteRegions,
              } : null;
            });
            const trackDataResults = await Promise.all(trackDataPromises);
            const trackData = trackDataResults.filter(track => track !== null);
            if (trackData.length === 0) {
              console.error(`❌ No audio URLs found for "${song.title}" - check if audio files exist in IndexedDB`);
              setIsLoadingTracks(false);
              return;
            }
            console.log('⏳ Waiting for audio engine to load tracks...');
            await audioEngineRef.current?.loadTracks(trackData);
            console.log('✅ Audio engine tracks loaded successfully');
            console.log('⏳ Preloading audio elements...');
            await audioEngineRef.current?.preloadAllTracks();
            console.log('✅ All audio elements preloaded and ready');
            if (audioEngineRef.current && typeof (audioEngineRef.current as any).autoGenerateWaveform === 'function') {
              (audioEngineRef.current as any).autoGenerateWaveform(song, finalUserEmail);
            }
            console.log(`✅ Streaming ready for "${song.title}" - instant playback available`);
            setIsLoadingTracks(false);
          } catch (error) {
            console.error(`❌ Streaming setup failed for "${song.title}":`, error);
            setAudioError(error instanceof Error ? error.message : String(error));
            setIsLoadingTracks(true);
          }
        } else {
          setIsLoadingTracks(false);
          setAudioError(null);
        }
      } catch (err) {
        console.error('Error initializing audio engine:', err);
      }
    };
    initAudioEngine();
    // Cleanup function
    return () => {
      // Don't reset loading state on cleanup as it might interrupt loading
    };
  }, [storageInitialized, song?.id, song?.tracks?.length, userEmail, storageAudioStorage]);

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
      if (audioEngineRef.current && song) {
        // Update track levels even when paused to show loaded audio levels
        const levels: Record<string, { left: number; right: number }> = {};
        song.tracks.forEach(track => {
          const trackLevels = audioEngineRef.current!.getTrackLevels(track.id);
          // Engine now returns 0-100 range directly, pass both channels
          levels[track.id] = trackLevels;
        });
        setAudioLevels(levels as any); // Type assertion needed for now
        
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
    if (!audioEngineRef.current || !song) {
      console.log('⚠️ Cannot play: No audio engine or song selected');
      return;
    }
    
    // Wait for tracks to be loaded if they're not already
    if (!audioEngineRef.current.isReady) {
      console.log('⚠️ Tracks not fully loaded yet - please wait');
      return;
    }
    
    try {
      await audioEngineRef.current.play();
      setIsPlaying(true);
      console.log('▶️ Playback started');
    } catch (error) {
      console.error('❌ Failed to start playback:', error);
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

  // Get audio context info for status display
  const getAudioInfo = useCallback(() => {
    if (audioEngineRef.current) {
      return audioEngineRef.current.getAudioInfo();
    }
    return {
      sampleRate: 48000,
      bufferSize: 256,
      bitDepth: 32,
      latency: 0
    };
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
  audioError,
  audioEngine: audioEngineRef.current, // Expose audio engine for direct access
  getAudioInfo, // Expose audio info
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
