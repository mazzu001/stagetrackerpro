// Alternative local file system using File API and IndexedDB
// Works in all browsers and environments, including iframes

interface LocalConfig {
  version: string;
  lastUpdated: number;
  songs: {
    [songId: string]: {
      title: string;
      artist: string;
      duration: number;
      bpm?: number;
      key?: string;
      lyrics?: string;
      createdAt: number;
      lastModified: number;
      tracks: LocalTrack[];
    };
  };
  waveforms: {
    [songId: string]: number[];
  };
}

interface LocalTrack {
  id: string;
  songId: string;
  name: string;
  trackNumber: number;
  volume: number;
  balance: number;
  isMuted: boolean;
  isSolo: boolean;
  fileName?: string;
}

export class BrowserFileSystem {
  private static instance: BrowserFileSystem;
  private config: LocalConfig;
  private dbName = 'MusicAppStorage';
  private dbVersion = 1;
  private db: IDBDatabase | null = null;
  private audioFiles: Map<string, File> = new Map();
  private blobUrls: Map<string, string> = new Map();

  static getInstance(): BrowserFileSystem {
    if (!BrowserFileSystem.instance) {
      BrowserFileSystem.instance = new BrowserFileSystem();
    }
    return BrowserFileSystem.instance;
  }

  constructor() {
    this.config = {
      version: '1.0.0',
      lastUpdated: Date.now(),
      songs: {},
      waveforms: {}
    };
  }

  // Check if already initialized
  async isAlreadyInitialized(): Promise<boolean> {
    try {
      const initialized = localStorage.getItem('browserfs-initialized');
      return initialized === 'true';
    } catch (error) {
      return false;
    }
  }

  // Initialize IndexedDB for file storage
  async initialize(): Promise<boolean> {
    try {
      await this.initializeDB();
      await this.loadConfig();
      
      // Mark as initialized in localStorage
      localStorage.setItem('browserfs-initialized', 'true');
      console.log('Browser file system initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize browser file system:', error);
      return false;
    }
  }

  private async initializeDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Store audio files as blobs
        if (!db.objectStoreNames.contains('audioFiles')) {
          db.createObjectStore('audioFiles', { keyPath: 'id' });
        }
        
        // Store configuration
        if (!db.objectStoreNames.contains('config')) {
          db.createObjectStore('config', { keyPath: 'key' });
        }
      };
    });
  }

  // Load configuration from IndexedDB
  private async loadConfig(): Promise<void> {
    if (!this.db) return;

    try {
      const transaction = this.db.transaction(['config'], 'readonly');
      const store = transaction.objectStore('config');
      const request = store.get('appConfig');

      const result = await new Promise<any>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      if (result && result.data) {
        this.config = result.data;
        console.log(`Loaded config with ${Object.keys(this.config.songs).length} songs`);
      }
    } catch (error) {
      console.log('No existing config found, using defaults');
    }
  }

  // Save configuration to IndexedDB
  private async saveConfig(): Promise<void> {
    if (!this.db) return;

    try {
      this.config.lastUpdated = Date.now();
      const transaction = this.db.transaction(['config'], 'readwrite');
      const store = transaction.objectStore('config');
      await store.put({ key: 'appConfig', data: this.config });
      console.log('Config saved successfully');
    } catch (error) {
      console.error('Failed to save config:', error);
    }
  }

  // Add audio file (user selects files through file picker)
  async addAudioFile(songId: string, trackId: string, trackName: string, file: File): Promise<boolean> {
    if (!this.db) return false;

    try {
      // Store file in IndexedDB
      const transaction = this.db.transaction(['audioFiles'], 'readwrite');
      const store = transaction.objectStore('audioFiles');
      
      await new Promise((resolve, reject) => {
        const request = store.put({
          id: trackId,
          songId: songId,
          name: trackName,
          fileName: file.name,
          file: file,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified || Date.now()
        });
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      // Cache file in memory
      this.audioFiles.set(trackId, file);

      console.log(`Audio file stored: ${file.name} for track: ${trackName}`);
      return true;

    } catch (error) {
      console.error('Failed to store audio file:', error);
      return false;
    }
  }

  // Get audio file for playback
  async getAudioFile(trackId: string): Promise<File | null> {
    // Check memory cache first
    if (this.audioFiles.has(trackId)) {
      return this.audioFiles.get(trackId)!;
    }

    if (!this.db) return null;

    try {
      const transaction = this.db.transaction(['audioFiles'], 'readonly');
      const store = transaction.objectStore('audioFiles');
      const request = store.get(trackId);

      const result = await new Promise<any>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      if (result && result.file) {
        // Cache in memory for faster access
        this.audioFiles.set(trackId, result.file);
        return result.file;
      }

      return null;
    } catch (error) {
      console.error('Failed to load audio file:', error);
      return null;
    }
  }

  // Get blob URL for audio playback
  async getAudioUrl(trackId: string): Promise<string | null> {
    // Return cached URL if available
    if (this.blobUrls.has(trackId)) {
      return this.blobUrls.get(trackId)!;
    }

    const file = await this.getAudioFile(trackId);
    if (!file) return null;

    try {
      const url = URL.createObjectURL(file);
      this.blobUrls.set(trackId, url);
      return url;
    } catch (error) {
      console.error('Failed to create blob URL:', error);
      return null;
    }
  }

  // Song management
  async saveSong(songId: string, songData: any): Promise<void> {
    this.config.songs[songId] = {
      ...songData,
      lastModified: Date.now()
    };
    await this.saveConfig();
  }

  getSong(songId: string): any {
    return this.config.songs[songId] || null;
  }

  getAllSongs(): any[] {
    return Object.entries(this.config.songs).map(([id, data]) => ({
      id,
      ...data
    }));
  }

  async deleteSong(songId: string): Promise<boolean> {
    try {
      // Delete song from config
      delete this.config.songs[songId];
      delete this.config.waveforms[songId];

      // Delete associated audio files
      if (this.db) {
        const transaction = this.db.transaction(['audioFiles'], 'readwrite');
        const store = transaction.objectStore('audioFiles');
        
        // Get all files for this song and delete them
        const allFiles = await new Promise<any[]>((resolve, reject) => {
          const request = store.getAll();
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });

        for (const fileData of allFiles) {
          if (fileData.songId === songId) {
            await store.delete(fileData.id);
            this.audioFiles.delete(fileData.id);
            
            // Clean up blob URL
            if (this.blobUrls.has(fileData.id)) {
              URL.revokeObjectURL(this.blobUrls.get(fileData.id)!);
              this.blobUrls.delete(fileData.id);
            }
          }
        }
      }

      await this.saveConfig();
      console.log(`Song deleted: ${songId}`);
      return true;

    } catch (error) {
      console.error('Failed to delete song:', error);
      return false;
    }
  }

  // Waveform management
  async saveWaveform(songId: string, waveformData: number[]): Promise<void> {
    this.config.waveforms[songId] = waveformData;
    await this.saveConfig();
  }

  getWaveform(songId: string): number[] | null {
    return this.config.waveforms[songId] || null;
  }

  // Check if ready
  isReady(): boolean {
    return !!this.db;
  }

  // Get status
  getStatus(): string {
    const songCount = Object.keys(this.config.songs).length;
    const fileCount = this.audioFiles.size;
    return `Ready - ${songCount} songs, ${fileCount} audio files cached`;
  }

  // File picker helper for adding multiple files
  async showFilePicker(accept: string = '.mp3,.wav,.m4a,.ogg'): Promise<FileList | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept;
      input.multiple = true;
      
      input.onchange = () => {
        resolve(input.files);
      };
      
      input.oncancel = () => {
        resolve(null);
      };
      
      // Trigger file picker
      input.click();
    });
  }

  // Get file info for track
  getTrackFileInfo(trackId: string): any {
    const file = this.audioFiles.get(trackId);
    if (!file) return null;
    
    return {
      fileName: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified
    };
  }

  // Cleanup blob URLs to prevent memory leaks
  cleanup(): void {
    this.blobUrls.forEach((url) => {
      URL.revokeObjectURL(url);
    });
    this.blobUrls.clear();
  }
}