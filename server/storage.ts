import { songs, tracks, users, type Song, type InsertSong, type Track, type InsertTrack, type SongWithTracks, type User, type UpsertUser } from "@shared/schema";
import { db } from "./db";
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

  // Song operations (handled locally in browser - these are no-op on server)
  async getSong(id: string, userId?: string): Promise<Song | undefined> {
    console.log('getSong: Music data handled locally in browser, not on server');
    return undefined;
  }

  async getAllSongs(userId?: string): Promise<SongWithTracks[]> {
    console.log('getAllSongs: Music data handled locally in browser, not on server');
    return [];
  }

  async createSong(song: InsertSong): Promise<Song> {
    console.log('createSong: Music data handled locally in browser, not on server');
    // Return a mock song structure for type compatibility
    return {
      id: 'local-song',
      userId: song.userId,
      title: song.title,
      artist: song.artist,
      duration: song.duration,
      bpm: song.bpm || null,
      key: song.key || null,
      lyrics: song.lyrics || null,
      waveformData: song.waveformData || null,
      waveformGenerated: false,
      createdAt: new Date().toISOString(),
    };
  }

  async updateSong(id: string, song: Partial<InsertSong>, userId?: string): Promise<Song | undefined> {
    console.log('updateSong: Music data handled locally in browser, not on server');
    return undefined;
  }

  async deleteSong(id: string, userId?: string): Promise<boolean> {
    console.log('deleteSong: Music data handled locally in browser, not on server');
    return false;
  }

  async getSongWithTracks(id: string, userId?: string): Promise<SongWithTracks | undefined> {
    console.log('getSongWithTracks: Music data handled locally in browser, not on server');
    return undefined;
  }

  // Track operations (handled locally in browser - these are no-op on server)
  async getTrack(id: string): Promise<Track | undefined> {
    console.log('getTrack: Music data handled locally in browser, not on server');
    return undefined;
  }

  async getTracksBySongId(songId: string): Promise<Track[]> {
    console.log('getTracksBySongId: Music data handled locally in browser, not on server');
    return [];
  }

  async createTrack(track: InsertTrack): Promise<Track> {
    console.log('createTrack: Music data handled locally in browser, not on server');
    // Return a mock track structure for type compatibility
    return {
      id: 'local-track',
      songId: track.songId,
      name: track.name,
      trackNumber: track.trackNumber,
      audioUrl: track.audioUrl,
      localFileName: track.localFileName || null,
      audioData: track.audioData || null,
      mimeType: track.mimeType || 'audio/mpeg',
      fileSize: track.fileSize || 0,
      volume: track.volume || 100,
      balance: track.balance || 0,
      isMuted: track.isMuted || false,
      isSolo: track.isSolo || false,
    };
  }

  async updateTrack(id: string, track: Partial<InsertTrack>): Promise<Track | undefined> {
    console.log('updateTrack: Music data handled locally in browser, not on server');
    return undefined;
  }

  async deleteTrack(id: string): Promise<boolean> {
    console.log('deleteTrack: Music data handled locally in browser, not on server');
    return false;
  }

  // MIDI functionality has been completely removed

  // Waveform operations (handled locally in browser - these are no-op on server)
  async saveWaveform(songId: string, waveformData: number[]): Promise<void> {
    console.log('saveWaveform: Music data handled locally in browser, not on server');
  }

  async getWaveform(songId: string): Promise<number[] | null> {
    console.log('getWaveform: Music data handled locally in browser, not on server');
    return null;
  }
}

export const storage = new DatabaseStorage();