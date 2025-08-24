import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';

interface VUMeterEnhancedProps {
  level: number; // 0-100
  height?: number;
  width?: number;
  showPeak?: boolean;
  orientation?: 'vertical' | 'horizontal';
  style?: any;
}

export default function VUMeterEnhanced({ 
  level, 
  height = 120, 
  width = 20, 
  showPeak = true,
  orientation = 'vertical',
  style 
}: VUMeterEnhancedProps) {
  const animatedLevel = useRef(new Animated.Value(0)).current;
  const peakLevel = useRef(0);
  const peakHoldTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Animate level changes smoothly
    Animated.timing(animatedLevel, {
      toValue: level,
      duration: 50,
      useNativeDriver: false,
    }).start();

    // Update peak level
    if (level > peakLevel.current) {
      peakLevel.current = level;
      
      // Clear existing timeout
      if (peakHoldTimeout.current) {
        clearTimeout(peakHoldTimeout.current);
      }
      
      // Hold peak for 1 second
      peakHoldTimeout.current = setTimeout(() => {
        peakLevel.current = Math.max(0, peakLevel.current - 5);
      }, 1000);
    }
  }, [level, animatedLevel]);

  const getLevelColor = (levelValue: number) => {
    if (levelValue < 50) return '#4CAF50'; // Green
    if (levelValue < 70) return '#FFC107'; // Yellow
    if (levelValue < 85) return '#FF9800'; // Orange
    return '#F44336'; // Red
  };

  const renderVerticalMeter = () => (
    <View style={[
      styles.verticalContainer, 
      { height, width },
      style
    ]}>
      {/* Background */}
      <View style={[styles.meterBackground, { height, width }]} />
      
      {/* Level segments */}
      {Array.from({ length: 20 }, (_, i) => {
        const segmentLevel = ((19 - i) / 19) * 100;
        const isActive = level >= segmentLevel;
        
        return (
          <View
            key={i}
            style={[
              styles.segment,
              {
                backgroundColor: isActive ? getLevelColor(segmentLevel) : '#333',
                width: width - 4,
                height: Math.floor(height / 20) - 1,
                top: 2 + i * Math.floor(height / 20),
              }
            ]}
          />
        );
      })}
      
      {/* Peak indicator */}
      {showPeak && peakLevel.current > 0 && (
        <View
          style={[
            styles.peakIndicator,
            {
              backgroundColor: getLevelColor(peakLevel.current),
              width: width - 4,
              height: 2,
              top: 2 + (19 - Math.floor((peakLevel.current / 100) * 19)) * Math.floor(height / 20),
            }
          ]}
        />
      )}
    </View>
  );

  const renderHorizontalMeter = () => (
    <View style={[
      styles.horizontalContainer, 
      { width: height, height: width },
      style
    ]}>
      {/* Background */}
      <View style={[styles.meterBackground, { width: height, height: width }]} />
      
      {/* Level segments */}
      {Array.from({ length: 20 }, (_, i) => {
        const segmentLevel = (i / 19) * 100;
        const isActive = level >= segmentLevel;
        
        return (
          <View
            key={i}
            style={[
              styles.segment,
              {
                backgroundColor: isActive ? getLevelColor(segmentLevel) : '#333',
                height: width - 4,
                width: Math.floor(height / 20) - 1,
                left: 2 + i * Math.floor(height / 20),
              }
            ]}
          />
        );
      })}
      
      {/* Peak indicator */}
      {showPeak && peakLevel.current > 0 && (
        <View
          style={[
            styles.peakIndicator,
            {
              backgroundColor: getLevelColor(peakLevel.current),
              height: width - 4,
              width: 2,
              left: 2 + Math.floor((peakLevel.current / 100) * 19) * Math.floor(height / 20),
            }
          ]}
        />
      )}
    </View>
  );

  return orientation === 'vertical' ? renderVerticalMeter() : renderHorizontalMeter();
}

const styles = StyleSheet.create({
  verticalContainer: {
    position: 'relative',
    backgroundColor: '#1a1a1a',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#444',
  },
  horizontalContainer: {
    position: 'relative',
    backgroundColor: '#1a1a1a',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#444',
  },
  meterBackground: {
    backgroundColor: '#0a0a0a',
    borderRadius: 3,
  },
  segment: {
    position: 'absolute',
    borderRadius: 1,
  },
  peakIndicator: {
    position: 'absolute',
    borderRadius: 1,
  },
});