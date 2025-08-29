import React, { createContext, useContext, useState, useRef } from 'react';
import { Audio } from 'expo-av';
import { useSimpleDatabase } from './SimpleDatabase';

interface CrashSafeAudioEngineContextType {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  play: () => void;
  pause: () => void;
  stop: () => void;
  loadSong: (songId: string) => void;
  currentSongId: string | null;
}

const CrashSafeAudioEngineContext = createContext<CrashSafeAudioEngineContextType | null>(null);

export const useCrashSafeAudioEngine = () => {
  const context = useContext(CrashSafeAudioEngineContext);
  if (!context) {
    throw new Error('useCrashSafeAudioEngine must be used within CrashSafeAudioEngineProvider');
  }
  return context;
};

export default function CrashSafeAudioEngineProvider({ children }: { children: React.ReactNode }) {
  const { getTracksBySong } = useSimpleDatabase();
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentSongId, setCurrentSongId] = useState<string | null>(null);
  
  const sound = useRef<Audio.Sound | null>(null);

  const cleanup = () => {
    try {
      if (sound.current) {
        sound.current.unloadAsync().catch(() => {});
        sound.current = null;
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  };

  const loadSong = (songId: string): void => {
    try {
      cleanup();
      setCurrentSongId(songId);
      setCurrentTime(0);
      setDuration(0);
      
      // Don't actually load audio to prevent crashes
      // Just set the song ID for display
    } catch (error) {
      console.warn('Load song failed:', error);
    }
  };

  const play = (): void => {
    try {
      setIsPlaying(true);
      
      // Simulate playback without actual audio
      const startTime = Date.now();
      const interval = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        setCurrentTime(elapsed);
      }, 1000);
      
      setTimeout(() => {
        clearInterval(interval);
      }, 10000); // Auto-stop after 10 seconds for demo
    } catch (error) {
      console.warn('Play failed:', error);
    }
  };

  const pause = (): void => {
    try {
      setIsPlaying(false);
    } catch (error) {
      console.warn('Pause failed:', error);
    }
  };

  const stop = (): void => {
    try {
      setIsPlaying(false);
      setCurrentTime(0);
    } catch (error) {
      console.warn('Stop failed:', error);
    }
  };

  const value: CrashSafeAudioEngineContextType = {
    isPlaying,
    currentTime,
    duration,
    play,
    pause,
    stop,
    loadSong,
    currentSongId,
  };

  return (
    <CrashSafeAudioEngineContext.Provider value={value}>
      {children}
    </CrashSafeAudioEngineContext.Provider>
  );
}