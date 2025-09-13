/**
 * Simplified StorageOrchestrator - Essential backup coordination
 * Coordinates between browser storage and local folder backup
 */

import { LocalSongStorage } from './local-song-storage';
import { BrowserFileSystem } from './browser-file-system';
import { LocalDiskFileSystem } from './local-disk-file-system';

interface AutoSaveStatus {
  isEnabled: boolean;
  lastSaveTime: number | null;
  lastSaveStatus: 'success' | 'error' | 'pending' | null;
  lastError: string | null;
}

interface StorageStats {
  totalSongs: number;
  totalTracks: number;
  lastBackupTime: number | null;
  backupFolderName: string;
  diskSpaceUsed: number;
}

export class StorageOrchestrator {
  private static instance: StorageOrchestrator | null = null;
  private localDisk: LocalDiskFileSystem;
  private browserFS: BrowserFileSystem;
  private autoSaveStatus: AutoSaveStatus;
  private autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly DEBOUNCE_DELAY = 5000; // 5 seconds

  private constructor() {
    this.localDisk = LocalDiskFileSystem.getInstance();
    this.browserFS = BrowserFileSystem.getInstance();
    this.autoSaveStatus = {
      isEnabled: false,
      lastSaveTime: null,
      lastSaveStatus: null,
      lastError: null
    };
  }

  static getInstance(): StorageOrchestrator {
    if (!StorageOrchestrator.instance) {
      StorageOrchestrator.instance = new StorageOrchestrator();
    }
    return StorageOrchestrator.instance;
  }

  /**
   * Initialize the storage orchestrator (silently check for existing folder)
   */
  async initialize(): Promise<boolean> {
    console.log('🔄 Initializing StorageOrchestrator...');

    // Check if local disk backup is supported
    if (!LocalDiskFileSystem.isSupported()) {
      console.log('⚠️ Local disk backup not supported in this browser');
      return false;
    }

    // Try to restore previous directory access without requesting permissions
    const hasPermission = await this.localDisk.silentVerifyPermission();
    
    if (hasPermission) {
      // Ensure folder structure exists
      await this.localDisk.createFolderStructure();
      this.autoSaveStatus.isEnabled = true;
      
      console.log('✅ StorageOrchestrator initialized with existing folder');
      
      // Start auto-save monitoring
      this.startAutoSaveMonitoring();
      
      return true;
    }

    console.log('ℹ️ StorageOrchestrator initialized without folder access');
    return false;
  }

  /**
   * Request user to set up local folder backup
   */
  async setupLocalFolderBackup(): Promise<boolean> {
    console.log('📁 Setting up local folder backup...');

    const permission = await this.localDisk.requestDirectoryAccess();
    
    if (permission.granted) {
      // Create folder structure
      const structureCreated = await this.localDisk.createFolderStructure();
      
      if (structureCreated) {
        this.autoSaveStatus.isEnabled = true;
        
        // Start auto-save monitoring
        this.startAutoSaveMonitoring();
        
        console.log('✅ Local folder backup setup complete');
        return true;
      }
    }

    console.log('❌ Failed to setup local folder backup:', permission.error);
    return false;
  }

  /**
   * Mark song data as dirty for auto-save
   */
  markSongDirty(songId: string): void {
    if (this.autoSaveStatus.isEnabled) {
      this.debouncedAutoSave();
    }
  }

  /**
   * Mark waveform data as dirty for auto-save
   */
  markWaveformDirty(songId: string): void {
    if (this.autoSaveStatus.isEnabled) {
      this.debouncedAutoSave();
    }
  }

  /**
   * Mark audio file as dirty for auto-save
   */
  markAudioDirty(trackId: string): void {
    if (this.autoSaveStatus.isEnabled) {
      this.debouncedAutoSave();
    }
  }

  /**
   * Perform immediate backup of all data
   */
  async performFullBackup(userEmail: string): Promise<boolean> {
    if (!this.autoSaveStatus.isEnabled) {
      console.log('⚠️ Auto-save not enabled, skipping backup');
      return false;
    }

    console.log('🔄 Performing full backup...');
    this.autoSaveStatus.lastSaveStatus = 'pending';

    try {
      const songs = LocalSongStorage.getAllSongs(userEmail);
      let savedSongs = 0;
      let savedTracks = 0;

      // Save all songs
      for (const song of songs) {
        const songData = {
          id: song.id,
          title: song.title,
          artist: song.artist || 'Unknown',
          key: song.key,
          bpm: song.bpm,
          duration: song.duration,
          lyrics: song.lyrics,
          createdAt: song.createdAt,
          trackCount: song.tracks.length
        };
        
        const songSaved = await this.localDisk.writeSongData(song.id, songData);
        if (songSaved) savedSongs++;

        // Save audio tracks
        for (const track of song.tracks) {
          try {
            const audioUrl = await this.browserFS.getAudioUrl(track.id);
            if (audioUrl) {
              const response = await fetch(audioUrl);
              const audioBlob = await response.blob();
              
              // Determine file extension
              let extension = '.mp3';
              if (audioBlob.type.includes('wav')) extension = '.wav';
              else if (audioBlob.type.includes('m4a')) extension = '.m4a';
              else if (audioBlob.type.includes('ogg')) extension = '.ogg';
              
              const filename = `${track.id}_${track.name.replace(/[^a-zA-Z0-9]/g, '_')}${extension}`;
              const trackSaved = await this.localDisk.writeAudioFile(track.id, audioBlob, filename);
              if (trackSaved) savedTracks++;
            }
          } catch (error) {
            console.error(`❌ Failed to backup track ${track.id}:`, error);
          }
        }
      }

      // Update manifest
      const manifest = {
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        appVersion: 'StageTracker Pro v1.0',
        songCount: savedSongs,
        trackCount: savedTracks,
        userEmail: userEmail,
        autoSaveEnabled: true
      };

      await this.localDisk.writeManifest(manifest);

      this.autoSaveStatus.lastSaveTime = Date.now();
      this.autoSaveStatus.lastSaveStatus = 'success';
      this.autoSaveStatus.lastError = null;

      console.log(`✅ Full backup complete: ${savedSongs} songs, ${savedTracks} tracks`);
      return true;

    } catch (error) {
      console.error('❌ Full backup failed:', error);
      this.autoSaveStatus.lastSaveStatus = 'error';
      this.autoSaveStatus.lastError = error instanceof Error ? error.message : 'Unknown error';
      return false;
    }
  }

  /**
   * Get current auto-save status
   */
  getAutoSaveStatus(): AutoSaveStatus {
    return { ...this.autoSaveStatus };
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(userEmail: string): Promise<StorageStats> {
    const songs = LocalSongStorage.getAllSongs(userEmail);
    const totalTracks = songs.reduce((sum, song) => sum + song.tracks.length, 0);
    
    return {
      totalSongs: songs.length,
      totalTracks: totalTracks,
      lastBackupTime: this.autoSaveStatus.lastSaveTime,
      backupFolderName: this.localDisk.getDirectoryName(),
      diskSpaceUsed: 0 // Simple version doesn't calculate disk usage
    };
  }

  /**
   * Disable auto-save and clean up
   */
  disableAutoSave(): void {
    this.autoSaveStatus.isEnabled = false;
    this.stopAutoSaveMonitoring();
    console.log('🔄 Auto-save disabled');
  }

  /**
   * Enable auto-save monitoring (for when user re-enables)
   */
  enableAutoSave(): void {
    if (this.localDisk.getStatus().hasDirectory) {
      this.autoSaveStatus.isEnabled = true;
      this.startAutoSaveMonitoring();
      console.log('✅ Auto-save enabled');
    }
  }

  /**
   * Restore data from local folder with email validation
   */
  async restoreFromLocalFolder(userEmail: string): Promise<{success: boolean, restored: number, errors: string[]}> {
    if (!this.autoSaveStatus.isEnabled) {
      return {
        success: false,
        restored: 0,
        errors: ['No backup folder selected. Please set up local backup first.']
      };
    }

    console.log('🔄 Starting restore from local folder...');
    const errors: string[] = [];

    try {
      // Step 1: Read and validate manifest
      console.log('📋 Reading backup manifest...');
      const manifest = await this.localDisk.readManifest();
      
      if (!manifest) {
        return {
          success: false,
          restored: 0,
          errors: ['No backup manifest found. The selected folder may not contain a valid StageTracker backup.']
        };
      }

      // Step 2: Validate backup email against current user
      console.log('🔐 Validating backup ownership...');
      if (!manifest.userEmail) {
        return {
          success: false,
          restored: 0,
          errors: ['Invalid backup: Missing user information. This backup may be corrupted.']
        };
      }

      if (manifest.userEmail !== userEmail) {
        return {
          success: false,
          restored: 0,
          errors: [
            `⛔ Access Denied: This backup belongs to "${manifest.userEmail}".`,
            `You are logged in as "${userEmail}".`,
            '',
            '🔒 This security measure prevents trial abuse and protects user data.',
            '💡 To use this backup, please log in with the original email address.',
            '',
            '📧 Need help? Contact support if you need to transfer backups between accounts.'
          ]
        };
      }

      // Step 3: Get list of songs to restore
      console.log('📂 Scanning backup folder...');
      const songIds = await this.localDisk.listSongFiles();
      
      if (songIds.length === 0) {
        return {
          success: false,
          restored: 0,
          errors: ['No songs found in backup folder.']
        };
      }

      console.log(`📦 Found ${songIds.length} songs to restore`);
      let restoredCount = 0;

      // Step 4: Restore each song
      for (const songId of songIds) {
        try {
          console.log(`🔄 Restoring song: ${songId}`);
          
          // Read song data from backup
          const songData = await this.localDisk.readSongData(songId);
          if (!songData) {
            errors.push(`Failed to read song data: ${songId}`);
            continue;
          }

          // Create song in local storage
          const song = {
            id: songData.id,
            title: songData.title || 'Untitled',
            artist: songData.artist || 'Unknown',
            key: songData.key || 'C',
            bpm: songData.bpm || 120,
            duration: songData.duration || 0,
            lyrics: songData.lyrics || '',
            createdAt: songData.createdAt || Date.now(),
            tracks: []
          };

          // Check if song already exists to avoid duplicates
          const existingSongs = LocalSongStorage.getAllSongs(userEmail);
          const existingIndex = existingSongs.findIndex(s => s.id === song.id);
          
          if (existingIndex >= 0) {
            // Update existing song
            LocalSongStorage.updateSong(userEmail, song.id, song);
          } else {
            // Add new song - use addSong method but first construct the song object properly
            const newSong = LocalSongStorage.addSong(userEmail, {
              title: song.title,
              artist: song.artist,
              key: song.key,
              bpm: song.bpm,
              duration: song.duration,
              lyrics: song.lyrics,
              waveformData: [] // Empty waveform data for restored songs
            });
            console.log(`✅ Added new song: ${newSong.title}`);
          }
          
          restoredCount++;
          
          console.log(`✅ Restored song: ${song.title}`);
          
        } catch (error) {
          console.error(`❌ Failed to restore song ${songId}:`, error);
          errors.push(`Failed to restore song: ${songId}`);
        }
      }

      // Step 5: Return results
      if (restoredCount > 0) {
        console.log(`✅ Restore complete: ${restoredCount} songs restored`);
        return {
          success: true,
          restored: restoredCount,
          errors: errors.length > 0 ? [
            `Successfully restored ${restoredCount} songs.`,
            '',
            '⚠️ Audio tracks not restored automatically.',
            '💡 Please re-add your audio files to the restored songs.',
            '',
            ...errors
          ] : []
        };
      } else {
        return {
          success: false,
          restored: 0,
          errors: ['Failed to restore any songs.', ...errors]
        };
      }

    } catch (error) {
      console.error('❌ Restore failed:', error);
      return {
        success: false,
        restored: 0,
        errors: [`Restore failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Debounced auto-save to prevent excessive disk writes
   */
  private debouncedAutoSave(): void {
    if (!this.autoSaveStatus.isEnabled) return;

    // Clear existing timer
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
    }

    // Set new timer
    this.autoSaveTimer = setTimeout(async () => {
      const userEmail = localStorage.getItem('userEmail');
      if (userEmail) {
        await this.performFullBackup(userEmail);
      }
    }, this.DEBOUNCE_DELAY);
  }

  /**
   * Start monitoring for auto-save triggers
   */
  private startAutoSaveMonitoring(): void {
    console.log('🔄 Starting auto-save monitoring...');
    // Monitoring will be triggered by explicit markDirty calls from other components
  }

  /**
   * Stop auto-save monitoring
   */
  private stopAutoSaveMonitoring(): void {
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
    console.log('🔄 Stopped auto-save monitoring');
  }
}

export default StorageOrchestrator;