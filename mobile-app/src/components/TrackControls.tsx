import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import StereoVUMeter from './StereoVUMeter';

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

interface AudioLevel {
  left: number;
  right: number;
}

interface TrackControlsProps {
  track: Track;
  audioLevel?: AudioLevel;
  isPlaying?: boolean;
  onVolumeChange: (volume: number) => void;
  onMuteToggle: (muted: boolean) => void;
  onSoloToggle: (solo: boolean) => void;
  onBalanceChange: (balance: number) => void;
}

export default function TrackControls({
  track,
  audioLevel,
  isPlaying = false,
  onVolumeChange,
  onMuteToggle,
  onSoloToggle,
  onBalanceChange,
}: TrackControlsProps) {
  const handleVolumeUp = () => {
    const newVolume = Math.min(1, track.volume + 0.1);
    onVolumeChange(newVolume);
  };

  const handleVolumeDown = () => {
    const newVolume = Math.max(0, track.volume - 0.1);
    onVolumeChange(newVolume);
  };

  return (
    <View style={styles.container}>
      {/* Track Name */}
      <Text style={styles.trackName} numberOfLines={1}>
        {track.name}
      </Text>

      {/* VU Meter */}
      <View style={styles.vuMeterContainer}>
        <StereoVUMeter
          leftLevel={audioLevel ? audioLevel.left * 8 : 0}
          rightLevel={audioLevel ? audioLevel.right * 8 : 0}
          isPlaying={isPlaying}
          height={60}
          width={20}
        />
      </View>

      {/* Volume Controls */}
      <View style={styles.volumeControls}>
        <TouchableOpacity
          style={styles.volumeButton}
          onPress={handleVolumeDown}
        >
          <Text style={styles.volumeButtonText}>-</Text>
        </TouchableOpacity>
        
        <Text style={styles.volumeText}>
          {Math.round(track.volume * 100)}%
        </Text>
        
        <TouchableOpacity
          style={styles.volumeButton}
          onPress={handleVolumeUp}
        >
          <Text style={styles.volumeButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Control Buttons */}
      <View style={styles.controlButtons}>
        <TouchableOpacity
          style={[
            styles.controlButton,
            styles.muteButton,
            track.muted && styles.muteButtonActive,
          ]}
          onPress={() => onMuteToggle(!track.muted)}
        >
          <Text
            style={[
              styles.controlButtonText,
              track.muted && styles.controlButtonTextActive,
            ]}
          >
            MUTE
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.controlButton,
            styles.soloButton,
            track.solo && styles.soloButtonActive,
          ]}
          onPress={() => onSoloToggle(!track.solo)}
        >
          <Text
            style={[
              styles.controlButtonText,
              track.solo && styles.controlButtonTextActive,
            ]}
          >
            SOLO
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#333',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    minHeight: 140,
  },
  trackName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  vuMeterContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  volumeControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    gap: 8,
  },
  volumeButton: {
    backgroundColor: '#555',
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  volumeButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  volumeText: {
    color: '#ffffff',
    fontSize: 12,
    minWidth: 40,
    textAlign: 'center',
    fontFamily: 'monospace',
  },
  controlButtons: {
    flexDirection: 'row',
    gap: 4,
  },
  controlButton: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 4,
    alignItems: 'center',
    backgroundColor: '#555',
  },
  muteButton: {
    backgroundColor: '#555',
  },
  muteButtonActive: {
    backgroundColor: '#F44336',
  },
  soloButton: {
    backgroundColor: '#555',
  },
  soloButtonActive: {
    backgroundColor: '#4CAF50',
  },
  controlButtonText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  controlButtonTextActive: {
    color: '#ffffff',
  },
});