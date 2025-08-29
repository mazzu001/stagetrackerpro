import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { useDatabase } from '../providers/DatabaseProvider';
import { ErrorBoundary, withErrorHandler } from '../components/ErrorBoundary';

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

function TrackManagerScreenInner() {
  console.log('=== TrackManagerScreen RENDER START ===');
  const route = useRoute();
  const navigation = useNavigation();
  
  let songId: string | undefined;
  try {
    const params = route.params as { songId: string };
    songId = params?.songId;
    console.log('Route params:', params);
    console.log('Extracted songId:', songId);
  } catch (error) {
    console.error('Error extracting route params:', error);
  }
  
  const { songs, getTracksBySong, addTrack, deleteTrack } = useDatabase();
  const [song, setSong] = useState<any>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    console.log('TrackManagerScreen useEffect triggered with songId:', songId);
    loadData();
  }, [songId]);

  const loadData = () => {
    try {
      if (!songId) {
        console.error('No songId provided for loadData');
        return;
      }

      const foundSong = songs.find(s => s.id === songId);
      setSong(foundSong || null);
      
      const songTracks = getTracksBySong(songId);
      setTracks(Array.isArray(songTracks) ? songTracks : []);
    } catch (error) {
      console.error('Failed to load data:', error);
      setTracks([]);
      setSong(null);
    }
  };

  const handleAddTracks = withErrorHandler(async () => {
    console.log('=== Starting handleAddTracks ===');
      // Validate inputs first
      if (!songId) {
        console.error('No songId provided');
        Alert.alert('Error', 'No song selected');
        return;
      }

      if (isUploading) {
        console.warn('Upload already in progress');
        Alert.alert('Info', 'Upload already in progress');
        return;
      }

      console.log('Attempting to open document picker...');
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        multiple: true,
        copyToCacheDirectory: true,
      });
      console.log('Document picker result type:', typeof result);
      console.log('Document picker result keys:', Object.keys(result || {}));
      console.log('Document picker canceled:', result?.canceled);
      console.log('Document picker assets length:', result?.assets?.length);
      console.log('Document picker full result:', JSON.stringify(result, null, 2));

      if (result.canceled) {
        console.log('User canceled document picker');
        return;
      }

      if (!result.assets) {
        console.error('No assets in result');
        Alert.alert('Error', 'No files were selected');
        return;
      }

      // Validate result structure
      if (!Array.isArray(result.assets)) {
        console.error('Assets is not an array:', typeof result.assets, result.assets);
        Alert.alert('Error', 'Invalid file selection result');
        return;
      }

      if (result.assets.length === 0) {
        console.log('No files selected');
        Alert.alert('Info', 'No audio files were selected');
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
      let successCount = 0;
      let errorCount = 0;
      
      for (const asset of result.assets) {
        console.log(`Processing asset: ${asset?.name || 'unnamed'}`);
        try {
          // Validate asset structure
          if (!asset || !asset.uri) {
            console.error('Invalid asset:', asset);
            errorCount++;
            continue;
          }

          console.log(`Asset URI: ${asset.uri}`);
          console.log(`Asset name: ${asset.name}`);
          console.log(`Asset size: ${asset.size}`);

          // Create a permanent file path with safe filename
          const fileName = asset.name ? 
            asset.name.replace(/[^a-zA-Z0-9.-]/g, '_') : 
            `track_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.mp3`;
          
          const permanentPath = `${FileSystem.documentDirectory}audio/${fileName}`;
          console.log(`Target path: ${permanentPath}`);
          
          // Ensure audio directory exists
          console.log('Creating audio directory...');
          await FileSystem.makeDirectoryAsync(
            `${FileSystem.documentDirectory}audio/`,
            { intermediates: true }
          );

          // Verify source file exists before copying
          console.log('Verifying source file exists...');
          const sourceInfo = await FileSystem.getInfoAsync(asset.uri);
          console.log('Source file info:', sourceInfo);
          if (!sourceInfo.exists) {
            throw new Error('Source file does not exist');
          }

          // Copy file to permanent location
          console.log('Copying file...');
          await FileSystem.copyAsync({
            from: asset.uri,
            to: permanentPath,
          });

          // Verify the copied file exists
          console.log('Verifying copied file...');
          const copiedInfo = await FileSystem.getInfoAsync(permanentPath);
          console.log('Copied file info:', copiedInfo);
          if (!copiedInfo.exists) {
            throw new Error('Failed to copy file to permanent location');
          }

          // Extract track name from filename (remove extension)
          const trackName = fileName.replace(/\.[^/.]+$/, '');
          console.log(`Track name: ${trackName}`);

          // Add track to database with proper error handling
          console.log('Adding track to database...');
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
          successCount++;
        } catch (error) {
          console.error(`Failed to add track ${asset?.name || 'unknown'}:`, error);
          errorCount++;
          
          // Clean up any partial files
          try {
            const fileName = asset?.name ? 
              asset.name.replace(/[^a-zA-Z0-9.-]/g, '_') : 
              `track_${Date.now()}.mp3`;
            const permanentPath = `${FileSystem.documentDirectory}audio/${fileName}`;
            const fileInfo = await FileSystem.getInfoAsync(permanentPath);
            if (fileInfo.exists) {
              await FileSystem.deleteAsync(permanentPath);
            }
          } catch (cleanupError) {
            console.error('Failed to clean up partial file:', cleanupError);
          }
        }
      }

      // Refresh data after all operations
      try {
        loadData();
      } catch (refreshError) {
        console.error('Failed to refresh data:', refreshError);
      }
      
      // Show appropriate success/error message
      if (successCount > 0 && errorCount === 0) {
        Alert.alert(
          'Success',
          `Added ${successCount} track(s) successfully`
        );
      } else if (successCount > 0 && errorCount > 0) {
        Alert.alert(
          'Partial Success',
          `Added ${successCount} track(s) successfully. ${errorCount} track(s) failed to upload.`
        );
      } else {
        Alert.alert(
          'Upload Failed',
          'Failed to add any tracks. Please try again.'
        );
      }
    console.log('=== handleAddTracks finally block ===');
    setIsUploading(false);
    console.log('=== End handleAddTracks ===');
  }, 'Add tracks operation');

  const handleDeleteTrack = (track: Track) => {
    if (!track || !track.id) {
      Alert.alert('Error', 'Invalid track data');
      return;
    }

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
              // Delete the audio file first
              if (track.filePath) {
                try {
                  const fileInfo = await FileSystem.getInfoAsync(track.filePath);
                  if (fileInfo.exists) {
                    await FileSystem.deleteAsync(track.filePath);
                    console.log(`Deleted audio file: ${track.filePath}`);
                  }
                } catch (fileError) {
                  console.error('Failed to delete audio file:', fileError);
                  // Continue with database deletion even if file deletion fails
                }
              }

              // Delete from database
              await deleteTrack(track.id);
              
              // Refresh data
              loadData();
              
              console.log(`Successfully deleted track: ${track.name}`);
            } catch (error) {
              console.error('Failed to delete track:', error);
              Alert.alert(
                'Error', 
                `Failed to delete track: ${error instanceof Error ? error.message : 'Unknown error'}`
              );
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

export default function TrackManagerScreen() {
  return (
    <ErrorBoundary>
      <TrackManagerScreenInner />
    </ErrorBoundary>
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