import { songs, tracks, users, usersPg, type Song, type InsertSong, type Track, type InsertTrack, type SongWithTracks, type User, type UpsertUser, type UserPg } from "@shared/schema";
import { localDb, userDb } from "./db";
import { eq, and } from "drizzle-orm";

export interface IStorage {
  // User operations
  // (IMPORTANT) these user operations are mandatory for Replit Auth.
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserStripeInfo(id: string, stripeCustomerId: string, stripeSubscriptionId: string): Promise<User | undefined>;
  updateUserSubscriptionStatus(id: string, status: string, endDate: number): Promise<User | undefined>;

  // Songs
  getSong(id: string, userId?: string): Promise<Song | undefined>;
  getAllSongs(userId?: string): Promise<SongWithTracks[]>;
  createSong(song: InsertSong): Promise<Song>;
  updateSong(id: string, song: Partial<InsertSong>, userId?: string): Promise<Song | undefined>;
  deleteSong(id: string, userId?: string): Promise<boolean>;
  getSongWithTracks(id: string, userId?: string): Promise<SongWithTracks | undefined>;

  // Tracks
  getTrack(id: string): Promise<Track | undefined>;
  getTracksBySongId(songId: string): Promise<Track[]>;
  createTrack(track: InsertTrack): Promise<Track>;
  updateTrack(id: string, track: Partial<InsertTrack>): Promise<Track | undefined>;
  deleteTrack(id: string): Promise<boolean>;

  // MIDI Events (removed but interface kept for compatibility)
  // getMidiEvent(id: string): Promise<MidiEvent | undefined>;
  // getMidiEventsBySongId(songId: string): Promise<MidiEvent[]>;
  // createMidiEvent(midiEvent: InsertMidiEvent): Promise<MidiEvent>;
  // updateMidiEvent(id: string, midiEvent: Partial<InsertMidiEvent>): Promise<MidiEvent | undefined>;
  // deleteMidiEvent(id: string): Promise<boolean>;

  // Waveform caching
  saveWaveform(songId: string, waveformData: number[]): Promise<void>;
  getWaveform(songId: string): Promise<number[] | null>;

  // Legacy methods for compatibility (no-op in database mode)
  getAllData(): any;
  loadData(songs: Song[], tracks: Track[], waveforms?: Record<string, number[]>, users?: User[]): void;
  setAutoSaveCallback(callback: () => void): void;
}

export class DatabaseStorage implements IStorage {
  constructor() {
    console.log('DatabaseStorage initialized - using hybrid database setup');
    console.log('- User data: Cloud PostgreSQL database');  
    console.log('- Music data: Local SQLite database');
  }

  // Legacy methods for compatibility (no-op since data is in cloud database)
  getAllData() {
    console.log('getAllData: Data is now stored in local SQLite database');
    return {
      users: [],
      songs: [],
      tracks: [],
      waveforms: {}
    };
  }

  loadData(songData: Song[], trackData: Track[], waveforms?: Record<string, number[]>, userData?: User[]) {
    console.log('loadData: Data is now stored in local SQLite database, ignoring localStorage');
  }

  setAutoSaveCallback(callback: () => void) {
    console.log('setAutoSaveCallback: Data auto-saves to local SQLite database');
  }

  // User operations (use cloud PostgreSQL database)
  async getUser(id: string): Promise<User | undefined> {
    if (!userDb) {
      console.error('Cloud database not available for user operations');
      return undefined;
    }
    const [user] = await userDb.select().from(usersPg).where(eq(usersPg.id, id));
    if (!user) return undefined;
    
    // Convert PostgreSQL user to SQLite user format
    return {
      ...user,
      createdAt: user.createdAt?.toISOString() || null,
      updatedAt: user.updatedAt?.toISOString() || null,
    };
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    if (!userDb) {
      console.error('Cloud database not available for user operations');
      return undefined;
    }
    const [user] = await userDb.select().from(usersPg).where(eq(usersPg.email, email));
    if (!user) return undefined;
    
    // Convert PostgreSQL user to SQLite user format
    return {
      ...user,
      createdAt: user.createdAt?.toISOString() || null,
      updatedAt: user.updatedAt?.toISOString() || null,
    };
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    if (!userDb) {
      throw new Error('Cloud database not available for user operations');
    }
    const [user] = await userDb
      .insert(usersPg)
      .values({
        ...userData,
        subscriptionStatus: userData.subscriptionStatus || 'free', // Default to free
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: usersPg.id,
        set: {
          ...userData,
          subscriptionStatus: userData.subscriptionStatus || 'free',
          updatedAt: new Date(),
        },
      })
      .returning();
    
    console.log('User upserted in cloud database:', user.id, user.email, user.subscriptionStatus);
    
    // Convert PostgreSQL user to SQLite user format
    return {
      ...user,
      createdAt: user.createdAt?.toISOString() || null,
      updatedAt: user.updatedAt?.toISOString() || null,
    };
  }

  async updateUserStripeInfo(id: string, stripeCustomerId: string, stripeSubscriptionId: string): Promise<User | undefined> {
    if (!userDb) {
      console.error('Cloud database not available for user operations');
      return undefined;
    }
    const [user] = await userDb
      .update(usersPg)
      .set({
        stripeCustomerId,
        stripeSubscriptionId,
        subscriptionStatus: 'active',
        updatedAt: new Date(),
      })
      .where(eq(usersPg.id, id))
      .returning();

    if (user) {
      console.log('Updated user Stripe info in cloud database:', id, stripeCustomerId);
      // Convert PostgreSQL user to SQLite user format
      return {
        ...user,
        createdAt: user.createdAt?.toISOString() || null,
        updatedAt: user.updatedAt?.toISOString() || null,
      };
    } else {
      console.error('User not found for Stripe update:', id);
      return undefined;
    }
  }

  async updateUserSubscriptionStatus(id: string, status: string, endDate: number): Promise<User | undefined> {
    if (!userDb) {
      console.error('Cloud database not available for user operations');
      return undefined;
    }
    
    try {
      const endDateISO = new Date(endDate * 1000).toISOString();
      
      const [user] = await userDb
        .update(usersPg)
        .set({ 
          subscriptionStatus: status,
          subscriptionEndDate: endDateISO,
          updatedAt: new Date()
        })
        .where(eq(usersPg.id, id))
        .returning();
      
      if (!user) return undefined;
      
      console.log('User subscription status updated:', user.id, status, endDateISO);
      
      return {
        ...user,
        createdAt: user.createdAt?.toISOString() || null,
        updatedAt: user.updatedAt?.toISOString() || null,
      };
    } catch (error) {
      console.error('Error updating user subscription status:', error);
      return undefined;
    }
  }

  // Song operations (use local SQLite database)
  async getSong(id: string, userId?: string): Promise<Song | undefined> {
    if (userId) {
      const [song] = await localDb.select().from(songs)
        .where(and(eq(songs.id, id), eq(songs.userId, userId)));
      return song || undefined;
    } else {
      const [song] = await localDb.select().from(songs)
        .where(eq(songs.id, id));
      return song || undefined;
    }
  }

  async getAllSongs(userId?: string): Promise<SongWithTracks[]> {
    // Use a more efficient query by fetching everything in parallel, filtered by user
    const [allSongs, allTracks] = await Promise.all([
      userId ? localDb.select().from(songs).where(eq(songs.userId, userId)) : localDb.select().from(songs),
      localDb.select().from(tracks)
    ]);
    
    // Group tracks by song ID
    const tracksBySong = new Map<string, typeof allTracks>();
    
    allTracks.forEach(track => {
      if (!tracksBySong.has(track.songId)) {
        tracksBySong.set(track.songId, []);
      }
      tracksBySong.get(track.songId)!.push(track);
    });
    
    // Combine all data
    const songsWithTracks: SongWithTracks[] = allSongs.map(song => ({
      ...song,
      tracks: tracksBySong.get(song.id) || [],
    }));
    
    return songsWithTracks;
  }

  async createSong(song: InsertSong): Promise<Song> {
    const [newSong] = await localDb.insert(songs).values(song).returning();
    console.log('Song created in local database:', newSong.id, newSong.title);
    return newSong;
  }

  async updateSong(id: string, song: Partial<InsertSong>, userId?: string): Promise<Song | undefined> {
    let whereClause = eq(songs.id, id);
    if (userId) {
      whereClause = and(eq(songs.id, id), eq(songs.userId, userId)) as any;
    }
    
    const [updatedSong] = await localDb
      .update(songs)
      .set(song)
      .where(whereClause)
      .returning();
    
    if (updatedSong) {
      console.log('Song updated in database:', id, updatedSong.title);
    }
    return updatedSong || undefined;
  }

  async deleteSong(id: string, userId?: string): Promise<boolean> {
    try {
      // First check if the song exists and belongs to user
      let whereClause = eq(songs.id, id);
      if (userId) {
        whereClause = and(eq(songs.id, id), eq(songs.userId, userId)) as any;
      }
      
      const existingSong = await localDb.select().from(songs).where(whereClause);
      if (existingSong.length === 0) {
        console.log('Song not found for deletion:', id);
        return false;
      }

      console.log('Deleting song from local database:', id, existingSong[0].title);

      // Delete associated tracks (including audio data) and MIDI events first
      const tracksResult = await localDb.delete(tracks).where(eq(tracks.songId, id));
      const midiResult = await localDb.delete(midiEvents).where(eq(midiEvents.songId, id));
      
      console.log(`Deleted ${tracksResult.changes || 0} tracks and ${midiResult.changes || 0} MIDI events for song: ${id}`);
      
      // Delete the song itself
      const result = await localDb.delete(songs).where(whereClause);
      const deleted = result.changes ? result.changes > 0 : false;
      
      if (deleted) {
        console.log('Song and all associated data deleted from database:', id);
      } else {
        console.log('Failed to delete song from database:', id);
      }
      
      return deleted;
    } catch (error) {
      console.error('Error during song deletion:', error);
      return false;
    }
  }

  async getSongWithTracks(id: string, userId?: string): Promise<SongWithTracks | undefined> {
    const song = await this.getSong(id, userId);
    if (!song) return undefined;

    const songTracks = await localDb.select().from(tracks).where(eq(tracks.songId, id));

    return {
      ...song,
      tracks: songTracks,
    };
  }

  // Track operations (use local SQLite database)
  async getTrack(id: string): Promise<Track | undefined> {
    const [track] = await localDb.select().from(tracks).where(eq(tracks.id, id));
    return track || undefined;
  }

  async getTracksBySongId(songId: string): Promise<Track[]> {
    const trackData = await localDb.select().from(tracks).where(eq(tracks.songId, songId));
    
    // Add hasAudioData field to indicate if track has blob data
    return trackData.map(track => ({
      ...track,
      hasAudioData: !!track.audioData
    }));
  }

  async createTrack(track: InsertTrack): Promise<Track> {
    const [newTrack] = await localDb.insert(tracks).values(track).returning();
    console.log('Track created in local database:', newTrack.id, newTrack.name);
    return newTrack;
  }

  // Store audio file data directly in database as base64
  async storeAudioFile(trackId: string, audioData: string, mimeType: string, fileSize: number): Promise<void> {
    await localDb
      .update(tracks)
      .set({ 
        audioData,
        mimeType,
        fileSize,
        audioUrl: 'blob:stored' // Indicate this is a database blob
      })
      .where(eq(tracks.id, trackId));
    
    console.log('Audio file stored in local database for track:', trackId, `(${Math.round(fileSize / 1024)}KB)`);
  }

  // Get audio file data from database
  async getAudioFileData(trackId: string): Promise<{ data: string; mimeType: string; size: number } | null> {
    const [track] = await localDb
      .select({ 
        audioData: tracks.audioData, 
        mimeType: tracks.mimeType, 
        fileSize: tracks.fileSize 
      })
      .from(tracks)
      .where(eq(tracks.id, trackId));

    if (track?.audioData) {
      return {
        data: track.audioData,
        mimeType: track.mimeType || 'audio/mpeg',
        size: track.fileSize || 0
      };
    }

    return null;
  }

  async updateTrack(id: string, track: Partial<InsertTrack>): Promise<Track | undefined> {
    const [updatedTrack] = await localDb
      .update(tracks)
      .set(track)
      .where(eq(tracks.id, id))
      .returning();
    
    if (updatedTrack) {
      console.log('Track updated in local database:', id, updatedTrack.name);
    }
    return updatedTrack || undefined;
  }

  async deleteTrack(id: string): Promise<boolean> {
    const result = await localDb.delete(tracks).where(eq(tracks.id, id));
    const deleted = result.changes ? result.changes > 0 : false;
    
    if (deleted) {
      console.log('Track deleted from local database:', id);
    }
    return deleted;
  }

  // MIDI functionality has been completely removed

  // Waveform operations (store in song's waveformData field in local database)
  async saveWaveform(songId: string, waveformData: number[]): Promise<void> {
    await localDb
      .update(songs)
      .set({ 
        waveformData: JSON.stringify(waveformData),
        waveformGenerated: true 
      })
      .where(eq(songs.id, songId));
    
    console.log('Waveform saved to local database for song:', songId);
  }

  async getWaveform(songId: string): Promise<number[] | null> {
    const [song] = await localDb.select({ waveformData: songs.waveformData }).from(songs).where(eq(songs.id, songId));
    
    if (song?.waveformData) {
      try {
        return JSON.parse(song.waveformData);
      } catch (error) {
        console.error('Error parsing waveform data:', error);
        return null;
      }
    }
    
    return null;
  }
}

export const storage = new DatabaseStorage();