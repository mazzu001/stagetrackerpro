import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system';

// Types matching the original schema
interface Song {
  id: string;
  title: string;
  artist: string;
  duration: number;
  bpm?: number;
  key?: string;
  lyrics?: string;
  waveformData?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface Track {
  id: string;
  songId: string;
  name: string;
  filePath: string;
  volume: number;
  muted: boolean;
  solo: boolean;
  balance: number;
  createdAt: Date;
  updatedAt: Date;
}

interface MidiEvent {
  id: string;
  songId: string;
  timestamp: number;
  type: string;
  data: string;
  createdAt: Date;
  updatedAt: Date;
}

interface DatabaseContextType {
  db: SQLite.SQLiteDatabase | null;
  songs: Song[];
  tracks: Track[];
  midiEvents: MidiEvent[];
  addSong: (song: Omit<Song, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Song>;
  updateSong: (id: string, updates: Partial<Song>) => Promise<void>;
  deleteSong: (id: string) => Promise<void>;
  addTrack: (track: Omit<Track, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Track>;
  updateTrack: (id: string, updates: Partial<Track>) => Promise<void>;
  deleteTrack: (id: string) => Promise<void>;
  getTracksBySong: (songId: string) => Track[];
  addMidiEvent: (event: Omit<MidiEvent, 'id' | 'createdAt' | 'updatedAt'>) => Promise<MidiEvent>;
  deleteMidiEvent: (id: string) => Promise<void>;
  getMidiEventsBySong: (songId: string) => MidiEvent[];
  refreshData: () => Promise<void>;
}

const DatabaseContext = createContext<DatabaseContextType | null>(null);

export const useDatabase = () => {
  const context = useContext(DatabaseContext);
  if (!context) {
    throw new Error('useDatabase must be used within a DatabaseProvider');
  }
  return context;
};

export default function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<SQLite.SQLiteDatabase | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [midiEvents, setMidiEvents] = useState<MidiEvent[]>([]);

  useEffect(() => {
    initializeDatabase();
  }, []);

  const initializeDatabase = async () => {
    try {
      const database = await SQLite.openDatabaseAsync('stagePerformance.db');
      
      // Create tables matching the original schema
      await database.execAsync(`
        CREATE TABLE IF NOT EXISTS songs (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          artist TEXT NOT NULL,
          duration REAL NOT NULL,
          bpm INTEGER,
          key TEXT,
          lyrics TEXT,
          waveformData TEXT,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS tracks (
          id TEXT PRIMARY KEY,
          songId TEXT NOT NULL,
          name TEXT NOT NULL,
          filePath TEXT NOT NULL,
          volume REAL NOT NULL DEFAULT 0.8,
          muted INTEGER NOT NULL DEFAULT 0,
          solo INTEGER NOT NULL DEFAULT 0,
          balance REAL NOT NULL DEFAULT 0,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL,
          FOREIGN KEY (songId) REFERENCES songs (id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS midiEvents (
          id TEXT PRIMARY KEY,
          songId TEXT NOT NULL,
          timestamp REAL NOT NULL,
          type TEXT NOT NULL,
          data TEXT NOT NULL,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL,
          FOREIGN KEY (songId) REFERENCES songs (id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_tracks_songId ON tracks(songId);
        CREATE INDEX IF NOT EXISTS idx_midiEvents_songId ON midiEvents(songId);
        CREATE INDEX IF NOT EXISTS idx_midiEvents_timestamp ON midiEvents(timestamp);
      `);

      setDb(database);
      await refreshData();
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Failed to initialize database:', error);
    }
  };

  const refreshData = async () => {
    if (!db) return;

    try {
      const songsResult = await db.getAllAsync('SELECT * FROM songs ORDER BY title');
      const tracksResult = await db.getAllAsync('SELECT * FROM tracks ORDER BY name');
      const midiEventsResult = await db.getAllAsync('SELECT * FROM midiEvents ORDER BY timestamp');

      setSongs(songsResult.map((row: any) => ({
        ...row,
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt)
      })) as Song[]);

      setTracks(tracksResult.map((row: any) => ({
        ...row,
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt),
        muted: Boolean(row.muted),
        solo: Boolean(row.solo)
      })) as Track[]);

      setMidiEvents(midiEventsResult.map((row: any) => ({
        ...row,
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt)
      })) as MidiEvent[]);
    } catch (error) {
      console.error('Failed to refresh data:', error);
    }
  };

  const generateId = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  const addSong = async (songData: Omit<Song, 'id' | 'createdAt' | 'updatedAt'>): Promise<Song> => {
    if (!db) throw new Error('Database not initialized');

    const id = generateId();
    const now = new Date().toISOString();
    const song: Song = {
      ...songData,
      id,
      createdAt: new Date(now),
      updatedAt: new Date(now)
    };

    await db.runAsync(
      `INSERT INTO songs (id, title, artist, duration, bpm, key, lyrics, waveformData, createdAt, updatedAt) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, song.title, song.artist, song.duration, song.bpm, song.key, song.lyrics, song.waveformData, now, now]
    );

    await refreshData();
    return song;
  };

  const updateSong = async (id: string, updates: Partial<Song>): Promise<void> => {
    if (!db) throw new Error('Database not initialized');

    const now = new Date().toISOString();
    const setClause = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(updates), now, id];

    await db.runAsync(
      `UPDATE songs SET ${setClause}, updatedAt = ? WHERE id = ?`,
      values
    );

    await refreshData();
  };

  const deleteSong = async (id: string): Promise<void> => {
    if (!db) throw new Error('Database not initialized');

    // Delete associated tracks and their audio files
    const songTracks = tracks.filter(t => t.songId === id);
    for (const track of songTracks) {
      try {
        await FileSystem.deleteAsync(track.filePath, { idempotent: true });
      } catch (error) {
        console.warn(`Failed to delete audio file: ${track.filePath}`, error);
      }
    }

    await db.runAsync('DELETE FROM songs WHERE id = ?', [id]);
    await refreshData();
  };

  const addTrack = async (trackData: Omit<Track, 'id' | 'createdAt' | 'updatedAt'>): Promise<Track> => {
    console.log('=== DatabaseProvider.addTrack START ===');
    console.log('Track data:', JSON.stringify(trackData, null, 2));
    
    if (!db) {
      console.error('Database not initialized');
      throw new Error('Database not initialized');
    }

    // Validate required fields
    if (!trackData.songId || !trackData.name || !trackData.filePath) {
      console.error('Missing required fields:', {
        songId: !!trackData.songId,
        name: !!trackData.name,
        filePath: !!trackData.filePath
      });
      throw new Error('Missing required track data: songId, name, or filePath');
    }

    // Validate file path exists
    try {
      console.log('Verifying file exists at:', trackData.filePath);
      const fileInfo = await FileSystem.getInfoAsync(trackData.filePath);
      console.log('File info:', fileInfo);
      if (!fileInfo.exists) {
        throw new Error(`Audio file does not exist at path: ${trackData.filePath}`);
      }
    } catch (error) {
      console.error('File verification failed:', error);
      throw new Error(`Failed to verify audio file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    const id = generateId();
    const now = new Date().toISOString();
    const track: Track = {
      ...trackData,
      id,
      createdAt: new Date(now),
      updatedAt: new Date(now)
    };

    console.log('Generated track object:', JSON.stringify(track, null, 2));

    try {
      console.log('Inserting into database...');
      const result = await db.runAsync(
        `INSERT INTO tracks (id, songId, name, filePath, volume, muted, solo, balance, createdAt, updatedAt) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, track.songId, track.name, track.filePath, track.volume, track.muted ? 1 : 0, track.solo ? 1 : 0, track.balance, now, now]
      );
      console.log('Database insert result:', result);

      console.log('Refreshing data...');
      await refreshData();
      console.log('=== DatabaseProvider.addTrack SUCCESS ===');
      return track;
    } catch (error) {
      console.error('=== DatabaseProvider.addTrack DATABASE ERROR ===');
      console.error('Error type:', typeof error);
      console.error('Error instanceof Error:', error instanceof Error);
      console.error('Error message:', error instanceof Error ? error.message : 'No message');
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
      console.error('Full error object:', error);
      console.error('=== END DATABASE ERROR ===');
      throw new Error(`Failed to add track to database: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const updateTrack = async (id: string, updates: Partial<Track>): Promise<void> => {
    if (!db) throw new Error('Database not initialized');

    const now = new Date().toISOString();
    const processedUpdates = { ...updates };
    
    // Convert boolean values for SQLite
    if ('muted' in processedUpdates) {
      (processedUpdates as any).muted = processedUpdates.muted ? 1 : 0;
    }
    if ('solo' in processedUpdates) {
      (processedUpdates as any).solo = processedUpdates.solo ? 1 : 0;
    }

    const setClause = Object.keys(processedUpdates).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(processedUpdates), now, id];

    await db.runAsync(
      `UPDATE tracks SET ${setClause}, updatedAt = ? WHERE id = ?`,
      values
    );

    await refreshData();
  };

  const deleteTrack = async (id: string): Promise<void> => {
    if (!db) throw new Error('Database not initialized');
    
    if (!id) {
      throw new Error('Track ID is required for deletion');
    }

    const track = tracks.find(t => t.id === id);
    if (track) {
      try {
        await FileSystem.deleteAsync(track.filePath, { idempotent: true });
        console.log(`Successfully deleted audio file: ${track.filePath}`);
      } catch (error) {
        console.warn(`Failed to delete audio file: ${track.filePath}`, error);
        // Continue with database deletion even if file deletion fails
      }
    }

    try {
      const result = await db.runAsync('DELETE FROM tracks WHERE id = ?', [id]);
      
      if (result.changes === 0) {
        throw new Error('Track not found or already deleted');
      }

      await refreshData();
      console.log(`Successfully deleted track with ID: ${id}`);
    } catch (error) {
      throw new Error(`Failed to delete track: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const getTracksBySong = (songId: string): Track[] => {
    return tracks.filter(track => track.songId === songId);
  };

  const addMidiEvent = async (eventData: Omit<MidiEvent, 'id' | 'createdAt' | 'updatedAt'>): Promise<MidiEvent> => {
    if (!db) throw new Error('Database not initialized');

    const id = generateId();
    const now = new Date().toISOString();
    const event: MidiEvent = {
      ...eventData,
      id,
      createdAt: new Date(now),
      updatedAt: new Date(now)
    };

    await db.runAsync(
      `INSERT INTO midiEvents (id, songId, timestamp, type, data, createdAt, updatedAt) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, event.songId, event.timestamp, event.type, event.data, now, now]
    );

    await refreshData();
    return event;
  };

  const deleteMidiEvent = async (id: string): Promise<void> => {
    if (!db) throw new Error('Database not initialized');

    await db.runAsync('DELETE FROM midiEvents WHERE id = ?', [id]);
    await refreshData();
  };

  const getMidiEventsBySong = (songId: string): MidiEvent[] => {
    return midiEvents.filter(event => event.songId === songId);
  };

  const value: DatabaseContextType = {
    db,
    songs,
    tracks,
    midiEvents,
    addSong,
    updateSong,
    deleteSong,
    addTrack,
    updateTrack,
    deleteTrack,
    getTracksBySong,
    addMidiEvent,
    deleteMidiEvent,
    getMidiEventsBySong,
    refreshData,
  };

  return (
    <DatabaseContext.Provider value={value}>
      {children}
    </DatabaseContext.Provider>
  );
}