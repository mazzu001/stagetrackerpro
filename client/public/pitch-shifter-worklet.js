// Proper pitch shifter using time-stretching and resampling
// This actually changes pitch by adjusting playback speed

class PitchShifterProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    
    this.pitchRatio = 1.0;
    
    // Larger buffer for better quality pitch shifting
    this.bufferSize = 8192;
    this.inputBuffer = new Float32Array(this.bufferSize);
    this.outputBuffer = new Float32Array(this.bufferSize);
    
    // Read/write positions
    this.writePos = 0;
    this.readPos = 0.0; // Float for fractional positions
    
    // Grain processing for smooth pitch shifts
    this.grainSize = 1024;
    this.hopSize = 256;
    this.grainIndex = 0;
    
    // Window function for smooth grain blending
    this.window = new Float32Array(this.grainSize);
    for (let i = 0; i < this.grainSize; i++) {
      this.window[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / this.grainSize));
    }
    
    // Output grain buffer
    this.currentGrain = new Float32Array(this.grainSize);
    this.grainOutput = 0;
    
    this.port.onmessage = (event) => {
      if (event.data.type === 'pitchRatio') {
        const newRatio = Math.max(0.5, Math.min(2.0, event.data.value));
        this.pitchRatio = newRatio;
        console.log(`🎵 Pitch ratio: ${newRatio.toFixed(3)} (${((newRatio - 1) * 12).toFixed(1)} semitones)`);
      }
    };
    
    console.log('🎵 Time-stretching pitch shifter initialized');
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
      this.inputBuffer[this.writePos] = inputChannel[i];
      this.writePos = (this.writePos + 1) % this.bufferSize;
    }
    
    // Generate output
    for (let i = 0; i < outputChannel.length; i++) {
      if (Math.abs(this.pitchRatio - 1.0) < 0.01) {
        // No pitch change - direct passthrough with small delay
        const delayedPos = (this.writePos - 1024 + this.bufferSize) % this.bufferSize;
        outputChannel[i] = this.inputBuffer[delayedPos];
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
  
  getPitchShiftedSample() {
    // Process grains when needed
    if (this.grainOutput >= this.grainSize) {
      this.generateGrain();
      this.grainOutput = 0;
    }
    
    // Get sample from current grain
    const sample = this.currentGrain[this.grainOutput];
    this.grainOutput++;
    
    return sample;
  }
  
  generateGrain() {
    // Clear the grain
    this.currentGrain.fill(0);
    
    // Extract grain from input buffer at current read position
    for (let i = 0; i < this.grainSize; i++) {
      // Calculate source position
      const sourceIndex = this.readPos + (i / this.pitchRatio);
      
      // Ensure we don't read beyond available data
      const maxReadPos = this.writePos - this.grainSize - 1;
      if (sourceIndex > maxReadPos) break;
      
      // Get integer and fractional parts
      const intIndex = Math.floor(sourceIndex);
      const fracPart = sourceIndex - intIndex;
      
      // Get buffer positions
      const pos1 = (intIndex + this.bufferSize) % this.bufferSize;
      const pos2 = (intIndex + 1 + this.bufferSize) % this.bufferSize;
      
      // Linear interpolation
      const sample1 = this.inputBuffer[pos1];
      const sample2 = this.inputBuffer[pos2];
      const interpolated = sample1 * (1 - fracPart) + sample2 * fracPart;
      
      // Apply window and store
      this.currentGrain[i] = interpolated * this.window[i];
    }
    
    // Advance read position
    this.readPos += this.hopSize / this.pitchRatio;
    
    // Keep read position within bounds
    if (this.readPos >= this.bufferSize - this.grainSize) {
      this.readPos = 0;
    }
  }
}

// Register the proper pitch shifter
registerProcessor('pitch-shifter', PitchShifterProcessor);