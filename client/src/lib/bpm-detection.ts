// Auto BPM Detection for StageTracker
// Analyzes existing waveform data to detect song tempo for accurate count-ins

export interface BPMDetectionResult {
  bpm: number;
  confidence: number; // 0.0 to 1.0
  method: 'peaks' | 'autocorrelation' | 'spectral';
  detectedBeats?: number[]; // Beat timestamps for debugging
}

export interface BPMDetectionOptions {
  minBPM?: number;
  maxBPM?: number;
  analysisLength?: number; // seconds to analyze from start
  method?: 'auto' | 'peaks' | 'autocorrelation';
}

/**
 * Auto-detect BPM from existing waveform data
 * Perfect for generating accurate count-ins that match backing tracks
 */
export class BPMDetector {
  private static readonly DEFAULT_OPTIONS: Required<BPMDetectionOptions> = {
    minBPM: 60,
    maxBPM: 200,
    analysisLength: 30, // Analyze first 30 seconds
    method: 'auto'
  };

  /**
   * Detect BPM from waveform data (main entry point)
   */
  static async detectFromWaveform(
    waveformData: number[],
    duration: number,
    options: BPMDetectionOptions = {}
  ): Promise<BPMDetectionResult> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    
    // Truncate waveform to analysis length
    const analysisRatio = Math.min(opts.analysisLength, duration) / duration;
    const analysisLength = Math.floor(waveformData.length * analysisRatio);
    const analysisData = waveformData.slice(0, analysisLength);
    
    console.log(`🎯 Analyzing ${analysisLength} waveform points (${opts.analysisLength}s) for BPM detection`);

    try {
      let result: BPMDetectionResult;

      switch (opts.method) {
        case 'peaks':
          result = this.detectBPMFromPeaks(analysisData, duration * analysisRatio, opts);
          break;
        case 'autocorrelation':
          result = this.detectBPMFromAutocorrelation(analysisData, duration * analysisRatio, opts);
          break;
        case 'auto':
        default:
          // Try peaks first (fast), fallback to autocorrelation if confidence is low
          const peaksResult = this.detectBPMFromPeaks(analysisData, duration * analysisRatio, opts);
          if (peaksResult.confidence > 0.7) {
            result = peaksResult;
          } else {
            console.log('🎯 Peak detection confidence low, trying autocorrelation');
            result = this.detectBPMFromAutocorrelation(analysisData, duration * analysisRatio, opts);
          }
          break;
      }

      console.log(`🎯 BPM detected: ${result.bpm} (confidence: ${result.confidence.toFixed(2)})`);
      return result;

    } catch (error) {
      console.error('❌ BPM detection failed:', error);
      // Return reasonable fallback
      return {
        bpm: 120,
        confidence: 0.0,
        method: 'peaks'
      };
    }
  }

  /**
   * Peak-based BPM detection (fast, good for clear beats)
   */
  private static detectBPMFromPeaks(
    waveformData: number[],
    duration: number,
    options: Required<BPMDetectionOptions>
  ): BPMDetectionResult {
    // Find peaks in waveform data
    const beats = this.findPeaks(waveformData, duration);
    
    if (beats.length < 4) {
      return { bpm: 120, confidence: 0.1, method: 'peaks' };
    }

    // Calculate intervals between beats
    const intervals: number[] = [];
    for (let i = 1; i < beats.length; i++) {
      intervals.push(beats[i] - beats[i - 1]);
    }

    // Find most common interval using histogram
    const bpm = this.calculateBPMFromIntervals(intervals, options);
    const confidence = this.calculateConfidence(intervals, bpm);

    return {
      bpm,
      confidence,
      method: 'peaks',
      detectedBeats: beats
    };
  }

  /**
   * Autocorrelation-based BPM detection (more accurate, slower)
   */
  private static detectBPMFromAutocorrelation(
    waveformData: number[],
    duration: number,
    options: Required<BPMDetectionOptions>
  ): BPMDetectionResult {
    const sampleRate = waveformData.length / duration;
    const minPeriod = Math.floor(60 * sampleRate / options.maxBPM);
    const maxPeriod = Math.floor(60 * sampleRate / options.minBPM);

    let bestCorrelation = 0;
    let bestPeriod = minPeriod;

    // Calculate autocorrelation for different periods
    for (let period = minPeriod; period <= maxPeriod; period += 2) {
      let correlation = 0;
      const maxOffset = Math.min(waveformData.length - period, 2000); // Limit for performance

      for (let i = 0; i < maxOffset; i++) {
        correlation += waveformData[i] * waveformData[i + period];
      }

      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestPeriod = period;
      }
    }

    const bpm = Math.round(60 * sampleRate / bestPeriod);
    const confidence = Math.min(1.0, bestCorrelation / (waveformData.length * 0.1));

    return {
      bpm,
      confidence,
      method: 'autocorrelation'
    };
  }

  /**
   * Find peaks in waveform data (beats/transients)
   */
  private static findPeaks(waveformData: number[], duration: number): number[] {
    const beats: number[] = [];
    const threshold = this.calculateDynamicThreshold(waveformData);
    const minDistance = Math.floor(waveformData.length * 0.1 / duration); // Minimum 100ms between beats

    for (let i = minDistance; i < waveformData.length - minDistance; i++) {
      const current = Math.abs(waveformData[i]);
      const prev = Math.abs(waveformData[i - 1]);
      const next = Math.abs(waveformData[i + 1]);

      // Peak detection: local maximum above threshold
      if (current > threshold && current > prev && current > next) {
        // Check minimum distance from last beat
        const lastBeat = beats[beats.length - 1];
        if (!lastBeat || (i - lastBeat * waveformData.length / duration) > minDistance) {
          beats.push(i * duration / waveformData.length);
        }
      }
    }

    return beats;
  }

  /**
   * Calculate dynamic threshold for peak detection
   */
  private static calculateDynamicThreshold(waveformData: number[]): number {
    const absData = waveformData.map(Math.abs);
    absData.sort((a, b) => b - a);
    
    // Use 85th percentile as threshold (ignore very quiet parts)
    const thresholdIndex = Math.floor(absData.length * 0.15);
    return absData[thresholdIndex] * 0.7;
  }

  /**
   * Calculate BPM from beat intervals using histogram method
   */
  private static calculateBPMFromIntervals(
    intervals: number[],
    options: Required<BPMDetectionOptions>
  ): number {
    // Convert intervals to BPMs
    const bpms = intervals.map(interval => 60 / interval)
      .filter(bpm => bpm >= options.minBPM && bpm <= options.maxBPM);

    if (bpms.length === 0) return 120;

    // Create histogram with 1 BPM bins
    const histogram = new Map<number, number>();
    bpms.forEach(bpm => {
      const roundedBPM = Math.round(bpm);
      histogram.set(roundedBPM, (histogram.get(roundedBPM) || 0) + 1);
    });

    // Find most common BPM
    let maxCount = 0;
    let mostCommonBPM = 120;
    
    histogram.forEach((count, bpm) => {
      if (count > maxCount) {
        maxCount = count;
        mostCommonBPM = bpm;
      }
    });

    return mostCommonBPM;
  }

  /**
   * Calculate confidence based on interval consistency
   */
  private static calculateConfidence(intervals: number[], targetBPM: number): number {
    if (intervals.length < 2) return 0.1;

    const targetInterval = 60 / targetBPM;
    const deviations = intervals.map(interval => 
      Math.abs(interval - targetInterval) / targetInterval
    );

    const avgDeviation = deviations.reduce((sum, dev) => sum + dev, 0) / deviations.length;
    return Math.max(0.1, Math.min(1.0, 1 - avgDeviation * 2));
  }

  /**
   * Validate detected BPM against common musical ranges
   */
  static validateBPM(bpm: number, confidence: number): { bpm: number; confidence: number } {
    // Check for half/double time detection errors
    const validatedBPM = this.correctHalfDoubleTime(bpm);
    
    // Adjust confidence based on how "musical" the BPM is
    const musicality = this.calculateMusicality(validatedBPM);
    const adjustedConfidence = confidence * musicality;

    return {
      bpm: validatedBPM,
      confidence: adjustedConfidence
    };
  }

  /**
   * Correct common half-time/double-time detection errors
   */
  private static correctHalfDoubleTime(bpm: number): number {
    // Common BPM ranges where half/double time is likely
    if (bpm < 70) {
      // Likely half-time, double it
      return bpm * 2;
    } else if (bpm > 180) {
      // Likely double-time, halve it
      return Math.round(bpm / 2);
    }
    
    return Math.round(bpm);
  }

  /**
   * Calculate how "musical" a BPM is (common tempos get higher scores)
   */
  private static calculateMusicality(bpm: number): number {
    // Common musical BPMs (higher weight)
    const commonBPMs = [60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180];
    const closestCommon = commonBPMs.reduce((closest, current) => 
      Math.abs(current - bpm) < Math.abs(closest - bpm) ? current : closest
    );

    const deviation = Math.abs(bpm - closestCommon);
    return Math.max(0.5, 1 - deviation / 20); // Max penalty of 50%
  }
}

/**
 * Convenient wrapper for quick BPM detection from song data
 */
export async function detectSongBPM(
  waveformData: string | number[],
  duration: number,
  options?: BPMDetectionOptions
): Promise<BPMDetectionResult> {
  let waveform: number[];
  
  if (typeof waveformData === 'string') {
    try {
      waveform = JSON.parse(waveformData);
    } catch (error) {
      throw new Error('Invalid waveform data format');
    }
  } else {
    waveform = waveformData;
  }

  const result = await BPMDetector.detectFromWaveform(waveform, duration, options);
  return BPMDetector.validateBPM(result.bpm, result.confidence);
}