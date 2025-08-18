import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useDatabase } from '../providers/DatabaseProvider';
import { useAudioEngine } from '../providers/AudioEngineProvider';
import TrackControls from '../components/TrackControls';
import TransportControls from '../components/TransportControls';
import LyricsDisplay from '../components/LyricsDisplay';
import VUMeter from '../components/VUMeter';

const { width, height } = Dimensions.get('window');

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

export default function PerformanceScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { songId } = route.params as { songId: string };
  
  const { songs, getTracksBySong } = useDatabase();
  const {
    isPlaying,
    currentTime,
    duration,
    masterVolume,
    audioLevels,
    play,
    pause,
    stop,
    seek,
    setMasterVolume,
    loadSong,
    updateTrackVolume,
    updateTrackMute,
    updateTrackSolo,
    updateTrackBalance,
  } = useAudioEngine();

  const [song, setSong] = useState<Song | null>(null);
  const [tracks, setTracks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSongData();
  }, [songId]);

  const loadSongData = async () => {
    try {
      setIsLoading(true);
      
      const foundSong = songs.find(s => s.id === songId);
      if (!foundSong) {
        console.error('Song not found:', songId);
        navigation.goBack();
        return;
      }

      setSong(foundSong);
      const songTracks = getTracksBySong(songId);
      setTracks(songTracks);

      // Load audio tracks
      await loadSong(songId);
      
      console.log(`Performance loaded: ${foundSong.title} with ${songTracks.length} tracks`);
    } catch (error) {
      console.error('Failed to load song data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlay = async () => {
    try {
      await play();
    } catch (error) {
      console.error('Failed to play:', error);
    }
  };

  const handlePause = async () => {
    try {
      await pause();
    } catch (error) {
      console.error('Failed to pause:', error);
    }
  };

  const handleStop = async () => {
    try {
      await stop();
    } catch (error) {
      console.error('Failed to stop:', error);
    }
  };

  const handleSeek = async (position: number) => {
    try {
      await seek(position);
    } catch (error) {
      console.error('Failed to seek:', error);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading performance...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!song) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Song not found</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.songInfo}>
          <Text style={styles.songTitle}>{song.title}</Text>
          <Text style={styles.songArtist}>{song.artist}</Text>
        </View>
        <View style={styles.timeInfo}>
          <Text style={styles.timeText}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </Text>
          {song.bpm && (
            <Text style={styles.bpmText}>{song.bpm} BPM</Text>
          )}
        </View>
      </View>

      {/* Main Content */}
      <View style={styles.mainContent}>
        {/* Left Panel - Track Controls */}
        <View style={styles.leftPanel}>
          <Text style={styles.panelTitle}>Tracks ({tracks.length}/6)</Text>
          <ScrollView style={styles.tracksList}>
            {tracks.map((track) => (
              <TrackControls
                key={track.id}
                track={track}
                audioLevel={audioLevels[track.id]}
                onVolumeChange={(volume) => updateTrackVolume(track.id, volume)}
                onMuteToggle={(muted) => updateTrackMute(track.id, muted)}
                onSoloToggle={(solo) => updateTrackSolo(track.id, solo)}
                onBalanceChange={(balance) => updateTrackBalance(track.id, balance)}
              />
            ))}
            
            {tracks.length === 0 && (
              <View style={styles.noTracksContainer}>
                <Text style={styles.noTracksText}>No tracks loaded</Text>
                <TouchableOpacity
                  style={styles.addTracksButton}
                  onPress={() => navigation.navigate('TrackManager', { songId })}
                >
                  <Text style={styles.addTracksButtonText}>Add Tracks</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>

        {/* Right Panel - Lyrics and Master Controls */}
        <View style={styles.rightPanel}>
          <View style={styles.masterControls}>
            <Text style={styles.panelTitle}>Master</Text>
            <View style={styles.masterVolumeContainer}>
              <VUMeter
                level={masterVolume}
                height={100}
                showPeak={false}
              />
              <Text style={styles.volumeLabel}>Volume</Text>
            </View>
          </View>

          <View style={styles.lyricsContainer}>
            <Text style={styles.panelTitle}>Lyrics</Text>
            <LyricsDisplay
              lyrics={song.lyrics || 'No lyrics available'}
              currentTime={currentTime}
              isPlaying={isPlaying}
            />
          </View>
        </View>
      </View>

      {/* Transport Controls */}
      <View style={styles.footer}>
        <TransportControls
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          onPlay={handlePlay}
          onPause={handlePause}
          onStop={handleStop}
          onSeek={handleSeek}
        />
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  songArtist: {
    fontSize: 16,
    color: '#aaa',
    marginTop: 2,
  },
  timeInfo: {
    alignItems: 'flex-end',
  },
  timeText: {
    fontSize: 16,
    color: '#ffffff',
    fontFamily: 'monospace',
  },
  bpmText: {
    fontSize: 14,
    color: '#aaa',
    marginTop: 2,
  },
  mainContent: {
    flex: 1,
    flexDirection: 'row',
    padding: 16,
    gap: 16,
  },
  leftPanel: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
  },
  rightPanel: {
    flex: 1,
    gap: 16,
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 12,
  },
  tracksList: {
    flex: 1,
  },
  noTracksContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  noTracksText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
  },
  addTracksButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addTracksButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  masterControls: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  masterVolumeContainer: {
    alignItems: 'center',
    gap: 8,
  },
  volumeLabel: {
    fontSize: 12,
    color: '#aaa',
  },
  lyricsContainer: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#333',
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#aaa',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 18,
    color: '#F44336',
    marginBottom: 16,
  },
  backButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
});