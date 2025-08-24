import * as FileSystem from 'expo-file-system';
import { Audio } from 'expo-av';

export interface LocalAudioFile {
  id: string;
  originalName: string;
  localPath: string;
  size: number;
  duration?: number;
  format: string;
  createdAt: number;
  lastAccessed: number;
}

export interface FileSystemStats {
  totalFiles: number;
  totalSize: number; // bytes
  availableSpace: number; // bytes
  usedSpace: number; // bytes
}

class MobileFileSystemManager {
  private audioDirectory: string;
  private metadataFile: string;
  private fileIndex: Map<string, LocalAudioFile> = new Map();

  constructor() {
    this.audioDirectory = `${FileSystem.documentDirectory}audio/`;
    this.metadataFile = `${FileSystem.documentDirectory}audio_metadata.json`;
  }

  async initialize(): Promise<void> {
    try {
      // Create audio directory if it doesn't exist
      const dirInfo = await FileSystem.getInfoAsync(this.audioDirectory);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(this.audioDirectory, { intermediates: true });
        console.log('✅ Audio directory created:', this.audioDirectory);
      }

      // Load existing metadata
      await this.loadMetadata();
      console.log(`📁 File system initialized with ${this.fileIndex.size} audio files`);
    } catch (error) {
      console.error('❌ Failed to initialize file system:', error);
      throw error;
    }
  }

  private async loadMetadata(): Promise<void> {
    try {
      const metadataInfo = await FileSystem.getInfoAsync(this.metadataFile);
      if (metadataInfo.exists) {
        const metadataContent = await FileSystem.readAsStringAsync(this.metadataFile);
        const metadata: LocalAudioFile[] = JSON.parse(metadataContent);
        
        // Verify files still exist and update index
        for (const file of metadata) {
          const fileInfo = await FileSystem.getInfoAsync(file.localPath);
          if (fileInfo.exists) {
            this.fileIndex.set(file.id, file);
          }
        }
        
        // Save cleaned metadata
        await this.saveMetadata();
      }
    } catch (error) {
      console.error('❌ Failed to load metadata:', error);
      // Start with empty index if metadata is corrupted
      this.fileIndex.clear();
    }
  }

  private async saveMetadata(): Promise<void> {
    try {
      const metadata = Array.from(this.fileIndex.values());
      await FileSystem.writeAsStringAsync(this.metadataFile, JSON.stringify(metadata, null, 2));
    } catch (error) {
      console.error('❌ Failed to save metadata:', error);
    }
  }

  async saveAudioFile(uri: string, originalName: string): Promise<LocalAudioFile> {
    try {
      const fileId = `audio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const fileExtension = this.getFileExtension(originalName);
      const localFileName = `${fileId}.${fileExtension}`;
      const localPath = `${this.audioDirectory}${localFileName}`;

      console.log(`📥 Saving audio file: ${originalName} → ${localPath}`);

      // Copy file to local directory
      await FileSystem.copyAsync({
        from: uri,
        to: localPath
      });

      // Get file info
      const fileInfo = await FileSystem.getInfoAsync(localPath);
      
      // Try to get audio duration
      let duration: number | undefined;
      try {
        const { sound } = await Audio.Sound.createAsync({ uri: localPath }, { shouldPlay: false });
        const status = await sound.getStatusAsync();
        if (status.isLoaded && status.durationMillis) {
          duration = status.durationMillis / 1000; // Convert to seconds
        }
        await sound.unloadAsync();
      } catch (durationError) {
        console.warn('⚠️ Could not determine audio duration:', durationError);
      }

      const audioFile: LocalAudioFile = {
        id: fileId,
        originalName,
        localPath,
        size: fileInfo.size || 0,
        duration,
        format: fileExtension,
        createdAt: Date.now(),
        lastAccessed: Date.now()
      };

      this.fileIndex.set(fileId, audioFile);
      await this.saveMetadata();

      console.log('✅ Audio file saved successfully:', audioFile);
      return audioFile;
    } catch (error) {
      console.error('❌ Failed to save audio file:', error);
      throw error;
    }
  }

  async getAudioFile(fileId: string): Promise<LocalAudioFile | null> {
    const file = this.fileIndex.get(fileId);
    if (!file) return null;

    // Update last accessed time
    file.lastAccessed = Date.now();
    this.fileIndex.set(fileId, file);
    await this.saveMetadata();

    return file;
  }

  async getAllAudioFiles(): Promise<LocalAudioFile[]> {
    return Array.from(this.fileIndex.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  async deleteAudioFile(fileId: string): Promise<boolean> {
    try {
      const file = this.fileIndex.get(fileId);
      if (!file) {
        console.warn('⚠️ File not found for deletion:', fileId);
        return false;
      }

      // Delete physical file
      const fileInfo = await FileSystem.getInfoAsync(file.localPath);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(file.localPath);
      }

      // Remove from index
      this.fileIndex.delete(fileId);
      await this.saveMetadata();

      console.log('✅ Audio file deleted:', file.originalName);
      return true;
    } catch (error) {
      console.error('❌ Failed to delete audio file:', error);
      return false;
    }
  }

  async getFileSystemStats(): Promise<FileSystemStats> {
    try {
      const files = Array.from(this.fileIndex.values());
      const totalFiles = files.length;
      const totalSize = files.reduce((sum, file) => sum + file.size, 0);

      // Get available disk space
      const freeDiskStorage = await FileSystem.getFreeDiskStorageAsync();
      const totalDiskCapacity = await FileSystem.getTotalDiskCapacityAsync();
      
      return {
        totalFiles,
        totalSize,
        availableSpace: freeDiskStorage,
        usedSpace: totalDiskCapacity - freeDiskStorage
      };
    } catch (error) {
      console.error('❌ Failed to get file system stats:', error);
      return {
        totalFiles: 0,
        totalSize: 0,
        availableSpace: 0,
        usedSpace: 0
      };
    }
  }

  async cleanupOldFiles(maxAge: number = 30 * 24 * 60 * 60 * 1000): Promise<number> {
    try {
      const now = Date.now();
      const filesToDelete: string[] = [];

      for (const [fileId, file] of this.fileIndex.entries()) {
        if (now - file.lastAccessed > maxAge) {
          filesToDelete.push(fileId);
        }
      }

      let deletedCount = 0;
      for (const fileId of filesToDelete) {
        const success = await this.deleteAudioFile(fileId);
        if (success) deletedCount++;
      }

      console.log(`🧹 Cleaned up ${deletedCount} old audio files`);
      return deletedCount;
    } catch (error) {
      console.error('❌ Failed to cleanup old files:', error);
      return 0;
    }
  }

  async exportAudioFile(fileId: string): Promise<string | null> {
    try {
      const file = this.fileIndex.get(fileId);
      if (!file) return null;

      // For mobile, we can use the sharing functionality
      return file.localPath;
    } catch (error) {
      console.error('❌ Failed to export audio file:', error);
      return null;
    }
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  private getFileExtension(filename: string): string {
    const parts = filename.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : 'unknown';
  }

  isAudioFile(filename: string): boolean {
    const extension = this.getFileExtension(filename);
    const audioFormats = ['mp3', 'wav', 'aac', 'm4a', 'ogg', 'flac', 'mp4'];
    return audioFormats.includes(extension);
  }
}

// Singleton instance
export const fileSystemManager = new MobileFileSystemManager();