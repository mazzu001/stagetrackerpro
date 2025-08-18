import type { Track } from "@shared/schema";

interface PersistedFileInfo {
  trackId: string;
  trackName: string;
  filePath: string;
  fileName: string;
  mimeType: string;
  size: number;
  lastModified: number;
  waveformData?: number[]; // Store waveform visualization data
}

interface FileRegistry {
  version: string;
  lastUpdated: number;
  files: PersistedFileInfo[];
}

const REGISTRY_FILE_PATH = './data/file-registry.json';

export class FilePersistence {
  private static instance: FilePersistence;
  private registry: FileRegistry;

  static getInstance(): FilePersistence {
    if (!FilePersistence.instance) {
      FilePersistence.instance = new FilePersistence();
    }
    return FilePersistence.instance;
  }

  constructor() {
    this.registry = {
      version: '1.0.0',
      lastUpdated: Date.now(),
      files: []
    };
    this.loadRegistry();
  }

  // Load file registry from local JSON file
  private async loadRegistry(): Promise<void> {
    try {
      const response = await fetch('/api/file-registry');
      if (response.ok) {
        this.registry = await response.json();
        console.log(`Loaded file registry with ${this.registry.files.length} tracked files`);
      } else {
        console.log('No existing file registry found, creating new one');
        await this.saveRegistry();
      }
    } catch (error) {
      console.warn('Could not load file registry:', error);
      await this.saveRegistry(); // Create initial registry
    }
  }

  // Save file registry to local JSON file
  private async saveRegistry(): Promise<void> {
    try {
      this.registry.lastUpdated = Date.now();
      
      const response = await fetch('/api/file-registry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.registry)
      });

      if (!response.ok) {
        throw new Error(`Failed to save registry: ${response.statusText}`);
      }
      
      console.log(`Saved file registry with ${this.registry.files.length} files`);
    } catch (error) {
      console.error('Failed to save file registry:', error);
    }
  }

  // Register a new file with persistent tracking
  async registerFile(track: Track, file: File): Promise<void> {
    try {
      const filePath = file.name;

      // Generate waveform data for visualization
      const waveformData = await this.generateWaveform(file);

      const fileInfo: PersistedFileInfo = {
        trackId: track.id,
        trackName: track.name,
        filePath: filePath,
        fileName: file.name,
        mimeType: file.type,
        size: file.size,
        lastModified: file.lastModified || Date.now(),
        waveformData: waveformData
      };

      // Update or add file info
      const existingIndex = this.registry.files.findIndex(f => f.trackId === track.id);
      if (existingIndex >= 0) {
        this.registry.files[existingIndex] = fileInfo;
      } else {
        this.registry.files.push(fileInfo);
      }

      await this.saveRegistry();
      console.log(`Registered file: ${file.name} for track: ${track.name}`);

    } catch (error) {
      console.error('Failed to register file:', error);
      throw error;
    }
  }

  // Get file info for a track
  getFileInfo(trackId: string): PersistedFileInfo | null {
    return this.registry.files.find(f => f.trackId === trackId) || null;
  }

  // Check if file info exists for a track
  hasFileInfo(trackId: string): boolean {
    return this.registry.files.some(f => f.trackId === trackId);
  }

  // Get waveform data for a track
  getWaveformData(trackId: string): number[] | undefined {
    const fileInfo = this.getFileInfo(trackId);
    return fileInfo?.waveformData;
  }

  // Generate waveform visualization data from audio file
  private async generateWaveform(file: File): Promise<number[]> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      const channelData = audioBuffer.getChannelData(0); // Use first channel
      const samples = 200; // Generate 200 points for waveform visualization
      const blockSize = Math.floor(channelData.length / samples);
      const waveform: number[] = [];

      for (let i = 0; i < samples; i++) {
        let sum = 0;
        for (let j = 0; j < blockSize; j++) {
          sum += Math.abs(channelData[i * blockSize + j] || 0);
        }
        waveform.push(sum / blockSize);
      }

      audioContext.close();
      return waveform;
    } catch (error) {
      console.warn('Could not generate waveform data:', error);
      return [];
    }
  }

  // Get all registered files
  getAllFiles(): PersistedFileInfo[] {
    return [...this.registry.files];
  }

  // Remove file registration
  async unregisterFile(trackId: string): Promise<void> {
    this.registry.files = this.registry.files.filter(f => f.trackId !== trackId);
    await this.saveRegistry();
    console.log(`Unregistered file for track: ${trackId}`);
  }
}