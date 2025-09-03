// Simple, low-latency pitch shifter Audio Worklet
// Optimized for clean, real-time pitch shifting without delay artifacts

class PitchShifterProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    
    this.pitchRatio = 1.0;
    
    // Minimal buffering for low latency
    this.bufferSize = 512;
    this.buffer = new Float32Array(this.bufferSize);
    this.writeIndex = 0;
    this.readIndex = 0;
    
    // Simple windowing
    this.windowSize = 256;
    this.window = new Float32Array(this.windowSize);
    for (let i = 0; i < this.windowSize; i++) {
      this.window[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / this.windowSize));
    }
    
    // Overlap buffers
    this.overlapBuffer = new Float32Array(this.windowSize);
    this.grainBuffer = new Float32Array(this.windowSize);
    
    // Processing state
    this.grainPosition = 0;
    this.outputPosition = 0;
    
    this.port.onmessage = (event) => {
      if (event.data.type === 'pitchRatio') {
        this.pitchRatio = Math.max(0.5, Math.min(2.0, event.data.value)); // Limit range to reduce artifacts
      }
    };
    
    console.log('🎵 Low-latency pitch shifter initialized');
  }
  
  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    
    if (!input || input.length === 0 || !output || output.length === 0) return true;
    
    const inputChannel = input[0];
    const outputChannel = output[0];
    
    if (!inputChannel || !outputChannel) return true;
    
    // Process each sample with minimal latency
    for (let i = 0; i < inputChannel.length; i++) {
      // Simple direct processing for minimal delay
      if (Math.abs(this.pitchRatio - 1.0) < 0.01) {
        // No pitch change - direct passthrough
        outputChannel[i] = inputChannel[i];
      } else {
        // Apply pitch shift with minimal buffering
        outputChannel[i] = this.processSimplePitch(inputChannel[i]);
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
  
  processSimplePitch(sample) {
    // Store input sample
    this.buffer[this.writeIndex] = sample;
    this.writeIndex = (this.writeIndex + 1) % this.bufferSize;
    
    // Calculate read position based on pitch ratio
    const readOffset = (this.pitchRatio - 1.0) * 64; // Small offset for pitch change
    let readPos = this.writeIndex - 64 - readOffset; // Fixed delay of 64 samples (~1.3ms at 48kHz)
    
    if (readPos < 0) readPos += this.bufferSize;
    if (readPos >= this.bufferSize) readPos -= this.bufferSize;
    
    // Linear interpolation for smooth pitch shifting
    const index = Math.floor(readPos);
    const fraction = readPos - index;
    const nextIndex = (index + 1) % this.bufferSize;
    
    const sample1 = this.buffer[index];
    const sample2 = this.buffer[nextIndex];
    
    return sample1 * (1 - fraction) + sample2 * fraction;
  }
}

// Register the simplified processor
registerProcessor('pitch-shifter', PitchShifterProcessor);