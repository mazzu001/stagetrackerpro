import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Bluetooth, Plus, Trash2, Play, Activity, CheckCircle, AlertCircle, Ear, EarOff } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

interface SimpleBluetoothDevice {
  id: string;
  name: string;
  connected: boolean;
  saved: boolean;
  device?: any; // BluetoothDevice
  characteristic?: any; // BluetoothRemoteGATTCharacteristic
  lastActivity?: number;
  listening?: boolean;
}

interface MIDIMessage {
  timestamp: number;
  data: Uint8Array;
  formatted: string;
  deviceName: string;
}

interface SimpleBluetoothManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onDeviceSelected?: (device: SimpleBluetoothDevice) => void;
}

export function SimpleBluetoothManager({ isOpen, onClose, onDeviceSelected }: SimpleBluetoothManagerProps) {
  const [discoveredDevices, setDiscoveredDevices] = useState<SimpleBluetoothDevice[]>([]);
  const [savedDevices, setSavedDevices] = useState<SimpleBluetoothDevice[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isConnecting, setIsConnecting] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<{ device: string; success: boolean; message: string } | null>(null);
  const [bluetoothSupported, setBluetoothSupported] = useState(false);
  const [listeningDevice, setListeningDevice] = useState<string | null>(null);
  const [midiMessages, setMidiMessages] = useState<MIDIMessage[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    setBluetoothSupported('bluetooth' in navigator);
    loadSavedDevices();
  }, []);

  // Load saved devices from localStorage
  const loadSavedDevices = () => {
    try {
      const saved = localStorage.getItem('bluetoothDevices');
      if (saved) {
        const devices = JSON.parse(saved);
        setSavedDevices(devices.map((d: any) => ({ ...d, connected: false, device: null })));
      }
    } catch (error) {
      console.log('Failed to load saved devices:', error);
    }
  };

  // Save device to localStorage
  const saveDevice = (device: SimpleBluetoothDevice) => {
    const deviceToSave = {
      id: device.id,
      name: device.name,
      saved: true
    };
    
    const existing = savedDevices.find(d => d.id === device.id);
    if (!existing) {
      const updated = [...savedDevices, { ...deviceToSave, connected: false, device: null }];
      setSavedDevices(updated);
      localStorage.setItem('bluetoothDevices', JSON.stringify(updated.map(d => ({ id: d.id, name: d.name, saved: true }))));
      
      toast({
        title: "Device Saved",
        description: `${device.name} has been saved for future use`,
      });
    }
  };

  // Remove saved device
  const removeSavedDevice = (deviceId: string) => {
    const updated = savedDevices.filter(d => d.id !== deviceId);
    setSavedDevices(updated);
    localStorage.setItem('bluetoothDevices', JSON.stringify(updated.map(d => ({ id: d.id, name: d.name, saved: true }))));
    
    toast({
      title: "Device Removed",
      description: "Device has been removed from saved devices",
    });
  };

  // Format MIDI message for display
  const formatMIDIMessage = (data: Uint8Array): string => {
    const bytes = Array.from(data);
    if (bytes.length === 0) return 'Empty message';
    
    const status = bytes[0];
    const channel = (status & 0x0F) + 1;
    const messageType = status & 0xF0;
    
    switch (messageType) {
      case 0x80: // Note Off
        return `Note Off: Note ${bytes[1]}, Channel ${channel}`;
      case 0x90: // Note On
        return `Note On: Note ${bytes[1]}, Velocity ${bytes[2]}, Channel ${channel}`;
      case 0xB0: // Control Change
        return `Control Change: CC${bytes[1]} = ${bytes[2]}, Channel ${channel}`;
      case 0xC0: // Program Change
        return `Program Change: Program ${bytes[1]}, Channel ${channel}`;
      case 0xE0: // Pitch Bend
        const pitchBend = (bytes[2] << 7) | bytes[1];
        return `Pitch Bend: ${pitchBend}, Channel ${channel}`;
      default:
        return `MIDI: ${bytes.map(b => b.toString(16).padStart(2, '0')).join(' ')}`;
    }
  };

  // Start/stop listening for MIDI messages
  const toggleListening = async (deviceInfo: SimpleBluetoothDevice) => {
    if (!deviceInfo.connected || !deviceInfo.characteristic) {
      toast({
        title: "Device Not Ready",
        description: "Device must be connected to listen for messages",
        variant: "destructive",
      });
      return;
    }

    try {
      if (listeningDevice === deviceInfo.id) {
        // Stop listening
        if (deviceInfo.characteristic.removeEventListener) {
          deviceInfo.characteristic.removeEventListener('characteristicvaluechanged', handleMIDIMessage);
        }
        setListeningDevice(null);
        
        // Update device state
        setDiscoveredDevices(prev => prev.map(d => 
          d.id === deviceInfo.id ? { ...d, listening: false } : d
        ));
        setSavedDevices(prev => prev.map(d => 
          d.id === deviceInfo.id ? { ...d, listening: false } : d
        ));

        toast({
          title: "Listening Stopped",
          description: `Stopped listening to ${deviceInfo.name}`,
        });
      } else {
        // Start listening
        await deviceInfo.characteristic.startNotifications();
        deviceInfo.characteristic.addEventListener('characteristicvaluechanged', (event: any) => {
          handleMIDIMessage(event, deviceInfo.name);
        });
        
        setListeningDevice(deviceInfo.id);
        
        // Update device state
        setDiscoveredDevices(prev => prev.map(d => 
          d.id === deviceInfo.id ? { ...d, listening: true } : d
        ));
        setSavedDevices(prev => prev.map(d => 
          d.id === deviceInfo.id ? { ...d, listening: true } : d
        ));

        toast({
          title: "Listening Started",
          description: `Now listening to MIDI messages from ${deviceInfo.name}`,
        });
      }
    } catch (error: any) {
      console.log('Listening error:', error);
      toast({
        title: "Listening Error",
        description: `Failed to toggle listening: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  // Handle incoming MIDI messages
  const handleMIDIMessage = (event: any, deviceName: string) => {
    const data = new Uint8Array(event.target.value.buffer);
    const formatted = formatMIDIMessage(data);
    
    const message: MIDIMessage = {
      timestamp: Date.now(),
      data,
      formatted,
      deviceName
    };
    
    setMidiMessages(prev => [message, ...prev].slice(0, 50)); // Keep last 50 messages
    console.log('MIDI message received:', formatted);
  };

  // Clear MIDI message log
  const clearMIDIMessages = () => {
    setMidiMessages([]);
  };

  // Discover all available Bluetooth devices
  const discoverDevices = async () => {
    if (!bluetoothSupported) {
      toast({
        title: "Bluetooth Not Supported",
        description: "Your browser doesn't support Bluetooth",
        variant: "destructive",
      });
      return;
    }

    setIsScanning(true);
    setDiscoveredDevices([]);

    try {
      console.log('Starting comprehensive Bluetooth device discovery...');
      
      // Try multiple discovery approaches for maximum compatibility
      let device;
      
      try {
        // First attempt: Try with comprehensive service list including common MIDI and HID services
        console.log('Attempting discovery with comprehensive service list...');
        device = await (navigator as any).bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: [
            // MIDI Services
            '03b80e5a-ede8-4b33-a751-6ce34ec4c700', // MIDI Service (official)
            '7772e5db-3868-4112-a1a9-f2669d106bf3', // Alternative MIDI
            
            // HID Services (for pedals/controllers)
            '00001812-0000-1000-8000-00805f9b34fb', // Human Interface Device
            '0000180f-0000-1000-8000-00805f9b34fb', // Battery Service
            '0000180a-0000-1000-8000-00805f9b34fb', // Device Information Service
            
            // Custom and proprietary services
            '12345678-1234-1234-1234-123456789abc', // Generic custom
            '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART Service
            '0000ffe0-0000-1000-8000-00805f9b34fb', // Common custom service
            '0000fff0-0000-1000-8000-00805f9b34fb', // Another custom service
            
            // Audio and multimedia services
            '0000110b-0000-1000-8000-00805f9b34fb', // Audio Sink
            '0000110a-0000-1000-8000-00805f9b34fb', // Audio Source
            
            // Generic services that might help discovery
            '00001800-0000-1000-8000-00805f9b34fb', // Generic Access
            '00001801-0000-1000-8000-00805f9b34fb', // Generic Attribute
          ]
        });
        console.log('Comprehensive discovery successful!');
      } catch (firstError) {
        console.log('Comprehensive discovery failed, trying minimal approach...', firstError);
        
        // Second attempt: Minimal approach with just acceptAllDevices
        device = await (navigator as any).bluetooth.requestDevice({
          acceptAllDevices: true
        });
        console.log('Minimal discovery successful!');
      }

      console.log('Device discovered:', device.name || 'Unnamed Device', 'ID:', device.id);

      const newDevice: SimpleBluetoothDevice = {
        id: device.id,
        name: device.name || 'Unnamed Device',
        connected: false,
        saved: false,
        device: device
      };

      setDiscoveredDevices([newDevice]);
      
      toast({
        title: "Device Found",
        description: `Found: ${newDevice.name}`,
      });

    } catch (error: any) {
      console.log('All discovery attempts failed:', error);
      
      if (error.name === 'NotFoundError') {
        toast({
          title: "No Device Selected",
          description: "Please select a device from the browser's Bluetooth list. If 'Matts Pedal' doesn't appear, try pairing it first in Windows Settings.",
          variant: "destructive",
        });
      } else if (error.name === 'NotAllowedError') {
        toast({
          title: "Permission Denied",
          description: "Bluetooth access was denied. Please allow Bluetooth access and try again.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Discovery Failed", 
          description: `Error: ${error.message}. Try pairing 'Matts Pedal' in Windows Settings first.`,
          variant: "destructive",
        });
      }
    } finally {
      setIsScanning(false);
    }
  };

  // Connect to a Bluetooth device
  const connectToDevice = async (deviceInfo: SimpleBluetoothDevice) => {
    if (!deviceInfo.device) {
      toast({
        title: "No Device Reference",
        description: "Device needs to be discovered first",
        variant: "destructive",
      });
      return;
    }

    setIsConnecting(deviceInfo.id);

    try {
      console.log('Connecting to device:', deviceInfo.name);
      
      // Connect to GATT server
      const server = await deviceInfo.device.gatt?.connect();
      if (!server) {
        throw new Error('Failed to connect to GATT server');
      }

      console.log('Connected to GATT server');

      // Try to find any available service
      const services = await server.getPrimaryServices();
      console.log('Available services:', services.map((s: any) => s.uuid));

      let characteristic = null;
      
      // Try to find a writable characteristic
      for (const service of services) {
        try {
          const characteristics = await service.getCharacteristics();
          for (const char of characteristics) {
            if (char.properties.write || char.properties.writeWithoutResponse) {
              characteristic = char;
              console.log('Found writable characteristic:', char.uuid);
              break;
            }
          }
          if (characteristic) break;
        } catch (e) {
          console.log('Service access failed:', e);
        }
      }

      // Update device status
      const updatedDevice = {
        ...deviceInfo,
        connected: true,
        characteristic: characteristic || undefined
      };

      // Update in discovered devices
      setDiscoveredDevices(prev => prev.map(d => d.id === deviceInfo.id ? updatedDevice : d));
      
      // Update in saved devices if it exists there
      setSavedDevices(prev => prev.map(d => d.id === deviceInfo.id ? updatedDevice : d));

      toast({
        title: "Device Connected",
        description: `Connected to ${deviceInfo.name}${characteristic ? ' with communication capability' : ' (read-only)'}`,
      });

      // Set up disconnect handler
      deviceInfo.device.addEventListener('gattserverdisconnected', () => {
        console.log('Device disconnected:', deviceInfo.name);
        setDiscoveredDevices(prev => prev.map(d => d.id === deviceInfo.id ? { ...d, connected: false } : d));
        setSavedDevices(prev => prev.map(d => d.id === deviceInfo.id ? { ...d, connected: false } : d));
      });

    } catch (error: any) {
      console.log('Connection error:', error);
      toast({
        title: "Connection Failed",
        description: `Failed to connect: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsConnecting(null);
    }
  };

  // Test communication with device
  const testDevice = async (deviceInfo: SimpleBluetoothDevice) => {
    if (!deviceInfo.connected || !deviceInfo.characteristic) {
      toast({
        title: "Device Not Ready",
        description: "Device must be connected with communication capability",
        variant: "destructive",
      });
      return;
    }

    setIsTesting(deviceInfo.id);

    try {
      console.log('Testing device:', deviceInfo.name);
      
      // Send a simple test message
      const testData = new Uint8Array([0x90, 0x3C, 0x7F]); // MIDI Note On C4
      await deviceInfo.characteristic.writeValue(testData);
      
      console.log('Test data sent successfully');
      
      setTestResults({
        device: deviceInfo.name,
        success: true,
        message: 'Test signal sent successfully'
      });

      toast({
        title: "Test Successful",
        description: `Communication test passed for ${deviceInfo.name}`,
      });

    } catch (error: any) {
      console.log('Test error:', error);
      
      setTestResults({
        device: deviceInfo.name,
        success: false,
        message: error.message
      });

      toast({
        title: "Test Failed",
        description: `Communication test failed: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsTesting(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh]" data-testid="dialog-bluetooth-manager">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bluetooth className="w-5 h-5" />
            Simple Bluetooth Device Manager
            <Badge variant="outline" className="ml-auto">
              {savedDevices.filter(d => d.connected).length} Connected
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status and Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {bluetoothSupported ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-500" />
              )}
              <span className="text-sm">
                {bluetoothSupported ? 'Bluetooth Ready' : 'Bluetooth Not Available'}
              </span>
            </div>
            
            <Button
              onClick={discoverDevices}
              disabled={isScanning || !bluetoothSupported}
              size="sm"
              variant="default"
              data-testid="button-discover-bluetooth"
            >
              <Plus className="w-4 h-4 mr-2" />
              {isScanning ? 'Scanning...' : 'Find Devices'}
            </Button>
          </div>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Side: Discovered Devices */}
            <div className="space-y-4">
              <h3 className="font-medium text-lg">Discovered Devices</h3>
              
              <ScrollArea className="h-60 border rounded-md p-3">
                {discoveredDevices.length === 0 ? (
                  <div className="text-center text-gray-500 py-8 text-sm">
                    No devices discovered<br />
                    <span className="text-xs">Click "Find Devices" to scan for Bluetooth devices</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {discoveredDevices.map((device) => (
                      <div
                        key={device.id}
                        className="flex items-center justify-between p-3 border rounded-md"
                        data-testid={`discovered-device-${device.id}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium truncate">{device.name}</p>
                            <div className={`w-2 h-2 rounded-full ${device.connected ? 'bg-green-500' : 'bg-gray-400'}`} />
                            {device.listening && (
                              <Badge variant="secondary" className="text-xs">
                                <Ear className="w-3 h-3 mr-1" />
                                Listening
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 truncate">{device.id}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {!device.connected ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => connectToDevice(device)}
                              disabled={isConnecting === device.id}
                              data-testid={`button-connect-${device.id}`}
                              className="h-8 px-2 text-xs"
                            >
                              {isConnecting === device.id ? 'Connecting...' : 'Connect'}
                            </Button>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => testDevice(device)}
                                disabled={isTesting === device.id}
                                data-testid={`button-test-${device.id}`}
                                className="h-8 px-2 text-xs"
                              >
                                {isTesting === device.id ? 'Testing...' : 'Test'}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => toggleListening(device)}
                                data-testid={`button-listen-${device.id}`}
                                className="h-8 px-2 text-xs"
                              >
                                {device.listening ? (
                                  <>
                                    <EarOff className="w-3 h-3 mr-1" />
                                    Stop
                                  </>
                                ) : (
                                  <>
                                    <Ear className="w-3 h-3 mr-1" />
                                    Listen
                                  </>
                                )}
                              </Button>
                            </>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => saveDevice(device)}
                            disabled={device.saved || savedDevices.some(d => d.id === device.id)}
                            data-testid={`button-save-${device.id}`}
                            className="h-8 px-2 text-xs"
                          >
                            Save
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* Right Side: Saved Devices */}
            <div className="space-y-4">
              <h3 className="font-medium text-lg">Saved Devices</h3>
              
              <ScrollArea className="h-60 border rounded-md p-3">
                {savedDevices.length === 0 ? (
                  <div className="text-center text-gray-500 py-8 text-sm">
                    No saved devices<br />
                    <span className="text-xs">Discover and save devices for quick access</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {savedDevices.map((device) => (
                      <div
                        key={device.id}
                        className="flex items-center justify-between p-3 border rounded-md bg-blue-50 dark:bg-blue-950"
                        data-testid={`saved-device-${device.id}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium truncate text-gray-900 dark:text-white">{device.name}</p>
                            <div className={`w-2 h-2 rounded-full ${device.connected ? 'bg-green-500' : 'bg-gray-400'}`} />
                            {device.listening && (
                              <Badge variant="secondary" className="text-xs">
                                <Ear className="w-3 h-3 mr-1" />
                                Listening
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            {device.connected ? 'Connected' : 'Saved - click to discover again'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {device.connected && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => toggleListening(device)}
                              data-testid={`button-listen-${device.id}`}
                              className="h-8 px-2 text-xs"
                            >
                              {device.listening ? (
                                <>
                                  <EarOff className="w-3 h-3 mr-1" />
                                  Stop
                                </>
                              ) : (
                                <>
                                  <Ear className="w-3 h-3 mr-1" />
                                  Listen
                                </>
                              )}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeSavedDevice(device.id)}
                            data-testid={`button-remove-${device.id}`}
                            className="h-8 px-2 text-xs text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>

          {/* Test Results */}
          {testResults && (
            <div className={`p-3 border rounded-md ${testResults.success ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800' : 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800'}`}>
              <h4 className={`font-medium mb-2 ${testResults.success ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}`}>
                Test Results - {testResults.device}
              </h4>
              <p className={`text-sm ${testResults.success ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                {testResults.message}
              </p>
            </div>
          )}

          {/* MIDI Message Log */}
          {midiMessages.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-lg">MIDI Messages</h3>
                <div className="flex items-center gap-2">
                  {listeningDevice && (
                    <Badge variant="secondary" className="text-xs">
                      <Activity className="w-3 h-3 mr-1" />
                      Live
                    </Badge>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={clearMIDIMessages}
                    className="h-8 px-2 text-xs"
                  >
                    Clear Log
                  </Button>
                </div>
              </div>
              
              <ScrollArea className="h-40 border rounded-md p-3 bg-gray-50 dark:bg-gray-900">
                <div className="space-y-1 text-xs font-mono">
                  {midiMessages.map((message, index) => (
                    <div key={index} className="flex items-start gap-2 pb-1 border-b border-gray-200 dark:border-gray-700 last:border-b-0">
                      <span className="text-gray-500 dark:text-gray-400 flex-shrink-0">
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </span>
                      <span className="text-blue-600 dark:text-blue-400 flex-shrink-0">
                        [{message.deviceName}]
                      </span>
                      <span className="text-gray-900 dark:text-gray-100">
                        {message.formatted}
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Simple Instructions */}
          <div className="p-4 border rounded-md bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
            <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">
              How to Use
            </h4>
            <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
              <p><strong>1.</strong> Click "Find Devices" to scan for all Bluetooth devices</p>
              <p><strong>2.</strong> Select your device from the browser popup</p>
              <p><strong>3.</strong> Click "Connect" to establish connection</p>
              <p><strong>4.</strong> Click "Test" to verify communication</p>
              <p><strong>5.</strong> Click "Listen" to monitor MIDI messages</p>
              <p><strong>6.</strong> Click "Save" to remember the device for future use</p>
            </div>
            
            <div className="mt-3 p-3 border border-yellow-300 dark:border-yellow-700 rounded bg-yellow-50 dark:bg-yellow-950">
              <h5 className="font-medium text-yellow-800 dark:text-yellow-200 mb-1">
                If "Matts Pedal" doesn't appear:
              </h5>
              <div className="text-xs text-yellow-700 dark:text-yellow-300 space-y-1">
                <p><strong>1.</strong> Go to Windows Settings → Bluetooth & devices</p>
                <p><strong>2.</strong> Make sure "Matts Pedal" is paired (not just discoverable)</p>
                <p><strong>3.</strong> If it shows "Other Devices", try removing and re-pairing it</p>
                <p><strong>4.</strong> Ensure the pedal is in pairing mode when scanning</p>
                <p><strong>5.</strong> Try refreshing the browser page after pairing</p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}