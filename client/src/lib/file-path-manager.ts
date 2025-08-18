import type { Track } from "@shared/schema";

interface FilePathMapping {
  trackId: string;
  trackName: string;
  songId: string;
  songTitle: string;
  filePath: string;
  fileName: string;
  size: number;
  lastModified: number;
  mimeType: string;
}

interface FilePathConfig {
  version: '1.0.0';
  lastUpdated: number;
  mappings: FilePathMapping[];
}

const CONFIG_API_ENDPOINT = '/api/file-paths';

export class FilePathManager {
  private static instance: FilePathManager;
  private config: FilePathConfig;
  private fileCache: Map<string, File> = new Map(); // Cache loaded files

  static getInstance(): FilePathManager {
    if (!FilePathManager.instance) {
      FilePathManager.instance = new FilePathManager();
    }
    return FilePathManager.instance;
  }

  constructor() {
    this.config = {
      version: '1.0.0',
      lastUpdated: Date.now(),
      mappings: []
    };
    this.loadConfig();
  }

  // Load configuration from server
  private async loadConfig(): Promise<void> {
    try {
      const response = await fetch(CONFIG_API_ENDPOINT);
      if (response.ok) {
        this.config = await response.json();
        console.log(`Loaded file path config with ${this.config.mappings.length} mappings`);
      } else {
        console.log('No existing file path config found, starting fresh');
      }
    } catch (error) {
      console.error('Failed to load file path config:', error);
    }
  }

  // Save configuration to server
  private async saveConfig(): Promise<void> {
    try {
      this.config.lastUpdated = Date.now();
      const response = await fetch(CONFIG_API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.config)
      });

      if (!response.ok) {
        throw new Error(`Failed to save config: ${response.statusText}`);
      }
      
      console.log(`Saved file path config with ${this.config.mappings.length} mappings`);
    } catch (error) {
      console.error('Failed to save file path config:', error);
    }
  }

  // Register a file path for a track
  async registerFilePath(track: Track, file: File, songTitle: string): Promise<void> {
    const filePath = (file as any).path || file.webkitRelativePath || file.name;
    
    const mapping: FilePathMapping = {
      trackId: track.id,
      trackName: track.name,
      songId: track.songId,
      songTitle: songTitle,
      filePath: filePath,
      fileName: file.name,
      size: file.size,
      lastModified: file.lastModified || Date.now(),
      mimeType: file.type
    };

    // Update or add mapping
    const existingIndex = this.config.mappings.findIndex(m => m.trackId === track.id);
    if (existingIndex >= 0) {
      this.config.mappings[existingIndex] = mapping;
    } else {
      this.config.mappings.push(mapping);
    }

    // Cache the file object
    this.fileCache.set(track.id, file);

    await this.saveConfig();
    console.log(`Registered file path: ${filePath} for track: ${track.name}`);
  }

  // Get file path for a track
  getFilePath(trackId: string): string | null {
    const mapping = this.config.mappings.find(m => m.trackId === trackId);
    return mapping?.filePath || null;
  }

  // Get file mapping for a track
  getFileMapping(trackId: string): FilePathMapping | null {
    return this.config.mappings.find(m => m.trackId === trackId) || null;
  }

  // Load file from path (attempt multiple strategies)
  async loadFileFromPath(trackId: string): Promise<File | null> {
    // Check cache first
    if (this.fileCache.has(trackId)) {
      return this.fileCache.get(trackId)!;
    }

    const mapping = this.getFileMapping(trackId);
    if (!mapping) {
      console.log(`No file path mapping found for track: ${trackId}`);
      return null;
    }

    console.log(`Attempting to load file: ${mapping.fileName} from path: ${mapping.filePath}`);

    try {
      // Strategy 1: Try to access file via full path (if browser supports it)
      if (mapping.filePath.startsWith('/') || mapping.filePath.includes('\\')) {
        try {
          const file = await this.tryLoadFromSystemPath(mapping);
          if (file) {
            this.fileCache.set(trackId, file);
            return file;
          }
        } catch (error) {
          console.log('System path access not available');
        }
      }

      // Strategy 2: Try File System Access API (Chrome)
      if ('showOpenFilePicker' in window) {
        try {
          const file = await this.tryLoadViaFileSystemAPI(mapping);
          if (file) {
            this.fileCache.set(trackId, file);
            return file;
          }
        } catch (error) {
          console.log('File System Access API failed');
        }
      }

      // Strategy 3: Check if file is in a known location pattern
      const file = await this.tryLoadFromKnownPattern(mapping);
      if (file) {
        this.fileCache.set(trackId, file);
        return file;
      }

      console.warn(`Could not automatically load file: ${mapping.fileName}. Path: ${mapping.filePath}`);
      return null;

    } catch (error) {
      console.error(`Error loading file for track ${mapping.trackName}:`, error);
      return null;
    }
  }

  // Try to load file from system path (limited browser support)
  private async tryLoadFromSystemPath(mapping: FilePathMapping): Promise<File | null> {
    // This is very limited in browsers due to security restrictions
    // Most browsers won't allow direct file system access
    return null;
  }

  // Try to load file via File System Access API (Chrome)
  private async tryLoadViaFileSystemAPI(mapping: FilePathMapping): Promise<File | null> {
    try {
      // This would require the user to have granted permission previously
      // But browsers don't persist file handles across sessions reliably
      return null;
    } catch (error) {
      return null;
    }
  }

  // Try to load from known patterns (project-specific logic)
  private async tryLoadFromKnownPattern(mapping: FilePathMapping): Promise<File | null> {
    // For now, this is a placeholder for future enhancements
    // Could include logic to search common directories, etc.
    return null;
  }

  // Trigger file selection dialog for missing files
  async requestFileSelection(missingMappings: FilePathMapping[]): Promise<Map<string, File>> {
    const reconnectedFiles = new Map<string, File>();

    if (missingMappings.length === 0) return reconnectedFiles;

    try {
      console.log(`Requesting file selection for ${missingMappings.length} missing files`);
      
      // Show file picker for multiple files
      const files = await this.showFileDialog(true);
      
      // Smart matching algorithm
      for (const file of files) {
        let bestMatch: FilePathMapping | null = null;
        let bestScore = 0;
        
        for (const mapping of missingMappings) {
          if (reconnectedFiles.has(mapping.trackId)) continue; // Already matched
          
          let score = 0;
          
          // Exact filename match
          if (file.name === mapping.fileName) {
            score = 100;
          }
          // Size match (strong indicator)
          else if (Math.abs(file.size - mapping.size) < 1000) {
            score = 90;
            // Bonus for partial name match
            if (file.name.toLowerCase().includes(mapping.trackName.toLowerCase()) ||
                mapping.trackName.toLowerCase().includes(file.name.replace(/\.[^/.]+$/, "").toLowerCase())) {
              score = 95;
            }
          }
          // Name similarity
          else if (file.name.toLowerCase().includes(mapping.trackName.toLowerCase()) ||
                   mapping.trackName.toLowerCase().includes(file.name.replace(/\.[^/.]+$/, "").toLowerCase())) {
            score = 80;
          }
          
          if (score > bestScore && score >= 80) { // Minimum confidence threshold
            bestScore = score;
            bestMatch = mapping;
          }
        }
        
        if (bestMatch) {
          reconnectedFiles.set(bestMatch.trackId, file);
          this.fileCache.set(bestMatch.trackId, file);
          console.log(`Auto-matched file: ${file.name} -> ${bestMatch.trackName} (confidence: ${bestScore}%)`);
        }
      }

      console.log(`Successfully matched ${reconnectedFiles.size} out of ${missingMappings.length} files`);
      return reconnectedFiles;

    } catch (error) {
      console.error('File selection failed:', error);
      return reconnectedFiles;
    }
  }

  // Show file selection dialog
  private async showFileDialog(multiple: boolean = false): Promise<File[]> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'audio/*,.mp3,.wav,.ogg,.m4a';
      input.multiple = multiple;

      input.onchange = (event) => {
        const files = Array.from((event.target as HTMLInputElement).files || []);
        resolve(files);
      };

      input.oncancel = () => resolve([]);
      input.click();
    });
  }

  // Remove file path mapping
  async unregisterFilePath(trackId: string): Promise<void> {
    this.config.mappings = this.config.mappings.filter(m => m.trackId !== trackId);
    this.fileCache.delete(trackId);
    await this.saveConfig();
    console.log(`Unregistered file path for track: ${trackId}`);
  }

  // Get all mappings for a song
  getSongMappings(songId: string): FilePathMapping[] {
    return this.config.mappings.filter(m => m.songId === songId);
  }

  // Get all mappings
  getAllMappings(): FilePathMapping[] {
    return [...this.config.mappings];
  }

  // Check if track has file path registered
  hasFilePath(trackId: string): boolean {
    return this.config.mappings.some(m => m.trackId === trackId);
  }

  // Clear cache (useful for memory management)
  clearFileCache(): void {
    this.fileCache.clear();
    console.log('File cache cleared');
  }
}