import JSZip from 'jszip';
import { LocalSongStorage, type LocalSong } from './local-song-storage';
import { BrowserFileSystem } from './browser-file-system';
import { waveformGenerator } from './waveform-generator';

export interface BackupManifest {
  version: string;
  createdAt: string;
  appVersion: string;
  songCount: number;
  trackCount: number;
  userEmail: string;
  songs: {
    originalId: string;
    newId: string;
    title: string;
    artist: string;
    tracks: {
      originalId: string;
      newId: string;
      name: string;
      fileName: string;
    }[];
  }[];
}

export class BackupManager {
  private static instance: BackupManager;

  static getInstance(): BackupManager {
    if (!BackupManager.instance) {
      BackupManager.instance = new BackupManager();
    }
    return BackupManager.instance;
  }

  /**
   * Export all user data (songs, tracks, audio files, waveforms) to a zip file
   */
  async exportAllData(userEmail: string): Promise<Blob> {
    console.log(`🎒 Starting complete backup export for user: ${userEmail}`);
    
    const zip = new JSZip();
    const browserFS = BrowserFileSystem.getInstance();
    
    // Get all songs
    const songs = LocalSongStorage.getAllSongs(userEmail);
    console.log(`📋 Found ${songs.length} songs to export`);
    
    if (songs.length === 0) {
      throw new Error('No songs found to export');
    }

    let totalTracks = 0;
    const manifestSongs = [];

    // Create folders in zip
    const songsFolder = zip.folder('songs')!;
    const audioFolder = zip.folder('audio')!;
    const waveformsFolder = zip.folder('waveforms')!;

    // Process each song
    for (const song of songs) {
      console.log(`🎵 Processing song: "${song.title}"`);
      
      // Generate new IDs for import (prevents conflicts)
      const newSongId = crypto.randomUUID();
      const trackMappings = [];

      // Export song data (without tracks, we'll handle those separately)
      const songData = {
        ...song,
        id: newSongId,
        tracks: [] // Reset tracks, will be rebuilt during import
      };
      
      songsFolder.file(`${newSongId}.json`, JSON.stringify(songData, null, 2));

      // Process tracks for this song
      for (const track of song.tracks) {
        const newTrackId = crypto.randomUUID();
        totalTracks++;
        
        trackMappings.push({
          originalId: track.id,
          newId: newTrackId,
          name: track.name,
          fileName: `${newTrackId}.audio`
        });

        // Get audio file data from browser storage
        try {
          const audioUrl = await browserFS.getAudioUrl(track.id);
          if (audioUrl) {
            // Fetch the audio data
            const response = await fetch(audioUrl);
            const audioBlob = await response.blob();
            
            // Store in zip with new ID
            audioFolder.file(`${newTrackId}.audio`, audioBlob);
            console.log(`✅ Exported audio for track: ${track.name}`);
          } else {
            console.warn(`⚠️ No audio data found for track: ${track.name}`);
          }
        } catch (error) {
          console.error(`❌ Failed to export audio for track ${track.name}:`, error);
        }
      }

      manifestSongs.push({
        originalId: song.id,
        newId: newSongId,
        title: song.title,
        artist: song.artist || 'Unknown',
        tracks: trackMappings
      });

      // Export waveform data if it exists
      const waveformData = waveformGenerator.getCachedWaveform(song.id);
      if (waveformData && waveformData.length > 0) {
        waveformsFolder.file(`${newSongId}.json`, JSON.stringify(waveformData));
        console.log(`📈 Exported waveform for: ${song.title}`);
      }
    }

    // Create manifest with mapping information
    const manifest: BackupManifest = {
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      appVersion: 'StageTracker Pro v1.0',
      songCount: songs.length,
      trackCount: totalTracks,
      userEmail: userEmail,
      songs: manifestSongs
    };

    zip.file('manifest.json', JSON.stringify(manifest, null, 2));

    console.log(`✅ Backup complete: ${songs.length} songs, ${totalTracks} tracks`);
    
    // Generate zip file
    return await zip.generateAsync({ type: 'blob' });
  }

  /**
   * Import all data from a zip file backup
   */
  async importAllData(zipFile: File, userEmail: string): Promise<void> {
    console.log(`📥 Starting complete backup import for user: ${userEmail}`);
    
    const zip = await JSZip.loadAsync(zipFile);
    const browserFS = BrowserFileSystem.getInstance();
    
    // Read manifest
    const manifestFile = zip.file('manifest.json');
    if (!manifestFile) {
      throw new Error('Invalid backup file: missing manifest.json');
    }
    
    const manifestText = await manifestFile.async('text');
    const manifest: BackupManifest = JSON.parse(manifestText);
    
    console.log(`📋 Importing backup from ${manifest.createdAt}: ${manifest.songCount} songs, ${manifest.trackCount} tracks`);

    // Get existing songs to check for conflicts
    const existingSongs = LocalSongStorage.getAllSongs(userEmail);
    const existingTitles = new Set(existingSongs.map(s => s.title.toLowerCase()));
    
    let importedSongs = 0;
    let importedTracks = 0;
    let skippedSongs = 0;

    // Process each song from manifest
    for (const manifestSong of manifest.songs) {
      try {
        // Check for title conflicts (offer to skip duplicates)
        if (existingTitles.has(manifestSong.title.toLowerCase())) {
          console.warn(`⚠️ Song "${manifestSong.title}" already exists, skipping`);
          skippedSongs++;
          continue;
        }

        // Read song data
        const songFile = zip.file(`songs/${manifestSong.newId}.json`);
        if (!songFile) {
          console.error(`❌ Song file missing for: ${manifestSong.title}`);
          continue;
        }
        
        const songData: LocalSong = JSON.parse(await songFile.async('text'));
        
        // Generate final new IDs for this import session
        const finalSongId = crypto.randomUUID();
        const finalTracks = [];

        // Process tracks
        for (const trackMapping of manifestSong.tracks) {
          const finalTrackId = crypto.randomUUID();
          
          // Import audio file
          const audioFile = zip.file(`audio/${trackMapping.newId}.audio`);
          if (audioFile) {
            try {
              const audioBlob = await audioFile.async('blob');
              const audioFile_obj = new File([audioBlob], trackMapping.fileName, { 
                type: 'audio/*',
                lastModified: Date.now()
              });
              
              // Store in browser file system with final track ID
              await browserFS.addAudioFile(finalSongId, finalTrackId, trackMapping.name, audioFile_obj);
              console.log(`✅ Imported audio for track: ${trackMapping.name}`);
              importedTracks++;
            } catch (error) {
              console.error(`❌ Failed to import audio for track ${trackMapping.name}:`, error);
              continue; // Skip this track if audio import fails
            }
          } else {
            console.warn(`⚠️ Audio file missing for track: ${trackMapping.name}`);
            continue; // Skip tracks without audio
          }

          // Add track to song with final ID
          finalTracks.push({
            id: finalTrackId,
            name: trackMapping.name,
            volume: 1,
            muted: false,
            solo: false,
            balance: 0
          });
        }

        // Only add song if it has tracks
        if (finalTracks.length > 0) {
          // Create song with final ID and tracks
          const finalSongData: LocalSong = {
            ...songData,
            id: finalSongId,
            tracks: finalTracks,
            createdAt: new Date().toISOString() // Mark as newly imported
          };

          // Add to local storage
          const allSongs = LocalSongStorage.getAllSongs(userEmail);
          allSongs.push(finalSongData);
          LocalSongStorage.saveSongs(userEmail, allSongs);
          
          // Import waveform if available
          const waveformFile = zip.file(`waveforms/${manifestSong.newId}.json`);
          if (waveformFile) {
            try {
              const waveformData = JSON.parse(await waveformFile.async('text'));
              waveformGenerator.setCachedWaveform(finalSongId, waveformData);
              console.log(`📈 Imported waveform for: ${manifestSong.title}`);
            } catch (error) {
              console.warn(`⚠️ Failed to import waveform for ${manifestSong.title}:`, error);
            }
          }

          console.log(`✅ Imported song: "${manifestSong.title}" with ${finalTracks.length} tracks`);
          importedSongs++;
        } else {
          console.warn(`⚠️ Skipping song "${manifestSong.title}" - no valid tracks`);
          skippedSongs++;
        }

      } catch (error) {
        console.error(`❌ Failed to import song "${manifestSong.title}":`, error);
        skippedSongs++;
      }
    }

    console.log(`✅ Import complete: ${importedSongs} songs, ${importedTracks} tracks imported. ${skippedSongs} skipped.`);
    
    if (importedSongs === 0) {
      throw new Error('No songs were imported. Check for file format issues or duplicate titles.');
    }
  }

  /**
   * Generate a filename for the backup
   */
  static generateBackupFilename(userEmail: string): string {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
    const userPrefix = userEmail.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
    return `stagetracker-backup-${userPrefix}-${timestamp}.zip`;
  }
}