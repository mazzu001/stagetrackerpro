import type { Track } from "@shared/schema";

interface StoredAudioFile {
  id: string;
  name: string;
  mimeType: string;
  filePath: string; // Store file path instead of data
  size: number;
}

const AUDIO_STORAGE_KEY = "music-app-audio-files";

export class AudioFileStorage {
  private static instance: AudioFileStorage;
  private audioFiles: Map<string, StoredAudioFile> = new Map();
  private fileObjects: Map<string, File> = new Map(); // Keep original File objects in memory

  static getInstance(): AudioFileStorage {
    if (!AudioFileStorage.instance) {
      AudioFileStorage.instance = new AudioFileStorage();
      AudioFileStorage.instance.loadFromStorage();
    }
    return AudioFileStorage.instance;
  }

  // Store audio file reference (not the data)
  async storeAudioFile(trackId: string, file: File): Promise<void> {
    try {
      console.log(`Storing file reference for: ${file.name}, size: ${file.size} bytes`);
      
      const storedFile: StoredAudioFile = {
        id: trackId,
        name: file.name,
        mimeType: file.type,
        filePath: file.name, // Store file name as reference
        size: file.size
      };

      // Keep the actual file object in memory for immediate access
      this.fileObjects.set(trackId, file);
      this.audioFiles.set(trackId, storedFile);
      
      // Only save lightweight metadata to localStorage
      this.saveToStorage();
      
      console.log(`Successfully stored file reference for track: ${trackId} (${Math.round(file.size / 1024)}KB)`);
    } catch (error) {
      console.error('Failed to store audio file reference:', error);
      throw error;
    }
  }

  // Get audio file as blob URL from memory
  getAudioUrl(trackId: string): string | null {
    const fileObject = this.fileObjects.get(trackId);
    if (!fileObject) {
      const storedFile = this.audioFiles.get(trackId);
      if (storedFile) {
        console.warn(`No file data available for track ${storedFile.name}. Please re-add the audio file.`);
      } else {
        console.warn(`No audio file found for track: ${trackId}`);
      }
      return null;
    }

    try {
      const url = URL.createObjectURL(fileObject);
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

  // Load audio file metadata from localStorage (not the actual files)
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(AUDIO_STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        this.audioFiles = new Map(data);
        console.log(`Loaded ${this.audioFiles.size} audio file references from localStorage`);
      } else {
        console.log('No stored audio files found');
      }
    } catch (error) {
      console.error('Failed to load audio files from storage:', error);
      this.audioFiles = new Map();
    }
  }

  // Save only metadata to localStorage (much faster and smaller)
  private saveToStorage(): void {
    try {
      const data = Array.from(this.audioFiles.entries());
      const jsonData = JSON.stringify(data);
      localStorage.setItem(AUDIO_STORAGE_KEY, jsonData);
      console.log(`Saved ${data.length} audio file references to localStorage (${Math.round(jsonData.length / 1024)}KB)`);
    } catch (error) {
      console.error('Failed to save audio file references:', error);
    }
  }

  // Clear all audio files
  clearAll(): void {
    this.audioFiles.clear();
    this.fileObjects.clear();
    localStorage.removeItem(AUDIO_STORAGE_KEY);
    console.log('Cleared all audio files');
  }
}

export const audioStorage = AudioFileStorage.getInstance();