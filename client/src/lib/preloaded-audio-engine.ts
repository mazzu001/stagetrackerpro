// Preloaded audio engine with full pitch shifting capabilities
// Uses AudioBuffer for complete audio manipulation

export interface PreloadedTrack {
  id: string;
  name: string;
  url: string;
  audioBuffer: AudioBuffer | null;
  bufferSource: AudioBufferSourceNode | null;
  gainNode: GainNode | null;
  panNode: StereoPannerNode | null;
  analyzerNode: AnalyserNode | null;
  pitchShiftNode: AudioWorkletNode | null; // For pitch shifting
  volume: number;
  balance: number;
  isMuted: boolean;
  isSolo: boolean;
  isLoaded: boolean;
}

export interface PreloadedAudioEngineState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  tracks: PreloadedTrack[];
  masterVolume: number;
  masterGainNode: GainNode | null;
  masterOutputNode: GainNode | null;
  pitchOffset: number; // Global pitch offset in semitones
  isLoading: boolean;
  loadingProgress: number;
}

export class PreloadedAudioEngine {
  private audioContext: AudioContext;
  private state: PreloadedAudioEngineState;
  private listeners: Set<() => void> = new Set();
  private updateInterval: number | null = null;
  private startTime: number = 0;
  private pausedTime: number = 0;
  private onSongEndCallback: (() => void) | null = null;

  constructor() {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.state = {
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      tracks: [],
      masterVolume: 0.8,
      masterGainNode: null,
      masterOutputNode: null,
      pitchOffset: 0,
      isLoading: false,
      loadingProgress: 0,
    };
    this.setupMasterOutput();
  }

  private setupMasterOutput() {
    // Create master gain node (for volume control)
    this.state.masterGainNode = this.audioContext.createGain();
    this.state.masterGainNode.gain.value = this.state.masterVolume;
    
    // Create master output node
    this.state.masterOutputNode = this.audioContext.createGain();
    
    // Simple and reliable audio routing
    this.state.masterGainNode.connect(this.state.masterOutputNode);
    this.state.masterOutputNode.connect(this.audioContext.destination);
    
    console.log('🎵 Preloaded master output initialized');
  }

  // Pitch shifting using simple playback rate manipulation
  private createPitchShiftedBuffer(originalBuffer: AudioBuffer, semitones: number): AudioBuffer {
    if (semitones === 0) return originalBuffer;
    
    // Calculate pitch shift ratio (2^(semitones/12))
    const pitchRatio = Math.pow(2, semitones / 12);
    
    // Create new buffer with adjusted length
    const newLength = Math.floor(originalBuffer.length / pitchRatio);
    const newBuffer = this.audioContext.createBuffer(
      originalBuffer.numberOfChannels,
      newLength,
      originalBuffer.sampleRate
    );
    
    // Simple resampling - not perfect but functional for basic pitch shifting
    for (let channel = 0; channel < originalBuffer.numberOfChannels; channel++) {
      const originalData = originalBuffer.getChannelData(channel);
      const newData = newBuffer.getChannelData(channel);
      
      for (let i = 0; i < newLength; i++) {
        const originalIndex = i * pitchRatio;
        const index1 = Math.floor(originalIndex);
        const index2 = Math.min(index1 + 1, originalData.length - 1);
        const fraction = originalIndex - index1;
        
        // Linear interpolation
        newData[i] = originalData[index1] * (1 - fraction) + originalData[index2] * fraction;
      }
    }
    
    return newBuffer;
  }

  // Load and decode audio tracks with pitch processing
  async loadTracks(trackData: Array<{ id: string; name: string; url: string }>, pitchOffset: number = 0) {
    console.log(`🚀 Preloaded load: ${trackData.length} tracks with pitch offset: ${pitchOffset}`);
    
    this.state.isLoading = true;
    this.state.loadingProgress = 0;
    this.state.pitchOffset = pitchOffset;
    
    // Clear existing tracks first
    this.clearTracks();
    
    // Create track references
    const tracks = trackData.map(track => ({
      id: track.id,
      name: track.name,
      url: track.url,
      audioBuffer: null as AudioBuffer | null,
      bufferSource: null as AudioBufferSourceNode | null,
      gainNode: null as GainNode | null,
      panNode: null as StereoPannerNode | null,
      analyzerNode: null as AnalyserNode | null,
      pitchShiftNode: null as AudioWorkletNode | null,
      volume: 1,
      balance: 0,
      isMuted: false,
      isSolo: false,
      isLoaded: false,
    }));
    
    this.state.tracks = tracks;
    this.notifyListeners();
    
    // Load and decode each track
    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      
      try {
        console.log(`🔄 Loading track ${i + 1}/${tracks.length}: ${track.name}`);
        
        // Fetch audio data
        const response = await fetch(track.url);
        const arrayBuffer = await response.arrayBuffer();
        
        // Decode audio data
        const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
        
        // Apply pitch shifting if needed
        track.audioBuffer = this.createPitchShiftedBuffer(audioBuffer, pitchOffset);
        track.isLoaded = true;
        
        // Update loading progress
        this.state.loadingProgress = ((i + 1) / tracks.length) * 100;
        
        console.log(`✅ Track loaded: ${track.name} (${pitchOffset} semitones)`);
        this.notifyListeners();
        
      } catch (error) {
        console.error(`❌ Failed to load track: ${track.name}`, error);
        track.isLoaded = false;
      }
    }
    
    // Calculate total duration from longest track
    this.state.duration = Math.max(...tracks
      .filter(t => t.audioBuffer)
      .map(t => t.audioBuffer!.duration)
    );
    
    this.state.isLoading = false;
    this.state.loadingProgress = 100;
    
    this.notifyListeners();
    console.log(`✅ Preloaded ready: ${tracks.length} tracks loaded with pitch ${pitchOffset}`);
  }

  private clearTracks() {
    // Stop any playing sources
    this.state.tracks.forEach(track => {
      if (track.bufferSource) {
        try {
          track.bufferSource.stop();
          track.bufferSource.disconnect();
        } catch (e) {
          // Source might already be stopped
        }
      }
    });
    
    this.state.tracks = [];
    this.state.duration = 0;
    this.state.currentTime = 0;
  }

  private setupTrackAudioNodes(track: PreloadedTrack) {
    if (!track.audioBuffer || track.bufferSource) return;
    
    // Create buffer source
    track.bufferSource = this.audioContext.createBufferSource();
    track.bufferSource.buffer = track.audioBuffer;
    
    // Create gain node for volume
    track.gainNode = this.audioContext.createGain();
    track.gainNode.gain.value = track.volume * (track.isMuted ? 0 : 1);
    
    // Create pan node for balance
    track.panNode = this.audioContext.createStereoPanner();
    track.panNode.pan.value = track.balance;
    
    // Create analyzer for VU meters
    track.analyzerNode = this.audioContext.createAnalyser();
    track.analyzerNode.fftSize = 256;
    
    // Connect audio graph
    track.bufferSource.connect(track.gainNode);
    track.gainNode.connect(track.panNode);
    track.panNode.connect(track.analyzerNode);
    track.analyzerNode.connect(this.state.masterGainNode!);
    
    // Handle track end
    track.bufferSource.onended = () => {
      track.bufferSource = null;
      // Check if all tracks ended
      const anyPlaying = this.state.tracks.some(t => t.bufferSource);
      if (!anyPlaying && this.state.isPlaying) {
        this.stop();
        this.onSongEndCallback?.();
      }
    };
  }

  async play() {
    if (this.state.isPlaying || this.state.isLoading) return;
    
    // Resume audio context if suspended
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
    
    console.log('▶️ Starting preloaded playback');
    
    // Set up and start all tracks
    this.state.tracks.forEach(track => {
      if (track.isLoaded && track.audioBuffer) {
        this.setupTrackAudioNodes(track);
        if (track.bufferSource) {
          track.bufferSource.start(0, this.pausedTime);
        }
      }
    });
    
    this.state.isPlaying = true;
    this.startTime = this.audioContext.currentTime - this.pausedTime;
    
    // Start time update loop
    this.startTimeUpdates();
    this.notifyListeners();
  }

  pause() {
    if (!this.state.isPlaying) return;
    
    console.log('⏸️ Pausing preloaded playback');
    
    // Stop all buffer sources
    this.state.tracks.forEach(track => {
      if (track.bufferSource) {
        try {
          track.bufferSource.stop();
          track.bufferSource.disconnect();
        } catch (e) {
          // Source might already be stopped
        }
        track.bufferSource = null;
      }
    });
    
    this.pausedTime = this.state.currentTime;
    this.state.isPlaying = false;
    
    this.stopTimeUpdates();
    this.notifyListeners();
  }

  stop() {
    console.log('⏹️ Stopping preloaded playback');
    
    // Stop all buffer sources
    this.state.tracks.forEach(track => {
      if (track.bufferSource) {
        try {
          track.bufferSource.stop();
          track.bufferSource.disconnect();
        } catch (e) {
          // Source might already be stopped
        }
        track.bufferSource = null;
      }
    });
    
    this.state.isPlaying = false;
    this.state.currentTime = 0;
    this.pausedTime = 0;
    this.startTime = 0;
    
    this.stopTimeUpdates();
    this.notifyListeners();
  }

  seekTo(time: number) {
    const wasPlaying = this.state.isPlaying;
    
    if (wasPlaying) {
      this.pause();
    }
    
    this.pausedTime = Math.max(0, Math.min(time, this.state.duration));
    this.state.currentTime = this.pausedTime;
    
    if (wasPlaying) {
      this.play();
    }
    
    this.notifyListeners();
  }

  // Time update methods
  private startTimeUpdates() {
    this.stopTimeUpdates();
    this.updateInterval = window.setInterval(() => {
      if (this.state.isPlaying) {
        this.state.currentTime = this.audioContext.currentTime - this.startTime;
        this.notifyListeners();
      }
    }, 100);
  }

  private stopTimeUpdates() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  // Track control methods
  updateTrackVolume(trackId: string, volume: number) {
    const track = this.state.tracks.find(t => t.id === trackId);
    if (track) {
      track.volume = volume;
      if (track.gainNode) {
        track.gainNode.gain.value = volume * (track.isMuted ? 0 : 1);
      }
      this.notifyListeners();
    }
  }

  updateTrackBalance(trackId: string, balance: number) {
    const track = this.state.tracks.find(t => t.id === trackId);
    if (track) {
      track.balance = balance;
      if (track.panNode) {
        track.panNode.pan.value = balance;
      }
      this.notifyListeners();
    }
  }

  updateTrackMute(trackId: string, isMuted: boolean) {
    const track = this.state.tracks.find(t => t.id === trackId);
    if (track) {
      track.isMuted = isMuted;
      if (track.gainNode) {
        track.gainNode.gain.value = track.volume * (isMuted ? 0 : 1);
      }
      this.notifyListeners();
    }
  }

  updateTrackSolo(trackId: string, isSolo: boolean) {
    const track = this.state.tracks.find(t => t.id === trackId);
    if (track) {
      track.isSolo = isSolo;
      
      // Update all tracks based on solo state
      const hasSoloTracks = this.state.tracks.some(t => t.isSolo);
      
      this.state.tracks.forEach(t => {
        const shouldPlay = !hasSoloTracks || t.isSolo;
        if (t.gainNode) {
          t.gainNode.gain.value = t.volume * (t.isMuted || !shouldPlay ? 0 : 1);
        }
      });
      
      this.notifyListeners();
    }
  }

  updateMasterVolume(volume: number) {
    this.state.masterVolume = volume;
    if (this.state.masterGainNode) {
      this.state.masterGainNode.gain.value = volume;
    }
    this.notifyListeners();
  }

  // Listener management
  addListener(callback: () => void) {
    this.listeners.add(callback);
  }

  removeListener(callback: () => void) {
    this.listeners.delete(callback);
  }

  private notifyListeners() {
    this.listeners.forEach(callback => callback());
  }

  // State access
  getState() {
    return { ...this.state };
  }

  // VU meter data
  getVUMeterData(trackId: string) {
    const track = this.state.tracks.find(t => t.id === trackId);
    if (!track?.analyzerNode) return { left: 0, right: 0 };
    
    const dataArray = new Uint8Array(track.analyzerNode.frequencyBinCount);
    track.analyzerNode.getByteFrequencyData(dataArray);
    
    // Calculate average level (simple approximation)
    const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
    const level = average / 255;
    
    return { left: level, right: level };
  }

  // Cleanup
  dispose() {
    this.clearTracks();
    this.stopTimeUpdates();
    this.listeners.clear();
    
    if (this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
  }

  // Song end callback
  onSongEnd(callback: () => void) {
    this.onSongEndCallback = callback;
  }
}