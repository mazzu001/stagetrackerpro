/**
 * Simplified LocalDiskFileSystem - Essential local folder backup functionality
 * Focuses on core backup operations that actually work
 */

// Extend FileSystemDirectoryHandle with experimental methods
interface ExtendedFileSystemDirectoryHandle extends FileSystemDirectoryHandle {
  queryPermission(descriptor?: FileSystemPermissionDescriptor): Promise<PermissionState>;
  requestPermission(descriptor?: FileSystemPermissionDescriptor): Promise<PermissionState>;
  entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
}

interface FileSystemPermissionDescriptor {
  mode?: 'read' | 'readwrite';
}

export interface LocalDiskPermissionStatus {
  granted: boolean;
  handle: FileSystemDirectoryHandle | null;
  error?: string;
}

export class LocalDiskFileSystem {
  private static instance: LocalDiskFileSystem | null = null;
  private directoryHandle: ExtendedFileSystemDirectoryHandle | null = null;
  private isInitialized = false;

  static getInstance(): LocalDiskFileSystem {
    if (!LocalDiskFileSystem.instance) {
      LocalDiskFileSystem.instance = new LocalDiskFileSystem();
    }
    return LocalDiskFileSystem.instance;
  }

  /**
   * Check if File System Access API is supported
   */
  static isSupported(): boolean {
    return typeof window !== 'undefined' && 
           'showDirectoryPicker' in window && 
           typeof window.showDirectoryPicker === 'function';
  }

  /**
   * Request user to select a directory for backup storage
   */
  async requestDirectoryAccess(): Promise<LocalDiskPermissionStatus> {
    if (!LocalDiskFileSystem.isSupported()) {
      return {
        granted: false,
        handle: null,
        error: 'File System Access API not supported in this browser'
      };
    }

    try {
      // Request directory picker
      const handle = await window.showDirectoryPicker({
        mode: 'readwrite',
        startIn: 'documents'
      }) as unknown as ExtendedFileSystemDirectoryHandle;

      // Store handle for future use
      this.directoryHandle = handle;
      this.isInitialized = true;

      // Persist directory handle in IndexedDB for future sessions
      await this.persistDirectoryHandle(handle);

      return {
        granted: true,
        handle: handle
      };
    } catch (error) {
      console.error('❌ Failed to get directory access:', error);
      return {
        granted: false,
        handle: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Silently verify permissions without requesting them (safe for initialization)
   */
  async silentVerifyPermission(): Promise<boolean> {
    if (!this.directoryHandle) {
      // Try to restore from IndexedDB
      const restored = await this.restoreDirectoryHandle();
      if (!restored) return false;
    }

    try {
      const permission = await this.directoryHandle!.queryPermission({ mode: 'readwrite' });
      return permission === 'granted';
    } catch (error) {
      console.error('❌ Silent permission check failed:', error);
      return false;
    }
  }

  /**
   * Verify we still have permission to write to the stored directory
   */
  async verifyPermission(): Promise<boolean> {
    if (!this.directoryHandle) {
      const restored = await this.restoreDirectoryHandle();
      if (!restored) return false;
    }

    try {
      const permission = await this.directoryHandle!.queryPermission({ mode: 'readwrite' });
      if (permission === 'granted') {
        return true;
      }

      // Try to request permission again
      const newPermission = await this.directoryHandle!.requestPermission({ mode: 'readwrite' });
      return newPermission === 'granted';
    } catch (error) {
      console.error('❌ Permission verification failed:', error);
      return false;
    }
  }

  /**
   * Create the backup folder structure in the chosen directory
   */
  async createFolderStructure(): Promise<boolean> {
    if (!this.directoryHandle || !await this.verifyPermission()) {
      return false;
    }

    try {
      // Create main backup folder structure
      await this.directoryHandle.getDirectoryHandle('StageTracker-Backup', { create: true });
      const backupFolder = await this.directoryHandle.getDirectoryHandle('StageTracker-Backup');
      
      await backupFolder.getDirectoryHandle('songs', { create: true });
      await backupFolder.getDirectoryHandle('audio', { create: true });
      
      console.log('✅ Created backup folder structure');
      return true;
    } catch (error) {
      console.error('❌ Failed to create folder structure:', error);
      return false;
    }
  }

  /**
   * Write song metadata to local folder
   */
  async writeSongData(songId: string, songData: any): Promise<boolean> {
    if (!await this.verifyPermission()) {
      return false;
    }

    try {
      const backupFolder = await this.directoryHandle!.getDirectoryHandle('StageTracker-Backup');
      const songsFolder = await backupFolder.getDirectoryHandle('songs');
      const fileHandle = await songsFolder.getFileHandle(`${songId}.json`, { create: true });
      const writable = await fileHandle.createWritable();
      
      await writable.write(JSON.stringify(songData, null, 2));
      await writable.close();
      
      console.log(`✅ Saved song data: ${songData.title || songId}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to write song data:', error);
      return false;
    }
  }

  /**
   * Write audio file to local folder
   */
  async writeAudioFile(trackId: string, audioBlob: Blob, filename: string): Promise<boolean> {
    if (!await this.verifyPermission()) {
      return false;
    }

    try {
      const backupFolder = await this.directoryHandle!.getDirectoryHandle('StageTracker-Backup');
      const audioFolder = await backupFolder.getDirectoryHandle('audio');
      const fileHandle = await audioFolder.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      
      await writable.write(audioBlob);
      await writable.close();
      
      console.log(`✅ Saved audio file: ${filename}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to write audio file:', error);
      return false;
    }
  }

  /**
   * Write manifest file with backup metadata
   */
  async writeManifest(manifest: any): Promise<boolean> {
    if (!await this.verifyPermission()) {
      return false;
    }

    try {
      const backupFolder = await this.directoryHandle!.getDirectoryHandle('StageTracker-Backup');
      const fileHandle = await backupFolder.getFileHandle('manifest.json', { create: true });
      const writable = await fileHandle.createWritable();
      
      await writable.write(JSON.stringify(manifest, null, 2));
      await writable.close();
      
      console.log('✅ Updated backup manifest');
      return true;
    } catch (error) {
      console.error('❌ Failed to write manifest:', error);
      return false;
    }
  }

  /**
   * Get current directory name for display
   */
  getDirectoryName(): string {
    return this.directoryHandle?.name || 'No folder selected';
  }

  /**
   * Get backup status information
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      hasDirectory: !!this.directoryHandle,
      directoryName: this.getDirectoryName(),
      isSupported: LocalDiskFileSystem.isSupported()
    };
  }

  /**
   * Persist directory handle to IndexedDB for future sessions
   */
  private async persistDirectoryHandle(handle: ExtendedFileSystemDirectoryHandle): Promise<void> {
    try {
      const dbName = 'StageTrackerBackup';
      const request = indexedDB.open(dbName, 1);
      
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('directories')) {
          db.createObjectStore('directories');
        }
      };
      
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['directories'], 'readwrite');
        const store = transaction.objectStore('directories');
        store.put(handle, 'backup-directory');
        
        transaction.oncomplete = () => {
          console.log('✅ Directory handle persisted');
        };
      };
    } catch (error) {
      console.error('❌ Failed to persist directory handle:', error);
    }
  }

  /**
   * Restore directory handle from IndexedDB
   */
  private async restoreDirectoryHandle(): Promise<boolean> {
    try {
      const dbName = 'StageTrackerBackup';
      const request = indexedDB.open(dbName, 1);
      
      return new Promise((resolve) => {
        request.onsuccess = async () => {
          try {
            const db = request.result;
            if (!db.objectStoreNames.contains('directories')) {
              resolve(false);
              return;
            }
            
            const transaction = db.transaction(['directories'], 'readonly');
            const store = transaction.objectStore('directories');
            const getRequest = store.get('backup-directory');
            
            getRequest.onsuccess = async () => {
              if (getRequest.result) {
                this.directoryHandle = getRequest.result as ExtendedFileSystemDirectoryHandle;
                this.isInitialized = true;
                console.log('🔄 Restored directory handle');
                resolve(true);
              } else {
                resolve(false);
              }
            };
            
            getRequest.onerror = () => resolve(false);
          } catch (error) {
            resolve(false);
          }
        };
        
        request.onerror = () => resolve(false);
        
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains('directories')) {
            db.createObjectStore('directories');
          }
        };
      });
    } catch (error) {
      console.error('❌ Failed to restore directory handle:', error);
      return false;
    }
  }
}

export default LocalDiskFileSystem;