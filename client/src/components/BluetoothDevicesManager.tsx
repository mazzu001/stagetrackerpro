import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useLocalAuth } from '@/hooks/useLocalAuth';
import { parseMIDICommand } from '@/utils/midiFormatter';
import { 
  Bluetooth, 
  Search, 
  Wifi, 
  WifiOff, 
  Plus, 
  X, 
  Trash2, 
  Music, 
  Volume2, 
  Scan, 
  Zap, 
  ArrowRight, 
  MoreVertical, 
  Activity 
} from 'lucide-react';

interface BluetoothDevice {
  id: string;
  name: string;
  connected: boolean;
  paired: boolean;
  type: 'midi' | 'bluetooth';
  address?: string;
  rssi?: number;
  services?: string[];
}

interface BluetoothMessage {
  timestamp: number;
  deviceId: string;
  deviceName: string;
  data: string;
  type: 'midi';
}

interface BluetoothDevicesManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function BluetoothDevicesManager({ isOpen, onClose }: BluetoothDevicesManagerProps) {
  const { user } = useLocalAuth();
  const isProfessional = user?.userType === 'professional';
  const { toast } = useToast();

  // All useState hooks must come first before any conditional logic
  const [devices, setDevices] = useState<BluetoothDevice[]>([]);
  const [connectedDevices, setConnectedDevices] = useState<BluetoothDevice[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [messages, setMessages] = useState<BluetoothMessage[]>([]);
  const [selectedTab, setSelectedTab] = useState<'devices' | 'messages' | 'commands'>('devices');
  const [commandInput, setCommandInput] = useState('');
  const [hasBluetoothSupport, setHasBluetoothSupport] = useState(false);
  const [bluetoothState, setBluetoothState] = useState<string>('unknown');
  const [incomingDataActive, setIncomingDataActive] = useState(false);
  const [outgoingDataActive, setOutgoingDataActive] = useState(false);
  // Store Bluetooth device connections for sending commands
  const [deviceConnections, setDeviceConnections] = useState<Map<string, any>>(new Map());

  // Professional subscription check - restrict Bluetooth MIDI features to level 3 subscribers only
  useEffect(() => {
    if (isOpen && !isProfessional) {
      toast({
        title: "Professional Subscription Required",
        description: "Bluetooth MIDI features are only available for Professional subscribers (Level 3)",
        variant: "destructive",
      });
      onClose();
    }
  }, [isOpen, isProfessional, onClose, toast]);

  // Check Bluetooth availability
  useEffect(() => {
    const checkBluetoothSupport = async () => {
      if ('bluetooth' in navigator) {
        setHasBluetoothSupport(true);
        try {
          const available = await (navigator as any).bluetooth.getAvailability();
          setBluetoothState(available ? 'poweredOn' : 'poweredOff');
        } catch (error) {
          console.log('Bluetooth availability check failed:', error);
          setBluetoothState('unavailable');
        }
      } else {
        setHasBluetoothSupport(false);
        setBluetoothState('notSupported');
      }
    };

    checkBluetoothSupport();
  }, []);

  // Load devices from storage
  useEffect(() => {
    const loadDevicesFromStorage = () => {
      try {
        const stored = localStorage.getItem('bluetoothDevices');
        if (stored) {
          const storedDevices: BluetoothDevice[] = JSON.parse(stored);
          setDevices(storedDevices);
          setConnectedDevices(storedDevices.filter(d => d.connected));
        }
      } catch (error) {
        console.error('Error loading devices from storage:', error);
      }
    };

    if (isOpen) {
      loadDevicesFromStorage();
    }
  }, [isOpen]);

  // Save devices to storage
  const saveDevicesToStorage = (devicesToSave: BluetoothDevice[]) => {
    try {
      localStorage.setItem('bluetoothDevices', JSON.stringify(devicesToSave));
    } catch (error) {
      console.error('Error saving devices to storage:', error);
    }
  };

  // Get Bluetooth state color
  const getBluetoothStateColor = () => {
    switch (bluetoothState) {
      case 'poweredOn':
        return 'text-green-600 dark:text-green-400';
      case 'poweredOff':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'unavailable':
        return 'text-red-600 dark:text-red-400';
      case 'notSupported':
        return 'text-gray-600 dark:text-gray-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  // Get Bluetooth state icon
  const getBluetoothStateIcon = () => {
    switch (bluetoothState) {
      case 'poweredOn':
        return <Bluetooth className="h-4 w-4 text-blue-600" />;
      case 'poweredOff':
        return <WifiOff className="h-4 w-4 text-yellow-600" />;
      case 'unavailable':
        return <X className="h-4 w-4 text-red-600" />;
      case 'notSupported':
        return <X className="h-4 w-4 text-gray-600" />;
      default:
        return <Bluetooth className="h-4 w-4 text-gray-600" />;
    }
  };

  // Check if device might be MIDI-related based on name and manufacturer
  const isMIDIDevice = (name: string): 'midi' | 'bluetooth' => {
    const lowerName = name.toLowerCase();
    const midiKeywords = [
      'midi', 'piano', 'keyboard', 'synth', 'drum', 'guitar', 'bass',
      'roland', 'yamaha', 'korg', 'novation', 'akai', 'moog', 'arturia',
      'behringer', 'boss', 'tc electronic', 'line 6', 'fractal', 'kemper',
      'pedal', 'footswitch', 'controller', 'daw', 'sequencer'
    ];
    
    return midiKeywords.some(keyword => lowerName.includes(keyword)) ? 'midi' : 'bluetooth';
  };

  // Send MIDI data to a specific characteristic
  const sendMIDIToCharacteristic = async (characteristic: any, midiBytes: number[], device: BluetoothDevice) => {
    console.log(`🎯 Attempting to send MIDI to characteristic ${characteristic.char}`);
    console.log(`🎵 MIDI bytes to send: [${midiBytes.map(b => b.toString(16).padStart(2, '0')).join(' ')}]`);
    
    // Try multiple formats to ensure compatibility with different devices
    const formats = [
      {
        name: 'BLE MIDI with proper timestamp',
        data: () => {
          const timestamp = Date.now() & 0x1FFF;
          const timestampHigh = 0x80 | (timestamp >> 7);
          const timestampLow = 0x80 | (timestamp & 0x7F);
          return new Uint8Array([timestampHigh, timestampLow, ...midiBytes]);
        }
      },
      {
        name: 'BLE MIDI with fixed timestamp',
        data: () => new Uint8Array([0x80, 0x80, ...midiBytes])
      },
      {
        name: 'Raw MIDI data',
        data: () => new Uint8Array(midiBytes)
      }
    ];

    let lastError = null;
    
    for (const format of formats) {
      try {
        const packet = format.data();
        console.log(`📤 Trying ${format.name}: [${Array.from(packet).map(b => b.toString(16).padStart(2, '0')).join(' ')}]`);
        
        // Try writeValueWithResponse first (more reliable for most devices)
        if (characteristic.canWrite) {
          await characteristic.characteristic.writeValueWithResponse(packet);
          console.log(`✅ Success with ${format.name} using writeValueWithResponse`);
          return;
        } else if (characteristic.canWriteWithoutResponse) {
          await characteristic.characteristic.writeValueWithoutResponse(packet);
          console.log(`✅ Success with ${format.name} using writeValueWithoutResponse`);
          return;
        }
        
      } catch (error) {
        console.log(`❌ ${format.name} failed: ${error}`);
        lastError = error;
      }
    }
    
    throw new Error(`All MIDI formats failed. Last error: ${lastError}`);
  };

  // Discover and test characteristics (only when needed)
  const discoverAndTestCharacteristics = async (device: BluetoothDevice, midiBytes: number[], parsed: any) => {
    const connectionInfo = deviceConnections.get(device.id);
    const bluetoothDevice = connectionInfo?.bluetoothDevice;
    const server = bluetoothDevice.gatt;
    
    console.log(`🔍 Discovering characteristics for ${device.name}...`);
    
    const services = await server.getPrimaryServices();
    const writableCharacteristics = [];
    
    // Look for BLE MIDI service first (most common)
    const bleMidiServiceUuid = '03b80e5a-ede8-4b33-a751-6ce34ec4c700';
    let midiService = null;
    
    try {
      midiService = await server.getPrimaryService(bleMidiServiceUuid);
      console.log(`🎵 Found BLE MIDI service: ${bleMidiServiceUuid}`);
    } catch (error) {
      console.log(`⚠️ No BLE MIDI service found, checking all services`);
    }
    
    // If we found MIDI service, prioritize its characteristics
    if (midiService) {
      try {
        const midiCharacteristics = await midiService.getCharacteristics();
        console.log(`🎼 BLE MIDI service has ${midiCharacteristics.length} characteristics`);
        
        for (const char of midiCharacteristics) {
          console.log(`  📝 Characteristic: ${char.uuid}`);
          console.log(`    Properties: write:${char.properties.write} writeWithoutResponse:${char.properties.writeWithoutResponse} notify:${char.properties.notify}`);
          
          if (char.properties.write || char.properties.writeWithoutResponse) {
            writableCharacteristics.push({
              service: midiService.uuid,
              char: char.uuid,
              characteristic: char,
              canWrite: char.properties.write,
              canWriteWithoutResponse: char.properties.writeWithoutResponse,
              priority: 1 // High priority for MIDI service
            });
          }
        }
      } catch (charError) {
        console.log(`❌ Could not read MIDI service characteristics`);
      }
    }
    
    // Find writable characteristics in all other services
    for (const service of services) {
      if (service.uuid === bleMidiServiceUuid) continue; // Already processed
      
      try {
        const characteristics = await service.getCharacteristics();
        console.log(`📋 Service ${service.uuid} has ${characteristics.length} characteristics`);
        
        for (const char of characteristics) {
          if (char.properties.write || char.properties.writeWithoutResponse) {
            writableCharacteristics.push({
              service: service.uuid,
              char: char.uuid,
              characteristic: char,
              canWrite: char.properties.write,
              canWriteWithoutResponse: char.properties.writeWithoutResponse,
              priority: 2 // Lower priority for non-MIDI services
            });
          }
        }
      } catch (charError) {
        console.log(`❌ Could not read characteristics from service ${service.uuid}`);
      }
    }
    
    if (writableCharacteristics.length === 0) {
      throw new Error('No writable characteristics found on device');
    }
    
    // Sort by priority (MIDI service characteristics first)
    writableCharacteristics.sort((a, b) => a.priority - b.priority);
    
    console.log(`🎯 Found ${writableCharacteristics.length} writable characteristics, testing each one...`);
    
    // Test each characteristic until one works
    let workingCharacteristic = null;
    
    for (let i = 0; i < writableCharacteristics.length; i++) {
      const testChar = writableCharacteristics[i];
      console.log(`\n🧪 Test ${i + 1}/${writableCharacteristics.length} - Service: ${testChar.service}`);
      console.log(`🔍 Characteristic: ${testChar.char}`);
      console.log(`📤 Testing MIDI transmission...`);
      
      try {
        await sendMIDIToCharacteristic(testChar, midiBytes, device);
        
        // Success! This characteristic works
        workingCharacteristic = testChar;
        console.log(`✅ Found working characteristic: ${testChar.char}`);
        break;
        
      } catch (testError) {
        console.log(`❌ Characteristic ${testChar.char} failed: ${testError}`);
        // Continue to next characteristic
      }
      
      // Small delay between tests to avoid overwhelming the device
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    if (!workingCharacteristic) {
      throw new Error(`No working characteristic found after testing ${writableCharacteristics.length} characteristics. Device may not support MIDI input.`);
    }
    
    // Save the working characteristic for future use
    setDeviceConnections(prev => {
      const newConnections = new Map(prev);
      const existingConnection = newConnections.get(device.id) || {};
      newConnections.set(device.id, {
        ...existingConnection,
        sendCharacteristic: workingCharacteristic
      });
      return newConnections;
    });
    
    console.log(`💾 Saved working characteristic for future use`);
    
    // Show success feedback
    setOutgoingDataActive(true);
    setTimeout(() => setOutgoingDataActive(false), 300);
    
    const message: BluetoothMessage = {
      timestamp: Date.now(),
      deviceId: device.id,
      deviceName: device.name,
      data: `Sent: ${parsed.formatted} → [${midiBytes.map(b => b.toString(16).padStart(2, '0')).join(' ')}] via ${workingCharacteristic.char}`,
      type: 'midi'
    };
    setMessages(prev => [...prev.slice(-49), message]);
    
    toast({
      title: "Command Sent",
      description: `Successfully sent ${parsed.formatted} to ${device.name}`,
    });
  };

  // Quick scan for easily discoverable devices
  const handleQuickScan = async () => {
    if (!hasBluetoothSupport) {
      toast({
        title: "Bluetooth Not Supported",
        description: "Your browser doesn't support Bluetooth",
        variant: "destructive",
      });
      return;
    }

    setIsScanning(true);
    try {
      const bluetoothDevice = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          '03b80e5a-ede8-4b33-a751-6ce34ec4c700', // BLE MIDI
          '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART
          '0000fff0-0000-1000-8000-00805f9b34fb'  // Generic MIDI
        ]
      });

      const deviceType = isMIDIDevice(bluetoothDevice.name || 'Unknown');
      const newDevice: BluetoothDevice = {
        id: bluetoothDevice.id || `bt_${Date.now()}`,
        name: bluetoothDevice.name || 'Unknown Device',
        connected: false,
        paired: true,
        type: deviceType,
        address: bluetoothDevice.id || undefined
      };

      // Check if device already exists
      const existingDevice = devices.find(d => d.id === newDevice.id || d.name === newDevice.name);
      if (existingDevice) {
        toast({
          title: "Device Already Added",
          description: `${newDevice.name} is already in your device list`,
        });
        return;
      }

      const updatedDevices = [...devices, newDevice];
      setDevices(updatedDevices);
      saveDevicesToStorage(updatedDevices);

      toast({
        title: "Device Found",
        description: `Added ${newDevice.name} to device list`,
      });
    } catch (error: any) {
      console.error('Quick scan error:', error);
      if (error.name !== 'NotFoundError') {
        toast({
          title: "Scan Failed",
          description: error.message || "Failed to scan for devices",
          variant: "destructive",
        });
      }
    } finally {
      setIsScanning(false);
    }
  };

  // Deep scan for all discoverable devices
  const handleDeepScan = async () => {
    if (!hasBluetoothSupport) {
      toast({
        title: "Bluetooth Not Supported",
        description: "Your browser doesn't support Bluetooth",
        variant: "destructive",
      });
      return;
    }

    setIsScanning(true);
    console.log('🔍 Starting deep scan for all Bluetooth devices...');
    
    try {
      // Multiple scans with different service filters
      const scanPromises = [
        // MIDI specific scan
        (navigator as any).bluetooth.requestDevice({
          filters: [
            { services: ['03b80e5a-ede8-4b33-a751-6ce34ec4c700'] }, // BLE MIDI
          ],
          optionalServices: ['03b80e5a-ede8-4b33-a751-6ce34ec4c700']
        }).catch(() => null),
        
        // General device scan
        (navigator as any).bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: [
            '03b80e5a-ede8-4b33-a751-6ce34ec4c700', // BLE MIDI
            '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART
            '0000fff0-0000-1000-8000-00805f9b34fb'  // Generic MIDI
          ]
        }).catch(() => null),
      ];

      const results = await Promise.allSettled(scanPromises);
      const foundDevices = results
        .filter(result => result.status === 'fulfilled' && result.value)
        .map(result => (result as any).value);

      let addedCount = 0;
      for (const bluetoothDevice of foundDevices) {
        const deviceType = isMIDIDevice(bluetoothDevice.name || 'Unknown');
        const newDevice: BluetoothDevice = {
          id: bluetoothDevice.id || `bt_${Date.now()}`,
          name: bluetoothDevice.name || 'Unknown Device',
          connected: false,
          paired: true,
          type: deviceType,
          address: bluetoothDevice.id || undefined
        };

        // Check if device already exists
        const existingDevice = devices.find(d => d.id === newDevice.id || d.name === newDevice.name);
        if (!existingDevice) {
          setDevices(prev => {
            const updated = [...prev, newDevice];
            saveDevicesToStorage(updated);
            return updated;
          });
          addedCount++;
        }
      }

      if (addedCount > 0) {
        toast({
          title: "Deep Scan Complete",
          description: `Found and added ${addedCount} new device(s)`,
        });
      } else {
        toast({
          title: "Deep Scan Complete",
          description: "No new devices found",
        });
      }
    } catch (error: any) {
      console.error('Deep scan error:', error);
      if (error.name !== 'NotFoundError') {
        toast({
          title: "Deep Scan Failed",
          description: error.message || "Failed to perform deep scan",
          variant: "destructive",
        });
      }
    } finally {
      setIsScanning(false);
    }
  };

  // Connect to a device
  const handleConnectDevice = async (device: BluetoothDevice) => {
    try {
      console.log(`🔗 Connecting to ${device.name}...`);
      
      const bluetoothDevice = await (navigator as any).bluetooth.requestDevice({
        filters: [{ name: device.name }],
        optionalServices: [
          '03b80e5a-ede8-4b33-a751-6ce34ec4c700', // BLE MIDI
          '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART
          '0000fff0-0000-1000-8000-00805f9b34fb'  // Generic MIDI
        ]
      });

      console.log('🔗 Connecting to GATT server...');
      const server = await bluetoothDevice.gatt.connect();
      
      console.log('🔍 Getting primary services...');
      const services = await server.getPrimaryServices();
      
      console.log(`✅ Connected to ${device.name} with ${services.length} services`);

      // Store the Bluetooth device connection
      setDeviceConnections(prev => {
        const newConnections = new Map(prev);
        newConnections.set(device.id, {
          bluetoothDevice,
          server,
          services
        });
        return newConnections;
      });

      // Update device status
      setDevices(prev => prev.map(d => 
        d.id === device.id ? { ...d, connected: true } : d
      ));
      setConnectedDevices(prev => {
        const isAlreadyConnected = prev.some(d => d.id === device.id);
        return isAlreadyConnected ? prev : [...prev, { ...device, connected: true }];
      });
      
      saveDevicesToStorage(devices.map(d => 
        d.id === device.id ? { ...d, connected: true } : d
      ));

      // Set up notification handlers for incoming MIDI data (if this is a MIDI device)
      if (device.type === 'midi') {
        await setupMIDINotifications(device, bluetoothDevice);
      }

      toast({
        title: "Device Connected",
        description: `Successfully connected to ${device.name}`,
      });
    } catch (error: any) {
      console.error('Connection error:', error);
      toast({
        title: "Connection Failed",
        description: `Failed to connect to ${device.name}: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  // Setup MIDI notifications for receiving data
  const setupMIDINotifications = async (device: BluetoothDevice, bluetoothDevice: any) => {
    try {
      console.log(`🎵 Setting up MIDI notifications for ${device.name}...`);
      
      const server = bluetoothDevice.gatt;
      const services = await server.getPrimaryServices();
      
      let foundReceiveChar = false;
      let foundReceiveService = null;
      
      // Look for notification characteristics
      for (const service of services) {
        try {
          const characteristics = await service.getCharacteristics();
          console.log(`📋 Service ${service.uuid} has ${characteristics.length} characteristics`);
          
          for (const char of characteristics) {
            if (char.properties.notify) {
              console.log(`🔔 Found notification characteristic: ${char.uuid}`);
              
              try {
                // Store receive info for this device
                const receiveInfo = {
                  serviceUuid: service.uuid,
                  charUuid: char.uuid
                };
                
                setDeviceConnections(prev => {
                  const newConnections = new Map(prev);
                  const existingDevice = newConnections.get(device.id) || {};
                  newConnections.set(device.id, {
                    ...existingDevice,
                    receiveInfo: receiveInfo
                  });
                  return newConnections;
                });
                
                await char.startNotifications();
                foundReceiveChar = true;
                foundReceiveService = service;
                
                char.addEventListener('characteristicvaluechanged', (event: any) => {
                  const value = event.target.value;
                  const data = new Uint8Array(value.buffer);
                  
                  // Flash green light for incoming data
                  setIncomingDataActive(true);
                  setTimeout(() => setIncomingDataActive(false), 300);
                  
                  // Parse received data (might be BLE MIDI format)
                  const receivedData = Array.from(data);
                  console.log('Received MIDI data:', receivedData);
                  
                  const message: BluetoothMessage = {
                    timestamp: Date.now(),
                    deviceId: device.id,
                    deviceName: device.name,
                    data: `Received: [${receivedData.map(b => b.toString(16).padStart(2, '0')).join(' ')}]`,
                    type: 'midi'
                  };
                  
                  setMessages(prev => [...prev.slice(-49), message]);
                });
                
                break; // Found a working notification characteristic
              } catch (notifyError: any) {
                console.log(`❌ Failed to start notifications on ${char.uuid}: ${notifyError?.message}`);
              }
            }
          }
          if (foundReceiveChar) break; // Exit service loop if we found a working characteristic
        } catch (charError: any) {
          console.log(`❌ Could not read characteristics from service ${service.uuid}`);
        }
      }
      
      if (foundReceiveChar) {
        console.log('✅ MIDI notifications setup complete');
        
        const successMessage: BluetoothMessage = {
          timestamp: Date.now(),
          deviceId: device.id,
          deviceName: device.name,
          data: 'MIDI listener setup complete - ready to receive data',
          type: 'midi'
        };
        setMessages(prev => [...prev.slice(-49), successMessage]);
      } else {
        console.log('⚠️ No notification characteristics found');
      }
      
    } catch (error: any) {
      console.error('Failed to setup MIDI notifications:', error);
    }
  };

  // Disconnect from a device
  const handleDisconnectDevice = async (device: BluetoothDevice) => {
    try {
      // Remove device connection
      setDeviceConnections(prev => {
        const newConnections = new Map(prev);
        newConnections.delete(device.id);
        return newConnections;
      });

      // Update device status
      setDevices(prev => prev.map(d => 
        d.id === device.id ? { ...d, connected: false } : d
      ));
      setConnectedDevices(prev => prev.filter(d => d.id !== device.id));
      
      saveDevicesToStorage(devices.map(d => 
        d.id === device.id ? { ...d, connected: false } : d
      ));

      toast({
        title: "Device Disconnected",
        description: `Disconnected from ${device.name}`,
      });
    } catch (error) {
      console.error('Error disconnecting device:', error);
      toast({
        title: "Disconnection Failed",
        description: `Failed to disconnect from ${device.name}`,
        variant: "destructive",
      });
    }
  };

  // Remove a device from the list
  const handleRemoveDevice = (device: BluetoothDevice) => {
    const updatedDevices = devices.filter(d => d.id !== device.id);
    setDevices(updatedDevices);
    setConnectedDevices(updatedDevices.filter(d => d.connected));
    saveDevicesToStorage(updatedDevices);
    
    toast({
      title: "Device Removed",
      description: `Removed ${device.name} from device list`,
    });
  };

  // Send command to device - EFFICIENT VERSION
  const handleSendCommand = async (device: BluetoothDevice, command: string) => {
    try {
      console.log(`🎹 Sending command to ${device.name}:`, command);
      
      // Parse the MIDI command locally
      const parsed = parseMIDICommand(command);
      if (!parsed) {
        throw new Error('Invalid MIDI command format. Use [[PC:12:1]], [[CC:7:64:1]], or [[NOTE:60:127:1]]');
      }
      
      const midiBytes = parsed.bytes;
      console.log(`🎵 Parsed MIDI bytes: [${midiBytes.map(b => b.toString(16).padStart(2, '0')).join(' ')}]`);
      
      // Get the stored Bluetooth connection
      const connectionInfo = deviceConnections.get(device.id);
      if (!connectionInfo || !connectionInfo.bluetoothDevice) {
        throw new Error('Device connection not found. Try reconnecting the device.');
      }
      
      const bluetoothDevice = connectionInfo.bluetoothDevice;
      
      if (!bluetoothDevice.gatt?.connected) {
        console.log(`🔄 Attempting to reconnect to ${device.name}...`);
        try {
          await bluetoothDevice.gatt.connect();
        } catch (reconnectError) {
          console.error('Reconnection failed:', reconnectError);
          throw new Error('Device not connected and reconnection failed');
        }
      }

      // Check if we have a known working characteristic from previous connection
      let knownCharacteristic = null;
      if (connectionInfo && connectionInfo.sendCharacteristic) {
        knownCharacteristic = connectionInfo.sendCharacteristic;
        console.log(`📤 Using known working characteristic: ${knownCharacteristic.char}`);
      }

      // Try to send using known working characteristic first
      if (knownCharacteristic) {
        try {
          await sendMIDIToCharacteristic(knownCharacteristic, midiBytes, device);
          
          // Success! Show feedback
          setOutgoingDataActive(true);
          setTimeout(() => setOutgoingDataActive(false), 300);
          
          const message: BluetoothMessage = {
            timestamp: Date.now(),
            deviceId: device.id,
            deviceName: device.name,
            data: `Sent: ${parsed.formatted} → [${midiBytes.map(b => b.toString(16).padStart(2, '0')).join(' ')}]`,
            type: 'midi'
          };
          setMessages(prev => [...prev.slice(-49), message]);
          
          toast({
            title: "Command Sent",
            description: `Successfully sent ${parsed.formatted} to ${device.name}`,
          });
          
          return; // Exit early if successful
        } catch (knownCharError) {
          console.log(`⚠️ Known characteristic failed, trying discovery: ${knownCharError}`);
        }
      }

      // Discover and test characteristics if no known characteristic works
      await discoverAndTestCharacteristics(device, midiBytes, parsed);
      
    } catch (error: any) {
      console.error('🚨 Error sending MIDI command:', error);
      
      // Add detailed error message to logs
      const errorMessage: BluetoothMessage = {
        timestamp: Date.now(),
        deviceId: device.id,
        deviceName: device.name,
        data: `ERROR: ${error.message}`,
        type: 'midi'
      };
      setMessages(prev => [...prev.slice(-49), errorMessage]);
      
      toast({
        title: "Command Failed",
        description: error.message || `Failed to send command to ${device.name}`,
        variant: "destructive",
      });
    }
  };

  // Clear messages
  const handleClearMessages = () => {
    setMessages([]);
  };

  // Get device type icon (MIDI devices only)
  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'midi':
        return <Music className="h-4 w-4" />;
      case 'bluetooth':
        return <Bluetooth className="h-4 w-4" />;
      default:
        return null; // No icon for unknown devices
    }
  };

  // Get device type color (MIDI devices only)
  const getDeviceColor = (type: string) => {
    switch (type) {
      case 'midi':
        return 'text-purple-600 dark:text-purple-400';
      case 'bluetooth':
        return 'text-blue-600 dark:text-blue-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  // Don't render for non-professional users, but still call all hooks above
  if (!isProfessional) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-black dark:text-white">
            <Bluetooth className="h-5 w-5" />
            Bluetooth MIDI Devices
            <div className="flex items-center gap-2 ml-auto">
              <div className={`flex items-center gap-1 ${getBluetoothStateColor()}`}>
                {getBluetoothStateIcon()}
                <span className="text-sm">
                  {bluetoothState === 'poweredOn' && 'Ready'}
                  {bluetoothState === 'poweredOff' && 'Bluetooth Off'}
                  {bluetoothState === 'unavailable' && 'Unavailable'}
                  {bluetoothState === 'notSupported' && 'Not Supported'}
                  {bluetoothState === 'unknown' && 'Checking...'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {incomingDataActive && (
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                )}
                {outgoingDataActive && (
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                )}
                {!incomingDataActive && !outgoingDataActive && (
                  <div className="w-2 h-2 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
                )}
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <Tabs value={selectedTab} onValueChange={(value: any) => setSelectedTab(value)} className="flex-1">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="devices" className="flex items-center gap-2">
              <Bluetooth className="h-4 w-4" />
              Devices ({devices.length})
            </TabsTrigger>
            <TabsTrigger value="messages" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Messages ({messages.length})
            </TabsTrigger>
            <TabsTrigger value="commands" className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Send MIDI Commands
            </TabsTrigger>
          </TabsList>

          <TabsContent value="devices" className="flex-1 space-y-4">
            <div className="flex items-center gap-2">
              <Button
                onClick={handleQuickScan}
                disabled={!hasBluetoothSupport || isScanning}
                variant="outline"
                size="sm"
                data-testid="button-quick-scan"
              >
                {isScanning ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full" />
                    Scanning...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4" />
                    Quick Scan
                  </>
                )}
              </Button>
              
              <Button
                onClick={handleDeepScan}
                disabled={!hasBluetoothSupport || isScanning}
                variant="outline"
                size="sm"
                data-testid="button-deep-scan"
              >
                {isScanning ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full" />
                    Deep Scanning...
                  </>
                ) : (
                  <>
                    <Scan className="h-4 w-4" />
                    Deep Scan
                  </>
                )}
              </Button>

              {!hasBluetoothSupport && (
                <p className="text-sm text-red-600 dark:text-red-400">
                  Bluetooth not supported in this browser
                </p>
              )}
            </div>

            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {devices.length === 0 ? (
                  <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                    <Bluetooth className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No devices found</p>
                    <p className="text-sm">Use Quick Scan or Deep Scan to discover Bluetooth devices</p>
                  </div>
                ) : (
                  devices
                    .sort((a, b) => {
                      // MIDI devices first, then by connection status, then by name
                      if (a.type === 'midi' && b.type !== 'midi') return -1;
                      if (a.type !== 'midi' && b.type === 'midi') return 1;
                      if (a.connected && !b.connected) return -1;
                      if (!a.connected && b.connected) return 1;
                      return a.name.localeCompare(b.name);
                    })
                    .map((device) => (
                      <Card key={device.id} className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                              {getDeviceIcon(device.type)}
                              <span className={`text-sm font-medium ${getDeviceColor(device.type)}`}>
                                {device.name}
                              </span>
                              <Badge variant={device.type === 'midi' ? 'default' : 'secondary'} className="text-xs">
                                {device.type === 'midi' ? 'MIDI' : 'Bluetooth'}
                              </Badge>
                            </div>
                            {device.connected && (
                              <Badge variant="default" className="bg-green-600 text-white text-xs">
                                Connected
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {device.connected ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDisconnectDevice(device)}
                                data-testid={`button-disconnect-${device.id}`}
                              >
                                Disconnect
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleConnectDevice(device)}
                                data-testid={`button-connect-${device.id}`}
                              >
                                Connect
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRemoveDevice(device)}
                              data-testid={`button-remove-${device.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="messages" className="flex-1 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-black dark:text-white">MIDI Messages</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearMessages}
                data-testid="button-clear-messages"
              >
                Clear Messages
              </Button>
            </div>
            
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {messages.length === 0 ? (
                  <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                    <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No MIDI messages</p>
                    <p className="text-sm">Connect to a device and send commands to see messages here</p>
                  </div>
                ) : (
                  messages.map((message, index) => (
                    <Card key={index} className="p-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm">
                          <Music className="h-3 w-3 text-purple-600" />
                          <span className="font-medium text-black dark:text-white">{message.deviceName}</span>
                          <span className="text-gray-500 dark:text-gray-400">
                            {new Date(message.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-sm font-mono text-black dark:text-white bg-gray-100 dark:bg-gray-800 p-2 rounded">
                          {message.data}
                        </p>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="commands" className="flex-1 space-y-4">
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-black dark:text-white">Send MIDI Commands</h3>
              
              {connectedDevices.length === 0 ? (
                <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                  <Zap className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No connected MIDI devices</p>
                  <p className="text-sm">
                    Connect to a MIDI device to send commands
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {connectedDevices.map((device) => (
                    <Card key={device.id} className="p-4">
                      <CardHeader className="p-0 pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          {getDeviceIcon(device.type)}
                          {device.name}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="flex gap-2">
                          <Input
                            type="text"
                            value={commandInput}
                            onChange={(e) => setCommandInput(e.target.value)}
                            placeholder="Enter MIDI command (e.g., [[PC:12:1]], [[CC:7:64:1]], [[NOTE:60:127:1]])"
                            className="flex-1 px-3 py-2 border rounded text-sm text-black dark:text-white"
                            data-testid={`input-command-${device.id}`}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSendCommand(device, commandInput)}
                            disabled={!commandInput.trim()}
                            data-testid={`button-send-${device.id}`}
                          >
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                          Example formats: [[PC:1:1]] (Program Change), [[CC:7:127:1]] (Control Change), [[NOTE:60:127:1]] (Note On)
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose} data-testid="button-close-bluetooth">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}