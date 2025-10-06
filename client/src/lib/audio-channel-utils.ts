/**
 * Audio Channel Utilities
 * 
 * Provides consistent mono/stereo handling for Web Audio API
 */

export interface AudioChannelOptions {
  monoGainReduction: number; // dB reduction for mono-to-stereo conversion (default: -3)
}

const DEFAULT_OPTIONS: AudioChannelOptions = {
  monoGainReduction: -3
};

/**
 * Converts mono audio buffers to stereo for consistent playback
 * 
 * @param audioContext - Web Audio API context
 * @param inputBuffer - Input audio buffer (mono or stereo)
 * @param options - Conversion options
 * @returns AudioBuffer - Always stereo output
 */
export function ensureStereoBuffer(
  audioContext: AudioContext, 
  inputBuffer: AudioBuffer, 
  options: Partial<AudioChannelOptions> = {}
): AudioBuffer {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // If already stereo, return as-is
  if (inputBuffer.numberOfChannels >= 2) {
    return inputBuffer;
  }
  
  console.log(`🔄 Converting mono audio to stereo with ${opts.monoGainReduction}dB reduction`);
  
  // Create new stereo buffer
  const stereoBuffer = audioContext.createBuffer(
    2, // Always create stereo (2 channels)
    inputBuffer.length,
    inputBuffer.sampleRate
  );
  
  // Get the mono channel data
  const monoData = inputBuffer.getChannelData(0);
  
  // Calculate gain reduction (convert dB to linear)
  const gainReduction = Math.pow(10, opts.monoGainReduction / 20);
  
  // Get stereo output channels
  const leftChannel = stereoBuffer.getChannelData(0);
  const rightChannel = stereoBuffer.getChannelData(1);
  
  // Copy mono data to both channels with gain reduction
  for (let i = 0; i < inputBuffer.length; i++) {
    const sample = monoData[i] * gainReduction;
    leftChannel[i] = sample;
    rightChannel[i] = sample;
  }
  
  console.log(`✅ Mono-to-stereo conversion complete: ${inputBuffer.length} samples`);
  return stereoBuffer;
}

/**
 * Checks if an audio buffer is mono
 */
export function isMonoBuffer(buffer: AudioBuffer): boolean {
  return buffer.numberOfChannels === 1;
}

/**
 * Gets a descriptive string for buffer channel configuration
 */
export function getChannelDescription(buffer: AudioBuffer): string {
  switch (buffer.numberOfChannels) {
    case 1: return 'mono';
    case 2: return 'stereo';
    case 6: return '5.1 surround';
    case 8: return '7.1 surround';
    default: return `${buffer.numberOfChannels}-channel`;
  }
}