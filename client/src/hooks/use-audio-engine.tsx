import { useState, useEffect, useCallback, useRef } from "react";
import { StreamingAudioEngine } from "@/lib/streaming-audio-engine";
import type { SongWithTracks } from "@shared/schema";
import { AudioFileStorage } from "@/lib/audio-file-storage";
import { LocalSongStorage } from "@/lib/local-song-storage";
import { ClickTrackGenerator, type ClickTrackConfig, type MetronomeSound } from "@/lib/click-track-generator";
import { detectSongBPM, type BPMDetectionResult } from "@/lib/bpm-detection";

interface UseAudioEngineProps {
  song?: SongWithTracks;
  onDurationUpdated?: (songId: string, duration: number) => void;
  onBPMDetected?: (songId: string, bpm: number, confidence: number) => void;
}

export function useAudioEngine(songOrProps?: SongWithTracks | UseAudioEngineProps) {
  // Handle both old and new calling patterns for backwards compatibility
  let song: SongWithTracks | undefined;
  let onDurationUpdated: ((songId: string, duration: number) => void) | undefined;
  let onBPMDetected: ((songId: string, bpm: number, confidence: number) => void) | undefined;
  
  if (songOrProps && 'song' in songOrProps) {
    // New calling pattern: useAudioEngine({ song, onDurationUpdated, onBPMDetected })
    song = songOrProps.song;
    onDurationUpdated = songOrProps.onDurationUpdated;
    onBPMDetected = songOrProps.onBPMDetected;
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
  
  // BPM Detection state
  const [detectedBPM, setDetectedBPM] = useState<number | null>(null);
  const [bpmConfidence, setBpmConfidence] = useState<number>(0);
  const [isBPMDetecting, setIsBPMDetecting] = useState(false);

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

  // BPM Detection Functions
  const detectBPM = useCallback(async (): Promise<BPMDetectionResult | null> => {
    if (!song?.id || isBPMDetecting) {
      console.log('🎯 Cannot detect BPM - no song ID or already detecting');
      return null;
    }

    setIsBPMDetecting(true);
    console.log(`🎯 Starting BPM detection for "${song.title}" (ID: ${song.id})`);

    try {
      // Get waveform data from storage
      const waveformData = await LocalSongStorage.getWaveform(song.id);
      if (!waveformData || waveformData.length === 0) {
        console.log('🎯 No waveform data available for BPM detection');
        console.log(`🎯 Song has ${song.tracks?.length || 0} tracks - waveform may not be generated yet`);
        return null;
      }

      if (!song.duration) {
        console.log('🎯 No duration available for BPM detection');
        return null;
      }

      console.log(`🎯 Found waveform data, length: ${waveformData.length}, duration: ${song.duration}s`);

      const result = await detectSongBPM(waveformData, song.duration, {
        minBPM: 60,
        maxBPM: 200,
        analysisLength: 30 // Analyze first 30 seconds
      });

      if (result) {
        setDetectedBPM(result.bpm);
        setBpmConfidence(result.confidence);
        console.log(`🎯 BPM detected: ${result.bpm} (confidence: ${result.confidence.toFixed(2)})`);
      } else {
        console.log('🎯 BPM detection failed - no result returned');
      }

      // Notify parent component if callback provided
      if (onBPMDetected) {
        onBPMDetected(song.id, result.bpm, result.confidence);
      }

      return result;
    } catch (error) {
      console.error('❌ BPM detection failed:', error);
      setDetectedBPM(null);
      setBpmConfidence(0);
      return null;
    } finally {
      setIsBPMDetecting(false);
    }
  }, [song, onBPMDetected]);

  // Auto-detect BPM when song loads (if not already set)
  const autoDetectBPM = useCallback(async () => {
    if (!song || song.bpm || !song.waveformData) {
      return; // Skip if song has manual BPM or no waveform data
    }

    console.log(`🎯 Auto-detecting BPM for "${song.title}"`);
    await detectBPM();
  }, [song, detectBPM]);

  // Get effective BPM (manual override or detected)
  const getEffectiveBPM = useCallback((): number => {
    // Priority: manual BPM > metronome BPM > detected BPM > fallback 120
    if (song?.bpm) return song.bpm;
    if (song?.metronomeBpm) return parseFloat(song.metronomeBpm) || 120;
    if (detectedBPM) return detectedBPM;
    return 120;
  }, [song?.bpm, song?.metronomeBpm, detectedBPM]);

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

  // Auto-detect BPM when song changes (if not already set)
  useEffect(() => {
    if (song && song.waveformData && !song.bpm && !isBPMDetecting) {
      // Small delay to ensure streaming setup is complete
      const timer = setTimeout(() => {
        autoDetectBPM();
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [song?.id, song?.waveformData, song?.bpm, autoDetectBPM, isBPMDetecting]);

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

    // Use effective BPM (manual override, metronome setting, or detected BPM)
    const bpmNumber = getEffectiveBPM();
    const showBPMSource = song.bpm ? 'manual' : song.metronomeBpm ? 'metronome' : detectedBPM ? 'detected' : 'default';
    console.log(`🎯 Using BPM: ${bpmNumber} (source: ${showBPMSource})`);
    const metronomeEnabled = song.metronomeOn === true; // Explicitly check for true
    const countIn = song.metronomeCountIn === true; // Explicitly check for true  
    const wholeSong = song.metronomeWholeSong === true; // Explicitly check for true
    const isAtStart = currentTime <= 1; // Consider "at start" if within first second
    
    console.log('🎯 Metronome settings:', { 
      raw: { metronomeBpm: song.metronomeBpm, metronomeOn: song.metronomeOn, metronomeCountIn: song.metronomeCountIn, metronomeWholeSong: song.metronomeWholeSong },
      parsed: { metronomeEnabled, countIn, wholeSong, isAtStart, currentTime, isPlaying }
    });
    
    const config: ClickTrackConfig = {
      bpm: bpmNumber,
      countInMeasures: 1, // 1 measure count-in
      volume: 0.6,
      enabled: metronomeEnabled,
      accentDownbeat: true,
      soundType: 'woodblock', // Use woodblock as default sound
      pan: song.metronomePan as 'left' | 'right' | 'center' || 'center' // Default to center
    };

    // If metronome is off, stop any playing metronome
    if (!metronomeEnabled) {
      clickTrackRef.current.stop();
      isMetronomePlayingRef.current = false;
      console.log('🎯 Metronome disabled for this song');
      return;
    }

    if (!isPlaying) {
      // Stop metronome when playback stops
      clickTrackRef.current.stop();
      isMetronomePlayingRef.current = false;
      console.log('🎯 Metronome stopped - playback paused');
      return;
    }

    // Handle different metronome modes based on song settings
    if (isPlaying && !isMetronomePlayingRef.current) {
      if (countIn && isAtStart) {
        // Count-in only at song start, then continuous if whole song enabled
        if (wholeSong) {
          console.log('🎯 Starting count-in -> continuous metronome');
          clickTrackRef.current.startCountIn(config, () => {
            // Count-in complete, start continuous mode
            clickTrackRef.current.startContinuous(config);
            console.log('🎯 Count-in complete, starting continuous metronome');
          });
        } else {
          console.log('🎯 Starting count-in only metronome');
          clickTrackRef.current.startCountIn(config, () => {
            // Count-in complete, FORCE stop metronome
            if (clickTrackRef.current) {
              clickTrackRef.current.stop();
              console.log('🎯 Count-in complete - metronome FORCE STOPPED');
            }
            isMetronomePlayingRef.current = false;
            console.log('🎯 Count-in complete - metronome stopped');
          });
        }
        isMetronomePlayingRef.current = true;
      } else if (wholeSong && !countIn) {
        // Continuous metronome without count-in
        console.log('🎯 Starting continuous metronome (no count-in)');
        clickTrackRef.current.startContinuous(config);
        isMetronomePlayingRef.current = true;
      } else if (wholeSong && countIn && !isAtStart) {
        // If whole song is on but we're not at start, just do continuous
        console.log('🎯 Starting continuous metronome (mid-song)');
        clickTrackRef.current.startContinuous(config);
        isMetronomePlayingRef.current = true;
      }
      // If only count-in is enabled but we're not at start, do nothing
    }
  }, [song, isPlaying, currentTime, getEffectiveBPM]);

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
    // BPM Detection
    detectedBPM,
    bpmConfidence,
    isBPMDetecting,
    detectBPM,
    getEffectiveBPM,
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
