import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { useDatabase } from '../providers/DatabaseProvider';
import { 
  executeWithCrashProtection, 
  safeFileOperation, 
  validateAndroidEnvironment,
  createAndroidSafeFileName 
} from '../utils/criticalAndroidFixes';
import { executeWithEmergencyProtection } from '../utils/emergencyCrashHandler';

interface Track {
  id: string;
  songId: string;
  name: string;
  filePath: string;
  volume: number;
  muted: boolean;
  solo: boolean;
  balance: number;
  createdAt: Date;
  updatedAt: Date;
}

export default function TrackManagerScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { songId } = route.params as { songId: string };
  
  const { songs, getTracksBySong, addTrack, deleteTrack } = useDatabase();
  const [song, setSong] = useState<any>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    loadData();
  }, [songId]);

  const loadData = () => {
    const foundSong = songs.find(s => s.id === songId);
    setSong(foundSong);
    
    const songTracks = getTracksBySong(songId);
    setTracks(songTracks);
  };

  const handleAddTracks = async () => {
    console.log('=== TRACK IMPORT START ===');
    
    // Triple-layer crash protection
    return await executeWithEmergencyProtection(async () => {
      return await executeWithCrashProtection(
        async () => {
          setIsUploading(true);
          
          // Android environment validation
          if (Platform.OS === 'android') {
            console.log('Validating Android environment...');
            const envValid = await validateAndroidEnvironment();
            if (!envValid) {
              throw new Error('Android environment validation failed');
            }
          }
          
          return await performTrackImport();
        },
        'Track Import Process',
        async () => {
          console.log('Import failed, attempting emergency cleanup...');
          setIsUploading(false);
          Alert.alert(
            'Import Failed',
            'Track import encountered a critical error and was safely handled. The app remains stable.'
          );
        }
      );
    }, 'Emergency Track Import Protection');
  };

  const performTrackImport = async () => {
    return await executeWithEmergencyProtection(async () => {
      console.log('Opening document picker...');
      
      // ULTRA-SAFE document picker with multiple fallbacks
      const result = await executeWithCrashProtection(
        async () => {
          return await DocumentPicker.getDocumentAsync({
            type: 'audio/*',
            multiple: true,
            copyToCacheDirectory: false,
          });
        },
        'Document Picker',
        async () => {
          Alert.alert('Picker Error', 'File picker failed. Please restart app and try again.');
          return { canceled: true, assets: [] };
        }
      );

      if (!result || result.canceled || !result.assets || result.assets.length === 0) {
        console.log('No valid files selected');
        return;
      }

      if (tracks.length + result.assets.length > 6) {
        Alert.alert(
          'Too Many Tracks',
          `You can only have 6 tracks per song. You currently have ${tracks.length} tracks.`
        );
        return;
      }

      setIsUploading(true);
      
      console.log(`Processing ${result.assets.length} assets...`);
      for (let i = 0; i < result.assets.length; i++) {
        const asset = result.assets[i];
        console.log(`=== Processing asset ${i + 1}/${result.assets.length} ===`);
        console.log('Asset details:', asset);
        
        try {
          // Validate asset
          if (!asset || !asset.uri) {
            console.warn('Invalid asset detected, skipping');
            continue;
          }

          // Create a critical-safe filename for Android
          const originalName = asset.name || `track_${Date.now()}.mp3`;
          console.log('Original filename:', originalName);
          
          const safeFileName = createAndroidSafeFileName(originalName);
          console.log('Safe filename:', safeFileName);
          
          const permanentPath = `${FileSystem.documentDirectory}audio/${safeFileName}`;
          console.log('Target path:', permanentPath);
          
          // Check available storage space (Android specific)
          try {
            const dirInfo = await FileSystem.getInfoAsync(FileSystem.documentDirectory);
            if (!dirInfo.exists) {
              throw new Error('Document directory not accessible');
            }
          } catch (storageError) {
            console.error('Storage access error:', storageError);
            Alert.alert(
              'Storage Error',
              'Cannot access device storage. Please check app permissions.'
            );
            continue;
          }
          
          // Ensure audio directory exists with proper error handling
          try {
            const audioDir = `${FileSystem.documentDirectory}audio/`;
            const audioDirInfo = await FileSystem.getInfoAsync(audioDir);
            if (!audioDirInfo.exists) {
              await FileSystem.makeDirectoryAsync(audioDir, { intermediates: true });
            }
          } catch (dirError) {
            console.error('Directory creation error:', dirError);
            Alert.alert(
              'Directory Error',
              'Cannot create audio directory. Storage may be full.'
            );
            continue;
          }

          // Verify source file accessibility
          try {
            const sourceInfo = await FileSystem.getInfoAsync(asset.uri);
            if (!sourceInfo.exists) {
              throw new Error('Source file not accessible');
            }
          } catch (sourceError) {
            console.error('Source file error:', sourceError);
            Alert.alert(
              'File Error',
              `Cannot access selected file: ${originalName}`
            );
            continue;
          }

          // Copy file with critical protection
          const copySuccess = await safeFileOperation(async () => {
            console.log(`Copying file from ${asset.uri} to ${permanentPath}`);
            
            // Try direct copy first
            await executeWithCrashProtection(
              async () => {
                await Promise.race([
                  FileSystem.copyAsync({
                    from: asset.uri,
                    to: permanentPath,
                  }),
                  new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Direct copy timeout')), 25000)
                  )
                ]);
                console.log('Direct copy successful');
              },
              `Direct copy: ${originalName}`,
              async () => {
                // Fallback: Read as Base64 and write
                console.log('Trying Base64 copy strategy...');
                const fileContent = await FileSystem.readAsStringAsync(asset.uri, {
                  encoding: FileSystem.EncodingType.Base64,
                });
                await FileSystem.writeAsStringAsync(permanentPath, fileContent, {
                  encoding: FileSystem.EncodingType.Base64,
                });
                console.log('Base64 copy successful');
              }
            );
          }, originalName);

          if (!copySuccess) {
            console.warn(`Failed to copy ${originalName}, skipping`);
            Alert.alert('Copy Failed', `Could not copy ${originalName}. Skipping this file.`);
            continue;
          }

          // Verify the copied file
          try {
            const copiedInfo = await FileSystem.getInfoAsync(permanentPath);
            if (!copiedInfo.exists || copiedInfo.size === 0) {
              throw new Error('File copy verification failed');
            }
          } catch (verifyError) {
            console.error('Copy verification error:', verifyError);
            // Clean up partial file
            try {
              await FileSystem.deleteAsync(permanentPath, { idempotent: true });
            } catch (cleanupError) {
              console.warn('Cleanup error:', cleanupError);
            }
            Alert.alert(
              'Verification Error',
              `File copy incomplete for ${originalName}`
            );
            continue;
          }

          // Extract track name from filename
          const trackName = safeFileName.replace(/\.[^/.]+$/, ''); // Remove extension

          // Add track to database with critical protection
          const dbSuccess = await executeWithCrashProtection(
            async () => {
              await addTrack({
                songId,
                name: trackName,
                filePath: permanentPath,
                volume: 0.8,
                muted: false,
                solo: false,
                balance: 0,
              });
              console.log(`Successfully added track: ${trackName}`);
              return true;
            },
            `Database insert: ${trackName}`,
            async () => {
              // Clean up file if database insert fails
              await executeWithCrashProtection(
                async () => {
                  await FileSystem.deleteAsync(permanentPath, { idempotent: true });
                },
                `Cleanup after DB failure: ${trackName}`
              );
              return false;
            }
          );

          if (!dbSuccess) {
            console.warn(`Failed to save ${trackName} to database, skipping`);
            Alert.alert('Database Error', `Could not save ${originalName} to database.`);
            continue;
          }

        } catch (error) {
          console.error(`Critical error processing ${asset?.name || 'unknown file'}:`, error);
          Alert.alert(
            'Processing Error',
            `Failed to process ${asset?.name || 'selected file'}: ${error.message || 'Unknown error'}`
          );
        }
      }

      // Refresh data after processing all files
      try {
        loadData();
      } catch (refreshError) {
        console.error('Failed to refresh data:', refreshError);
      }
      
      // Show success message only if we actually processed some files
      const successCount = result.assets.length;
      if (successCount > 0) {
        Alert.alert(
          'Import Complete',
          `Processed ${successCount} file(s). Check the track list for successfully imported tracks.`
        );
      }
    } catch (error) {
      console.error('Critical error in track import:', error);
      const errorMessage = error.message || 'Unknown error occurred';
      
      // Specific Android error handling
      if (Platform.OS === 'android') {
        if (errorMessage.includes('permission') || errorMessage.includes('EACCES')) {
          Alert.alert(
            'Permission Error',
            'Storage permission denied. Please enable storage permissions in app settings and try again.'
          );
        } else if (errorMessage.includes('ENOSPC') || errorMessage.includes('space')) {
          Alert.alert(
            'Storage Full',
            'Device storage is full. Please free up space and try again.'
          );
        } else if (errorMessage.includes('timeout')) {
          Alert.alert(
            'Operation Timeout',
            'File operation took too long. This may happen with large files. Please try with smaller files or check your device performance.'
          );
        } else {
          Alert.alert(
            'Android Import Error',
            `Import failed: ${errorMessage}. This may be due to Android security restrictions. Try:\n\n1. Restart the app\n2. Check storage permissions\n3. Try smaller files\n4. Free up device storage`
          );
        }
      } else {
        Alert.alert(
          'Import Failed', 
          `Track import failed: ${errorMessage}. Please try again or check device storage.`
        );
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteTrack = (track: Track) => {
    Alert.alert(
      'Delete Track',
      `Are you sure you want to delete "${track.name}"? This will also delete the audio file.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTrack(track.id);
              loadData();
            } catch (error) {
              console.error('Failed to delete track:', error);
              Alert.alert('Error', 'Failed to delete track');
            }
          },
        },
      ]
    );
  };

  const formatFileSize = (filePath: string) => {
    // This would need to be implemented with FileSystem.getInfoAsync
    return 'Unknown size';
  };

  const renderTrack = (track: Track) => (
    <View key={track.id} style={styles.trackItem}>
      <View style={styles.trackInfo}>
        <Text style={styles.trackName}>{track.name}</Text>
        <Text style={styles.trackPath}>{track.filePath.split('/').pop()}</Text>
        <View style={styles.trackMeta}>
          <Text style={styles.trackMetaText}>
            Volume: {Math.round(track.volume * 100)}%
          </Text>
          {track.muted && (
            <Text style={[styles.trackMetaText, styles.mutedText]}>Muted</Text>
          )}
          {track.solo && (
            <Text style={[styles.trackMetaText, styles.soloText]}>Solo</Text>
          )}
        </View>
      </View>
      
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDeleteTrack(track)}
      >
        <Text style={styles.deleteButtonText}>Delete</Text>
      </TouchableOpacity>
    </View>
  );

  if (!song) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Song not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.songInfo}>
          <Text style={styles.songTitle}>{song.title}</Text>
          <Text style={styles.songArtist}>{song.artist}</Text>
        </View>
        <TouchableOpacity
          style={[styles.addButton, isUploading && styles.addButtonDisabled]}
          onPress={handleAddTracks}
          disabled={isUploading || tracks.length >= 6}
        >
          <Text style={styles.addButtonText}>
            {isUploading ? 'Adding...' : '+ Add Tracks'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.trackCounter}>
        <Text style={styles.trackCounterText}>
          Tracks: {tracks.length}/6
        </Text>
      </View>

      {tracks.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No Tracks Yet</Text>
          <Text style={styles.emptyText}>
            Add audio tracks to create your backing track setup.
            Supported formats: MP3, WAV, M4A, OGG
          </Text>
          <TouchableOpacity
            style={styles.emptyAddButton}
            onPress={handleAddTracks}
            disabled={isUploading}
          >
            <Text style={styles.emptyAddButtonText}>
              {isUploading ? 'Adding Tracks...' : 'Add Your First Track'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={styles.tracksList} contentContainerStyle={styles.tracksListContent}>
          {tracks.map(renderTrack)}
        </ScrollView>
      )}

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.performanceButton}
          onPress={() => navigation.navigate('Performance', { songId })}
        >
          <Text style={styles.performanceButtonText}>Go to Performance</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  songInfo: {
    flex: 1,
  },
  songTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  songArtist: {
    fontSize: 14,
    color: '#aaa',
    marginTop: 2,
  },
  addButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonDisabled: {
    backgroundColor: '#666',
  },
  addButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  trackCounter: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  trackCounterText: {
    fontSize: 16,
    color: '#aaa',
    textAlign: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  emptyAddButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyAddButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  tracksList: {
    flex: 1,
  },
  tracksListContent: {
    padding: 16,
  },
  trackItem: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  trackInfo: {
    flex: 1,
  },
  trackName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  trackPath: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  trackMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  trackMetaText: {
    fontSize: 12,
    color: '#aaa',
  },
  mutedText: {
    color: '#F44336',
  },
  soloText: {
    color: '#4CAF50',
  },
  deleteButton: {
    backgroundColor: '#F44336',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  deleteButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#333',
    padding: 16,
  },
  performanceButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  performanceButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 18,
    color: '#F44336',
  },
});