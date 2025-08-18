import type { Song, Track, MidiEvent } from "@shared/schema";

interface PersistedData {
  songs: Song[];
  tracks: Track[];
  midiEvents: MidiEvent[];
  blobUrls: Record<string, string>; // Map track IDs to blob URLs
  fileData: Record<string, string>; // Map track IDs to base64 file data
  lastSaved: string;
}

const STORAGE_KEY = "music-performance-app-data";

export class StoragePersistence {
  private static instance: StoragePersistence;
  private blobUrlMap: Map<string, string> = new Map();
  private fileDataMap: Map<string, string> = new Map(); // Store base64 file data

  static getInstance(): StoragePersistence {
    if (!StoragePersistence.instance) {
      StoragePersistence.instance = new StoragePersistence();
    }
    return StoragePersistence.instance;
  }

  // Store blob URL and optionally file data for a track
  storeBlobUrl(trackId: string, blobUrl: string, fileData?: ArrayBuffer): void {
    this.blobUrlMap.set(trackId, blobUrl);
    
    // Store file data for persistence across sessions
    if (fileData) {
      try {
        const uint8Array = new Uint8Array(fileData);
        const base64 = btoa(String.fromCharCode.apply(null, Array.from(uint8Array)));
        this.fileDataMap.set(trackId, base64);
      } catch (error) {
        console.warn('Failed to store file data for track:', trackId, error);
      }
    }
  }

  // Get blob URL for a track, recreating if necessary
  getBlobUrl(trackId: string): string | undefined {
    let blobUrl = this.blobUrlMap.get(trackId);
    
    // If blob URL doesn't exist or is invalid, try to recreate from file data
    if (!blobUrl || !this.isBlobUrlValid(blobUrl)) {
      blobUrl = this.recreateBlobUrl(trackId);
      if (blobUrl) {
        this.blobUrlMap.set(trackId, blobUrl);
      }
    }
    
    return blobUrl;
  }

  // Check if a blob URL is still valid
  private isBlobUrlValid(blobUrl: string): boolean {
    try {
      // Simple check - blob URLs should start with 'blob:' and have reasonable length
      return blobUrl.startsWith('blob:') && blobUrl.length > 20;
    } catch {
      return false;
    }
  }

  // Recreate blob URL from stored file data
  private recreateBlobUrl(trackId: string): string | undefined {
    try {
      const base64Data = this.fileDataMap.get(trackId);
      if (!base64Data) {
        return undefined;
      }

      // Convert base64 back to ArrayBuffer
      const binaryString = atob(base64Data);
      const uint8Array = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        uint8Array[i] = binaryString.charCodeAt(i);
      }

      // Create new blob URL
      const blob = new Blob([uint8Array], { type: 'audio/mpeg' });
      const newBlobUrl = URL.createObjectURL(blob);
      
      console.log(`Recreated blob URL for track: ${trackId}`);
      return newBlobUrl;
    } catch (error) {
      console.warn('Failed to recreate blob URL for track:', trackId, error);
      return undefined;
    }
  }

  // Save all data to localStorage
  saveData(songs: Song[], tracks: Track[], midiEvents: MidiEvent[]): void {
    try {
      const blobUrls: Record<string, string> = {};
      const fileData: Record<string, string> = {};
      
      this.blobUrlMap.forEach((blobUrl, trackId) => {
        blobUrls[trackId] = blobUrl;
      });
      
      this.fileDataMap.forEach((data, trackId) => {
        fileData[trackId] = data;
      });

      const data: PersistedData = {
        songs,
        tracks,
        midiEvents,
        blobUrls,
        fileData,
        lastSaved: new Date().toISOString()
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      console.log(`Saved ${songs.length} songs, ${tracks.length} tracks, ${midiEvents.length} MIDI events`);
    } catch (error) {
      console.error("Failed to save data to localStorage:", error);
    }
  }

  // Load all data from localStorage
  loadData(): { songs: Song[]; tracks: Track[]; midiEvents: MidiEvent[] } | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        return null;
      }

      const data: PersistedData = JSON.parse(stored);
      
      // Restore blob URLs and file data
      this.blobUrlMap.clear();
      this.fileDataMap.clear();
      
      Object.entries(data.blobUrls || {}).forEach(([trackId, blobUrl]) => {
        this.blobUrlMap.set(trackId, blobUrl);
      });
      
      Object.entries(data.fileData || {}).forEach(([trackId, fileData]) => {
        this.fileDataMap.set(trackId, fileData);
      });

      console.log(`Loaded ${data.songs.length} songs, ${data.tracks.length} tracks, ${data.midiEvents.length} MIDI events from ${data.lastSaved}`);
      
      return {
        songs: data.songs,
        tracks: data.tracks,
        midiEvents: data.midiEvents
      };
    } catch (error) {
      console.error("Failed to load data from localStorage:", error);
      return null;
    }
  }

  // Clear all stored data
  clearData(): void {
    localStorage.removeItem(STORAGE_KEY);
    this.blobUrlMap.clear();
    console.log("Cleared all stored data");
  }

  // Get storage usage info
  getStorageInfo(): { used: number; available: number; percentage: number } {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const used = stored ? new Blob([stored]).size : 0;
      const available = 5 * 1024 * 1024; // Approximate 5MB localStorage limit
      const percentage = (used / available) * 100;

      return { used, available, percentage };
    } catch {
      return { used: 0, available: 0, percentage: 0 };
    }
  }
}

export const persistence = StoragePersistence.getInstance();