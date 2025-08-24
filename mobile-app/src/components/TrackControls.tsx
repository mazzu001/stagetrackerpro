import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Slider,
} from 'react-native';
import VUMeterEnhanced from './VUMeterEnhanced';

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
  onVolumeChange: (volume: number) => void;
  onMuteToggle: (muted: boolean) => void;
  onSoloToggle: (solo: boolean) => void;
  onBalanceChange: (balance: number) => void;
  isProfessional?: boolean;
}

export default function TrackControls({
  track,
  audioLevel,
  onVolumeChange,
  onMuteToggle,
  onSoloToggle,
  onBalanceChange,
  isProfessional = false,
}: TrackControlsProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const handleVolumeUp = () => {
    const newVolume = Math.min(1, track.volume + 0.1);
    onVolumeChange(newVolume);
  };

  const handleVolumeDown = () => {
    const newVolume = Math.max(0, track.volume - 0.1);
    onVolumeChange(newVolume);
  };
  
  const formatDbLevel = (level: number) => {
    if (level === 0) return "-∞dB";
    const db = 20 * Math.log10(level);
    return `${db > 0 ? '+' : ''}${db.toFixed(1)}dB`;
  };
  
  const formatVolume = (volume: number) => {
    return `${Math.round(volume * 100)}%`;
  };
  
  const formatBalance = (balance: number) => {
    if (balance === 0) return 'C';
    if (balance < 0) return `L${Math.abs(Math.round(balance * 100))}`;
    return `R${Math.round(balance * 100)}`;
  };

  return (
    <View style={styles.container}>
      {/* Track Name */}
      <Text style={styles.trackName} numberOfLines={1}>
        {track.name}
      </Text>

      {/* VU Meters - Stereo for Professional */}
      <View style={styles.vuMeterContainer}>
        {isProfessional ? (
          <View style={styles.stereoVUContainer}>
            <View style={styles.vuChannel}>
              <Text style={styles.channelLabel}>L</Text>
              <VUMeterEnhanced
                level={audioLevel ? audioLevel.left * 100 : 0}
                height={80}
                width={16}
                showPeak={true}
              />
            </View>
            <View style={styles.vuChannel}>
              <Text style={styles.channelLabel}>R</Text>
              <VUMeterEnhanced
                level={audioLevel ? audioLevel.right * 100 : 0}
                height={80}
                width={16}
                showPeak={true}
              />
            </View>
          </View>
        ) : (
          <VUMeterEnhanced
            level={audioLevel ? ((audioLevel.left + audioLevel.right) / 2) * 100 : 0}
            height={60}
            width={20}
            showPeak={true}
          />
        )}
        
        {/* dB Level Display for Professional */}
        {isProfessional && audioLevel && (
          <Text style={styles.dbLevel}>
            {formatDbLevel((audioLevel.left + audioLevel.right) / 2)}
          </Text>
        )}
      </View>

      {/* Volume Controls */}
      <View style={styles.volumeSection}>
        <Text style={styles.controlLabel}>Volume</Text>
        {isProfessional ? (
          <View style={styles.sliderContainer}>
            <Slider
              style={styles.volumeSlider}
              minimumValue={0}
              maximumValue={1}
              value={track.volume}
              onValueChange={onVolumeChange}
              minimumTrackTintColor="#4CAF50"
              maximumTrackTintColor="#333"
              thumbStyle={styles.sliderThumb}
            />
            <Text style={styles.valueDisplay}>{formatVolume(track.volume)}</Text>
          </View>
        ) : (
          <View style={styles.volumeControls}>
            <TouchableOpacity
              style={styles.volumeButton}
              onPress={handleVolumeDown}
            >
              <Text style={styles.volumeButtonText}>-</Text>
            </TouchableOpacity>
            
            <Text style={styles.volumeText}>
              {formatVolume(track.volume)}
            </Text>
            
            <TouchableOpacity
              style={styles.volumeButton}
              onPress={handleVolumeUp}
            >
              <Text style={styles.volumeButtonText}>+</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
      
      {/* Balance Control - Professional only */}
      {isProfessional && (
        <View style={styles.balanceSection}>
          <Text style={styles.controlLabel}>Balance</Text>
          <View style={styles.sliderContainer}>
            <Slider
              style={styles.balanceSlider}
              minimumValue={-1}
              maximumValue={1}
              value={track.balance}
              onValueChange={onBalanceChange}
              minimumTrackTintColor="#FF9800"
              maximumTrackTintColor="#FF9800"
              thumbStyle={styles.sliderThumb}
            />
            <Text style={styles.valueDisplay}>{formatBalance(track.balance)}</Text>
          </View>
        </View>
      )}

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
            {track.muted ? '🔇' : '🔊'}
          </Text>
          <Text style={styles.controlButtonLabel}>MUTE</Text>
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
            {track.solo ? '🎯' : '⚪'}
          </Text>
          <Text style={styles.controlButtonLabel}>SOLO</Text>
        </TouchableOpacity>
        
        {/* Advanced Toggle for Professional */}
        {isProfessional && (
          <TouchableOpacity
            style={[
              styles.controlButton,
              styles.advancedButton,
              showAdvanced && styles.advancedButtonActive,
            ]}
            onPress={() => setShowAdvanced(!showAdvanced)}
          >
            <Text style={styles.controlButtonText}>⚙️</Text>
            <Text style={styles.controlButtonLabel}>ADV</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    minHeight: 160,
    borderWidth: 1,
    borderColor: '#444',
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
    marginBottom: 12,
  },
  stereoVUContainer: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-end',
  },
  vuChannel: {
    alignItems: 'center',
    gap: 4,
  },
  channelLabel: {
    color: '#aaa',
    fontSize: 10,
    fontWeight: '600',
  },
  dbLevel: {
    color: '#4CAF50',
    fontSize: 10,
    fontFamily: 'monospace',
    marginTop: 4,
  },
  volumeSection: {
    marginBottom: 12,
  },
  balanceSection: {
    marginBottom: 12,
  },
  controlLabel: {
    color: '#aaa',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
    textAlign: 'center',
  },
  sliderContainer: {
    alignItems: 'center',
    gap: 4,
  },
  volumeSlider: {
    width: '100%',
    height: 30,
  },
  balanceSlider: {
    width: '100%',
    height: 30,
  },
  sliderThumb: {
    backgroundColor: '#007AFF',
    width: 16,
    height: 16,
  },
  valueDisplay: {
    color: '#ffffff',
    fontSize: 11,
    fontFamily: 'monospace',
    minWidth: 40,
    textAlign: 'center',
  },
  volumeControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#555',
    minHeight: 50,
    justifyContent: 'center',
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
    fontSize: 16,
    marginBottom: 2,
  },
  controlButtonLabel: {
    color: '#aaa',
    fontSize: 9,
    fontWeight: 'bold',
  },
  controlButtonTextActive: {
    color: '#ffffff',
  },
  advancedButton: {
    backgroundColor: '#555',
  },
  advancedButtonActive: {
    backgroundColor: '#007AFF',
  },
});