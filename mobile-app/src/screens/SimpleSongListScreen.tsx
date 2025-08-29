import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
  TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useMinimalStorage } from '../providers/MinimalStorage';

export default function SimpleSongListScreen() {
  const navigation = useNavigation();
  const { songs, addSong } = useMinimalStorage();
  const [showAddForm, setShowAddForm] = useState(false);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');

  const handleAddSong = async () => {
    if (!title.trim() || !artist.trim()) {
      Alert.alert('Error', 'Please enter both title and artist');
      return;
    }

    try {
      await addSong({
        title: title.trim(),
        artist: artist.trim(),
        duration: 0,
      });
      
      setTitle('');
      setArtist('');
      setShowAddForm(false);
      Alert.alert('Success', 'Song added successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to add song');
    }
  };

  const renderSong = (song: any) => (
    <View key={song.id} style={styles.songItem}>
      <View style={styles.songInfo}>
        <Text style={styles.songTitle}>{song.title}</Text>
        <Text style={styles.songArtist}>{song.artist}</Text>
      </View>
      
      <View style={styles.songActions}>
        <TouchableOpacity
          style={styles.trackButton}
          onPress={() => navigation.navigate('TrackManager', { songId: song.id })}
        >
          <Text style={styles.trackButtonText}>Tracks</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.performButton}
          onPress={() => navigation.navigate('Performance', { songId: song.id })}
        >
          <Text style={styles.performButtonText}>Perform</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Songs ({songs.length})</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowAddForm(!showAddForm)}
        >
          <Text style={styles.addButtonText}>+ Add Song</Text>
        </TouchableOpacity>
      </View>

      {showAddForm && (
        <View style={styles.addForm}>
          <TextInput
            style={styles.input}
            placeholder="Song Title"
            placeholderTextColor="#666"
            value={title}
            onChangeText={setTitle}
          />
          <TextInput
            style={styles.input}
            placeholder="Artist"
            placeholderTextColor="#666"
            value={artist}
            onChangeText={setArtist}
          />
          <View style={styles.formActions}>
            <TouchableOpacity style={styles.cancelButton} onPress={() => setShowAddForm(false)}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveButton} onPress={handleAddSong}>
              <Text style={styles.saveButtonText}>Add Song</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {songs.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No Songs Yet</Text>
          <Text style={styles.emptyText}>Add your first song to get started</Text>
        </View>
      ) : (
        <ScrollView style={styles.songsList} contentContainerStyle={styles.songsListContent}>
          {songs.map(renderSong)}
        </ScrollView>
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
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  addButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  addForm: {
    backgroundColor: '#2a2a2a',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  input: {
    backgroundColor: '#333',
    color: '#ffffff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    fontSize: 16,
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  cancelButtonText: {
    color: '#aaa',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  saveButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
  },
  songsList: {
    flex: 1,
  },
  songsListContent: {
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
  },
  songActions: {
    flexDirection: 'row',
    gap: 8,
  },
  trackButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  trackButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  performButton: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  performButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
});