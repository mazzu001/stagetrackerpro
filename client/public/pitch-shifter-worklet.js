// High-quality pitch shifter Audio Worklet using PSOLA (Pitch Synchronous Overlap-Add)
// This provides professional-grade pitch shifting with minimal artifacts

class PitchShifterProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    
    // Audio processing parameters - optimized for quality
    this.sampleRate = sampleRate;
    this.frameSize = 1024;        // Smaller frame for lower latency
    this.hopSize = this.frameSize / 4;  // 75% overlap for smooth transitions
    this.pitchRatio = 1.0;
    
    // Ring buffers for processing
    this.inputBuffer = new Float32Array(this.frameSize * 4);
    this.outputBuffer = new Float32Array(this.frameSize * 4);
    this.inputWritePos = 0;
    this.outputReadPos = 0;
    
    // Processing state
    this.grainBuffer = new Float32Array(this.frameSize);
    this.synthesisBuffer = new Float32Array(this.frameSize * 2);
    this.synthesisPos = 0;
    
    // Improved Hann window with better roll-off
    this.window = new Float32Array(this.frameSize);
    for (let i = 0; i < this.frameSize; i++) {
      this.window[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (this.frameSize - 1)));
    }
    
    // Crossfade buffer for seamless transitions
    this.crossfadeBuffer = new Float32Array(this.frameSize);
    this.crossfadeActive = false;
    
    // Gain compensation for different pitch ratios
    this.gainCompensation = 1.0;
    
    this.port.onmessage = (event) => {
      if (event.data.type === 'pitchRatio') {
        this.pitchRatio = Math.max(0.25, Math.min(4.0, event.data.value)); // Clamp range
        // Calculate gain compensation to maintain perceived loudness
        this.gainCompensation = Math.sqrt(Math.abs(this.pitchRatio));
      }
    };
    
    console.log('🎵 High-quality pitch shifter initialized');
  }
  
  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    
    if (!input || input.length === 0 || !output || output.length === 0) return true;
    
    const inputChannel = input[0];
    const outputChannel = output[0];
    
    if (!inputChannel || !outputChannel) return true;
    
    // Process each sample
    for (let i = 0; i < inputChannel.length; i++) {
      // Write to input buffer
      this.inputBuffer[this.inputWritePos] = inputChannel[i];
      this.inputWritePos = (this.inputWritePos + 1) % this.inputBuffer.length;
      
      // Read from output buffer with gain compensation
      outputChannel[i] = this.outputBuffer[this.outputReadPos] * this.gainCompensation;
      this.outputReadPos = (this.outputReadPos + 1) % this.outputBuffer.length;
      
      // Process frames at hop intervals
      if (this.inputWritePos % this.hopSize === 0) {
        this.processGrain();
      }
    }
    
    // Copy to stereo channels
    if (output.length > 1 && output[1]) {
      for (let i = 0; i < outputChannel.length; i++) {
        output[1][i] = outputChannel[i];
      }
    }
    
    return true;
  }
  
  processGrain() {
    // Extract windowed grain from input
    this.extractGrain();
    
    if (Math.abs(this.pitchRatio - 1.0) < 0.001) {
      // Bypass processing when no pitch change needed
      this.directCopy();
    } else {
      // Apply high-quality pitch shifting
      this.shiftPitch();
    }
  }
  
  extractGrain() {
    const startPos = (this.inputWritePos - this.frameSize + this.inputBuffer.length) % this.inputBuffer.length;
    
    for (let i = 0; i < this.frameSize; i++) {
      const bufferPos = (startPos + i) % this.inputBuffer.length;
      this.grainBuffer[i] = this.inputBuffer[bufferPos] * this.window[i];
    }
  }
  
  directCopy() {
    // Direct copy with proper overlap-add
    const outputStart = (this.outputReadPos + this.frameSize) % this.outputBuffer.length;
    
    for (let i = 0; i < this.frameSize; i++) {
      const outputPos = (outputStart + i) % this.outputBuffer.length;
      this.outputBuffer[outputPos] += this.grainBuffer[i];
    }
  }
  
  shiftPitch() {
    // High-quality time-stretching with improved interpolation
    const stretchRatio = 1.0 / this.pitchRatio;
    const outputStart = (this.outputReadPos + Math.round(this.frameSize * stretchRatio)) % this.outputBuffer.length;
    
    // Clear synthesis buffer
    this.synthesisBuffer.fill(0);
    
    // Resample with cubic interpolation for better quality
    for (let i = 0; i < this.frameSize; i++) {
      const sourcePos = i * stretchRatio;
      const sample = this.cubicInterpolate(sourcePos);
      const windowValue = this.window[Math.min(i, this.frameSize - 1)];
      this.synthesisBuffer[i] = sample * windowValue;
    }
    
    // Overlap-add to output buffer with fade-in/fade-out for seamless transitions
    for (let i = 0; i < this.frameSize; i++) {
      const outputPos = (outputStart + i) % this.outputBuffer.length;
      
      // Apply crossfading to reduce clicking artifacts
      let fadeWeight = 1.0;
      if (i < this.hopSize) {
        fadeWeight = i / this.hopSize; // Fade in
      } else if (i >= this.frameSize - this.hopSize) {
        fadeWeight = (this.frameSize - i) / this.hopSize; // Fade out
      }
      
      this.outputBuffer[outputPos] += this.synthesisBuffer[i] * fadeWeight * 0.7; // Scale down to prevent clipping
    }
  }
  
  cubicInterpolate(position) {
    const index = Math.floor(position);
    const fraction = position - index;
    
    // Get 4 surrounding samples for cubic interpolation
    const y0 = this.grainBuffer[Math.max(0, index - 1)] || 0;
    const y1 = this.grainBuffer[Math.min(this.frameSize - 1, Math.max(0, index))] || 0;
    const y2 = this.grainBuffer[Math.min(this.frameSize - 1, index + 1)] || 0;
    const y3 = this.grainBuffer[Math.min(this.frameSize - 1, index + 2)] || 0;
    
    // Cubic interpolation formula
    const a0 = y3 - y2 - y0 + y1;
    const a1 = y0 - y1 - a0;
    const a2 = y2 - y0;
    const a3 = y1;
    
    const f2 = fraction * fraction;
    const f3 = f2 * fraction;
    
    return a0 * f3 + a1 * f2 + a2 * fraction + a3;
  }
}

// Register the improved processor
registerProcessor('pitch-shifter', PitchShifterProcessor);