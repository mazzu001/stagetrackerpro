import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';

interface StereoVUMeterProps {
  leftLevel: number; // 0-100
  rightLevel: number; // 0-100
  isPlaying?: boolean;
  height?: number;
  width?: number;
}

export default function StereoVUMeter({
  leftLevel,
  rightLevel,
  isPlaying = false,
  height = 60,
  width = 20,
}: StereoVUMeterProps) {
  const animatedLeftLevel = useRef(new Animated.Value(0)).current;
  const animatedRightLevel = useRef(new Animated.Value(0)).current;
  const leftPeak = useRef(0);
  const rightPeak = useRef(0);
  const leftPeakDecayRef = useRef<NodeJS.Timeout>();
  const rightPeakDecayRef = useRef<NodeJS.Timeout>();

  // Smooth animation for left channel
  useEffect(() => {
    if (!isPlaying) {
      animatedLeftLevel.setValue(0);
      leftPeak.current = 0;
      return;
    }

    // Apply amplification to make meters more reactive - mobile needs extra boost
    const amplifiedLevel = leftLevel * 1.8; // Amplify for better visibility
    const targetLevel = Math.max(0, Math.min(100, amplifiedLevel));
    
    Animated.timing(animatedLeftLevel, {
      toValue: targetLevel,
      duration: 60, // Fast response for reactive meters
      useNativeDriver: false,
    }).start();

    // Peak hold for left channel
    if (targetLevel > leftPeak.current) {
      leftPeak.current = targetLevel;
      
      if (leftPeakDecayRef.current) {
        clearTimeout(leftPeakDecayRef.current);
      }
      
      leftPeakDecayRef.current = setTimeout(() => {
        leftPeak.current = Math.max(targetLevel, leftPeak.current - 15);
      }, 100);
    }
  }, [leftLevel, isPlaying, animatedLeftLevel]);

  // Smooth animation for right channel
  useEffect(() => {
    if (!isPlaying) {
      animatedRightLevel.setValue(0);
      rightPeak.current = 0;
      return;
    }

    // Apply amplification to make meters more reactive - mobile needs extra boost
    const amplifiedLevel = rightLevel * 1.8; // Amplify for better visibility
    const targetLevel = Math.max(0, Math.min(100, amplifiedLevel));
    
    Animated.timing(animatedRightLevel, {
      toValue: targetLevel,
      duration: 60, // Fast response for reactive meters
      useNativeDriver: false,
    }).start();

    // Peak hold for right channel
    if (targetLevel > rightPeak.current) {
      rightPeak.current = targetLevel;
      
      if (rightPeakDecayRef.current) {
        clearTimeout(rightPeakDecayRef.current);
      }
      
      rightPeakDecayRef.current = setTimeout(() => {
        rightPeak.current = Math.max(targetLevel, rightPeak.current - 15);
      }, 100);
    }
  }, [rightLevel, isPlaying, animatedRightLevel]);

  const getSegmentColor = (percentage: number, isActive: boolean, isPeak: boolean) => {
    if (!isPlaying) return '#333333';
    
    if (isPeak) {
      if (percentage < 60) return '#4ade80'; // Green peak
      if (percentage < 80) return '#facc15'; // Yellow peak
      return '#ef4444'; // Red peak
    }
    
    if (isActive) {
      if (percentage < 60) return '#22c55e'; // Green active
      if (percentage < 80) return '#eab308'; // Yellow active
      return '#dc2626'; // Red active
    }
    
    // Inactive segments
    if (percentage < 60) return '#166534'; // Dark green
    if (percentage < 80) return '#854d0e'; // Dark yellow
    return '#7f1d1d'; // Dark red
  };

  const segments = 12;
  const segmentHeight = (height - (segments - 1) * 2) / segments;
  const channelWidth = (width - 4) / 2; // Space for gap between channels

  const renderChannel = (level: number, peak: number, isLeft: boolean) => {
    return (
      <View style={[styles.channel, { width: channelWidth }]}>
        {Array.from({ length: segments }, (_, index) => {
          const segmentIndex = segments - index - 1;
          const segmentThreshold = (segmentIndex / segments) * 100;
          const isActive = level >= segmentThreshold;
          const isPeak = Math.abs(peak - segmentThreshold) < 8;
          const percentage = segmentThreshold;
          
          return (
            <View
              key={index}
              style={[
                styles.segment,
                {
                  height: segmentHeight,
                  backgroundColor: getSegmentColor(percentage, isActive, isPeak),
                  opacity: isActive || isPeak ? 1 : 0.3,
                },
              ]}
            />
          );
        })}
      </View>
    );
  };

  return (
    <View style={[styles.container, { height, width }]}>
      <Animated.View style={styles.channelContainer}>
        {renderChannel(animatedLeftLevel._value, leftPeak.current, true)}
      </Animated.View>
      <View style={styles.gap} />
      <Animated.View style={styles.channelContainer}>
        {renderChannel(animatedRightLevel._value, rightPeak.current, false)}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'stretch',
  },
  channelContainer: {
    flex: 1,
  },
  channel: {
    flexDirection: 'column-reverse',
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    gap: 2,
  },
  gap: {
    width: 4,
  },
  segment: {
    borderRadius: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
});