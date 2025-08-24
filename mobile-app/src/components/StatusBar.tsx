import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { useLocalAuth } from '../hooks/useLocalAuth';

interface SystemStatus {
  audioEngine: 'connected' | 'disconnected' | 'error';
  midiConnection: 'connected' | 'disconnected' | 'searching';
  latency: number; // in milliseconds
  cpuUsage: number; // percentage
  memoryUsage: number; // percentage
  activeDevices: number;
  lastUpdate: number;
}

interface StatusBarProps {
  audioEngine?: 'connected' | 'disconnected' | 'error';
  midiDevices?: number;
  onStatusPress?: () => void;
  compact?: boolean;
}

export default function StatusBar({ 
  audioEngine = 'connected',
  midiDevices = 0,
  onStatusPress,
  compact = false
}: StatusBarProps) {
  const { user } = useLocalAuth();
  const [status, setStatus] = useState<SystemStatus>({
    audioEngine,
    midiConnection: midiDevices > 0 ? 'connected' : 'disconnected',
    latency: Math.floor(Math.random() * 20) + 5, // Mock latency 5-25ms
    cpuUsage: Math.floor(Math.random() * 30) + 10, // Mock CPU 10-40%
    memoryUsage: Math.floor(Math.random() * 40) + 20, // Mock memory 20-60%
    activeDevices: midiDevices,
    lastUpdate: Date.now()
  });

  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Update status periodically
    const interval = setInterval(() => {
      setStatus(prev => ({
        ...prev,
        latency: Math.floor(Math.random() * 20) + 5,
        cpuUsage: Math.floor(Math.random() * 30) + 10,
        memoryUsage: Math.floor(Math.random() * 40) + 20,
        audioEngine,
        midiConnection: midiDevices > 0 ? 'connected' : 'disconnected',
        activeDevices: midiDevices,
        lastUpdate: Date.now()
      }));
    }, 2000);

    return () => clearInterval(interval);
  }, [audioEngine, midiDevices]);

  useEffect(() => {
    // Pulse animation for active connections
    if (status.audioEngine === 'connected' || status.midiConnection === 'connected') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.7,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [status.audioEngine, status.midiConnection, pulseAnim]);

  const getStatusColor = (statusType: string) => {
    switch (statusType) {
      case 'connected':
        return '#4CAF50';
      case 'disconnected':
        return '#666';
      case 'searching':
        return '#FFC107';
      case 'error':
        return '#F44336';
      default:
        return '#666';
    }
  };

  const getLatencyColor = (latency: number) => {
    if (latency < 10) return '#4CAF50'; // Green - Excellent
    if (latency < 20) return '#FFC107'; // Yellow - Good
    if (latency < 30) return '#FF9800'; // Orange - Fair
    return '#F44336'; // Red - Poor
  };

  const getUsageColor = (usage: number) => {
    if (usage < 50) return '#4CAF50'; // Green - Low
    if (usage < 75) return '#FFC107'; // Yellow - Medium
    if (usage < 90) return '#FF9800'; // Orange - High
    return '#F44336'; // Red - Critical
  };

  const formatLatency = (latency: number) => {
    return `${latency}ms`;
  };

  const formatUsage = (usage: number) => {
    return `${usage}%`;
  };

  const getSubscriptionIcon = () => {
    switch (user?.userType) {
      case 'professional':
        return '👑';
      case 'paid':
      case 'premium':
        return '⭐';
      default:
        return '👤';
    }
  };

  if (compact) {
    return (
      <TouchableOpacity style={styles.compactContainer} onPress={onStatusPress}>
        <View style={styles.compactContent}>
          {/* Audio Engine Status */}
          <Animated.View style={[
            styles.statusDot,
            { backgroundColor: getStatusColor(status.audioEngine) },
            { opacity: pulseAnim }
          ]} />
          
          {/* MIDI Status */}
          <Text style={styles.compactText}>
            🎹 {status.activeDevices}
          </Text>
          
          {/* Latency */}
          <Text style={[
            styles.compactText,
            { color: getLatencyColor(status.latency) }
          ]}>
            {formatLatency(status.latency)}
          </Text>
          
          {/* User Type */}
          <Text style={styles.compactText}>
            {getSubscriptionIcon()}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity style={styles.container} onPress={onStatusPress}>
      <View style={styles.content}>
        {/* Left Section - System Status */}
        <View style={styles.section}>
          <View style={styles.statusItem}>
            <Animated.View style={[
              styles.statusIndicator,
              { backgroundColor: getStatusColor(status.audioEngine) },
              { opacity: pulseAnim }
            ]} />
            <Text style={styles.statusLabel}>Audio</Text>
          </View>
          
          <View style={styles.statusItem}>
            <View style={[
              styles.statusIndicator,
              { backgroundColor: getStatusColor(status.midiConnection) }
            ]} />
            <Text style={styles.statusLabel}>MIDI ({status.activeDevices})</Text>
          </View>
        </View>

        {/* Center Section - Performance Metrics */}
        <View style={styles.section}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Latency</Text>
            <Text style={[
              styles.metricValue,
              { color: getLatencyColor(status.latency) }
            ]}>
              {formatLatency(status.latency)}
            </Text>
          </View>
          
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>CPU</Text>
            <Text style={[
              styles.metricValue,
              { color: getUsageColor(status.cpuUsage) }
            ]}>
              {formatUsage(status.cpuUsage)}
            </Text>
          </View>
          
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Memory</Text>
            <Text style={[
              styles.metricValue,
              { color: getUsageColor(status.memoryUsage) }
            ]}>
              {formatUsage(status.memoryUsage)}
            </Text>
          </View>
        </View>

        {/* Right Section - User Info */}
        <View style={styles.section}>
          <View style={styles.userInfo}>
            <Text style={styles.userIcon}>{getSubscriptionIcon()}</Text>
            <Text style={styles.userType}>
              {user?.userType?.charAt(0).toUpperCase() + (user?.userType?.slice(1) || '')}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  content: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  compactContainer: {
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  compactContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  section: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusLabel: {
    fontSize: 11,
    color: '#aaa',
    fontWeight: '500',
  },
  metricItem: {
    alignItems: 'center',
    gap: 2,
  },
  metricLabel: {
    fontSize: 9,
    color: '#666',
    fontWeight: '500',
  },
  metricValue: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  userIcon: {
    fontSize: 12,
  },
  userType: {
    fontSize: 10,
    color: '#aaa',
    fontWeight: '600',
  },
  compactText: {
    fontSize: 10,
    color: '#aaa',
    fontFamily: 'monospace',
  },
});