import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SQLite from 'expo-sqlite';

interface Song {
  id: string;
  title: string;
  artist: string;
  duration: number;
  createdAt: Date;
  updatedAt: Date;
}

interface Track {
  id: string;
  songId: string;
  name: string;
  filePath: string;
  volume: number;
  createdAt: Date;
  updatedAt: Date;
}

interface SimpleDatabaseContextType {
  songs: Song[];
  tracks: Track[];
  addSong: (song: Omit<Song, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Song>;
  addTrack: (track: Omit<Track, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Track>;
  deleteTrack: (id: string) => Promise<void>;
  getTracksBySong: (songId: string) => Track[];
}

const SimpleDatabaseContext = createContext<SimpleDatabaseContextType | null>(null);

export const useSimpleDatabase = () => {
  const context = useContext(SimpleDatabaseContext);
  if (!context) {
    throw new Error('useSimpleDatabase must be used within SimpleDatabaseProvider');
  }
  return context;
};

const generateId = () => `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export default function SimpleDatabaseProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<SQLite.SQLiteDatabase | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);

  useEffect(() => {
    let mounted = true;
    
    const initialize = async () => {
      if (mounted) {
        await initDb();
      }
    };
    
    initialize();
    
    return () => {
      mounted = false;
    };
  }, []);

  const initDb = async () => {
    try {
      const database = await SQLite.openDatabaseAsync('simple-music.db');
      
      await database.execAsync(`
        CREATE TABLE IF NOT EXISTS songs (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          artist TEXT NOT NULL,
          duration REAL DEFAULT 0,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS tracks (
          id TEXT PRIMARY KEY,
          songId TEXT NOT NULL,
          name TEXT NOT NULL,
          filePath TEXT NOT NULL,
          volume REAL DEFAULT 0.8,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL
        );
      `);

      setDb(database);
      await loadData();
    } catch (error) {
      console.error('Database init failed:', error);
    }
  };

  const loadData = async () => {
    if (!db) return;

    try {
      const [songsResult, tracksResult] = await Promise.all([
        db.getAllAsync('SELECT * FROM songs ORDER BY title'),
        db.getAllAsync('SELECT * FROM tracks ORDER BY name')
      ]);

      setSongs(songsResult.map((row: any) => ({
        ...row,
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt)
      })) as Song[]);

      setTracks(tracksResult.map((row: any) => ({
        ...row,
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt)
      })) as Track[]);
    } catch (error) {
      console.error('Load data failed:', error);
    }
  };

  const addSong = async (songData: Omit<Song, 'id' | 'createdAt' | 'updatedAt'>): Promise<Song> => {
    if (!db) throw new Error('Database not ready');

    const id = generateId();
    const now = new Date().toISOString();
    const song: Song = {
      ...songData,
      id,
      createdAt: new Date(now),
      updatedAt: new Date(now)
    };

    await db.runAsync(
      'INSERT INTO songs (id, title, artist, duration, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
      [id, song.title, song.artist, song.duration, now, now]
    );

    await loadData();
    return song;
  };

  const addTrack = async (trackData: Omit<Track, 'id' | 'createdAt' | 'updatedAt'>): Promise<Track> => {
    if (!db) throw new Error('Database not ready');

    const id = generateId();
    const now = new Date().toISOString();
    const track: Track = {
      ...trackData,
      id,
      createdAt: new Date(now),
      updatedAt: new Date(now)
    };

    await db.runAsync(
      'INSERT INTO tracks (id, songId, name, filePath, volume, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, track.songId, track.name, track.filePath, track.volume, now, now]
    );

    await loadData();
    return track;
  };

  const deleteTrack = async (id: string): Promise<void> => {
    if (!db) throw new Error('Database not ready');

    await db.runAsync('DELETE FROM tracks WHERE id = ?', [id]);
    await loadData();
  };

  const getTracksBySong = (songId: string): Track[] => {
    return tracks.filter(track => track.songId === songId);
  };

  const value: SimpleDatabaseContextType = {
    songs,
    tracks,
    addSong,
    addTrack,
    deleteTrack,
    getTracksBySong,
  };

  return (
    <SimpleDatabaseContext.Provider value={value}>
      {children}
    </SimpleDatabaseContext.Provider>
  );
}