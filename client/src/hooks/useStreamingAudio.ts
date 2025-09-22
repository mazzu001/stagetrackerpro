import { useState, useEffect, useCallback, useRef } from 'react';
import { StreamingAudioEngine } from '@/lib/streaming-audio-engine';
import { AudioFileStorage } from '@/lib/audio-file-storage';
import type { SongWithTracks } from '@shared/schema';

interface UseStreamingAudioReturn {
  // Engine state
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isLoading: boolean;
  isReady: boolean;
  tracks: Array<{
    id: string;
    name: string;
    volume: number;
    muted: boolean;
    solo: boolean;
    balance: number;
  }>;
  
  // Transport controls
  loadSong: (song: SongWithTracks) => Promise<void>;
  play: () => Promise<void>;
  pause: () => void;
  stop: () => void;
  seek: (time: number) => void;
  
  // Track controls
  setTrackVolume: (trackId: string, volume: number) => void;
  toggleTrackMute: (trackId: string) => void;
  toggleTrackSolo: (trackId: string) => void;
  setTrackBalance: (trackId: string, balance: number) => void;
  setMasterVolume: (volume: number) => void;
  
  // Audio levels for VU meters
  getTrackLevels: (trackId: string) => { left: number; right: number };
  getMasterLevels: () => { left: number; right: number };
  
  // Current song reference
  currentSong: SongWithTracks | null;
}

export function useStreamingAudio(): UseStreamingAudioReturn {
  const [streamingEngine] = useState(() => new StreamingAudioEngine());
  const [engineState, setEngineState] = useState(streamingEngine.getState());
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [currentSong, setCurrentSong] = useState<SongWithTracks | null>(null);
  
  // Subscribe to engine state updates
  useEffect(() => {
    const unsubscribe = streamingEngine.subscribe(() => {
      setEngineState(streamingEngine.getState());
    });
    
    return () => {
      unsubscribe();
      streamingEngine.dispose();
    };
  }, [streamingEngine]);

  const loadSong = useCallback(async (song: SongWithTracks) => {
    if (!song || !song.tracks || song.tracks.length === 0) {
      console.warn('🚀 No tracks to load for streaming');
      setIsLoading(false);
      setIsReady(false);
      return;
    }
    
    console.log(`🚀 Streaming loadSong called: "${song.title}" with ${song.tracks.length} tracks`);
    setIsLoading(true);
    setIsReady(false);
    setCurrentSong(song);
    

    
    try {
      console.log(`🚀 Streaming load: "${song.title}" with ${song.tracks.length} tracks (instant setup)`);
      
      // Get actual audio URLs from AudioFileStorage
      const audioStorage = AudioFileStorage.getInstance(song.userId || 'default@user.com');
      const trackDataPromises = song.tracks.map(async (track) => {
        try {
          const audioUrl = await audioStorage.getAudioUrl(track.id);
          if (!audioUrl) return null;
          console.log(`🎵 Streaming track: ${track.name} -> ${audioUrl.substring(0, 50)}...`);
          
          // Parse muteRegions if they're stored as a JSON string
          let muteRegions = track.muteRegions;
          if (typeof muteRegions === 'string') {
            try {
              muteRegions = JSON.parse(muteRegions);
            } catch (e) {
              console.warn(`Failed to parse mute regions for track ${track.name}:`, e);
              muteRegions = [];
            }
          }
          
          return {
            id: track.id,
            name: track.name,
            url: audioUrl,
            volume: track.volume || 50,
            balance: track.balance || 0,
            isMuted: track.isMuted || false,
            isSolo: track.isSolo || false,
            muteRegions: muteRegions || []
          };
        } catch (error) {
          console.warn(`⚠️ Failed to get URL for track ${track.name}:`, error);
          return null;
        }
      });
      
      const trackData = (await Promise.all(trackDataPromises)).filter(Boolean) as any[];
      
      if (trackData.length === 0) {
        throw new Error('No valid audio URLs found for streaming');
      }
      
      // Load tracks with enhanced error handling to prevent crashes
      console.log(`🔧 Loading tracks with enhanced error handling for: "${song.title}"`);
      
      try {
        await streamingEngine.loadTracks(trackData as any);
        
        // Set up automatic waveform generation in background
        setTimeout(() => {
          streamingEngine.autoGenerateWaveform(song, song.userId || 'default@user.com').catch(error => {
            console.warn(`⚠️ Waveform generation failed (non-critical):`, error);
          });
        }, 100);
        
        setIsReady(true);
        console.log(`✅ Streaming ready for "${song.title}" - instant playback available`);
      } catch (engineError) {
        console.error(`❌ Streaming engine failed for "${song.title}":`, engineError);
        // Don't crash - just mark as failed and continue
        setIsReady(false);
        throw new Error(`Failed to set up audio engine for "${song.title}". The song may be corrupted.`);
      }
    } catch (error) {
      console.error('❌ Streaming load failed:', error);
      setIsReady(false);
      setIsLoading(false);
    }
  }, [streamingEngine]);

  const play = useCallback(async () => {
    if (!isReady) {
      console.warn('Streaming not ready for playback');
      return;
    }
    
    console.log(`▶️ Starting streaming playback`);
    await streamingEngine.play();
  }, [streamingEngine, isReady]);

  const pause = useCallback(() => {
    console.log(`⏸️ Pausing streaming playback`);
    streamingEngine.pause();
  }, [streamingEngine]);

  const stop = useCallback(() => {
    console.log(`⏹️ Stopping streaming playback`);
    streamingEngine.stop();
  }, [streamingEngine]);

  const seek = useCallback((time: number) => {
    console.log(`⏯️ Streaming seek to ${time.toFixed(1)}s`);
    streamingEngine.seek(time);
  }, [streamingEngine]);

  const setTrackVolume = useCallback((trackId: string, volume: number) => {
    streamingEngine.setTrackVolume(trackId, volume / 100);
  }, [streamingEngine]);

  const toggleTrackMute = useCallback((trackId: string) => {
    streamingEngine.toggleTrackMute(trackId);
  }, [streamingEngine]);

  const toggleTrackSolo = useCallback((trackId: string) => {
    streamingEngine.toggleTrackSolo(trackId);
  }, [streamingEngine]);

  const setTrackBalance = useCallback((trackId: string, balance: number) => {
    streamingEngine.setTrackBalance(trackId, balance);
  }, [streamingEngine]);

  const setMasterVolume = useCallback((volume: number) => {
    streamingEngine.setMasterVolume(volume / 100);
  }, [streamingEngine]);

  const getTrackLevels = useCallback((trackId: string) => {
    return streamingEngine.getTrackLevels(trackId);
  }, [streamingEngine]);

  const getMasterLevels = useCallback(() => {
    return streamingEngine.getMasterLevels();
  }, [streamingEngine]);

  return {
    // Engine state
    isPlaying: engineState.isPlaying,
    currentTime: engineState.currentTime,
    duration: engineState.duration,
    isLoading,
    isReady,
    tracks: engineState.tracks,
    
    // Transport controls
    loadSong,
    play,
    pause,
    stop,
    seek,
    
    // Track controls
    setTrackVolume,
    toggleTrackMute,
    toggleTrackSolo,
    setTrackBalance,
    setMasterVolume,
    
    // Audio levels
    getTrackLevels,
    getMasterLevels,
    
    // Current song
    currentSong,
  };
}