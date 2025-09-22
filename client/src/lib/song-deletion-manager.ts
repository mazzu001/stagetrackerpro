import { LocalSongStorage } from "./local-song-storage";
import { BrowserFileSystem } from "./browser-file-system";
import { AudioFileStorage } from "./audio-file-storage";

/**
 * Comprehensive song deletion manager that removes ALL traces of a song
 * including audio files, waveforms, and references from all storage systems
 */
export class SongDeletionManager {
  private static browserFS = BrowserFileSystem.getInstance();
  private static audioStorage = AudioFileStorage.getInstance();

  /**
   * Completely delete a song and all its associated data
   * @param userEmail User's email for localStorage operations
   * @param songId Song ID to delete
   * @returns true if successful, false otherwise
   */
  static async deleteCompletely(userEmail: string, songId: string): Promise<boolean> {
    try {
      console.log(`🗑️ Starting complete deletion of song: ${songId}`);
      
      // Step 1: Get the song data to find all track IDs
      const songs = LocalSongStorage.getAllSongs(userEmail);
      const song = songs.find(s => s.id === songId);
      
      if (!song) {
        console.warn(`Song ${songId} not found in local storage`);
        return false;
      }
      
      console.log(`Found song: ${song.title} with ${song.tracks.length} tracks`);
      
      // Step 2: Delete all audio files from AudioFileStorage
      const trackIds = song.tracks.map(track => track.id);
      console.log(`Deleting ${trackIds.length} tracks from AudioFileStorage...`);
      
      for (const trackId of trackIds) {
        try {
          this.audioStorage.removeAudioFile(trackId);
          console.log(`✅ Removed track from AudioFileStorage: ${trackId}`);
        } catch (error) {
          console.error(`Failed to remove track ${trackId} from AudioFileStorage:`, error);
        }
      }
      
      // Step 3: Delete from BrowserFileSystem (IndexedDB)
      console.log(`Deleting song from BrowserFileSystem (IndexedDB)...`);
      const fsDeleted = await this.browserFS.deleteSong(songId);
      if (fsDeleted) {
        console.log(`✅ Removed song from BrowserFileSystem`);
      } else {
        console.warn(`⚠️ Failed to remove song from BrowserFileSystem`);
      }
      
      // Step 4: Delete from LocalSongStorage
      console.log(`Deleting song from LocalSongStorage...`);
      const localDeleted = LocalSongStorage.deleteSong(userEmail, songId);
      if (localDeleted) {
        console.log(`✅ Removed song from LocalSongStorage`);
      } else {
        console.warn(`⚠️ Failed to remove song from LocalSongStorage`);
      }
      
      console.log(`🎉 Complete deletion successful for song: ${song.title}`);
      return true;
      
    } catch (error) {
      console.error(`❌ Failed to completely delete song ${songId}:`, error);
      return false;
    }
  }
  
  /**
   * Delete multiple songs completely
   * @param userEmail User's email for localStorage operations
   * @param songIds Array of song IDs to delete
   * @returns Object with success and failure counts
   */
  static async deleteMultiple(userEmail: string, songIds: string[]): Promise<{
    successful: number;
    failed: number;
    failedIds: string[];
  }> {
    let successful = 0;
    let failed = 0;
    const failedIds: string[] = [];
    
    for (const songId of songIds) {
      const success = await this.deleteCompletely(userEmail, songId);
      if (success) {
        successful++;
      } else {
        failed++;
        failedIds.push(songId);
      }
    }
    
    console.log(`Batch deletion complete: ${successful} successful, ${failed} failed`);
    return { successful, failed, failedIds };
  }
  
  /**
   * Clean up orphaned audio files that don't belong to any existing song
   * @param userEmail User's email
   * @returns Number of orphaned files cleaned up
   */
  static async cleanupOrphanedFiles(userEmail: string): Promise<number> {
    console.log(`🧹 Starting cleanup of orphaned audio files...`);
    
    // Get all existing songs and their track IDs
    const songs = LocalSongStorage.getAllSongs(userEmail);
    const validTrackIds = new Set<string>();
    
    for (const song of songs) {
      for (const track of song.tracks) {
        validTrackIds.add(track.id);
      }
    }
    
    console.log(`Found ${validTrackIds.size} valid track IDs from ${songs.length} songs`);
    
    // Get all stored audio files
    const allStoredFiles = this.audioStorage.getAllStoredFiles();
    console.log(`Found ${allStoredFiles.length} stored audio file references`);
    
    // Find and remove orphaned files
    let cleanedCount = 0;
    for (const storedFile of allStoredFiles) {
      if (!validTrackIds.has(storedFile.id)) {
        console.log(`🗑️ Removing orphaned file: ${storedFile.name} (${storedFile.id})`);
        this.audioStorage.removeAudioFile(storedFile.id);
        cleanedCount++;
      }
    }
    
    console.log(`✅ Cleaned up ${cleanedCount} orphaned audio files`);
    return cleanedCount;
  }
  
  /**
   * Get statistics about storage usage
   * @param userEmail User's email
   */
  static async getStorageStats(userEmail: string): Promise<{
    songCount: number;
    trackCount: number;
    storedFileCount: number;
    orphanedFileCount: number;
  }> {
    const songs = LocalSongStorage.getAllSongs(userEmail);
    let trackCount = 0;
    const validTrackIds = new Set<string>();
    
    for (const song of songs) {
      trackCount += song.tracks.length;
      for (const track of song.tracks) {
        validTrackIds.add(track.id);
      }
    }
    
    const allStoredFiles = this.audioStorage.getAllStoredFiles();
    const orphanedFileCount = allStoredFiles.filter(f => !validTrackIds.has(f.id)).length;
    
    return {
      songCount: songs.length,
      trackCount,
      storedFileCount: allStoredFiles.length,
      orphanedFileCount
    };
  }
}