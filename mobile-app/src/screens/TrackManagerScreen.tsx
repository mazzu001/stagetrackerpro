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
import { useSimpleDatabase } from '../providers/SimpleDatabase';


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
  
  const { songs, getTracksBySong, addTrack, deleteTrack } = useSimpleDatabase();
  const [song, setSong] = useState<any>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (songId && songs.length > 0) {
      loadData();
    }
  }, [songId, songs.length]);

  const loadData = () => {
    if (!songId) return;
    
    const foundSong = songs.find(s => s.id === songId);
    setSong(foundSong);
    
    const songTracks = getTracksBySong(songId);
    setTracks(songTracks);
  };

  const handleAddTracks = async () => {
    try {
      if (!songId) {
        Alert.alert('Error', 'No song selected');
        return;
      }

      if (isUploading) {
        Alert.alert('Info', 'Upload already in progress');
        return;
      }

      setIsUploading(true);

      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets) {
        setIsUploading(false);
        return;
      }

      if (tracks.length + result.assets.length > 6) {
        Alert.alert(
          'Too Many Tracks',
          `You can only have 6 tracks per song. You currently have ${tracks.length} tracks.`
        );
        setIsUploading(false);
        return;
      }

      for (const asset of result.assets) {
        if (!asset?.uri || !asset?.name) continue;

        try {
          const fileName = asset.name.replace(/[^a-zA-Z0-9.-]/g, '_');
          const permanentPath = `${FileSystem.documentDirectory}audio/${fileName}`;
          
          await FileSystem.makeDirectoryAsync(
            `${FileSystem.documentDirectory}audio/`,
            { intermediates: true }
          );

          await FileSystem.copyAsync({
            from: asset.uri,
            to: permanentPath,
          });

          const trackName = fileName.replace(/\.[^/.]+$/, '');
          await addTrack({
            songId,
            name: trackName,
            filePath: permanentPath,
            volume: 0.8,
            muted: false,
            solo: false,
            balance: 0,
          });
        } catch (error) {
          console.error('Failed to process file:', asset.name, error);
        }
      }

      loadData();
      Alert.alert('Success', 'Tracks added successfully');
    } catch (error) {
      console.error('Failed to add tracks:', error);
      Alert.alert('Error', 'Failed to add tracks');
    } finally {
      setIsUploading(false);
    }
  };

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
              if (track.filePath) {
                try {
                  const fileInfo = await FileSystem.getInfoAsync(track.filePath);
                  if (fileInfo.exists) {
                    await FileSystem.deleteAsync(track.filePath);
                  }
                } catch (fileError) {
                  console.error('Failed to delete audio file:', fileError);
                }
              }

              await deleteTrack(track.id);
              loadData();
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