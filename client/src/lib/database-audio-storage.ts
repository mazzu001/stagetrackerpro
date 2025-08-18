// Database-backed audio file storage using blob URLs
export class DatabaseAudioStorage {
  private static instance: DatabaseAudioStorage;
  private blobUrls: Map<string, string> = new Map(); // Cache blob URLs for tracks
  private loadingPromises: Map<string, Promise<string | null>> = new Map(); // Track loading promises

  constructor() {
    // No localStorage needed - everything is in database
  }

  static getInstance(): DatabaseAudioStorage {
    if (!DatabaseAudioStorage.instance) {
      DatabaseAudioStorage.instance = new DatabaseAudioStorage();
    }
    return DatabaseAudioStorage.instance;
  }

  // Get audio URL for a track (from cache or database)
  async getAudioUrl(trackId: string): Promise<string | null> {
    // Check cache first
    if (this.blobUrls.has(trackId)) {
      return this.blobUrls.get(trackId)!;
    }

    // Check if already loading
    if (this.loadingPromises.has(trackId)) {
      return await this.loadingPromises.get(trackId)!;
    }

    // Start loading from database
    const loadPromise = this.loadAudioFromDatabase(trackId);
    this.loadingPromises.set(trackId, loadPromise);
    
    const result = await loadPromise;
    this.loadingPromises.delete(trackId);
    
    return result;
  }

  // Load audio file from database and create blob URL
  private async loadAudioFromDatabase(trackId: string): Promise<string | null> {
    try {
      const response = await fetch(`/api/tracks/${trackId}/audio`);
      
      if (!response.ok) {
        if (response.status === 404) {
          console.log(`No audio file found in database for track: ${trackId}`);
          return null;
        }
        throw new Error(`Failed to load audio: ${response.status}`);
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      
      // Cache the blob URL
      this.blobUrls.set(trackId, blobUrl);
      
      console.log(`Loaded audio from database for track: ${trackId} (${Math.round(blob.size / 1024)}KB)`);
      return blobUrl;
    } catch (error) {
      console.error(`Failed to load audio from database for track ${trackId}:`, error);
      return null;
    }
  }

  // Check if audio file is available for a track
  hasAudioFile(trackId: string): boolean {
    return this.blobUrls.has(trackId);
  }

  // Upload audio file to database
  async uploadAudioFile(trackId: string, file: File): Promise<boolean> {
    try {
      const formData = new FormData();
      formData.append('audio', file);

      const response = await fetch(`/api/tracks/${trackId}/audio`, {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        // Clear cache to force reload
        this.clearCache(trackId);
        console.log(`Uploaded audio file for track: ${trackId} (${Math.round(file.size / 1024)}KB)`);
        return true;
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Upload failed');
      }
    } catch (error) {
      console.error(`Failed to upload audio file for track ${trackId}:`, error);
      return false;
    }
  }

  // Clear cached blob URL for a track
  clearCache(trackId: string): void {
    const existingUrl = this.blobUrls.get(trackId);
    if (existingUrl) {
      URL.revokeObjectURL(existingUrl);
      this.blobUrls.delete(trackId);
    }
    this.loadingPromises.delete(trackId);
  }

  // Clear all cached blob URLs
  clearAllCache(): void {
    for (const url of [...this.blobUrls.values()]) {
      URL.revokeObjectURL(url);
    }
    this.blobUrls.clear();
    this.loadingPromises.clear();
  }

  // Get all tracks that have cached audio files
  getCachedTrackIds(): string[] {
    return [...this.blobUrls.keys()];
  }

  // Pre-load audio files for multiple tracks
  async preloadTracks(trackIds: string[]): Promise<void> {
    const promises = trackIds.map(trackId => this.getAudioUrl(trackId));
    await Promise.all(promises);
    console.log(`Pre-loaded ${trackIds.length} audio files from database`);
  }
}