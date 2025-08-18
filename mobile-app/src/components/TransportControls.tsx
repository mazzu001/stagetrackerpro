import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Slider,
} from 'react-native';

interface TransportControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSeek: (position: number) => void;
}

export default function TransportControls({
  isPlaying,
  currentTime,
  duration,
  onPlay,
  onPause,
  onStop,
  onSeek,
}: TransportControlsProps) {
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSeekStart = () => {
    setIsSeeking(true);
    setSeekValue(currentTime);
  };

  const handleSeekChange = (value: number) => {
    setSeekValue(value);
  };

  const handleSeekEnd = (value: number) => {
    setIsSeeking(false);
    onSeek(value);
  };

  const progressValue = isSeeking ? seekValue : currentTime;
  const progressPercentage = duration > 0 ? (progressValue / duration) * 100 : 0;

  return (
    <View style={styles.container}>
      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <Text style={styles.timeText}>{formatTime(progressValue)}</Text>
        
        <View style={styles.sliderContainer}>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={duration}
            value={progressValue}
            onValueChange={handleSeekChange}
            onSlidingStart={handleSeekStart}
            onSlidingComplete={handleSeekEnd}
            minimumTrackTintColor="#007AFF"
            maximumTrackTintColor="#555"
            thumbStyle={styles.sliderThumb}
            trackStyle={styles.sliderTrack}
          />
        </View>
        
        <Text style={styles.timeText}>{formatTime(duration)}</Text>
      </View>

      {/* Transport Buttons */}
      <View style={styles.buttonsContainer}>
        <TouchableOpacity
          style={styles.transportButton}
          onPress={onStop}
        >
          <View style={styles.stopIcon} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.transportButton, styles.playPauseButton]}
          onPress={isPlaying ? onPause : onPlay}
        >
          {isPlaying ? (
            <View style={styles.pauseIcon}>
              <View style={styles.pauseBar} />
              <View style={styles.pauseBar} />
            </View>
          ) : (
            <View style={styles.playIcon} />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.transportButton}
          onPress={() => onSeek(0)}
        >
          <View style={styles.rewindIcon}>
            <View style={styles.rewindBar} />
            <View style={styles.rewindTriangle} />
            <View style={styles.rewindTriangle} />
          </View>
        </TouchableOpacity>
      </View>

      {/* Progress Percentage */}
      <Text style={styles.progressText}>
        {progressPercentage.toFixed(1)}%
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  timeText: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: 'monospace',
    minWidth: 50,
    textAlign: 'center',
  },
  sliderContainer: {
    flex: 1,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  sliderThumb: {
    backgroundColor: '#007AFF',
    width: 20,
    height: 20,
  },
  sliderTrack: {
    height: 4,
    borderRadius: 2,
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    marginBottom: 8,
  },
  transportButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#555',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playPauseButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#007AFF',
  },
  playIcon: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 15,
    borderRightWidth: 0,
    borderTopWidth: 10,
    borderBottomWidth: 10,
    borderLeftColor: '#ffffff',
    borderRightColor: 'transparent',
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    marginLeft: 3,
  },
  pauseIcon: {
    flexDirection: 'row',
    gap: 4,
  },
  pauseBar: {
    width: 4,
    height: 20,
    backgroundColor: '#ffffff',
  },
  stopIcon: {
    width: 16,
    height: 16,
    backgroundColor: '#ffffff',
  },
  rewindIcon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rewindBar: {
    width: 2,
    height: 16,
    backgroundColor: '#ffffff',
  },
  rewindTriangle: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderRightWidth: 8,
    borderLeftWidth: 0,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderRightColor: '#ffffff',
    borderLeftColor: 'transparent',
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  progressText: {
    color: '#aaa',
    fontSize: 12,
    textAlign: 'center',
    fontFamily: 'monospace',
  },
});