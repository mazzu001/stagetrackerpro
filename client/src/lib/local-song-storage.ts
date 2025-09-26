import type { SongWithTracks, MuteRegion } from '@shared/schema';

const STORAGE_KEY = 'lpp_songs';

export interface LocalSong extends Omit<SongWithTracks, 'userId'> {
  // Local songs don't need userId since they're already user-specific via localStorage
}

export class LocalSongStorage {
  private static getSongKey(userEmail: string): string {
    return `${STORAGE_KEY}_${userEmail}`;
  }

  static async getAllSongs(userEmail: string): Promise<LocalSong[]> {
    try {
      // Import dynamically to avoid circular dependency
      const { LocalSongStorageDB } = await import('./local-song-storage-db');
      const songs = await LocalSongStorageDB.getAllSongs(userEmail);
      console.log(`📋 Loaded ${songs.length} songs from IndexedDB (alphabetically sorted)`);
      return songs;
    } catch (error) {
      console.error('Error loading songs from IndexedDB:', error);
      return [];
    }
  }

  static async getSong(userEmail: string, songId: string): Promise<LocalSong | undefined> {
    try {
      // Import dynamically to avoid circular dependency
      const { LocalSongStorageDB } = await import('./local-song-storage-db');
      return await LocalSongStorageDB.getSong(userEmail, songId);
    } catch (error) {
      console.error('Error loading song from IndexedDB:', error);
      return undefined;
    }
  }

  static saveSongs(userEmail: string, songs: LocalSong[]): void {
    try {
      localStorage.setItem(this.getSongKey(userEmail), JSON.stringify(songs));
    } catch (error) {
      console.error('Error saving songs to localStorage:', error);
      throw error;
    }
  }

  static async addSong(userEmail: string, song: Omit<LocalSong, 'id' | 'tracks' | 'waveformGenerated' | 'createdAt'>): Promise<LocalSong> {
    // Import dynamically to avoid circular dependency
    const { LocalSongStorageDB } = await import('./local-song-storage-db');
    const newSong = await LocalSongStorageDB.addSong(userEmail, song);
    console.log('✅ Song added:', song.title);
    return newSong;
  }

  static async updateSong(userEmail: string, songId: string, updates: Partial<LocalSong>): Promise<LocalSong | null> {
    try {
      // Import dynamically to avoid circular dependency
      const { LocalSongStorageDB } = await import('./local-song-storage-db');
      const updatedSong = await LocalSongStorageDB.updateSong(userEmail, songId, updates);
      if (updatedSong) {
        console.log('LocalSongStorage.updateSong: Song updated successfully:', songId);
      }
      return updatedSong;
    } catch (error) {
      console.error('LocalSongStorage.updateSong: Error updating song:', error);
      return null;
    }
  }

  static async deleteSong(userEmail: string, songId: string): Promise<boolean> {
    try {
      // Import dynamically to avoid circular dependency
      const { LocalSongStorageDB } = await import('./local-song-storage-db');
      const success = await LocalSongStorageDB.deleteSong(userEmail, songId);
      if (success) {
        console.log(`✅ Song deleted: ${songId}`);
      }
      return success;
    } catch (error) {
      console.error('Error deleting song from IndexedDB:', error);
      return false;
    }
  }

  static async addTrack(userEmail: string, songId: string, track: any): Promise<any> {
    try {
      // Import dynamically to avoid circular dependency
      const { LocalSongStorageDB } = await import('./local-song-storage-db');
      const updatedSong = await LocalSongStorageDB.addTrackToSong(userEmail, songId, track);
      
      if (updatedSong && updatedSong.tracks.length > 0) {
        const newTrack = updatedSong.tracks[updatedSong.tracks.length - 1];
        console.log('LocalSongStorage.addTrack: Track added successfully:', newTrack.id);
        return newTrack;
      }
      
      return false;
    } catch (error) {
      console.error('LocalSongStorage.addTrack: Error adding track:', error);
      return false;
    }
  }

  static async getTracks(userEmail: string, songId: string): Promise<any[]> {
    const song = await this.getSong(userEmail, songId);
    return song?.tracks || [];
  }

  static async deleteTrack(userEmail: string, songId: string, trackId: string): Promise<boolean> {
    try {
      // Import dynamically to avoid circular dependency
      const { LocalSongStorageDB } = await import('./local-song-storage-db');
      const success = await LocalSongStorageDB.deleteTrack(userEmail, songId, trackId);
      if (success) {
        console.log('LocalSongStorage.deleteTrack: Track deleted successfully:', trackId);
      }
      return success;
    } catch (error) {
      console.error('LocalSongStorage.deleteTrack: Error deleting track:', error);
      return false;
    }
  }

  static async updateTrack(userEmail: string, songId: string, trackId: string, updates: Partial<any>): Promise<any | null> {
    try {
      // Import dynamically to avoid circular dependency
      const { LocalSongStorageDB } = await import('./local-song-storage-db');
      return await LocalSongStorageDB.updateTrack(userEmail, songId, trackId, updates);
    } catch (error) {
      console.error('LocalSongStorage.updateTrack: Error updating track:', error);
      return null;
    }
  }

  static async addTrackToSong(userEmail: string, songId: string, track: any): Promise<LocalSong | null> {
    try {
      // Import dynamically to avoid circular dependency
      const { LocalSongStorageDB } = await import('./local-song-storage-db');
      return await LocalSongStorageDB.addTrackToSong(userEmail, songId, track);
    } catch (error) {
      console.error('Error adding track to song:', error);
      return null;
    }
  }

  static async removeTrackFromSong(userEmail: string, songId: string, trackId: string): Promise<LocalSong | null> {
    try {
      // Import dynamically to avoid circular dependency  
      const { LocalSongStorageDB } = await import('./local-song-storage-db');
      const success = await LocalSongStorageDB.deleteTrack(userEmail, songId, trackId);
      if (success) {
        return await LocalSongStorageDB.getSong(userEmail, songId);
      }
      return null;
    } catch (error) {
      console.error('Error removing track from song:', error);
      return null;
    }
  }

  // Mute Region Management - Delegates to IndexedDB
  static async addMuteRegion(userEmail: string, songId: string, trackId: string, region: Omit<MuteRegion, 'id'>): Promise<MuteRegion | null> {
    console.log(`➕ LocalSongStorage.addMuteRegion: Adding region to track ${trackId}`, region);
    try {
      // Import dynamically to avoid circular dependency
      const { LocalSongStorageDB } = await import('./local-song-storage-db');
      const newRegion = await LocalSongStorageDB.addMuteRegion(userEmail, songId, trackId, region);
      return newRegion;
    } catch (error) {
      console.error('Failed to add mute region:', error);
      return null;
    }
  }

  static async updateMuteRegion(userEmail: string, songId: string, trackId: string, regionId: string, updates: Partial<MuteRegion>): Promise<MuteRegion | null> {
    console.log(`🔄 LocalSongStorage.updateMuteRegion: Updating region ${regionId} on track ${trackId}`);
    try {
      // Import dynamically to avoid circular dependency
      const { LocalSongStorageDB } = await import('./local-song-storage-db');
      const updatedRegion = await LocalSongStorageDB.updateMuteRegion(userEmail, songId, trackId, regionId, updates);
      return updatedRegion;
    } catch (error) {
      console.error('Failed to update mute region:', error);
      return null;
    }
  }

  static async deleteMuteRegion(userEmail: string, songId: string, trackId: string, regionId: string): Promise<boolean> {
    console.log(`🗑️ LocalSongStorage.deleteMuteRegion: Deleting region ${regionId} from track ${trackId}`);
    try {
      // Import dynamically to avoid circular dependency
      const { LocalSongStorageDB } = await import('./local-song-storage-db');
      const success = await LocalSongStorageDB.deleteMuteRegion(userEmail, songId, trackId, regionId);
      return success;
    } catch (error) {
      console.error('Failed to delete mute region:', error);
      return false;
    }
  }

  static async getMuteRegions(userEmail: string, songId: string, trackId: string): Promise<MuteRegion[]> {
    console.log(`🔍 LocalSongStorage.getMuteRegions: Getting regions for track ${trackId}`);
    try {
      // Import dynamically to avoid circular dependency
      const { LocalSongStorageDB } = await import('./local-song-storage-db');
      const regions = await LocalSongStorageDB.getMuteRegions(userEmail, songId, trackId);
      console.log(`✅ LocalSongStorage.getMuteRegions: Found ${regions.length} regions for track ${trackId}`);
      return regions;
    } catch (error) {
      console.error('Failed to get mute regions:', error);
      return [];
    }
  }

  static async clearAllMuteRegions(userEmail: string, songId: string, trackId: string): Promise<boolean> {
    console.log(`🧹 LocalSongStorage.clearAllMuteRegions: Clearing all regions for track ${trackId}`);
    try {
      // Import dynamically to avoid circular dependency
      const { LocalSongStorageDB } = await import('./local-song-storage-db');
      const db = await LocalSongStorageDB.getDB(userEmail);
      const success = await db.deleteAllMuteRegions(trackId);
      console.log(`✅ LocalSongStorage.clearAllMuteRegions: All regions cleared for track ${trackId}`);
      return success;
    } catch (error) {
      console.error('Failed to clear all mute regions:', error);
      return false;
    }
  }
}