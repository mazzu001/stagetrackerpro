import React, { createContext, useContext, useState, useRef } from 'react';
import { Audio } from 'expo-av';
import { useDatabase } from './DatabaseProvider';

interface SimpleAudioEngineContextType {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  stop: () => Promise<void>;
  loadSong: (songId: string) => Promise<void>;
  currentSongId: string | null;
}

const SimpleAudioEngineContext = createContext<SimpleAudioEngineContextType | null>(null);

export const useSimpleAudioEngine = () => {
  const context = useContext(SimpleAudioEngineContext);
  if (!context) {
    throw new Error('useSimpleAudioEngine must be used within SimpleAudioEngineProvider');
  }
  return context;
};

export default function SimpleAudioEngineProvider({ children }: { children: React.ReactNode }) {
  const { getTracksBySong } = useDatabase();
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentSongId, setCurrentSongId] = useState<string | null>(null);
  
  const sound = useRef<Audio.Sound | null>(null);
  const positionInterval = useRef<NodeJS.Timeout | null>(null);

  const cleanup = async () => {
    if (positionInterval.current) {
      clearInterval(positionInterval.current);
      positionInterval.current = null;
    }
    
    if (sound.current) {
      try {
        await sound.current.unloadAsync();
      } catch (error) {
        // Ignore cleanup errors
      }
      sound.current = null;
    }
  };

  const loadSong = async (songId: string): Promise<void> => {
    try {
      await cleanup();
      
      const tracks = getTracksBySong(songId);
      if (tracks.length === 0) {
        setCurrentSongId(songId);
        return;
      }
      
      // Load only the first track for simplicity
      const firstTrack = tracks[0];
      
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: firstTrack.filePath },
        { shouldPlay: false }
      );
      
      sound.current = newSound;
      
      const status = await newSound.getStatusAsync();
      if (status.isLoaded && status.durationMillis) {
        setDuration(status.durationMillis / 1000);
      }
      
      setCurrentSongId(songId);
      setCurrentTime(0);
    } catch (error) {
      console.error('Failed to load song:', error);
    }
  };

  const play = async (): Promise<void> => {
    if (!sound.current) return;
    
    try {
      await sound.current.playAsync();
      setIsPlaying(true);
      
      // Simple position updates
      positionInterval.current = setInterval(async () => {
        if (sound.current) {
          try {
            const status = await sound.current.getStatusAsync();
            if (status.isLoaded && status.positionMillis !== undefined) {
              setCurrentTime(status.positionMillis / 1000);
            }
          } catch (error) {
            // Ignore position errors
          }
        }
      }, 500);
    } catch (error) {
      console.error('Failed to play:', error);
    }
  };

  const pause = async (): Promise<void> => {
    if (!sound.current) return;
    
    try {
      await sound.current.pauseAsync();
      setIsPlaying(false);
      
      if (positionInterval.current) {
        clearInterval(positionInterval.current);
        positionInterval.current = null;
      }
    } catch (error) {
      console.error('Failed to pause:', error);
    }
  };

  const stop = async (): Promise<void> => {
    if (!sound.current) return;
    
    try {
      await sound.current.stopAsync();
      setIsPlaying(false);
      setCurrentTime(0);
      
      if (positionInterval.current) {
        clearInterval(positionInterval.current);
        positionInterval.current = null;
      }
    } catch (error) {
      console.error('Failed to stop:', error);
    }
  };

  const value: SimpleAudioEngineContextType = {
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
    <SimpleAudioEngineContext.Provider value={value}>
      {children}
    </SimpleAudioEngineContext.Provider>
  );
}