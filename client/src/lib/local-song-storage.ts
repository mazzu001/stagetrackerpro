import type { SongWithTracks, MuteRegion } from '@shared/schema';

const STORAGE_KEY = 'lpp_songs';

export interface LocalSong extends Omit<SongWithTracks, 'userId'> {
  // Local songs don't need userId since they're already user-specific via localStorage
}

export class LocalSongStorage {
  private static getSongKey(userEmail: string): string {
    return `${STORAGE_KEY}_${userEmail}`;
  }

  static getAllSongs(userEmail: string): LocalSong[] {
    try {
      const stored = localStorage.getItem(this.getSongKey(userEmail));
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error loading songs from localStorage:', error);
      return [];
    }
  }

  static getSong(userEmail: string, songId: string): LocalSong | undefined {
    const songs = this.getAllSongs(userEmail);
    return songs.find(song => song.id === songId);
  }

  static saveSongs(userEmail: string, songs: LocalSong[]): void {
    try {
      localStorage.setItem(this.getSongKey(userEmail), JSON.stringify(songs));
    } catch (error) {
      console.error('Error saving songs to localStorage:', error);
      throw error;
    }
  }

  static addSong(userEmail: string, song: Omit<LocalSong, 'id' | 'tracks' | 'waveformGenerated' | 'createdAt'>): LocalSong {
    const songs = this.getAllSongs(userEmail);
    const newSong: LocalSong = {
      id: crypto.randomUUID(),
      ...song,
      tracks: [],
      waveformGenerated: false,
      createdAt: new Date().toISOString()
    };
    
    songs.push(newSong);
    this.saveSongs(userEmail, songs);
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

  static deleteSong(userEmail: string, songId: string): boolean {
    const songs = this.getAllSongs(userEmail);
    const filteredSongs = songs.filter(song => song.id !== songId);
    
    if (filteredSongs.length === songs.length) {
      return false; // Song not found
    }
    
    this.saveSongs(userEmail, filteredSongs);
    return true;
  }

  static addTrack(userEmail: string, songId: string, track: any): boolean {
    try {
      const songs = this.getAllSongs(userEmail);
      const songIndex = songs.findIndex(song => song.id === songId);
      
      if (songIndex === -1) {
        console.error('LocalSongStorage.addTrack: Song not found:', songId);
        return false;
      }
      
      const newTrack = {
        id: crypto.randomUUID(),
        songId,
        name: track.name || '',
        trackNumber: track.trackNumber || 1,
        audioUrl: track.audioUrl || '',
        localFileName: track.localFileName || null,
        audioData: track.audioData || null,
        mimeType: track.mimeType || null,
        fileSize: track.fileSize || null,
        volume: track.volume || 1.0,
        balance: track.balance || 0.0,
        isMuted: track.isMuted || false,
        isSolo: track.isSolo || false,
        muteRegions: track.muteRegions || [],
        filePath: track.filePath || null,
        ...track,
        createdAt: new Date().toISOString()
      };
      
      songs[songIndex].tracks.push(newTrack);
      this.saveSongs(userEmail, songs);
      console.log('LocalSongStorage.addTrack: Track added successfully:', newTrack.id);
      return newTrack; // Return the track with its generated ID
    } catch (error) {
      console.error('LocalSongStorage.addTrack: Error adding track:', error);
      return false;
    }
  }

  static getTracks(userEmail: string, songId: string): any[] {
    const song = this.getSong(userEmail, songId);
    return song?.tracks || [];
  }

  static deleteTrack(userEmail: string, songId: string, trackId: string): boolean {
    const songs = this.getAllSongs(userEmail);
    const songIndex = songs.findIndex(song => song.id === songId);
    
    if (songIndex === -1) return false;
    
    const originalLength = songs[songIndex].tracks.length;
    songs[songIndex].tracks = songs[songIndex].tracks.filter(track => track.id !== trackId);
    
    if (songs[songIndex].tracks.length === originalLength) {
      return false; // Track not found
    }
    
    this.saveSongs(userEmail, songs);
    return true;
  }

  static updateTrack(userEmail: string, songId: string, trackId: string, updates: Partial<any>): any | null {
    const songs = this.getAllSongs(userEmail);
    const songIndex = songs.findIndex(song => song.id === songId);
    
    if (songIndex === -1) return null;
    
    const trackIndex = songs[songIndex].tracks.findIndex(track => track.id === trackId);
    if (trackIndex === -1) return null;
    
    songs[songIndex].tracks[trackIndex] = { ...songs[songIndex].tracks[trackIndex], ...updates };
    this.saveSongs(userEmail, songs);
    return songs[songIndex].tracks[trackIndex];
  }

  static addTrackToSong(userEmail: string, songId: string, track: any): LocalSong | null {
    const song = this.getSong(userEmail, songId);
    if (!song) return null;

    const newTrack = {
      id: crypto.randomUUID(),
      songId,
      ...track
    };

    const updatedSong = {
      ...song,
      tracks: [...song.tracks, newTrack]
    };

    return this.updateSong(userEmail, songId, updatedSong);
  }

  static removeTrackFromSong(userEmail: string, songId: string, trackId: string): LocalSong | null {
    const song = this.getSong(userEmail, songId);
    if (!song) return null;

    const updatedSong = {
      ...song,
      tracks: song.tracks.filter(track => track.id !== trackId)
    };

    return this.updateSong(userEmail, songId, updatedSong);
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