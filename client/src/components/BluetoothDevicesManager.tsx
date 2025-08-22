import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { 
  Bluetooth, 
  Search, 
  Wifi, 
  WifiOff, 
  Music, 
  Trash2, 
  AlertCircle, 
  Send,
  Volume2,
  RotateCcw
} from 'lucide-react';

// Types
interface BluetoothDevice {
  id: string;
  name: string;
  type: 'midi' | 'bluetooth' | 'unknown';
  connected: boolean;
  paired: boolean;
  rssi?: number;
  deviceClass: string;
  services: string[];
  lastSeen: number;
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

  // Check Bluetooth state periodically
  useEffect(() => {
    if (!hasBluetoothSupport) return;

    const checkState = async () => {
      try {
        const available = await (navigator as any).bluetooth.getAvailability();
        setBluetoothState(available ? 'poweredOn' : 'poweredOff');
      } catch (error) {
        setBluetoothState('error');
      }
    };

    const interval = setInterval(checkState, 5000);
    return () => clearInterval(interval);
  }, [hasBluetoothSupport]);

  // Auto-refresh device last seen times
  useEffect(() => {
    if (devices.length === 0) return;

    const interval = setInterval(() => {
      setDevices(prev => prev.map(device => ({ ...device })));
    }, 1000);

    return () => clearInterval(interval);
  }, [devices.length]);

  // Determine if device is a MIDI device
  const determineDeviceType = (device: any): 'midi' | 'bluetooth' | 'unknown' => {
    const name = device.name?.toLowerCase() || '';
    
    // Check for MIDI-specific keywords
    if (name.includes('midi') || name.includes('keyboard') || name.includes('controller') ||
        name.includes('yamaha') || name.includes('korg') || name.includes('roland') ||
        name.includes('akai') || name.includes('novation') || name.includes('arturia') ||
        name.includes('m-audio') || name.includes('behringer') || name.includes('moog') ||
        name.includes('sequential') || name.includes('dave smith') || name.includes('elektron') ||
        name.includes('pedal') || name.includes('footswitch')) {
      return 'midi';
    }
    
    // If it has a name and doesn't match MIDI keywords, it's a generic Bluetooth device
    if (name && name.trim() !== '') {
      return 'bluetooth';
    }
    
    return 'unknown';
  };

  // Scan for devices
  const handleScanDevices = async () => {
    if (!hasBluetoothSupport || bluetoothState !== 'poweredOn') {
      toast({
        title: "Bluetooth Unavailable",
        description: "Bluetooth is not available or not powered on.",
        variant: "destructive",
      });
      return;
    }

    setIsScanning(true);
    const discoveredDevices: BluetoothDevice[] = [];

    try {
      if (hasBluetoothSupport && bluetoothState === 'poweredOn') {
        // Try to scan for devices with different service filters
        const serviceFilters = [
          // MIDI devices - primary focus
          { services: ['03b80e5a-ede8-4b33-a751-6ce34ec4c700'] }, // MIDI Service
          
          // MIDI over BLE characteristics
          { services: ['7772e5db-3868-4112-a1a9-f2669d106bf3'] }, // MIDI Data I/O
          
          // Generic discoverable devices (filtered for MIDI devices only)
          { acceptAllDevices: true }
        ];

        for (const filter of serviceFilters) {
          try {
            const device = await (navigator as any).bluetooth.requestDevice(filter);
            
            if (device && !discoveredDevices.some(d => d.id === device.id)) {
              const deviceType = determineDeviceType(device);
              
              // Add all discovered devices (MIDI, bluetooth, and unknown)
              let deviceClass = 'Bluetooth Device';
              if (deviceType === 'midi') {
                deviceClass = 'MIDI Controller';
              } else if (deviceType === 'bluetooth') {
                deviceClass = 'Bluetooth Device';
              } else {
                deviceClass = 'Unknown Device';
              }
              
              const newDevice: BluetoothDevice = {
                id: device.id,
                name: device.name || 'Unknown Device',
                type: deviceType,
                connected: false,
                paired: false,
                rssi: -50, // Web Bluetooth doesn't provide RSSI during scan
                deviceClass: deviceClass,
                services: [], // Services will be populated when connected
                lastSeen: Date.now()
              };
              
              discoveredDevices.push(newDevice);
            }
          } catch (filterError) {
            console.log('Service filter failed:', filterError);
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
            
            // Sort devices: MIDI devices first, then Bluetooth devices, then unknown
            const sorted = updated.sort((a, b) => {
              if (a.type === 'midi' && b.type !== 'midi') return -1;
              if (a.type !== 'midi' && b.type === 'midi') return 1;
              if (a.type === 'bluetooth' && b.type === 'unknown') return -1;
              if (a.type === 'unknown' && b.type === 'bluetooth') return 1;
              return a.name.localeCompare(b.name);
            });
            
            saveDevicesToStorage(sorted);
            return sorted;
          });
          
          const midiCount = discoveredDevices.filter(d => d.type === 'midi').length;
          const bluetoothCount = discoveredDevices.filter(d => d.type === 'bluetooth').length;
          
          toast({
            title: "Bluetooth Scan Complete",
            description: `Found ${midiCount} MIDI device(s) and ${bluetoothCount} other Bluetooth device(s)`,
          });
        } else {
          toast({
            title: "Bluetooth Scan Complete",
            description: "No Bluetooth devices found. Make sure devices are in pairing mode.",
          });
        }
      }
    } catch (error) {
      console.error('Error scanning for devices:', error);
      toast({
        title: "Scan Failed",
        description: `Failed to scan for MIDI devices: ${error}`,
        variant: "destructive",
      });
    } finally {
      setIsScanning(false);
    }
  };

  // Deep scan with extended timeout
  const handleDeepScan = async () => {
    if (!hasBluetoothSupport || bluetoothState !== 'poweredOn') {
      toast({
        title: "Bluetooth Unavailable",
        description: "Bluetooth is not available or not powered on.",
        variant: "destructive",
      });
      return;
    }

    setIsScanning(true);
    
    try {
      toast({
        title: "Deep Bluetooth Scan Started",
        description: "Performing aggressive scan for all Bluetooth devices...",
      });

      // Multiple scan attempts with different strategies
      for (let attempt = 1; attempt <= 3; attempt++) {
        console.log(`Deep scan attempt ${attempt}`);
        
        try {
          const device = await (navigator as any).bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: ['03b80e5a-ede8-4b33-a751-6ce34ec4c700', '7772e5db-3868-4112-a1a9-f2669d106bf3']
          });
          
          if (device) {
            const deviceType = determineDeviceType(device);
            
            if (!devices.some(d => d.id === device.id)) {
              // Add all devices during deep scan
              let deviceClass = 'Bluetooth Device';
              if (deviceType === 'midi') {
                deviceClass = 'MIDI Controller';
              } else if (deviceType === 'bluetooth') {
                deviceClass = 'Bluetooth Device';
              } else {
                deviceClass = 'Unknown Device';
              }
              
              const newDevice: BluetoothDevice = {
                id: device.id,
                name: device.name || `Device ${attempt}`,
                type: deviceType,
                connected: false,
                paired: false,
                rssi: -40,
                deviceClass: deviceClass,
                services: [],
                lastSeen: Date.now()
              };
              
              setDevices(prev => {
                const updated = [...prev, newDevice];
                
                // Sort devices: MIDI devices first, then Bluetooth devices, then unknown
                const sorted = updated.sort((a, b) => {
                  if (a.type === 'midi' && b.type !== 'midi') return -1;
                  if (a.type !== 'midi' && b.type === 'midi') return 1;
                  if (a.type === 'bluetooth' && b.type === 'unknown') return -1;
                  if (a.type === 'unknown' && b.type === 'bluetooth') return 1;
                  return a.name.localeCompare(b.name);
                });
                
                saveDevicesToStorage(sorted);
                return sorted;
              });
              
              const deviceTypeLabel = deviceType === 'midi' ? 'MIDI device' : 'Bluetooth device';
              toast({
                title: "Device Found",
                description: `Found: ${newDevice.name} (${deviceTypeLabel})`,
              });
              break;
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
      if (!bluetoothDevice.gatt?.connected) {
        console.log('Device not connected to GATT server');
        const errorMsg: BluetoothMessage = {
          timestamp: Date.now(),
          deviceId: device.id,
          deviceName: device.name,
          data: 'ERROR: Device not connected to GATT server',
          type: 'midi'
        };
        setMessages(prev => [...prev.slice(-49), errorMsg]);
        return;
      }

      const server = bluetoothDevice.gatt;
      
      // Try to connect to MIDI service
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
          
          // Flash green light for incoming MIDI data
          setIncomingDataActive(true);
          setTimeout(() => setIncomingDataActive(false), 300);
        });
        
        console.log('MIDI characteristic notifications started successfully');
        
        const successMessage: BluetoothMessage = {
          timestamp: Date.now(),
          deviceId: device.id,
          deviceName: device.name,
          data: 'MIDI listening activated - MIDI messages will appear here',
          type: 'midi'
        };
        setMessages(prev => [...prev.slice(-49), successMessage]);
        
      } catch (midiError) {
        console.error('Standard MIDI service not available, trying fallback:', midiError);
        
        const fallbackMessage: BluetoothMessage = {
          timestamp: Date.now(),
          deviceId: device.id,
          deviceName: device.name,
          data: 'Standard MIDI service not found, scanning all characteristics...',
          type: 'midi'
        };
        setMessages(prev => [...prev.slice(-49), fallbackMessage]);
        
        // Fallback: scan all services and characteristics for any that support notifications
        try {
          const services = await server.getPrimaryServices();
          let notifyCharacteristics = 0;
          let totalCharacteristics = 0;
          
          console.log(`Found ${services.length} services to scan`);
          
          for (const service of services) {
            console.log('Scanning service:', service.uuid);
            const characteristics = await service.getCharacteristics();
            totalCharacteristics += characteristics.length;
            
            for (const characteristic of characteristics) {
              console.log('Characteristic:', characteristic.uuid, 'Properties:', characteristic.properties);
              
              if (characteristic.properties.notify || characteristic.properties.indicate) {
                try {
                  await characteristic.startNotifications();
                  notifyCharacteristics++;
                  
                  console.log('Started notifications for:', characteristic.uuid);
                  
                  characteristic.addEventListener('characteristicvaluechanged', (event: any) => {
                    const value = event.target.value;
                    const data = new Uint8Array(value.buffer);
                    
                    // Parse as MIDI data
                    let messageType = 'MIDI Data';
                    if (data.length >= 2) {
                      const status = data[0];
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
                      data: `${messageType}: [${Array.from(data).map(b => b.toString(16).padStart(2, '0')).join(' ')}]`,
                      type: 'midi'
                    };
                    
                    console.log('MIDI data received from fallback:', message);
                    setMessages(prev => [...prev.slice(-49), message]);
                    
                    // Flash green light for incoming MIDI data
                    setIncomingDataActive(true);
                    setTimeout(() => setIncomingDataActive(false), 300);
                  });
                } catch (charError) {
                  console.log('Could not start notifications for characteristic:', charError);
                }
              }
            }
          }
          
          const summaryMsg: BluetoothMessage = {
            timestamp: Date.now(),
            deviceId: device.id,
            deviceName: device.name,
            data: `Setup complete: ${totalCharacteristics} total characteristics, ${notifyCharacteristics} with notifications enabled`,
            type: 'midi'
          };
          setMessages(prev => [...prev.slice(-49), summaryMsg]);
          
        } catch (genericError) {
          console.error('Could not set up generic listening:', genericError);
          
          const errorMsg: BluetoothMessage = {
            timestamp: Date.now(),
            deviceId: device.id,
            deviceName: device.name,
            data: `ERROR: Could not set up listeners: ${genericError}`,
            type: 'midi'
          };
          setMessages(prev => [...prev.slice(-49), errorMsg]);
        }
      }
      
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

  // Send command to device
  const handleSendCommand = async (device: BluetoothDevice, command: string) => {
    try {
      console.log(`Sending command to ${device.name}:`, command);
      
      // Flash blue light for outgoing data
      setOutgoingDataActive(true);
      setTimeout(() => setOutgoingDataActive(false), 300);
      
      const message: BluetoothMessage = {
        timestamp: Date.now(),
        deviceId: device.id,
        deviceName: device.name,
        data: `Sent: ${command}`,
        type: 'midi'
      };
      setMessages(prev => [...prev.slice(-49), message]);
      
      toast({
        title: "Command Sent",
        description: `Sent "${command}" to ${device.name}`,
      });
    } catch (error) {
      toast({
        title: "Command Failed",
        description: `Failed to send command: ${error}`,
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
        return 'text-gray-600 dark:text-gray-400'; // Gray for unknown devices
    }
  };

  // Format timestamp
  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl h-[85vh] flex flex-col" data-testid="modal-bluetooth-devices">
        <DialogHeader className="pb-4">
          <DialogTitle className="flex items-center gap-3">
            <Bluetooth className="h-6 w-6 text-blue-500" />
            <span className="text-xl font-semibold">Bluetooth MIDI Devices</span>
            <Badge variant={hasBluetoothSupport ? "default" : "secondary"} className="ml-2">
              {hasBluetoothSupport ? bluetoothState : "Not Supported"}
            </Badge>
            
            {/* Data Flow Indicators */}
            <div className="flex items-center gap-2 ml-4">
              <div className="flex items-center gap-1">
                <div 
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${
                    incomingDataActive 
                      ? 'bg-green-500 shadow-lg shadow-green-500/50 animate-pulse' 
                      : 'bg-green-200 dark:bg-green-800'
                  }`}
                  title="Incoming Data"
                />
                <span className="text-xs text-muted-foreground">IN</span>
              </div>
              <div className="flex items-center gap-1">
                <div 
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${
                    outgoingDataActive 
                      ? 'bg-blue-500 shadow-lg shadow-blue-500/50 animate-pulse' 
                      : 'bg-blue-200 dark:bg-blue-800'
                  }`}
                  title="Outgoing Data"
                />
                <span className="text-xs text-muted-foreground">OUT</span>
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        {!hasBluetoothSupport && (
          <Card className="mb-4 border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm font-medium">
                  Web Bluetooth API not supported in this browser. MIDI device connectivity unavailable.
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-4">
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
            MIDI Messages
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

        {/* Devices Tab */}
        {selectedTab === 'devices' && (
          <div className="flex-1 flex flex-col gap-4">
            {/* Scan Controls */}
            <div className="flex gap-2">
              <Button 
                onClick={handleScanDevices}
                disabled={isScanning || !hasBluetoothSupport || bluetoothState !== 'poweredOn'}
                className="flex-1"
                data-testid="button-scan-devices"
              >
                <Search className="h-4 w-4 mr-2" />
                {isScanning ? 'Scanning...' : 'Quick Scan'}
              </Button>
              <Button 
                variant="outline"
                onClick={handleDeepScan}
                disabled={isScanning || !hasBluetoothSupport || bluetoothState !== 'poweredOn'}
                className="flex-1"
                data-testid="button-deep-scan"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                {isScanning ? 'Scanning...' : 'Deep Scan'}
              </Button>
            </div>

            {/* Device List */}
            <ScrollArea className="flex-1">
              <div className="space-y-3">
                {devices.length === 0 ? (
                  <Card className="p-8 text-center">
                    <Bluetooth className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-medium text-muted-foreground mb-2">No Bluetooth Devices Found</h3>
                    <p className="text-sm text-muted-foreground">
                      Click "Quick Scan" or "Deep Scan" to discover Bluetooth devices
                    </p>
                  </Card>
                ) : (
                  devices.map((device) => (
                    <Card key={device.id} className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={getDeviceColor(device.type)}>
                            {getDeviceIcon(device.type)}
                          </div>
                          <div>
                            <h3 className="font-medium">{device.name}</h3>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <span>{device.deviceClass}</span>
                              {device.connected ? (
                                <Badge variant="default" className="bg-green-500">
                                  <Wifi className="h-3 w-3 mr-1" />
                                  Connected
                                </Badge>
                              ) : (
                                <Badge variant="secondary">
                                  <WifiOff className="h-3 w-3 mr-1" />
                                  Disconnected
                                </Badge>
                              )}
                              {device.rssi && (
                                <span>RSSI: {device.rssi}dBm</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {device.connected ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDisconnectDevice(device)}
                              data-testid={`button-disconnect-${device.id}`}
                            >
                              <WifiOff className="h-4 w-4 mr-2" />
                              Disconnect
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleConnectDevice(device)}
                              disabled={!hasBluetoothSupport}
                              data-testid={`button-connect-${device.id}`}
                            >
                              <Wifi className="h-4 w-4 mr-2" />
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
          </div>
        )}

        {/* Messages Tab */}
        {selectedTab === 'messages' && (
          <div className="flex-1 flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">MIDI Messages</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearMessages}
                data-testid="button-clear-messages"
              >
                Clear
              </Button>
            </div>
            
            <ScrollArea className="flex-1 border rounded p-4">
              <div className="space-y-2">
                {messages.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    <Music className="h-8 w-8 mx-auto mb-2" />
                    <p>No MIDI messages yet</p>
                    <p className="text-sm">Connect a MIDI device and start playing to see messages here</p>
                  </div>
                ) : (
                  messages.map((message, index) => (
                    <div key={index} className="flex gap-2 text-sm font-mono border-b pb-2">
                      <span className="text-muted-foreground text-xs w-20 flex-shrink-0">
                        {formatTimestamp(message.timestamp)}
                      </span>
                      <span className="text-blue-600 dark:text-blue-400 w-32 flex-shrink-0 truncate">
                        {message.deviceName}
                      </span>
                      <span className="flex-1">{message.data}</span>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Commands Tab */}
        {selectedTab === 'commands' && (
          <div className="flex-1 flex flex-col gap-4">
            <h3 className="text-lg font-semibold">Send MIDI Commands</h3>
            
            {connectedDevices.length === 0 ? (
              <Card className="p-8 text-center">
                <Send className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium text-muted-foreground mb-2">No Connected Devices</h3>
                <p className="text-sm text-muted-foreground">
                  Connect to a MIDI device to send commands
                </p>
              </Card>
            ) : (
              <div className="space-y-4">
                {connectedDevices.map((device) => (
                  <Card key={device.id} className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={getDeviceColor(device.type)}>
                        {getDeviceIcon(device.type)}
                      </div>
                      <h4 className="font-medium">{device.name}</h4>
                      <Badge variant="default" className="bg-green-500">Connected</Badge>
                    </div>
                    
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={commandInput}
                        onChange={(e) => setCommandInput(e.target.value)}
                        placeholder="Enter MIDI command (e.g., Note On, CC, etc.)"
                        className="flex-1 px-3 py-2 border rounded text-sm"
                        data-testid={`input-command-${device.id}`}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (commandInput.trim()) {
                            handleSendCommand(device, commandInput);
                            setCommandInput('');
                          }
                        }}
                        disabled={!commandInput.trim()}
                        data-testid={`button-send-command-${device.id}`}
                      >
                        <Send className="h-4 w-4 mr-2" />
                        Send
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}