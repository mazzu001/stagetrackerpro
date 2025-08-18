import type { Song, Track, MidiEvent } from "@shared/schema";

interface PersistedData {
  songs: Song[];
  tracks: Track[];
  midiEvents: MidiEvent[];
  blobUrls: Record<string, string>; // Map track IDs to blob URLs
  lastSaved: string;
}

const STORAGE_KEY = "music-performance-app-data";

export class StoragePersistence {
  private static instance: StoragePersistence;
  private blobUrlMap: Map<string, string> = new Map();

  static getInstance(): StoragePersistence {
    if (!StoragePersistence.instance) {
      StoragePersistence.instance = new StoragePersistence();
    }
    return StoragePersistence.instance;
  }

  // Store blob URL for a track
  storeBlobUrl(trackId: string, blobUrl: string): void {
    this.blobUrlMap.set(trackId, blobUrl);
  }

  // Get blob URL for a track
  getBlobUrl(trackId: string): string | undefined {
    return this.blobUrlMap.get(trackId);
  }

  // Save all data to localStorage
  saveData(songs: Song[], tracks: Track[], midiEvents: MidiEvent[]): void {
    try {
      const blobUrls: Record<string, string> = {};
      this.blobUrlMap.forEach((blobUrl, trackId) => {
        blobUrls[trackId] = blobUrl;
      });

      const data: PersistedData = {
        songs,
        tracks,
        midiEvents,
        blobUrls,
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
      
      // Restore blob URLs
      this.blobUrlMap.clear();
      Object.entries(data.blobUrls).forEach(([trackId, blobUrl]) => {
        this.blobUrlMap.set(trackId, blobUrl);
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