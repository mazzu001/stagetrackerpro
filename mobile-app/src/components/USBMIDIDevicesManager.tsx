import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Modal,
} from 'react-native';
import { useLocalAuth } from '../hooks/useLocalAuth';

interface USBMIDIDevice {
  id: string;
  name: string;
  manufacturer?: string;
  type: 'input' | 'output';
  state: 'connected' | 'disconnected' | 'error';
  portIndex?: number;
  version?: string;
}

interface USBMIDIMessage {
  timestamp: number;
  deviceId: string;
  deviceName: string;
  data: Uint8Array;
  type: string;
}

interface USBMIDIDevicesManagerProps {
  isVisible: boolean;
  onClose: () => void;
  onConnectedDevicesChange?: (devices: USBMIDIDevice[]) => void;
}

export function USBMIDIDevicesManager({ 
  isVisible, 
  onClose, 
  onConnectedDevicesChange 
}: USBMIDIDevicesManagerProps) {
  const { user } = useLocalAuth();
  const isProfessional = user?.userType === 'professional';
  
  const [devices, setDevices] = useState<USBMIDIDevice[]>([]);
  const [connectedDevices, setConnectedDevices] = useState<USBMIDIDevice[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [messages, setMessages] = useState<USBMIDIMessage[]>([]);
  const [selectedOutputDevice, setSelectedOutputDevice] = useState<string>('');
  const [midiCommand, setMidiCommand] = useState('[[PC:12:1]]');
  const [searchTerm, setSearchTerm] = useState('');


  useEffect(() => {
    if (isVisible && isProfessional) {
      scanForDevices();
    } else if (isVisible && !isProfessional) {
      Alert.alert(
        'Professional Subscription Required',
        'USB MIDI features are only available for Professional subscribers',
        [{ text: 'OK', onPress: onClose }]
      );
    }
  }, [isVisible, isProfessional]);

  const scanForDevices = async () => {
    setIsScanning(true);
    console.log('🔍 Scanning for USB MIDI devices...');
    
    try {
      // Simulate scanning delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // In a real implementation, this would use React Native MIDI libraries
      // For now, no devices will be found on mobile until real MIDI library is integrated
      const foundDevices: USBMIDIDevice[] = [];
      setDevices(foundDevices);
      
      const connected = foundDevices.filter(device => device.state === 'connected');
      setConnectedDevices(connected);
      onConnectedDevicesChange?.(connected);
      
      console.log(`🔍 USB MIDI scan completed: ${foundDevices.length} devices found`);
    } catch (error) {
      console.error('❌ Failed to scan for USB MIDI devices:', error);
      Alert.alert('Error', 'Failed to scan for MIDI devices');
    } finally {
      setIsScanning(false);
    }
  };

  const connectDevice = async (deviceId: string) => {
    const device = devices.find(d => d.id === deviceId);
    if (!device) return;

    try {
      console.log(`🔌 Connecting to USB MIDI device: ${device.name}`);
      
      // Simulate connection
      const updatedDevices = devices.map(d => 
        d.id === deviceId ? { ...d, state: 'connected' as const } : d
      );
      setDevices(updatedDevices);
      
      const connected = updatedDevices.filter(d => d.state === 'connected');
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
      console.log(`🔌 Disconnecting from USB MIDI device: ${device.name}`);
      
      const updatedDevices = devices.map(d => 
        d.id === deviceId ? { ...d, state: 'disconnected' as const } : d
      );
      setDevices(updatedDevices);
      
      const connected = updatedDevices.filter(d => d.state === 'connected');
      setConnectedDevices(connected);
      onConnectedDevicesChange?.(connected);
      
      Alert.alert('Success', `Disconnected from ${device.name}`);
    } catch (error) {
      console.error('❌ Failed to disconnect from device:', error);
      Alert.alert('Error', 'Failed to disconnect from device');
    }
  };

  const sendMIDICommand = async () => {
    if (!selectedOutputDevice) {
      Alert.alert('Error', 'Please select an output device first');
      return;
    }

    if (!midiCommand.trim()) {
      Alert.alert('Error', 'Please enter a MIDI command');
      return;
    }

    try {
      console.log(`📤 USB MIDI Sending: ${midiCommand}`);
      
      // Simulate sending MIDI command
      const device = devices.find(d => d.id === selectedOutputDevice);
      if (device) {
        const message: USBMIDIMessage = {
          timestamp: Date.now(),
          deviceId: device.id,
          deviceName: device.name,
          data: new Uint8Array([0xc0, 0x0c]), // Mock MIDI data
          type: 'sent'
        };
        
        setMessages(prev => [message, ...prev.slice(0, 9)]);
        Alert.alert('Success', `MIDI command sent to ${device.name}`);
      }
    } catch (error) {
      console.error('❌ Failed to send MIDI command:', error);
      Alert.alert('Error', 'Failed to send MIDI command');
    }
  };

  const filteredDevices = devices.filter(device =>
    device.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    device.manufacturer?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const outputDevices = connectedDevices.filter(device => device.type === 'output');

  return (
    <Modal visible={isVisible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>USB MIDI Devices</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {/* Scan Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Device Scanning</Text>
              <TouchableOpacity 
                style={[styles.scanButton, isScanning && styles.scanButtonDisabled]}
                onPress={scanForDevices}
                disabled={isScanning}
              >
                <Text style={styles.scanButtonText}>
                  {isScanning ? 'Scanning...' : 'Scan Devices'}
                </Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.searchInput}
              placeholder="Search devices..."
              placeholderTextColor="#666"
              value={searchTerm}
              onChangeText={setSearchTerm}
            />
          </View>

          {/* Device List */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Available Devices ({filteredDevices.length})
            </Text>
            
            {filteredDevices.map((device) => (
              <View key={device.id} style={styles.deviceCard}>
                <View style={styles.deviceInfo}>
                  <Text style={styles.deviceName}>{device.name}</Text>
                  <Text style={styles.deviceDetails}>
                    {device.manufacturer} • {device.type} • {device.state}
                  </Text>
                </View>
                
                <TouchableOpacity
                  style={[
                    styles.deviceButton,
                    device.state === 'connected' ? styles.disconnectButton : styles.connectButton
                  ]}
                  onPress={() => device.state === 'connected' 
                    ? disconnectDevice(device.id)
                    : connectDevice(device.id)
                  }
                >
                  <Text style={styles.deviceButtonText}>
                    {device.state === 'connected' ? 'Disconnect' : 'Connect'}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}

            {filteredDevices.length === 0 && !isScanning && (
              <Text style={styles.noDevicesText}>
                No USB MIDI devices found. Connect a USB MIDI device and scan again.
              </Text>
            )}
            
            {isScanning && (
              <Text style={styles.scanningText}>
                Scanning for USB MIDI devices...
              </Text>
            )}
          </View>

          {/* Send MIDI Commands */}
          {outputDevices.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Send MIDI Commands</Text>
              
              <Text style={styles.label}>Output Device:</Text>
              <View style={styles.pickerContainer}>
                {outputDevices.map((device) => (
                  <TouchableOpacity
                    key={device.id}
                    style={[
                      styles.deviceOption,
                      selectedOutputDevice === device.id && styles.deviceOptionSelected
                    ]}
                    onPress={() => setSelectedOutputDevice(device.id)}
                  >
                    <Text style={[
                      styles.deviceOptionText,
                      selectedOutputDevice === device.id && styles.deviceOptionTextSelected
                    ]}>
                      {device.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              
              <Text style={styles.label}>MIDI Command:</Text>
              <TextInput
                style={styles.commandInput}
                placeholder="Enter MIDI command (e.g., [[PC:12:1]])"
                placeholderTextColor="#666"
                value={midiCommand}
                onChangeText={setMidiCommand}
              />
              
              <TouchableOpacity style={styles.sendButton} onPress={sendMIDICommand}>
                <Text style={styles.sendButtonText}>Send Command</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Message Log */}
          {messages.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Message Log</Text>
              {messages.map((message, index) => (
                <View key={index} style={styles.messageCard}>
                  <Text style={styles.messageDevice}>{message.deviceName}</Text>
                  <Text style={styles.messageData}>
                    {Array.from(message.data).map(byte => 
                      byte.toString(16).padStart(2, '0')
                    ).join(' ')}
                  </Text>
                  <Text style={styles.messageTime}>
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </Text>
                </View>
              ))}
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
  scanButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  scanButtonDisabled: {
    backgroundColor: '#555',
  },
  scanButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  searchInput: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    color: '#ffffff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#444',
  },
  deviceCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  deviceDetails: {
    fontSize: 14,
    color: '#aaa',
  },
  deviceButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
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
  noDevicesText: {
    textAlign: 'center',
    color: '#666',
    fontStyle: 'italic',
    padding: 20,
  },
  scanningText: {
    textAlign: 'center',
    color: '#007AFF',
    fontStyle: 'italic',
    padding: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
  },
  pickerContainer: {
    marginBottom: 16,
  },
  deviceOption: {
    backgroundColor: '#2a2a2a',
    padding: 12,
    borderRadius: 8,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#444',
  },
  deviceOptionSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#1a3d5c',
  },
  deviceOptionText: {
    color: '#ffffff',
    fontSize: 16,
  },
  deviceOptionTextSelected: {
    color: '#007AFF',
    fontWeight: '600',
  },
  commandInput: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    color: '#ffffff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#444',
    marginBottom: 16,
  },
  sendButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  sendButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  messageCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  messageDevice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  messageData: {
    fontSize: 14,
    color: '#4CAF50',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  messageTime: {
    fontSize: 12,
    color: '#aaa',
  },
});