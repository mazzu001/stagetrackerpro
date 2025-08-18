import type { SongWithTracks, Track } from "@shared/schema";
import { persistence } from "./storage-persistence";

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

    // Wait for tracks to load if they're still loading
    if (this.tracks.size === 0 && this.currentSong.tracks.length > 0) {
      console.log('Waiting for tracks to load...');
      // Wait up to 10 seconds for tracks to load
      const maxWaitTime = 10000; // 10 seconds
      const startTime = Date.now();
      
      while (this.tracks.size === 0 && (Date.now() - startTime) < maxWaitTime) {
        console.log(`Waiting for all tracks to load (${this.tracks.size}/${this.currentSong.tracks.length})...`);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      if (this.tracks.size === 0) {
        console.warn('Timeout waiting for tracks to load. Playing with 0/6 tracks.');
        console.warn('No tracks loaded, cannot start playback');
        return;
      }
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

  getAudioLevels(): Record<string, number> {
    const levels: Record<string, number> = {};
    
    this.analyzerNodes.forEach((analyzer, trackId) => {
      const track = this.tracks.get(trackId);
      if (!track || !this.isPlaying) {
        levels[trackId] = 0;
        return;
      }

      const bufferLength = analyzer.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyzer.getByteTimeDomainData(dataArray); // Use time domain for better level detection
      
      // Calculate RMS level from time domain data
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        const normalized = (dataArray[i] - 128) / 128; // Convert to -1 to 1 range
        sum += normalized * normalized;
      }
      const rms = Math.sqrt(sum / bufferLength);
      levels[trackId] = Math.min(100, rms * 100 * 3); // Scale and limit for better visibility
    });
    
    return levels;
  }

  getMasterStereoLevels(): { left: number; right: number } {
    if (!this.masterAnalyzerNode || !this.isPlaying) {
      return { left: 0, right: 0 };
    }

    const bufferLength = this.masterAnalyzerNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.masterAnalyzerNode.getByteTimeDomainData(dataArray);
    
    // For stereo simulation, split data into left and right channels
    const leftChannelData = dataArray.slice(0, bufferLength / 2);
    const rightChannelData = dataArray.slice(bufferLength / 2);
    
    // Calculate RMS for left channel
    let leftSum = 0;
    for (let i = 0; i < leftChannelData.length; i++) {
      const normalized = (leftChannelData[i] - 128) / 128;
      leftSum += normalized * normalized;
    }
    const leftRms = Math.sqrt(leftSum / leftChannelData.length);
    
    // Calculate RMS for right channel
    let rightSum = 0;
    for (let i = 0; i < rightChannelData.length; i++) {
      const normalized = (rightChannelData[i] - 128) / 128;
      rightSum += normalized * normalized;
    }
    const rightRms = Math.sqrt(rightSum / rightChannelData.length);
    
    // Add some variation between channels for visual interest
    const leftLevel = Math.min(100, leftRms * 100 * 3);
    const rightLevel = Math.min(100, rightRms * 100 * 3 * (0.95 + Math.random() * 0.1));
    
    return { 
      left: leftLevel, 
      right: rightLevel 
    };
  }

  dispose(): void {
    this.stop();
    this.tracks.clear();
    this.analyzerNodes.clear();
    
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
      console.log(`Loading track: ${this.track.name} from ${this.track.audioUrl}`);
      
      // Check if audioUrl exists and is a blob URL
      if (!this.track.audioUrl) {
        throw new Error(`Track ${this.track.name} has no audio URL`);
      }
      
      if (!this.track.audioUrl.startsWith('blob:')) {
        throw new Error(`Track ${this.track.name} must use blob URL for offline operation`);
      }
      
      // Handle blob URLs (client-side files)
      let audioUrl = this.track.audioUrl;
      
      // Check if we can restore the blob URL from stored file data first
      const restoredUrl = persistence.getBlobUrl(this.track.id);
      if (restoredUrl && restoredUrl !== this.track.audioUrl) {
        console.log(`Using restored blob URL for ${this.track.name}`);
        audioUrl = restoredUrl;
      } else if (!restoredUrl) {
        // No file data available, can't load this track
        console.warn(`No file data available for track ${this.track.name}. Please re-add the audio file.`);
        throw new Error(`Audio file not available for ${this.track.name}. Please re-add the audio file.`);
      }
      
      // Only fetch if we have a valid blob URL that's different from the original (i.e., restored)
      if (restoredUrl && restoredUrl !== this.track.audioUrl) {
        try {
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
          console.warn(`Failed to fetch audio for track ${this.track.name}. Please re-add the audio file.`);
          throw new Error(`Audio file not available for ${this.track.name}. Please re-add the audio file.`);
        }
      } else {
        // Original blob URL is expired and no restoration possible
        console.warn(`No file data available for track ${this.track.name}. Please re-add the audio file.`);
        throw new Error(`Audio file not available for ${this.track.name}. Please re-add the audio file.`);
      }
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
