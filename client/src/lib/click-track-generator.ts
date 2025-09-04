// Click track generator for professional metronome functionality
// Uses Web Audio API for precise timing and professional sound quality

export interface ClickTrackConfig {
  bpm: number;
  countInMeasures: 1 | 2 | 3 | 4;
  volume: number; // 0.0 to 1.0
  enabled: boolean;
  accentDownbeat: boolean; // Different sound for beat 1
}

export class ClickTrackGenerator {
  private audioContext: AudioContext;
  private gainNode: GainNode;
  private isPlaying: boolean = false;
  private clickInterval: number | null = null;
  private countInTimeout: number | null = null;
  private clickCount: number = 0;
  private totalCountInBeats: number = 0;
  private onCountInComplete?: () => void;

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
    this.gainNode = this.audioContext.createGain();
    // Don't connect to destination by default - let the caller decide where to connect
    console.log('🎯 Click track generator initialized');
  }

  // Connect click track to a specific output (for master routing)
  connectToOutput(outputNode: AudioNode): void {
    this.gainNode.connect(outputNode);
    console.log('🎯 Click track connected to master output');
  }

  // Generate professional metronome click sound
  private createClickSound(frequency: number = 800, isAccent: boolean = false): void {
    const oscillator = this.audioContext.createOscillator();
    const envelope = this.audioContext.createGain();

    // Configure oscillator
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(
      isAccent ? frequency * 1.5 : frequency, // Higher pitch for accented beats
      this.audioContext.currentTime
    );

    // Configure envelope for sharp click
    envelope.gain.setValueAtTime(0, this.audioContext.currentTime);
    envelope.gain.linearRampToValueAtTime(0.3, this.audioContext.currentTime + 0.001);
    envelope.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);

    // Connect audio nodes
    oscillator.connect(envelope);
    envelope.connect(this.gainNode);

    // Play the click
    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + 0.1);
  }

  // Start count-in sequence before song playback
  startCountIn(config: ClickTrackConfig, onComplete?: () => void): void {
    if (this.isPlaying) {
      this.stop();
    }

    this.onCountInComplete = onComplete;
    this.gainNode.gain.setValueAtTime(config.volume, this.audioContext.currentTime);
    
    // Calculate timing
    const beatInterval = 60000 / config.bpm; // milliseconds per beat
    this.totalCountInBeats = config.countInMeasures * 4; // 4 beats per measure
    this.clickCount = 0;
    
    console.log(`🎯 Starting count-in: ${config.countInMeasures} measures at ${config.bpm} BPM`);
    
    this.isPlaying = true;

    // Start count-in immediately
    this.playCountInClick(config, beatInterval);
  }

  private playCountInClick(config: ClickTrackConfig, beatInterval: number): void {
    if (!this.isPlaying || this.clickCount >= this.totalCountInBeats) {
      // Count-in complete
      this.isPlaying = false;
      console.log('🎯 Count-in complete, starting song');
      this.onCountInComplete?.();
      return;
    }

    // Play click sound
    const isDownbeat = (this.clickCount % 4) === 0;
    this.createClickSound(800, config.accentDownbeat && isDownbeat);
    
    this.clickCount++;
    
    // Schedule next click
    this.countInTimeout = window.setTimeout(() => {
      this.playCountInClick(config, beatInterval);
    }, beatInterval);
  }

  // Start continuous click track during song playback
  startContinuous(config: ClickTrackConfig): void {
    if (!config.enabled) return;

    this.gainNode.gain.setValueAtTime(config.volume, this.audioContext.currentTime);
    
    const beatInterval = 60000 / config.bpm;
    this.clickCount = 0;
    this.isPlaying = true;
    
    console.log(`🎯 Starting continuous click track at ${config.bpm} BPM`);
    
    this.playContinuousClick(config, beatInterval);
  }

  private playContinuousClick(config: ClickTrackConfig, beatInterval: number): void {
    if (!this.isPlaying || !config.enabled) return;

    // Play click sound
    const isDownbeat = (this.clickCount % 4) === 0;
    this.createClickSound(800, config.accentDownbeat && isDownbeat);
    
    this.clickCount++;
    
    // Schedule next click
    this.clickInterval = window.setTimeout(() => {
      this.playContinuousClick(config, beatInterval);
    }, beatInterval);
  }

  // Stop all click track playback
  stop(): void {
    this.isPlaying = false;
    
    if (this.clickInterval) {
      clearTimeout(this.clickInterval);
      this.clickInterval = null;
    }
    
    if (this.countInTimeout) {
      clearTimeout(this.countInTimeout);
      this.countInTimeout = null;
    }
    
    console.log('🎯 Click track stopped');
  }

  // Update volume without stopping playback
  setVolume(volume: number): void {
    this.gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
  }

  // Clean up resources
  destroy(): void {
    this.stop();
    this.gainNode.disconnect();
    console.log('🎯 Click track generator destroyed');
  }
}