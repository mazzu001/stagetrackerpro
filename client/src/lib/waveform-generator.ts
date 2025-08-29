import type { SongWithTracks } from '@shared/schema';
import { audioStorage } from '@/lib/audio-file-storage';

/**
 * Standalone waveform generation utility
 * Automatically generates and caches waveforms when tracks are loaded
 */
export class WaveformGenerator {
  private static instance: WaveformGenerator;
  
  static getInstance(): WaveformGenerator {
    if (!WaveformGenerator.instance) {
      WaveformGenerator.instance = new WaveformGenerator();
    }
    return WaveformGenerator.instance;
  }

  private getWaveformCacheKey(songId: string): string {
    return `waveform_${songId}`;
  }

  /**
   * Check if waveform is already cached for a song
   */
  getCachedWaveform(songId: string): number[] | null {
    try {
      const cached = localStorage.getItem(this.getWaveformCacheKey(songId));
      if (cached) {
        const data = JSON.parse(cached);
        if (Array.isArray(data)) {
          return data;
        }
      }
    } catch (error) {
      console.error('Failed to load cached waveform:', error);
    }
    return null;
  }

  /**
   * Save waveform data to cache
   */
  private saveWaveformToCache(songId: string, waveformData: number[]): void {
    try {
      localStorage.setItem(this.getWaveformCacheKey(songId), JSON.stringify(waveformData));
      console.log(`Waveform cached for song: ${songId}`);
    } catch (error) {
      console.error('Failed to save waveform to cache:', error);
    }
  }

  /**
   * Generate comprehensive waveform from all tracks in a song
   * This runs automatically when tracks are loaded for the first time
   */
  async generateWaveformFromSong(song: SongWithTracks): Promise<number[]> {
    if (!song || song.tracks.length === 0) {
      console.log(`No tracks available for waveform generation: ${song?.title || 'Unknown song'}`);
      return this.generateFallbackWaveform(400, song?.duration || 240);
    }

    // Check if already cached
    const cached = this.getCachedWaveform(song.id);
    if (cached) {
      console.log(`Using cached waveform for "${song.title}" (${cached.length} data points)`);
      return cached;
    }

    console.log(`Auto-generating waveform for "${song.title}" from ${song.tracks.length} tracks...`);

    // Declare AudioContext outside try block for proper cleanup access
    let audioContext: AudioContext | null = null;
    try {
      // Use regular audio context for compatibility
      audioContext = new AudioContext();
      const sampleCount = 400; // Standard resolution for performance
      const combinedData: number[] = new Array(sampleCount).fill(0);
      let maxDuration = 0;
      let tracksProcessed = 0;

      // Process all tracks in parallel for comprehensive waveform
      const trackPromises = song.tracks.map(async (track) => {
        const audioData = await audioStorage.getAudioFileData(track.id);
        if (!audioData) {
          console.log(`Skipping track ${track.name} - no audio data available`);
          return null;
        }

        try {
          if (!audioContext) {
            console.error('AudioContext not available for track processing');
            return null;
          }
          const audioBuffer = await audioContext.decodeAudioData(audioData.slice(0));
          const channelData = audioBuffer.getChannelData(0); // Use first channel
          
          // Efficient sampling for good quality
          const samplesPerPoint = Math.floor(channelData.length / sampleCount);
          const trackData: number[] = new Array(sampleCount).fill(0);
          
          for (let i = 0; i < sampleCount; i++) {
            const startIndex = i * samplesPerPoint;
            const endIndex = Math.min(startIndex + samplesPerPoint, channelData.length);
            
            // Get max amplitude in the range
            let maxAmplitude = 0;
            for (let j = startIndex; j < endIndex; j += 5) { // Sample every 5th point for quality
              const amplitude = Math.abs(channelData[j]);
              if (amplitude > maxAmplitude) {
                maxAmplitude = amplitude;
              }
            }
            trackData[i] = maxAmplitude;
          }
          
          console.log(`Processed track: ${track.name} (${audioBuffer.duration.toFixed(1)}s)`);
          return { trackData, duration: audioBuffer.duration };
        } catch (error) {
          console.error(`Failed to process track ${track.name}:`, error);
          return null;
        }
      });

      // Wait for all tracks to process in parallel
      const results = await Promise.all(trackPromises);
      
      // Combine all track data for comprehensive waveform
      results.forEach((result) => {
        if (result) {
          maxDuration = Math.max(maxDuration, result.duration);
          for (let i = 0; i < sampleCount; i++) {
            combinedData[i] += result.trackData[i];
          }
          tracksProcessed++;
        }
      });

      // Fast normalization
      if (tracksProcessed > 0) {
        const maxAmplitude = Math.max(...combinedData);
        if (maxAmplitude > 0) {
          // Vectorized normalization for speed
          for (let i = 0; i < combinedData.length; i++) {
            combinedData[i] = combinedData[i] / maxAmplitude;
          }
        }
        
        console.log(`Generated comprehensive waveform from ${tracksProcessed} tracks, duration: ${maxDuration.toFixed(1)}s`);
        
        // Save waveform to local cache for instant loading next time
        this.saveWaveformToCache(song.id, combinedData);
        
        return combinedData;
      } else {
        console.log('No tracks with audio data available, generating fallback waveform pattern');
        const fallbackData = this.generateFallbackWaveform(sampleCount, song.duration || 240);
        return fallbackData;
      }

    } catch (error) {
      console.error('Failed to generate waveform from audio:', error);
      // On error, still generate fallback waveform
      console.log('Generating fallback waveform due to error');
      return this.generateFallbackWaveform(400, song.duration || 240);
    } finally {
      // Always clean up audio context in finally block to prevent resource leaks
      try {
        if (audioContext && audioContext.state !== 'closed' && typeof audioContext.close === 'function') {
          await audioContext.close();
          console.log('🔇 Closed temporary AudioContext for waveform generation');
        }
      } catch (closeError) {
        console.warn('⚠️ Error closing AudioContext (already closed):', closeError);
      }
    }
  }

  /**
   * Generate a realistic fallback waveform pattern when audio data is not available
   */
  private generateFallbackWaveform(sampleCount: number, duration: number): number[] {
    const data: number[] = [];
    
    for (let i = 0; i < sampleCount; i++) {
      const position = i / sampleCount;
      const time = position * duration;
      
      // Create a base waveform with varying intensity
      let amplitude = 0.3 + Math.sin(position * Math.PI * 8) * 0.2; // Base pattern
      amplitude += Math.sin(position * Math.PI * 32) * 0.15; // Higher frequency detail
      amplitude += Math.sin(position * Math.PI * 64) * 0.1; // Even higher frequency
      
      // Add some randomness for realism
      amplitude += (Math.random() - 0.5) * 0.1;
      
      // Create sections with different intensities (verse, chorus, bridge)
      const sectionPhase = (position * 4) % 1;
      if (sectionPhase < 0.25 || sectionPhase > 0.75) {
        amplitude *= 0.7; // Quieter sections (verses)
      } else {
        amplitude *= 1.2; // Louder sections (chorus)
      }
      
      // Fade in/out at beginning and end
      if (position < 0.05) amplitude *= position * 20;
      if (position > 0.95) amplitude *= (1 - position) * 20;
      
      data.push(Math.max(0, Math.min(1, amplitude)));
    }
    
    return data;
  }

  /**
   * Clear cached waveform for a song (useful when tracks are updated)
   */
  clearCachedWaveform(songId: string): void {
    try {
      localStorage.removeItem(this.getWaveformCacheKey(songId));
      console.log(`Cleared cached waveform for song: ${songId}`);
    } catch (error) {
      console.error('Failed to clear cached waveform:', error);
    }
  }
}

// Export singleton instance
export const waveformGenerator = WaveformGenerator.getInstance();