import type { Track } from "@shared/schema";

interface StoredAudioFile {
  id: string;
  name: string;
  mimeType: string;
  data: string; // base64 encoded audio data
  size: number;
}

const AUDIO_STORAGE_KEY = "music-app-audio-files";

export class AudioFileStorage {
  private static instance: AudioFileStorage;
  private audioFiles: Map<string, StoredAudioFile> = new Map();

  static getInstance(): AudioFileStorage {
    if (!AudioFileStorage.instance) {
      AudioFileStorage.instance = new AudioFileStorage();
      AudioFileStorage.instance.loadFromStorage();
    }
    return AudioFileStorage.instance;
  }

  // Store audio file data
  async storeAudioFile(trackId: string, file: File): Promise<void> {
    try {
      console.log(`Preparing to store audio file for: ${file.name}, size: ${file.size} bytes`);
      const arrayBuffer = await file.arrayBuffer();
      const base64Data = this.arrayBufferToBase64(arrayBuffer);
      
      const storedFile: StoredAudioFile = {
        id: trackId,
        name: file.name,
        mimeType: file.type,
        data: base64Data,
        size: file.size
      };

      this.audioFiles.set(trackId, storedFile);
      console.log(`Added to memory map, now have ${this.audioFiles.size} files`);
      this.saveToStorage();
      
      // Verify it was saved by immediately checking localStorage
      const verification = localStorage.getItem(AUDIO_STORAGE_KEY);
      if (verification) {
        console.log(`Verified: audio data persisted in localStorage (${Math.round(verification.length / 1024)}KB total)`);
      } else {
        console.error('Failed to verify localStorage persistence!');
      }
      
      console.log(`Successfully stored audio file for track: ${trackId} (${Math.round(file.size / 1024)}KB)`);
    } catch (error) {
      console.error('Failed to store audio file:', error);
      throw error;
    }
  }

  // Get audio file as blob URL
  getAudioUrl(trackId: string): string | null {
    const storedFile = this.audioFiles.get(trackId);
    if (!storedFile) {
      console.warn(`No audio file found for track: ${trackId}`);
      return null;
    }

    try {
      const binaryData = this.base64ToArrayBuffer(storedFile.data);
      const blob = new Blob([binaryData], { type: storedFile.mimeType });
      const url = URL.createObjectURL(blob);
      console.log(`Created audio URL for track: ${trackId}`);
      return url;
    } catch (error) {
      console.error(`Failed to create audio URL for track: ${trackId}`, error);
      return null;
    }
  }

  // Check if audio file exists
  hasAudioFile(trackId: string): boolean {
    return this.audioFiles.has(trackId);
  }

  // Remove audio file
  removeAudioFile(trackId: string): void {
    this.audioFiles.delete(trackId);
    this.saveToStorage();
    console.log(`Removed audio file for track: ${trackId}`);
  }

  // Get storage info
  getStorageInfo(): { fileCount: number; totalSizeMB: number } {
    let totalSize = 0;
    this.audioFiles.forEach(file => {
      totalSize += file.size;
    });

    return {
      fileCount: this.audioFiles.size,
      totalSizeMB: Math.round(totalSize / (1024 * 1024) * 100) / 100
    };
  }

  // Convert ArrayBuffer to base64 in chunks to avoid stack overflow
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const uint8Array = new Uint8Array(buffer);
    const chunkSize = 8192;
    let binary = '';
    
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    
    return btoa(binary);
  }

  // Convert base64 to ArrayBuffer
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const uint8Array = new Uint8Array(binaryString.length);
    
    for (let i = 0; i < binaryString.length; i++) {
      uint8Array[i] = binaryString.charCodeAt(i);
    }
    
    return uint8Array.buffer;
  }

  // Save to localStorage
  private saveToStorage(): void {
    try {
      const data = Array.from(this.audioFiles.entries()).map(([id, file]) => [id, file]);
      const jsonData = JSON.stringify(data);
      console.log(`Saving ${this.audioFiles.size} audio files to localStorage (${Math.round(jsonData.length / 1024)}KB)`);
      localStorage.setItem(AUDIO_STORAGE_KEY, jsonData);
      console.log('Successfully saved audio files to localStorage');
    } catch (error) {
      console.error('Failed to save audio files to storage:', error);
      // If localStorage is full, try to clear and save again
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        console.warn('localStorage quota exceeded, clearing other data and retrying...');
        try {
          // Clear our previous audio storage and try again
          localStorage.removeItem(AUDIO_STORAGE_KEY);
          localStorage.setItem(AUDIO_STORAGE_KEY, jsonData);
          console.log('Successfully saved audio files after clearing storage');
        } catch (retryError) {
          console.error('Failed to save even after clearing storage:', retryError);
        }
      }
    }
  }

  // Load from localStorage
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(AUDIO_STORAGE_KEY);
      if (stored) {
        console.log(`Found stored audio data: ${Math.round(stored.length / 1024)}KB`);
        const data = JSON.parse(stored);
        this.audioFiles = new Map(data);
        console.log(`Loaded ${this.audioFiles.size} audio files from storage:`, Array.from(this.audioFiles.keys()));
      } else {
        console.log('No stored audio files found');
      }
    } catch (error) {
      console.error('Failed to load audio files from storage:', error);
      this.audioFiles = new Map();
    }
  }

  // Clear all audio files
  clearAll(): void {
    this.audioFiles.clear();
    localStorage.removeItem(AUDIO_STORAGE_KEY);
    console.log('Cleared all audio files');
  }
}

export const audioStorage = AudioFileStorage.getInstance();