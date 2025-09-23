import type { Track } from "@shared/schema";
import { BrowserFileSystem } from "./browser-file-system";
import { IndexedDBStorage, AudioFileMetadata } from "./indexed-db-storage";

interface StoredAudioFile {
  id: string;
  name: string;
  filePath: string; // Local file path
  mimeType: string;
  size: number;
  lastModified: number;
}

export class AudioFileStorage {
  private static instances: Map<string, AudioFileStorage> = new Map();
  private audioFiles: Map<string, StoredAudioFile> = new Map();
  private fileObjects: Map<string, File> = new Map(); // Keep original File objects in memory
  private blobUrls: Map<string, string> = new Map(); // Cache blob URLs to avoid recreating
  private fileCache: Map<string, File> = new Map(); // Cache files by path for faster access
  private browserFS: BrowserFileSystem;
  private userEmail: string;
  private storageKey: string;
  private indexedDB: IndexedDBStorage | null = null;

  /**
   * Get a per-user instance of AudioFileStorage
   * Each user gets their own isolated storage
   */
  static getInstance(userEmail?: string): AudioFileStorage {
    // Use default email if none provided for backward compatibility
    const email = userEmail || 'default@user.com';
    
    if (!AudioFileStorage.instances.has(email)) {
      const instance = new AudioFileStorage(email);
      // Start the async initialization but don't wait for it
      instance.loadFromStorage().catch(error => {
        console.error('Failed to load audio file storage:', error);
      });
      AudioFileStorage.instances.set(email, instance);
    }
    return AudioFileStorage.instances.get(email)!;
  }

  constructor(userEmail: string) {
    this.userEmail = userEmail;
    // Create a namespaced storage key for this user
    this.storageKey = `music-app-audio-files::${userEmail}`;
    
    console.log(`🗄️ Initializing per-user AudioFileStorage with key: ${this.storageKey}`);
    
    // Get per-user BrowserFileSystem instance
    this.browserFS = BrowserFileSystem.getInstance(userEmail);
    
    // Initialize IndexedDB for this user (don't await here to avoid constructor blocking)
    this.initializeIndexedDB().catch(error => {
      console.error('Failed to initialize IndexedDB for AudioFileStorage:', error);
    });
  }
  
  private async initializeIndexedDB(): Promise<void> {
    try {
      this.indexedDB = IndexedDBStorage.getInstance(this.userEmail);
      await this.indexedDB.initialize();
      console.log('✅ IndexedDB initialized for AudioFileStorage');
    } catch (error) {
      console.error('Failed to initialize IndexedDB:', error);
      // Don't throw - allow the class to work with browserFS only
    }
  }

  // Store file using browser storage (IndexedDB + File API)
  async storeAudioFile(trackId: string, file: File, track?: Track, songTitle?: string): Promise<void> {
    try {
      console.log(`Storing audio file in browser: ${file.name}, size: ${file.size} bytes`);
      
      if (!track) {
        throw new Error('Track information required for storage');
      }

      // Store file in browser file system
      const success = await this.browserFS.addAudioFile(track.songId, trackId, track.name, file);
      
      if (!success) {
        throw new Error('Failed to save file to browser storage');
      }

      // Keep file object in memory cache for immediate access
      this.fileObjects.set(trackId, file);
      
      // Create metadata entry for compatibility
      const storedFile: StoredAudioFile = {
        id: trackId,
        name: file.name,
        filePath: `browser://${track.songId}/${trackId}`,
        mimeType: file.type,
        size: file.size,
        lastModified: file.lastModified || Date.now()
      };

      this.audioFiles.set(trackId, storedFile);
      
      // Save metadata to IndexedDB
      await this.saveToStorage();
      
      console.log(`Successfully stored audio file for track: ${track.name} (${Math.round(file.size / 1024)}KB)`);
    } catch (error) {
      console.error('Failed to store audio file:', error);
      throw error;
    }
  }

  // Get audio file as blob URL using browser storage
  async getAudioUrl(trackId: string): Promise<string | null> {
    console.log(`🔍 Requesting audio URL for track: ${trackId}`);
    console.log(`📂 Available audio files (${this.audioFiles.size}):`, Array.from(this.audioFiles.keys()));
    console.log(`💾 Memory cache files (${this.fileObjects.size}):`, Array.from(this.fileObjects.keys()));
    
    // Try browser file system first (handles caching internally)
    try {
      const url = await this.browserFS.getAudioUrl(trackId);
      if (url) {
        console.log(`✅ Got audio URL from browser storage for track: ${trackId}`);
        return url;
      }
    } catch (error) {
      console.error(`❌ Error getting URL from browser storage for track ${trackId}:`, error);
    }

    // Fallback to in-memory cache
    const fileObject = this.fileObjects.get(trackId);
    if (!fileObject) {
      console.warn(`⚠️ Audio file not found for track: ${trackId}`);
      console.log(`🔍 Checking if browser file system has any files...`);
      
      console.log(`💡 Audio files are stored locally when you record or add tracks`);
      console.log(`🎵 Record new audio or add existing audio files to enable playback`);
      
      
      return null;
    }

    try {
      const url = URL.createObjectURL(fileObject);
      this.blobUrls.set(trackId, url); // Cache the blob URL
      console.log(`Created fallback audio URL for track: ${trackId}`);
      return url;
    } catch (error) {
      console.error(`Failed to create audio URL for track: ${trackId}`, error);
      return null;
    }
  }

  // Check if audio file exists in memory
  hasAudioFile(trackId: string): boolean {
    return this.fileObjects.has(trackId);
  }

  // Remove audio file
  removeAudioFile(trackId: string): void {
    // Clean up blob URL
    const blobUrl = this.blobUrls.get(trackId);
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl);
      this.blobUrls.delete(trackId);
    }
    
    this.audioFiles.delete(trackId);
    this.fileObjects.delete(trackId);
    this.saveToStorage();
    console.log(`Removed audio file for track: ${trackId}`);
  }

  // Get all stored audio files
  getAllStoredFiles(): StoredAudioFile[] {
    return Array.from(this.audioFiles.values());
  }

  // Get audio file data for direct loading
  async getAudioFileData(trackId: string): Promise<ArrayBuffer | null> {
    let fileObject = this.fileObjects.get(trackId);
    
    // Try to find file by path if not in memory
    if (!fileObject) {
      const storedFile = this.audioFiles.get(trackId);
      if (storedFile) {
        fileObject = this.fileCache.get(storedFile.filePath);
        if (fileObject) {
          this.fileObjects.set(trackId, fileObject);
        }
      }
    }
    
    if (!fileObject) {
      return null;
    }

    try {
      return await fileObject.arrayBuffer();
    } catch (error) {
      console.error(`Failed to get audio data for track: ${trackId}`, error);
      return null;
    }
  }

  // Load audio file path references from IndexedDB for this user
  private async loadFromStorage(): Promise<void> {
    try {
      // First, migrate any existing localStorage data
      await this.migrateFromLocalStorage();
      
      // Then load from IndexedDB
      if (!this.indexedDB) {
        await this.initializeIndexedDB();
      }
      
      // Only try to load if indexedDB is available
      if (this.indexedDB) {
        const metadata = await this.indexedDB.getAllAudioFileMetadata();
        this.audioFiles = new Map(metadata.map(m => [m.id, {
          id: m.id,
          name: m.name,
          filePath: m.filePath,
          mimeType: m.mimeType,
          size: m.size,
          lastModified: m.lastModified
        }]));
        
        console.log(`Loaded ${this.audioFiles.size} audio file references from IndexedDB for user: ${this.userEmail}`);
      } else {
        console.warn('IndexedDB not available, using empty audio files map');
        this.audioFiles = new Map();
      }
    } catch (error) {
      console.error('Failed to load audio file references from IndexedDB:', error);
      this.audioFiles = new Map();
    }
  }
  
  // One-time migration from localStorage to IndexedDB
  private async migrateFromLocalStorage(): Promise<void> {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        console.log(`Migrating audio file metadata from localStorage to IndexedDB...`);
        const data = JSON.parse(stored);
        const entries = Array.from(data);
        
        if (!this.indexedDB) {
          await this.initializeIndexedDB();
        }
        
        for (const [id, storedFile] of entries) {
          const metadata: AudioFileMetadata = {
            id: id,
            songId: storedFile.songId || '',
            name: storedFile.name,
            filePath: storedFile.filePath,
            mimeType: storedFile.mimeType || storedFile.type,
            size: storedFile.size,
            lastModified: storedFile.lastModified
          };
          await this.indexedDB!.storeAudioFileMetadata(metadata);
        }
        
        // Remove from localStorage after successful migration
        localStorage.removeItem(this.storageKey);
        console.log(`✅ Migrated ${entries.length} audio file metadata entries to IndexedDB`);
      }
    } catch (error) {
      console.error('Failed to migrate audio file metadata from localStorage:', error);
    }
  }

  // Automatically load stored audio files from IndexedDB into memory cache
  private async autoLoadStoredFiles(): Promise<void> {
    console.log(`🔄 Auto-loading ${this.audioFiles.size} stored audio files...`);
    
    let loadedCount = 0;
    const trackIds = Array.from(this.audioFiles.keys());
    
    for (const trackId of trackIds) {
      try {
        // This will load from IndexedDB and cache in memory
        const url = await this.browserFS.getAudioUrl(trackId);
        if (url) {
          loadedCount++;
          console.log(`✅ Auto-loaded audio file for track: ${trackId}`);
        }
      } catch (error) {
        console.warn(`⚠️ Failed to auto-load audio file for track: ${trackId}`, error);
      }
    }
    
    console.log(`✅ Auto-loaded ${loadedCount}/${this.audioFiles.size} audio files into cache`);
  }

  // Display the files that the app expects to find
  private displayExpectedFiles(): void {
    if (this.audioFiles.size > 0) {
      console.log('Expected audio files for tracks:');
      const entries = Array.from(this.audioFiles.entries());
      for (const [trackId, storedFile] of entries) {
        console.log(`  - ${storedFile.name} (${storedFile.filePath})`);
      }
      console.log('These files will be loaded when you select them through the file picker.');
    }
  }

  // Store a track reference for file reconnection (without the actual file)
  async storeTrackReference(trackId: string, fileInfo: { name: string; filePath: string; mimeType: string; size: number; lastModified: number }): Promise<void> {
    const storedFile: StoredAudioFile = {
      id: trackId,
      name: fileInfo.name,
      filePath: fileInfo.filePath,
      mimeType: fileInfo.mimeType,
      size: fileInfo.size,
      lastModified: fileInfo.lastModified
    };

    this.audioFiles.set(trackId, storedFile);
    await this.saveToStorage();
    console.log(`Stored track reference: ${trackId} -> ${fileInfo.name}`);
  }

  // Add a method to manually register found files
  registerFoundFile(filePath: string, file: File): void {
    this.fileCache.set(filePath, file);
    console.log(`Registered file: ${file.name} at path: ${filePath}`);
    
    // Find any tracks that reference this file and make them available
    const entries = Array.from(this.audioFiles.entries());
    for (const [trackId, storedFile] of entries) {
      if (storedFile.filePath === filePath || storedFile.name === file.name) {
        this.fileObjects.set(trackId, file);
        console.log(`Connected file ${file.name} to track: ${trackId}`);
        
        // Create blob URL for immediate access
        const blobUrl = URL.createObjectURL(file);
        this.blobUrls.set(trackId, blobUrl);
      }
    }
  }

  // Register files in bulk from file picker
  registerFiles(files: FileList | File[]): { registered: number; expectedCount: number } {
    console.log(`Attempting to register ${files.length} files`);
    
    const expectedFiles = Array.from(this.audioFiles.values());
    let registered = 0;

    Array.from(files).forEach(file => {
      // Match files by name (removing .mp3 extension and common prefixes)
      const cleanFileName = file.name.replace(/\.(mp3|wav|ogg|m4a)$/i, '');
      
      const matchingStoredFile = expectedFiles.find(stored => {
        const cleanStoredName = stored.name.replace(/\.(mp3|wav|ogg|m4a)$/i, '');
        return cleanStoredName === cleanFileName || stored.name === file.name;
      });
        
      if (matchingStoredFile) {
        console.log(`Registering file: ${file.name} for track: ${matchingStoredFile.id}`);
        this.fileObjects.set(matchingStoredFile.id, file);
        this.fileCache.set(file.name, file);
        this.fileCache.set(matchingStoredFile.filePath, file); // Also cache by stored path
        
        // Create blob URL for immediate access
        const blobUrl = URL.createObjectURL(file);
        this.blobUrls.set(matchingStoredFile.id, blobUrl);
        
        registered++;
      } else {
        console.log(`File ${file.name} does not match any expected tracks`);
      }
    });

    console.log(`Registered ${registered} out of ${expectedFiles.length} expected files`);
    return { registered, expectedCount: expectedFiles.length };
  }

  // Save audio file path references to IndexedDB for this user
  private async saveToStorage(): Promise<void> {
    try {
      if (!this.indexedDB) {
        await this.initializeIndexedDB();
      }
      
      // Save each audio file metadata to IndexedDB
      for (const [id, storedFile] of this.audioFiles.entries()) {
        const metadata: AudioFileMetadata = {
          id: id,
          songId: '', // Will be set when available
          name: storedFile.name,
          filePath: storedFile.filePath,
          mimeType: storedFile.mimeType,
          size: storedFile.size,
          lastModified: storedFile.lastModified
        };
        await this.indexedDB!.storeAudioFileMetadata(metadata);
      }
      
      console.log(`Saved ${this.audioFiles.size} audio file references to IndexedDB for user: ${this.userEmail}`);
    } catch (error) {
      console.error('Failed to save audio file references to IndexedDB:', error);
    }
  }

  // Clear all audio files
  async clearAll(): Promise<void> {
    // Clean up all blob URLs
    const urls = Array.from(this.blobUrls.values());
    for (const blobUrl of urls) {
      URL.revokeObjectURL(blobUrl);
    }
    
    this.audioFiles.clear();
    this.fileObjects.clear();
    this.blobUrls.clear();
    this.fileCache.clear();
    
    // Clear from IndexedDB
    if (!this.indexedDB) {
      await this.initializeIndexedDB();
    }
    
    // Clear all audio file metadata from IndexedDB
    const allMetadata = await this.indexedDB!.getAllAudioFileMetadata();
    for (const metadata of allMetadata) {
      await this.indexedDB!.deleteAudioFileMetadata(metadata.id);
    }
    
    localStorage.removeItem(this.storageKey);
    console.log(`Cleared all audio file references and cache for user: ${this.userEmail}`);
  }
}

// Export a function to get the audio storage for the current user
export function getAudioStorage(userEmail?: string): AudioFileStorage {
  return AudioFileStorage.getInstance(userEmail);
}

// For backward compatibility, export the default instance
export const audioStorage = AudioFileStorage.getInstance();