import { type Song, type InsertSong, type Track, type InsertTrack, type MidiEvent, type InsertMidiEvent, type SongWithTracks, type User, type UpsertUser } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // User operations
  // (IMPORTANT) these user operations are mandatory for Replit Auth.
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserStripeInfo(id: string, stripeCustomerId: string, stripeSubscriptionId: string): Promise<User | undefined>;

  // Songs
  getSong(id: string): Promise<Song | undefined>;
  getAllSongs(): Promise<SongWithTracks[]>;
  createSong(song: InsertSong): Promise<Song>;
  updateSong(id: string, song: Partial<InsertSong>): Promise<Song | undefined>;
  deleteSong(id: string): Promise<boolean>;
  getSongWithTracks(id: string): Promise<SongWithTracks | undefined>;

  // Tracks
  getTrack(id: string): Promise<Track | undefined>;
  getTracksBySongId(songId: string): Promise<Track[]>;
  createTrack(track: InsertTrack): Promise<Track>;
  updateTrack(id: string, track: Partial<InsertTrack>): Promise<Track | undefined>;
  deleteTrack(id: string): Promise<boolean>;

  // MIDI Events
  getMidiEvent(id: string): Promise<MidiEvent | undefined>;
  getMidiEventsBySongId(songId: string): Promise<MidiEvent[]>;
  createMidiEvent(midiEvent: InsertMidiEvent): Promise<MidiEvent>;
  updateMidiEvent(id: string, midiEvent: Partial<InsertMidiEvent>): Promise<MidiEvent | undefined>;
  deleteMidiEvent(id: string): Promise<boolean>;

  // Waveform caching
  saveWaveform(songId: string, waveformData: number[]): Promise<void>;
  getWaveform(songId: string): Promise<number[] | null>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private songs: Map<string, Song>;
  private tracks: Map<string, Track>;
  private midiEvents: Map<string, MidiEvent>;
  private waveforms: Map<string, number[]>; // Cache for waveforms
  private autoSaveCallback?: () => void;

  constructor() {
    this.users = new Map();
    this.songs = new Map();
    this.tracks = new Map();
    this.midiEvents = new Map();
    this.waveforms = new Map();
  }

  setAutoSaveCallback(callback: () => void) {
    this.autoSaveCallback = callback;
  }

  private triggerAutoSave() {
    if (this.autoSaveCallback) {
      // Debounce auto-save to avoid too frequent saves
      setTimeout(() => {
        this.autoSaveCallback?.();
      }, 500);
    }
  }

  // Method to get all data for persistence
  getAllData() {
    return {
      users: Array.from(this.users.values()),
      songs: Array.from(this.songs.values()),
      tracks: Array.from(this.tracks.values()),
      midiEvents: Array.from(this.midiEvents.values()),
      waveforms: Object.fromEntries(this.waveforms)
    };
  }

  // Method to load data from persistence
  loadData(songs: Song[], tracks: Track[], midiEvents: MidiEvent[], waveforms?: Record<string, number[]>, users?: User[]) {
    this.users.clear();
    this.songs.clear();
    this.tracks.clear();
    this.midiEvents.clear();
    this.waveforms.clear();

    if (users) {
      users.forEach(user => this.users.set(user.id, user));
    }
    songs.forEach(song => this.songs.set(song.id, song));
    tracks.forEach(track => this.tracks.set(track.id, track));
    midiEvents.forEach(event => this.midiEvents.set(event.id, event));
    
    if (waveforms) {
      Object.entries(waveforms).forEach(([songId, data]) => 
        this.waveforms.set(songId, data)
      );
    }
  }

  // User operations
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const existing = this.users.get(userData.id!);
    
    if (existing) {
      // Update existing user
      const updated: User = {
        ...existing,
        ...userData,
        updatedAt: new Date(),
      };
      this.users.set(userData.id!, updated);
      return updated;
    } else {
      // Create new user
      const newUser: User = {
        id: userData.id || randomUUID(),
        email: userData.email || null,
        firstName: userData.firstName || null,
        lastName: userData.lastName || null,
        profileImageUrl: userData.profileImageUrl || null,
        stripeCustomerId: userData.stripeCustomerId || null,
        stripeSubscriptionId: userData.stripeSubscriptionId || null,
        subscriptionStatus: userData.subscriptionStatus || null,
        subscriptionEndDate: userData.subscriptionEndDate || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.users.set(newUser.id, newUser);
      return newUser;
    }
  }

  async updateUserStripeInfo(id: string, stripeCustomerId: string, stripeSubscriptionId: string): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;

    const updated: User = {
      ...user,
      stripeCustomerId,
      stripeSubscriptionId,
      subscriptionStatus: 'active',
      updatedAt: new Date(),
    };
    this.users.set(id, updated);
    return updated;
  }

  // Songs
  async getSong(id: string): Promise<Song | undefined> {
    return this.songs.get(id);
  }

  async getAllSongs(): Promise<SongWithTracks[]> {
    const songs = Array.from(this.songs.values()).sort((a, b) => a.title.localeCompare(b.title));
    const songsWithTracks = await Promise.all(
      songs.map(async (song) => {
        const tracks = await this.getTracksBySongId(song.id);
        const midiEvents = await this.getMidiEventsBySongId(song.id);
        return {
          ...song,
          tracks: tracks.sort((a, b) => a.trackNumber - b.trackNumber),
          midiEvents: midiEvents.sort((a, b) => a.timestamp - b.timestamp)
        };
      })
    );
    return songsWithTracks;
  }

  async createSong(insertSong: InsertSong): Promise<Song> {
    const id = randomUUID();
    const song: Song = { 
      ...insertSong,
      key: insertSong.key || null,
      bpm: insertSong.bpm || null,
      lyrics: insertSong.lyrics || null,
      waveformData: null,
      waveformGenerated: null,
      id,
      createdAt: new Date().toISOString()
    };
    this.songs.set(id, song);
    this.triggerAutoSave();
    return song;
  }

  async updateSong(id: string, updateData: Partial<InsertSong>): Promise<Song | undefined> {
    const existing = this.songs.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...updateData };
    this.songs.set(id, updated);
    this.triggerAutoSave();
    return updated;
  }

  async deleteSong(id: string): Promise<boolean> {
    // Delete associated tracks and MIDI events
    const tracks = await this.getTracksBySongId(id);
    const midiEvents = await this.getMidiEventsBySongId(id);
    
    tracks.forEach(track => this.tracks.delete(track.id));
    midiEvents.forEach(event => this.midiEvents.delete(event.id));
    
    const result = this.songs.delete(id);
    this.triggerAutoSave();
    return result;
  }

  async getSongWithTracks(id: string): Promise<SongWithTracks | undefined> {
    const song = this.songs.get(id);
    if (!song) return undefined;

    const tracks = await this.getTracksBySongId(id);
    const midiEvents = await this.getMidiEventsBySongId(id);

    return {
      ...song,
      tracks: tracks.sort((a, b) => a.trackNumber - b.trackNumber),
      midiEvents: midiEvents.sort((a, b) => a.timestamp - b.timestamp)
    };
  }

  // Tracks
  async getTrack(id: string): Promise<Track | undefined> {
    return this.tracks.get(id);
  }

  async getTracksBySongId(songId: string): Promise<Track[]> {
    return Array.from(this.tracks.values())
      .filter(track => track.songId === songId)
      .sort((a, b) => a.trackNumber - b.trackNumber);
  }

  async createTrack(insertTrack: InsertTrack): Promise<Track> {
    const id = randomUUID();
    const track: Track = { 
      ...insertTrack,
      volume: insertTrack.volume ?? 100,
      balance: insertTrack.balance ?? 0,
      isMuted: insertTrack.isMuted ?? false,
      isSolo: insertTrack.isSolo ?? false,
      localFileName: insertTrack.localFileName ?? null,
      id 
    };
    this.tracks.set(id, track);
    this.triggerAutoSave();
    return track;
  }

  async updateTrack(id: string, updateData: Partial<InsertTrack>): Promise<Track | undefined> {
    const existing = this.tracks.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...updateData };
    this.tracks.set(id, updated);
    this.triggerAutoSave();
    return updated;
  }

  async deleteTrack(id: string): Promise<boolean> {
    const result = this.tracks.delete(id);
    this.triggerAutoSave();
    return result;
  }

  // MIDI Events
  async getMidiEvent(id: string): Promise<MidiEvent | undefined> {
    return this.midiEvents.get(id);
  }

  async getMidiEventsBySongId(songId: string): Promise<MidiEvent[]> {
    return Array.from(this.midiEvents.values())
      .filter(event => event.songId === songId)
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  async createMidiEvent(insertMidiEvent: InsertMidiEvent): Promise<MidiEvent> {
    const id = randomUUID();
    const midiEvent: MidiEvent = { 
      ...insertMidiEvent,
      channel: insertMidiEvent.channel || 1,
      data1: insertMidiEvent.data1 || null,
      data2: insertMidiEvent.data2 || null,
      description: insertMidiEvent.description || null,
      id 
    };
    this.midiEvents.set(id, midiEvent);
    this.triggerAutoSave();
    return midiEvent;
  }

  async updateMidiEvent(id: string, updateData: Partial<InsertMidiEvent>): Promise<MidiEvent | undefined> {
    const existing = this.midiEvents.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...updateData };
    this.midiEvents.set(id, updated);
    this.triggerAutoSave();
    return updated;
  }

  async deleteMidiEvent(id: string): Promise<boolean> {
    const result = this.midiEvents.delete(id);
    this.triggerAutoSave();
    return result;
  }

  // Waveform caching
  async saveWaveform(songId: string, waveformData: number[]): Promise<void> {
    this.waveforms.set(songId, waveformData);
    
    // Also update the song to mark waveform as generated
    const song = this.songs.get(songId);
    if (song) {
      const updatedSong: Song = { 
        ...song, 
        waveformGenerated: true, 
        waveformData: JSON.stringify(waveformData) 
      };
      this.songs.set(songId, updatedSong);
    }
    this.triggerAutoSave();
  }

  async getWaveform(songId: string): Promise<number[] | null> {
    // First check in-memory cache
    const cached = this.waveforms.get(songId);
    if (cached) return cached;
    
    // Check if stored in song data
    const song = this.songs.get(songId);
    if (song && song.waveformData) {
      try {
        const waveformData = JSON.parse(song.waveformData);
        if (Array.isArray(waveformData)) {
          this.waveforms.set(songId, waveformData); // Cache for next time
          return waveformData;
        }
      } catch (error) {
        console.error('Failed to parse stored waveform data:', error);
      }
    }
    
    return null;
  }
}

export const storage = new MemStorage();
