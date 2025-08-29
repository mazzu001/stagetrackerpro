import React, { createContext, useContext, useState, useEffect } from 'react';

interface StreamingTrack {
  id: string;
  name: string;
  volume: number;
  muted: boolean;
  url?: string;
}

interface StreamingAudioContextType {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  tracks: StreamingTrack[];
  currentSongId: string | null;
  loadSong: (songId: string) => void;
  play: () => void;
  pause: () => void;
  stop: () => void;
  seek: (time: number) => void;
  setTrackVolume: (trackId: string, volume: number) => void;
  toggleTrackMute: (trackId: string) => void;
}

const StreamingAudioContext = createContext<StreamingAudioContextType | null>(null);

export const useStreamingAudio = () => {
  const context = useContext(StreamingAudioContext);
  if (!context) {
    throw new Error('useStreamingAudio must be used within StreamingAudioProvider');
  }
  return context;
};

export default function StreamingAudioProvider({ children }: { children: React.ReactNode }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(229); // Demo duration
  const [tracks, setTracks] = useState<StreamingTrack[]>([]);
  const [currentSongId, setCurrentSongId] = useState<string | null>(null);
  const [timeInterval, setTimeInterval] = useState<NodeJS.Timeout | null>(null);

  // Simulated streaming tracks for demo
  const mockTracks: Record<string, StreamingTrack[]> = {
    '1': [
      { id: 't1', name: '3AM - Drums', volume: 0.8, muted: false },
      { id: 't2', name: '3AM - Bass', volume: 0.8, muted: false },
      { id: 't3', name: '3AM - Guitar', volume: 0.8, muted: false },
    ],
    '2': [
      { id: 't4', name: 'Comfortably Numb - Vocals', volume: 0.8, muted: false },
      { id: 't5', name: 'Comfortably Numb - Guitar', volume: 0.8, muted: false },
    ],
  };

  const loadSong = (songId: string): void => {
    console.log(`🚀 Streaming load: Song ${songId} (instant)`);
    
    setCurrentSongId(songId);
    setCurrentTime(0);
    setIsPlaying(false);
    
    // Load tracks instantly - no preload delay
    const songTracks = mockTracks[songId] || [];
    setTracks(songTracks);
    
    console.log(`✅ Streaming ready: ${songTracks.length} tracks loaded instantly`);
  };

  const play = (): void => {
    console.log(`▶️ Streaming play: ${tracks.length} tracks`);
    setIsPlaying(true);
    
    // Start time tracking for demo
    const interval = setInterval(() => {
      setCurrentTime(prev => {
        const newTime = prev + 0.1;
        if (newTime >= duration) {
          setIsPlaying(false);
          return 0;
        }
        return newTime;
      });
    }, 100);
    
    setTimeInterval(interval);
    console.log(`✅ Streaming playback started`);
  };

  const pause = (): void => {
    console.log(`⏸️ Streaming pause`);
    setIsPlaying(false);
    if (timeInterval) {
      clearInterval(timeInterval);
      setTimeInterval(null);
    }
  };

  const stop = (): void => {
    console.log(`⏹️ Streaming stop`);
    setIsPlaying(false);
    setCurrentTime(0);
    if (timeInterval) {
      clearInterval(timeInterval);
      setTimeInterval(null);
    }
  };

  const seek = (time: number): void => {
    const newTime = Math.max(0, Math.min(time, duration));
    setCurrentTime(newTime);
    console.log(`⏯️ Streaming seek to ${newTime.toFixed(1)}s`);
  };

  const setTrackVolume = (trackId: string, volume: number): void => {
    setTracks(prev => prev.map(track => 
      track.id === trackId ? { ...track, volume } : track
    ));
  };

  const toggleTrackMute = (trackId: string): void => {
    setTracks(prev => prev.map(track => 
      track.id === trackId ? { ...track, muted: !track.muted } : track
    ));
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeInterval) {
        clearInterval(timeInterval);
      }
    };
  }, [timeInterval]);

  const value: StreamingAudioContextType = {
    isPlaying,
    currentTime,
    duration,
    tracks,
    currentSongId,
    loadSong,
    play,
    pause,
    stop,
    seek,
    setTrackVolume,
    toggleTrackMute,
  };

  return (
    <StreamingAudioContext.Provider value={value}>
      {children}
    </StreamingAudioContext.Provider>
  );
}