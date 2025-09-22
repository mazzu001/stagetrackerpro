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

  static updateSong(userEmail: string, songId: string, updates: Partial<LocalSong>): LocalSong | null {
    const songs = this.getAllSongs(userEmail);
    const songIndex = songs.findIndex(song => song.id === songId);
    
    if (songIndex === -1) return null;
    
    songs[songIndex] = { ...songs[songIndex], ...updates };
    this.saveSongs(userEmail, songs);
    return songs[songIndex];
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

  // Mute Region Management
  static addMuteRegion(userEmail: string, songId: string, trackId: string, region: Omit<MuteRegion, 'id'>): MuteRegion | null {
    console.log(`➕ LocalSongStorage.addMuteRegion: Adding region to track ${trackId}`, region);
    const songs = this.getAllSongs(userEmail);
    const songIndex = songs.findIndex(song => song.id === songId);
    
    if (songIndex === -1) {
      console.error(`LocalSongStorage.addMuteRegion: Song ${songId} not found`);
      return null;
    }
    
    const trackIndex = songs[songIndex].tracks.findIndex(track => track.id === trackId);
    if (trackIndex === -1) {
      console.error(`LocalSongStorage.addMuteRegion: Track ${trackId} not found`);
      return null;
    }

    const newRegion: MuteRegion = {
      id: crypto.randomUUID(),
      ...region
    };

    const track = songs[songIndex].tracks[trackIndex];
    // Ensure muteRegions is an array
    if (!Array.isArray(track.muteRegions)) {
      track.muteRegions = [];
    }
    
    track.muteRegions.push(newRegion);
    this.saveSongs(userEmail, songs);
    console.log(`✅ LocalSongStorage.addMuteRegion: Region ${newRegion.id} added and saved to track ${trackId}`);
    return newRegion;
  }

  static updateMuteRegion(userEmail: string, songId: string, trackId: string, regionId: string, updates: Partial<MuteRegion>): MuteRegion | null {
    console.log(`🔄 LocalSongStorage.updateMuteRegion: Updating region ${regionId} on track ${trackId}`);
    const songs = this.getAllSongs(userEmail);
    const songIndex = songs.findIndex(song => song.id === songId);
    
    if (songIndex === -1) {
      console.error(`LocalSongStorage.updateMuteRegion: Song ${songId} not found`);
      return null;
    }
    
    const trackIndex = songs[songIndex].tracks.findIndex(track => track.id === trackId);
    if (trackIndex === -1) {
      console.error(`LocalSongStorage.updateMuteRegion: Track ${trackId} not found`);
      return null;
    }

    const track = songs[songIndex].tracks[trackIndex];
    if (!Array.isArray(track.muteRegions)) {
      console.error(`LocalSongStorage.updateMuteRegion: Track has no mute regions`);
      return null;
    }

    const regionIndex = track.muteRegions.findIndex(region => region.id === regionId);
    if (regionIndex === -1) {
      console.error(`LocalSongStorage.updateMuteRegion: Region ${regionId} not found`);
      return null;
    }

    track.muteRegions[regionIndex] = { ...track.muteRegions[regionIndex], ...updates, id: regionId };
    this.saveSongs(userEmail, songs);
    console.log(`✅ LocalSongStorage.updateMuteRegion: Region ${regionId} updated and saved`);
    return track.muteRegions[regionIndex];
  }

  static deleteMuteRegion(userEmail: string, songId: string, trackId: string, regionId: string): boolean {
    console.log(`🗑️ LocalSongStorage.deleteMuteRegion: Deleting region ${regionId} from track ${trackId}`);
    const songs = this.getAllSongs(userEmail);
    const songIndex = songs.findIndex(song => song.id === songId);
    
    if (songIndex === -1) {
      console.error(`LocalSongStorage.deleteMuteRegion: Song ${songId} not found`);
      return false;
    }
    
    const trackIndex = songs[songIndex].tracks.findIndex(track => track.id === trackId);
    if (trackIndex === -1) {
      console.error(`LocalSongStorage.deleteMuteRegion: Track ${trackId} not found`);
      return false;
    }

    const track = songs[songIndex].tracks[trackIndex];
    if (!Array.isArray(track.muteRegions)) {
      console.warn(`LocalSongStorage.deleteMuteRegion: Track has no mute regions`);
      return false;
    }

    const originalLength = track.muteRegions.length;
    track.muteRegions = track.muteRegions.filter(region => region.id !== regionId);
    
    if (track.muteRegions.length === originalLength) {
      console.warn(`LocalSongStorage.deleteMuteRegion: Region ${regionId} not found`);
      return false;
    }

    this.saveSongs(userEmail, songs);
    console.log(`✅ LocalSongStorage.deleteMuteRegion: Region ${regionId} deleted and saved`);
    return true;
  }

  static getMuteRegions(userEmail: string, songId: string, trackId: string): MuteRegion[] {
    console.log(`🔍 LocalSongStorage.getMuteRegions: Getting regions for track ${trackId}`);
    const songs = this.getAllSongs(userEmail);
    const song = songs.find(song => song.id === songId);
    if (!song) {
      console.warn(`LocalSongStorage.getMuteRegions: Song ${songId} not found`);
      return [];
    }

    const track = song.tracks.find(track => track.id === trackId);
    if (!track) {
      console.warn(`LocalSongStorage.getMuteRegions: Track ${trackId} not found`);
      return [];
    }
    
    // Ensure muteRegions is always an array
    const regions = Array.isArray(track.muteRegions) ? track.muteRegions : [];
    console.log(`✅ LocalSongStorage.getMuteRegions: Found ${regions.length} regions for track ${trackId}`);
    return regions;
  }

  static clearAllMuteRegions(userEmail: string, songId: string, trackId: string): boolean {
    console.log(`🧹 LocalSongStorage.clearAllMuteRegions: Clearing all regions for track ${trackId}`);
    const songs = this.getAllSongs(userEmail);
    const songIndex = songs.findIndex(s => s.id === songId);
    
    if (songIndex === -1) {
      console.error(`LocalSongStorage.clearAllMuteRegions: Song ${songId} not found`);
      return false;
    }
    
    const trackIndex = songs[songIndex].tracks.findIndex(t => t.id === trackId);
    if (trackIndex === -1) {
      console.error(`LocalSongStorage.clearAllMuteRegions: Track ${trackId} not found`);
      return false;
    }
    
    // Clear all mute regions
    songs[songIndex].tracks[trackIndex].muteRegions = [];
    
    // Save to localStorage
    this.saveSongs(userEmail, songs);
    console.log(`✅ LocalSongStorage.clearAllMuteRegions: All regions cleared and saved for track ${trackId}`);
    
    return true;
  }
}