import type { SongWithTracks, Track } from "@shared/schema";

export class AudioEngine {
  private audioContext: AudioContext | null = null;
  private masterGainNode: GainNode | null = null;
  private tracks: Map<string, TrackController> = new Map();
  private currentSong: SongWithTracks | null = null;
  private startTime: number = 0;
  private pausedTime: number = 0;
  private isPlaying: boolean = false;
  private analyzerNodes: Map<string, AnalyserNode> = new Map();

  async initialize(): Promise<void> {
    try {
      this.audioContext = new AudioContext();
      this.masterGainNode = this.audioContext.createGain();
      this.masterGainNode.connect(this.audioContext.destination);
      
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

    // Load each track
    for (const track of song.tracks) {
      try {
        const trackController = new TrackController(
          this.audioContext,
          this.masterGainNode,
          track
        );
        await trackController.load();
        this.tracks.set(track.id, trackController);

        // Create analyzer for audio level monitoring
        const analyzer = this.audioContext.createAnalyser();
        analyzer.fftSize = 256;
        trackController.connect(analyzer);
        this.analyzerNodes.set(track.id, analyzer);
      } catch (error) {
        console.error(`Failed to load track ${track.name}:`, error);
      }
    }
  }

  play(): void {
    if (!this.audioContext || !this.currentSong) return;

    this.isPlaying = true;
    this.startTime = this.audioContext.currentTime - this.pausedTime;

    this.tracks.forEach(track => track.play(this.startTime));
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

  seek(time: number): void {
    if (!this.audioContext) return;

    this.pausedTime = time;
    if (this.isPlaying) {
      this.stop();
      this.play();
    }
  }

  getCurrentTime(): number {
    if (!this.audioContext) return 0;
    
    if (this.isPlaying) {
      return this.audioContext.currentTime - this.startTime;
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

  getAudioLevels(): Record<string, number> {
    const levels: Record<string, number> = {};
    
    this.analyzerNodes.forEach((analyzer, trackId) => {
      const bufferLength = analyzer.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyzer.getByteFrequencyData(dataArray);
      
      // Calculate RMS level
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i] * dataArray[i];
      }
      const rms = Math.sqrt(sum / bufferLength);
      levels[trackId] = Math.min(100, (rms / 255) * 100 * 1.5); // Scale and limit
    });
    
    return levels;
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
  public isSolo: boolean = false;
  private isMuted: boolean = false;

  constructor(audioContext: AudioContext, masterGain: GainNode, track: Track) {
    this.audioContext = audioContext;
    this.masterGain = masterGain;
    this.track = track;
    
    // Create gain nodes for volume and mute control
    this.gainNode = audioContext.createGain();
    this.muteNode = audioContext.createGain();
    
    // Set initial values
    this.gainNode.gain.value = (track.volume || 100) / 100;
    this.muteNode.gain.value = track.isMuted ? 0 : 1;
    this.isMuted = track.isMuted || false;
    this.isSolo = track.isSolo || false;
    
    // Connect nodes
    this.gainNode.connect(this.muteNode);
    this.muteNode.connect(this.masterGain);
  }

  async load(): Promise<void> {
    try {
      // In a real implementation, this would load from the actual audio file
      // For now, we'll create a mock audio buffer or handle the case gracefully
      console.log(`Loading track: ${this.track.name} from ${this.track.audioUrl}`);
      
      // Create a silent buffer as fallback for development
      this.audioBuffer = this.audioContext.createBuffer(2, this.audioContext.sampleRate * 300, this.audioContext.sampleRate);
    } catch (error) {
      console.error(`Failed to load audio for track ${this.track.name}:`, error);
      throw error;
    }
  }

  play(startTime: number): void {
    if (!this.audioBuffer) return;

    // Stop any existing source
    if (this.sourceNode) {
      this.sourceNode.stop();
    }

    // Create new source node
    this.sourceNode = this.audioContext.createBufferSource();
    this.sourceNode.buffer = this.audioBuffer;
    this.sourceNode.connect(this.gainNode);
    
    // Start playback
    this.sourceNode.start(0);
  }

  pause(): void {
    if (this.sourceNode) {
      this.sourceNode.stop();
      this.sourceNode = null;
    }
  }

  stop(): void {
    this.pause();
  }

  setVolume(volume: number): void {
    this.gainNode.gain.value = volume / 100;
  }

  toggleMute(): void {
    this.isMuted = !this.isMuted;
    this.muteNode.gain.value = this.isMuted ? 0 : 1;
  }

  toggleSolo(): void {
    this.isSolo = !this.isSolo;
  }

  updateSoloState(anyTrackSolo: boolean): void {
    if (anyTrackSolo && !this.isSolo) {
      this.muteNode.gain.value = 0;
    } else if (!anyTrackSolo || this.isSolo) {
      this.muteNode.gain.value = this.isMuted ? 0 : 1;
    }
  }

  connect(destination: AudioNode): void {
    this.muteNode.connect(destination);
  }
}
