import { songs, tracks, users, type Song, type InsertSong, type Track, type InsertTrack, type SongWithTracks, type User, type UpsertUser } from "@shared/schema";
import { pgDb, sqliteDbConn } from "./db";
import { eq, and, isNotNull } from "drizzle-orm";

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

  // User subscription management
  getAllUsersWithSubscriptions(): Promise<User[]>;
  updateUserSubscription(userId: string, data: { subscriptionStatus: number; subscriptionEndDate: string | null }): Promise<void>;

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

  async getAllUsersWithSubscriptions(): Promise<User[]> {
    try {
      const allUsers = await db.select().from(users).where(isNotNull(users.stripeSubscriptionId));
      return allUsers;
    } catch (error) {
      console.error('❌ Error fetching users with subscriptions:', error);
      return [];
    }
  }

  async updateUserSubscription(userId: string, data: { subscriptionStatus: number; subscriptionEndDate: string | null }): Promise<void> {
    try {
      await db
        .update(users)
        .set({
          subscriptionStatus: data.subscriptionStatus,
          subscriptionEndDate: data.subscriptionEndDate ? new Date(data.subscriptionEndDate) : null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));
        
      console.log(`✅ Updated subscription for user ${userId}: status=${data.subscriptionStatus}`);
    } catch (error) {
      console.error(`❌ Error updating subscription for user ${userId}:`, error);
      throw error;
    }
  }

  // User operations (use PostgreSQL database)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        ...userData,
        subscriptionStatus: userData.subscriptionStatus || 1, // Default to 1 (free)
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          subscriptionStatus: userData.subscriptionStatus || 1,
          updatedAt: new Date(),
        },
      })
      .returning();
    
    console.log('User upserted in database:', user.id, user.email, `subscription: ${user.subscriptionStatus}`);
    return user;
  }

  async updateUserStripeInfo(id: string, stripeCustomerId: string, stripeSubscriptionId: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({
        stripeCustomerId,
        stripeSubscriptionId,
        subscriptionStatus: 2, // 2 = premium active
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();

    if (user) {
      console.log('Updated user Stripe info:', id, stripeCustomerId);
      return user;
    } else {
      console.error('User not found for Stripe update:', id);
      return undefined;
    }
  }

  async updateUserSubscriptionStatus(id: string, status: string, endDate: number): Promise<User | undefined> {
    try {
      const endDateValue = new Date(endDate * 1000);
      
      const [user] = await db
        .update(users)
        .set({ 
          subscriptionStatus: parseInt(status),
          subscriptionEndDate: endDateValue,
          updatedAt: new Date()
        })
        .where(eq(users.id, id))
        .returning();
      
      if (!user) return undefined;
      
      console.log('User subscription status updated:', user.id, status, endDateValue.toISOString());
      return user;
    } catch (error) {
      console.error('Error updating user subscription status:', error);
      return undefined;
    }
  }

  // Song operations (use PostgreSQL database)
  async getSong(id: string, userId?: string): Promise<Song | undefined> {
    if (userId) {
      const [song] = await db.select().from(songs)
        .where(and(eq(songs.id, id), eq(songs.userId, userId)));
      return song || undefined;
    } else {
      const [song] = await db.select().from(songs)
        .where(eq(songs.id, id));
      return song || undefined;
    }
  }

  async getAllSongs(userId?: string): Promise<SongWithTracks[]> {
    // Use a more efficient query by fetching everything in parallel, filtered by user
    const [allSongs, allTracks] = await Promise.all([
      userId ? db.select().from(songs).where(eq(songs.userId, userId)) : db.select().from(songs),
      db.select().from(tracks)
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
    const [newSong] = await db.insert(songs).values(song).returning();
    console.log('Song created in database:', newSong.id, newSong.title);
    return newSong;
  }

  async updateSong(id: string, song: Partial<InsertSong>, userId?: string): Promise<Song | undefined> {
    let whereClause = eq(songs.id, id);
    if (userId) {
      whereClause = and(eq(songs.id, id), eq(songs.userId, userId)) as any;
    }
    
    const [updatedSong] = await db
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
      
      const existingSong = await db.select().from(songs).where(whereClause);
      if (existingSong.length === 0) {
        console.log('Song not found for deletion:', id);
        return false;
      }

      console.log('Deleting song from local database:', id, existingSong[0].title);

      // Delete associated tracks (including audio data)
      const tracksResult = await db.delete(tracks).where(eq(tracks.songId, id));
      
      console.log(`Deleted ${tracksResult.changes || 0} tracks for song: ${id}`);
      
      // Delete the song itself
      const result = await db.delete(songs).where(whereClause);
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

    const songTracks = await db.select().from(tracks).where(eq(tracks.songId, id));

    return {
      ...song,
      tracks: songTracks,
    };
  }

  // Track operations (use PostgreSQL database)
  async getTrack(id: string): Promise<Track | undefined> {
    const [track] = await db.select().from(tracks).where(eq(tracks.id, id));
    return track || undefined;
  }

  async getTracksBySongId(songId: string): Promise<Track[]> {
    const trackData = await db.select().from(tracks).where(eq(tracks.songId, songId));
    
    // Add hasAudioData field to indicate if track has blob data
    return trackData.map(track => ({
      ...track,
      hasAudioData: !!track.audioData
    }));
  }

  async createTrack(track: InsertTrack): Promise<Track> {
    const [newTrack] = await db.insert(tracks).values(track).returning();
    console.log('Track created in database:', newTrack.id, newTrack.name);
    return newTrack;
  }

  // Store audio file data directly in database as base64
  async storeAudioFile(trackId: string, audioData: string, mimeType: string, fileSize: number): Promise<void> {
    await db
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
    const [track] = await db
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
    const [updatedTrack] = await db
      .update(tracks)
      .set(track)
      .where(eq(tracks.id, id))
      .returning();
    
    if (updatedTrack) {
      console.log('Track updated in database:', id, updatedTrack.name);
    }
    return updatedTrack || undefined;
  }

  async deleteTrack(id: string): Promise<boolean> {
    const result = await db.delete(tracks).where(eq(tracks.id, id));
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