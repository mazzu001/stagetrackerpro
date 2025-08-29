/**
 * Debug utilities for waveform generation issues
 */

import { waveformGenerator } from './waveform-generator';
import { AudioFileStorage } from './audio-file-storage';
import { LocalSongStorage } from './local-song-storage';
import type { SongWithTracks } from '@shared/schema';

export class WaveformDebugger {
  static async debugSong(songTitle: string, userEmail: string) {
    console.log(`🔍 Debugging waveform for: "${songTitle}"`);
    
    // 1. Check if song exists in storage
    const songs = LocalSongStorage.getAllSongs(userEmail);
    const song = songs.find((s: SongWithTracks) => s.title.toLowerCase().includes(songTitle.toLowerCase()));
    
    if (!song) {
      console.error(`❌ Song "${songTitle}" not found in storage`);
      console.log('Available songs:', songs.map((s: SongWithTracks) => s.title));
      return;
    }
    
    console.log(`✅ Found song: "${song.title}" with ${song.tracks.length} tracks`);
    console.log('Song data:', song);
    
    // 2. Check cached waveform
    const cachedWaveform = waveformGenerator.getCachedWaveform(song.id);
    if (cachedWaveform) {
      console.log(`✅ Cached waveform exists (${cachedWaveform.length} data points)`);
    } else {
      console.log(`❌ No cached waveform found`);
    }
    
    // 3. Check audio files for each track
    const audioStorage = AudioFileStorage.getInstance();
    console.log(`🔍 Checking audio files for ${song.tracks.length} tracks:`);
    
    for (const track of song.tracks) {
      try {
        const audioUrl = await audioStorage.getAudioUrl(track.id);
        const audioData = await audioStorage.getAudioFileData(track.id);
        
        console.log(`Track "${track.name}":`, {
          hasUrl: !!audioUrl,
          hasData: !!audioData,
          dataSize: audioData ? audioData.byteLength : 0
        });
      } catch (error) {
        console.error(`❌ Error checking track "${track.name}":`, error);
      }
    }
    
    // 4. Attempt to regenerate waveform
    console.log(`🔄 Attempting to regenerate waveform...`);
    try {
      // Clear existing cache first
      waveformGenerator.clearCachedWaveform(song.id);
      
      // Generate new waveform
      const newWaveform = await waveformGenerator.generateWaveformFromSong(song);
      console.log(`✅ Generated new waveform (${newWaveform.length} data points)`);
      
      return newWaveform;
    } catch (error) {
      console.error(`❌ Failed to regenerate waveform:`, error);
      return null;
    }
  }
  
  static async regenerateAllWaveforms(userEmail: string) {
    console.log('🔄 Regenerating all waveforms...');
    
    const songs = LocalSongStorage.getAllSongs(userEmail);
    
    for (const song of songs) {
      console.log(`Processing: "${song.title}"`);
      try {
        waveformGenerator.clearCachedWaveform(song.id);
        await waveformGenerator.generateWaveformFromSong(song);
        console.log(`✅ Regenerated waveform for: "${song.title}"`);
      } catch (error) {
        console.error(`❌ Failed to regenerate waveform for "${song.title}":`, error);
      }
    }
    
    console.log('🎉 Waveform regeneration complete!');
  }
}

// Make it available globally for browser console debugging
if (typeof window !== 'undefined') {
  (window as any).WaveformDebugger = WaveformDebugger;
}