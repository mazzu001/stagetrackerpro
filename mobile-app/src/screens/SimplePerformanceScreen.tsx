import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useSimpleDatabase } from '../providers/SimpleDatabase';
import { useSimpleAudioEngine } from '../providers/SimpleAudioEngine';

export default function SimplePerformanceScreen() {
  const route = useRoute();
  const { songId } = route.params as { songId: string };
  
  const { songs, getTracksBySong } = useSimpleDatabase();
  const { isPlaying, currentTime, duration, play, pause, stop, loadSong } = useSimpleAudioEngine();
  
  const [song, setSong] = useState<any>(null);
  const [tracks, setTracks] = useState<any[]>([]);

  useEffect(() => {
    if (!songId) return;
    
    const foundSong = songs.find(s => s.id === songId);
    if (foundSong) {
      setSong(foundSong);
      const songTracks = getTracksBySong(songId);
      setTracks(songTracks);
      loadSong(songId);
    }
  }, [songId, songs.length]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  };

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
        <Text style={styles.songTitle}>{song.title}</Text>
        <Text style={styles.songArtist}>{song.artist}</Text>
        <Text style={styles.trackCount}>{tracks.length} tracks loaded</Text>
      </View>

      <View style={styles.timeDisplay}>
        <Text style={styles.currentTime}>{formatTime(currentTime)}</Text>
        <Text style={styles.duration}>/ {formatTime(duration)}</Text>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity style={styles.stopButton} onPress={stop}>
          <Text style={styles.stopButtonText}>⏹️</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.playButton} onPress={handlePlayPause}>
          <Text style={styles.playButtonText}>{isPlaying ? '⏸️' : '▶️'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tracksList}>
        <Text style={styles.tracksTitle}>Tracks:</Text>
        {tracks.map(track => (
          <View key={track.id} style={styles.trackItem}>
            <Text style={styles.trackName}>{track.name}</Text>
            <Text style={styles.trackVolume}>Vol: {Math.round(track.volume * 100)}%</Text>
          </View>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  songTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  songArtist: {
    fontSize: 18,
    color: '#aaa',
    marginBottom: 8,
  },
  trackCount: {
    fontSize: 14,
    color: '#666',
  },
  timeDisplay: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  currentTime: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  duration: {
    fontSize: 24,
    color: '#aaa',
    marginLeft: 8,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 30,
    marginBottom: 40,
  },
  stopButton: {
    backgroundColor: '#333',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stopButtonText: {
    fontSize: 24,
  },
  playButton: {
    backgroundColor: '#4CAF50',
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButtonText: {
    fontSize: 32,
  },
  tracksList: {
    flex: 1,
  },
  tracksTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 16,
  },
  trackItem: {
    backgroundColor: '#2a2a2a',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  trackName: {
    color: '#ffffff',
    fontSize: 16,
  },
  trackVolume: {
    color: '#aaa',
    fontSize: 14,
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