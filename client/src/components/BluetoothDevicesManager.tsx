import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
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
  const { toast } = useToast();

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
          variant: "default",
        });
      } else {
        const updatedDevices = [...devices, newDevice];
        setDevices(updatedDevices);
        saveDevicesToStorage(updatedDevices);

        toast({
          title: "Device Added",
          description: `Added ${newDevice.name} to device list`,
        });
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'NotFoundError') {
        toast({
          title: "Scan Failed",
          description: `Quick scan failed: ${error.message}`,
          variant: "destructive",
        });
      }
    } finally {
      setIsScanning(false);
    }
  };

  // Deep scan with multiple attempts
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
    try {
      // Try multiple scan approaches
      const services = [
        '03b80e5a-ede8-4b33-a751-6ce34ec4c700', // BLE MIDI
        '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART  
        '0000fff0-0000-1000-8000-00805f9b34fb', // Generic MIDI
        '0000180a-0000-1000-8000-00805f9b34fb', // Device Information
        '0000180f-0000-1000-8000-00805f9b34fb'  // Battery Service
      ];

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          console.log(`Deep scan attempt ${attempt}/3`);
          
          for (const service of services) {
            try {
              const bluetoothDevice = await (navigator as any).bluetooth.requestDevice({
                filters: [{ services: [service] }],
                optionalServices: services
              });

              const deviceType = isMIDIDevice(bluetoothDevice.name || 'Unknown');
              const newDevice: BluetoothDevice = {
                id: bluetoothDevice.id || `bt_${Date.now()}_${attempt}`,
                name: bluetoothDevice.name || `Unknown Device ${attempt}`,
                connected: false,
                paired: true,
                type: deviceType,
                address: bluetoothDevice.id || undefined
              };

              // Check if device already exists
              if (!devices.find(d => d.id === newDevice.id || d.name === newDevice.name)) {
                setDevices(prev => {
                  const updated = [...prev, newDevice];
                  saveDevicesToStorage(updated);
                  return updated;
                });

                const deviceTypeLabel = deviceType === 'midi' ? 'MIDI device' : 'Bluetooth device';
                toast({
                  title: "Device Found",
                  description: `Found: ${newDevice.name} (${deviceTypeLabel})`,
                });
                break;
              }
            } catch (attemptError) {
              console.log(`Scan attempt ${attempt} failed:`, attemptError);
            }
          }
        } catch (attemptError) {
          console.log(`Scan attempt ${attempt} failed:`, attemptError);
        }
        
        // Wait between attempts
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    } catch (error) {
      console.error('Deep scan failed:', error);
      toast({
        title: "Deep Scan Failed",
        description: `Deep scan failed: ${error}`,
        variant: "destructive",
      });
    } finally {
      setIsScanning(false);
    }
  };

  // Connect to device
  const handleConnectDevice = async (device: BluetoothDevice) => {
    if (!hasBluetoothSupport) {
      toast({
        title: "Connection Failed",
        description: "Bluetooth not supported in this browser",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log('Connecting to MIDI device:', device.name);

      // Request the device again to get a fresh connection
      const bluetoothDevice = await (navigator as any).bluetooth.requestDevice({
        filters: [{ name: device.name }],
        optionalServices: ['03b80e5a-ede8-4b33-a751-6ce34ec4c700', '7772e5db-3868-4112-a1a9-f2669d106bf3']
      });

      console.log('Device requested, connecting to GATT server...');
      const server = await bluetoothDevice.gatt.connect();
      
      console.log('Connected to GATT server');

      // Store the Bluetooth device connection for sending commands
      setDeviceConnections(prev => {
        const newConnections = new Map(prev);
        newConnections.set(device.id, {
          bluetoothDevice: bluetoothDevice,
          gattServer: server
        });
        return newConnections;
      });

      // Update device status
      setDevices(prev => prev.map(d => 
        d.id === device.id ? { ...d, connected: true, paired: true } : d
      ));
      setConnectedDevices(prev => [...prev.filter(d => d.id !== device.id), { ...device, connected: true, paired: true }]);

      // Set up device listening
      await setupDeviceListening(bluetoothDevice, device);

      saveDevicesToStorage(devices.map(d => 
        d.id === device.id ? { ...d, connected: true, paired: true } : d
      ));

      toast({
        title: "MIDI Device Connected",
        description: `Successfully connected to ${device.name}`,
      });
    } catch (error) {
      console.error('Connection failed:', error);
      
      setDevices(prev => prev.map(d => 
        d.id === device.id ? { ...d, connected: false } : d
      ));

      toast({
        title: "Connection Failed",
        description: `Failed to connect to ${device.name}: ${error}`,
        variant: "destructive",
      });
    }
  };

  // Set up device listening for MIDI messages
  const setupDeviceListening = async (bluetoothDevice: any, device: BluetoothDevice) => {
    console.log('Setting up MIDI device listening for:', device.name);
    
    const debugMessage: BluetoothMessage = {
      timestamp: Date.now(),
      deviceId: device.id,
      deviceName: device.name,
      data: 'DEBUG: Starting MIDI listener setup...',
      type: 'midi'
    };
    setMessages(prev => [...prev.slice(-49), debugMessage]);
    
    try {
      // DISCOVER ALL SERVICES AND CHARACTERISTICS THAT WORK FOR RECEIVING
      const server = bluetoothDevice.gatt;
      console.log(`🔍 ANALYZING ALL SERVICES FOR RECEIVING FROM ${device.name}...`);
      
      const services = await server.getPrimaryServices();
      let foundReceiveChar = null;
      let foundReceiveService = null;
      
      // Try to find ANY characteristic that can notify (receive data from device)
      for (const service of services) {
        console.log(`🔍 Checking service: ${service.uuid}`);
        try {
          const characteristics = await service.getCharacteristics();
          for (const char of characteristics) {
            console.log(`  📝 Characteristic: ${char.uuid}`);
            console.log(`    Properties:`, char.properties);
            
            if (char.properties.notify || char.properties.indicate) {
              console.log(`  🎯 FOUND NOTIFICATION CHARACTERISTIC: ${service.uuid} → ${char.uuid}`);
              
              try {
                // Try to start notifications on this characteristic
                await char.startNotifications();
                foundReceiveChar = char;
                foundReceiveService = service;
                
                console.log(`✅ SUCCESSFULLY STARTED NOTIFICATIONS ON: ${service.uuid} → ${char.uuid}`);
                console.log(`🔑 THIS IS THE CHARACTERISTIC YOUR PEDAL USES FOR OUTPUT!`);
                
                // Store this information for later use in sending
                const receiveInfo = {
                  serviceUuid: service.uuid,
                  charUuid: char.uuid,
                  service: service,
                  characteristic: char
                };
                
                // Store in device connections for reference during sending
                setDeviceConnections(prev => {
                  const newConnections = new Map(prev);
                  const existingDevice = newConnections.get(device.id) || {};
                  newConnections.set(device.id, {
                    ...existingDevice,
                    receiveInfo: receiveInfo
                  });
                  return newConnections;
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
      
      if (!foundReceiveChar || !foundReceiveService) {
        throw new Error('No notification characteristics found');
      }
      
      const midiService = foundReceiveService;
      const midiCharacteristic = foundReceiveChar;
      
      // Set up notification listener for incoming MIDI data
      await midiCharacteristic.startNotifications();
      
      midiCharacteristic.addEventListener('characteristicvaluechanged', (event: any) => {
        const value = event.target.value;
        const data = new Uint8Array(value.buffer);
        
        // Flash green light for incoming data
        setIncomingDataActive(true);
        setTimeout(() => setIncomingDataActive(false), 300);
        
        // Parse BLE MIDI data (skip timestamp header bytes)
        const midiData = Array.from(data).slice(2); // Remove BLE MIDI timestamp header
        
        // Create readable message
        const message: BluetoothMessage = {
          timestamp: Date.now(),
          deviceId: device.id,
          deviceName: device.name,
          data: `Received: [${midiData.map(b => b.toString(16).padStart(2, '0')).join(' ')}]`,
          type: 'midi'
        };
        
        setMessages(prev => [...prev.slice(-49), message]);
        console.log('Received MIDI data from', device.name, ':', midiData);
      });
      
      console.log('MIDI characteristic notifications started successfully');
      
      const successMessage: BluetoothMessage = {
        timestamp: Date.now(),
        deviceId: device.id,
        deviceName: device.name,
        data: 'MIDI listener setup complete - ready to receive data',
        type: 'midi'
      };
      setMessages(prev => [...prev.slice(-49), successMessage]);
      
      // Add disconnect listener
      bluetoothDevice.addEventListener('gattserverdisconnected', () => {
        console.log('MIDI device disconnected:', device.name);
        const disconnectMessage: BluetoothMessage = {
          timestamp: Date.now(),
          deviceId: device.id,
          deviceName: device.name,
          data: 'MIDI device disconnected',
          type: 'midi'
        };
        setMessages(prev => [...prev.slice(-49), disconnectMessage]);
        
        // Update device status
        setDevices(prev => prev.map(d => 
          d.id === device.id ? { ...d, connected: false } : d
        ));
        setConnectedDevices(prev => prev.filter(d => d.id !== device.id));
      });
      
    } catch (error) {
      console.error('Error setting up MIDI device listening:', error);
      
      const errorMessage: BluetoothMessage = {
        timestamp: Date.now(),
        deviceId: device.id,
        deviceName: device.name,
        data: `ERROR: Failed to set up MIDI listeners: ${error}`,
        type: 'midi'
      };
      setMessages(prev => [...prev.slice(-49), errorMessage]);
    }
    
    // Add a test message to confirm the MIDI system is working
    setTimeout(() => {
      const testMessage: BluetoothMessage = {
        timestamp: Date.now(),
        deviceId: device.id,
        deviceName: device.name,
        data: 'MIDI system ready - waiting for MIDI input...',
        type: 'midi'
      };
      setMessages(prev => [...prev.slice(-49), testMessage]);
    }, 1000);
  };

  // Disconnect device
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

  // Send command to device - SIMPLIFIED VERSION FOR TESTING
  const handleSendCommand = async (device: BluetoothDevice, command: string) => {
    try {
      console.log(`🎹 Sending command to ${device.name}:`, command);
      
      // Parse the MIDI command locally
      const parsed = parseMIDICommand(command);
      if (!parsed) {
        throw new Error('Invalid MIDI command format. Use [[PC:12:1]], [[CC:7:64:1]], or [[NOTE:60:127:1]]');
      }
      
      const midiBytes = parsed.bytes;
      console.log(`🎵 Parsed MIDI bytes:`, midiBytes);
      
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
      
      // FIRST CHECK IF WE HAVE RECEIVE INFO TO GUIDE US  
      let receiveInfo = null;
      
      if (connectionInfo && connectionInfo.receiveInfo) {
        receiveInfo = connectionInfo.receiveInfo;
        console.log(`🔑 USING RECEIVE INFO TO GUIDE SENDING:`);
        console.log(`🔑 Pedal receives FROM us using service: ${receiveInfo.serviceUuid}`);
        console.log(`🔑 Pedal sends TO us using characteristic: ${receiveInfo.charUuid}`);
        console.log(`🔑 Looking for INPUT characteristic in same service...`);
      }
      
      // TEST ALL WRITABLE CHARACTERISTICS (prioritizing same service as receiver)
      try {
        const server = bluetoothDevice.gatt;
        console.log(`🔍 TESTING ALL WRITABLE CHARACTERISTICS FOR ${device.name}...`);
        
        const services = await server.getPrimaryServices();
        const writableCharacteristics = [];
        
        // Find all writable characteristics
        for (const service of services) {
          try {
            const characteristics = await service.getCharacteristics();
            for (const char of characteristics) {
              if (char.properties.write || char.properties.writeWithoutResponse) {
                const isFromReceiveService = receiveInfo && service.uuid === receiveInfo.serviceUuid;
                const isSameAsReceiveChar = receiveInfo && char.uuid === receiveInfo.charUuid;
                
                writableCharacteristics.push({
                  service: service.uuid,
                  char: char.uuid,
                  characteristic: char,
                  canWrite: char.properties.write,
                  canWriteWithoutResponse: char.properties.writeWithoutResponse,
                  priority: isFromReceiveService ? (isSameAsReceiveChar ? 1 : 2) : 3 // Same char = priority 1, same service = priority 2, other = priority 3
                });
                
                const priorityLabel = isFromReceiveService 
                  ? (isSameAsReceiveChar ? ' 🌟 SAME AS RECEIVE CHAR!' : ' ⭐ SAME SERVICE AS RECEIVER')
                  : '';
                console.log(`🎯 WRITABLE CHARACTERISTIC: ${service.uuid} → ${char.uuid}${priorityLabel}`);
              }
            }
          } catch (charError: any) {
            console.log(`❌ Could not read characteristics from service ${service.uuid}`);
          }
        }
        
        if (writableCharacteristics.length === 0) {
          throw new Error('No writable characteristics found on device');
        }
        
        // Sort by priority (same char first, then same service, then others)
        writableCharacteristics.sort((a, b) => a.priority - b.priority);
        
        console.log(`🎯 Found ${writableCharacteristics.length} writable characteristics - testing each one (prioritized by receive info)...`);
        
        // SPECIAL CASE: If we found the exact receive characteristic and it's writable, test it first
        if (receiveInfo) {
          const exactReceiveChar = writableCharacteristics.find(wc => 
            wc.service === receiveInfo.serviceUuid && 
            wc.char === receiveInfo.charUuid
          );
          
          if (exactReceiveChar) {
            console.log(`\n🌟 SPECIAL TEST: Using EXACT same characteristic that receives data from your pedal!`);
            console.log(`🌟 Service: ${receiveInfo.serviceUuid}`);
            console.log(`🌟 Characteristic: ${receiveInfo.charUuid}`);
            console.log(`📤 WATCH YOUR PEDAL LIGHT - This should work!`);
            
            try {
              // Create BLE MIDI packet with timestamp header (same format as incoming data)
              const timestamp = Date.now() & 0x1FFF; // 13-bit timestamp
              const timestampHigh = 0x80 | ((timestamp >> 7) & 0x3F);
              const timestampLow = 0x80 | (timestamp & 0x7F);
              const blePacket = new Uint8Array([timestampHigh, timestampLow, ...midiBytes]);
              
              console.log(`📤 Sending BLE MIDI packet: [${Array.from(blePacket).map(b => b.toString(16).padStart(2, '0')).join(' ')}]`);
              console.log(`📤 Raw MIDI data: [${Array.from(midiBytes).map(b => b.toString(16).padStart(2, '0')).join(' ')}]`);
              console.log(`📤 BLE timestamp header: [${timestampHigh.toString(16).padStart(2, '0')} ${timestampLow.toString(16).padStart(2, '0')}]`);
              
              if (exactReceiveChar.canWriteWithoutResponse) {
                await exactReceiveChar.characteristic.writeValueWithoutResponse(blePacket);
                console.log(`✅ writeValueWithoutResponse() with BLE MIDI format completed!`);
              } else if (exactReceiveChar.canWrite) {
                await exactReceiveChar.characteristic.writeValue(blePacket);
                console.log(`✅ writeValue() with BLE MIDI format completed!`);
              }
              
              console.log(`🚨🚨🚨 DID YOUR PEDAL LIGHT BLINK? This should be THE ONE! 🚨🚨🚨`);
              
              // If this works, we can stop here
              setOutgoingDataActive(true);
              setTimeout(() => setOutgoingDataActive(false), 300);
              
              const successMessage: BluetoothMessage = {
                timestamp: Date.now(),
                deviceId: device.id,
                deviceName: device.name,
                data: `SUCCESS: Sent ${parsed.formatted} using exact receive characteristic!`,
                type: 'midi'
              };
              setMessages(prev => [...prev.slice(-49), successMessage]);
              
              toast({
                title: "MIDI Command Sent!",
                description: `Used exact receive characteristic - check if your pedal responded!`,
              });
              
              return; // Success! No need to test other characteristics
              
            } catch (directError: any) {
              console.log(`❌ Direct test on exact receive characteristic failed: ${directError?.message}`);
            }
          }
        }
        
        console.log(`\n🔄 Testing all writable characteristics as fallback...`);
        
        // Test each writable characteristic
        for (let i = 0; i < writableCharacteristics.length; i++) {
          const testChar = writableCharacteristics[i];
          console.log(`\n🧪 TEST ${i + 1}/${writableCharacteristics.length}:`);
          console.log(`🔍 Service: ${testChar.service}`);
          console.log(`🔍 Characteristic: ${testChar.char}`);
          console.log(`📤 WATCH YOUR PEDAL LIGHT - Testing write to this characteristic...`);
          
          try {
            // Test with raw MIDI data
            const testPacket = new Uint8Array(midiBytes);
            
            if (testChar.canWriteWithoutResponse) {
              await testChar.characteristic.writeValueWithoutResponse(testPacket);
              console.log(`✅ writeValueWithoutResponse() test completed`);
            } else if (testChar.canWrite) {
              await testChar.characteristic.writeValue(testPacket);
              console.log(`✅ writeValue() test completed`);
            }
            
            console.log(`🚨 DID YOUR PEDAL LIGHT BLINK? If YES, this is the correct characteristic!`);
            console.log(`⏳ Waiting 2 seconds before next test...`);
            
            // Wait 2 seconds between tests
            await new Promise(resolve => setTimeout(resolve, 2000));
            
          } catch (testError: any) {
            console.log(`❌ Test failed for ${testChar.char}: ${testError?.message || testError}`);
          }
        }
        
        console.log(`\n🎯 All tests completed. Which test made your pedal light blink?`);
        
        // Flash blue light for outgoing data attempt
        setOutgoingDataActive(true);
        setTimeout(() => setOutgoingDataActive(false), 300);
        
        const message: BluetoothMessage = {
          timestamp: Date.now(),
          deviceId: device.id,
          deviceName: device.name,
          data: `Tested ${writableCharacteristics.length} characteristics with: ${parsed.formatted}`,
          type: 'midi'
        };
        setMessages(prev => [...prev.slice(-49), message]);
        
        toast({
          title: "Characteristic Tests Completed",
          description: `Tested ${writableCharacteristics.length} characteristics - check console for results`,
        });
        
      } catch (gattError: any) {
        console.error('🚨 GATT error:', gattError);
        throw new Error(`Failed to access device characteristics: ${gattError?.message || gattError}`);
      }
      
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
                <Badge variant="destructive">
                  <X className="h-3 w-3 mr-1" />
                  Bluetooth Not Supported
                </Badge>
              )}
            </div>

            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {devices.length === 0 ? (
                  <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                    <Bluetooth className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No Bluetooth devices found</p>
                    <p className="text-sm">Use Quick Scan or Deep Scan to discover devices</p>
                  </div>
                ) : (
                  devices
                    .sort((a, b) => {
                      // Sort MIDI devices first, then by connection status, then by name
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
                            <div className={`p-2 rounded-full bg-gray-100 dark:bg-gray-800 ${getDeviceColor(device.type)}`}>
                              {getDeviceIcon(device.type)}
                            </div>
                            <div>
                              <h3 className="font-medium text-sm">{device.name}</h3>
                              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                <Badge variant={device.type === 'midi' ? 'default' : 'secondary'} className="text-xs">
                                  {device.type === 'midi' ? 'MIDI' : 'Bluetooth'}
                                </Badge>
                                <Badge variant={device.connected ? 'default' : 'outline'} className="text-xs">
                                  {device.connected ? 'Connected' : 'Disconnected'}
                                </Badge>
                                {device.paired && (
                                  <Badge variant="outline" className="text-xs">
                                    Paired
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {device.connected ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDisconnectDevice(device)}
                                data-testid={`button-disconnect-${device.id}`}
                              >
                                <WifiOff className="h-4 w-4" />
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleConnectDevice(device)}
                                data-testid={`button-connect-${device.id}`}
                              >
                                <Wifi className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
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
                <Trash2 className="h-4 w-4" />
                Clear Messages
              </Button>
            </div>

            <ScrollArea className="h-[400px] border rounded-md p-4 bg-gray-50 dark:bg-gray-900 font-mono text-sm">
              {messages.length === 0 ? (
                <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                  <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No MIDI messages yet</p>
                  <p className="text-sm">Connect a MIDI device and start playing to see messages here</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {messages.map((message, index) => (
                    <div key={index} className="text-xs">
                      <div className="text-gray-500 dark:text-gray-400">
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </div>
                      <div className="font-semibold text-blue-600 dark:text-blue-400">
                        {message.deviceName}
                      </div>
                      <div className="text-gray-900 dark:text-gray-100">
                        {message.data}
                      </div>
                    </div>
                  ))}
                </div>
              )}
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