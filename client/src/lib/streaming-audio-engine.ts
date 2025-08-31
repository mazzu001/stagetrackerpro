// Streaming audio engine with lazy initialization to prevent UI blocking

export interface StreamingTrack {
  id: string;
  name: string;
  url: string;
  audioElement: HTMLAudioElement | null;
  source: MediaElementAudioSourceNode | null;
  gainNode: GainNode | null;
  panNode: StereoPannerNode | null;
  analyzerNode: AnalyserNode | null;
  volume: number;
  balance: number;
  isMuted: boolean;
  isSolo: boolean;
}

export interface StreamingAudioEngineState {
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

  // Instant track loading with deferred audio node creation
  loadTracks(trackData: Array<{ id: string; name: string; url: string }>) {
    console.log(`🚀 Streaming load: ${trackData.length} tracks (deferred setup)`);
    
    // Clear existing tracks first
    this.clearTracks();
    
    // Create lightweight track references without audio nodes yet
    const tracks = trackData.map(track => ({
      id: track.id,
      name: track.name,
      url: track.url,
      audioElement: null as HTMLAudioElement | null,
      source: null as MediaElementAudioSourceNode | null,
      gainNode: null as GainNode | null,
      panNode: null as StereoPannerNode | null,
      analyzerNode: null as AnalyserNode | null,
      volume: 1,
      balance: 0,
      isMuted: false,
      isSolo: false,
    }));
    
    this.state.tracks = tracks;
    
    // Set up duration detection in background
    if (tracks.length > 0) {
      setTimeout(() => this.setupDurationDetection(), 0);
    }
    
    this.notifyListeners();
    console.log(`✅ Streaming ready: ${tracks.length} tracks setup instantly (audio nodes created on demand)`);
  }

  // Auto-generate waveform in background for responsive UI
  async autoGenerateWaveform(song: any) {
    if (this.state.tracks.length > 0 && song) {
      console.log(`Starting automatic waveform generation for "${song.title}"...`);
      try {
        const { waveformGenerator } = await import('./waveform-generator');
        const waveformData = await waveformGenerator.generateWaveformFromSong(song);
        console.log(`📈 Waveform auto-generated for "${song.title}" (${waveformData.length} data points)`);
      } catch (error) {
        console.error(`❌ Failed to auto-generate waveform for "${song.title}":`, error);
      }
    }
  }

  // Create audio nodes on demand to avoid blocking UI
  private ensureTrackAudioNodes(track: StreamingTrack) {
    if (track.audioElement) return; // Already created
    
    try {
      // Create audio element
      track.audioElement = new Audio();
      track.audioElement.src = track.url;
      track.audioElement.preload = 'none'; // CRITICAL: No preloading
      track.audioElement.crossOrigin = 'anonymous';
      track.audioElement.loop = false; // Prevent auto-loop
      
      // Add event listeners to debug stopping issue
      track.audioElement.addEventListener('ended', () => {
        console.log(`🚨 Track "${track.name}" ENDED at ${track.audioElement?.currentTime}s`);
      });
      
      track.audioElement.addEventListener('pause', () => {
        console.log(`⏸️ Track "${track.name}" PAUSED at ${track.audioElement?.currentTime}s`);
      });
      
      track.audioElement.addEventListener('stalled', () => {
        console.log(`🐌 Track "${track.name}" STALLED - buffering issue`);
      });
      
      track.audioElement.addEventListener('suspend', () => {
        console.log(`⏹️ Track "${track.name}" SUSPENDED - browser auto-paused`);
      });
      
      track.audioElement.addEventListener('error', (e) => {
        console.log(`❌ Track "${track.name}" ERROR:`, e);
      });
      
      // Create audio nodes
      track.source = this.audioContext.createMediaElementSource(track.audioElement);
      track.gainNode = this.audioContext.createGain();
      track.panNode = this.audioContext.createStereoPanner();
      track.analyzerNode = this.audioContext.createAnalyser();
      
      // Connect audio graph
      track.source.connect(track.gainNode);
      track.gainNode.connect(track.panNode);
      track.panNode.connect(track.analyzerNode);
      track.analyzerNode.connect(this.state.masterGainNode!);
      
      // Setup analyzer with better frequency resolution for responsive VU meters
      track.analyzerNode.fftSize = 512; // Increased for better frequency analysis
      track.analyzerNode.smoothingTimeConstant = 0.6; // Less smoothing for more responsive meters
      
      console.log(`🔧 Audio nodes created on demand for: ${track.name}`);
    } catch (error) {
      console.error(`Failed to create audio nodes for ${track.name}:`, error);
    }
  }

  // Auto-determine duration from longest track
  private setupDurationDetection() {
    if (this.state.tracks.length === 0) return;
    
    // Set up listeners for each track to detect duration
    this.state.tracks.forEach(track => {
      this.ensureTrackAudioNodes(track);
      if (track.audioElement) {
        track.audioElement.addEventListener('loadedmetadata', () => {
          if (this.state.tracks.length > 0) {
            const maxDuration = Math.max(...this.state.tracks.map(t => {
              return t.audioElement?.duration || 0;
            }));
            
            if (maxDuration > 0 && maxDuration !== this.state.duration) {
              this.state.duration = maxDuration;
              this.notifyListeners();
            }
          }
        });
      }
    });
    
    // Fallback: keep checking until we get a duration
    const checkDuration = () => {
      if (this.state.tracks.length > 0) {
        const maxDuration = Math.max(...this.state.tracks.map(t => {
          return t.audioElement?.duration || 0;
        }));
        
        if (maxDuration > 0) {
          this.state.duration = maxDuration;
          this.notifyListeners();
        } else {
          setTimeout(checkDuration, 100);
        }
      }
    };
    checkDuration();
  }

  // Instant play - no loading delays
  async play() {
    if (this.state.tracks.length === 0) return;
    
    // Ensure all tracks have audio nodes
    this.state.tracks.forEach(track => this.ensureTrackAudioNodes(track));
    
    // Resume audio context if suspended
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
    
    console.log(`▶️ Starting streaming playback: ${this.state.tracks.length} tracks`);
    
    // Start all tracks simultaneously
    const playPromises = this.state.tracks.map(track => {
      if (track.audioElement) {
        track.audioElement.currentTime = this.state.currentTime;
        return track.audioElement.play().catch(err => {
          console.warn(`Failed to start streaming track ${track.name}:`, err);
        });
      }
      return Promise.resolve();
    });
    
    await Promise.allSettled(playPromises);
    
    this.state.isPlaying = true;
    this.startTimeTracking();
    this.notifyListeners();
    
    console.log(`✅ Streaming playback started instantly`);
  }

  pause() {
    this.state.tracks.forEach(track => {
      if (track.audioElement) {
        track.audioElement.pause();
      }
    });
    
    this.state.isPlaying = false;
    this.stopTimeTracking();
    this.notifyListeners();
    
    console.log(`⏸️ Streaming playback paused`);
  }

  stop() {
    this.state.tracks.forEach(track => {
      if (track.audioElement) {
        track.audioElement.pause();
        track.audioElement.currentTime = 0;
      }
    });
    
    this.state.isPlaying = false;
    this.state.currentTime = 0;
    this.stopTimeTracking();
    this.notifyListeners();
    
    console.log(`⏹️ Streaming playback stopped`);
  }

  seek(time: number) {
    this.state.currentTime = Math.max(0, Math.min(this.state.duration, time));
    
    // Sync all tracks to new time
    this.state.tracks.forEach(track => {
      if (track.audioElement) {
        track.audioElement.currentTime = this.state.currentTime;
      }
    });
    
    this.notifyListeners();
    console.log(`⏯️ Streamed to ${this.state.currentTime.toFixed(1)}s`);
  }

  // Track control methods
  setTrackVolume(trackId: string, volume: number) {
    const track = this.state.tracks.find(t => t.id === trackId);
    if (track) {
      track.volume = volume;
      this.ensureTrackAudioNodes(track);
      if (track.gainNode) {
        // Convert 0-100 volume to 0-1 gain range
        track.gainNode.gain.value = volume / 100;
      }
    }
  }

  toggleTrackMute(trackId: string) {
    const track = this.state.tracks.find(t => t.id === trackId);
    if (track) {
      track.isMuted = !track.isMuted;
      this.ensureTrackAudioNodes(track);
      if (track.gainNode) {
        // Convert 0-100 volume to 0-1 gain range when unmuting
        track.gainNode.gain.value = track.isMuted ? 0 : track.volume / 100;
      }
    }
  }

  toggleTrackSolo(trackId: string) {
    const track = this.state.tracks.find(t => t.id === trackId);
    if (track) {
      track.isSolo = !track.isSolo;
      this.updateSoloStates();
    }
  }

  setTrackBalance(trackId: string, balance: number) {
    const track = this.state.tracks.find(t => t.id === trackId);
    if (track) {
      track.balance = balance;
      this.ensureTrackAudioNodes(track);
      if (track.panNode) {
        // Convert -100 to +100 balance to -1 to +1 pan range
        track.panNode.pan.value = balance / 100;
      }
    }
  }

  private updateSoloStates() {
    const hasSoloTracks = this.state.tracks.some(t => t.isSolo);
    
    this.state.tracks.forEach(track => {
      this.ensureTrackAudioNodes(track);
      const shouldMute = hasSoloTracks && !track.isSolo;
      if (track.gainNode) {
        // Convert 0-100 volume to 0-1 gain range when not muted
        track.gainNode.gain.value = shouldMute ? 0 : track.volume / 100;
      }
    });
  }

  setMasterVolume(volume: number) {
    this.state.masterVolume = volume;
    if (this.state.masterGainNode) {
      this.state.masterGainNode.gain.value = volume;
    }
  }

  getTrackLevels(trackId: string): { left: number; right: number } {
    const track = this.state.tracks.find(t => t.id === trackId);
    if (!track) {
      return { left: 0, right: 0 };
    }

    this.ensureTrackAudioNodes(track);
    
    if (!track.analyzerNode) {
      return { left: 0, right: 0 };
    }

    const bufferLength = track.analyzerNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    track.analyzerNode.getByteFrequencyData(dataArray);
    
    // Include full frequency spectrum for bass-heavy tracks
    const startBin = Math.floor(bufferLength * 0.02); // Skip only sub-bass (below ~20Hz)
    const endBin = Math.floor(bufferLength * 0.95);   // Use almost full frequency range
    
    // Calculate weighted average with balanced frequency representation
    let sum = 0;
    let weightedCount = 0;
    for (let i = startBin; i < endBin; i++) {
      // Balanced frequency weighting - no extreme bass boost
      let weight = 1.0;
      if (i < bufferLength * 0.08) weight = 2.0; // Gentle boost for kick/sub-bass (20-80 Hz)
      else if (i < bufferLength * 0.2) weight = 1.8; // Mild boost for bass (80-400 Hz)
      else if (i < bufferLength * 0.4) weight = 1.2; // Slight mid boost
      else weight = 1.1; // Slight high boost
      
      sum += dataArray[i] * weight;
      weightedCount += weight;
    }
    
    const rawAverage = sum / weightedCount / 255; // Normalize to 0-1
    
    // Increased amplification so peaks can reach yellow zone
    const average = rawAverage * 1.3; // Increased from 0.85 to allow peaks into yellow range
    
    // Return simulated stereo levels (would need separate analyzers for true stereo)
    return { left: average, right: average };
  }

  getMasterLevels(): { left: number; right: number } {
    // Calculate combined levels from all tracks
    const combinedLevels = this.state.tracks.reduce((total, tr) => {
      const trackLevels = this.getTrackLevels(tr.id);
      return {
        left: Math.max(total.left, trackLevels.left),
        right: Math.max(total.right, trackLevels.right)
      };
    }, { left: 0, right: 0 });
    
    return combinedLevels;
  }

  // Time tracking for smooth playback
  private startTimeTracking() {
    this.stopTimeTracking(); // Clear any existing interval
    
    this.updateInterval = window.setInterval(() => {
      if (this.state.isPlaying && this.state.tracks.length > 0) {
        // Use the first track as time reference
        const firstTrack = this.state.tracks[0];
        if (firstTrack.audioElement) {
          const currentTime = firstTrack.audioElement.currentTime;
          this.state.currentTime = currentTime;
          this.notifyListeners();
        }
      }
    }, 16); // ~60fps updates
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
      if (track.audioElement) {
        track.audioElement.pause();
        track.audioElement.src = '';
      }
    });
    this.state.tracks = [];
  }

  getState(): StreamingAudioEngineState {
    return { ...this.state };
  }

  getAudioContext(): AudioContext {
    return this.audioContext;
  }

  get isLoading(): boolean {
    return false; // Streaming is always ready
  }

  get isReady(): boolean {
    return this.state.tracks.length > 0;
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener());
  }

  dispose() {
    this.stopTimeTracking();
    this.clearTracks();
    if (this.state.masterGainNode) {
      this.state.masterGainNode.disconnect();
    }
    if (this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
  }
}