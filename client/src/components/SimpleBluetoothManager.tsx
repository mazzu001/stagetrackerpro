import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useLocalAuth } from '@/hooks/useLocalAuth';
import { 
  Bluetooth, 
  Search, 
  Wifi, 
  WifiOff, 
  Send, 
  Activity,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

interface BluetoothDevice {
  id: string;
  name: string;
  connected: boolean;
  paired?: boolean;
  lastSeen?: string;
  deviceType?: 'midi' | 'audio' | 'other';
  batteryLevel?: number;
  signalStrength?: number;
}

interface SimpleBluetoothManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SimpleBluetoothManager({ isOpen, onClose }: SimpleBluetoothManagerProps) {
  const { user } = useLocalAuth();
  const isProfessional = user?.userType === 'professional';
  const { toast } = useToast();

  // All state hooks  
  const [devices, setDevices] = useState<BluetoothDevice[]>([]);
  const [offlineDevices, setOfflineDevices] = useState<BluetoothDevice[]>([]);
  const [availableDevices, setAvailableDevices] = useState<BluetoothDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<BluetoothDevice | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [hasBluetoothSupport, setHasBluetoothSupport] = useState(false);
  const [testMessage, setTestMessage] = useState('[[PC:1:1]]');
  const [lastSentMessage, setLastSentMessage] = useState<string>('');
  const [lastReceivedMessage, setLastReceivedMessage] = useState<string>('');
  const [bluetoothDevice, setBluetoothDevice] = useState<any>(null);
  const [midiMessages, setMidiMessages] = useState<Array<{timestamp: string, message: string}>>([]);
  const [midiCharacteristic, setMidiCharacteristic] = useState<any>(null);

  // Check for professional subscription
  useEffect(() => {
    if (isOpen && !isProfessional) {
      toast({
        title: "Professional Subscription Required",
        description: "Bluetooth features are only available for Professional subscribers",
        variant: "destructive",
      });
      onClose();
    }
  }, [isOpen, isProfessional, onClose, toast]);

  // Listen for external MIDI commands from performance interface
  useEffect(() => {
    const handleExternalMidi = async (event: any) => {
      const { command } = event.detail;
      console.log('🎼 🔥 RECEIVED EXTERNAL MIDI COMMAND:', command);
      console.log('🔍 Connection state check:');
      console.log('  - bluetoothDevice:', !!bluetoothDevice);
      console.log('  - gatt connected:', bluetoothDevice?.gatt?.connected);
      console.log('  - midiCharacteristic:', !!midiCharacteristic);

      if (!bluetoothDevice) {
        console.log('❌ No Bluetooth device available');
        addMidiMessage(`Send failed: No device - ${command}`);
        return;
      }

      if (!bluetoothDevice.gatt?.connected) {
        console.log('❌ Bluetooth device not connected');
        addMidiMessage(`Send failed: Not connected - ${command}`);
        return;
      }

      if (!midiCharacteristic) {
        console.log('❌ No MIDI characteristic available');
        addMidiMessage(`Send failed: No MIDI - ${command}`);
        return;
      }

      try {
        console.log('🔧 Parsing MIDI command:', command);
        const midiBytes = parseMidiCommand(command);
        if (!midiBytes) {
          console.log('❌ Invalid MIDI command format:', command);
          addMidiMessage(`Send failed: Invalid format - ${command}`);
          return;
        }

        console.log('📡 Sending MIDI bytes:', Array.from(midiBytes).map(b => b.toString(16).padStart(2, '0')).join(' '));
        await sendMidiCommand(midiBytes);
        
        const hexString = Array.from(midiBytes).map(b => b.toString(16).padStart(2, '0')).join(' ');
        setLastSentMessage(`${command} → [${hexString}]`);
        addMidiMessage(`✅ Sent: ${command}`);
        
        console.log('✅ 🔥 EXTERNAL MIDI COMMAND SENT SUCCESSFULLY');
      } catch (error) {
        console.error('❌ 🔥 FAILED TO SEND EXTERNAL MIDI COMMAND:', error);
        addMidiMessage(`❌ Send failed: ${command} - ${error}`);
      }
    };

    console.log('🎧 🔥 SETTING UP EXTERNAL MIDI EVENT LISTENER');
    window.addEventListener('sendBluetoothMIDI', handleExternalMidi);
    
    return () => {
      console.log('🎧 🔥 REMOVING EXTERNAL MIDI EVENT LISTENER');
      window.removeEventListener('sendBluetoothMIDI', handleExternalMidi);
    };
  }, [bluetoothDevice, midiCharacteristic]);

  // Check Bluetooth support and load stored devices
  useEffect(() => {
    const checkBluetoothSupport = async () => {
      if ('bluetooth' in navigator) {
        setHasBluetoothSupport(true);
        
        // Load previously paired devices
        loadStoredDevices();
        
        // Try to restore previously connected device
        const savedDeviceId = localStorage.getItem('bluetooth_device_id');
        const savedDeviceName = localStorage.getItem('bluetooth_device_name');
        if (savedDeviceId && savedDeviceName) {
          setSelectedDevice({ id: savedDeviceId, name: savedDeviceName, connected: false });
          // Attempt auto-reconnect
          await attemptReconnect(savedDeviceId, savedDeviceName);
        }
      } else {
        setHasBluetoothSupport(false);
      }
    };

    if (isOpen && isProfessional) {
      checkBluetoothSupport();
    }
  }, [isOpen, isProfessional]);

  // Scan for Bluetooth devices  
  const scanForDevices = async () => {
    if (!hasBluetoothSupport) {
      toast({
        title: "Bluetooth Not Supported",
        description: "This browser doesn't support Bluetooth",
        variant: "destructive",
      });
      return;
    }

    setIsScanning(true);
    try {
      console.log('🔍 Scanning for Bluetooth devices...');
      
      const device = await (navigator as any).bluetooth.requestDevice({
        filters: [
          { services: ['03b80e5a-ede8-4b33-a751-6ce34ec4c700'] },
          { namePrefix: 'WIDI' },
          { namePrefix: 'BLE-MIDI' },
          { namePrefix: 'MIDI' },
          { namePrefix: 'Matt' },
          { namePrefix: 'CME' }
        ],
        optionalServices: ['03b80e5a-ede8-4b33-a751-6ce34ec4c700']
      });

      console.log('📱 Found device:', device.name || 'Unknown Device');
      
      const deviceType = determineDeviceType(device.name || 'Unknown Device');
      const newDevice: BluetoothDevice = {
        id: device.id,
        name: device.name || 'Unknown Device',
        connected: false,
        paired: false,
        deviceType: deviceType,
        lastSeen: new Date().toISOString()
      };
      
      // Save device to storage
      saveDeviceToStorage(newDevice);

      setDevices(prev => {
        const exists = prev.find(d => d.id === device.id);
        if (exists) return prev;
        return [...prev, newDevice];
      });

      toast({
        title: "Device Found",
        description: `Found: ${newDevice.name}`,
      });

    } catch (error) {
      console.error('❌ Bluetooth scan failed:', error);
      toast({
        title: "Scan Failed",
        description: "Failed to scan for Bluetooth devices",
        variant: "destructive",
      });
    } finally {
      setIsScanning(false);
    }
  };

  // Connect to a device
  const connectToDevice = async (device: BluetoothDevice) => {
    setIsConnecting(true);
    setConnectionStatus('connecting');
    
    try {
      console.log(`🔗 Connecting to ${device.name}...`);
      
      // For reconnection, try to get the stored device first
      let bluetoothDevice;
      try {
        // First try to reconnect to existing device
        if (device.id === localStorage.getItem('bluetooth_device_id')) {
          console.log('🔄 Attempting to reconnect to existing device...');
          bluetoothDevice = await (navigator as any).bluetooth.requestDevice({
            filters: [{ name: device.name }],
            optionalServices: [
              '03b80e5a-ede8-4b33-a751-6ce34ec4c700',
              'generic_access', 
              'generic_attribute',
              '7772e5db-3868-4112-a1a9-f2669d106bf3',
              '42a7ce7d-8f4c-4f7f-8c8d-8e6c9b2a4b3c',
              '6e400001-b5a3-f393-e0a9-e50e24dcca9e'
            ]
          });
        } else {
          // New device connection
          bluetoothDevice = await (navigator as any).bluetooth.requestDevice({
            filters: [{ name: device.name }],
            optionalServices: [
              '03b80e5a-ede8-4b33-a751-6ce34ec4c700',
              'generic_access', 
              'generic_attribute',
              '7772e5db-3868-4112-a1a9-f2669d106bf3',
              '42a7ce7d-8f4c-4f7f-8c8d-8e6c9b2a4b3c',
              '6e400001-b5a3-f393-e0a9-e50e24dcca9e'
            ]
          });
        }
      } catch (deviceError) {
        console.log('⚠️ Device selection failed, trying alternative approach...');
        // Fallback: try without filters
        bluetoothDevice = await (navigator as any).bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: [
            '03b80e5a-ede8-4b33-a751-6ce34ec4c700',
            'generic_access',
            'generic_attribute',
            '7772e5db-3868-4112-a1a9-f2669d106bf3',
            '42a7ce7d-8f4c-4f7f-8c8d-8e6c9b2a4b3c',
            '6e400001-b5a3-f393-e0a9-e50e24dcca9e'
          ]
        });
      }

      // Add connection event listeners
      bluetoothDevice.addEventListener('gattserverdisconnected', () => {
        console.log('🔌 Device disconnected unexpectedly');
        setConnectionStatus('disconnected');
        setSelectedDevice(prev => prev ? { ...prev, connected: false } : null);
        addMidiMessage('Device disconnected unexpectedly');
        
        // Notify performance interface
        window.dispatchEvent(new CustomEvent('bluetoothMidiStatusChanged', {
          detail: { connected: false, deviceName: '', midiReady: false }
        }));
      });

      const server = await bluetoothDevice.gatt.connect();
      console.log('✅ Connected to GATT server');

      // Add a small delay to ensure connection is stable
      await new Promise(resolve => setTimeout(resolve, 500));

      // Try to setup MIDI communication
      let midiSetupSuccess = false;
      try {
        await setupMidiCommunication(server);
        console.log('🎵 MIDI setup completed');
        midiSetupSuccess = true;
      } catch (midiError) {
        console.error('⚠️ MIDI setup failed but connection succeeded:', midiError);
        addMidiMessage('Connected but MIDI setup failed - device may not support MIDI');
      }

      setBluetoothDevice(bluetoothDevice);
      setSelectedDevice({ ...device, connected: true });
      setConnectionStatus('connected');
      
      // Remember this device
      localStorage.setItem('bluetooth_device_id', device.id);
      localStorage.setItem('bluetooth_device_name', device.name);
      
      // Save to paired devices
      saveDeviceToStorage({ ...device, connected: true, deviceType: 'midi' });

      // Notify performance interface about connection status
      window.dispatchEvent(new CustomEvent('bluetoothMidiStatusChanged', {
        detail: { 
          connected: true, 
          deviceName: device.name,
          midiReady: midiSetupSuccess && !!midiCharacteristic 
        }
      }));

      // Update devices list
      setDevices(prev => prev.map(d => 
        d.id === device.id ? { ...d, connected: true } : d
      ));

      toast({
        title: "Connected",
        description: `Successfully connected to ${device.name}`,
      });

    } catch (error) {
      console.error('❌ Connection failed:', error);
      setConnectionStatus('disconnected');
      
      let errorMessage = `Failed to connect to ${device.name}`;
      const errorStr = error instanceof Error ? error.message : String(error);
      
      if (errorStr.includes('User cancelled') || errorStr.includes('cancelled')) {
        errorMessage = 'Connection cancelled by user';
      } else if (errorStr.includes('not found') || errorStr.includes('NotFoundError')) {
        errorMessage = 'Device not found. Make sure it\'s in pairing mode.';
      } else if (errorStr.includes('Security') || errorStr.includes('NotAllowedError')) {
        errorMessage = 'Connection not allowed. Check device permissions.';
      }
      
      toast({
        title: "Connection Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  // Force pair and reconnect to fix pairing issues
  const forcePairDevice = async (device: BluetoothDevice) => {
    setIsConnecting(true);
    
    try {
      console.log(`🔧 Force pairing ${device.name}...`);
      
      // Disconnect existing connection if any
      if (bluetoothDevice && bluetoothDevice.gatt.connected) {
        bluetoothDevice.gatt.disconnect();
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Clear stored device info to force fresh pairing
      localStorage.removeItem('bluetooth_device_id');
      localStorage.removeItem('bluetooth_device_name');
      
      // Request fresh device pairing
      const newBluetoothDevice = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          '03b80e5a-ede8-4b33-a751-6ce34ec4c700',
          'generic_access',
          'generic_attribute',
          '7772e5db-3868-4112-a1a9-f2669d106bf3',
          '42a7ce7d-8f4c-4f7f-8c8d-8e6c9b2a4b3c',
          '6e400001-b5a3-f393-e0a9-e50e24dcca9e'
        ]
      });
      
      console.log('✅ New device paired:', newBluetoothDevice.name);
      
      // Update device info and connect normally
      const updatedDevice = {
        ...device,
        id: newBluetoothDevice.id,
        name: newBluetoothDevice.name || device.name
      };
      
      // Now connect normally
      await connectToDevice(updatedDevice);
      
      toast({
        title: "Device Re-paired",
        description: `Successfully re-paired ${updatedDevice.name}`,
      });
      
    } catch (error) {
      console.error('❌ Force pair failed:', error);
      setConnectionStatus('disconnected');
      toast({
        title: "Re-pairing Failed",
        description: "Could not re-pair device. Try putting device in pairing mode.",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  // Setup MIDI communication over BLE
  const setupMidiCommunication = async (server: any) => {
    try {
      console.log('🎵 Setting up MIDI communication...');
      
      // Try standard MIDI service first
      const midiServiceUUIDs = [
        '03b80e5a-ede8-4b33-a751-6ce34ec4c700', // Standard MIDI
        '7772e5db-3868-4112-a1a9-f2669d106bf3', // Roland
        '6e400001-b5a3-f393-e0a9-e50e24dcca9e'  // Nordic UART
      ];

      let midiService = null;
      let characteristic = null;

      // Try to find a MIDI service
      for (const serviceUUID of midiServiceUUIDs) {
        try {
          midiService = await server.getPrimaryService(serviceUUID);
          console.log(`✅ Found MIDI service: ${serviceUUID}`);
          break;
        } catch (e) {
          console.log(`❌ Service ${serviceUUID} not found`);
        }
      }

      if (!midiService) {
        console.log('⚠️ No MIDI service found, trying generic communication');
        return;
      }

      // Get characteristics for MIDI communication
      const characteristics = await midiService.getCharacteristics();
      console.log(`📋 Found ${characteristics.length} characteristics`);

      let notifyCharacteristic = null;
      let writeCharacteristic = null;

      // Look for characteristics we can use
      for (const char of characteristics) {
        console.log(`📋 Characteristic ${char.uuid}: notify=${char.properties.notify}, write=${char.properties.write}, writeWithoutResponse=${char.properties.writeWithoutResponse}`);
        
        // For receiving MIDI data
        if (char.properties.notify || char.properties.indicate) {
          notifyCharacteristic = char;
          console.log(`🔔 Found notify characteristic: ${char.uuid}`);
        }
        
        // For sending MIDI data - prefer writeWithoutResponse for MIDI
        if (char.properties.writeWithoutResponse || char.properties.write) {
          writeCharacteristic = char; // Always use the latest writable characteristic (might be same as notify)
          console.log(`✍️ Found write characteristic: ${char.uuid} (write=${char.properties.write}, writeWithoutResponse=${char.properties.writeWithoutResponse})`);
        }
      }

      console.log(`🔍 Final characteristics - Notify: ${notifyCharacteristic?.uuid}, Write: ${writeCharacteristic?.uuid}`);
      console.log(`🔍 Same characteristic for read/write: ${notifyCharacteristic?.uuid === writeCharacteristic?.uuid}`);

      // Set up notifications for incoming MIDI
      if (notifyCharacteristic) {
        try {
          await notifyCharacteristic.startNotifications();
          console.log('🎵 Started MIDI notifications');
          notifyCharacteristic.addEventListener('characteristicvaluechanged', handleMidiMessage);
          addMidiMessage('MIDI receive connection established');
        } catch (e) {
          console.log('⚠️ Could not start notifications:', e);
        }
      }

      // Store the write characteristic for sending MIDI
      if (writeCharacteristic) {
        setMidiCharacteristic(writeCharacteristic);
        addMidiMessage('MIDI send connection established');
        console.log('✅ 🔥 MIDI WRITE CHARACTERISTIC STORED SUCCESSFULLY');
        console.log('🔍 Characteristic UUID:', writeCharacteristic.uuid);
        console.log('🔍 Write properties:', {
          write: writeCharacteristic.properties.write,
          writeWithoutResponse: writeCharacteristic.properties.writeWithoutResponse
        });
      } else {
        console.log('⚠️ 🔥 NO WRITABLE CHARACTERISTIC FOUND FOR MIDI');
        addMidiMessage('MIDI connection established - receive only');
      }

    } catch (error) {
      console.error('❌ MIDI setup failed:', error);
      addMidiMessage('MIDI setup failed - basic connection only');
    }
  };

  // Handle incoming MIDI messages
  const handleMidiMessage = (event: any) => {
    const value = event.target.value;
    const data = new Uint8Array(value.buffer);
    
    console.log('🎵 Received MIDI data:', Array.from(data).map(b => b.toString(16).padStart(2, '0')).join(' '));
    
    // Parse MIDI message
    const midiCommand = parseMidiMessage(data);
    if (midiCommand) {
      addMidiMessage(midiCommand);
    }
  };

  // Parse MIDI message into readable format
  const parseMidiMessage = (data: Uint8Array): string | null => {
    if (data.length === 0) return null;

    // Handle BLE MIDI format (first byte is often timestamp header)
    let midiBytes = data;
    if (data.length > 1 && (data[0] & 0x80) === 0x80) {
      // Skip BLE MIDI timestamp header
      midiBytes = data.slice(1);
    }

    if (midiBytes.length === 0) return null;

    const status = midiBytes[0];
    const channel = (status & 0x0F) + 1;
    const command = status & 0xF0;

    switch (command) {
      case 0x90: // Note On
        if (midiBytes.length >= 3) {
          const note = midiBytes[1];
          const velocity = midiBytes[2];
          return `Note ON: ${getMidiNoteName(note)} (${note}) velocity ${velocity} ch${channel}`;
        }
        break;
        
      case 0x80: // Note Off
        if (midiBytes.length >= 3) {
          const note = midiBytes[1];
          const velocity = midiBytes[2];
          return `Note OFF: ${getMidiNoteName(note)} (${note}) velocity ${velocity} ch${channel}`;
        }
        break;
        
      case 0xC0: // Program Change
        if (midiBytes.length >= 2) {
          const program = midiBytes[1];
          return `Program Change: ${program} ch${channel}`;
        }
        break;
        
      case 0xB0: // Control Change
        if (midiBytes.length >= 3) {
          const controller = midiBytes[1];
          const value = midiBytes[2];
          return `Control Change: CC${controller} = ${value} ch${channel}`;
        }
        break;
        
      case 0xE0: // Pitch Bend
        if (midiBytes.length >= 3) {
          const lsb = midiBytes[1];
          const msb = midiBytes[2];
          const value = (msb << 7) | lsb;
          return `Pitch Bend: ${value} ch${channel}`;
        }
        break;
        
      default:
        return `Unknown MIDI: ${Array.from(midiBytes).map(b => b.toString(16).padStart(2, '0')).join(' ')}`;
    }

    return `Invalid MIDI data: ${Array.from(midiBytes).map(b => b.toString(16).padStart(2, '0')).join(' ')}`;
  };

  // Convert MIDI note number to note name
  const getMidiNoteName = (note: number): string => {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(note / 12) - 1;
    const noteName = noteNames[note % 12];
    return `${noteName}${octave}`;
  };

  // Add MIDI message to display
  const addMidiMessage = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setMidiMessages(prev => [...prev, { timestamp, message }].slice(-50)); // Keep last 50 messages
  };

  // Load stored devices from localStorage
  const loadStoredDevices = () => {
    try {
      const storedDevices = localStorage.getItem('bluetooth_paired_devices');
      if (storedDevices) {
        const parsedDevices = JSON.parse(storedDevices) as BluetoothDevice[];
        setOfflineDevices(parsedDevices.map(device => ({
          ...device,
          connected: false,
          paired: true,
          lastSeen: device.lastSeen || 'Unknown'
        })));
        console.log('📱 Loaded', parsedDevices.length, 'stored devices');
      }
    } catch (error) {
      console.error('❌ Error loading stored devices:', error);
    }
  };

  // Save device to localStorage when paired
  const saveDeviceToStorage = (device: BluetoothDevice) => {
    try {
      const storedDevices = localStorage.getItem('bluetooth_paired_devices');
      let devices = storedDevices ? JSON.parse(storedDevices) : [];
      
      // Check if device already exists
      const existingIndex = devices.findIndex((d: BluetoothDevice) => d.id === device.id);
      const deviceToSave = {
        ...device,
        lastSeen: new Date().toISOString(),
        paired: true
      };
      
      if (existingIndex >= 0) {
        devices[existingIndex] = deviceToSave;
      } else {
        devices.push(deviceToSave);
      }
      
      localStorage.setItem('bluetooth_paired_devices', JSON.stringify(devices));
      console.log('💾 Saved device to storage:', device.name);
    } catch (error) {
      console.error('❌ Error saving device to storage:', error);
    }
  };

  // Enhanced device scanning for more device types
  const scanForAllDevices = async () => {
    if (!hasBluetoothSupport) {
      toast({
        title: "Bluetooth Not Supported",
        description: "This browser doesn't support Bluetooth",
        variant: "destructive",
      });
      return;
    }

    setIsScanning(true);
    try {
      console.log('🔍 Scanning for all Bluetooth devices...');
      
      // First scan for MIDI devices (current functionality)
      await scanForDevices();
      
      // Then scan for other Bluetooth devices
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          '03b80e5a-ede8-4b33-a751-6ce34ec4c700', // MIDI
          '0000180f-0000-1000-8000-00805f9b34fb', // Battery Service
          '0000180a-0000-1000-8000-00805f9b34fb', // Device Information
          '0000110b-0000-1000-8000-00805f9b34fb', // Audio Sink
          '0000110e-0000-1000-8000-00805f9b34fb', // A2DP
          'generic_access',
          'generic_attribute'
        ]
      });

      const deviceType = determineDeviceType(device.name || 'Unknown');
      const newDevice: BluetoothDevice = {
        id: device.id,
        name: device.name || 'Unknown Device',
        connected: false,
        paired: false,
        deviceType: deviceType,
        lastSeen: new Date().toISOString()
      };

      setAvailableDevices(prev => {
        const exists = prev.find(d => d.id === device.id);
        if (exists) return prev;
        return [...prev, newDevice];
      });

      // Save to storage
      saveDeviceToStorage(newDevice);

      toast({
        title: "Device Found",
        description: `Found: ${newDevice.name} (${deviceType})`,
      });

    } catch (error) {
      console.error('❌ Enhanced Bluetooth scan failed:', error);
      // Don't show error toast for cancelled scans
      const errorString = error instanceof Error ? error.message : String(error);
      if (!errorString.includes('cancelled')) {
        toast({
          title: "Scan Failed",
          description: "Failed to scan for Bluetooth devices",
          variant: "destructive",
        });
      }
    } finally {
      setIsScanning(false);
    }
  };

  // Determine device type based on name and services
  const determineDeviceType = (name: string): 'midi' | 'audio' | 'other' => {
    const nameLower = name.toLowerCase();
    if (nameLower.includes('midi') || nameLower.includes('widi') || 
        nameLower.includes('cme') || nameLower.includes('roland')) {
      return 'midi';
    }
    if (nameLower.includes('headphones') || nameLower.includes('speaker') || 
        nameLower.includes('airpods') || nameLower.includes('audio')) {
      return 'audio';
    }
    return 'other';
  };

  // Disconnect from device
  const disconnectFromDevice = () => {
    if (bluetoothDevice && bluetoothDevice.gatt.connected) {
      bluetoothDevice.gatt.disconnect();
      console.log('🔌 Disconnected from device');
    }
    
    // Clean up MIDI resources
    if (midiCharacteristic) {
      try {
        midiCharacteristic.removeEventListener('characteristicvaluechanged', handleMidiMessage);
        console.log('🎵 MIDI listener removed');
      } catch (e) {
        console.log('⚠️ Error removing MIDI listener:', e);
      }
      setMidiCharacteristic(null);
    }
    
    setBluetoothDevice(null);
    setConnectionStatus('disconnected');
    setSelectedDevice(prev => prev ? { ...prev, connected: false } : null);
    addMidiMessage('MIDI connection closed');
    
    // Update devices list
    if (selectedDevice) {
      setDevices(prev => prev.map(d => 
        d.id === selectedDevice.id ? { ...d, connected: false } : d
      ));
    }

    // Notify performance interface about disconnection
    window.dispatchEvent(new CustomEvent('bluetoothMidiStatusChanged', {
      detail: { 
        connected: false, 
        deviceName: '',
        midiReady: false 
      }
    }));

    toast({
      title: "Disconnected",
      description: "Device disconnected",
    });
  };

  // Attempt to reconnect to saved device
  const attemptReconnect = async (deviceId: string, deviceName: string) => {
    try {
      console.log(`🔄 Attempting to reconnect to ${deviceName}...`);
      await connectToDevice({ id: deviceId, name: deviceName, connected: false });
    } catch (error) {
      console.log('⚠️ Auto-reconnect failed:', error);
    }
  };

  // Parse MIDI bracket format to bytes
  const parseMidiCommand = (command: string): Uint8Array | null => {
    // Parse [[TYPE:VALUE:CHANNEL]] format
    const bracketMatch = command.match(/\[\[([^:]+):([^:]+):([^\]]+)\]\]/);
    if (!bracketMatch) {
      // Try legacy hex format like "C0 0C"
      const hexMatch = command.match(/^([0-9A-Fa-f\s]+)$/);
      if (hexMatch) {
        const hexBytes = command.split(/\s+/).filter(h => h.length > 0);
        return new Uint8Array(hexBytes.map(h => parseInt(h, 16)));
      }
      return null;
    }

    const [, type, value, channel] = bracketMatch;
    const ch = Math.max(1, Math.min(16, parseInt(channel))) - 1; // Convert to 0-15
    const val = parseInt(value);

    switch (type.toUpperCase()) {
      case 'PC': // Program Change - MIDI values are 0-127, send value as-is
        return new Uint8Array([0xC0 | ch, Math.min(127, Math.max(0, val))]);
        
      case 'CC': // Control Change - expect format [[CC:controller:value:channel]]
        const parts = command.match(/\[\[CC:([^:]+):([^:]+):([^\]]+)\]\]/);
        if (parts) {
          const controller = parseInt(parts[1]);
          const ccValue = parseInt(parts[2]);
          const ccChannel = Math.max(1, Math.min(16, parseInt(parts[3]))) - 1;
          return new Uint8Array([0xB0 | ccChannel, Math.min(127, Math.max(0, controller)), Math.min(127, Math.max(0, ccValue))]);
        }
        return null;
        
      case 'NOTE': // Note On - expect format [[NOTE:note:velocity:channel]]
        const noteParts = command.match(/\[\[NOTE:([^:]+):([^:]+):([^\]]+)\]\]/);
        if (noteParts) {
          const note = parseInt(noteParts[1]);
          const velocity = parseInt(noteParts[2]);
          const noteChannel = Math.max(1, Math.min(16, parseInt(noteParts[3]))) - 1;
          const cmd = velocity > 0 ? 0x90 : 0x80; // Note On or Note Off
          return new Uint8Array([cmd | noteChannel, Math.min(127, Math.max(0, note)), Math.min(127, Math.max(0, velocity))]);
        }
        return null;

      case 'BANK': // Bank Select - expect format [[BANK:bank:channel]]
        const bankParts = command.match(/\[\[BANK:([^:]+):([^\]]+)\]\]/);
        if (bankParts) {
          const bank = parseInt(bankParts[1]);
          const bankChannel = Math.max(1, Math.min(16, parseInt(bankParts[2]))) - 1;
          // Send Bank Select MSB (CC 0) followed by Bank Select LSB (CC 32)
          return new Uint8Array([
            0xB0 | bankChannel, 0, Math.min(127, Math.max(0, bank >> 7)), // MSB
            0xB0 | bankChannel, 32, Math.min(127, Math.max(0, bank & 0x7F)) // LSB
          ]);
        }
        return null;
        
      default:
        return null;
    }
  };

  // Simplified MIDI send function - direct raw bytes only
  const sendMidiCommand = async (midiBytes: Uint8Array) => {
    console.log('🎵 SENDING RAW MIDI:', Array.from(midiBytes).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' '));
    
    if (!midiCharacteristic) {
      throw new Error('MIDI characteristic not available');
    }

    if (!bluetoothDevice || !bluetoothDevice.gatt.connected) {
      throw new Error('Device not connected');
    }

    // Send raw MIDI bytes directly - no BLE MIDI wrapper, no timestamps, no complications
    try {
      console.log('📤 Sending raw MIDI bytes directly to device...');
      await midiCharacteristic.writeValueWithoutResponse(midiBytes);
      console.log('✅ Raw MIDI sent successfully!');
      
    } catch (error) {
      console.error('❌ MIDI send failed:', error);
      throw error;
    }
  };

  // Send test message
  const sendTestMessage = async () => {
    console.log('🚀 Send button clicked!');
    console.log('🔍 Bluetooth device connected:', !!bluetoothDevice?.gatt?.connected);
    console.log('🔍 MIDI characteristic available:', !!midiCharacteristic);
    
    if (!bluetoothDevice || !bluetoothDevice.gatt.connected) {
      console.log('❌ Device not connected');
      toast({
        title: "Not Connected",
        description: "Please connect to a device first",
        variant: "destructive",
      });
      return;
    }

    if (!midiCharacteristic) {
      console.log('❌ No MIDI characteristic available');
      toast({
        title: "MIDI Not Available",
        description: "MIDI characteristic not found on this device",
        variant: "destructive",
      });
      return;
    }

    console.log('✅ All checks passed, proceeding to send MIDI...');

    try {
      console.log(`📤 Parsing MIDI command: ${testMessage}`);
      
      // Parse the MIDI command
      const midiBytes = parseMidiCommand(testMessage);
      if (!midiBytes) {
        toast({
          title: "Invalid MIDI Format",
          description: "Use format: [[PC:1:1]] [[CC:7:64:1]] [[NOTE:60:127:1]] [[BANK:0:1]]",
          variant: "destructive",
        });
        return;
      }

      // Send raw MIDI bytes directly
      await sendMidiCommand(midiBytes);
      
      const hexString = Array.from(midiBytes).map(b => b.toString(16).padStart(2, '0')).join(' ');
      setLastSentMessage(`${testMessage} → ${hexString}`);
      
      // Add message to display
      addMidiMessage(`📤 ${testMessage} → ${hexString}`);
      
      toast({
        title: "MIDI Sent",
        description: `${testMessage} → ${hexString}`,
      });

    } catch (error) {
      console.error('❌ MIDI send failed:', error);
      
      let errorMessage = "Failed to send MIDI command";
      const errorStr = error instanceof Error ? error.message : String(error);
      if (errorStr.includes("Not paired")) {
        errorMessage = "Device not paired. Try disconnecting and reconnecting.";
      } else if (errorStr.includes("GATT")) {
        errorMessage = "Bluetooth connection issue. Check device pairing.";
      } else if (errorStr.includes("write")) {
        errorMessage = "Device doesn't support MIDI sending.";
      }
      
      toast({
        title: "Send Failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  // Don't render for non-professional users
  if (!isProfessional) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bluetooth className="h-5 w-5" />
            Simple Bluetooth Manager
            <Badge variant={hasBluetoothSupport ? "default" : "secondary"}>
              {hasBluetoothSupport ? "Supported" : "Not Supported"}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto pr-2">
          {/* Connection Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Connection Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {connectionStatus === 'connected' ? (
                    <>
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <span className="text-green-600 dark:text-green-400">
                        Connected to {selectedDevice?.name}
                        {midiCharacteristic ? ' (MIDI Ready)' : ' (No MIDI)'}
                      </span>
                    </>
                  ) : connectionStatus === 'connecting' ? (
                    <>
                      <Activity className="h-5 w-5 text-yellow-500 animate-pulse" />
                      <span className="text-yellow-600 dark:text-yellow-400">Connecting...</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-5 w-5 text-red-500" />
                      <span className="text-red-600 dark:text-red-400">Not Connected</span>
                    </>
                  )}
                </div>
                
                {selectedDevice?.connected && (
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => forcePairDevice(selectedDevice)}
                      variant="ghost" 
                      size="sm"
                      title="Re-pair device to fix connection issues"
                    >
                      🔧 Re-pair
                    </Button>
                    <Button 
                      onClick={disconnectFromDevice}
                      variant="outline" 
                      size="sm"
                    >
                      <WifiOff className="h-4 w-4 mr-2" />
                      Disconnect
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Device Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Device Selection</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  onClick={scanForDevices} 
                  disabled={isScanning || !hasBluetoothSupport}
                >
                  <Search className="h-4 w-4 mr-2" />
                  {isScanning ? 'Scanning MIDI...' : 'Scan MIDI Devices'}
                </Button>
                <Button 
                  onClick={scanForAllDevices} 
                  disabled={isScanning || !hasBluetoothSupport}
                  variant="outline"
                >
                  <Search className="h-4 w-4 mr-2" />
                  {isScanning ? 'Scanning All...' : 'Scan All Devices'}
                </Button>
              </div>

              {/* Connected Devices */}
              {devices.filter(d => d.connected).length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Connected Devices:
                  </h4>
                  <ScrollArea className="h-24">
                    {devices.filter(d => d.connected).map(device => (
                      <div key={device.id} className="flex items-center justify-between p-2 border border-green-200 rounded bg-green-50 dark:bg-green-900/20">
                        <div className="flex items-center gap-2">
                          <Bluetooth className="h-4 w-4 text-green-600" />
                          <span>{device.name}</span>
                          <Badge variant="default" className="text-xs bg-green-600">Connected</Badge>
                          {device.deviceType && (
                            <Badge variant="outline" className="text-xs">{device.deviceType}</Badge>
                          )}
                        </div>
                        <Button 
                          onClick={disconnectFromDevice}
                          size="sm"
                          variant="outline"
                        >
                          <WifiOff className="h-4 w-4 mr-1" />
                          Disconnect
                        </Button>
                      </div>
                    ))}
                  </ScrollArea>
                </div>
              )}

              {/* Available/Discovered Devices */}
              {devices.filter(d => !d.connected).length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium flex items-center gap-2">
                    <Search className="h-4 w-4 text-blue-500" />
                    Available Devices:
                  </h4>
                  <ScrollArea className="h-32">
                    {devices.filter(d => !d.connected).map(device => (
                      <div key={device.id} className="flex items-center justify-between p-2 border border-blue-200 rounded bg-blue-50 dark:bg-blue-900/20">
                        <div className="flex items-center gap-2">
                          <Bluetooth className="h-4 w-4 text-blue-600" />
                          <span>{device.name}</span>
                          {device.deviceType && (
                            <Badge variant="outline" className="text-xs">{device.deviceType}</Badge>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button 
                            onClick={() => connectToDevice(device)}
                            disabled={isConnecting}
                            size="sm"
                            variant="outline"
                          >
                            <Wifi className="h-4 w-4 mr-1" />
                            Connect
                          </Button>
                          <Button 
                            onClick={() => forcePairDevice(device)}
                            disabled={isConnecting}
                            size="sm"
                            variant="ghost"
                            title="Force re-pair if connection issues persist"
                          >
                            🔧
                          </Button>
                        </div>
                      </div>
                    ))}
                  </ScrollArea>
                </div>
              )}

              {/* Other Bluetooth Devices */}
              {availableDevices.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium flex items-center gap-2">
                    <Bluetooth className="h-4 w-4 text-purple-500" />
                    Other Bluetooth Devices:
                  </h4>
                  <ScrollArea className="h-32">
                    {availableDevices.map(device => (
                      <div key={device.id} className="flex items-center justify-between p-2 border border-purple-200 rounded bg-purple-50 dark:bg-purple-900/20">
                        <div className="flex items-center gap-2">
                          <Bluetooth className="h-4 w-4 text-purple-600" />
                          <span>{device.name}</span>
                          {device.deviceType && (
                            <Badge variant="outline" className="text-xs">{device.deviceType}</Badge>
                          )}
                          {device.lastSeen && (
                            <span className="text-xs text-gray-500">Last seen: {new Date(device.lastSeen).toLocaleDateString()}</span>
                          )}
                        </div>
                        <Button 
                          onClick={() => connectToDevice(device)}
                          disabled={isConnecting}
                          size="sm"
                          variant="outline"
                        >
                          <Wifi className="h-4 w-4 mr-1" />
                          Connect
                        </Button>
                      </div>
                    ))}
                  </ScrollArea>
                </div>
              )}

              {/* Offline/Paired Devices */}
              {offlineDevices.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium flex items-center gap-2">
                    <WifiOff className="h-4 w-4 text-gray-500" />
                    Offline Devices (Bluetooth may be turned off):
                  </h4>
                  <ScrollArea className="h-32">
                    {offlineDevices.map(device => (
                      <div key={device.id} className="flex items-center justify-between p-2 border border-gray-300 rounded bg-gray-50 dark:bg-gray-800">
                        <div className="flex items-center gap-2">
                          <WifiOff className="h-4 w-4 text-gray-500" />
                          <span className="text-gray-600 dark:text-gray-400">{device.name}</span>
                          <Badge variant="secondary" className="text-xs">Offline</Badge>
                          {device.deviceType && (
                            <Badge variant="outline" className="text-xs">{device.deviceType}</Badge>
                          )}
                          {device.lastSeen && (
                            <span className="text-xs text-gray-500">Last seen: {new Date(device.lastSeen).toLocaleDateString()}</span>
                          )}
                        </div>
                        <Button 
                          onClick={() => connectToDevice(device)}
                          disabled={isConnecting}
                          size="sm"
                          variant="outline"
                        >
                          <Wifi className="h-4 w-4 mr-1" />
                          Try Connect
                        </Button>
                      </div>
                    ))}
                  </ScrollArea>
                </div>
              )}

              {devices.length === 0 && availableDevices.length === 0 && offlineDevices.length === 0 && (
                <div className="text-center text-gray-500 py-4">
                  <Bluetooth className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No devices found. Try scanning for devices.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Communication Test */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Communication Test</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  placeholder="[[PC:1:1]] [[CC:7:64:1]] [[NOTE:60:127:1]]"
                  className="flex-1 px-3 py-2 border rounded text-black dark:text-white bg-white dark:bg-gray-800"
                  disabled={connectionStatus !== 'connected'}
                />
                <Button 
                  onClick={() => {
                    console.log('🖱️ Send button clicked - testing click handler');
                    sendTestMessage();
                  }}
                  disabled={connectionStatus !== 'connected'}
                  data-testid="button-send-midi"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Send
                </Button>
                <Button 
                  onClick={() => {
                    if (midiCharacteristic) sendMidiCommand(new Uint8Array([0xC0, 0])); // Program 1
                  }}
                  disabled={connectionStatus !== 'connected'}
                  variant="outline"
                  size="sm"
                >
                  Preset 1
                </Button>
                <Button 
                  onClick={() => {
                    if (midiCharacteristic) sendMidiCommand(new Uint8Array([0xC0, 1])); // Program 2
                  }}
                  disabled={connectionStatus !== 'connected'}
                  variant="outline"
                  size="sm"
                >
                  Preset 2
                </Button>
              </div>

              {lastSentMessage && (
                <div className="p-2 bg-blue-50 dark:bg-blue-950 rounded">
                  <div className="text-sm font-medium text-blue-700 dark:text-blue-300">
                    Last Sent: {lastSentMessage}
                  </div>
                </div>
              )}

              {lastReceivedMessage && (
                <div className="p-2 bg-green-50 dark:bg-green-950 rounded">
                  <div className="text-sm font-medium text-green-700 dark:text-green-300">
                    Last Received: {lastReceivedMessage}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* MIDI Message Listener */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">MIDI Commands Listener</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Listening for MIDI commands from connected device
                </span>
                <Badge variant={connectionStatus === 'connected' ? "default" : "secondary"}>
                  {connectionStatus === 'connected' ? "Active" : "Inactive"}
                </Badge>
              </div>
              
              {/* MIDI Messages Display */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm">Recent MIDI Messages:</h4>
                  <Button
                    onClick={() => setMidiMessages([])}
                    variant="outline"
                    size="sm"
                    disabled={midiMessages.length === 0}
                  >
                    Clear
                  </Button>
                </div>
                
                <ScrollArea className="h-32 w-full rounded border p-2 bg-gray-50 dark:bg-gray-900">
                  {midiMessages.length === 0 ? (
                    <div className="text-center text-gray-500 text-sm py-4">
                      No MIDI messages received yet
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {midiMessages.slice(-10).map((msg, index) => (
                        <div key={index} className="text-xs font-mono bg-white dark:bg-gray-800 p-2 rounded border">
                          <div className="text-gray-500 text-[10px]">{msg.timestamp}</div>
                          <div className="text-green-600 dark:text-green-400">{msg.message}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>

              <div className="text-xs text-gray-500">
                MIDI commands will appear here when received from your connected Bluetooth device.
                Supports standard MIDI messages like Program Change, Control Change, and Note On/Off.
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}