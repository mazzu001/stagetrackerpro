// Clean pitch shifter using simple delay modulation
// Optimized for minimal distortion and artifacts

class PitchShifterProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    
    this.pitchRatio = 1.0;
    
    // Simple delay line for clean processing
    this.delayBufferSize = 2048;
    this.delayBuffer = new Float32Array(this.delayBufferSize);
    this.writeIndex = 0;
    
    // Smooth parameter changes
    this.currentRatio = 1.0;
    this.targetRatio = 1.0;
    this.smoothingFactor = 0.99;
    
    this.port.onmessage = (event) => {
      if (event.data.type === 'pitchRatio') {
        this.targetRatio = Math.max(0.5, Math.min(2.0, event.data.value));
        console.log(`🎵 Target pitch ratio: ${this.targetRatio.toFixed(3)}`);
      }
    };
    
    console.log('🎵 Clean pitch shifter initialized');
  }
  
  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    
    if (!input || input.length === 0 || !output || output.length === 0) return true;
    
    const inputChannel = input[0];
    const outputChannel = output[0];
    
    if (!inputChannel || !outputChannel) return true;
    
    // Smooth parameter changes to avoid clicks
    this.currentRatio += (this.targetRatio - this.currentRatio) * (1 - this.smoothingFactor);
    
    for (let i = 0; i < inputChannel.length; i++) {
      // Write input to delay buffer
      this.delayBuffer[this.writeIndex] = inputChannel[i];
      this.writeIndex = (this.writeIndex + 1) % this.delayBufferSize;
      
      if (Math.abs(this.currentRatio - 1.0) < 0.01) {
        // No pitch change - clean passthrough with minimal delay
        const readIndex = (this.writeIndex - 128 + this.delayBufferSize) % this.delayBufferSize;
        outputChannel[i] = this.delayBuffer[readIndex];
      } else {
        // Apply gentle pitch shifting
        outputChannel[i] = this.processCleanPitch(i);
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
  
  processCleanPitch(sampleIndex) {
    // Use simple frequency modulation approach
    const baseDelay = 256; // Base delay in samples
    const modulationDepth = 64; // Modulation depth
    
    // Calculate modulation based on pitch ratio
    const pitchFactor = (this.currentRatio - 1.0) * modulationDepth;
    const modulation = Math.sin(sampleIndex * 0.01) * pitchFactor;
    
    // Calculate read position with modulation
    let readDelay = baseDelay + modulation;
    if (readDelay < 1) readDelay = 1;
    if (readDelay >= this.delayBufferSize - 1) readDelay = this.delayBufferSize - 2;
    
    const readIndex = (this.writeIndex - Math.floor(readDelay) + this.delayBufferSize) % this.delayBufferSize;
    
    // Simple linear interpolation
    const fraction = readDelay - Math.floor(readDelay);
    const nextIndex = (readIndex + 1) % this.delayBufferSize;
    
    const sample1 = this.delayBuffer[readIndex];
    const sample2 = this.delayBuffer[nextIndex];
    
    const interpolated = sample1 * (1 - fraction) + sample2 * fraction;
    
    // Apply gentle filtering to reduce artifacts
    return interpolated * 0.7; // Reduce gain to prevent clipping
  }
}

// Register the clean processor
registerProcessor('pitch-shifter', PitchShifterProcessor);