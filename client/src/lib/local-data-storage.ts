// Complete local data management - replaces all database operations
// Uses the local file system exclusively

import { LocalFileSystem } from "./local-file-system";
import type { Song, Track } from "@shared/schema";

export interface LocalSong {
  id: string;
  title: string;
  artist: string;
  duration: number;
  bpm?: number;
  key?: string;
  lyrics?: string;
  createdAt: number;
  lastModified: number;
  tracks: LocalTrack[];
}

export interface LocalTrack {
  id: string;
  songId: string;
  name: string;
  trackNumber: number;
  audioUrl?: string; // Will be blob URL from local file
  volume: number;
  balance: number;
  isMuted: boolean;
  isSolo: boolean;
  hasAudioData: boolean;
}


export class LocalDataStorage {
  private static instance: LocalDataStorage;
  private localFS: LocalFileSystem;
  private isInitialized = false;

  static getInstance(): LocalDataStorage {
    if (!LocalDataStorage.instance) {
      LocalDataStorage.instance = new LocalDataStorage();
    }
    return LocalDataStorage.instance;
  }

  constructor() {
    this.localFS = LocalFileSystem.getInstance();
  }

  async initialize(): Promise<boolean> {
    try {
      const success = await this.localFS.initialize();
      this.isInitialized = success;
      return success;
    } catch (error) {
      console.error('Failed to initialize local data storage:', error);
      return false;
    }
  }

  isReady(): boolean {
    return this.isInitialized && this.localFS.isReady();
  }

  // Song operations
  async getAllSongs(): Promise<LocalSong[]> {
    const songs = this.localFS.getAllSongs();
    return songs.map(song => ({
      ...song,
      tracks: [],

    }));
  }

  async getSong(id: string): Promise<LocalSong | null> {
    const song = this.localFS.getSong(id);
    if (!song) return null;

    return {
      ...song,
      tracks: [],

    };
  }

  async createSong(songData: Partial<LocalSong>): Promise<LocalSong> {
    const now = Date.now();
    const song: LocalSong = {
      id: songData.id || crypto.randomUUID(),
      title: songData.title || 'Untitled Song',
      artist: songData.artist || '',
      duration: songData.duration || 0,
      bpm: songData.bpm,
      key: songData.key,
      lyrics: songData.lyrics,
      createdAt: songData.createdAt || now,
      lastModified: now,
      tracks: [],

    };

    await this.localFS.saveSong(song.id, song);
    console.log('Song created locally:', song.title);
    return song;
  }

  async updateSong(id: string, updates: Partial<LocalSong>): Promise<LocalSong | null> {
    const existing = this.localFS.getSong(id);
    if (!existing) return null;

    const updated = {
      ...existing,
      ...updates,
      lastModified: Date.now()
    };

    await this.localFS.saveSong(id, updated);
    console.log('Song updated locally:', updated.title);
    return updated;
  }

  async deleteSong(id: string): Promise<boolean> {
    const success = await this.localFS.deleteSong(id);
    if (success) {
      console.log('Song deleted locally:', id);
    }
    return success;
  }

  // Track operations (stored in song data and audio files separately)
  async getTracksBySongId(songId: string): Promise<LocalTrack[]> {
    const song = this.localFS.getSong(songId);
    if (!song || !song.tracks) return [];

    return song.tracks.map((track: LocalTrack) => ({
      ...track,
      hasAudioData: !!this.localFS.getTrackFileInfo(track.id)
    }));
  }

  async createTrack(songId: string, trackData: Partial<LocalTrack>): Promise<LocalTrack> {
    const song = this.localFS.getSong(songId);
    if (!song) throw new Error('Song not found');

    const track: LocalTrack = {
      id: trackData.id || crypto.randomUUID(),
      songId: songId,
      name: trackData.name || 'Untitled Track',
      trackNumber: trackData.trackNumber || 1,
      volume: trackData.volume || 100,
      balance: trackData.balance || 0,
      isMuted: trackData.isMuted || false,
      isSolo: trackData.isSolo || false,
      hasAudioData: false
    };

    // Add track to song
    if (!song.tracks) song.tracks = [];
    song.tracks.push(track);

    await this.localFS.saveSong(songId, song);
    console.log('Track created locally:', track.name);
    return track;
  }

  async updateTrack(trackId: string, updates: Partial<LocalTrack>): Promise<LocalTrack | null> {
    // Find the song containing this track
    const songs = this.localFS.getAllSongs();
    for (const song of songs) {
      if (!song.tracks) continue;
      
      const trackIndex = song.tracks.findIndex((t: LocalTrack) => t.id === trackId);
      if (trackIndex >= 0) {
        song.tracks[trackIndex] = {
          ...song.tracks[trackIndex],
          ...updates
        };
        
        await this.localFS.saveSong(song.id, song);
        console.log('Track updated locally:', song.tracks[trackIndex].name);
        return song.tracks[trackIndex];
      }
    }
    
    return null;
  }

  async deleteTrack(trackId: string): Promise<boolean> {
    // Find and remove track from song
    const songs = this.localFS.getAllSongs();
    for (const song of songs) {
      if (!song.tracks) continue;
      
      const trackIndex = song.tracks.findIndex((t: LocalTrack) => t.id === trackId);
      if (trackIndex >= 0) {
        song.tracks.splice(trackIndex, 1);
        await this.localFS.saveSong(song.id, song);
        console.log('Track deleted locally:', trackId);
        return true;
      }
    }
    
    return false;
  }


  // Waveform operations
  async saveWaveform(songId: string, waveformData: number[]): Promise<void> {
    await this.localFS.saveWaveform(songId, waveformData);
  }

  async getWaveform(songId: string): Promise<number[] | null> {
    return await this.localFS.getWaveform(songId);
  }

  // Status information
  getStatus(): string {
    return this.localFS.getStatus();
  }
}