import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Modal,
} from 'react-native';
import { useLocalAuth } from '../hooks/useLocalAuth';

interface BluetoothDevice {
  id: string;
  name: string;
  manufacturer?: string;
  isMIDIDevice: boolean;
  isConnected: boolean;
  signalStrength?: number;
  deviceType: string;
  lastSeen?: number;
}

interface BluetoothDevicesManagerProps {
  isVisible: boolean;
  onClose: () => void;
  onConnectedDevicesChange?: (devices: BluetoothDevice[]) => void;
}

export function BluetoothDevicesManager({ 
  isVisible, 
  onClose, 
  onConnectedDevicesChange 
}: BluetoothDevicesManagerProps) {
  const { user } = useLocalAuth();
  const isProfessional = user?.userType === 'professional';
  
  const [devices, setDevices] = useState<BluetoothDevice[]>([]);
  const [connectedDevices, setConnectedDevices] = useState<BluetoothDevice[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanType, setScanType] = useState<'quick' | 'deep'>('quick');

  // Mock Bluetooth devices for development/demo
  const mockDevices: BluetoothDevice[] = [
    {
      id: 'bt-1',
      name: 'WIDI Jack',
      manufacturer: 'CME',
      isMIDIDevice: true,
      isConnected: false,
      signalStrength: -45,
      deviceType: 'MIDI Adapter',
      lastSeen: Date.now() - 5000
    },
    {
      id: 'bt-2',
      name: 'TC-Helicon VoiceLive',
      manufacturer: 'TC-Helicon',
      isMIDIDevice: true,
      isConnected: false,
      signalStrength: -60,
      deviceType: 'Audio Processor',
      lastSeen: Date.now() - 30000
    },
    {
      id: 'bt-3',
      name: 'BLE MIDI Controller',
      manufacturer: 'Korg',
      isMIDIDevice: true,
      isConnected: true,
      signalStrength: -35,
      deviceType: 'MIDI Controller',
      lastSeen: Date.now() - 1000
    },
    {
      id: 'bt-4',
      name: 'iPhone 14',
      manufacturer: 'Apple',
      isMIDIDevice: false,
      isConnected: false,
      signalStrength: -50,
      deviceType: 'Smartphone',
      lastSeen: Date.now() - 15000
    },
    {
      id: 'bt-5',
      name: 'AirPods Pro',
      manufacturer: 'Apple',
      isMIDIDevice: false,
      isConnected: false,
      signalStrength: -40,
      deviceType: 'Headphones',
      lastSeen: Date.now() - 8000
    }
  ];

  useEffect(() => {
    if (isVisible && isProfessional) {
      scanForDevices();
    } else if (isVisible && !isProfessional) {
      Alert.alert(
        'Professional Subscription Required',
        'Bluetooth MIDI features are only available for Professional subscribers',
        [{ text: 'OK', onPress: onClose }]
      );
    }
  }, [isVisible, isProfessional]);

  const scanForDevices = async () => {
    setIsScanning(true);
    console.log(`🔍 Starting ${scanType} Bluetooth scan...`);
    
    try {
      // Simulate scanning delay
      const scanDuration = scanType === 'deep' ? 3000 : 1500;
      await new Promise(resolve => setTimeout(resolve, scanDuration));
      
      // In a real implementation, this would use React Native Bluetooth libraries
      // For now, we'll use mock devices
      let foundDevices = [...mockDevices];
      
      if (scanType === 'quick') {
        // Quick scan finds fewer devices
        foundDevices = foundDevices.filter(device => 
          device.signalStrength! > -55 || device.isMIDIDevice
        );
      }
      
      // Sort MIDI devices first, then by signal strength
      foundDevices.sort((a, b) => {
        if (a.isMIDIDevice && !b.isMIDIDevice) return -1;
        if (!a.isMIDIDevice && b.isMIDIDevice) return 1;
        return (b.signalStrength || -100) - (a.signalStrength || -100);
      });
      
      setDevices(foundDevices);
      
      const connected = foundDevices.filter(device => device.isConnected);
      setConnectedDevices(connected);
      onConnectedDevicesChange?.(connected);
      
      console.log(`✅ Found ${foundDevices.length} Bluetooth devices (${connected.length} connected)`);
    } catch (error) {
      console.error('❌ Failed to scan for Bluetooth devices:', error);
      Alert.alert('Error', 'Failed to scan for Bluetooth devices');
    } finally {
      setIsScanning(false);
    }
  };

  const connectDevice = async (deviceId: string) => {
    const device = devices.find(d => d.id === deviceId);
    if (!device) return;

    try {
      console.log(`🔌 Connecting to Bluetooth device: ${device.name}`);
      
      // Simulate connection
      const updatedDevices = devices.map(d => 
        d.id === deviceId ? { ...d, isConnected: true } : d
      );
      setDevices(updatedDevices);
      
      const connected = updatedDevices.filter(d => d.isConnected);
      setConnectedDevices(connected);
      onConnectedDevicesChange?.(connected);
      
      Alert.alert('Success', `Connected to ${device.name}`);
    } catch (error) {
      console.error('❌ Failed to connect to device:', error);
      Alert.alert('Error', 'Failed to connect to device');
    }
  };

  const disconnectDevice = async (deviceId: string) => {
    const device = devices.find(d => d.id === deviceId);
    if (!device) return;

    try {
      console.log(`🔌 Disconnecting from Bluetooth device: ${device.name}`);
      
      const updatedDevices = devices.map(d => 
        d.id === deviceId ? { ...d, isConnected: false } : d
      );
      setDevices(updatedDevices);
      
      const connected = updatedDevices.filter(d => d.isConnected);
      setConnectedDevices(connected);
      onConnectedDevicesChange?.(connected);
      
      Alert.alert('Success', `Disconnected from ${device.name}`);
    } catch (error) {
      console.error('❌ Failed to disconnect from device:', error);
      Alert.alert('Error', 'Failed to disconnect from device');
    }
  };

  const removeDevice = async (deviceId: string) => {
    const device = devices.find(d => d.id === deviceId);
    if (!device) return;

    Alert.alert(
      'Remove Device',
      `Are you sure you want to remove ${device.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            const updatedDevices = devices.filter(d => d.id !== deviceId);
            setDevices(updatedDevices);
            
            const connected = updatedDevices.filter(d => d.isConnected);
            setConnectedDevices(connected);
            onConnectedDevicesChange?.(connected);
          }
        }
      ]
    );
  };

  const getSignalIcon = (strength?: number) => {
    if (!strength) return '📶';
    if (strength > -40) return '📶';
    if (strength > -60) return '📶';
    if (strength > -80) return '📶';
    return '📶';
  };

  const getDeviceIcon = (device: BluetoothDevice) => {
    if (device.isMIDIDevice) return '🎹';
    
    switch (device.deviceType.toLowerCase()) {
      case 'smartphone':
        return '📱';
      case 'headphones':
        return '🎧';
      case 'speaker':
        return '🔊';
      default:
        return '📟';
    }
  };

  const midiDevices = devices.filter(device => device.isMIDIDevice);
  const otherDevices = devices.filter(device => !device.isMIDIDevice);

  return (
    <Modal visible={isVisible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Bluetooth Devices</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {/* Scan Controls */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Device Scanning</Text>
            
            <View style={styles.scanTypeContainer}>
              <TouchableOpacity
                style={[
                  styles.scanTypeButton,
                  scanType === 'quick' && styles.scanTypeButtonActive
                ]}
                onPress={() => setScanType('quick')}
              >
                <Text style={[
                  styles.scanTypeText,
                  scanType === 'quick' && styles.scanTypeTextActive
                ]}>
                  Quick Scan
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.scanTypeButton,
                  scanType === 'deep' && styles.scanTypeButtonActive
                ]}
                onPress={() => setScanType('deep')}
              >
                <Text style={[
                  styles.scanTypeText,
                  scanType === 'deep' && styles.scanTypeTextActive
                ]}>
                  Deep Scan
                </Text>
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity 
              style={[styles.scanButton, isScanning && styles.scanButtonDisabled]}
              onPress={scanForDevices}
              disabled={isScanning}
            >
              <Text style={styles.scanButtonText}>
                {isScanning ? `${scanType === 'deep' ? 'Deep ' : ''}Scanning...` : 'Start Scan'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* MIDI Devices */}
          {midiDevices.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                🎹 MIDI Devices ({midiDevices.length})
              </Text>
              
              {midiDevices.map((device) => (
                <View key={device.id} style={styles.deviceCard}>
                  <View style={styles.deviceHeader}>
                    <Text style={styles.deviceIcon}>{getDeviceIcon(device)}</Text>
                    <View style={styles.deviceInfo}>
                      <Text style={styles.deviceName}>{device.name}</Text>
                      <Text style={styles.deviceDetails}>
                        {device.manufacturer} • {device.deviceType}
                      </Text>
                    </View>
                    <Text style={styles.signalIcon}>{getSignalIcon(device.signalStrength)}</Text>
                  </View>
                  
                  <View style={styles.deviceActions}>
                    <TouchableOpacity
                      style={[
                        styles.deviceButton,
                        device.isConnected ? styles.disconnectButton : styles.connectButton
                      ]}
                      onPress={() => device.isConnected 
                        ? disconnectDevice(device.id)
                        : connectDevice(device.id)
                      }
                    >
                      <Text style={styles.deviceButtonText}>
                        {device.isConnected ? 'Disconnect' : 'Connect'}
                      </Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => removeDevice(device.id)}
                    >
                      <Text style={styles.removeButtonText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Other Devices */}
          {otherDevices.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                📟 Other Devices ({otherDevices.length})
              </Text>
              
              {otherDevices.map((device) => (
                <View key={device.id} style={styles.deviceCard}>
                  <View style={styles.deviceHeader}>
                    <Text style={styles.deviceIcon}>{getDeviceIcon(device)}</Text>
                    <View style={styles.deviceInfo}>
                      <Text style={styles.deviceName}>{device.name}</Text>
                      <Text style={styles.deviceDetails}>
                        {device.manufacturer} • {device.deviceType}
                      </Text>
                    </View>
                    <Text style={styles.signalIcon}>{getSignalIcon(device.signalStrength)}</Text>
                  </View>
                  
                  <View style={styles.deviceActions}>
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => removeDevice(device.id)}
                    >
                      <Text style={styles.removeButtonText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          {devices.length === 0 && !isScanning && (
            <View style={styles.noDevicesContainer}>
              <Text style={styles.noDevicesText}>
                No devices found. Try scanning for devices.
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
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
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
  scanTypeContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 8,
  },
  scanTypeButton: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    padding: 8,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#444',
  },
  scanTypeButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  scanTypeText: {
    color: '#aaa',
    fontSize: 14,
    fontWeight: '600',
  },
  scanTypeTextActive: {
    color: '#ffffff',
  },
  scanButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  scanButtonDisabled: {
    backgroundColor: '#555',
  },
  scanButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  deviceCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  deviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  deviceIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 2,
  },
  deviceDetails: {
    fontSize: 14,
    color: '#aaa',
  },
  signalIcon: {
    fontSize: 16,
  },
  deviceActions: {
    flexDirection: 'row',
    gap: 8,
  },
  deviceButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  connectButton: {
    backgroundColor: '#4CAF50',
  },
  disconnectButton: {
    backgroundColor: '#F44336',
  },
  deviceButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  removeButton: {
    backgroundColor: '#666',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  removeButtonText: {
    color: '#ffffff',
    fontSize: 14,
  },
  noDevicesContainer: {
    alignItems: 'center',
    padding: 40,
  },
  noDevicesText: {
    textAlign: 'center',
    color: '#666',
    fontStyle: 'italic',
  },
});