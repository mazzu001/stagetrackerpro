import { useState, useEffect, useCallback, useRef } from "react";
import { StreamingAudioEngine } from "@/lib/streaming-audio-engine";
import { PreloadedAudioEngine } from "@/lib/preloaded-audio-engine";
import type { SongWithTracks } from "@shared/schema";
import { AudioFileStorage } from "@/lib/audio-file-storage";

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
  const [currentEngineType, setCurrentEngineType] = useState<'streaming' | 'preloaded'>('streaming');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [pitchOffset, setPitchOffset] = useState(0);

  const streamingEngineRef = useRef<StreamingAudioEngine | null>(null);
  const preloadedEngineRef = useRef<PreloadedAudioEngine | null>(null);
  const audioEngineRef = useRef<StreamingAudioEngine | PreloadedAudioEngine | null>(null);
  const animationFrameRef = useRef<number>();

  const stop = useCallback(() => {
    if (audioEngineRef.current) {
      audioEngineRef.current.stop();
      setIsPlaying(false);
      setCurrentTime(0);
    }
  }, []);

  // Determine which engine to use based on pitch offset
  const getRequiredEngineType = useCallback((pitchOffset: number): 'streaming' | 'preloaded' => {
    return pitchOffset === 0 ? 'streaming' : 'preloaded';
  }, []);

  // Initialize both audio engines
  useEffect(() => {
    const initAudioEngines = async () => {
      try {
        // Initialize streaming engine
        streamingEngineRef.current = new StreamingAudioEngine();
        streamingEngineRef.current.setOnSongEndCallback(() => {
          console.log('🔄 Song ended automatically (streaming) - using same path as stop button');
          stop();
        });
        
        // Initialize preloaded engine
        preloadedEngineRef.current = new PreloadedAudioEngine();
        preloadedEngineRef.current.onSongEnd(() => {
          console.log('🔄 Song ended automatically (preloaded) - using same path as stop button');
          stop();
        });
        
        // Start with streaming engine as default
        audioEngineRef.current = streamingEngineRef.current;
        setCurrentEngineType('streaming');
        
        setIsAudioEngineOnline(true);
      } catch (error) {
        console.error('Failed to initialize audio engines:', error);
        setIsAudioEngineOnline(false);
      }
    };

    initAudioEngines();

    return () => {
      if (streamingEngineRef.current) {
        streamingEngineRef.current.dispose();
      }
      if (preloadedEngineRef.current) {
        preloadedEngineRef.current.dispose();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [stop]);

  // Switch engines based on pitch offset
  const switchEngine = useCallback(async (requiredType: 'streaming' | 'preloaded', newPitchOffset: number) => {
    if (currentEngineType === requiredType) return;
    
    console.log(`🔄 Switching from ${currentEngineType} to ${requiredType} engine (pitch: ${newPitchOffset})`);
    
    // Stop current engine
    if (audioEngineRef.current && isPlaying) {
      audioEngineRef.current.stop();
      setIsPlaying(false);
    }
    
    // Switch engine reference
    if (requiredType === 'streaming') {
      audioEngineRef.current = streamingEngineRef.current;
    } else {
      audioEngineRef.current = preloadedEngineRef.current;
    }
    
    setCurrentEngineType(requiredType);
    setPitchOffset(newPitchOffset);
    
    // Reload tracks with new engine
    if (song) {
      await loadTracksForCurrentEngine(song, newPitchOffset);
    }
  }, [currentEngineType, isPlaying, song]);

  // Load tracks for current engine
  const loadTracksForCurrentEngine = useCallback(async (song: SongWithTracks, pitchOffset: number) => {
    if (!audioEngineRef.current) return;
    
    const engineType = getRequiredEngineType(pitchOffset);
    
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
      
      if (engineType === 'streaming') {
        console.log(`🚀 Loading tracks with streaming engine (instant)`);
        setIsLoadingTracks(false);
        await (audioEngineRef.current as StreamingAudioEngine).loadTracks(trackData);
        
        // Auto-generate waveform in background
        if (typeof (audioEngineRef.current as any).autoGenerateWaveform === 'function') {
          (audioEngineRef.current as any).autoGenerateWaveform(song);
        }
      } else {
        console.log(`🔄 Loading tracks with preloaded engine (pitch: ${pitchOffset}) - this may take a moment`);
        setIsLoadingTracks(true);
        setLoadingProgress(0);
        
        // Set up progress listener for preloaded engine
        const engine = audioEngineRef.current as PreloadedAudioEngine;
        const progressListener = () => {
          const state = engine.getState();
          setLoadingProgress(state.loadingProgress);
          if (!state.isLoading) {
            setIsLoadingTracks(false);
            engine.removeListener(progressListener);
          }
        };
        engine.addListener(progressListener);
        
        await engine.loadTracks(trackData, pitchOffset);
      }
      
      console.log(`✅ Tracks loaded for "${song.title}" using ${engineType} engine`);
    } catch (error) {
      console.error(`❌ Failed to load tracks for "${song.title}":`, error);
      setIsLoadingTracks(false);
    }
  }, [getRequiredEngineType]);

  // Set up song and determine engine based on pitch offset
  useEffect(() => {
    if (song && streamingEngineRef.current && preloadedEngineRef.current) {
      const songPitchOffset = song.pitchOffset || 0;
      const requiredEngineType = getRequiredEngineType(songPitchOffset);
      
      console.log(`Song selected: "${song.title}" with ${song.tracks.length} tracks (pitch: ${songPitchOffset})`);
      
      // Use existing duration from database
      setDuration(song.duration);
      setCurrentTime(0);
      setIsPlaying(false);
      
      // Switch engines if needed
      if (currentEngineType !== requiredEngineType) {
        switchEngine(requiredEngineType, songPitchOffset);
      } else {
        // Same engine, just reload tracks
        loadTracksForCurrentEngine(song, songPitchOffset);
      }
    }
  }, [song?.id, song?.tracks?.length, song?.pitchOffset, switchEngine, loadTracksForCurrentEngine, currentEngineType, getRequiredEngineType]);

  // Animation loop for real-time updates
  useEffect(() => {
    const animate = () => {
      if (audioEngineRef.current && song) {
        const state = audioEngineRef.current.getState();
        
        // Update track levels
        const levels: Record<string, number> = {};
        song.tracks.forEach(track => {
          let trackLevels;
          if (currentEngineType === 'streaming') {
            trackLevels = (audioEngineRef.current as StreamingAudioEngine).getTrackLevels(track.id);
          } else {
            trackLevels = (audioEngineRef.current as PreloadedAudioEngine).getVUMeterData(track.id);
          }
          // Convert stereo levels to single level with reduced sensitivity
          levels[track.id] = Math.max(trackLevels.left, trackLevels.right) * 30;
        });
        setAudioLevels(levels);
        
        // Get master levels based on engine type
        let masterLevels;
        if (currentEngineType === 'streaming') {
          masterLevels = (audioEngineRef.current as StreamingAudioEngine).getMasterLevels();
        } else {
          // For preloaded engine, calculate combined levels from all tracks
          const combinedLeft = Math.max(...song.tracks.map(track => {
            const vuData = (audioEngineRef.current as PreloadedAudioEngine).getVUMeterData(track.id);
            return vuData.left;
          }));
          const combinedRight = Math.max(...song.tracks.map(track => {
            const vuData = (audioEngineRef.current as PreloadedAudioEngine).getVUMeterData(track.id);
            return vuData.right;
          }));
          masterLevels = { left: combinedLeft, right: combinedRight };
        }
        
        // Scale master levels for song list stereo VU meters
        const scaledLevels = {
          left: masterLevels.left * 100,
          right: masterLevels.right * 100
        };
        setMasterStereoLevels(scaledLevels);
        
        // Use audio engine's state to determine if we should update time
        const engineIsPlaying = state.isPlaying;
        if (engineIsPlaying) {
          const time = state.currentTime;
          setCurrentTime(time);
          
          // Simulate CPU usage fluctuation
          setCpuUsage(20 + Math.random() * 10);
          
          // Auto-stop at end
          if (time >= duration) {
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
      
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, duration, song, currentEngineType]);

  const play = useCallback(async () => {
    if (!audioEngineRef.current || !song) return;
    
    // Check if tracks are loaded based on engine type
    if (currentEngineType === 'streaming') {
      if (!(audioEngineRef.current as StreamingAudioEngine).isReady) {
        console.log('Streaming tracks not loaded, cannot start playback yet');
        return;
      }
    } else {
      const state = (audioEngineRef.current as PreloadedAudioEngine).getState();
      if (state.isLoading || !state.tracks.every(t => t.isLoaded)) {
        console.log('Preloaded tracks not ready, cannot start playback yet');
        return;
      }
    }
    
    try {
      await audioEngineRef.current.play();
      setIsPlaying(true);
    } catch (error) {
      console.error('Failed to start playback:', error);
      setIsPlaying(false);
    }
  }, [song, currentEngineType]);

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
      if (currentEngineType === 'streaming') {
        (audioEngineRef.current as StreamingAudioEngine).setTrackVolume(trackId, volume);
      } else {
        (audioEngineRef.current as PreloadedAudioEngine).updateTrackVolume(trackId, volume);
      }
    }
  }, [currentEngineType]);

  const updateTrackBalance = useCallback(async (trackId: string, balance: number) => {
    if (audioEngineRef.current) {
      if (currentEngineType === 'streaming') {
        (audioEngineRef.current as StreamingAudioEngine).setTrackBalance(trackId, balance);
      } else {
        (audioEngineRef.current as PreloadedAudioEngine).updateTrackBalance(trackId, balance);
      }
    }
  }, [currentEngineType]);

  const updateTrackMute = useCallback(async (trackId: string) => {
    if (audioEngineRef.current) {
      if (currentEngineType === 'streaming') {
        (audioEngineRef.current as StreamingAudioEngine).toggleTrackMute(trackId);
      } else {
        // For preloaded engine, we need to get current mute state and toggle it
        const state = (audioEngineRef.current as PreloadedAudioEngine).getState();
        const track = state.tracks.find(t => t.id === trackId);
        if (track) {
          (audioEngineRef.current as PreloadedAudioEngine).updateTrackMute(trackId, !track.isMuted);
        }
      }
    }
  }, [currentEngineType]);

  const updateTrackSolo = useCallback(async (trackId: string) => {
    if (audioEngineRef.current) {
      if (currentEngineType === 'streaming') {
        (audioEngineRef.current as StreamingAudioEngine).toggleTrackSolo(trackId);
      } else {
        // For preloaded engine, we need to get current solo state and toggle it
        const state = (audioEngineRef.current as PreloadedAudioEngine).getState();
        const track = state.tracks.find(t => t.id === trackId);
        if (track) {
          (audioEngineRef.current as PreloadedAudioEngine).updateTrackSolo(trackId, !track.isSolo);
        }
      }
    }
  }, [currentEngineType]);

  const updateMasterVolume = useCallback((volume: number) => {
    if (audioEngineRef.current) {
      if (currentEngineType === 'streaming') {
        (audioEngineRef.current as StreamingAudioEngine).setMasterVolume(volume / 100);
      } else {
        (audioEngineRef.current as PreloadedAudioEngine).updateMasterVolume(volume / 100);
      }
      setMasterVolume(volume);
    }
  }, [currentEngineType]);

  // New function to update song pitch offset
  const updatePitchOffset = useCallback(async (newPitchOffset: number) => {
    if (!song) return;
    
    const requiredEngineType = getRequiredEngineType(newPitchOffset);
    
    // Switch engines if needed
    if (currentEngineType !== requiredEngineType) {
      await switchEngine(requiredEngineType, newPitchOffset);
    } else if (currentEngineType === 'preloaded') {
      // Same preloaded engine but different pitch - reload tracks
      await loadTracksForCurrentEngine(song, newPitchOffset);
    }
  }, [song, currentEngineType, getRequiredEngineType, switchEngine, loadTracksForCurrentEngine]);


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
    loadingProgress,
    currentEngineType,
    pitchOffset,
    play,
    pause,
    stop,
    seek,
    updateTrackVolume,
    updateTrackBalance,
    updateTrackMute,
    updateTrackSolo,
    updateMasterVolume,
    updatePitchOffset,
  };
}
