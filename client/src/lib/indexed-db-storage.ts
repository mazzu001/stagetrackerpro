// IndexedDB-based storage for songs, tracks, and mute regions
// Replaces localStorage to solve persistence issues

export interface Song {
  id: string;
  userId: string;
  title: string;
  artist: string;
  duration?: number;
  bpm?: number;
  key?: string;
  lyrics?: string;
  waveformData?: string;
  waveformGenerated: boolean;
  createdAt: string;
}

export interface Track {
  id: string;
  songId: string;
  name: string;
  volume: number;
  balance: number;
  isMuted: boolean;
  isSolo: boolean;
  localFileName?: string;
  createdAt: string;
}

export interface MuteRegion {
  id: string;
  trackId: string;
  start: number;
  end: number;
  createdAt: string;
}

export interface AudioFile {
  id: string; // trackId
  songId: string;
  name: string;
  fileName: string;
  fileData: ArrayBuffer;
  size: number;
  type: string;
  lastModified: number;
}

export class IndexedDBStorage {
  private static instances: Map<string, IndexedDBStorage> = new Map();
  private db: IDBDatabase | null = null;
  private readonly dbName: string;
  private readonly version = 1;
  
  private constructor(userEmail: string) {
    this.dbName = `MusicAppDB_${userEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
  }
  
  static getInstance(userEmail: string): IndexedDBStorage {
    if (!IndexedDBStorage.instances.has(userEmail)) {
      IndexedDBStorage.instances.set(userEmail, new IndexedDBStorage(userEmail));
    }
    return IndexedDBStorage.instances.get(userEmail)!;
  }
  
  async initialize(): Promise<void> {
    if (this.db) return;
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        reject(request.error);
      };
      
      request.onsuccess = () => {
        this.db = request.result;
        console.log(`✅ IndexedDB initialized: ${this.dbName}`);
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create songs store
        if (!db.objectStoreNames.contains('songs')) {
          const songsStore = db.createObjectStore('songs', { keyPath: 'id' });
          songsStore.createIndex('userId', 'userId', { unique: false });
          console.log('Created songs store');
        }
        
        // Create tracks store
        if (!db.objectStoreNames.contains('tracks')) {
          const tracksStore = db.createObjectStore('tracks', { keyPath: 'id' });
          tracksStore.createIndex('songId', 'songId', { unique: false });
          console.log('Created tracks store');
        }
        
        // Create mute regions store
        if (!db.objectStoreNames.contains('muteRegions')) {
          const muteRegionsStore = db.createObjectStore('muteRegions', { keyPath: 'id' });
          muteRegionsStore.createIndex('trackId', 'trackId', { unique: false });
          console.log('Created muteRegions store');
        }
        
        // Create audio files store if it doesn't exist
        if (!db.objectStoreNames.contains('audioFiles')) {
          const audioFilesStore = db.createObjectStore('audioFiles', { keyPath: 'id' });
          audioFilesStore.createIndex('songId', 'songId', { unique: false });
          console.log('Created audioFiles store');
        }
      };
    });
  }
  
  private ensureDatabase(): void {
    if (!this.db) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
  }
  
  // Song operations
  async getAllSongs(): Promise<Song[]> {
    this.ensureDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['songs'], 'readonly');
      const store = transaction.objectStore('songs');
      const request = store.getAll();
      
      request.onsuccess = () => {
        const songs = request.result || [];
        // Sort alphabetically by title
        songs.sort((a, b) => a.title.localeCompare(b.title));
        resolve(songs);
      };
      
      request.onerror = () => {
        console.error('Failed to get all songs:', request.error);
        reject(request.error);
      };
    });
  }
  
  async getSong(songId: string): Promise<Song | undefined> {
    this.ensureDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['songs'], 'readonly');
      const store = transaction.objectStore('songs');
      const request = store.get(songId);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  
  async addSong(song: Omit<Song, 'id' | 'createdAt'>): Promise<Song> {
    this.ensureDatabase();
    
    const newSong: Song = {
      ...song,
      id: crypto.randomUUID(),
      waveformGenerated: false,
      createdAt: new Date().toISOString()
    };
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['songs'], 'readwrite');
      const store = transaction.objectStore('songs');
      const request = store.add(newSong);
      
      request.onsuccess = () => {
        console.log(`✅ Song added: ${newSong.title}`);
        resolve(newSong);
      };
      
      request.onerror = () => {
        console.error('Failed to add song:', request.error);
        reject(request.error);
      };
    });
  }
  
  async updateSong(songId: string, updates: Partial<Song>): Promise<Song | null> {
    this.ensureDatabase();
    
    const song = await this.getSong(songId);
    if (!song) return null;
    
    const updatedSong = { ...song, ...updates, id: songId };
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['songs'], 'readwrite');
      const store = transaction.objectStore('songs');
      const request = store.put(updatedSong);
      
      request.onsuccess = () => resolve(updatedSong);
      request.onerror = () => reject(request.error);
    });
  }
  
  async deleteSong(songId: string): Promise<boolean> {
    this.ensureDatabase();
    
    try {
      // Delete all tracks for this song
      const tracks = await this.getTracksBySongId(songId);
      for (const track of tracks) {
        await this.deleteTrack(track.id);
      }
      
      // Delete all audio files for this song
      await this.deleteAudioFilesBySongId(songId);
      
      // Delete the song itself
      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction(['songs'], 'readwrite');
        const store = transaction.objectStore('songs');
        const request = store.delete(songId);
        
        request.onsuccess = () => {
          console.log(`✅ Song deleted: ${songId}`);
          resolve(true);
        };
        
        request.onerror = () => {
          console.error('Failed to delete song:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('Failed to delete song and related data:', error);
      return false;
    }
  }
  
  // Track operations
  async getTracksBySongId(songId: string): Promise<Track[]> {
    this.ensureDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['tracks'], 'readonly');
      const store = transaction.objectStore('tracks');
      const index = store.index('songId');
      const request = index.getAll(songId);
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }
  
  async getTrack(trackId: string): Promise<Track | undefined> {
    this.ensureDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['tracks'], 'readonly');
      const store = transaction.objectStore('tracks');
      const request = store.get(trackId);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  
  async addTrack(songId: string, track: Omit<Track, 'id' | 'songId' | 'createdAt'>): Promise<Track> {
    this.ensureDatabase();
    
    const newTrack: Track = {
      ...track,
      id: crypto.randomUUID(),
      songId,
      volume: track.volume ?? 50,
      balance: track.balance ?? 0,
      isMuted: track.isMuted ?? false,
      isSolo: track.isSolo ?? false,
      createdAt: new Date().toISOString()
    };
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['tracks'], 'readwrite');
      const store = transaction.objectStore('tracks');
      const request = store.add(newTrack);
      
      request.onsuccess = () => {
        console.log(`✅ Track added: ${newTrack.name}`);
        resolve(newTrack);
      };
      
      request.onerror = () => {
        console.error('Failed to add track:', request.error);
        reject(request.error);
      };
    });
  }
  
  async updateTrack(trackId: string, updates: Partial<Track>): Promise<Track | null> {
    this.ensureDatabase();
    
    const track = await this.getTrack(trackId);
    if (!track) return null;
    
    const updatedTrack = { ...track, ...updates, id: trackId };
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['tracks'], 'readwrite');
      const store = transaction.objectStore('tracks');
      const request = store.put(updatedTrack);
      
      request.onsuccess = () => {
        console.log(`✅ Track updated: ${trackId}, updates:`, updates);
        resolve(updatedTrack);
      };
      
      request.onerror = () => reject(request.error);
    });
  }
  
  async deleteTrack(trackId: string): Promise<boolean> {
    this.ensureDatabase();
    
    try {
      // Delete all mute regions for this track
      await this.deleteAllMuteRegions(trackId);
      
      // Delete the track
      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction(['tracks'], 'readwrite');
        const store = transaction.objectStore('tracks');
        const request = store.delete(trackId);
        
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to delete track:', error);
      return false;
    }
  }
  
  // Mute region operations
  async getMuteRegions(trackId: string): Promise<MuteRegion[]> {
    this.ensureDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['muteRegions'], 'readonly');
      const store = transaction.objectStore('muteRegions');
      const index = store.index('trackId');
      const request = index.getAll(trackId);
      
      request.onsuccess = () => {
        const regions = request.result || [];
        console.log(`🔍 Retrieved ${regions.length} mute regions for track ${trackId}`);
        resolve(regions);
      };
      
      request.onerror = () => reject(request.error);
    });
  }
  
  async addMuteRegion(trackId: string, region: Omit<MuteRegion, 'id' | 'trackId' | 'createdAt'>): Promise<MuteRegion> {
    this.ensureDatabase();
    
    const newRegion: MuteRegion = {
      ...region,
      id: crypto.randomUUID(),
      trackId,
      createdAt: new Date().toISOString()
    };
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['muteRegions'], 'readwrite');
      const store = transaction.objectStore('muteRegions');
      const request = store.add(newRegion);
      
      request.onsuccess = () => {
        console.log(`➕ Mute region added: ${newRegion.start}s-${newRegion.end}s for track ${trackId}`);
        resolve(newRegion);
      };
      
      request.onerror = () => reject(request.error);
    });
  }
  
  async updateMuteRegion(regionId: string, updates: Partial<MuteRegion>): Promise<MuteRegion | null> {
    this.ensureDatabase();
    
    return new Promise(async (resolve, reject) => {
      const transaction = this.db!.transaction(['muteRegions'], 'readwrite');
      const store = transaction.objectStore('muteRegions');
      const getRequest = store.get(regionId);
      
      getRequest.onsuccess = () => {
        const region = getRequest.result;
        if (!region) {
          resolve(null);
          return;
        }
        
        const updatedRegion = { ...region, ...updates, id: regionId };
        const putRequest = store.put(updatedRegion);
        
        putRequest.onsuccess = () => {
          console.log(`🔄 Mute region updated: ${regionId}`);
          resolve(updatedRegion);
        };
        
        putRequest.onerror = () => reject(putRequest.error);
      };
      
      getRequest.onerror = () => reject(getRequest.error);
    });
  }
  
  async deleteMuteRegion(regionId: string): Promise<boolean> {
    this.ensureDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['muteRegions'], 'readwrite');
      const store = transaction.objectStore('muteRegions');
      const request = store.delete(regionId);
      
      request.onsuccess = () => {
        console.log(`🗑️ Mute region deleted: ${regionId}`);
        resolve(true);
      };
      
      request.onerror = () => reject(request.error);
    });
  }
  
  async deleteAllMuteRegions(trackId: string): Promise<boolean> {
    this.ensureDatabase();
    
    try {
      const regions = await this.getMuteRegions(trackId);
      for (const region of regions) {
        await this.deleteMuteRegion(region.id);
      }
      console.log(`✅ Deleted all mute regions for track ${trackId}`);
      return true;
    } catch (error) {
      console.error('Failed to delete mute regions:', error);
      return false;
    }
  }
  
  // Audio file operations
  async storeAudioFile(trackId: string, songId: string, file: File, trackName: string): Promise<boolean> {
    this.ensureDatabase();
    
    try {
      const fileArrayBuffer = await file.arrayBuffer();
      
      const audioFile: AudioFile = {
        id: trackId,
        songId,
        name: trackName,
        fileName: file.name,
        fileData: fileArrayBuffer,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified || Date.now()
      };
      
      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction(['audioFiles'], 'readwrite');
        const store = transaction.objectStore('audioFiles');
        const request = store.put(audioFile);
        
        request.onsuccess = () => {
          console.log(`✅ Audio file stored: ${file.name} for track ${trackName}`);
          resolve(true);
        };
        
        request.onerror = () => {
          console.error('Failed to store audio file:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('Failed to store audio file:', error);
      return false;
    }
  }
  
  async getAudioFile(trackId: string): Promise<File | null> {
    this.ensureDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['audioFiles'], 'readonly');
      const store = transaction.objectStore('audioFiles');
      const request = store.get(trackId);
      
      request.onsuccess = () => {
        const audioFile = request.result;
        if (!audioFile) {
          resolve(null);
          return;
        }
        
        // Convert ArrayBuffer back to File
        const file = new File(
          [audioFile.fileData],
          audioFile.fileName,
          { type: audioFile.type, lastModified: audioFile.lastModified }
        );
        resolve(file);
      };
      
      request.onerror = () => reject(request.error);
    });
  }
  
  async getAudioUrl(trackId: string): Promise<string | null> {
    const file = await this.getAudioFile(trackId);
    if (!file) return null;
    
    return URL.createObjectURL(file);
  }
  
  async deleteAudioFilesBySongId(songId: string): Promise<boolean> {
    this.ensureDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['audioFiles'], 'readwrite');
      const store = transaction.objectStore('audioFiles');
      const index = store.index('songId');
      const request = index.openCursor(IDBKeyRange.only(songId));
      
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          console.log(`✅ Deleted audio files for song ${songId}`);
          resolve(true);
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }
  
  // Get complete song data with tracks and mute regions
  async getSongWithTracks(songId: string): Promise<any | null> {
    const song = await this.getSong(songId);
    if (!song) return null;
    
    const tracks = await this.getTracksBySongId(songId);
    
    // Get mute regions for each track
    const tracksWithRegions = await Promise.all(
      tracks.map(async (track) => {
        const muteRegions = await this.getMuteRegions(track.id);
        return { ...track, muteRegions };
      })
    );
    
    return {
      ...song,
      tracks: tracksWithRegions
    };
  }
  
  // Get all songs with their tracks
  async getAllSongsWithTracks(): Promise<any[]> {
    const songs = await this.getAllSongs();
    
    return Promise.all(
      songs.map(async (song) => {
        const tracks = await this.getTracksBySongId(song.id);
        
        // Get mute regions for each track
        const tracksWithRegions = await Promise.all(
          tracks.map(async (track) => {
            const muteRegions = await this.getMuteRegions(track.id);
            return { ...track, muteRegions };
          })
        );
        
        return {
          ...song,
          tracks: tracksWithRegions
        };
      })
    );
  }
  
  // Migration helper - import from localStorage
  async importFromLocalStorage(userEmail: string): Promise<void> {
    // Use the correct key format from LocalSongStorage
    const localStorageKey = `lpp_songs_${userEmail}`;
    const stored = localStorage.getItem(localStorageKey);
    
    if (!stored) {
      console.log('No localStorage data to migrate');
      return;
    }
    
    try {
      const localSongs = JSON.parse(stored);
      console.log(`Migrating ${localSongs.length} songs from localStorage to IndexedDB...`);
      
      for (const localSong of localSongs) {
        // Add song
        const song = await this.addSong({
          userId: localSong.userId || userEmail,
          title: localSong.title,
          artist: localSong.artist,
          duration: localSong.duration,
          bpm: localSong.bpm,
          key: localSong.key,
          lyrics: localSong.lyrics,
          waveformData: localSong.waveformData,
          waveformGenerated: localSong.waveformGenerated || false
        });
        
        // Add tracks
        if (localSong.tracks && Array.isArray(localSong.tracks)) {
          for (const localTrack of localSong.tracks) {
            await this.addTrack(song.id, {
              name: localTrack.name,
              volume: localTrack.volume ?? 50,
              balance: localTrack.balance ?? 0,
              isMuted: localTrack.isMuted ?? false,
              isSolo: localTrack.isSolo ?? false,
              localFileName: localTrack.localFileName
            });
          }
        }
      }
      
      console.log('✅ Migration complete!');
    } catch (error) {
      console.error('Failed to migrate from localStorage:', error);
    }
  }
}