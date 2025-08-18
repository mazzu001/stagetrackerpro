import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';

interface VUMeterProps {
  level: number; // 0.0 to 1.0
  height?: number;
  width?: number;
  showPeak?: boolean;
}

export default function VUMeter({
  level,
  height = 80,
  width = 12,
  showPeak = false,
}: VUMeterProps) {
  const animatedLevel = useRef(new Animated.Value(level)).current;
  const peakValue = useRef(0);
  const peakDecayRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    // Animate level change
    Animated.timing(animatedLevel, {
      toValue: level,
      duration: 50,
      useNativeDriver: false,
    }).start();

    // Peak detection
    if (level > peakValue.current) {
      peakValue.current = level;
      
      // Reset peak decay timer
      if (peakDecayRef.current) {
        clearTimeout(peakDecayRef.current);
      }
      
      // Decay peak after 1 second
      peakDecayRef.current = setTimeout(() => {
        peakValue.current = level;
      }, 1000);
    }
  }, [level, animatedLevel]);

  const getLevelColor = (normalizedLevel: number) => {
    if (normalizedLevel > 0.9) return '#FF0000'; // Red - clipping
    if (normalizedLevel > 0.8) return '#FF8000'; // Orange - hot
    if (normalizedLevel > 0.6) return '#FFFF00'; // Yellow - warm
    return '#00FF00'; // Green - normal
  };

  const segments = 20;
  const segmentHeight = (height - (segments - 1) * 2) / segments;

  return (
    <View style={[styles.container, { height, width }]}>
      {Array.from({ length: segments }, (_, index) => {
        const segmentLevel = (segments - index) / segments;
        const isActive = level >= segmentLevel;
        const isPeak = showPeak && Math.abs(peakValue.current - segmentLevel) < 0.05;
        
        return (
          <Animated.View
            key={index}
            style={[
              styles.segment,
              {
                height: segmentHeight,
                backgroundColor: isActive || isPeak
                  ? getLevelColor(segmentLevel)
                  : '#333',
                opacity: isActive ? 1 : (isPeak ? 0.8 : 0.3),
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column-reverse',
    justifyContent: 'flex-start',
    alignItems: 'center',
    gap: 2,
  },
  segment: {
    width: '100%',
    borderRadius: 1,
  },
});