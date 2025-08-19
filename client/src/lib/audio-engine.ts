import type { SongWithTracks, Track } from "@shared/schema";
import { AudioFileStorage } from "./audio-file-storage";

export class AudioEngine {
  private audioContext: AudioContext | null = null;
  private masterGainNode: GainNode | null = null;
  private tracks: Map<string, TrackController> = new Map();
  private currentSong: SongWithTracks | null = null;
  private startTime: number = 0;
  private pausedTime: number = 0;
  private isPlaying: boolean = false;
  private analyzerNodes: Map<string, AnalyserNode> = new Map();
  private masterAnalyzerNode: AnalyserNode | null = null;

  async initialize(): Promise<void> {
    try {
      this.audioContext = new AudioContext();
      this.masterGainNode = this.audioContext.createGain();
      
      // Create master analyzer for stereo level monitoring
      this.masterAnalyzerNode = this.audioContext.createAnalyser();
      this.masterAnalyzerNode.fftSize = 256;
      this.masterAnalyzerNode.smoothingTimeConstant = 0.8;
      
      // Connect: masterGain -> masterAnalyzer -> destination
      this.masterGainNode.connect(this.masterAnalyzerNode);
      this.masterAnalyzerNode.connect(this.audioContext.destination);
      
      // Resume audio context if suspended (required for user interaction)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
    } catch (error) {
      throw new Error('Failed to initialize audio engine: ' + error);
    }
  }

  async loadSong(song: SongWithTracks): Promise<void> {
    if (!this.audioContext || !this.masterGainNode) {
      throw new Error('Audio engine not initialized');
    }

    // Stop current playback
    this.stop();
    
    // Clear existing tracks
    this.tracks.clear();
    this.analyzerNodes.clear();
    
    this.currentSong = song;

    console.log(`Loading song "${song.title}" with ${song.tracks.length} tracks`);

    // Load each track
    const loadPromises = song.tracks.map(async (track) => {
      try {
        console.log(`Starting load for track: ${track.name} (${track.id})`);
        const trackController = new TrackController(
          this.audioContext!,
          this.masterGainNode!,
          track
        );
        await trackController.load();
        this.tracks.set(track.id, trackController);

        // Create analyzer for audio level monitoring
        const analyzer = this.audioContext!.createAnalyser();
        analyzer.fftSize = 256;
        analyzer.smoothingTimeConstant = 0.8;
        trackController.connectAnalyzer(analyzer);
        this.analyzerNodes.set(track.id, analyzer);
        
        console.log(`Successfully loaded track: ${track.name}`);
      } catch (error) {
        console.error(`Failed to load track ${track.name}:`, error);
        // Don't add failed tracks to the collection
      }
    });

    // Wait for all tracks to load
    await Promise.allSettled(loadPromises);
    
    console.log(`Loaded ${this.tracks.size} out of ${song.tracks.length} tracks successfully`);
  }

  async play(): Promise<void> {
    if (!this.audioContext || !this.currentSong) return;

    // Check if we have tracks to play
    if (this.tracks.size === 0) {
      console.warn('No tracks loaded, cannot start playback');
      return;
    }

    // Don't restart if already playing
    if (this.isPlaying) {
      console.log('AudioEngine: Already playing, ignoring play request');
      return;
    }
    


    // Resume audio context if suspended and wait for it
    if (this.audioContext.state === 'suspended') {
      console.log('Audio context suspended, resuming...');
      await this.audioContext.resume();
      console.log('Audio context resumed, state:', this.audioContext.state);
    }

    this.isPlaying = true;
    this.startTime = this.audioContext.currentTime - this.pausedTime;

    console.log(`Starting playback: ${this.tracks.size} tracks loaded, starting at ${this.pausedTime}s`);

    // Start all tracks simultaneously
    let playingTracks = 0;
    this.tracks.forEach((track, trackId) => {
      try {
        track.play(this.pausedTime);
        playingTracks++;
        console.log(`Started track: ${trackId}`);
      } catch (error) {
        console.error(`Failed to start track ${trackId}:`, error);
      }
    });
    
    console.log(`Successfully started ${playingTracks} out of ${this.tracks.size} tracks`);
  }

  pause(): void {
    if (!this.audioContext) return;

    this.isPlaying = false;
    this.pausedTime = this.audioContext.currentTime - this.startTime;

    this.tracks.forEach(track => track.pause());
  }

  stop(): void {
    if (!this.audioContext) return;

    this.isPlaying = false;
    this.startTime = 0;
    this.pausedTime = 0;

    this.tracks.forEach(track => track.stop());
  }

  async seek(time: number): Promise<void> {
    if (!this.audioContext) return;

    const wasPlaying = this.isPlaying;
    this.stop();
    this.pausedTime = time;
    
    if (wasPlaying) {
      await this.play();
    }
  }

  getCurrentTime(): number {
    if (!this.audioContext) return 0;
    
    if (this.isPlaying) {
      const currentTime = this.audioContext.currentTime - this.startTime;
      const result = Math.max(0, currentTime);

      return result;
    }
    return this.pausedTime;
  }

  setMasterVolume(volume: number): void {
    if (this.masterGainNode) {
      this.masterGainNode.gain.value = volume / 100;
    }
  }

  setTrackVolume(trackId: string, volume: number): void {
    const track = this.tracks.get(trackId);
    if (track) {
      track.setVolume(volume);
    }
  }

  setTrackBalance(trackId: string, balance: number): void {
    const track = this.tracks.get(trackId);
    if (track) {
      track.setBalance(balance);
    }
  }

  toggleTrackMute(trackId: string): void {
    const track = this.tracks.get(trackId);
    if (track) {
      track.toggleMute();
    }
  }

  toggleTrackSolo(trackId: string): void {
    const track = this.tracks.get(trackId);
    if (track) {
      track.toggleSolo();
      
      // Update other tracks' solo state
      this.tracks.forEach((otherTrack, otherId) => {
        if (otherId !== trackId) {
          otherTrack.updateSoloState(track.isSolo);
        }
      });
    }
  }

  getLoadedTrackCount(): number {
    return this.tracks.size;
  }

  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  private levelCache: Map<string, { level: number, lastUpdate: number }> = new Map();
  private smoothingFactor = 0.3; // Smoother level transitions

  getAudioLevels(): Record<string, number> {
    const levels: Record<string, number> = {};
    const now = performance.now();
    
    this.analyzerNodes.forEach((analyzer, trackId) => {
      const track = this.tracks.get(trackId);
      if (!track || !this.isPlaying) {
        levels[trackId] = 0;
        this.levelCache.delete(trackId);
        return;
      }

      const bufferLength = analyzer.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyzer.getByteFrequencyData(dataArray); // Use frequency data for more responsive VU meters
      
      // Extremely conservative VU meter calculation - start from scratch
      let sum = 0;
      const sampleCount = Math.min(32, bufferLength); // Only sample a few bins
      
      // Just take a simple average of the first few frequency bins
      for (let i = 0; i < sampleCount; i++) {
        sum += dataArray[i];
      }
      const average = sum / sampleCount;
      
      // Fine-tuned scaling for professional VU meter response
      let rawLevel = (average / 255) * 0.015; // Even more conservative for hot tracks
      
      // Log the actual values for debugging
      console.log(`Track ${trackId}: raw average=${average.toFixed(1)}, final level=${rawLevel.toFixed(2)}`);
      
      rawLevel = Math.max(0, Math.min(100, rawLevel));
      
      // Smooth the level changes
      const cached = this.levelCache.get(trackId);
      if (cached && now - cached.lastUpdate < 50) { // Don't update too frequently
        rawLevel = cached.level + (rawLevel - cached.level) * this.smoothingFactor;
      }
      
      this.levelCache.set(trackId, { level: rawLevel, lastUpdate: now });
      levels[trackId] = Math.max(0, Math.min(100, rawLevel));
    });
    
    return levels;
  }

  private masterLevelCache: { left: number; right: number; lastUpdate: number } = { left: 0, right: 0, lastUpdate: 0 };

  getMasterStereoLevels(): { left: number; right: number } {
    if (!this.masterAnalyzerNode || !this.isPlaying) {
      return { left: 0, right: 0 };
    }

    const now = performance.now();
    
    // Throttle updates for performance
    if (now - this.masterLevelCache.lastUpdate < 33) { // ~30fps for master meters
      return { left: this.masterLevelCache.left, right: this.masterLevelCache.right };
    }

    const bufferLength = this.masterAnalyzerNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.masterAnalyzerNode.getByteFrequencyData(dataArray); // Use frequency data
    
    // Calculate average across mid-range frequencies for better visualization
    let sum = 0;
    const startBin = Math.floor(bufferLength * 0.1);
    const endBin = Math.floor(bufferLength * 0.8);
    
    for (let i = startBin; i < endBin; i++) {
      sum += dataArray[i];
    }
    // Calculate RMS for master levels to match track calculation
    let sum2 = 0;
    for (let i = startBin; i < endBin; i++) {
      const normalizedValue = dataArray[i] / 255;
      sum2 += normalizedValue * normalizedValue;
    }
    const rms = Math.sqrt(sum2 / (endBin - startBin));
    
    let baseLevel = rms * 18; // Slightly reduced to match track scaling adjustment
    
    // Apply same compression as tracks
    if (baseLevel > 10) {
      baseLevel = 10 + (baseLevel - 10) * 0.5;
    }
    
    baseLevel = Math.max(0, Math.min(100, baseLevel));
    
    // Create slight stereo variation for visual interest
    const variation = Math.sin(now * 0.001) * 2; // Subtle sine wave variation
    const leftLevel = Math.max(0, Math.min(100, baseLevel + variation));
    const rightLevel = Math.max(0, Math.min(100, baseLevel - variation));
    
    // Apply smoothing
    const smoothedLeft = this.masterLevelCache.left + (leftLevel - this.masterLevelCache.left) * 0.4;
    const smoothedRight = this.masterLevelCache.right + (rightLevel - this.masterLevelCache.right) * 0.4;
    
    this.masterLevelCache = {
      left: smoothedLeft,
      right: smoothedRight,
      lastUpdate: now
    };
    
    return { 
      left: smoothedLeft, 
      right: smoothedRight 
    };
  }

  dispose(): void {
    this.stop();
    this.tracks.clear();
    this.analyzerNodes.clear();
    this.levelCache.clear();
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

class TrackController {
  private audioContext: AudioContext;
  private masterGain: GainNode;
  private track: Track;
  private audioBuffer: AudioBuffer | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private gainNode: GainNode;
  private muteNode: GainNode;
  private pannerNode: StereoPannerNode;
  public isSolo: boolean = false;
  private isMuted: boolean = false;

  constructor(audioContext: AudioContext, masterGain: GainNode, track: Track) {
    this.audioContext = audioContext;
    this.masterGain = masterGain;
    this.track = track;
    
    // Create audio nodes for volume, mute, and balance control
    this.gainNode = audioContext.createGain();
    this.muteNode = audioContext.createGain();
    this.pannerNode = audioContext.createStereoPanner();
    
    // Set initial values
    this.gainNode.gain.value = (track.volume || 100) / 100;
    this.muteNode.gain.value = track.isMuted ? 0 : 1;
    this.pannerNode.pan.value = ((track as any).balance || 0) / 50; // Convert -50/+50 to -1/+1
    this.isMuted = track.isMuted || false;
    this.isSolo = track.isSolo || false;
    
    // Connect nodes: gain -> panner -> mute -> master
    this.gainNode.connect(this.pannerNode);
    this.pannerNode.connect(this.muteNode);
    this.muteNode.connect(this.masterGain);
  }

  async load(): Promise<void> {
    try {
      // Use fast local file storage system
      const audioStorage = AudioFileStorage.getInstance();
      
      // Get audio URL from local file storage (cached blob URLs)
      const audioUrl = await audioStorage.getAudioUrl(this.track.id);
      if (!audioUrl) {
        console.warn(`No file data available for track ${this.track.name}. Please re-add the audio file.`);
        throw new Error(`Audio file not available for ${this.track.name}. Please re-add the audio file.`);
      }
      
      console.log(`Loading track: ${this.track.name} from local file storage`);
      
      // Fetch and decode the audio from local blob URL
      const response = await fetch(audioUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      
      if (arrayBuffer.byteLength === 0) {
        throw new Error(`Empty audio file for track ${this.track.name}`);
      }
      
      console.log(`Decoding audio data for ${this.track.name}, size: ${arrayBuffer.byteLength} bytes`);
      this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      console.log(`Successfully decoded ${this.track.name}: ${this.audioBuffer.duration.toFixed(2)}s, ${this.audioBuffer.numberOfChannels} channels`);
    } catch (error) {
      console.error(`Failed to load audio for track ${this.track.name}:`, error);
      throw error; // Re-throw to prevent adding failed tracks
    }
  }

  play(offset: number = 0): void {
    if (!this.audioBuffer) return;

    // Stop any existing source
    if (this.sourceNode) {
      this.sourceNode.stop();
      this.sourceNode.disconnect();
    }

    // Create new source node and connect to audio chain
    this.sourceNode = this.audioContext.createBufferSource();
    this.sourceNode.buffer = this.audioBuffer;
    this.sourceNode.connect(this.gainNode);
    
    // Start playback from the current position
    try {
      this.sourceNode.start(0, offset);
    } catch (error) {
      console.warn(`Failed to start track ${this.track.name}:`, error);
    }
  }

  pause(): void {
    if (this.sourceNode) {
      this.sourceNode.stop();
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
  }

  stop(): void {
    this.pause();
  }

  setVolume(volume: number): void {
    // Smooth volume changes to avoid audio clicks
    if (this.gainNode.gain.setTargetAtTime) {
      this.gainNode.gain.setTargetAtTime(volume / 100, this.audioContext.currentTime, 0.01);
    } else {
      this.gainNode.gain.value = volume / 100;
    }
  }

  setBalance(balance: number): void {
    // Convert balance from -50/+50 range to -1/+1 for StereoPannerNode
    const panValue = Math.max(-1, Math.min(1, balance / 50));
    if (this.pannerNode.pan.setTargetAtTime) {
      this.pannerNode.pan.setTargetAtTime(panValue, this.audioContext.currentTime, 0.01);
    } else {
      this.pannerNode.pan.value = panValue;
    }
  }

  toggleMute(): void {
    this.isMuted = !this.isMuted;
    // Smooth mute/unmute to avoid audio clicks
    if (this.muteNode.gain.setTargetAtTime) {
      this.muteNode.gain.setTargetAtTime(this.isMuted ? 0 : 1, this.audioContext.currentTime, 0.01);
    } else {
      this.muteNode.gain.value = this.isMuted ? 0 : 1;
    }
  }

  toggleSolo(): void {
    this.isSolo = !this.isSolo;
  }

  updateSoloState(anyTrackSolo: boolean): void {
    const targetGain = (anyTrackSolo && !this.isSolo) ? 0 : (this.isMuted ? 0 : 1);
    
    // Smooth solo state changes
    if (this.muteNode.gain.setTargetAtTime) {
      this.muteNode.gain.setTargetAtTime(targetGain, this.audioContext.currentTime, 0.01);
    } else {
      this.muteNode.gain.value = targetGain;
    }
  }

  connect(destination: AudioNode): void {
    this.muteNode.connect(destination);
  }

  connectAnalyzer(analyzerNode: AnalyserNode): void {
    // Connect after the panner but before mute for accurate level monitoring
    this.pannerNode.connect(analyzerNode);
  }
}
