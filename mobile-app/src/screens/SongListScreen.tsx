import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useDatabase } from '../providers/DatabaseProvider';

interface Song {
  id: string;
  title: string;
  artist: string;
  duration: number;
  bpm?: number;
  key?: string;
  lyrics?: string;
  waveformData?: string;
  createdAt: Date;
  updatedAt: Date;
}

export default function SongListScreen() {
  const navigation = useNavigation();
  const { songs, deleteSong, addSong } = useDatabase();
  const [isCreating, setIsCreating] = useState(false);

  const handleSongPress = (song: Song) => {
    navigation.navigate('Performance', { songId: song.id });
  };

  const handleManageTracks = (song: Song) => {
    navigation.navigate('TrackManager', { songId: song.id });
  };

  const handleDeleteSong = (song: Song) => {
    Alert.alert(
      'Delete Song',
      `Are you sure you want to delete "${song.title}"? This will also delete all associated tracks and audio files.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteSong(song.id),
        },
      ]
    );
  };

  const handleCreateSong = () => {
    Alert.prompt(
      'New Song',
      'Enter song title and artist (separated by " - ")',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Create',
          onPress: async (input: string) => {
            if (!input?.trim()) return;
            
            setIsCreating(true);
            try {
              const parts = input.split(' - ');
              const title = parts[0]?.trim() || 'Untitled';
              const artist = parts[1]?.trim() || 'Unknown Artist';
              
              await addSong({
                title,
                artist,
                duration: 0,
                bpm: 120,
                key: 'C',
                lyrics: '',
                waveformData: '',
              });
            } catch (error) {
              Alert.alert('Error', 'Failed to create song');
            } finally {
              setIsCreating(false);
            }
          },
        },
      ],
      'plain-text',
      '',
      'default'
    );
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const renderSong = ({ item: song }: { item: Song }) => (
    <View style={styles.songItem}>
      <TouchableOpacity
        style={styles.songInfo}
        onPress={() => handleSongPress(song)}
        activeOpacity={0.7}
      >
        <Text style={styles.songTitle}>{song.title}</Text>
        <Text style={styles.songArtist}>{song.artist}</Text>
        <View style={styles.songMeta}>
          <Text style={styles.songMetaText}>
            {formatDuration(song.duration)}
          </Text>
          {song.bpm && (
            <Text style={styles.songMetaText}>• {song.bpm} BPM</Text>
          )}
          {song.key && (
            <Text style={styles.songMetaText}>• {song.key}</Text>
          )}
        </View>
      </TouchableOpacity>
      
      <View style={styles.songActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.manageButton]}
          onPress={() => handleManageTracks(song)}
        >
          <Text style={styles.actionButtonText}>Tracks</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => handleDeleteSong(song)}
        >
          <Text style={styles.actionButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Stage Performance</Text>
        <TouchableOpacity
          style={styles.createButton}
          onPress={handleCreateSong}
          disabled={isCreating}
        >
          <Text style={styles.createButtonText}>
            {isCreating ? 'Creating...' : '+ New Song'}
          </Text>
        </TouchableOpacity>
      </View>

      {songs.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No Songs Yet</Text>
          <Text style={styles.emptyText}>
            Create your first song to get started with stage performance
          </Text>
        </View>
      ) : (
        <FlatList
          data={songs}
          renderItem={renderSong}
          keyExtractor={(item) => item.id}
          style={styles.songList}
          contentContainerStyle={styles.songListContent}
        />
      )}
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
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  createButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  createButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
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
  },
  songList: {
    flex: 1,
  },
  songListContent: {
    padding: 16,
  },
  songItem: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  songInfo: {
    flex: 1,
  },
  songTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  songArtist: {
    fontSize: 14,
    color: '#aaa',
    marginBottom: 8,
  },
  songMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  songMetaText: {
    fontSize: 12,
    color: '#666',
    marginRight: 8,
  },
  songActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  manageButton: {
    backgroundColor: '#4CAF50',
  },
  deleteButton: {
    backgroundColor: '#F44336',
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
});