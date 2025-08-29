import React, { createContext, useContext, useState } from 'react';

interface MinimalAudioContextType {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  play: () => void;
  pause: () => void;
  stop: () => void;
  loadSong: (songId: string) => void;
  currentSongId: string | null;
}

const MinimalAudioContext = createContext<MinimalAudioContextType | null>(null);

export const useMinimalAudio = () => {
  const context = useContext(MinimalAudioContext);
  if (!context) {
    throw new Error('useMinimalAudio must be used within MinimalAudioProvider');
  }
  return context;
};

export default function MinimalAudioProvider({ children }: { children: React.ReactNode }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration] = useState(229); // Fixed duration for demo
  const [currentSongId, setCurrentSongId] = useState<string | null>(null);

  const loadSong = (songId: string): void => {
    setCurrentSongId(songId);
    setCurrentTime(0);
    setIsPlaying(false);
  };

  const play = (): void => {
    setIsPlaying(true);
    // No actual audio - just update the UI state
  };

  const pause = (): void => {
    setIsPlaying(false);
  };

  const stop = (): void => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const value: MinimalAudioContextType = {
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
    <MinimalAudioContext.Provider value={value}>
      {children}
    </MinimalAudioContext.Provider>
  );
}