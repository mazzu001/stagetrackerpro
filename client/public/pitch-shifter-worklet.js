// Effective pitch shifter using variable playback rate
// Simple but functional approach for real-time pitch shifting

class PitchShifterProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    
    this.pitchRatio = 1.0;
    
    // Circular buffer for pitch shifting
    this.bufferSize = 4096;  // Larger buffer for better quality
    this.buffer = new Float32Array(this.bufferSize);
    this.writeIndex = 0;
    this.readPosition = 0;  // Floating point read position
    
    // Crossfade parameters for smooth transitions
    this.crossfadeLength = 128;
    this.grainLength = 1024;
    this.grainOverlap = 512;
    
    // Processing state
    this.outputGrain = new Float32Array(this.grainLength);
    this.grainIndex = 0;
    this.grainReady = false;
    
    this.port.onmessage = (event) => {
      if (event.data.type === 'pitchRatio') {
        this.pitchRatio = Math.max(0.5, Math.min(2.0, event.data.value));
        console.log(`🎵 Pitch ratio set to: ${this.pitchRatio.toFixed(3)}`);
      }
    };
    
    console.log('🎵 Variable-rate pitch shifter initialized');
  }
  
  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    
    if (!input || input.length === 0 || !output || output.length === 0) return true;
    
    const inputChannel = input[0];
    const outputChannel = output[0];
    
    if (!inputChannel || !outputChannel) return true;
    
    // Fill input buffer
    for (let i = 0; i < inputChannel.length; i++) {
      this.buffer[this.writeIndex] = inputChannel[i];
      this.writeIndex = (this.writeIndex + 1) % this.bufferSize;
    }
    
    // Generate output with pitch shifting
    for (let i = 0; i < outputChannel.length; i++) {
      if (Math.abs(this.pitchRatio - 1.0) < 0.01) {
        // No pitch change - direct passthrough
        outputChannel[i] = this.getDelayedSample(128); // Small fixed delay
      } else {
        // Apply pitch shifting
        outputChannel[i] = this.getPitchShiftedSample();
      }
    }
    
    // Copy to stereo
    if (output.length > 1 && output[1]) {
      for (let i = 0; i < outputChannel.length; i++) {
        output[1][i] = outputChannel[i];
      }
    }
    
    return true;
  }
  
  getDelayedSample(delaySamples) {
    const readIndex = (this.writeIndex - delaySamples - 1 + this.bufferSize) % this.bufferSize;
    return this.buffer[readIndex];
  }
  
  getPitchShiftedSample() {
    // Variable playback rate for pitch shifting
    // Higher pitch = read faster, lower pitch = read slower
    const readSpeed = this.pitchRatio;
    
    // Advance read position at the adjusted rate
    this.readPosition += readSpeed;
    
    // Keep read position within bounds and handle wraparound
    if (this.readPosition >= this.bufferSize) {
      this.readPosition -= this.bufferSize;
    }
    
    // Calculate actual buffer read index (offset from write position)
    const maxDelay = this.bufferSize * 0.75; // Stay safely behind write position
    let readIndex = this.writeIndex - maxDelay + this.readPosition;
    
    // Handle wraparound
    while (readIndex < 0) readIndex += this.bufferSize;
    while (readIndex >= this.bufferSize) readIndex -= this.bufferSize;
    
    // Linear interpolation for smooth playback
    const index = Math.floor(readIndex);
    const fraction = readIndex - index;
    const nextIndex = (index + 1) % this.bufferSize;
    
    const sample1 = this.buffer[index] || 0;
    const sample2 = this.buffer[nextIndex] || 0;
    
    return sample1 * (1 - fraction) + sample2 * fraction;
  }
}

// Register the improved processor
registerProcessor('pitch-shifter', PitchShifterProcessor);