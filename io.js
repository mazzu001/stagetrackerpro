// Import/Export functionality for StageTracker Pro
// Handles complete database backup and restore operations

import { 
  getSongs, addSong, updateSong, deleteSong, 
  getTracks, addTrack, updateTrack, deleteTrack,
  getAudioFiles, addAudioFile, updateAudioFile, deleteAudioFile,
  putWaveform, getWaveformByTrack, getMasterWaveformBySong,
  wipeDatabase, closeDatabase
} from './db.js';

// Lightweight zip.js loader (streaming ZIP writer/reader, ZIP64 support)
async function getZipLib() {
  if (window.zip) return window.zip;
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/@zip.js/zip.js@2.7.34/dist/zip.min.js';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load zip.js'));
    document.head.appendChild(s);
  });
  if (!window.zip) throw new Error('zip.js not available');
  window.zip.configure({ useWebWorkers: true });
  return window.zip;
}

// Safe file/folder component for inside-archive paths
function safePathComponent(name) {
  return String(name || '')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim() || 'file';
}

/**
 * Alternative method to clear all data from the database without deleting it
 * This is used when wipeDatabase() fails due to blocked connections
 */
async function clearAllData() {
  console.log('Starting alternative data clearing method...');
  
  try {
    // Get all songs and delete them one by one (this will cascade delete)
    const songs = await getSongs();
    console.log(`Found ${songs.length} songs to delete`);
    
    for (const song of songs) {
      try {
        await deleteSong(song.id);
        console.log(`Deleted song: ${song.title}`);
      } catch (error) {
        console.warn(`Failed to delete song ${song.title}:`, error);
      }
    }
    
    // Verify all data is cleared
    const remainingSongs = await getSongs();
    if (remainingSongs.length > 0) {
      throw new Error(`Failed to clear all data. ${remainingSongs.length} songs remain.`);
    }
    
    console.log('Alternative data clearing completed successfully');
  } catch (error) {
    console.error('Alternative data clearing failed:', error);
    throw error;
  }
}

/**
 * Exports the complete StageTracker Pro database to a downloadable file
 * @returns {Promise<Object>} Export results
 */
export async function exportCompleteDatabase(optionsOrFilename) {
  const progressModal = createProgressModal('Exporting Database', 'Preparing export...');
  
  try {
    console.log('Starting database export...');
    
    // Create the export data structure
    const exportData = {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      appName: 'StageTracker Pro',
      data: {
        songs: [],
        tracks: [],
        audioFiles: [],
        waveforms: []
      }
    };

    // Export all songs
    progressModal.updateProgress(10, 'Exporting songs...');
    console.log('Exporting songs...');
    const songs = await getSongs();
    exportData.data.songs = songs;
    console.log(`Exported ${songs.length} songs`);

    // Export all tracks for each song
    progressModal.updateProgress(25, 'Exporting tracks...');
    console.log('Exporting tracks...');
    let totalTracks = 0;
    for (let i = 0; i < songs.length; i++) {
      const song = songs[i];
      const tracks = await getTracks(song.id);
      exportData.data.tracks.push(...tracks);
      totalTracks += tracks.length;
      
      // Update progress for tracks
      const trackProgress = 25 + (15 * (i + 1) / songs.length);
      progressModal.updateProgress(trackProgress, `Exporting tracks... (${i + 1}/${songs.length} songs)`);
    }
    console.log(`Exported ${totalTracks} tracks`);

    // Export all audio files for each track
    progressModal.updateProgress(40, 'Exporting audio files...');
    console.log('Exporting audio files...');
    let totalAudioFiles = 0;
    const tracks = exportData.data.tracks;
    
    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      try {
        const audioFiles = await getAudioFiles(track.id);
        // Convert audio file blobs to base64 for JSON serialization
        for (const audioFile of audioFiles) {
          try {
            if (audioFile.blob) {
              audioFile.blobData = await blobToBase64(audioFile.blob);
              audioFile.blobType = audioFile.blob.type;
              delete audioFile.blob; // Remove the actual blob object
            }
          } catch (blobError) {
            console.warn(`Failed to convert blob for audio file ${audioFile.name}:`, blobError);
            // Skip this audio file's blob data but keep the metadata
            if (audioFile.blob) {
              delete audioFile.blob;
            }
          }
        }
        exportData.data.audioFiles.push(...audioFiles);
        totalAudioFiles += audioFiles.length;
        
        // Update progress for audio files
        const audioProgress = 40 + (20 * (i + 1) / tracks.length);
        progressModal.updateProgress(audioProgress, `Exporting audio files... (${i + 1}/${tracks.length} tracks)`);
      } catch (trackError) {
        console.warn(`Failed to export audio files for track ${track.id}:`, trackError);
      }
    }
    console.log(`Exported ${totalAudioFiles} audio files`);

    // Export all waveforms
    progressModal.updateProgress(60, 'Exporting waveforms...');
    console.log('Exporting waveforms...');
    let totalWaveforms = 0;
    
    // Export track waveforms
    const totalWaveformOperations = exportData.data.tracks.length + songs.length;
    let waveformProgress = 0;
    
    for (const track of exportData.data.tracks) {
      try {
        const waveform = await getWaveformByTrack(track.id);
        if (waveform) {
          // Convert Uint8Array to regular array for JSON serialization
          if (waveform.peaks instanceof Uint8Array) {
            waveform.peaksArray = Array.from(waveform.peaks);
            delete waveform.peaks;
          }
          exportData.data.waveforms.push(waveform);
          totalWaveforms++;
        }
      } catch (waveError) {
        console.warn(`Failed to export waveform for track ${track.id}:`, waveError);
      }
      
      waveformProgress++;
      const progress = 60 + (15 * waveformProgress / totalWaveformOperations);
      progressModal.updateProgress(progress, `Exporting waveforms... (${waveformProgress}/${totalWaveformOperations})`);
    }

    // Export master waveforms
    for (const song of songs) {
      try {
        const masterWaveform = await getMasterWaveformBySong(song.id);
        if (masterWaveform) {
          // Convert Uint8Array to regular array for JSON serialization
          if (masterWaveform.peaks instanceof Uint8Array) {
            masterWaveform.peaksArray = Array.from(masterWaveform.peaks);
            delete masterWaveform.peaks;
          }
          exportData.data.waveforms.push(masterWaveform);
          totalWaveforms++;
        }
      } catch (masterWaveError) {
        console.warn(`Failed to export master waveform for song ${song.id}:`, masterWaveError);
      }
      
      waveformProgress++;
      const progress = 60 + (15 * waveformProgress / totalWaveformOperations);
      progressModal.updateProgress(progress, `Exporting waveforms... (${waveformProgress}/${totalWaveformOperations})`);
    }
    console.log(`Exported ${totalWaveforms} waveforms`);

    // Create and download the export file
    progressModal.updateProgress(75, 'Creating export file...');
    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    
    progressModal.updateProgress(90, 'Preparing download...');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const defaultName = `StageTracker-Export-${timestamp}`;
    let provided = null;
    if (typeof optionsOrFilename === 'string') provided = optionsOrFilename;
    if (optionsOrFilename && typeof optionsOrFilename === 'object' && typeof optionsOrFilename.filename === 'string') {
      provided = optionsOrFilename.filename;
    }
    const finalFilename = ensureStageprojExtension(sanitizeFilename(provided || defaultName));

    downloadBlob(blob, finalFilename);
    
    progressModal.setSuccess(`Export completed successfully! Downloaded ${finalFilename}`);
    
    setTimeout(() => {
      progressModal.close();
    }, 3000);
    
    console.log('Database export completed successfully!');
    return {
      success: true,
      message: `Export completed: ${songs.length} songs, ${totalTracks} tracks, ${totalAudioFiles} audio files, ${totalWaveforms} waveforms`,
      filename: finalFilename
    };

  } catch (error) {
    console.error('Export failed:', error);
    progressModal.setError(`Export failed: ${error.message}`);
    
    setTimeout(() => {
      progressModal.close();
    }, 5000);
    
    throw new Error(`Export failed: ${error.message}`);
  }
}

/**
 * Imports a complete StageTracker Pro database from a file
 * This will completely replace the existing database
 * @param {File} file - The .stageproj file to import
 * @returns {Promise<Object>} Import results
 */
export async function importCompleteDatabase(file) {
  const progressModal = createProgressModal('Importing Database', 'Validating file...');
  
  try {
    console.log('Starting database import...');
    
    // Validate file
    if (!file) {
      throw new Error('No file provided for import');
    }
    
    if (!file.name.endsWith('.stageproj') && file.type !== 'application/json') {
      throw new Error('Invalid file format. Please select a .stageproj file.');
    }

    // Read and parse the file
    progressModal.updateProgress(5, 'Reading file...');
    const fileContent = await readFileAsText(file);
    let importData;
    
    try {
      importData = JSON.parse(fileContent);
    } catch (parseError) {
      throw new Error('Invalid file format. Could not parse JSON data.');
    }

    // Validate import data structure
    if (!importData.data || !importData.data.songs) {
      throw new Error('Invalid export file structure. Missing required data.');
    }

    progressModal.updateProgress(10, 'Validating import data...');
    console.log('Validating import data...');
    console.log(`Found ${importData.data.songs.length} songs to import`);
    console.log(`Found ${importData.data.tracks?.length || 0} tracks to import`);
    console.log(`Found ${importData.data.audioFiles?.length || 0} audio files to import`);
    console.log(`Found ${importData.data.waveforms?.length || 0} waveforms to import`);

    // COMPLETE DATABASE REPLACEMENT - Wipe existing data
    progressModal.updateProgress(15, 'Wiping existing database...');
    console.log('Wiping existing database...');
    
    try {
      // Close open connections first; many browsers block delete when any tab holds a connection
      progressModal.updateStatus('Closing database connections...');
      await closeDatabase();

      // Add timeout to wipeDatabase to prevent hanging
      const attemptDelete = async () => {
        const wipePromise = wipeDatabase();
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Database wipe timed out after 8 seconds')), 8000);
        });
        await Promise.race([wipePromise, timeoutPromise]);
      };

      try {
        await attemptDelete();
      } catch (firstErr) {
        console.warn('First delete attempt failed, retrying after short delay...', firstErr);
        await new Promise(r => setTimeout(r, 500));
        await closeDatabase();
        await attemptDelete();
      }

      console.log('Database wiped successfully');
    } catch (wipeError) {
      console.error('Failed to wipe database:', wipeError);
      // Try alternative approach - clear all data instead of deleting database
      progressModal.updateStatus('Delete blocked; clearing data instead...');
      console.log('Attempting alternative database clear...');
      try {
        await clearAllData();
        console.log('Database cleared using alternative method');
      } catch (clearError) {
        console.error('Alternative clear also failed:', clearError);
        throw new Error(`Failed to wipe existing database: ${wipeError.message}. Alternative clear also failed: ${clearError.message}`);
      }
    }
    
    // Force database to reinitialize by trying to open it
    progressModal.updateProgress(18, 'Reinitializing database...');
    console.log('Reinitializing database...');
    
    try {
      // Test database access to ensure it's properly reinitialized
      const testSongs = await getSongs();
      console.log('Database reinitialized successfully, found', testSongs.length, 'songs (should be 0)');
    } catch (reinitError) {
      console.error('Failed to reinitialize database:', reinitError);
      throw new Error(`Failed to reinitialize database: ${reinitError.message}`);
    }
    
    console.log('Database ready for import');

    const importResults = {
      songsImported: 0,
      tracksImported: 0,
      audioFilesImported: 0,
      waveformsImported: 0,
      errors: []
    };

    // Create ID mapping for relationships (old ID -> new ID)
    const songIdMap = new Map();
    const trackIdMap = new Map();

    // Import songs first
    progressModal.updateProgress(20, 'Importing songs...');
    console.log('Importing songs...');
    for (let i = 0; i < importData.data.songs.length; i++) {
      const songData = importData.data.songs[i];
      try {
        const oldSongId = songData.id;
        
        // Validate song data structure
        if (!songData.title) {
          throw new Error('Song missing required title field');
        }
        
        // Clean the song data - remove any fields that might cause issues
        const cleanSongData = {
          title: songData.title,
          artist: songData.artist || '',
          lyrics: songData.lyrics || '',
          notes: songData.notes || '',
          createdAt: songData.createdAt || new Date().toISOString()
        };
        
        console.log(`Importing song: ${cleanSongData.title}`);
        console.log(`About to call addSong with clean data:`, cleanSongData);
        
        // Add timeout to detect hanging operations
        const addSongPromise = addSong(cleanSongData);
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('addSong operation timed out after 15 seconds')), 15000);
        });
        
        const newSongId = await Promise.race([addSongPromise, timeoutPromise]);
        console.log(`Song "${cleanSongData.title}" imported with new ID: ${newSongId}`);
        
        songIdMap.set(oldSongId, newSongId);
        importResults.songsImported++;
        
        // Update progress
        const songProgress = 20 + (20 * (i + 1) / importData.data.songs.length);
        progressModal.updateProgress(songProgress, `Imported "${cleanSongData.title}" (${i + 1}/${importData.data.songs.length})`);
      } catch (error) {
        console.error('Failed to import song:', songData?.title || 'Unknown', error);
        console.error('Song data that failed:', songData);
        importResults.errors.push(`Failed to import song "${songData?.title || 'Unknown'}": ${error.message}`);
        
        // Continue with next song instead of stopping
        continue;
      }
    }

    // Import tracks
    const newSongTrackCounts = new Map(); // newSongId -> count
    if (importData.data.tracks && importData.data.tracks.length > 0) {
      progressModal.updateProgress(40, 'Importing tracks...');
      console.log('Importing tracks...');
      for (let i = 0; i < importData.data.tracks.length; i++) {
        const trackData = importData.data.tracks[i];
        try {
          const oldTrackId = trackData.id;
          const oldSongId = trackData.songId;
          
          delete trackData.id; // Let the database assign new ID
          trackData.songId = songIdMap.get(oldSongId);
          
          if (!trackData.songId) {
            console.warn(`Skipping track - parent song not found for old song ID ${oldSongId}`);
            continue;
          }
          
          const newTrackId = await addTrack(trackData);
          trackIdMap.set(oldTrackId, newTrackId);
          importResults.tracksImported++;
          
          // Count tracks per new songId
          const sid = trackData.songId;
          newSongTrackCounts.set(sid, (newSongTrackCounts.get(sid) || 0) + 1);
          
          // Update progress
          const trackProgress = 40 + (20 * (i + 1) / importData.data.tracks.length);
          progressModal.updateProgress(trackProgress, `Importing tracks... (${i + 1}/${importData.data.tracks.length})`);
        } catch (error) {
          console.error('Failed to import track:', error);
          importResults.errors.push(`Failed to import track "${trackData.name}": ${error.message}`);
        }
      }
    }

    // Persist track counts on songs so UI shows correct numbers
    try {
      progressModal.updateProgress(59, 'Updating track counts...');
      const currentSongs = await getSongs();
      let updated = 0;
      for (const s of currentSongs) {
        const desired = newSongTrackCounts.get(s.id) || 0;
        if (s.tracks !== desired) {
          s.tracks = desired;
          try {
            await updateSong(s);
            updated++;
          } catch (e) {
            console.warn('Failed to update track count for song', s.id, e);
          }
        }
      }
      console.log(`Updated track counts on ${updated} songs.`);
    } catch (e) {
      console.warn('Unable to persist track counts; UI may show 0 temporarily.', e);
    }

    // Import audio files
    if (importData.data.audioFiles && importData.data.audioFiles.length > 0) {
      progressModal.updateProgress(60, 'Importing audio files...');
      console.log('Importing audio files...');
      for (let i = 0; i < importData.data.audioFiles.length; i++) {
        const audioFileData = importData.data.audioFiles[i];
        try {
          const oldTrackId = audioFileData.trackId;
          
          delete audioFileData.id; // Let the database assign new ID
          audioFileData.trackId = trackIdMap.get(oldTrackId);
          
          if (!audioFileData.trackId) {
            console.warn(`Skipping audio file - parent track not found for old track ID ${oldTrackId}`);
            continue;
          }
          
          // Restore blob from base64 data
          if (audioFileData.blobData && audioFileData.blobType) {
            audioFileData.blob = base64ToBlob(audioFileData.blobData, audioFileData.blobType);
            delete audioFileData.blobData;
            delete audioFileData.blobType;
          }
          
          await addAudioFile(audioFileData);
          importResults.audioFilesImported++;
          
          // Update progress
          const audioProgress = 60 + (15 * (i + 1) / importData.data.audioFiles.length);
          progressModal.updateProgress(audioProgress, `Importing audio files... (${i + 1}/${importData.data.audioFiles.length})`);
        } catch (error) {
          console.error('Failed to import audio file:', error);
          importResults.errors.push(`Failed to import audio file "${audioFileData.name}": ${error.message}`);
        }
      }
    }

    // Import waveforms
    if (importData.data.waveforms && importData.data.waveforms.length > 0) {
      progressModal.updateProgress(75, 'Importing waveforms...');
      console.log('Importing waveforms...');
      for (let i = 0; i < importData.data.waveforms.length; i++) {
        const waveformData = importData.data.waveforms[i];
        try {
          // Update IDs based on mapping
          if (waveformData.songId) {
            waveformData.songId = songIdMap.get(waveformData.songId);
          }
          if (waveformData.trackId) {
            waveformData.trackId = trackIdMap.get(waveformData.trackId);
          }
          
          // Skip if parent objects weren't imported successfully
          if (waveformData.songId === undefined || (waveformData.type === 'track' && waveformData.trackId === undefined)) {
            console.warn('Skipping waveform - parent object not found');
            continue;
          }
          
          // Restore Uint8Array from regular array
          if (waveformData.peaksArray) {
            waveformData.peaks = new Uint8Array(waveformData.peaksArray);
            delete waveformData.peaksArray;
          }
          
          await putWaveform(waveformData);
          importResults.waveformsImported++;
          
          // Update progress
          const waveProgress = 75 + (15 * (i + 1) / importData.data.waveforms.length);
          progressModal.updateProgress(waveProgress, `Importing waveforms... (${i + 1}/${importData.data.waveforms.length})`);
        } catch (error) {
          console.error('Failed to import waveform:', error);
          importResults.errors.push(`Failed to import waveform: ${error.message}`);
        }
      }
    }

    progressModal.updateProgress(90, 'Finalizing import...');
    console.log('Database import completed!');
    console.log('Import results:', importResults);

    // Wait a moment to ensure all database operations are complete
    await new Promise(resolve => setTimeout(resolve, 500));

    progressModal.setSuccess(`Import completed successfully! ${importResults.songsImported} songs imported.`);
    
    setTimeout(() => {
      progressModal.close();
    }, 3000);

    return {
      success: true,
      message: `Import completed: ${importResults.songsImported} songs, ${importResults.tracksImported} tracks, ${importResults.audioFilesImported} audio files, ${importResults.waveformsImported} waveforms`,
      results: importResults
    };

  } catch (error) {
    console.error('Import failed:', error);
    progressModal.setError(`Import failed: ${error.message}`);
    
    setTimeout(() => {
      progressModal.close();
    }, 5000);
    
    throw new Error(`Import failed: ${error.message}`);
  }
}

/**
 * Utility function to convert Blob to Base64
 * @param {Blob} blob - The blob to convert
 * @returns {Promise<string>} Base64 string
 */
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1]; // Remove the data:type;base64, prefix
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Utility function to convert Base64 to Blob
 * @param {string} base64 - The base64 string
 * @param {string} mimeType - The MIME type
 * @returns {Blob} The blob object
 */
function base64ToBlob(base64, mimeType) {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

/**
 * Utility function to read file as text
 * @param {File} file - The file to read
 * @returns {Promise<string>} File content as text
 */
function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

/**
 * Utility function to trigger file download
 * @param {Blob} blob - The blob to download
 * @param {string} filename - The filename
 */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  
  // Clean up the URL object
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

// Sanitize filename: remove forbidden characters and trim dots/spaces
function sanitizeFilename(name) {
  const fallback = 'StageTracker-Export';
  const raw = String(name || '').trim();
  const cleaned = raw
    // Replace Windows-invalid characters: \ / : * ? " < > |
    .replace(/[\\/:*?"<>|]+/g, '-')
    // Collapse consecutive spaces/dashes
    .replace(/[\s-]{2,}/g, ' ')
    .trim()
    // Trim trailing dots/spaces (Windows disallows)
    .replace(/[\.\s]+$/g, '')
    || fallback;
  return cleaned;
}

function ensureStageprojExtension(name) {
  const n = String(name || 'StageTracker-Export').trim();
  return n.toLowerCase().endsWith('.stageproj') ? n : `${n}.stageproj`;
}

/**
 * Creates sample data for testing purposes
 * @returns {Promise<void>}
 */
export async function createSampleData() {
  try {
    console.log('Creating sample data...');
    
    // Create a sample song
    const sampleSong = {
      title: 'Sample Song',
      artist: 'Test Artist',
      lyrics: '[00:10] This is a test song\n[00:20] With sample lyrics\n[00:30] For testing import/export',
      notes: 'This is a sample song created for testing the import/export functionality.',
      createdAt: new Date().toISOString()
    };
    
    const songId = await addSong(sampleSong);
    console.log(`Created sample song with ID: ${songId}`);
    
    // Create a sample track
    const sampleTrack = {
      songId: songId,
      name: 'Sample Track',
      color: '#4fc3f7',
      volume: 0.8,
      solo: false,
      mute: false,
      orderIndex: 0
    };
    
    const trackId = await addTrack(sampleTrack);
    console.log(`Created sample track with ID: ${trackId}`);
    
    showNotification('Sample data created successfully!', 'success');
    
    return { songId, trackId };
    
  } catch (error) {
    console.error('Failed to create sample data:', error);
    showNotification(`Failed to create sample data: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Creates and shows a progress modal for import/export operations
 * @param {string} title - The title of the operation
 * @param {string} initialMessage - Initial status message
 * @returns {Object} Progress modal controller
 */
export function createProgressModal(title, initialMessage = 'Starting...') {
  // Create modal backdrop
  const backdrop = document.createElement('div');
  backdrop.className = 'progress-modal-backdrop';
  Object.assign(backdrop.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    zIndex: '20000',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  });
  
  // Create modal content
  const modal = document.createElement('div');
  modal.className = 'progress-modal';
  Object.assign(modal.style, {
    backgroundColor: '#2a2a2a',
    borderRadius: '12px',
    padding: '30px',
    minWidth: '400px',
    maxWidth: '500px',
    color: 'white',
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
    textAlign: 'center'
  });
  
  // Title
  const titleEl = document.createElement('h2');
  titleEl.textContent = title;
  Object.assign(titleEl.style, {
    margin: '0 0 20px 0',
    fontSize: '1.4rem',
    color: '#ffffff'
  });
  
  // Status message
  const statusEl = document.createElement('div');
  statusEl.textContent = initialMessage;
  Object.assign(statusEl.style, {
    marginBottom: '20px',
    fontSize: '1rem',
    color: '#cccccc'
  });
  
  // Progress bar container
  const progressContainer = document.createElement('div');
  Object.assign(progressContainer.style, {
    width: '100%',
    height: '8px',
    backgroundColor: '#404040',
    borderRadius: '4px',
    overflow: 'hidden',
    marginBottom: '15px'
  });
  
  // Progress bar fill
  const progressFill = document.createElement('div');
  Object.assign(progressFill.style, {
    width: '0%',
    height: '100%',
    backgroundColor: '#4fc3f7',
    borderRadius: '4px',
    transition: 'width 0.3s ease',
    background: 'linear-gradient(90deg, #4fc3f7, #29b6f6)'
  });
  
  // Progress percentage
  const percentageEl = document.createElement('div');
  percentageEl.textContent = '0%';
  Object.assign(percentageEl.style, {
    fontSize: '0.9rem',
    color: '#4fc3f7',
    marginTop: '10px'
  });
  
  // Assembly
  progressContainer.appendChild(progressFill);
  modal.appendChild(titleEl);
  modal.appendChild(statusEl);
  modal.appendChild(progressContainer);
  modal.appendChild(percentageEl);
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);
  
  return {
    updateProgress(percentage, message) {
      progressFill.style.width = `${Math.min(100, Math.max(0, percentage))}%`;
      percentageEl.textContent = `${Math.round(percentage)}%`;
      if (message) {
        statusEl.textContent = message;
      }
    },
    updateStatus(message) {
      statusEl.textContent = message;
    },
    close() {
      if (backdrop.parentNode) {
        backdrop.parentNode.removeChild(backdrop);
      }
    },
    setSuccess(message) {
      statusEl.textContent = message;
      progressFill.style.background = 'linear-gradient(90deg, #4caf50, #66bb6a)';
      progressFill.style.width = '100%';
      percentageEl.textContent = '100%';
      percentageEl.style.color = '#4caf50';
    },
    setError(message) {
      statusEl.textContent = message;
      progressFill.style.background = 'linear-gradient(90deg, #f44336, #ef5350)';
      percentageEl.style.color = '#f44336';
    }
  };
}

/**
 * Creates a generic card modal with a title, summary grid, details list, and actions
 */
function createPreviewModal({ title, subtitle, items = [], details = [], confirmText = 'Continue', cancelText = 'Cancel', onConfirm, textInput }) {
  // Backdrop
  const backdrop = document.createElement('div');
  Object.assign(backdrop.style, {
    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
    background: 'rgba(0,0,0,0.6)', zIndex: 21000, display: 'flex', alignItems: 'center', justifyContent: 'center'
  });

  // Card
  const card = document.createElement('div');
  Object.assign(card.style, {
    background: '#1f1f1f', color: '#fff', borderRadius: '12px', padding: '24px', width: '520px', maxWidth: '90vw',
    boxShadow: '0 10px 30px rgba(0,0,0,0.5)', fontFamily: 'system-ui, sans-serif'
  });

  const h = document.createElement('h2');
  h.textContent = title;
  Object.assign(h.style, { margin: '0 0 6px 0', fontSize: '1.25rem' });
  card.appendChild(h);

  if (subtitle) {
    const sub = document.createElement('div');
    sub.textContent = subtitle;
    Object.assign(sub.style, { marginBottom: '16px', color: '#bdbdbd' });
    card.appendChild(sub);
  }

  // Optional text input (e.g., export filename)
  let inputEl = null;
  if (textInput && (textInput.label || textInput.placeholder)) {
    const wrap = document.createElement('div');
    Object.assign(wrap.style, { marginBottom: '14px' });
    if (textInput.label) {
      const lab = document.createElement('label');
      lab.textContent = textInput.label;
      Object.assign(lab.style, { display: 'block', marginBottom: '6px', color: '#cccccc', fontSize: '0.95rem' });
      wrap.appendChild(lab);
    }
    inputEl = document.createElement('input');
    inputEl.type = 'text';
    inputEl.placeholder = textInput.placeholder || '';
    inputEl.value = textInput.defaultValue || '';
    Object.assign(inputEl.style, {
      width: '100%', padding: '10px 12px', borderRadius: '8px',
      border: '1px solid #3a3a3a', background: '#2a2a2a', color: '#fff',
      outline: 'none'
    });
    wrap.appendChild(inputEl);
    if (textInput.helpText) {
      const help = document.createElement('div');
      help.textContent = textInput.helpText;
      Object.assign(help.style, { marginTop: '6px', color: '#9e9e9e', fontSize: '0.85rem' });
      wrap.appendChild(help);
    }
    card.appendChild(wrap);
    // Focus the input by default
    setTimeout(() => { try { inputEl.focus(); inputEl.select(); } catch(_) {} }, 0);
  }

  // Summary grid
  if (items && items.length) {
    const grid = document.createElement('div');
    Object.assign(grid.style, { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' });
    items.forEach(({ label, value }) => {
      const row = document.createElement('div');
      Object.assign(row.style, { display: 'flex', justifyContent: 'space-between', background: '#2a2a2a', padding: '10px 12px', borderRadius: '8px' });
      const l = document.createElement('div'); l.textContent = label; l.style.color = '#9e9e9e';
      const v = document.createElement('div'); v.textContent = String(value); v.style.fontWeight = '600'; v.style.color = '#4fc3f7';
      row.appendChild(l); row.appendChild(v); grid.appendChild(row);
    });
    card.appendChild(grid);
  }

  // Details list
  if (details && details.length) {
    const dl = document.createElement('div');
    Object.assign(dl.style, { background: '#242424', borderRadius: '8px', padding: '10px 12px', maxHeight: '200px', overflow: 'auto', marginBottom: '16px' });
    details.forEach((text) => {
      const li = document.createElement('div');
      li.textContent = text;
      Object.assign(li.style, { padding: '6px 0', borderBottom: '1px solid #2f2f2f' });
      dl.appendChild(li);
    });
    card.appendChild(dl);
  }

  // Actions
  const actions = document.createElement('div');
  Object.assign(actions.style, { display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' });
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = cancelText;
  Object.assign(cancelBtn.style, { background: '#424242', color: '#fff', border: 'none', padding: '10px 14px', borderRadius: '8px', cursor: 'pointer' });
  const confirmBtn = document.createElement('button');
  confirmBtn.textContent = confirmText;
  Object.assign(confirmBtn.style, { background: '#4fc3f7', color: '#0a0a0a', border: 'none', padding: '10px 14px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 });
  actions.appendChild(cancelBtn); actions.appendChild(confirmBtn);
  card.appendChild(actions);

  cancelBtn.addEventListener('click', () => {
    if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
  });
  confirmBtn.addEventListener('click', async () => {
    confirmBtn.disabled = true; cancelBtn.disabled = true; confirmBtn.style.opacity = '0.7';
    try {
      const payload = inputEl ? { inputValue: inputEl.value } : undefined;
      await onConfirm?.(payload);
    } finally {
      if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
    }
  });

  backdrop.appendChild(card);
  document.body.appendChild(backdrop);
  confirmBtn.focus();
}

/**
 * Show a preview for export: counts and top song titles
 */
export async function showExportPreview() {
  try {
    const songs = await getSongs();
    const songCount = songs.length;
    // Compute track count by summing per song (best-effort)
    let trackCount = 0;
    for (const s of songs) {
      try { const t = await getTracks(s.id); trackCount += (t?.length || 0); } catch(_) {}
    }
    const topTitles = songs.slice(0, 8).map(s => `• ${s.title}${s.artist ? ' – ' + s.artist : ''}`);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const defaultName = `StageTracker-Export-${timestamp}`;

    createPreviewModal({
      title: 'Export Archive',
      subtitle: 'Create a full backup of your library',
      items: [
        { label: 'Songs', value: songCount },
        { label: 'Tracks (total)', value: trackCount }
      ],
      details: topTitles,
      textInput: {
        label: 'File name',
        placeholder: 'e.g., My-Show-Backup',
        defaultValue: defaultName,
        helpText: 'Invalid filename characters will be replaced automatically. The .stageproj extension is added if missing.'
      },
      confirmText: 'Start Export',
      onConfirm: async (ctx) => {
        const raw = String(ctx?.inputValue || '').trim();
        const fname = ensureStageprojExtension(sanitizeFilename(raw || defaultName));
        await exportCompleteDatabase(fname);
      }
    });
  } catch (e) {
    showNotification(`Unable to prepare export preview: ${e.message}`, 'error');
  }
}

/**
 * Show a preview for import by reading the file and summarizing contents
 */
export async function showImportPreview(file, options = {}) {
  try {
    if (!file) throw new Error('No file selected');
    const { onAfterImport } = options || {};
    const text = await readFileAsText(file);
    let data;
    try { data = JSON.parse(text); } catch(_) { throw new Error('Invalid archive file'); }
    if (!data?.data?.songs) throw new Error('Archive missing songs');
    const songs = data.data.songs || [];
    const tracks = data.data.tracks || [];
    const topTitles = songs.slice(0, 8).map(s => `• ${s.title}${s.artist ? ' – ' + s.artist : ''}`);

    createPreviewModal({
      title: 'Import Archive',
      subtitle: `This will REPLACE your current library with "${file.name}"`,
      items: [
        { label: 'Songs (to import)', value: songs.length },
        { label: 'Tracks (to import)', value: tracks.length }
      ],
      details: topTitles,
      confirmText: 'Start Import',
      onConfirm: async () => {
        const result = await importCompleteDatabase(file);
        try { if (typeof onAfterImport === 'function') { await onAfterImport(result); } } catch (e) { /* ignore */ }
      }
    });
  } catch (e) {
    showNotification(`Unable to prepare import preview: ${e.message}`, 'error');
  }
}

/**
 * Shows a user-friendly notification
 * @param {string} message - The message to show
 * @param {string} type - The type of notification ('success', 'error', 'info')
 */
export function showNotification(message, type = 'info') {
  // Create a simple notification div
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  
  // Style the notification
  Object.assign(notification.style, {
    position: 'fixed',
    top: '20px',
    right: '20px',
    backgroundColor: type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : '#2196f3',
    color: 'white',
    padding: '12px 20px',
    borderRadius: '4px',
    zIndex: '10000',
    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
    maxWidth: '400px',
    wordWrap: 'break-word'
  });
  
  document.body.appendChild(notification);
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 5000);
  
  // Allow manual dismissal on click
  notification.addEventListener('click', () => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  });
}
