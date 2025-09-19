// Moises API Service - Isolated service for stem separation
// No dependencies on existing audio systems

interface MoisesJobStatus {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  resultUrls?: string[];
  error?: string;
}

interface StemSeparationRequest {
  audioFile: Buffer;
  filename: string;
  removeStems: string[]; // ['vocals', 'guitar', 'bass', 'drums']
}

export class MoisesService {
  private apiKey: string | null;
  private baseUrl = 'https://api.moises.ai/graphql';

  constructor() {
    this.apiKey = process.env.MOISES_API_KEY || null;
    
    if (!this.apiKey) {
      console.log('⚠️ MOISES_API_KEY not available - stem splitting disabled');
    } else {
      console.log('✅ Moises API service initialized');
    }
  }

  isEnabled(): boolean {
    return this.apiKey !== null;
  }

  async createSeparationJob(request: StemSeparationRequest): Promise<string | null> {
    // Allow mock mode when API key is not configured (for development)
    const useMockMode = !this.isEnabled();
    
    if (useMockMode) {
      console.log('🎵 Using mock mode for stem separation (no API key configured)');
    }

    try {
      // For now, return a mock job ID
      // This will be replaced with actual Moises API integration
      const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      console.log(`🎵 Created stem separation job: ${jobId}`);
      console.log(`📁 File: ${request.filename} (${request.audioFile.length} bytes)`);
      console.log(`🎛️ Remove stems: ${request.removeStems.join(', ')}`);
      
      // Store job info in memory for now
      // In production, this would be stored in database
      this.mockJobs.set(jobId, {
        id: jobId,
        status: 'pending',
        progress: 0,
        filename: request.filename,
        removeStems: request.removeStems
      });

      // Start mock processing
      this.startMockProcessing(jobId);
      
      return jobId;
    } catch (error) {
      console.error('❌ Error creating separation job:', error);
      return null;
    }
  }

  async getJobStatus(jobId: string): Promise<MoisesJobStatus | null> {
    // Allow mock mode when API key is not configured (for development)
    const useMockMode = !this.isEnabled();
    
    if (useMockMode) {
      // Use mock job tracking
    }

    try {
      // Return mock status for now
      const job = this.mockJobs.get(jobId);
      if (!job) {
        return null;
      }

      return {
        id: job.id,
        status: job.status,
        progress: job.progress,
        resultUrls: job.resultUrls,
        error: job.error
      };
    } catch (error) {
      console.error('❌ Error checking job status:', error);
      return null;
    }
  }

  // Mock processing system for development
  private mockJobs = new Map<string, any>();

  private startMockProcessing(jobId: string) {
    const job = this.mockJobs.get(jobId);
    if (!job) return;

    // Simulate processing over 10 seconds
    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      
      if (progress >= 100) {
        // Complete the job
        job.status = 'completed';
        job.progress = 100;
        job.resultUrls = [
          `/api/stem-splitter/download/${jobId}/vocals.wav`,
          `/api/stem-splitter/download/${jobId}/instrumental.wav`
        ];
        clearInterval(interval);
        console.log(`✅ Mock job completed: ${jobId}`);
      } else {
        job.status = 'processing';
        job.progress = progress;
      }

      this.mockJobs.set(jobId, job);
    }, 1000);
  }

  async getMockStemData(jobId: string, stemName: string): Promise<Buffer | null> {
    // Return realistic test audio buffer for mock mode
    const job = this.mockJobs.get(jobId);
    if (!job || job.status !== 'completed') {
      return null;
    }

    // Generate a realistic WAV file with actual audio content for testing
    // This creates a 2-second, 44.1kHz, 16-bit mono sine wave tone
    const sampleRate = 44100;
    const duration = 2; // 2 seconds
    const numSamples = sampleRate * duration;
    const frequency = stemName.includes('vocal') ? 440 : 220; // Different frequencies for different stems
    
    // WAV header
    const header = Buffer.alloc(44);
    const dataSize = numSamples * 2; // 16-bit = 2 bytes per sample
    const fileSize = 36 + dataSize;
    
    header.write('RIFF', 0);
    header.writeUInt32LE(fileSize, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16); // Subchunk1Size
    header.writeUInt16LE(1, 20);  // AudioFormat (PCM)
    header.writeUInt16LE(1, 22);  // NumChannels (mono)
    header.writeUInt32LE(sampleRate, 24); // SampleRate
    header.writeUInt32LE(sampleRate * 2, 28); // ByteRate
    header.writeUInt16LE(2, 32);  // BlockAlign
    header.writeUInt16LE(16, 34); // BitsPerSample
    header.write('data', 36);
    header.writeUInt32LE(dataSize, 40);
    
    // Generate sine wave audio data
    const audioData = Buffer.alloc(dataSize);
    for (let i = 0; i < numSamples; i++) {
      const sample = Math.sin(2 * Math.PI * frequency * i / sampleRate);
      const value = Math.round(sample * 32767 * 0.3); // 30% volume to be pleasant
      audioData.writeInt16LE(value, i * 2);
    }
    
    console.log(`🎵 Generated mock ${stemName} audio: ${(header.length + audioData.length) / 1024}KB`);
    return Buffer.concat([header, audioData]);
  }
}

// Export singleton instance
export const moisesService = new MoisesService();