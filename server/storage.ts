import { songs, tracks, midiEvents, users, type Song, type InsertSong, type Track, type InsertTrack, type MidiEvent, type InsertMidiEvent, type SongWithTracks, type User, type UpsertUser } from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";

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

  // Legacy methods for compatibility (no-op in database mode)
  getAllData(): any;
  loadData(songs: Song[], tracks: Track[], midiEvents: MidiEvent[], waveforms?: Record<string, number[]>, users?: User[]): void;
  setAutoSaveCallback(callback: () => void): void;
}

export class DatabaseStorage implements IStorage {
  constructor() {
    console.log('DatabaseStorage initialized - using local SQLite database');
  }

  // Legacy methods for compatibility (no-op since data is in cloud database)
  getAllData() {
    console.log('getAllData: Data is now stored in local SQLite database');
    return {
      users: [],
      songs: [],
      tracks: [],
      midiEvents: [],
      waveforms: {}
    };
  }

  loadData(songData: Song[], trackData: Track[], midiEventData: MidiEvent[], waveforms?: Record<string, number[]>, userData?: User[]) {
    console.log('loadData: Data is now stored in local SQLite database, ignoring localStorage');
  }

  setAutoSaveCallback(callback: () => void) {
    console.log('setAutoSaveCallback: Data auto-saves to local SQLite database');
  }

  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        ...userData,
        updatedAt: new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date().toISOString(),
        },
      })
      .returning();
    
    console.log('User upserted in database:', user.id, user.email);
    return user;
  }

  async updateUserStripeInfo(id: string, stripeCustomerId: string, stripeSubscriptionId: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({
        stripeCustomerId,
        stripeSubscriptionId,
        subscriptionStatus: 'active',
        updatedAt: new Date().toISOString(),
      })
      .where(eq(users.id, id))
      .returning();

    if (user) {
      console.log('Updated user Stripe info in database:', id, stripeCustomerId);
    } else {
      console.error('User not found for Stripe update:', id);
    }
    return user || undefined;
  }

  // Song operations
  async getSong(id: string): Promise<Song | undefined> {
    const [song] = await db.select().from(songs).where(eq(songs.id, id));
    return song || undefined;
  }

  async getAllSongs(): Promise<SongWithTracks[]> {
    // Use a more efficient query by fetching everything in parallel
    const [allSongs, allTracks, allMidiEvents] = await Promise.all([
      db.select().from(songs),
      db.select().from(tracks),
      db.select().from(midiEvents)
    ]);
    
    // Group tracks and MIDI events by song ID
    const tracksBySong = new Map<string, typeof allTracks>();
    const midiEventsBySong = new Map<string, typeof allMidiEvents>();
    
    allTracks.forEach(track => {
      if (!tracksBySong.has(track.songId)) {
        tracksBySong.set(track.songId, []);
      }
      tracksBySong.get(track.songId)!.push(track);
    });
    
    allMidiEvents.forEach(event => {
      if (!midiEventsBySong.has(event.songId)) {
        midiEventsBySong.set(event.songId, []);
      }
      midiEventsBySong.get(event.songId)!.push(event);
    });
    
    // Combine all data
    const songsWithTracks: SongWithTracks[] = allSongs.map(song => ({
      ...song,
      tracks: tracksBySong.get(song.id) || [],
      midiEvents: midiEventsBySong.get(song.id) || [],
    }));
    
    return songsWithTracks;
  }

  async createSong(song: InsertSong): Promise<Song> {
    const [newSong] = await db.insert(songs).values(song).returning();
    console.log('Song created in database:', newSong.id, newSong.title);
    return newSong;
  }

  async updateSong(id: string, song: Partial<InsertSong>): Promise<Song | undefined> {
    const [updatedSong] = await db
      .update(songs)
      .set(song)
      .where(eq(songs.id, id))
      .returning();
    
    if (updatedSong) {
      console.log('Song updated in database:', id, updatedSong.title);
    }
    return updatedSong || undefined;
  }

  async deleteSong(id: string): Promise<boolean> {
    try {
      // First check if the song exists
      const existingSong = await db.select().from(songs).where(eq(songs.id, id));
      if (existingSong.length === 0) {
        console.log('Song not found for deletion:', id);
        return false;
      }

      console.log('Deleting song from database:', id, existingSong[0].title);

      // Delete associated tracks (including audio data) and MIDI events first
      const tracksResult = await db.delete(tracks).where(eq(tracks.songId, id));
      const midiResult = await db.delete(midiEvents).where(eq(midiEvents.songId, id));
      
      console.log(`Deleted ${tracksResult.changes || 0} tracks and ${midiResult.changes || 0} MIDI events for song: ${id}`);
      
      // Delete the song itself
      const result = await db.delete(songs).where(eq(songs.id, id));
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

  async getSongWithTracks(id: string): Promise<SongWithTracks | undefined> {
    const song = await this.getSong(id);
    if (!song) return undefined;

    const songTracks = await db.select().from(tracks).where(eq(tracks.songId, id));
    const songMidiEvents = await db.select().from(midiEvents).where(eq(midiEvents.songId, id));

    return {
      ...song,
      tracks: songTracks,
      midiEvents: songMidiEvents,
    };
  }

  // Track operations
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
    
    console.log('Audio file stored in database for track:', trackId, `(${Math.round(fileSize / 1024)}KB)`);
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
      console.log('Track deleted from database:', id);
    }
    return deleted;
  }

  // MIDI Event operations
  async getMidiEvent(id: string): Promise<MidiEvent | undefined> {
    const [event] = await db.select().from(midiEvents).where(eq(midiEvents.id, id));
    return event || undefined;
  }

  async getMidiEventsBySongId(songId: string): Promise<MidiEvent[]> {
    return await db.select().from(midiEvents).where(eq(midiEvents.songId, songId));
  }

  async createMidiEvent(midiEvent: InsertMidiEvent): Promise<MidiEvent> {
    const [newEvent] = await db.insert(midiEvents).values(midiEvent).returning();
    console.log('MIDI event created in database:', newEvent.id, newEvent.eventType);
    return newEvent;
  }

  async updateMidiEvent(id: string, midiEvent: Partial<InsertMidiEvent>): Promise<MidiEvent | undefined> {
    const [updatedEvent] = await db
      .update(midiEvents)
      .set(midiEvent)
      .where(eq(midiEvents.id, id))
      .returning();
    
    if (updatedEvent) {
      console.log('MIDI event updated in database:', id, updatedEvent.eventType);
    }
    return updatedEvent || undefined;
  }

  async deleteMidiEvent(id: string): Promise<boolean> {
    const result = await db.delete(midiEvents).where(eq(midiEvents.id, id));
    const deleted = result.changes ? result.changes > 0 : false;
    
    if (deleted) {
      console.log('MIDI event deleted from database:', id);
    }
    return deleted;
  }

  // Waveform operations (store in song's waveformData field)
  async saveWaveform(songId: string, waveformData: number[]): Promise<void> {
    await db
      .update(songs)
      .set({ 
        waveformData: JSON.stringify(waveformData),
        waveformGenerated: true 
      })
      .where(eq(songs.id, songId));
    
    console.log('Waveform saved to database for song:', songId);
  }

  async getWaveform(songId: string): Promise<number[] | null> {
    const [song] = await db.select({ waveformData: songs.waveformData }).from(songs).where(eq(songs.id, songId));
    
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