import React, { createContext, useContext, useState } from 'react';

interface Song {
  id: string;
  title: string;
  artist: string;
}

interface Track {
  id: string;
  songId: string;
  name: string;
}

interface MinimalStorageContextType {
  songs: Song[];
  tracks: Track[];
  addSong: (song: Omit<Song, 'id'>) => Song;
  addTrack: (track: Omit<Track, 'id'>) => Track;
  deleteTrack: (id: string) => void;
  getTracksBySong: (songId: string) => Track[];
}

const MinimalStorageContext = createContext<MinimalStorageContextType | null>(null);

export const useMinimalStorage = () => {
  const context = useContext(MinimalStorageContext);
  if (!context) {
    throw new Error('useMinimalStorage must be used within MinimalStorageProvider');
  }
  return context;
};

const generateId = () => `${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

export default function MinimalStorageProvider({ children }: { children: React.ReactNode }) {
  const [songs, setSongs] = useState<Song[]>([
    { id: '1', title: '3AM', artist: 'Demo Artist' },
    { id: '2', title: 'Comfortably Numb', artist: 'Demo Artist' }
  ]);
  
  const [tracks, setTracks] = useState<Track[]>([
    { id: 't1', songId: '1', name: '3AM - Drums' },
    { id: 't2', songId: '1', name: '3AM - Bass' },
    { id: 't3', songId: '1', name: '3AM - Guitar' },
    { id: 't4', songId: '2', name: 'Comfortably Numb - Vocals' },
    { id: 't5', songId: '2', name: 'Comfortably Numb - Guitar' }
  ]);

  const addSong = (songData: Omit<Song, 'id'>): Song => {
    const song: Song = { ...songData, id: generateId() };
    setSongs(prev => [...prev, song]);
    return song;
  };

  const addTrack = (trackData: Omit<Track, 'id'>): Track => {
    const track: Track = { ...trackData, id: generateId() };
    setTracks(prev => [...prev, track]);
    return track;
  };

  const deleteTrack = (id: string): void => {
    setTracks(prev => prev.filter(track => track.id !== id));
  };

  const getTracksBySong = (songId: string): Track[] => {
    return tracks.filter(track => track.songId === songId);
  };

  const value: MinimalStorageContextType = {
    songs,
    tracks,
    addSong,
    addTrack,
    deleteTrack,
    getTracksBySong,
  };

  return (
    <MinimalStorageContext.Provider value={value}>
      {children}
    </MinimalStorageContext.Provider>
  );
}