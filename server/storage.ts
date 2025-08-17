import { type Song, type InsertSong, type Track, type InsertTrack, type MidiEvent, type InsertMidiEvent, type SongWithTracks } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Songs
  getSong(id: string): Promise<Song | undefined>;
  getAllSongs(): Promise<Song[]>;
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
}

export class MemStorage implements IStorage {
  private songs: Map<string, Song>;
  private tracks: Map<string, Track>;
  private midiEvents: Map<string, MidiEvent>;

  constructor() {
    this.songs = new Map();
    this.tracks = new Map();
    this.midiEvents = new Map();
  }

  // Songs
  async getSong(id: string): Promise<Song | undefined> {
    return this.songs.get(id);
  }

  async getAllSongs(): Promise<Song[]> {
    return Array.from(this.songs.values()).sort((a, b) => a.title.localeCompare(b.title));
  }

  async createSong(insertSong: InsertSong): Promise<Song> {
    const id = randomUUID();
    const song: Song = { 
      ...insertSong,
      key: insertSong.key || null,
      bpm: insertSong.bpm || null,
      lyrics: insertSong.lyrics || null,
      id,
      createdAt: new Date().toISOString()
    };
    this.songs.set(id, song);
    return song;
  }

  async updateSong(id: string, updateData: Partial<InsertSong>): Promise<Song | undefined> {
    const existing = this.songs.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...updateData };
    this.songs.set(id, updated);
    return updated;
  }

  async deleteSong(id: string): Promise<boolean> {
    // Delete associated tracks and MIDI events
    const tracks = await this.getTracksBySongId(id);
    const midiEvents = await this.getMidiEventsBySongId(id);
    
    tracks.forEach(track => this.tracks.delete(track.id));
    midiEvents.forEach(event => this.midiEvents.delete(event.id));
    
    return this.songs.delete(id);
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
      volume: insertTrack.volume || 100,
      isMuted: insertTrack.isMuted || false,
      isSolo: insertTrack.isSolo || false,
      id 
    };
    this.tracks.set(id, track);
    return track;
  }

  async updateTrack(id: string, updateData: Partial<InsertTrack>): Promise<Track | undefined> {
    const existing = this.tracks.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...updateData };
    this.tracks.set(id, updated);
    return updated;
  }

  async deleteTrack(id: string): Promise<boolean> {
    return this.tracks.delete(id);
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
    return midiEvent;
  }

  async updateMidiEvent(id: string, updateData: Partial<InsertMidiEvent>): Promise<MidiEvent | undefined> {
    const existing = this.midiEvents.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...updateData };
    this.midiEvents.set(id, updated);
    return updated;
  }

  async deleteMidiEvent(id: string): Promise<boolean> {
    return this.midiEvents.delete(id);
  }
}

export const storage = new MemStorage();
