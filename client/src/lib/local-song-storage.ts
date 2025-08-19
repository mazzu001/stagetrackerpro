import type { SongWithTracks } from '@shared/schema';

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

  static addSong(userEmail: string, song: Omit<LocalSong, 'id' | 'tracks' | 'midiEvents' | 'waveformGenerated' | 'createdAt'>): LocalSong {
    const songs = this.getAllSongs(userEmail);
    const newSong: LocalSong = {
      id: crypto.randomUUID(),
      ...song,
      tracks: [],
      midiEvents: [],
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

  static addTrack(userEmail: string, songId: string, track: Omit<any, 'id' | 'songId'>): any | null {
    const songs = this.getAllSongs(userEmail);
    const songIndex = songs.findIndex(song => song.id === songId);
    
    if (songIndex === -1) return null;
    
    const newTrack = {
      id: crypto.randomUUID(),
      songId,
      ...track,
      createdAt: new Date().toISOString()
    };
    
    songs[songIndex].tracks.push(newTrack);
    this.saveSongs(userEmail, songs);
    return newTrack;
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
}