import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useLocalAuth } from '../hooks/useLocalAuth';
import { fileSystemManager, LocalAudioFile } from '../utils/fileSystem';
import FileSystemManager from './FileSystemManager';

export interface Song {
  id: string;
  title: string;
  artist: string;
  duration?: number;
  bpm?: number;
  key?: string;
  lyrics: string;
  tracks: Track[];
  createdAt: number;
  updatedAt: number;
  userId: string;
}

export interface Track {
  id: string;
  songId: string;
  name: string;
  fileId: string; // Reference to LocalAudioFile
  volume: number;
  muted: boolean;
  solo: boolean;
  balance: number;
  order: number;
  createdAt: number;
  updatedAt: number;
}

interface SongManagerProps {
  isVisible: boolean;
  onClose: () => void;
  onSongSelect?: (song: Song) => void;
  selectedSongId?: string;
}

export default function SongManager({ 
  isVisible, 
  onClose, 
  onSongSelect,
  selectedSongId 
}: SongManagerProps) {
  const { user } = useLocalAuth();
  const [songs, setSongs] = useState<Song[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFileManager, setShowFileManager] = useState(false);
  const [editingSong, setEditingSong] = useState<Song | null>(null);
  const [currentSong, setCurrentSong] = useState<Partial<Song>>({
    title: '',
    artist: '',
    lyrics: '',
    bpm: undefined,
    key: '',
  });

  useEffect(() => {
    if (isVisible) {
      loadSongs();
    }
  }, [isVisible]);

  const loadSongs = async () => {
    try {
      setIsLoading(true);
      // In a real app, this would load from a database
      // For now, we'll use localStorage simulation
      const savedSongs = await getSavedSongs();
      setSongs(savedSongs);
    } catch (error) {
      console.error('❌ Failed to load songs:', error);
      Alert.alert('Error', 'Failed to load songs');
    } finally {
      setIsLoading(false);
    }
  };

  const getSavedSongs = async (): Promise<Song[]> => {
    try {
      // Mock song storage - in real app this would be in a database
      const mockSongs: Song[] = [
        {
          id: 'song-1',
          title: '3 AM',
          artist: 'Matchbox 20',
          duration: 229,
          bpm: 120,
          key: 'G',
          lyrics: `[0:02]She said, "It's cold outside, " and she hands me my raincoat[[PC:12:1]]
[0:04]She's always worried about things like that
[0:05]Well, she said, "It's all gonna end and it might as well be my fault"
[0:06]And she only sleeps when it's raining
[0:08]And she screams, and her voice is straining
[0:10]She says, "Baby, it's 3 AM, I must be lonely"
[0:12]And she says, "Baby, well, I can't help
[0:14]But be scared of it all sometimes
[0:15]And the rain's gonna wash away, I believe it"`,
          tracks: [],
          createdAt: Date.now() - 86400000,
          updatedAt: Date.now(),
          userId: user?.email || 'demo'
        }
      ];
      
      return mockSongs.filter(song => song.userId === user?.email);
    } catch (error) {
      console.error('Failed to get saved songs:', error);
      return [];
    }
  };

  const saveSong = async (song: Song) => {
    try {
      // In a real app, this would save to a database
      console.log('💾 Saving song:', song);
      await loadSongs();
      return true;
    } catch (error) {
      console.error('❌ Failed to save song:', error);
      return false;
    }
  };

  const handleCreateSong = () => {
    setEditingSong(null);
    setCurrentSong({
      title: '',
      artist: '',
      lyrics: '',
      bpm: undefined,
      key: '',
    });
    setShowCreateModal(true);
  };

  const handleEditSong = (song: Song) => {
    setEditingSong(song);
    setCurrentSong(song);
    setShowCreateModal(true);
  };

  const handleSaveSong = async () => {
    if (!currentSong.title?.trim()) {
      Alert.alert('Error', 'Song title is required');
      return;
    }

    if (!currentSong.artist?.trim()) {
      Alert.alert('Error', 'Artist name is required');
      return;
    }

    try {
      setIsLoading(true);
      
      const songData: Song = {
        id: editingSong?.id || `song-${Date.now()}`,
        title: currentSong.title.trim(),
        artist: currentSong.artist.trim(),
        lyrics: currentSong.lyrics || '',
        bpm: currentSong.bpm,
        key: currentSong.key,
        tracks: editingSong?.tracks || [],
        createdAt: editingSong?.createdAt || Date.now(),
        updatedAt: Date.now(),
        userId: user?.email || 'demo'
      };

      const success = await saveSong(songData);
      if (success) {
        setShowCreateModal(false);
        Alert.alert('Success', `Song ${editingSong ? 'updated' : 'created'} successfully`);
      } else {
        Alert.alert('Error', 'Failed to save song');
      }
    } catch (error) {
      console.error('❌ Failed to save song:', error);
      Alert.alert('Error', 'Failed to save song');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSong = (song: Song) => {
    Alert.alert(
      'Delete Song',
      `Are you sure you want to delete "${song.title}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            // In a real app, this would delete from database
            console.log('🗑️ Deleting song:', song.id);
            await loadSongs();
          }
        }
      ]
    );
  };

  const handleAddTrack = (song: Song) => {
    setEditingSong(song);
    setShowFileManager(true);
  };

  const handleFileSelect = async (file: LocalAudioFile) => {
    if (!editingSong) return;

    try {
      const newTrack: Track = {
        id: `track-${Date.now()}`,
        songId: editingSong.id,
        name: file.originalName.replace(/\.[^/.]+$/, ''), // Remove extension
        fileId: file.id,
        volume: 1.0,
        muted: false,
        solo: false,
        balance: 0,
        order: editingSong.tracks.length,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const updatedSong: Song = {
        ...editingSong,
        tracks: [...editingSong.tracks, newTrack],
        updatedAt: Date.now()
      };

      await saveSong(updatedSong);
      setShowFileManager(false);
      setEditingSong(null);
      Alert.alert('Success', `Added track "${newTrack.name}" to "${editingSong.title}"`);
    } catch (error) {
      console.error('❌ Failed to add track:', error);
      Alert.alert('Error', 'Failed to add track');
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <>
      <Modal visible={isVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Song Library</Text>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.createButton}
                onPress={handleCreateSong}
              >
                <Text style={styles.createButtonText}>+ New</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={styles.songList}>
            {isLoading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingText}>Loading songs...</Text>
              </View>
            )}

            {!isLoading && songs.length === 0 && (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No songs found</Text>
                <Text style={styles.emptySubtext}>
                  Create your first song to get started
                </Text>
              </View>
            )}

            {!isLoading && songs.map((song) => (
              <View
                key={song.id}
                style={[
                  styles.songCard,
                  selectedSongId === song.id && styles.songCardSelected
                ]}
              >
                <TouchableOpacity
                  style={styles.songInfo}
                  onPress={() => onSongSelect?.(song)}
                >
                  <Text style={styles.songTitle}>{song.title}</Text>
                  <Text style={styles.songArtist}>{song.artist}</Text>
                  
                  <View style={styles.songDetails}>
                    <Text style={styles.songDetail}>
                      {formatDuration(song.duration)}
                    </Text>
                    {song.bpm && (
                      <>
                        <Text style={styles.songDetail}>•</Text>
                        <Text style={styles.songDetail}>{song.bpm} BPM</Text>
                      </>
                    )}
                    {song.key && (
                      <>
                        <Text style={styles.songDetail}>•</Text>
                        <Text style={styles.songDetail}>Key: {song.key}</Text>
                      </>
                    )}
                    <Text style={styles.songDetail}>•</Text>
                    <Text style={styles.songDetail}>
                      {song.tracks.length} track(s)
                    </Text>
                  </View>
                  
                  <Text style={styles.songDate}>
                    Modified: {formatDate(song.updatedAt)}
                  </Text>
                </TouchableOpacity>

                <View style={styles.songActions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleAddTrack(song)}
                  >
                    <Text style={styles.actionButtonText}>🎵</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleEditSong(song)}
                  >
                    <Text style={styles.actionButtonText}>✏️</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleDeleteSong(song)}
                  >
                    <Text style={styles.actionButtonText}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            {/* Bottom padding */}
            <View style={{ height: 50 }} />
          </ScrollView>
        </View>
      </Modal>

      {/* Create/Edit Song Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {editingSong ? 'Edit Song' : 'Create Song'}
            </Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowCreateModal(false)}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.formContainer}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Title *</Text>
              <TextInput
                style={styles.input}
                value={currentSong.title}
                onChangeText={(text) => setCurrentSong(prev => ({ ...prev, title: text }))}
                placeholder="Enter song title"
                placeholderTextColor="#666"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Artist *</Text>
              <TextInput
                style={styles.input}
                value={currentSong.artist}
                onChangeText={(text) => setCurrentSong(prev => ({ ...prev, artist: text }))}
                placeholder="Enter artist name"
                placeholderTextColor="#666"
              />
            </View>

            <View style={styles.formRow}>
              <View style={styles.formGroupHalf}>
                <Text style={styles.label}>BPM</Text>
                <TextInput
                  style={styles.input}
                  value={currentSong.bpm?.toString() || ''}
                  onChangeText={(text) => setCurrentSong(prev => ({ 
                    ...prev, 
                    bpm: text ? parseInt(text) || undefined : undefined 
                  }))}
                  placeholder="120"
                  placeholderTextColor="#666"
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.formGroupHalf}>
                <Text style={styles.label}>Key</Text>
                <TextInput
                  style={styles.input}
                  value={currentSong.key}
                  onChangeText={(text) => setCurrentSong(prev => ({ ...prev, key: text }))}
                  placeholder="C, G, Am..."
                  placeholderTextColor="#666"
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Lyrics</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={currentSong.lyrics}
                onChangeText={(text) => setCurrentSong(prev => ({ ...prev, lyrics: text }))}
                placeholder="Enter lyrics with timestamps: [0:30]Verse line..."
                placeholderTextColor="#666"
                multiline
                numberOfLines={10}
                textAlignVertical="top"
              />
              <Text style={styles.helperText}>
                Use [mm:ss] for timestamps and [[PC:12:1]] for MIDI commands
              </Text>
            </View>

            <View style={styles.formActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowCreateModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSaveSong}
                disabled={isLoading}
              >
                <Text style={styles.saveButtonText}>
                  {isLoading ? 'Saving...' : 'Save Song'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* File Manager Modal */}
      <FileSystemManager
        isVisible={showFileManager}
        onClose={() => setShowFileManager(false)}
        onFileSelect={handleFileSelect}
      />
    </>
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
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  createButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  createButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  songList: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    color: '#aaa',
    marginTop: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtext: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
  },
  songCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#444',
  },
  songCardSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#1a3d5c',
  },
  songInfo: {
    flex: 1,
  },
  songTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  songArtist: {
    fontSize: 14,
    color: '#aaa',
    marginBottom: 8,
  },
  songDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  songDetail: {
    fontSize: 12,
    color: '#666',
  },
  songDate: {
    fontSize: 11,
    color: '#666',
    fontStyle: 'italic',
  },
  songActions: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'flex-start',
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 14,
  },
  formContainer: {
    flex: 1,
    padding: 16,
  },
  formGroup: {
    marginBottom: 20,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  formGroupHalf: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    color: '#ffffff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#444',
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  helperText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
  },
  formActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    marginBottom: 40,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#333',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});