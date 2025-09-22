// Adapter for LocalSongStorage that uses IndexedDB instead of localStorage
// Maintains the same API to avoid breaking existing code

import { IndexedDBStorage } from './indexed-db-storage';

export interface LocalSong {
  id: string;
  userId: string;
  title: string;
  artist: string;
  duration?: number;
  bpm?: number;
  key?: string;
  lyrics?: string;
  tracks: any[];
  waveformData?: string;
  waveformGenerated: boolean;
  createdAt: string;
}

export class LocalSongStorageDB {
  private static dbInstances: Map<string, IndexedDBStorage> = new Map();
  private static initialized: Map<string, boolean> = new Map();
  
  private static async getDB(userEmail: string): Promise<IndexedDBStorage> {
    if (!this.dbInstances.has(userEmail)) {
      const db = IndexedDBStorage.getInstance(userEmail);
      this.dbInstances.set(userEmail, db);
      
      // Initialize if not already done
      if (!this.initialized.get(userEmail)) {
        await db.initialize();
        
        // One-time migration from localStorage
        // Check for the actual key used by LocalSongStorage
        const localStorageKey = `lpp_songs_${userEmail}`;
        if (localStorage.getItem(localStorageKey)) {
          console.log(`🔄 Migrating songs from localStorage key: ${localStorageKey}`);
          await db.importFromLocalStorage(userEmail);
          // Clear localStorage after successful migration
          localStorage.removeItem(localStorageKey);
          console.log('✅ Migrated and cleared localStorage data');
        } else {
          console.log(`📭 No localStorage data found for key: ${localStorageKey}`);
        }
        
        this.initialized.set(userEmail, true);
      }
    }
    
    return this.dbInstances.get(userEmail)!;
  }
  
  static async getAllSongs(userEmail: string): Promise<LocalSong[]> {
    try {
      const db = await this.getDB(userEmail);
      const songsWithTracks = await db.getAllSongsWithTracks();
      return songsWithTracks;
    } catch (error) {
      console.error('Error loading songs from IndexedDB:', error);
      return [];
    }
  }
  
  static async getSong(userEmail: string, songId: string): Promise<LocalSong | undefined> {
    try {
      const db = await this.getDB(userEmail);
      const songWithTracks = await db.getSongWithTracks(songId);
      return songWithTracks;
    } catch (error) {
      console.error('Error loading song from IndexedDB:', error);
      return undefined;
    }
  }
  
  static async addSong(userEmail: string, song: Omit<LocalSong, 'id' | 'tracks' | 'waveformGenerated' | 'createdAt'>): Promise<LocalSong> {
    const db = await this.getDB(userEmail);
    const newSong = await db.addSong({
      ...song,
      userId: song.userId || userEmail
    });
    
    return {
      ...newSong,
      tracks: []
    };
  }
  
  static async updateSong(userEmail: string, songId: string, updates: Partial<LocalSong>): Promise<LocalSong | null> {
    const db = await this.getDB(userEmail);
    
    // If updating tracks, we need to handle them separately
    const { tracks, ...songUpdates } = updates;
    
    // Update song metadata
    if (Object.keys(songUpdates).length > 0) {
      await db.updateSong(songId, songUpdates);
    }
    
    // Return the updated song with tracks
    const updatedSong = await db.getSongWithTracks(songId);
    return updatedSong;
  }
  
  static async deleteSong(userEmail: string, songId: string): Promise<boolean> {
    const db = await this.getDB(userEmail);
    return db.deleteSong(songId);
  }
  
  static async addTrackToSong(userEmail: string, songId: string, track: any): Promise<LocalSong | null> {
    const db = await this.getDB(userEmail);
    
    const newTrack = await db.addTrack(songId, {
      name: track.name,
      volume: track.volume ?? 50,
      balance: track.balance ?? 0,
      isMuted: track.isMuted ?? false,
      isSolo: track.isSolo ?? false,
      localFileName: track.localFileName
    });
    
    // Return updated song with all tracks
    const updatedSong = await db.getSongWithTracks(songId);
    return updatedSong;
  }
  
  static async updateTrack(userEmail: string, songId: string, trackId: string, updates: Partial<any>): Promise<any | null> {
    const db = await this.getDB(userEmail);
    
    // Handle mute regions separately if they're in the updates
    const { muteRegions, ...trackUpdates } = updates;
    
    // Update track metadata
    const updatedTrack = await db.updateTrack(trackId, trackUpdates);
    
    // If muteRegions were provided, update them
    if (muteRegions !== undefined && updatedTrack) {
      // Clear existing regions and add new ones
      await db.deleteAllMuteRegions(trackId);
      
      if (Array.isArray(muteRegions)) {
        for (const region of muteRegions) {
          await db.addMuteRegion(trackId, {
            start: region.start,
            end: region.end
          });
        }
      }
    }
    
    return updatedTrack;
  }
  
  static async deleteTrack(userEmail: string, songId: string, trackId: string): Promise<boolean> {
    const db = await this.getDB(userEmail);
    return db.deleteTrack(trackId);
  }
  
  // Mute region operations
  static async getMuteRegions(userEmail: string, songId: string, trackId: string): Promise<any[]> {
    const db = await this.getDB(userEmail);
    const regions = await db.getMuteRegions(trackId);
    
    // Convert to the format expected by existing code
    return regions.map(r => ({
      id: r.id,
      start: r.start,
      end: r.end
    }));
  }
  
  static async addMuteRegion(userEmail: string, songId: string, trackId: string, region: any): Promise<any> {
    const db = await this.getDB(userEmail);
    const newRegion = await db.addMuteRegion(trackId, {
      start: region.start,
      end: region.end
    });
    
    console.log(`➕ Mute region added to IndexedDB: ${newRegion.start}s-${newRegion.end}s for track ${trackId}`);
    return {
      id: newRegion.id,
      start: newRegion.start,
      end: newRegion.end
    };
  }
  
  static async updateMuteRegion(userEmail: string, songId: string, trackId: string, regionId: string, updates: any): Promise<any | null> {
    const db = await this.getDB(userEmail);
    const updatedRegion = await db.updateMuteRegion(regionId, updates);
    
    if (!updatedRegion) return null;
    
    console.log(`🔄 Mute region updated in IndexedDB: ${regionId}`);
    return {
      id: updatedRegion.id,
      start: updatedRegion.start,
      end: updatedRegion.end
    };
  }
  
  static async deleteMuteRegion(userEmail: string, songId: string, trackId: string, regionId: string): Promise<boolean> {
    const db = await this.getDB(userEmail);
    const success = await db.deleteMuteRegion(regionId);
    
    if (success) {
      console.log(`🗑️ Mute region deleted from IndexedDB: ${regionId}`);
    }
    
    return success;
  }
  
  static async clearAllMuteRegions(userEmail: string, songId: string, trackId: string): Promise<void> {
    const db = await this.getDB(userEmail);
    await db.deleteAllMuteRegions(trackId);
    console.log(`✅ All mute regions cleared for track ${trackId}`);
  }
  
  // Waveform operations
  static async updateSongWaveform(userEmail: string, songId: string, waveformData: string): Promise<boolean> {
    const db = await this.getDB(userEmail);
    const result = await db.updateSong(songId, {
      waveformData,
      waveformGenerated: true
    });
    
    return result !== null;
  }
  
  // Clear all data for user
  static async clearAllSongs(userEmail: string): Promise<void> {
    const songs = await this.getAllSongs(userEmail);
    const db = await this.getDB(userEmail);
    
    for (const song of songs) {
      await db.deleteSong(song.id);
    }
    
    console.log(`✅ Cleared all songs for ${userEmail}`);
  }
}