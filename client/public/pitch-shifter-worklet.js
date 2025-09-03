// Ultra-simple pitch shifter - direct playback rate change
// No complex processing, just pure pitch shifting

class PitchShifterProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    
    this.pitchRatio = 1.0;
    
    // Minimal delay buffer for passthrough
    this.bufferSize = 128;
    this.buffer = new Float32Array(this.bufferSize);
    this.writeIndex = 0;
    
    this.port.onmessage = (event) => {
      if (event.data.type === 'pitchRatio') {
        this.pitchRatio = event.data.value;
        console.log(`🎵 Pitch ratio: ${this.pitchRatio.toFixed(3)}`);
      }
    };
    
    console.log('🎵 Simple pitch shifter initialized');
  }
  
  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    
    if (!input || input.length === 0 || !output || output.length === 0) return true;
    
    const inputChannel = input[0];
    const outputChannel = output[0];
    
    if (!inputChannel || !outputChannel) return true;
    
    // Just pass through - let the browser handle pitch shifting
    for (let i = 0; i < inputChannel.length; i++) {
      outputChannel[i] = inputChannel[i];
    }
    
    // Copy to stereo
    if (output.length > 1 && output[1]) {
      for (let i = 0; i < outputChannel.length; i++) {
        output[1][i] = outputChannel[i];
      }
    }
    
    return true;
  }
}

registerProcessor('pitch-shifter', PitchShifterProcessor);