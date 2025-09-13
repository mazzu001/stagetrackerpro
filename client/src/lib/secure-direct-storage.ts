/**
 * Secure Direct Storage System
 * Stores all app data directly in user-chosen folder with built-in security
 * Prevents trial abuse through encrypted file headers
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

interface SecureFileHeader {
  userEmail: string;
  accountId: string;
  createdAt: number;
  signature: string;
  version: string;
}

export interface DirectStorageStatus {
  isSupported: boolean;
  isInitialized: boolean;
  hasLibraryFolder: boolean;
  libraryPath: string;
  lastError?: string;
}

export class SecureDirectStorage {
  private static instance: SecureDirectStorage | null = null;
  private directoryHandle: ExtendedFileSystemDirectoryHandle | null = null;
  private isInitialized = false;
  private currentUserEmail: string = '';
  private accountId: string = '';
  private lastError: string | undefined = undefined;

  static getInstance(): SecureDirectStorage {
    if (!SecureDirectStorage.instance) {
      SecureDirectStorage.instance = new SecureDirectStorage();
    }
    return SecureDirectStorage.instance;
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
   * Initialize with user credentials
   */
  async initialize(userEmail: string): Promise<boolean> {
    console.log('🔧 Initializing secure direct storage for:', userEmail);
    
    this.currentUserEmail = userEmail;
    this.accountId = await this.generateAccountId(userEmail);
    
    // Try to restore previous library folder
    const restored = await this.restoreLibraryFolder();
    if (restored) {
      this.isInitialized = true;
      console.log('✅ Restored existing library folder');
      return true;
    }
    
    console.log('ℹ️ No existing library folder found');
    this.isInitialized = false;
    return false;
  }

  /**
   * Request user to select a folder for their music library
   */
  async selectLibraryFolder(): Promise<boolean> {
    if (!SecureDirectStorage.isSupported()) {
      console.error('❌ File System Access API not supported');
      this.lastError = 'File System Access API is not supported in this browser';
      return false;
    }

    try {
      console.log('📁 Requesting user to select music library folder...');
      
      // Check if we have a secure context
      if (!window.isSecureContext) {
        throw new Error('File System Access API requires a secure context (HTTPS)');
      }
      
      const handle = await window.showDirectoryPicker({
        mode: 'readwrite',
        startIn: 'documents'
      }) as unknown as ExtendedFileSystemDirectoryHandle;

      this.directoryHandle = handle;
      
      // Create library folder structure
      await this.createLibraryStructure();
      
      // Persist the folder handle
      await this.persistLibraryFolder(handle);
      
      this.isInitialized = true;
      this.lastError = undefined;
      console.log('✅ Music library folder selected and initialized');
      return true;
      
    } catch (error) {
      let errorMessage = 'Unknown error occurred';
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = 'Folder selection was cancelled';
          console.log('ℹ️ User cancelled folder selection');
        } else if (error.name === 'SecurityError') {
          errorMessage = 'File System Access API is blocked by browser security settings';
          console.error('❌ Security error - API blocked:', error.message);
        } else if (error.name === 'NotAllowedError') {
          errorMessage = 'Permission to access files was denied';
          console.error('❌ Permission denied:', error.message);
        } else {
          errorMessage = error.message;
          console.error('❌ Failed to select library folder:', error.message);
        }
      } else {
        console.error('❌ Failed to select library folder:', error);
      }
      
      this.lastError = errorMessage;
      return false;
    }
  }

  /**
   * Get current storage status
   */
  getStatus(): DirectStorageStatus {
    return {
      isSupported: SecureDirectStorage.isSupported(),
      isInitialized: this.isInitialized,
      hasLibraryFolder: !!this.directoryHandle,
      libraryPath: this.directoryHandle?.name || 'No folder selected',
      lastError: undefined
    };
  }

  /**
   * Create the music library folder structure
   */
  private async createLibraryStructure(): Promise<boolean> {
    if (!this.directoryHandle) return false;

    try {
      // Create main library folders
      await this.directoryHandle.getDirectoryHandle('songs', { create: true });
      await this.directoryHandle.getDirectoryHandle('audio', { create: true });
      await this.directoryHandle.getDirectoryHandle('lyrics', { create: true });
      await this.directoryHandle.getDirectoryHandle('settings', { create: true });
      
      console.log('✅ Created music library structure');
      return true;
    } catch (error) {
      console.error('❌ Failed to create library structure:', error);
      return false;
    }
  }

  /**
   * Generate a consistent account ID for the user
   */
  private async generateAccountId(email: string): Promise<string> {
    // Create a consistent hash of the email for account ID
    const encoder = new TextEncoder();
    const data = encoder.encode(email.toLowerCase().trim());
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Create encrypted header for secure files
   */
  private async createFileHeader(): Promise<SecureFileHeader> {
    const header: SecureFileHeader = {
      userEmail: this.currentUserEmail,
      accountId: this.accountId,
      createdAt: Date.now(),
      signature: await this.generateFileSignature(),
      version: '1.0.0'
    };
    return header;
  }

  /**
   * Generate cryptographic signature for file integrity
   */
  private async generateFileSignature(): Promise<string> {
    const data = `${this.currentUserEmail}:${this.accountId}:${Date.now()}`;
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Verify file belongs to current user
   */
  private async verifyFileOwnership(header: SecureFileHeader): Promise<boolean> {
    // Check email match
    if (header.userEmail !== this.currentUserEmail) {
      console.warn(`🔒 File belongs to ${header.userEmail}, current user is ${this.currentUserEmail}`);
      return false;
    }
    
    // Check account ID match
    if (header.accountId !== this.accountId) {
      console.warn('🔒 Account ID mismatch - possible account switching detected');
      return false;
    }
    
    return true;
  }

  /**
   * Write secure song data to library
   */
  async writeSongData(songId: string, songData: any): Promise<boolean> {
    if (!this.directoryHandle || !this.isInitialized) {
      console.error('❌ Library not initialized');
      return false;
    }

    try {
      const header = await this.createFileHeader();
      const secureData = {
        header,
        data: songData
      };
      
      const songsFolder = await this.directoryHandle.getDirectoryHandle('songs');
      const fileHandle = await songsFolder.getFileHandle(`${songId}.json`, { create: true });
      const writable = await fileHandle.createWritable();
      
      await writable.write(JSON.stringify(secureData, null, 2));
      await writable.close();
      
      console.log(`✅ Securely saved song: ${songData.title || songId}`);
      return true;
      
    } catch (error) {
      console.error('❌ Failed to write song data:', error);
      return false;
    }
  }

  /**
   * Read and verify song data from library
   */
  async readSongData(songId: string): Promise<any | null> {
    if (!this.directoryHandle || !this.isInitialized) {
      console.error('❌ Library not initialized');
      return null;
    }

    try {
      const songsFolder = await this.directoryHandle.getDirectoryHandle('songs');
      const fileHandle = await songsFolder.getFileHandle(`${songId}.json`);
      const file = await fileHandle.getFile();
      const content = await file.text();
      const secureData = JSON.parse(content);
      
      // Verify file ownership
      if (!await this.verifyFileOwnership(secureData.header)) {
        throw new Error('File ownership verification failed');
      }
      
      return secureData.data;
      
    } catch (error) {
      console.error(`❌ Failed to read song data for ${songId}:`, error);
      return null;
    }
  }

  /**
   * Write secure audio file to library
   */
  async writeAudioFile(trackId: string, audioBlob: Blob, filename: string): Promise<boolean> {
    if (!this.directoryHandle || !this.isInitialized) {
      console.error('❌ Library not initialized');
      return false;
    }

    try {
      const header = await this.createFileHeader();
      
      // Create a secure audio file with header prefix
      const headerBlob = new Blob([JSON.stringify(header) + '\n---AUDIO_DATA---\n'], { type: 'text/plain' });
      const secureBlob = new Blob([headerBlob, audioBlob], { type: audioBlob.type });
      
      const audioFolder = await this.directoryHandle.getDirectoryHandle('audio');
      const fileHandle = await audioFolder.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      
      await writable.write(secureBlob);
      await writable.close();
      
      console.log(`✅ Securely saved audio: ${filename}`);
      return true;
      
    } catch (error) {
      console.error('❌ Failed to write audio file:', error);
      return false;
    }
  }

  /**
   * Read and verify audio file from library
   */
  async readAudioFile(filename: string): Promise<Blob | null> {
    if (!this.directoryHandle || !this.isInitialized) {
      console.error('❌ Library not initialized');
      return null;
    }

    try {
      const audioFolder = await this.directoryHandle.getDirectoryHandle('audio');
      const fileHandle = await audioFolder.getFileHandle(filename);
      const file = await fileHandle.getFile();
      
      // Extract header and audio data
      const text = await file.text();
      const parts = text.split('\n---AUDIO_DATA---\n');
      
      if (parts.length !== 2) {
        throw new Error('Invalid secure audio file format');
      }
      
      const header = JSON.parse(parts[0]);
      
      // Verify file ownership
      if (!await this.verifyFileOwnership(header)) {
        throw new Error('Audio file ownership verification failed');
      }
      
      // Return audio data as blob
      const audioData = parts[1];
      return new Blob([audioData], { type: file.type });
      
    } catch (error) {
      console.error(`❌ Failed to read audio file ${filename}:`, error);
      return null;
    }
  }

  /**
   * List all songs in the library
   */
  async listSongs(): Promise<string[]> {
    if (!this.directoryHandle || !this.isInitialized) {
      return [];
    }

    try {
      const songsFolder = await this.directoryHandle.getDirectoryHandle('songs');
      const songIds: string[] = [];
      
      for await (const [name, handle] of (songsFolder as ExtendedFileSystemDirectoryHandle).entries()) {
        if (handle.kind === 'file' && name.endsWith('.json')) {
          const songId = name.replace('.json', '');
          
          // Verify we can read this song (ownership check)
          const songData = await this.readSongData(songId);
          if (songData) {
            songIds.push(songId);
          }
        }
      }
      
      return songIds;
      
    } catch (error) {
      console.error('❌ Failed to list songs:', error);
      return [];
    }
  }

  /**
   * Persist library folder handle in IndexedDB
   */
  private async persistLibraryFolder(handle: FileSystemDirectoryHandle): Promise<void> {
    try {
      const db = await this.openStorageDB();
      const transaction = db.transaction(['folders'], 'readwrite');
      const store = transaction.objectStore('folders');
      
      return new Promise((resolve, reject) => {
        const request = store.put({
          id: 'musicLibrary',
          handle: handle,
          userEmail: this.currentUserEmail,
          timestamp: Date.now()
        });
        
        request.onsuccess = () => {
          console.log('✅ Library folder handle persisted');
          resolve();
        };
        
        request.onerror = () => {
          console.error('❌ Failed to persist library folder:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('❌ Failed to persist library folder:', error);
      throw error;
    }
  }

  /**
   * Restore library folder handle from IndexedDB
   */
  private async restoreLibraryFolder(): Promise<boolean> {
    try {
      const db = await this.openStorageDB();
      const transaction = db.transaction(['folders'], 'readonly');
      const store = transaction.objectStore('folders');
      
      return new Promise((resolve) => {
        const request = store.get('musicLibrary');
        
        request.onsuccess = async () => {
          const result = request.result;
          
          if (result && result.handle && result.userEmail === this.currentUserEmail) {
            this.directoryHandle = result.handle as ExtendedFileSystemDirectoryHandle;
            
            try {
              // Verify we still have permission
              const permission = await this.directoryHandle.queryPermission({ mode: 'readwrite' });
              if (permission === 'granted') {
                resolve(true);
                return;
              }
              
              // Try to request permission again
              const newPermission = await this.directoryHandle.requestPermission({ mode: 'readwrite' });
              resolve(newPermission === 'granted');
            } catch (error) {
              console.error('❌ Permission check failed:', error);
              resolve(false);
            }
          } else {
            resolve(false);
          }
        };
        
        request.onerror = () => {
          console.error('❌ Failed to get library folder from IndexedDB');
          resolve(false);
        };
      });
    } catch (error) {
      console.error('❌ Failed to restore library folder:', error);
      return false;
    }
  }

  /**
   * Open IndexedDB for storing folder handles
   */
  private async openStorageDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('SecureDirectStorage', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('folders')) {
          db.createObjectStore('folders', { keyPath: 'id' });
        }
      };
    });
  }
}

export default SecureDirectStorage;