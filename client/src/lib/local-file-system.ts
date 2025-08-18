// Complete local file system management using File System Access API
// 100% offline, no web storage, all files stored locally

interface LocalFileConfig {
  version: string;
  lastUpdated: number;
  projectDirectory?: FileSystemDirectoryHandle;
  audioFiles: {
    [songId: string]: {
      [trackId: string]: {
        fileName: string;
        filePath: string;
        size: number;
        lastModified: number;
        mimeType: string;
        trackName: string;
      };
    };
  };
  waveforms: {
    [songId: string]: {
      filePath: string;
      lastGenerated: number;
    };
  };
  songs: {
    [songId: string]: {
      title: string;
      artist: string;
      duration: number;
      bpm?: number;
      key?: string;
      lyrics?: string;
      createdAt: number;
      lastModified: number;
    };
  };
}

export class LocalFileSystem {
  private static instance: LocalFileSystem;
  private config: LocalFileConfig;
  private projectDir: FileSystemDirectoryHandle | null = null;
  private audioDir: FileSystemDirectoryHandle | null = null;
  private waveformDir: FileSystemDirectoryHandle | null = null;
  private configFile: FileSystemFileHandle | null = null;
  private audioFileCache: Map<string, File> = new Map();

  static getInstance(): LocalFileSystem {
    if (!LocalFileSystem.instance) {
      LocalFileSystem.instance = new LocalFileSystem();
    }
    return LocalFileSystem.instance;
  }

  constructor() {
    this.config = {
      version: '1.0.0',
      lastUpdated: Date.now(),
      audioFiles: {},
      waveforms: {},
      songs: {}
    };
  }

  // Initialize the local file system
  async initialize(): Promise<boolean> {
    try {
      // Check if File System Access API is supported
      if (!('showDirectoryPicker' in window)) {
        throw new Error('File System Access API not supported in this browser');
      }

      // Try to load existing project directory
      const existingDir = await this.loadExistingProject();
      if (existingDir) {
        console.log('Loaded existing project directory');
        return true;
      }

      // Ask user to select or create project directory
      console.log('Requesting project directory selection...');
      this.projectDir = await (window as any).showDirectoryPicker({
        mode: 'readwrite',
        startIn: 'documents'
      });

      await this.setupProjectStructure();
      await this.loadConfig();
      
      console.log('Local file system initialized successfully');
      return true;

    } catch (error) {
      console.error('Failed to initialize local file system:', error);
      return false;
    }
  }

  // Try to load existing project from stored handle
  private async loadExistingProject(): Promise<boolean> {
    try {
      // Check if we have stored directory handles (browser-specific storage)
      const storedHandle = localStorage.getItem('musicApp_projectDir');
      if (!storedHandle) return false;

      // Note: Directory handles can't be serialized, so this is a placeholder
      // In a real implementation, we'd need to ask user to re-select the directory
      return false;
    } catch (error) {
      return false;
    }
  }

  // Setup project directory structure
  private async setupProjectStructure(): Promise<void> {
    if (!this.projectDir) throw new Error('No project directory');

    try {
      // Create audio files directory
      this.audioDir = await this.projectDir.getDirectoryHandle('audio', { create: true });
      
      // Create waveforms directory
      this.waveformDir = await this.projectDir.getDirectoryHandle('waveforms', { create: true });
      
      // Create or get config file
      this.configFile = await this.projectDir.getFileHandle('music-app-config.json', { create: true });
      
      console.log('Project structure created successfully');
    } catch (error) {
      console.error('Failed to setup project structure:', error);
      throw error;
    }
  }

  // Load configuration from local file
  private async loadConfig(): Promise<void> {
    if (!this.configFile) return;

    try {
      const file = await this.configFile.getFile();
      if (file.size === 0) {
        // New config file, save default
        await this.saveConfig();
        return;
      }

      const text = await file.text();
      this.config = JSON.parse(text);
      console.log(`Loaded config with ${Object.keys(this.config.songs).length} songs`);
    } catch (error) {
      console.error('Failed to load config:', error);
      // Use default config
      await this.saveConfig();
    }
  }

  // Save configuration to local file
  private async saveConfig(): Promise<void> {
    if (!this.configFile) return;

    try {
      this.config.lastUpdated = Date.now();
      const writable = await this.configFile.createWritable();
      await writable.write(JSON.stringify(this.config, null, 2));
      await writable.close();
      console.log('Config saved successfully');
    } catch (error) {
      console.error('Failed to save config:', error);
    }
  }

  // Add audio file for a track
  async addAudioFile(songId: string, trackId: string, trackName: string, file: File): Promise<boolean> {
    if (!this.audioDir) {
      throw new Error('Audio directory not initialized');
    }

    try {
      // Create song directory if it doesn't exist
      const songDir = await this.audioDir.getDirectoryHandle(songId, { create: true });
      
      // Save audio file with track ID as filename
      const fileName = `${trackId}.${file.name.split('.').pop()}`;
      const fileHandle = await songDir.getFileHandle(fileName, { create: true });
      
      const writable = await fileHandle.createWritable();
      await writable.write(file);
      await writable.close();

      // Update config
      if (!this.config.audioFiles[songId]) {
        this.config.audioFiles[songId] = {};
      }

      this.config.audioFiles[songId][trackId] = {
        fileName: fileName,
        filePath: `audio/${songId}/${fileName}`,
        size: file.size,
        lastModified: file.lastModified || Date.now(),
        mimeType: file.type,
        trackName: trackName
      };

      // Cache the file
      this.audioFileCache.set(trackId, file);

      await this.saveConfig();
      console.log(`Audio file saved: ${fileName} for track: ${trackName}`);
      return true;

    } catch (error) {
      console.error('Failed to save audio file:', error);
      return false;
    }
  }

  // Get audio file for a track
  async getAudioFile(trackId: string): Promise<File | null> {
    // Check cache first
    if (this.audioFileCache.has(trackId)) {
      return this.audioFileCache.get(trackId)!;
    }

    // Find file info in config
    let fileInfo: any = null;
    let songId: string | null = null;

    for (const [sId, tracks] of Object.entries(this.config.audioFiles)) {
      if (tracks[trackId]) {
        fileInfo = tracks[trackId];
        songId = sId;
        break;
      }
    }

    if (!fileInfo || !songId || !this.audioDir) {
      console.warn(`No file info found for track: ${trackId}`);
      return null;
    }

    try {
      // Load file from local directory
      const songDir = await this.audioDir.getDirectoryHandle(songId);
      const fileHandle = await songDir.getFileHandle(fileInfo.fileName);
      const file = await fileHandle.getFile();

      // Cache the file
      this.audioFileCache.set(trackId, file);

      console.log(`Loaded audio file: ${fileInfo.fileName} for track: ${trackId}`);
      return file;

    } catch (error) {
      console.error(`Failed to load audio file for track ${trackId}:`, error);
      return null;
    }
  }

  // Save song data
  async saveSong(songId: string, songData: any): Promise<void> {
    this.config.songs[songId] = {
      ...songData,
      lastModified: Date.now()
    };
    await this.saveConfig();
  }

  // Get song data
  getSong(songId: string): any {
    return this.config.songs[songId] || null;
  }

  // Get all songs
  getAllSongs(): any[] {
    return Object.entries(this.config.songs).map(([id, data]) => ({
      id,
      ...data
    }));
  }

  // Delete song and all associated files
  async deleteSong(songId: string): Promise<boolean> {
    try {
      // Delete audio files directory
      if (this.audioDir) {
        try {
          const songDir = await this.audioDir.getDirectoryHandle(songId);
          await this.audioDir.removeEntry(songId, { recursive: true });
          console.log(`Deleted audio directory for song: ${songId}`);
        } catch (error) {
          console.log('Audio directory not found or already deleted');
        }
      }

      // Delete waveform file
      if (this.waveformDir && this.config.waveforms[songId]) {
        try {
          await this.waveformDir.removeEntry(`${songId}.json`);
          console.log(`Deleted waveform for song: ${songId}`);
        } catch (error) {
          console.log('Waveform file not found or already deleted');
        }
      }

      // Remove from config
      delete this.config.songs[songId];
      delete this.config.audioFiles[songId];
      delete this.config.waveforms[songId];

      // Clear cache
      if (this.config.audioFiles[songId]) {
        for (const trackId of Object.keys(this.config.audioFiles[songId])) {
          this.audioFileCache.delete(trackId);
        }
      }

      await this.saveConfig();
      console.log(`Song deleted successfully: ${songId}`);
      return true;

    } catch (error) {
      console.error('Failed to delete song:', error);
      return false;
    }
  }

  // Save waveform data
  async saveWaveform(songId: string, waveformData: number[]): Promise<void> {
    if (!this.waveformDir) return;

    try {
      const fileHandle = await this.waveformDir.getFileHandle(`${songId}.json`, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(JSON.stringify(waveformData));
      await writable.close();

      this.config.waveforms[songId] = {
        filePath: `waveforms/${songId}.json`,
        lastGenerated: Date.now()
      };

      await this.saveConfig();
      console.log(`Waveform saved for song: ${songId}`);
    } catch (error) {
      console.error('Failed to save waveform:', error);
    }
  }

  // Load waveform data
  async getWaveform(songId: string): Promise<number[] | null> {
    if (!this.waveformDir || !this.config.waveforms[songId]) {
      return null;
    }

    try {
      const fileHandle = await this.waveformDir.getFileHandle(`${songId}.json`);
      const file = await fileHandle.getFile();
      const text = await file.text();
      return JSON.parse(text);
    } catch (error) {
      console.error('Failed to load waveform:', error);
      return null;
    }
  }

  // Get file info for a track
  getTrackFileInfo(trackId: string): any {
    for (const [songId, tracks] of Object.entries(this.config.audioFiles)) {
      if (tracks[trackId]) {
        return tracks[trackId];
      }
    }
    return null;
  }

  // Check if file system is ready
  isReady(): boolean {
    return !!(this.projectDir && this.audioDir && this.waveformDir && this.configFile);
  }

  // Get project status
  getStatus(): string {
    if (!this.isReady()) return 'Not initialized';
    
    const songCount = Object.keys(this.config.songs).length;
    const trackCount = Object.values(this.config.audioFiles)
      .reduce((total, tracks) => total + Object.keys(tracks).length, 0);
    
    return `Ready - ${songCount} songs, ${trackCount} tracks`;
  }
}