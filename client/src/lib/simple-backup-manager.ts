import JSZip from 'jszip';
import { BrowserFileSystem } from './browser-file-system';
import { AudioFileStorage } from './audio-file-storage';

export interface DatabaseBackup {
  version: string;
  createdAt: string;
  userEmail: string;
  databases: {
    [dbName: string]: {
      stores: {
        [storeName: string]: any[];
      };
    };
  };
  localStorage?: {
    [key: string]: string;
  };
}

export class SimpleBackupManager {
  private static instance: SimpleBackupManager;

  static getInstance(): SimpleBackupManager {
    if (!SimpleBackupManager.instance) {
      SimpleBackupManager.instance = new SimpleBackupManager();
    }
    return SimpleBackupManager.instance;
  }

  /**
   * Export the entire database for a user
   */
  async exportDatabase(userEmail: string, onProgress?: (progress: number, status: string) => void): Promise<Blob> {
    console.log(`🎒 Starting database export for user: ${userEmail}`);
    onProgress?.(0, "Initializing database export...");
    
    const backup: DatabaseBackup = {
      version: '2.0.0',
      createdAt: new Date().toISOString(),
      userEmail: userEmail,
      databases: {},
      localStorage: {}
    };

    try {
      // Get all user-specific database names
      const sanitizedEmail = userEmail.replace(/[^a-zA-Z0-9]/g, '_');
      const dbNames = [
        `MusicAppDB_${sanitizedEmail}`,
        `MusicAppStorage::${sanitizedEmail}`
      ];

      let dbIndex = 0;
      for (const dbName of dbNames) {
        dbIndex++;
        const progress = (dbIndex / dbNames.length) * 70;
        onProgress?.(progress, `Exporting database: ${dbName}...`);
        
        try {
          const db = await this.openDatabase(dbName);
          if (db) {
            backup.databases[dbName] = { stores: {} };
            
            // Export all object stores
            const storeNames = Array.from(db.objectStoreNames);
            let storeIndex = 0;
            
            for (const storeName of storeNames) {
              storeIndex++;
              const storeProgress = progress + (storeIndex / storeNames.length) * (70 / dbNames.length);
              onProgress?.(storeProgress, `Exporting store: ${storeName}...`);
              
              const data = await this.exportStore(db, storeName);
              backup.databases[dbName].stores[storeName] = data;
              console.log(`✅ Exported ${data.length} items from ${storeName}`);
            }
            
            db.close();
          }
        } catch (error) {
          console.warn(`Could not open database ${dbName}:`, error);
        }
      }

      // Export localStorage items for this user
      onProgress?.(80, "Exporting localStorage data...");
      const localStorageKeys = Object.keys(localStorage).filter(key => 
        key.includes(userEmail) || key.includes(sanitizedEmail)
      );
      
      for (const key of localStorageKeys) {
        backup.localStorage![key] = localStorage.getItem(key) || '';
      }
      console.log(`📦 Exported ${localStorageKeys.length} localStorage items`);

      // Create zip file
      onProgress?.(90, "Creating backup file...");
      const zip = new JSZip();
      
      // Add the backup JSON to the zip
      const backupJson = JSON.stringify(backup, null, 2);
      zip.file('database_backup.json', backupJson, {
        compression: "DEFLATE",
        compressionOptions: { level: 9 }
      });
      
      // Add a readme
      zip.file('README.txt', `
StageTracker Pro Database Backup
=================================
Created: ${backup.createdAt}
User: ${backup.userEmail}
Version: ${backup.version}

This backup contains your complete database including:
- All songs and tracks
- Audio files
- Mute regions
- Waveforms
- User preferences
- Local storage data

To restore: Use the Import feature in StageTracker Pro
      `.trim());

      onProgress?.(95, "Generating backup file...");
      const zipBlob = await zip.generateAsync({ 
        type: 'blob',
        compression: "DEFLATE",
        compressionOptions: { level: 9 }
      });
      
      onProgress?.(100, "Export complete!");
      console.log(`✅ Database export complete`);
      return zipBlob;
      
    } catch (error) {
      console.error('Export failed:', error);
      throw error;
    }
  }

  /**
   * Import the entire database for a user
   */
  async importDatabase(zipFile: File, userEmail: string, onProgress?: (progress: number, status: string) => void): Promise<void> {
    console.log(`📥 Starting database import for user: ${userEmail}`);
    
    onProgress?.(5, "Reading backup file...");
    
    try {
      const zip = await JSZip.loadAsync(zipFile);
      
      // Read the backup JSON
      const backupFile = zip.file('database_backup.json');
      if (!backupFile) {
        throw new Error('Invalid backup file: missing database_backup.json');
      }
      
      onProgress?.(10, "Parsing backup data...");
      const backupText = await backupFile.async('text');
      const backup: DatabaseBackup = JSON.parse(backupText);
      
      // Validate backup belongs to current user
      if (backup.userEmail !== userEmail) {
        throw new Error(`This backup belongs to ${backup.userEmail}. You can only import your own backups.`);
      }
      
      console.log(`📋 Importing backup from ${backup.createdAt}`);
      onProgress?.(20, "Clearing existing data...");
      
      // Clear and restore each database
      const dbNames = Object.keys(backup.databases);
      let dbIndex = 0;
      
      for (const dbName of dbNames) {
        dbIndex++;
        const progress = 20 + (dbIndex / dbNames.length) * 60;
        onProgress?.(progress, `Restoring database: ${dbName}...`);
        
        const dbData = backup.databases[dbName];
        const db = await this.openDatabase(dbName);
        
        if (db) {
          // Clear and restore each store
          const storeNames = Object.keys(dbData.stores);
          
          for (const storeName of storeNames) {
            const storeData = dbData.stores[storeName];
            await this.clearStore(db, storeName);
            await this.importStore(db, storeName, storeData);
            console.log(`✅ Restored ${storeData.length} items to ${storeName}`);
          }
          
          db.close();
        }
      }
      
      // Restore localStorage items
      onProgress?.(85, "Restoring localStorage data...");
      if (backup.localStorage) {
        for (const [key, value] of Object.entries(backup.localStorage)) {
          localStorage.setItem(key, value);
        }
        console.log(`📦 Restored ${Object.keys(backup.localStorage).length} localStorage items`);
      }
      
      // Step: Initialize all storage systems sequentially
      onProgress?.(90, "Initializing storage systems...");
      console.log('🔄 Starting sequential storage initialization after import...');
      
      try {
        // Initialize BrowserFileSystem
        const browserFS = BrowserFileSystem.getInstance(userEmail);
        await browserFS.waitForInitialization();
        console.log('✅ BrowserFileSystem initialized after import');
        
        // Initialize AudioFileStorage sequentially
        const audioStorage = AudioFileStorage.getInstance(userEmail);
        await audioStorage.initializeSequential();
        console.log('✅ AudioFileStorage initialized after import');
      } catch (initError) {
        console.error('Warning: Storage initialization error after import:', initError);
        // Continue anyway - the page refresh should fix it
      }
      
      onProgress?.(95, "Finalizing import...");
      
      // Force a page reload to ensure everything is refreshed
      onProgress?.(100, "Import complete! Refreshing...");
      console.log(`✅ Database import complete`);
      
      // Wait a moment then reload
      setTimeout(() => {
        window.location.reload();
      }, 1500);
      
    } catch (error) {
      console.error('Import failed:', error);
      throw error;
    }
  }

  private async openDatabase(dbName: string): Promise<IDBDatabase | null> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName);
      
      request.onsuccess = () => {
        resolve(request.result);
      };
      
      request.onerror = () => {
        resolve(null); // Database doesn't exist
      };
      
      request.onupgradeneeded = () => {
        // Database needs upgrade, just return it
        resolve(request.result);
      };
    });
  }

  private async exportStore(db: IDBDatabase, storeName: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();
      
      request.onsuccess = () => {
        const data = request.result;
        // Convert any Blob objects to base64 for storage
        const processedData = data.map(item => {
          return this.convertBlobsToBase64(item);
        });
        
        Promise.all(processedData).then(resolve);
      };
      
      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  private async clearStore(db: IDBDatabase, storeName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();
      
      request.onsuccess = () => {
        resolve();
      };
      
      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  private async importStore(db: IDBDatabase, storeName: string, data: any[]): Promise<void> {
    return new Promise(async (resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      
      // Convert base64 back to Blobs
      for (const item of data) {
        let processedItem = await this.convertBase64ToBlobs(item);
        
        // Special handling for tracks - reset audioUrl to force regeneration
        if (storeName === 'tracks' && processedItem.audioUrl) {
          // Replace any blob URL with a placeholder that indicates audio is in database
          if (processedItem.audioUrl.startsWith('blob:')) {
            processedItem.audioUrl = 'blob:stored';
          }
        }
        
        store.add(processedItem);
      }
      
      transaction.oncomplete = () => {
        resolve();
      };
      
      transaction.onerror = () => {
        reject(transaction.error);
      };
    });
  }

  private async convertBlobsToBase64(obj: any): Promise<any> {
    if (obj instanceof Blob) {
      // Convert Blob to base64
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve({
            __isBlob: true,
            type: obj.type,
            size: obj.size,
            data: reader.result
          });
        };
        reader.readAsDataURL(obj);
      });
    } else if (obj && typeof obj === 'object') {
      // Recursively process object properties
      const processed: any = Array.isArray(obj) ? [] : {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          processed[key] = await this.convertBlobsToBase64(obj[key]);
        }
      }
      return processed;
    }
    return obj;
  }

  private async convertBase64ToBlobs(obj: any): Promise<any> {
    if (obj && typeof obj === 'object' && obj.__isBlob) {
      // Convert base64 back to Blob
      const base64Data = obj.data.split(',')[1];
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      return new Blob([byteArray], { type: obj.type });
    } else if (obj && typeof obj === 'object') {
      // Recursively process object properties
      const processed: any = Array.isArray(obj) ? [] : {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          processed[key] = await this.convertBase64ToBlobs(obj[key]);
        }
      }
      return processed;
    }
    return obj;
  }
}