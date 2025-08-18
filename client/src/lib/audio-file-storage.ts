import type { Track } from "@shared/schema";

interface StoredAudioFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  data: string; // Base64 encoded audio data for persistence
}

const AUDIO_STORAGE_KEY = "music-app-audio-files";

export class AudioFileStorage {
  private static instance: AudioFileStorage;
  private audioFiles: Map<string, StoredAudioFile> = new Map();
  private fileObjects: Map<string, File> = new Map(); // Keep original File objects in memory
  private blobUrls: Map<string, string> = new Map(); // Cache blob URLs to avoid recreating

  static getInstance(): AudioFileStorage {
    if (!AudioFileStorage.instance) {
      AudioFileStorage.instance = new AudioFileStorage();
      AudioFileStorage.instance.loadFromStorage();
    }
    return AudioFileStorage.instance;
  }

  // Store complete audio file data for persistence
  async storeAudioFile(trackId: string, file: File): Promise<void> {
    try {
      console.log(`Storing complete audio file: ${file.name}, size: ${file.size} bytes`);
      
      // Convert file to base64 for localStorage persistence
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      const base64Data = btoa(String.fromCharCode.apply(null, Array.from(bytes)));
      
      const storedFile: StoredAudioFile = {
        id: trackId,
        name: file.name,
        mimeType: file.type,
        size: file.size,
        data: base64Data
      };

      // Keep the actual file object in memory for immediate access
      this.fileObjects.set(trackId, file);
      this.audioFiles.set(trackId, storedFile);
      
      // Save to localStorage with complete data
      this.saveToStorage();
      
      console.log(`Successfully stored complete audio file for track: ${trackId} (${Math.round(file.size / 1024)}KB)`);
    } catch (error) {
      console.error('Failed to store audio file:', error);
      throw error;
    }
  }

  // Get audio file as blob URL, restore from storage if needed
  getAudioUrl(trackId: string): string | null {
    // Return cached blob URL if available
    if (this.blobUrls.has(trackId)) {
      return this.blobUrls.get(trackId)!;
    }

    // Try to get from in-memory file objects first
    let fileObject = this.fileObjects.get(trackId);
    
    // If not in memory, try to restore from stored data
    if (!fileObject) {
      const storedFile = this.audioFiles.get(trackId);
      if (storedFile && storedFile.data) {
        console.log(`Restoring audio file from storage: ${storedFile.name}`);
        const restoredFile = this.restoreFileFromStorage(storedFile);
        if (restoredFile) {
          this.fileObjects.set(trackId, restoredFile);
          fileObject = restoredFile;
        }
      }
    }

    if (!fileObject) {
      const storedFile = this.audioFiles.get(trackId);
      if (storedFile) {
        console.warn(`Could not restore audio file for track ${storedFile.name}. File may need to be re-added.`);
      } else {
        console.warn(`No audio file found for track: ${trackId}`);
      }
      return null;
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
    const fileObject = this.fileObjects.get(trackId);
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

  // Load complete audio files from localStorage
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(AUDIO_STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        this.audioFiles = new Map(data);
        console.log(`Loaded ${this.audioFiles.size} complete audio files from localStorage`);
        
        // Automatically restore all files to memory for immediate access
        this.restoreAllFilesToMemory();
      } else {
        console.log('No stored audio files found');
      }
    } catch (error) {
      console.error('Failed to load audio files from storage:', error);
      this.audioFiles = new Map();
    }
  }

  // Restore a single file from base64 storage data
  private restoreFileFromStorage(storedFile: StoredAudioFile): File | null {
    try {
      // Convert base64 back to binary
      const binaryString = atob(storedFile.data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // Create new File object
      const file = new File([bytes], storedFile.name, {
        type: storedFile.mimeType
      });
      
      return file;
    } catch (error) {
      console.error(`Failed to restore file ${storedFile.name}:`, error);
      return null;
    }
  }

  // Restore all stored files to memory on app startup
  private restoreAllFilesToMemory(): void {
    let restoredCount = 0;
    const entries = Array.from(this.audioFiles.entries());
    for (const [trackId, storedFile] of entries) {
      if (storedFile.data && !this.fileObjects.has(trackId)) {
        const file = this.restoreFileFromStorage(storedFile);
        if (file) {
          this.fileObjects.set(trackId, file);
          restoredCount++;
        }
      }
    }
    if (restoredCount > 0) {
      console.log(`Restored ${restoredCount} audio files to memory for immediate access`);
    }
  }

  // Save complete audio files to localStorage
  private saveToStorage(): void {
    try {
      const data = Array.from(this.audioFiles.entries());
      const jsonData = JSON.stringify(data);
      localStorage.setItem(AUDIO_STORAGE_KEY, jsonData);
      console.log(`Saved ${data.length} complete audio files to localStorage (${Math.round(jsonData.length / 1024 / 1024)}MB)`);
    } catch (error) {
      console.error('Failed to save audio files:', error);
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        console.error('localStorage quota exceeded. Consider clearing some audio files.');
      }
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
    localStorage.removeItem(AUDIO_STORAGE_KEY);
    console.log('Cleared all audio files');
  }
}

export const audioStorage = AudioFileStorage.getInstance();