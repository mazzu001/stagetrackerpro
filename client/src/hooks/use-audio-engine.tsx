import { useState, useEffect, useCallback, useRef } from "react";
import { StreamingAudioEngine } from "@/lib/streaming-audio-engine";
import type { SongWithTracks } from "@shared/schema";
import { AudioFileStorage } from "@/lib/audio-file-storage";
import { ClickTrackGenerator, type ClickTrackConfig, type MetronomeSound } from "@/lib/click-track-generator";

interface UseAudioEngineProps {
  song?: SongWithTracks;
  onDurationUpdated?: (songId: string, duration: number) => void;
}

export function useAudioEngine(songOrProps?: SongWithTracks | UseAudioEngineProps) {
  // Handle both old and new calling patterns for backwards compatibility
  let song: SongWithTracks | undefined;
  let onDurationUpdated: ((songId: string, duration: number) => void) | undefined;
  
  if (songOrProps && 'song' in songOrProps) {
    // New calling pattern: useAudioEngine({ song, onDurationUpdated })
    song = songOrProps.song;
    onDurationUpdated = songOrProps.onDurationUpdated;
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
  const [isMidiConnected, setIsMidiConnected] = useState(true);
  const [masterVolume, setMasterVolume] = useState(85);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);

  const audioEngineRef = useRef<StreamingAudioEngine | null>(null);
  const animationFrameRef = useRef<number>();
  
  // Metronome setup
  const metronomeContextRef = useRef<AudioContext | null>(null);
  const clickTrackRef = useRef<ClickTrackGenerator | null>(null);
  const isMetronomePlayingRef = useRef<boolean>(false);

  const stop = useCallback(() => {
    if (audioEngineRef.current) {
      audioEngineRef.current.stop();
      setIsPlaying(false);
      setCurrentTime(0);
    }
    // Stop metronome when stopping playback
    if (clickTrackRef.current) {
      clickTrackRef.current.stop();
      isMetronomePlayingRef.current = false;
    }
  }, []);

  // Initialize audio engine and metronome
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
        
        // Initialize metronome audio system
        initializeMetronome();
      } catch (error) {
        console.error('Failed to initialize audio engine:', error);
        setIsAudioEngineOnline(false);
      }
    };

    const initializeMetronome = () => {
      try {
        if (!metronomeContextRef.current) {
          metronomeContextRef.current = new AudioContext();
          console.log('🎯 Metronome AudioContext initialized');
        }
        
        if (!clickTrackRef.current && metronomeContextRef.current) {
          clickTrackRef.current = new ClickTrackGenerator(metronomeContextRef.current);
          console.log('🎯 Metronome ClickTrackGenerator initialized');
        }
      } catch (error) {
        console.error('Failed to initialize metronome:', error);
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
      // Cleanup metronome
      if (clickTrackRef.current) {
        clickTrackRef.current.destroy();
        clickTrackRef.current = null;
      }
      if (metronomeContextRef.current && metronomeContextRef.current.state !== 'closed') {
        metronomeContextRef.current.close();
        metronomeContextRef.current = null;
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
          const audioStorage = AudioFileStorage.getInstance();
          
          // Get all audio URLs in parallel 
          const audioUrlPromises = song.tracks.map(async (track) => {
            const audioUrl = await audioStorage.getAudioUrl(track.id);
            return audioUrl ? {
              id: track.id,
              name: track.name,
              url: audioUrl
            } : null;
          });
          
          const trackDataResults = await Promise.all(audioUrlPromises);
          const trackData = trackDataResults.filter(track => track !== null);
          
          // Load tracks without blocking the UI
          audioEngineRef.current?.loadTracks(trackData);
          
          // Auto-generate waveform in background (restored functionality from AudioEngine)
          if (audioEngineRef.current && typeof (audioEngineRef.current as any).autoGenerateWaveform === 'function') {
            (audioEngineRef.current as any).autoGenerateWaveform(song);
          }
          
          console.log(`✅ Streaming ready for "${song.title}" - instant playback available`);
        } catch (error) {
          console.error(`❌ Streaming setup failed for "${song.title}":`, error);
        }
      };
      
      // Run setup in background without blocking UI
      setupStreamingAsync();
    }
  }, [song?.id, song?.tracks?.length]);

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

  // Metronome control function
  const handleMetronome = useCallback(() => {
    if (!clickTrackRef.current || !metronomeContextRef.current || !song) {
      return;
    }

    const bpmNumber = parseFloat(song.metronomeBpm) || 120;
    
    const config: ClickTrackConfig = {
      bpm: bpmNumber,
      countInMeasures: 1, // 1 measure count-in
      volume: 0.6,
      enabled: song.metronomeOn || false,
      accentDownbeat: true,
      soundType: 'woodblock' // Use woodblock as default sound
    };

    // If metronome is off, stop any playing metronome
    if (!config.enabled) {
      clickTrackRef.current.stop();
      isMetronomePlayingRef.current = false;
      console.log('🎯 Metronome disabled for this song');
      return;
    }

    // Handle different metronome modes based on song settings
    const countIn = song.metronomeCountIn || false;
    const wholeSong = song.metronomeWholeSong || false;

    if (isPlaying && wholeSong) {
      // Continuous metronome during song playback
      if (!isMetronomePlayingRef.current) {
        clickTrackRef.current.startContinuous(config);
        isMetronomePlayingRef.current = true;
        console.log('🎯 Started continuous metronome for whole song');
      }
    } else if (isPlaying && countIn && !wholeSong) {
      // Count-in only when starting playback
      if (!isMetronomePlayingRef.current) {
        clickTrackRef.current.startCountIn(config, () => {
          // Count-in complete, stop if not whole song mode
          isMetronomePlayingRef.current = false;
          console.log('🎯 Count-in complete');
        });
        isMetronomePlayingRef.current = true;
        console.log('🎯 Started count-in metronome');
      }
    } else if (isPlaying && countIn && wholeSong) {
      // Count-in first, then continuous
      if (!isMetronomePlayingRef.current) {
        clickTrackRef.current.startCountIn(config, () => {
          // Count-in complete, start continuous mode
          clickTrackRef.current.startContinuous(config);
          console.log('🎯 Count-in complete, starting continuous metronome');
        });
        isMetronomePlayingRef.current = true;
        console.log('🎯 Started count-in then continuous metronome');
      }
    } else if (!isPlaying) {
      // Stop metronome when playback stops
      clickTrackRef.current.stop();
      isMetronomePlayingRef.current = false;
    }
  }, [song, isPlaying]);

  // Update metronome when playback state or song settings change
  useEffect(() => {
    handleMetronome();
  }, [handleMetronome]);

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
      // Metronome will be handled by useEffect that watches isPlaying
    } catch (error) {
      console.error('Failed to start playback:', error);
      setIsPlaying(false);
    }
  }, [song]);

  const pause = useCallback(() => {
    if (audioEngineRef.current) {
      audioEngineRef.current.pause();
      setIsPlaying(false);
      // Metronome will be stopped by useEffect that watches isPlaying
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
    isMidiConnected,
    masterVolume,
    isLoadingTracks,
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
