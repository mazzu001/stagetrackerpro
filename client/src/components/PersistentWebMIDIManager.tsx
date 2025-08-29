import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Music, Volume2, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { useGlobalWebMIDI } from '@/hooks/useGlobalWebMIDI';

interface MIDIDevice {
  id: string;
  name: string;
  manufacturer: string;
  state: string;
  type: 'input' | 'output';
  connection: string;
  deviceType?: 'usb' | 'bluetooth' | 'other';
  lastSeen?: string;
  paired?: boolean;
}

export function PersistentWebMIDIManager() {
  const [testMessage, setTestMessage] = useState('[[PC:1:1]]');
  const [midiMessages, setMidiMessages] = useState<string[]>([]);
  const [lastSentMessage, setLastSentMessage] = useState('');
  const [availableOutputs, setAvailableOutputs] = useState<MIDIDevice[]>([]);
  const [offlineDevices, setOfflineDevices] = useState<MIDIDevice[]>([]);
  const [bluetoothDevices, setBluetoothDevices] = useState<MIDIDevice[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();
  
  const globalMidi = useGlobalWebMIDI();

  // Refresh available devices
  const refreshDevices = async () => {
    setIsRefreshing(true);
    try {
      await globalMidi.refreshDevices();
      const outputs = globalMidi.getAvailableOutputs();
      
      // Categorize devices and save previously connected ones
      const enhancedOutputs = outputs.map(device => {
        const deviceType = determineDeviceType(device.name, device.manufacturer);
        const enhanced = { ...device, deviceType, lastSeen: new Date().toISOString() };
        
        // Save device for offline tracking
        if (device.state === 'connected' || device.connection === 'open') {
          saveOfflineDevice(enhanced);
        }
        
        return enhanced;
      });
      
      // Separate USB and Bluetooth devices
      const usbDevices = enhancedOutputs.filter(d => d.deviceType === 'usb' || d.deviceType === 'other');
      const bluetoothMidiDevices = enhancedOutputs.filter(d => d.deviceType === 'bluetooth');
      
      setAvailableOutputs(usbDevices);
      setBluetoothDevices(bluetoothMidiDevices);
      
      console.log('🔄 Refreshed MIDI devices:', outputs.length, 'total -', usbDevices.length, 'USB,', bluetoothMidiDevices.length, 'Bluetooth');
    } catch (error) {
      console.error('❌ Failed to refresh devices:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Determine device type
  const determineDeviceType = (name: string, manufacturer: string): 'usb' | 'bluetooth' | 'other' => {
    const nameLower = name.toLowerCase();
    const mfgLower = manufacturer.toLowerCase();
    
    if (nameLower.includes('bluetooth') || nameLower.includes('ble') || 
        nameLower.includes('wireless') || nameLower.includes('widi') ||
        mfgLower.includes('bluetooth')) {
      return 'bluetooth';
    }
    
    if (nameLower.includes('usb') || mfgLower.includes('usb')) {
      return 'usb';
    }
    
    return 'other';
  };

  // Load stored offline devices
  const loadStoredDevices = () => {
    try {
      const storedDevices = localStorage.getItem('midi_offline_devices');
      if (storedDevices) {
        const parsedDevices = JSON.parse(storedDevices) as MIDIDevice[];
        setOfflineDevices(parsedDevices);
        console.log('📱 Loaded', parsedDevices.length, 'offline MIDI devices');
      } else {
        // Add sample offline devices to demonstrate the functionality
        const sampleDevices: MIDIDevice[] = [
          {
            id: 'offline-bluetooth-1',
            name: 'WIDI Master Bluetooth',
            manufacturer: 'CME',
            state: 'disconnected',
            type: 'output',
            connection: 'closed',
            deviceType: 'bluetooth',
            lastSeen: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
            paired: true
          },
          {
            id: 'offline-bluetooth-2', 
            name: 'Roland BT-1 Wireless',
            manufacturer: 'Roland',
            state: 'disconnected',
            type: 'output', 
            connection: 'closed',
            deviceType: 'bluetooth',
            lastSeen: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
            paired: true
          },
          {
            id: 'offline-usb-1',
            name: 'KeyLab Essential 88',
            manufacturer: 'Arturia',
            state: 'disconnected', 
            type: 'output',
            connection: 'closed',
            deviceType: 'usb',
            lastSeen: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
            paired: true
          }
        ];
        setOfflineDevices(sampleDevices);
        localStorage.setItem('midi_offline_devices', JSON.stringify(sampleDevices));
        console.log('📱 Created sample offline devices to demonstrate functionality');
      }
    } catch (error) {
      console.error('❌ Error loading offline devices:', error);
    }
  };

  // Save device to offline storage
  const saveOfflineDevice = (device: MIDIDevice) => {
    try {
      const storedDevices = localStorage.getItem('midi_offline_devices');
      let devices = storedDevices ? JSON.parse(storedDevices) : [];
      
      const existingIndex = devices.findIndex((d: MIDIDevice) => d.id === device.id);
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
      
      localStorage.setItem('midi_offline_devices', JSON.stringify(devices));
      console.log('💾 Saved offline device:', device.name);
    } catch (error) {
      console.error('❌ Error saving offline device:', error);
    }
  };

  // Get devices on mount and when global MIDI state changes
  useEffect(() => {
    // Load stored devices first
    loadStoredDevices();
    
    // Delay the initial refresh to prevent blocking
    const timer = setTimeout(() => {
      refreshDevices();
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  // Listen for global device changes
  useEffect(() => {
    const handleDeviceChange = () => {
      console.log('🔄 Device change detected, refreshing...');
      refreshDevices();
    };

    window.addEventListener('globalMidiDeviceChange', handleDeviceChange);
    return () => {
      window.removeEventListener('globalMidiDeviceChange', handleDeviceChange);
    };
  }, []);

  // Connect to output device
  const connectToOutput = async (deviceId: string) => {
    try {
      const success = await globalMidi.connectToDevice(deviceId);
      if (success) {
        toast({
          title: "Device Connected",
          description: "MIDI device connected successfully",
        });
        refreshDevices();
      } else {
        toast({
          title: "Connection Failed",
          description: "Failed to connect to MIDI device",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('❌ Failed to connect:', error);
      toast({
        title: "Connection Error",
        description: "An error occurred while connecting",
        variant: "destructive",
      });
    }
  };

  // Force connection attempt for offline Bluetooth devices
  const forceConnectToOfflineDevice = async (device: MIDIDevice) => {
    try {
      toast({
        title: "Attempting Connection",
        description: `Trying to connect to ${device.name}. Make sure Bluetooth is on and device is in pairing mode.`,
      });

      // First try to refresh devices to see if it's now available
      await refreshDevices();
      
      // Check if device appeared in the refresh
      const availableDevice = [...availableOutputs, ...bluetoothDevices].find(d => 
        d.name === device.name || d.id === device.id
      );
      
      if (availableDevice && availableDevice.state === 'connected') {
        // Device is now available, try to connect normally
        await connectToOutput(availableDevice.id);
      } else {
        // Try Web Bluetooth API for Bluetooth devices
        if (device.deviceType === 'bluetooth' && 'bluetooth' in navigator) {
          try {
            const bluetoothDevice = await (navigator as any).bluetooth.requestDevice({
              filters: [{ name: device.name }],
              optionalServices: [
                '03b80e5a-ede8-4b33-a751-6ce34ec4c700', // MIDI service
                'generic_access',
                'generic_attribute'
              ]
            });
            
            if (bluetoothDevice) {
              toast({
                title: "Device Found",
                description: `Found ${bluetoothDevice.name}. Connection will be handled by the system.`,
              });
              
              // Refresh devices again after potential pairing
              setTimeout(() => refreshDevices(), 2000);
            }
          } catch (bluetoothError) {
            console.log('Web Bluetooth connection attempt:', bluetoothError);
            toast({
              title: "Direct Connection Failed",
              description: `Could not connect directly to ${device.name}. Please ensure Bluetooth is on and the device is in pairing mode, then try 'Refresh All'.`,
              variant: "destructive",
            });
          }
        } else {
          toast({
            title: "Manual Connection Required",
            description: `Please turn on Bluetooth and ensure ${device.name} is paired in your system settings, then click 'Refresh All'.`,
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.error('❌ Force connection failed:', error);
      toast({
        title: "Connection Error",
        description: `Failed to connect to ${device.name}. Please check Bluetooth settings.`,
        variant: "destructive",
      });
    }
  };

  // Send MIDI command
  const sendMIDICommand = async () => {
    if (!globalMidi.isConnected) {
      toast({
        title: "No Device Connected",
        description: "Please connect to an output device first",
        variant: "destructive",
      });
      return;
    }

    if (!testMessage.trim()) {
      toast({
        title: "No Command",
        description: "Enter a MIDI command to send",
        variant: "destructive",
      });
      return;
    }

    try {
      const success = await globalMidi.sendCommand(testMessage);
      if (success) {
        setLastSentMessage(testMessage);
        
        const message = `📤 ${testMessage} (sent successfully)`;
        setMidiMessages(prev => [message, ...prev.slice(0, 9)]);
        
        console.log('✅ MIDI sent successfully:', testMessage);
        
        toast({
          title: "MIDI Sent",
          description: testMessage,
        });
      } else {
        toast({
          title: "Send Failed",
          description: "Failed to send MIDI command",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('❌ Failed to send MIDI:', error);
      toast({
        title: "Send Failed",
        description: "Failed to send MIDI command",
        variant: "destructive",
      });
    }
  };

  // Quick test buttons
  const quickCommands = [
    { label: 'PC 0', command: '[[PC:0:1]]' },
    { label: 'PC 12', command: '[[PC:12:1]]' },
    { label: 'Bank 0', command: '[[CC:0:0:1]]' },
    { label: 'Volume', command: '[[CC:7:100:1]]' },
  ];

  // Check Web MIDI support
  const isSupported = typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator;

  if (!isSupported) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <WifiOff className="h-5 w-5" />
            Web MIDI Not Supported
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p>Your browser does not support the Web MIDI API. Please use Chrome, Edge, or Opera.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Music className="h-5 w-5" />
          Persistent Web MIDI Manager
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Connection Status */}
        <div className="bg-muted/50 p-3 rounded-lg">
          <h4 className="font-medium mb-2">Connection Status</h4>
          <div className="flex items-center gap-2">
            {globalMidi.isConnected ? (
              <>
                <Wifi className="h-4 w-4 text-green-600" />
                <Badge variant="default">Connected: {globalMidi.deviceName}</Badge>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4 text-red-600" />
                <Badge variant="secondary">Not Connected</Badge>
              </>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            🔄 This connection persists even when closing this dialog
          </p>
        </div>

        {/* Device Categories */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold">MIDI Devices</h3>
            <Button 
              onClick={refreshDevices} 
              disabled={isRefreshing}
              size="sm" 
              variant="outline"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh All
            </Button>
          </div>

          {/* Connected Devices */}
          {[...availableOutputs, ...bluetoothDevices].filter(d => d.state === 'connected').length > 0 && (
            <div className="mb-4">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Wifi className="h-4 w-4 text-green-500" />
                Connected Devices
              </h4>
              <div className="grid gap-2">
                {[...availableOutputs, ...bluetoothDevices].filter(d => d.state === 'connected').map((device) => (
                  <div key={device.id} className="flex items-center justify-between p-3 border border-green-200 rounded-lg bg-green-50 dark:bg-green-900/20">
                    <div className="flex items-center gap-3">
                      <Music className="h-4 w-4 text-green-600" />
                      <div>
                        <div className="font-medium">{device.name}</div>
                        <div className="text-sm text-muted-foreground">{device.manufacturer}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="default" className="bg-green-600">Connected</Badge>
                      <Badge variant="outline" className="text-xs">{device.deviceType}</Badge>
                      <Button
                        size="sm"
                        onClick={() => connectToOutput(device.id)}
                        variant={globalMidi.isConnected && globalMidi.deviceName === device.name ? 'default' : 'outline'}
                      >
                        {globalMidi.isConnected && globalMidi.deviceName === device.name ? 'Active' : 'Use'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Available USB Devices */}
          {availableOutputs.filter(d => d.state !== 'connected').length > 0 && (
            <div className="mb-4">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Music className="h-4 w-4 text-blue-500" />
                Available USB MIDI Devices
              </h4>
              <div className="grid gap-2">
                {availableOutputs.filter(d => d.state !== 'connected').map((device) => (
                  <div key={device.id} className="flex items-center justify-between p-3 border border-blue-200 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                    <div className="flex items-center gap-3">
                      <Music className="h-4 w-4 text-blue-600" />
                      <div>
                        <div className="font-medium">{device.name}</div>
                        <div className="text-sm text-muted-foreground">{device.manufacturer}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{device.state}</Badge>
                      <Badge variant="outline" className="text-xs">{device.deviceType}</Badge>
                      <Button
                        size="sm"
                        onClick={() => connectToOutput(device.id)}
                        disabled={device.state !== 'connected'}
                        variant="outline"
                      >
                        Connect
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bluetooth MIDI Devices */}
          {bluetoothDevices.length > 0 && (
            <div className="mb-4">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Wifi className="h-4 w-4 text-purple-500" />
                Bluetooth MIDI Devices
              </h4>
              <div className="grid gap-2">
                {bluetoothDevices.map((device) => (
                  <div key={device.id} className="flex items-center justify-between p-3 border border-purple-200 rounded-lg bg-purple-50 dark:bg-purple-900/20">
                    <div className="flex items-center gap-3">
                      <Wifi className="h-4 w-4 text-purple-600" />
                      <div>
                        <div className="font-medium">{device.name}</div>
                        <div className="text-sm text-muted-foreground">{device.manufacturer}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={device.state === 'connected' ? 'default' : 'secondary'}>
                        {device.state}
                      </Badge>
                      <Badge variant="outline" className="text-xs">bluetooth</Badge>
                      <Button
                        size="sm"
                        onClick={() => connectToOutput(device.id)}
                        disabled={device.state !== 'connected'}
                        variant="outline"
                      >
                        Connect
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Offline Devices */}
          {offlineDevices.length > 0 && (
            <div className="mb-4">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <WifiOff className="h-4 w-4 text-gray-500" />
                Offline Devices (Bluetooth may be turned off)
              </h4>
              <div className="grid gap-2">
                {offlineDevices.map((device) => (
                  <div key={device.id} className="flex items-center justify-between p-3 border border-gray-300 rounded-lg bg-gray-50 dark:bg-gray-800">
                    <div className="flex items-center gap-3">
                      <WifiOff className="h-4 w-4 text-gray-500" />
                      <div>
                        <div className="font-medium text-gray-600 dark:text-gray-400">{device.name}</div>
                        <div className="text-sm text-gray-500">{device.manufacturer} • Last seen: {device.lastSeen ? new Date(device.lastSeen).toLocaleDateString() : 'Unknown'}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">Offline</Badge>
                      <Badge variant="outline" className="text-xs">{device.deviceType}</Badge>
                      <Button
                        size="sm"
                        onClick={() => forceConnectToOfflineDevice(device)}
                        variant="outline"
                        title="Force connection attempt - will try to wake up and connect to the device"
                      >
                        <Wifi className="h-4 w-4 mr-1" />
                        Force Connect
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No devices found */}
          {availableOutputs.length === 0 && bluetoothDevices.length === 0 && offlineDevices.length === 0 && (
            <div className="text-muted-foreground space-y-2">
              <p>No MIDI devices found</p>
              <div className="text-xs bg-muted/50 p-3 rounded">
                <p className="font-medium mb-1">Troubleshooting:</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Connect your USB MIDI device to your computer</li>
                  <li>For Bluetooth MIDI: Pair and connect your device in system settings first</li>
                  <li>Ensure your device appears in system MIDI settings</li>
                  <li>Try clicking "Refresh All" above</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        

        {/* MIDI Messages */}
        {midiMessages.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-3">Recent Messages</h3>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {midiMessages.map((message, index) => (
                <div key={index} className="text-sm font-mono bg-muted p-2 rounded">
                  {message}
                </div>
              ))}
            </div>
          </div>
        )}

        
      </CardContent>
    </Card>
  );
}