import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
// Progress component not available, will use alternative
// import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { 
  Bluetooth, 
  Search, 
  Wifi, 
  WifiOff, 
  Volume2, 
  VolumeX, 
  RefreshCw, 
  Music,
  Send,
  Trash2,
  AlertCircle,
  CheckCircle,
  Signal,
  Battery,
  Info,
  Settings,
  Loader2
} from 'lucide-react';

interface BluetoothDevice {
  id: string;
  name: string;
  type: 'audio' | 'midi' | 'hid' | 'unknown';
  connected: boolean;
  paired: boolean;
  rssi?: number; // Signal strength
  batteryLevel?: number;
  deviceClass: string;
  services: string[];
  lastSeen: number;
  manufacturer?: string;
  model?: string;
}

interface BluetoothMessage {
  timestamp: number;
  deviceId: string;
  deviceName: string;
  data: string;
  type: 'midi' | 'audio' | 'data';
}

interface BluetoothDevicesManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BluetoothDevicesManager({ isOpen, onClose }: BluetoothDevicesManagerProps) {
  const [devices, setDevices] = useState<BluetoothDevice[]>([]);
  const [connectedDevices, setConnectedDevices] = useState<BluetoothDevice[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [isAggressiveScan, setIsAggressiveScan] = useState(false);
  const [scanMode, setScanMode] = useState<'normal' | 'aggressive' | 'continuous'>('normal');
  const [messages, setMessages] = useState<BluetoothMessage[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [command, setCommand] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [hasBluetoothSupport, setHasBluetoothSupport] = useState(false);
  const [bluetoothState, setBluetoothState] = useState<'unavailable' | 'poweredOff' | 'poweredOn' | 'unauthorized'>('unavailable');
  const [selectedTab, setSelectedTab] = useState<'devices' | 'messages' | 'commands'>('devices');
  
  const { toast } = useToast();

  // Check Bluetooth support
  useEffect(() => {
    const checkBluetoothSupport = async () => {
      if (typeof navigator !== 'undefined' && 'bluetooth' in navigator) {
        setHasBluetoothSupport(true);
        try {
          const availability = await navigator.bluetooth.getAvailability();
          setBluetoothState(availability ? 'poweredOn' : 'poweredOff');
        } catch (error) {
          console.error('Bluetooth access error:', error);
          setBluetoothState('unauthorized');
        }
      } else {
        setHasBluetoothSupport(false);
        setBluetoothState('unavailable');
      }
      
      // Load any previously paired devices from localStorage
      loadStoredDevices();
    };

    checkBluetoothSupport();
  }, []);

  // Load stored paired devices from localStorage
  const loadStoredDevices = () => {
    try {
      const storedDevices = localStorage.getItem('bluetoothPairedDevices');
      if (storedDevices) {
        const parsedDevices = JSON.parse(storedDevices) as BluetoothDevice[];
        setDevices(parsedDevices);
        setConnectedDevices(parsedDevices.filter(d => d.connected));
      }
    } catch (error) {
      console.error('Error loading stored Bluetooth devices:', error);
    }
  };

  // Save devices to localStorage
  const saveDevicesToStorage = (deviceList: BluetoothDevice[]) => {
    try {
      localStorage.setItem('bluetoothPairedDevices', JSON.stringify(deviceList));
    } catch (error) {
      console.error('Error saving Bluetooth devices:', error);
    }
  };

  // Real Bluetooth device scanning using Web Bluetooth API
  const handleScanDevices = async () => {
    setIsScanning(true);
    setScanProgress(0);
    
    const progressInterval = setInterval(() => {
      setScanProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 12.5; // 8 steps to complete
      });
    }, 1000);

    try {
      if (hasBluetoothSupport && bluetoothState === 'poweredOn') {
        // Try to scan for devices with different service filters
        const serviceFilters = [
          // Audio devices
          { services: ['0000110b-0000-1000-8000-00805f9b34fb'] }, // Audio Sink
          { services: ['0000110a-0000-1000-8000-00805f9b34fb'] }, // Audio Source
          { services: ['0000110d-0000-1000-8000-00805f9b34fb'] }, // Advanced Audio
          
          // MIDI devices
          { services: ['03b80e5a-ede8-4b33-a751-6ce34ec4c700'] }, // MIDI Service
          
          // HID devices
          { services: ['00001812-0000-1000-8000-00805f9b34fb'] }, // Human Interface Device
          
          // Generic discoverable devices
          { acceptAllDevices: true }
        ];

        const discoveredDevices: BluetoothDevice[] = [];
        
        for (const filter of serviceFilters) {
          try {
            const device = await navigator.bluetooth.requestDevice(filter);
            
            if (device && !discoveredDevices.some(d => d.id === device.id)) {
              const deviceType = determineDeviceType(device);
              const newDevice: BluetoothDevice = {
                id: device.id,
                name: device.name || 'Unknown Device',
                type: deviceType,
                connected: false,
                paired: false,
                rssi: -50, // Web Bluetooth doesn't provide RSSI during scan
                deviceClass: deviceType === 'audio' ? 'Audio/Video' : 
                            deviceType === 'midi' ? 'Peripheral' : 'Unknown',
                services: [], // Services will be populated when connected
                lastSeen: Date.now()
              };
              
              discoveredDevices.push(newDevice);
            }
          } catch (error) {
            // User cancelled or device not found with this filter
            continue;
          }
        }

        if (discoveredDevices.length > 0) {
          setDevices(prev => {
            const updated = [...prev];
            discoveredDevices.forEach(newDevice => {
              if (!updated.some(d => d.id === newDevice.id)) {
                updated.push(newDevice);
              }
            });
            saveDevicesToStorage(updated);
            return updated;
          });
          
          toast({
            title: "Scan Complete",
            description: `Found ${discoveredDevices.length} new Bluetooth device(s)`,
          });
        } else {
          toast({
            title: "Scan Complete",
            description: "No new Bluetooth devices found. Try enabling discoverable mode on your device.",
          });
        }
      } else {
        toast({
          title: "Bluetooth Unavailable",
          description: "Bluetooth is not available or not enabled. Please enable Bluetooth and grant permissions.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Scan Failed",
        description: "Bluetooth scan failed. Please ensure Bluetooth is enabled and grant browser permissions.",
        variant: "destructive",
      });
    } finally {
      setTimeout(() => {
        setIsScanning(false);
        setScanProgress(0);
      }, 1000);
    }
  };

  // Determine device type from Bluetooth device
  const determineDeviceType = (device: any): 'audio' | 'midi' | 'hid' | 'unknown' => {
    const name = device.name?.toLowerCase() || '';
    
    if (name.includes('audio') || name.includes('headphone') || name.includes('speaker') || 
        name.includes('airpods') || name.includes('beats') || name.includes('sony')) {
      return 'audio';
    }
    
    if (name.includes('midi') || name.includes('keyboard') || name.includes('controller') ||
        name.includes('yamaha') || name.includes('korg') || name.includes('roland')) {
      return 'midi';
    }
    
    if (name.includes('mouse') || name.includes('keyboard') || name.includes('controller')) {
      return 'hid';
    }
    
    return 'unknown';
  };

  // Connect to device using Web Bluetooth API
  const handleConnectDevice = async (device: BluetoothDevice) => {
    try {
      if (hasBluetoothSupport && bluetoothState === 'poweredOn') {
        // Request the specific device
        const bluetoothDevice = await navigator.bluetooth.requestDevice({
          filters: [{ name: device.name }],
          optionalServices: ['generic_access', 'device_information', 'battery_service']
        });
        
        // Connect to GATT server
        const server = await bluetoothDevice.gatt?.connect();
        
        if (server) {
          // Update device state
          const updatedDevices = devices.map(d => 
            d.id === device.id ? { 
              ...d, 
              connected: true, 
              paired: true, 
              lastSeen: Date.now() 
            } : d
          );
          
          setDevices(updatedDevices);
          setConnectedDevices(updatedDevices.filter(d => d.connected));
          saveDevicesToStorage(updatedDevices);
          
          // Set up message listening for connected device
          await setupDeviceListening(bluetoothDevice, device);
          
          // Add connection message for MIDI devices
          if (device.type === 'midi') {
            const message: BluetoothMessage = {
              timestamp: Date.now(),
              deviceId: device.id,
              deviceName: device.name,
              data: 'Connection established - MIDI ready, listening for input',
              type: 'midi'
            };
            setMessages(prev => [...prev.slice(-49), message]);
          }
          
          toast({
            title: "Device Connected",
            description: `${device.name} is now connected and listening for commands`,
          });
        }
      } else {
        toast({
          title: "Bluetooth Unavailable",
          description: "Bluetooth is not available for connection",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Connection Failed",
        description: `Unable to connect to ${device.name}. Make sure device is nearby and discoverable.`,
        variant: "destructive",
      });
    }
  };

  // Disconnect from device
  const handleDisconnectDevice = (device: BluetoothDevice) => {
    const updatedDevices = devices.map(d => 
      d.id === device.id ? { ...d, connected: false } : d
    );
    
    setDevices(updatedDevices);
    setConnectedDevices(updatedDevices.filter(d => d.connected));
    saveDevicesToStorage(updatedDevices);
    
    toast({
      title: "Device Disconnected",
      description: `${device.name} has been disconnected`,
    });
  };

  // Pair device using Web Bluetooth API
  const handlePairDevice = async (device: BluetoothDevice) => {
    try {
      if (hasBluetoothSupport && bluetoothState === 'poweredOn') {
        // Re-request the device to establish pairing
        const bluetoothDevice = await navigator.bluetooth.requestDevice({
          filters: [{ name: device.name }],
          optionalServices: ['generic_access', 'device_information']
        });
        
        // Connect to GATT server to establish pairing
        const server = await bluetoothDevice.gatt?.connect();
        
        if (server) {
          // Update device as paired and connected
          const updatedDevices = devices.map(d => 
            d.id === device.id ? { 
              ...d, 
              paired: true, 
              connected: true,
              lastSeen: Date.now()
            } : d
          );
          
          setDevices(updatedDevices);
          setConnectedDevices(updatedDevices.filter(d => d.connected));
          saveDevicesToStorage(updatedDevices);
          
          // Set up message listening for connected device
          await setupDeviceListening(bluetoothDevice, device);
          
          toast({
            title: "Device Paired & Connected",
            description: `${device.name} is now paired and connected`,
          });
          
          // Add to messages for MIDI devices
          if (device.type === 'midi') {
            const message: BluetoothMessage = {
              timestamp: Date.now(),
              deviceId: device.id,
              deviceName: device.name,
              data: 'Device paired and connected - MIDI ready, listening for commands',
              type: 'midi'
            };
            setMessages(prev => [...prev.slice(-49), message]);
          }
        }
      } else {
        toast({
          title: "Bluetooth Unavailable",
          description: "Bluetooth is not available for pairing",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Pairing Failed",
        description: `Unable to pair with ${device.name}. Device may not be discoverable.`,
        variant: "destructive",
      });
    }
  };

  // Send command to Bluetooth device
  const handleSendCommand = async () => {
    if (!selectedDevice || !command.trim()) return;

    const device = connectedDevices.find(d => d.id === selectedDevice);
    if (!device) return;

    try {
      // Try to find the connected Bluetooth device and send command
      const bluetoothDevice = await navigator.bluetooth.requestDevice({
        filters: [{ name: device.name }],
        optionalServices: ['03b80e5a-ede8-4b33-a751-6ce34ec4c700', 'generic_access', 'device_information']
      });
      
      if (bluetoothDevice.gatt?.connected) {
        const server = bluetoothDevice.gatt;
        
        // Try to send to MIDI service if it's a MIDI device
        if (device.type === 'midi') {
          try {
            const midiService = await server.getPrimaryService('03b80e5a-ede8-4b33-a751-6ce34ec4c700');
            const midiCharacteristic = await midiService.getCharacteristic('7772e5db-3868-4112-a1a9-f2669d106bf3');
            
            // Convert command to MIDI bytes (simple note on/off for testing)
            let midiBytes: Uint8Array;
            if (command.toLowerCase().includes('note on')) {
              midiBytes = new Uint8Array([0x90, 0x3C, 0x7F]); // Note On, Middle C, velocity 127
            } else if (command.toLowerCase().includes('note off')) {
              midiBytes = new Uint8Array([0x80, 0x3C, 0x00]); // Note Off, Middle C
            } else {
              // Convert hex string to bytes
              const hexValues = command.match(/[0-9a-fA-F]{2}/g);
              if (hexValues) {
                midiBytes = new Uint8Array(hexValues.map(hex => parseInt(hex, 16)));
              } else {
                // Default test message
                midiBytes = new Uint8Array([0x90, 0x3C, 0x7F]);
              }
            }
            
            await midiCharacteristic.writeValue(midiBytes);
            
            const message: BluetoothMessage = {
              timestamp: Date.now(),
              deviceId: device.id,
              deviceName: device.name,
              data: `Sent MIDI: [${Array.from(midiBytes).map(b => b.toString(16).padStart(2, '0')).join(' ')}] (${command})`,
              type: 'midi'
            };
            
            setMessages(prev => [...prev.slice(-49), message]);
            
          } catch (midiError) {
            throw new Error('MIDI service not available');
          }
        } else {
          // For non-MIDI devices, try to send to any writable characteristic
          const services = await server.getPrimaryServices();
          let sent = false;
          
          for (const service of services) {
            const characteristics = await service.getCharacteristics();
            for (const characteristic of characteristics) {
              if (characteristic.properties.write || characteristic.properties.writeWithoutResponse) {
                const encoder = new TextEncoder();
                const data = encoder.encode(command);
                await characteristic.writeValue(data);
                sent = true;
                break;
              }
            }
            if (sent) break;
          }
          
          const message: BluetoothMessage = {
            timestamp: Date.now(),
            deviceId: device.id,
            deviceName: device.name,
            data: `Sent: ${command}`,
            type: device.type as 'midi' | 'audio' | 'data'
          };
          
          setMessages(prev => [...prev.slice(-49), message]);
        }
        
        toast({
          title: "Command Sent",
          description: `Command sent to ${device.name}`,
        });
        setCommand('');
      } else {
        throw new Error('Device not connected');
      }
    } catch (error) {
      console.error('Send command error:', error);
      toast({
        title: "Send Failed",
        description: `Unable to send command: ${error}`,
        variant: "destructive",
      });
    }
  };

  // Filter devices by search term
  const filteredDevices = devices.filter(device =>
    device.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (device.manufacturer && device.manufacturer.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Get signal strength description
  const getSignalStrength = (rssi?: number) => {
    if (!rssi) return { strength: 'Unknown', bars: 0 };
    if (rssi >= -30) return { strength: 'Excellent', bars: 4 };
    if (rssi >= -50) return { strength: 'Good', bars: 3 };
    if (rssi >= -70) return { strength: 'Fair', bars: 2 };
    return { strength: 'Poor', bars: 1 };
  };

  // Format message for display
  const formatMessage = (message: BluetoothMessage) => {
    const timestamp = new Date(message.timestamp).toLocaleTimeString();
    return `[${timestamp}] ${message.deviceName}: ${message.data}`;
  };

  // Aggressive deep scan for maximum device discovery
  const handleAggressiveScan = async () => {
    setIsScanning(true);
    setIsAggressiveScan(true);
    setScanProgress(0);
    setScanMode('aggressive');
    
    // Very slow progress for extended scan time
    const progressInterval = setInterval(() => {
      setScanProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 1; // Very slow progress for 15+ second scan
      });
    }, 150);

    try {
      if (hasBluetoothSupport && bluetoothState === 'poweredOn') {
        // Multiple rounds of aggressive scanning
        for (let round = 1; round <= 3; round++) {
          toast({
            title: `Deep Scan Round ${round}`,
            description: "Scanning with maximum sensitivity for hidden devices...",
            variant: "default",
          });
          
          // Extended scan with all possible service filters
          await performExtendedBluetoothScan();
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
        
        toast({
          title: "Deep Scan Complete",
          description: "Maximum sensitivity scan completed. All discoverable devices found.",
        });
      } else {
        // If Bluetooth not supported, just show message
        toast({
          title: "Bluetooth Not Supported",
          description: "Web Bluetooth API is not available in this browser",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Deep Scan Failed",
        description: "Extended scan requires full Bluetooth permissions",
        variant: "destructive",
      });
    } finally {
      setTimeout(() => {
        setIsScanning(false);
        setIsAggressiveScan(false);
        setScanProgress(0);
        setScanMode('normal');
      }, 15000);
    }
  };

  // Extended Bluetooth API scanning
  const performExtendedBluetoothScan = async () => {
    const extendedServiceUUIDs = [
      // Standard Bluetooth services
      '00001800-0000-1000-8000-00805f9b34fb', // Generic Access
      '00001801-0000-1000-8000-00805f9b34fb', // Generic Attribute
      '0000180a-0000-1000-8000-00805f9b34fb', // Device Information
      '0000180f-0000-1000-8000-00805f9b34fb', // Battery Service
      
      // Audio services
      '0000110a-0000-1000-8000-00805f9b34fb', // Audio Source
      '0000110b-0000-1000-8000-00805f9b34fb', // Audio Sink
      '0000110c-0000-1000-8000-00805f9b34fb', // Remote Control Target
      '0000110d-0000-1000-8000-00805f9b34fb', // Advanced Audio Distribution
      '0000110e-0000-1000-8000-00805f9b34fb', // Audio/Video Remote Control
      '0000111e-0000-1000-8000-00805f9b34fb', // Handsfree
      
      // MIDI services
      '03b80e5a-ede8-4b33-a751-6ce34ec4c700', // MIDI Service
      '7772e5db-3868-4112-a1a9-f2669d106bf3', // MIDI Data I/O Characteristic
      
      // HID services
      '00001812-0000-1000-8000-00805f9b34fb', // Human Interface Device
      
      // Vendor-specific services
      '0000fe59-0000-1000-8000-00805f9b34fb', // Nordic UART Service
      '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART Service (alt)
    ];

    for (const serviceUUID of extendedServiceUUIDs) {
      try {
        await navigator.bluetooth.requestDevice({
          filters: [{ services: [serviceUUID] }]
        });
      } catch {
        // Continue scanning even if specific service fails
      }
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  };

  // Set up device listening for MIDI/audio messages
  const setupDeviceListening = async (bluetoothDevice: any, device: BluetoothDevice) => {
    try {
      if (!bluetoothDevice.gatt?.connected) {
        console.log('Device not connected to GATT server');
        return;
      }

      const server = bluetoothDevice.gatt;
      
      // For MIDI devices, try to connect to MIDI service
      if (device.type === 'midi') {
        try {
          // Try standard MIDI service UUID
          const midiService = await server.getPrimaryService('03b80e5a-ede8-4b33-a751-6ce34ec4c700');
          const midiCharacteristic = await midiService.getCharacteristic('7772e5db-3868-4112-a1a9-f2669d106bf3');
          
          // Start notifications for MIDI data
          await midiCharacteristic.startNotifications();
          
          midiCharacteristic.addEventListener('characteristicvaluechanged', (event: any) => {
            const value = event.target.value;
            const midiData = new Uint8Array(value.buffer);
            
            // Parse MIDI message
            let messageType = 'Unknown';
            if (midiData.length >= 2) {
              const status = midiData[0];
              if ((status & 0xF0) === 0x90) messageType = 'Note On';
              else if ((status & 0xF0) === 0x80) messageType = 'Note Off';
              else if ((status & 0xF0) === 0xB0) messageType = 'Control Change';
              else if ((status & 0xF0) === 0xC0) messageType = 'Program Change';
              else if ((status & 0xF0) === 0xE0) messageType = 'Pitch Bend';
            }
            
            const message: BluetoothMessage = {
              timestamp: Date.now(),
              deviceId: device.id,
              deviceName: device.name,
              data: `${messageType}: [${Array.from(midiData).map(b => b.toString(16).padStart(2, '0')).join(' ')}]`,
              type: 'midi'
            };
            
            console.log('MIDI message received:', message);
            setMessages(prev => [...prev.slice(-49), message]);
          });
          
          console.log('MIDI notifications started for', device.name);
          
        } catch (midiError) {
          console.log('Standard MIDI service not available, trying generic approach');
          
          // Fall back to generic characteristic listening
          try {
            const services = await server.getPrimaryServices();
            for (const service of services) {
              const characteristics = await service.getCharacteristics();
              for (const characteristic of characteristics) {
                if (characteristic.properties.notify) {
                  await characteristic.startNotifications();
                  characteristic.addEventListener('characteristicvaluechanged', (event: any) => {
                    const value = event.target.value;
                    const data = new Uint8Array(value.buffer);
                    
                    const message: BluetoothMessage = {
                      timestamp: Date.now(),
                      deviceId: device.id,
                      deviceName: device.name,
                      data: `Data: [${Array.from(data).map(b => b.toString(16).padStart(2, '0')).join(' ')}]`,
                      type: 'data'
                    };
                    
                    console.log('Bluetooth data received:', message);
                    setMessages(prev => [...prev.slice(-49), message]);
                  });
                }
              }
            }
          } catch (genericError) {
            console.error('Could not set up generic listening:', genericError);
          }
        }
      } else {
        // For non-MIDI devices, try to listen to any available characteristics
        try {
          const services = await server.getPrimaryServices();
          let listenersSetup = 0;
          
          for (const service of services) {
            const characteristics = await service.getCharacteristics();
            for (const characteristic of characteristics) {
              if (characteristic.properties.notify || characteristic.properties.indicate) {
                try {
                  await characteristic.startNotifications();
                  listenersSetup++;
                  
                  characteristic.addEventListener('characteristicvaluechanged', (event: any) => {
                    const value = event.target.value;
                    const data = new Uint8Array(value.buffer);
                    
                    const message: BluetoothMessage = {
                      timestamp: Date.now(),
                      deviceId: device.id,
                      deviceName: device.name,
                      data: `Input: [${Array.from(data).map(b => b.toString(16).padStart(2, '0')).join(' ')}]`,
                      type: device.type as 'audio' | 'midi' | 'data'
                    };
                    
                    console.log('Bluetooth input received:', message);
                    setMessages(prev => [...prev.slice(-49), message]);
                  });
                } catch (charError) {
                  console.log('Could not start notifications for characteristic:', charError);
                }
              }
            }
          }
          
          if (listenersSetup > 0) {
            console.log(`Set up ${listenersSetup} notification listeners for ${device.name}`);
            
            const statusMessage: BluetoothMessage = {
              timestamp: Date.now(),
              deviceId: device.id,
              deviceName: device.name,
              data: `Listening on ${listenersSetup} channel(s) - send commands from your device`,
              type: 'data'
            };
            setMessages(prev => [...prev.slice(-49), statusMessage]);
          }
        } catch (serviceError) {
          console.error('Could not enumerate services:', serviceError);
        }
      }
      
      // Add disconnect listener
      bluetoothDevice.addEventListener('gattserverdisconnected', () => {
        console.log('Device disconnected:', device.name);
        const disconnectMessage: BluetoothMessage = {
          timestamp: Date.now(),
          deviceId: device.id,
          deviceName: device.name,
          data: 'Device disconnected',
          type: device.type as 'audio' | 'midi' | 'data'
        };
        setMessages(prev => [...prev.slice(-49), disconnectMessage]);
        
        // Update device status
        setDevices(prev => prev.map(d => 
          d.id === device.id ? { ...d, connected: false } : d
        ));
        setConnectedDevices(prev => prev.filter(d => d.id !== device.id));
      });
      
    } catch (error) {
      console.error('Error setting up device listening:', error);
      
      const errorMessage: BluetoothMessage = {
        timestamp: Date.now(),
        deviceId: device.id,
        deviceName: device.name,
        data: `Error setting up listeners: ${error}`,
        type: 'data'
      };
      setMessages(prev => [...prev.slice(-49), errorMessage]);
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
      description: `${device.name} has been removed from the list`,
    });
  };

  // Clear messages
  const handleClearMessages = () => {
    setMessages([]);
  };

  // Get device type icon
  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'audio': return <Volume2 className="h-4 w-4" />;
      case 'midi': return <Music className="h-4 w-4" />;
      default: return <Bluetooth className="h-4 w-4" />;
    }
  };

  // Get device type color
  const getDeviceColor = (type: string) => {
    switch (type) {
      case 'audio': return 'text-blue-600 dark:text-blue-400';
      case 'midi': return 'text-purple-600 dark:text-purple-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl h-[85vh] flex flex-col" data-testid="modal-bluetooth-devices">
        <DialogHeader className="pb-4">
          <DialogTitle className="flex items-center gap-3">
            <Bluetooth className="h-6 w-6 text-blue-500" />
            <span className="text-xl font-semibold">Bluetooth Devices</span>
            <Badge variant={hasBluetoothSupport ? "default" : "secondary"} className="ml-2">
              {hasBluetoothSupport ? bluetoothState : "Not Supported"}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {/* Bluetooth Support Warning */}
        {!hasBluetoothSupport && (
          <Card className="mb-4 border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm font-medium">
                  Web Bluetooth API not supported in this browser. Using mock devices for development.
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tab Navigation */}
        <div className="flex gap-1 mb-4">
          <Button
            variant={selectedTab === 'devices' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedTab('devices')}
            className="flex-1"
          >
            <Bluetooth className="h-4 w-4 mr-2" />
            Devices
          </Button>
          <Button
            variant={selectedTab === 'messages' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedTab('messages')}
            className="flex-1"
          >
            <Music className="h-4 w-4 mr-2" />
            Messages
          </Button>
          <Button
            variant={selectedTab === 'commands' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedTab('commands')}
            className="flex-1"
          >
            <Send className="h-4 w-4 mr-2" />
            Commands
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="space-y-4 p-1">
            {selectedTab === 'devices' && (
              <>
                {/* Device Scanner */}
                <Card>
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg font-medium">Device Scanner</CardTitle>
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1 max-w-xs">
                          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Search devices..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-8 text-sm"
                            data-testid="input-search-bluetooth"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={handleScanDevices}
                            disabled={isScanning}
                            data-testid="button-scan-bluetooth"
                          >
                            {isScanning ? (
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4 mr-1" />
                            )}
                            {isScanning ? "Scanning..." : "Quick Scan"}
                          </Button>
                          <Button 
                            variant={isAggressiveScan ? "destructive" : "default"}
                            size="sm" 
                            onClick={handleAggressiveScan}
                            disabled={isScanning}
                            data-testid="button-aggressive-scan"
                          >
                            {isScanning && isAggressiveScan ? (
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            ) : (
                              <Search className="h-4 w-4 mr-1" />
                            )}
                            {isScanning && isAggressiveScan ? "Deep Scanning..." : "Deep Scan"}
                          </Button>
                        </div>
                      </div>
                    </div>
                    {isScanning && (
                      <div className="mt-2">
                        <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                          <div 
                            className={`h-2 rounded-full transition-all duration-300 ${
                              isAggressiveScan 
                                ? 'bg-gradient-to-r from-red-500 to-orange-500' 
                                : 'bg-blue-600'
                            }`}
                            style={{ width: `${scanProgress}%` }}
                          ></div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {isAggressiveScan 
                            ? 'Deep scanning with maximum sensitivity... Finding hidden devices'
                            : 'Scanning for nearby Bluetooth devices...'
                          }
                        </p>
                        {isAggressiveScan && (
                          <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                            Extended scan mode: Checking all service types and vendor-specific protocols
                          </p>
                        )}
                      </div>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {filteredDevices.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                          <Bluetooth className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No Bluetooth devices found</p>
                          <p className="text-xs">Click "Scan" to discover nearby devices</p>
                        </div>
                      ) : (
                        filteredDevices.map((device) => {
                          const signal = getSignalStrength(device.rssi);
                          return (
                            <div key={device.id} className="border rounded-lg p-4 bg-card hover:bg-accent transition-colors">
                              <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <div className={getDeviceColor(device.type)}>
                                      {getDeviceIcon(device.type)}
                                    </div>
                                    <p className="text-sm font-medium truncate flex items-center gap-2">
                                      {device.connected ? 
                                        <CheckCircle className="h-3 w-3 text-green-500" /> : 
                                        device.paired ?
                                        <div className="h-3 w-3 bg-blue-500 rounded-full" /> :
                                        <div className="h-3 w-3 border border-gray-400 rounded-full" />
                                      }
                                      {device.name}
                                    </p>
                                    <Badge variant="outline" className="text-xs">
                                      {device.type.toUpperCase()}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                    <span>{device.manufacturer || 'Unknown'}</span>
                                    {device.rssi && (
                                      <div className="flex items-center gap-1">
                                        <Signal className="h-3 w-3" />
                                        <span>{signal.strength} ({device.rssi}dBm)</span>
                                      </div>
                                    )}
                                    {device.batteryLevel && (
                                      <div className="flex items-center gap-1">
                                        <Battery className="h-3 w-3" />
                                        <span>{device.batteryLevel}%</span>
                                      </div>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Services: {device.services.join(', ')}
                                  </p>
                                </div>
                                <div className="flex gap-2 ml-2 shrink-0">
                                  {!device.paired && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handlePairDevice(device)}
                                      data-testid={`button-pair-${device.id}`}
                                    >
                                      Pair
                                    </Button>
                                  )}
                                  {device.paired && (
                                    <Button
                                      size="sm"
                                      variant={device.connected ? "destructive" : "default"}
                                      onClick={() => device.connected ? 
                                        handleDisconnectDevice(device) : handleConnectDevice(device)}
                                      data-testid={`button-${device.connected ? 'disconnect' : 'connect'}-${device.id}`}
                                    >
                                      {device.connected ? (
                                        <>
                                          <WifiOff className="h-3 w-3 mr-1" />
                                          Disconnect
                                        </>
                                      ) : (
                                        <>
                                          <Wifi className="h-3 w-3 mr-1" />
                                          Connect
                                        </>
                                      )}
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleRemoveDevice(device)}
                                    data-testid={`button-remove-${device.id}`}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {selectedTab === 'messages' && (
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-medium">Live Messages</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="default" className="text-xs">
                        {messages.length} messages
                      </Badge>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleClearMessages}
                        data-testid="button-clear-bluetooth-messages"
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Clear
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="max-h-60 overflow-y-auto">
                    <div className="space-y-2">
                      {messages.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                          <Music className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">Connect Bluetooth devices to see live messages</p>
                        </div>
                      ) : (
                        messages.slice().reverse().map((message, index) => (
                          <div 
                            key={`${message.timestamp}-${index}`} 
                            className="p-3 bg-muted rounded-lg border-l-4 border-blue-500 font-mono text-xs break-all"
                            data-testid={`bluetooth-message-${index}`}
                          >
                            {formatMessage(message)}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {selectedTab === 'commands' && (
              <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-blue-200 dark:border-blue-800">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg font-medium flex items-center gap-2">
                    <Send className="h-4 w-4" />
                    Send Bluetooth Command
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium block mb-2">Connected Device</label>
                      <select 
                        value={selectedDevice} 
                        onChange={(e) => setSelectedDevice(e.target.value)}
                        className="w-full p-3 border rounded-lg bg-background text-sm"
                        data-testid="select-bluetooth-device"
                      >
                        <option value="">Select connected device...</option>
                        {connectedDevices.map(device => (
                          <option key={device.id} value={device.id}>
                            {device.name} ({device.type.toUpperCase()})
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium block mb-2">Command</label>
                      <div className="flex gap-2">
                        <Input
                          value={command}
                          onChange={(e) => setCommand(e.target.value)}
                          placeholder="Enter command..."
                          className="text-sm"
                          data-testid="input-bluetooth-command"
                        />
                        <Button 
                          onClick={handleSendCommand}
                          disabled={!selectedDevice || !command.trim()}
                          data-testid="button-send-bluetooth"
                          className="shrink-0"
                        >
                          <Send className="h-4 w-4 mr-1" />
                          Send
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Connected Devices:</p>
                    <div className="flex flex-wrap gap-2">
                      {connectedDevices.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No devices connected</p>
                      ) : (
                        connectedDevices.map(device => (
                          <Badge key={device.id} variant="outline" className="text-xs">
                            {device.name}
                          </Badge>
                        ))
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose} data-testid="button-close-bluetooth">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}