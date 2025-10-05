import { songs, tracks, users, type Song, type InsertSong, type Track, type InsertTrack, type SongWithTracks, type User, type UpsertUser } from "@shared/schema";
import { db } from "./db";
import { firebaseUserStorage } from "./firebaseStorage";
import { eq, and, isNotNull } from "drizzle-orm";

export interface IStorage {
  // User operations
  // (IMPORTANT) these user operations are mandatory for Replit Auth.
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByStripeCustomerId(customerId: string): Promise<User | undefined>;
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


  // Waveform caching
  saveWaveform(songId: string, waveformData: number[]): Promise<void>;
  getWaveform(songId: string): Promise<number[] | null>;

  // User subscription management
  getAllUsersWithSubscriptions(): Promise<User[]>;
  updateUserSubscription(userId: string, data: { subscriptionStatus: number; subscriptionEndDate: string | null }): Promise<void>;
  
  // Profile photo management
  updateUserProfilePhoto(email: string, photoData: string): Promise<User | undefined>;
  updateUserProfile(email: string, profileData: { firstName?: string; lastName?: string; phone?: string; customBroadcastId?: string }): Promise<User | undefined>;

  // Legacy methods for compatibility (no-op in database mode)
  getAllData(): any;
  loadData(songs: Song[], tracks: Track[], waveforms?: Record<string, number[]>, users?: User[]): void;
  setAutoSaveCallback(callback: () => void): void;
}

export class DatabaseStorage implements IStorage {
  constructor() {
    console.log('🔥 Hybrid storage initialized:');
    console.log('  - User data: Firebase Firestore');  
    console.log('  - Music data: Local SQLite database');
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

  // User operations (delegated to Firebase)
  async getUser(id: string): Promise<User | undefined> {
    return await firebaseUserStorage.getUser(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return await firebaseUserStorage.getUserByEmail(email);
  }

  async getUserByStripeCustomerId(customerId: string): Promise<User | undefined> {
    return await firebaseUserStorage.getUserByStripeCustomerId(customerId);
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    return await firebaseUserStorage.upsertUser(userData);
  }

  async updateUserStripeInfo(id: string, stripeCustomerId: string, stripeSubscriptionId: string): Promise<User | undefined> {
    return await firebaseUserStorage.updateUserStripeInfo(id, stripeCustomerId, stripeSubscriptionId);
  }

  async updateUserSubscriptionStatus(id: string, status: string, endDate: number): Promise<User | undefined> {
    return await firebaseUserStorage.updateUserSubscriptionStatus(id, status, endDate);
  }

  async getAllUsersWithSubscriptions(): Promise<User[]> {
    return await firebaseUserStorage.getAllUsersWithSubscriptions();
  }

  async updateUserSubscription(userId: string, data: { subscriptionStatus: number; subscriptionEndDate: string | null }): Promise<void> {
    return await firebaseUserStorage.updateUserSubscription(userId, data);
  }

  async updateUserProfilePhoto(email: string, photoData: string): Promise<User | undefined> {
    return await firebaseUserStorage.updateUserProfilePhoto(email, photoData);
  }

  async updateUserProfile(email: string, profileData: { firstName?: string; lastName?: string; phone?: string; customBroadcastId?: string }): Promise<User | undefined> {
    return await firebaseUserStorage.updateUserProfile(email, profileData);
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
      muteRegions: track.muteRegions || null,
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