import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useMinimalStorage } from '../providers/MinimalStorage';

// Optimized track item component to prevent unnecessary re-renders
const TrackItem = React.memo(({ track, onDelete }: { track: any; onDelete: (id: string) => void }) => (
  <View style={styles.trackItem}>
    <View style={styles.trackInfo}>
      <Text style={styles.trackName}>{track.name}</Text>
    </View>
    <TouchableOpacity
      style={styles.deleteButton}
      onPress={() => onDelete(track.id)}
      activeOpacity={0.7}
    >
      <Text style={styles.deleteButtonText}>Delete</Text>
    </TouchableOpacity>
  </View>
));

export default function InstantTrackManager() {
  const route = useRoute();
  const navigation = useNavigation();
  const { songId } = route.params as { songId: string };
  
  const { songs, tracks, addTrack, deleteTrack } = useMinimalStorage();
  const [counter, setCounter] = useState(1);

  // Cache computed values to prevent recalculation on every render
  const song = React.useMemo(() => songs.find(s => s.id === songId), [songs, songId]);
  const songTracks = React.useMemo(() => tracks.filter(t => t.songId === songId), [tracks, songId]);

  // Optimized add track function with immediate UI feedback
  const handleAddTrack = useCallback(() => {
    const trackName = `Instant Track ${counter}`;
    
    // Update counter immediately for UI responsiveness
    setCounter(prev => prev + 1);
    
    // Add track with zero delay
    addTrack({
      songId,
      name: trackName,
    });
  }, [counter, songId, addTrack]);

  // Optimized delete with no confirmation for speed
  const handleDeleteTrack = useCallback((trackId: string) => {
    deleteTrack(trackId);
  }, [deleteTrack]);

  const handleGoToPerformance = useCallback(() => {
    navigation.navigate('Performance', { songId });
  }, [navigation, songId]);

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
          <Text style={styles.trackCount}>Tracks: {songTracks.length}</Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={handleAddTrack}
          activeOpacity={0.7}
        >
          <Text style={styles.addButtonText}>+ INSTANT ADD</Text>
        </TouchableOpacity>
      </View>

      {songTracks.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No Tracks</Text>
          <Text style={styles.emptyText}>Tap "INSTANT ADD" for zero-delay track addition</Text>
        </View>
      ) : (
        <ScrollView 
          style={styles.tracksList}
          removeClippedSubviews={true}
          showsVerticalScrollIndicator={false}
        >
          {songTracks.map(track => (
            <TrackItem
              key={track.id}
              track={track}
              onDelete={handleDeleteTrack}
            />
          ))}
        </ScrollView>
      )}

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.performanceButton}
          onPress={handleGoToPerformance}
          activeOpacity={0.7}
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
  trackCount: {
    fontSize: 12,
    color: '#4CAF50',
    marginTop: 4,
    fontWeight: '600',
  },
  addButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    elevation: 2,
  },
  addButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 12,
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
  },
  tracksList: {
    flex: 1,
    padding: 16,
  },
  trackItem: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 1,
  },
  trackInfo: {
    flex: 1,
  },
  trackName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
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
    elevation: 2,
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