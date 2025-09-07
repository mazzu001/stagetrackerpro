// Click track generator for professional metronome functionality
// Uses Web Audio API for precise timing and professional sound quality

export type MetronomeSound = 'square' | 'sine' | 'triangle' | 'sawtooth' | 'woodblock' | 'kick' | 'hihat';

export interface ClickTrackConfig {
  bpm: number;
  countInMeasures: 1 | 2 | 3 | 4;
  volume: number; // 0.0 to 1.0
  enabled: boolean;
  accentDownbeat: boolean; // Different sound for beat 1
  soundType?: MetronomeSound; // Sound preset to use
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
    this.gainNode.connect(this.audioContext.destination);
    console.log('🎯 Click track generator initialized');
  }

  // Generate professional metronome click sound with different presets
  private createClickSound(frequency: number = 800, isAccent: boolean = false, soundType: MetronomeSound = 'square'): void {
    const now = this.audioContext.currentTime;
    
    switch (soundType) {
      case 'sine':
        this.createToneSound('sine', isAccent ? frequency * 1.2 : frequency, isAccent ? 0.4 : 0.3, 0.15);
        break;
      
      case 'triangle':
        this.createToneSound('triangle', isAccent ? frequency * 1.3 : frequency, isAccent ? 0.35 : 0.25, 0.12);
        break;
      
      case 'sawtooth':
        this.createToneSound('sawtooth', isAccent ? frequency * 1.4 : frequency, isAccent ? 0.25 : 0.2, 0.08);
        break;
      
      case 'woodblock':
        this.createWoodblockSound(isAccent);
        break;
      
      case 'kick':
        this.createKickSound(isAccent);
        break;
      
      case 'hihat':
        this.createHihatSound(isAccent);
        break;
      
      default: // 'square'
        this.createToneSound('square', isAccent ? frequency * 1.5 : frequency, isAccent ? 0.3 : 0.25, 0.1);
        break;
    }
  }

  private createToneSound(type: OscillatorType, frequency: number, volume: number, duration: number): void {
    const oscillator = this.audioContext.createOscillator();
    const envelope = this.audioContext.createGain();
    const now = this.audioContext.currentTime;

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);

    // Sharp attack, exponential decay
    envelope.gain.setValueAtTime(0, now);
    envelope.gain.linearRampToValueAtTime(volume, now + 0.001);
    envelope.gain.exponentialRampToValueAtTime(0.01, now + duration);

    oscillator.connect(envelope);
    envelope.connect(this.gainNode);

    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  private createWoodblockSound(isAccent: boolean): void {
    // Multiple frequencies for realistic woodblock sound
    const frequencies = isAccent ? [1200, 1800, 2400] : [800, 1200, 1600];
    const volume = isAccent ? 0.4 : 0.3;

    frequencies.forEach((freq, i) => {
      const oscillator = this.audioContext.createOscillator();
      const envelope = this.audioContext.createGain();
      const now = this.audioContext.currentTime;

      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(freq, now);

      const gain = volume * (1 - i * 0.2); // Decreasing volume for harmonics
      envelope.gain.setValueAtTime(0, now);
      envelope.gain.linearRampToValueAtTime(gain, now + 0.001);
      envelope.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

      oscillator.connect(envelope);
      envelope.connect(this.gainNode);

      oscillator.start(now);
      oscillator.stop(now + 0.08);
    });
  }

  private createKickSound(isAccent: boolean): void {
    const oscillator = this.audioContext.createOscillator();
    const envelope = this.audioContext.createGain();
    const now = this.audioContext.currentTime;

    // Low frequency for kick-like sound
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(isAccent ? 80 : 60, now);
    oscillator.frequency.exponentialRampToValueAtTime(isAccent ? 40 : 30, now + 0.1);

    const volume = isAccent ? 0.6 : 0.5;
    envelope.gain.setValueAtTime(0, now);
    envelope.gain.linearRampToValueAtTime(volume, now + 0.005);
    envelope.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

    oscillator.connect(envelope);
    envelope.connect(this.gainNode);

    oscillator.start(now);
    oscillator.stop(now + 0.2);
  }

  private createHihatSound(isAccent: boolean): void {
    // Generate filtered noise for hi-hat like sound
    const bufferSize = this.audioContext.sampleRate * 0.05; // 50ms of noise
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);

    // Generate white noise
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.audioContext.createBufferSource();
    const filter = this.audioContext.createBiquadFilter();
    const envelope = this.audioContext.createGain();
    const now = this.audioContext.currentTime;

    noise.buffer = buffer;

    // High-pass filter for crisp hi-hat sound
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(isAccent ? 8000 : 6000, now);

    const volume = isAccent ? 0.4 : 0.3;
    envelope.gain.setValueAtTime(0, now);
    envelope.gain.linearRampToValueAtTime(volume, now + 0.001);
    envelope.gain.exponentialRampToValueAtTime(0.01, now + 0.05);

    noise.connect(filter);
    filter.connect(envelope);
    envelope.connect(this.gainNode);

    noise.start(now);
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
    this.createClickSound(800, config.accentDownbeat && isDownbeat, config.soundType);
    
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
    this.createClickSound(800, config.accentDownbeat && isDownbeat, config.soundType);
    
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