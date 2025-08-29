/**
 * Streaming Audio Engine - Zero load time implementation
 * Streams audio tracks directly instead of preloading into memory
 */

interface StreamingTrack {
  id: string;
  name: string;
  audioElement: HTMLAudioElement;
  gainNode: GainNode;
  panNode: StereoPannerNode;
  analyzerNode: AnalyserNode;
  volume: number;
  muted: boolean;
  solo: boolean;
  balance: number;
  url: string;
}

interface StreamingAudioEngineState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  tracks: StreamingTrack[];
  masterVolume: number;
  masterGainNode: GainNode | null;
}

export class StreamingAudioEngine {
  private audioContext: AudioContext;
  private state: StreamingAudioEngineState;
  private listeners: Set<() => void> = new Set();
  private updateInterval: number | null = null;
  private syncTimeouts: number[] = [];

  constructor() {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.state = {
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      tracks: [],
      masterVolume: 0.8,
      masterGainNode: null,
    };
    this.setupMasterGain();
  }

  private setupMasterGain() {
    this.state.masterGainNode = this.audioContext.createGain();
    this.state.masterGainNode.connect(this.audioContext.destination);
    this.state.masterGainNode.gain.value = this.state.masterVolume;
  }

  // Instant track loading - no preloading required
  async loadTracks(trackData: Array<{ id: string; name: string; url: string }>) {
    console.log(`🚀 Streaming load: ${trackData.length} tracks (instant setup)`);
    
    // Clear existing tracks first
    this.clearTracks();
    
    // Create streaming tracks with lightweight setup
    const tracks = [];
    for (const track of trackData) {
      try {
        const streamingTrack = this.createStreamingTrack(track);
        tracks.push(streamingTrack);
        console.log(`✅ Streaming track ready: ${track.name}`);
      } catch (error) {
        console.warn(`⚠️ Failed to create streaming track: ${track.name}`, error);
      }
    }
    
    this.state.tracks = tracks;
    
    // Set up duration detection without blocking
    if (tracks.length > 0) {
      this.setupDurationDetection();
    }
    
    this.notifyListeners();
    console.log(`✅ Streaming ready: ${tracks.length} tracks loaded instantly`);
  }

  private createStreamingTrack(trackData: { id: string; name: string; url: string }): StreamingTrack {
    const audioElement = new Audio();
    audioElement.src = trackData.url;
    audioElement.preload = 'none'; // CRITICAL: No preloading to prevent crashes
    audioElement.crossOrigin = 'anonymous';
    
    // Create audio nodes with error handling
    let source, gainNode, panNode, analyzerNode;
    
    try {
      source = this.audioContext.createMediaElementSource(audioElement);
      gainNode = this.audioContext.createGain();
      panNode = this.audioContext.createStereoPanner();
      analyzerNode = this.audioContext.createAnalyser();
      
      // Connect audio graph safely
      source.connect(gainNode);
      gainNode.connect(panNode);
      panNode.connect(analyzerNode);
      analyzerNode.connect(this.state.masterGainNode!);
      
      // Setup analyzer with minimal settings
      analyzerNode.fftSize = 128; // Smaller to reduce CPU
    } catch (error) {
      console.error('Failed to create streaming track audio nodes:', error);
      throw error;
    }
    
    const track: StreamingTrack = {
      id: trackData.id,
      name: trackData.name,
      audioElement,
      gainNode,
      panNode,
      analyzerNode,
      volume: 0.8,
      muted: false,
      solo: false,
      balance: 0,
      url: trackData.url,
    };
    
    // Setup event listeners for streaming
    audioElement.addEventListener('loadedmetadata', () => {
      if (this.state.duration === 0) {
        this.state.duration = audioElement.duration;
        this.notifyListeners();
      }
    });
    
    audioElement.addEventListener('timeupdate', () => {
      if (this.state.isPlaying) {
        this.state.currentTime = audioElement.currentTime;
        this.notifyListeners();
      }
    });
    
    return track;
  }

  private setupDurationDetection() {
    const firstTrack = this.state.tracks[0];
    if (firstTrack) {
      const checkDuration = () => {
        if (firstTrack.audioElement.duration && !isNaN(firstTrack.audioElement.duration)) {
          this.state.duration = firstTrack.audioElement.duration;
          this.notifyListeners();
        } else {
          setTimeout(checkDuration, 100);
        }
      };
      checkDuration();
    }
  }

  // Instant play - no loading delays
  async play() {
    if (this.state.tracks.length === 0) return;
    
    // Resume audio context if suspended
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
    
    console.log(`▶️ Starting streaming playback: ${this.state.tracks.length} tracks`);
    
    // Start all tracks simultaneously
    const playPromises = this.state.tracks.map(track => {
      track.audioElement.currentTime = this.state.currentTime;
      return track.audioElement.play().catch(err => {
        console.warn(`Failed to start streaming track ${track.name}:`, err);
      });
    });
    
    await Promise.allSettled(playPromises);
    
    this.state.isPlaying = true;
    this.startTimeTracking();
    this.notifyListeners();
    
    console.log(`✅ Streaming playback started instantly`);
  }

  pause() {
    this.state.tracks.forEach(track => {
      track.audioElement.pause();
    });
    
    this.state.isPlaying = false;
    this.stopTimeTracking();
    this.notifyListeners();
    
    console.log(`⏸️ Streaming playback paused`);
  }

  stop() {
    this.state.tracks.forEach(track => {
      track.audioElement.pause();
      track.audioElement.currentTime = 0;
    });
    
    this.state.isPlaying = false;
    this.state.currentTime = 0;
    this.stopTimeTracking();
    this.notifyListeners();
    
    console.log(`⏹️ Streaming playback stopped`);
  }

  seek(time: number) {
    this.state.currentTime = Math.max(0, Math.min(time, this.state.duration));
    
    // Sync all tracks to new time
    this.state.tracks.forEach(track => {
      track.audioElement.currentTime = this.state.currentTime;
    });
    
    this.notifyListeners();
    console.log(`⏯️ Streamed to ${this.state.currentTime.toFixed(1)}s`);
  }

  // Track control methods
  setTrackVolume(trackId: string, volume: number) {
    const track = this.state.tracks.find(t => t.id === trackId);
    if (track) {
      track.volume = volume;
      track.gainNode.gain.value = track.muted ? 0 : volume;
      this.notifyListeners();
    }
  }

  toggleTrackMute(trackId: string) {
    const track = this.state.tracks.find(t => t.id === trackId);
    if (track) {
      track.muted = !track.muted;
      track.gainNode.gain.value = track.muted ? 0 : track.volume;
      this.notifyListeners();
    }
  }

  toggleTrackSolo(trackId: string) {
    const track = this.state.tracks.find(t => t.id === trackId);
    if (track) {
      track.solo = !track.solo;
      this.updateSoloStates();
      this.notifyListeners();
    }
  }

  setTrackBalance(trackId: string, balance: number) {
    const track = this.state.tracks.find(t => t.id === trackId);
    if (track) {
      track.balance = balance;
      track.panNode.pan.value = balance;
      this.notifyListeners();
    }
  }

  private updateSoloStates() {
    const hasSoloedTracks = this.state.tracks.some(t => t.solo);
    
    this.state.tracks.forEach(track => {
      const shouldPlay = !hasSoloedTracks || track.solo;
      track.gainNode.gain.value = (track.muted || !shouldPlay) ? 0 : track.volume;
    });
  }

  setMasterVolume(volume: number) {
    this.state.masterVolume = volume;
    if (this.state.masterGainNode) {
      this.state.masterGainNode.gain.value = volume;
    }
    this.notifyListeners();
  }

  // Get streaming audio levels for VU meters
  getTrackLevels(trackId: string): { left: number; right: number } {
    const track = this.state.tracks.find(t => t.id === trackId);
    if (!track) return { left: 0, right: 0 };
    
    const bufferLength = track.analyzerNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    track.analyzerNode.getByteFrequencyData(dataArray);
    
    // Calculate RMS level
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i] * dataArray[i];
    }
    const level = Math.sqrt(sum / bufferLength) / 255;
    
    return { left: level, right: level };
  }

  getMasterLevels(): { left: number; right: number } {
    // Average levels from all active tracks
    const activeTracks = this.state.tracks.filter(t => !t.muted && (!this.state.tracks.some(tr => tr.solo) || t.solo));
    
    if (activeTracks.length === 0) return { left: 0, right: 0 };
    
    let leftSum = 0;
    let rightSum = 0;
    
    activeTracks.forEach(track => {
      const levels = this.getTrackLevels(track.id);
      leftSum += levels.left;
      rightSum += levels.right;
    });
    
    return {
      left: leftSum / activeTracks.length,
      right: rightSum / activeTracks.length,
    };
  }

  private startTimeTracking() {
    this.stopTimeTracking();
    this.updateInterval = window.setInterval(() => {
      if (this.state.isPlaying && this.state.tracks.length > 0) {
        const firstTrack = this.state.tracks[0];
        this.state.currentTime = firstTrack.audioElement.currentTime;
        this.notifyListeners();
      }
    }, 100);
  }

  private stopTimeTracking() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    
    this.syncTimeouts.forEach(timeout => clearTimeout(timeout));
    this.syncTimeouts = [];
  }

  private clearTracks() {
    this.state.tracks.forEach(track => {
      track.audioElement.pause();
      track.audioElement.src = '';
    });
    this.state.tracks = [];
  }

  // State management
  getState(): StreamingAudioEngineState {
    return { ...this.state };
  }

  // Additional streaming-specific getters
  get isLoading(): boolean {
    return false; // Streaming is always instant, never loading
  }

  get isReady(): boolean {
    return this.state.tracks.length > 0;
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    this.listeners.forEach(listener => {
      try {
        listener();
      } catch (error) {
        console.error('Streaming audio engine listener error:', error);
      }
    });
  }

  // Cleanup
  dispose() {
    this.stop();
    this.clearTracks();
    this.stopTimeTracking();
    this.listeners.clear();
    
    // Enhanced AudioContext cleanup with error handling
    try {
      if (this.audioContext && this.audioContext.state !== 'closed') {
        this.audioContext.close();
        console.log('🔇 Streaming audio engine AudioContext closed');
      }
    } catch (error) {
      console.warn('⚠️ Error closing streaming audio engine AudioContext (already closed):', error);
    }
  }
}