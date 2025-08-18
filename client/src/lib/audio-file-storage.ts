import type { Track } from "@shared/schema";
import { LocalFileSystem } from "./local-file-system";

interface StoredAudioFile {
  id: string;
  name: string;
  filePath: string; // Local file path
  mimeType: string;
  size: number;
  lastModified: number;
}

const AUDIO_STORAGE_KEY = "music-app-audio-files";

export class AudioFileStorage {
  private static instance: AudioFileStorage;
  private audioFiles: Map<string, StoredAudioFile> = new Map();
  private fileObjects: Map<string, File> = new Map(); // Keep original File objects in memory
  private blobUrls: Map<string, string> = new Map(); // Cache blob URLs to avoid recreating
  private fileCache: Map<string, File> = new Map(); // Cache files by path for faster access
  private localFS: LocalFileSystem;

  static getInstance(): AudioFileStorage {
    if (!AudioFileStorage.instance) {
      AudioFileStorage.instance = new AudioFileStorage();
      AudioFileStorage.instance.loadFromStorage();
    }
    return AudioFileStorage.instance;
  }

  constructor() {
    this.localFS = LocalFileSystem.getInstance();
  }

  // Store file using local file system (100% offline)
  async storeAudioFile(trackId: string, file: File, track?: Track, songTitle?: string): Promise<void> {
    try {
      console.log(`Storing audio file locally: ${file.name}, size: ${file.size} bytes`);
      
      if (!track) {
        throw new Error('Track information required for local storage');
      }

      // Store file in local file system
      const success = await this.localFS.addAudioFile(track.songId, trackId, track.name, file);
      
      if (!success) {
        throw new Error('Failed to save file to local file system');
      }

      // Keep file object in memory cache for immediate access
      this.fileObjects.set(trackId, file);
      
      // Create metadata entry for compatibility
      const storedFile: StoredAudioFile = {
        id: trackId,
        name: file.name,
        filePath: `local://${track.songId}/${trackId}`,
        mimeType: file.type,
        size: file.size,
        lastModified: file.lastModified || Date.now()
      };

      this.audioFiles.set(trackId, storedFile);
      
      console.log(`Successfully stored audio file locally for track: ${track.name} (${Math.round(file.size / 1024)}KB)`);
    } catch (error) {
      console.error('Failed to store audio file:', error);
      throw error;
    }
  }

  // Get audio file as blob URL using local file system
  async getAudioUrl(trackId: string): Promise<string | null> {
    // Return cached blob URL if available
    if (this.blobUrls.has(trackId)) {
      return this.blobUrls.get(trackId)!;
    }

    // Try to get from in-memory cache first
    let fileObject = this.fileObjects.get(trackId);
    
    // If not in memory, load from local file system
    if (!fileObject) {
      console.log(`Loading file from local file system for track: ${trackId}`);
      
      try {
        fileObject = await this.localFS.getAudioFile(trackId) || undefined;
        
        if (fileObject) {
          console.log(`Successfully loaded file: ${fileObject.name} from local storage`);
          this.fileObjects.set(trackId, fileObject);
        } else {
          console.warn(`Audio file not found in local storage for track: ${trackId}`);
          return null;
        }
      } catch (error) {
        console.error(`Error loading file from local storage for track ${trackId}:`, error);
        return null;
      }
    }

    try {
      const url = URL.createObjectURL(fileObject);
      this.blobUrls.set(trackId, url); // Cache the blob URL
      console.log(`Created audio URL for track: ${trackId}`);
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

  // Load audio file path references from localStorage
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(AUDIO_STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        this.audioFiles = new Map(data);
        console.log(`Loaded ${this.audioFiles.size} audio file path references from localStorage`);
        
        // Display which files we're looking for
        this.displayExpectedFiles();
      } else {
        console.log('No stored audio file references found');
      }
    } catch (error) {
      console.error('Failed to load audio file references from storage:', error);
      this.audioFiles = new Map();
    }
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
  storeTrackReference(trackId: string, fileInfo: { name: string; filePath: string; mimeType: string; size: number; lastModified: number }): void {
    const storedFile: StoredAudioFile = {
      id: trackId,
      name: fileInfo.name,
      filePath: fileInfo.filePath,
      mimeType: fileInfo.mimeType,
      size: fileInfo.size,
      lastModified: fileInfo.lastModified
    };

    this.audioFiles.set(trackId, storedFile);
    this.saveToStorage();
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

  // Save audio file path references to localStorage
  private saveToStorage(): void {
    try {
      const data = Array.from(this.audioFiles.entries());
      const jsonData = JSON.stringify(data);
      localStorage.setItem(AUDIO_STORAGE_KEY, jsonData);
      console.log(`Saved ${data.length} audio file path references to localStorage (${Math.round(jsonData.length / 1024)}KB)`);
    } catch (error) {
      console.error('Failed to save audio file references:', error);
    }
  }

  // Clear all audio files
  clearAll(): void {
    // Clean up all blob URLs
    const urls = Array.from(this.blobUrls.values());
    for (const blobUrl of urls) {
      URL.revokeObjectURL(blobUrl);
    }
    
    this.audioFiles.clear();
    this.fileObjects.clear();
    this.blobUrls.clear();
    this.fileCache.clear();
    localStorage.removeItem(AUDIO_STORAGE_KEY);
    console.log('Cleared all audio file references and cache');
  }
}

export const audioStorage = AudioFileStorage.getInstance();