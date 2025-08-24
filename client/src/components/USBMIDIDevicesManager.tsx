import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { 
  Usb, 
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
  CheckCircle
} from 'lucide-react';
import { formatMIDIMessage as formatMIDIData, parseMIDICommand } from '@/utils/midiFormatter';
import { useLocalAuth } from '@/hooks/useLocalAuth';

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
  isOpen: boolean;
  onClose: () => void;
  onConnectedDevicesChange?: (devices: USBMIDIDevice[]) => void;
}

export function USBMIDIDevicesManager({ isOpen, onClose, onConnectedDevicesChange }: USBMIDIDevicesManagerProps) {
  const { user } = useLocalAuth();
  const isProfessional = user?.userType === 'professional';
  
  // All useState hooks must come first before any useEffect hooks
  const [devices, setDevices] = useState<USBMIDIDevice[]>([]);
  const [connectedDevices, setConnectedDevices] = useState<USBMIDIDevice[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [messages, setMessages] = useState<USBMIDIMessage[]>([]);
  const [selectedOutputDevice, setSelectedOutputDevice] = useState<string>('');
  const [midiCommand, setMidiCommand] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [hasWebMIDISupport, setHasWebMIDISupport] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [lastScanResults, setLastScanResults] = useState<{
    timestamp: number;
    deviceCount: number;
    inputCount: number;
    outputCount: number;
    connectedCount: number;
    devices: USBMIDIDevice[];
  } | null>(null);
  
  const { toast } = useToast();
  
  // Storage keys
  const CONNECTED_DEVICES_STORAGE_KEY = 'usb_midi_connected_devices';
  const SELECTED_OUTPUT_DEVICE_KEY = 'usb_midi_selected_output_device';

  // Load saved selected output device on startup
  useEffect(() => {
    const savedDevice = localStorage.getItem(SELECTED_OUTPUT_DEVICE_KEY);
    if (savedDevice) {
      setSelectedOutputDevice(savedDevice);
      console.log(`📱 Restored selected USB output device from storage: ${savedDevice}`);
    }
  }, []);

  // Professional subscription check - restrict MIDI features to level 3 subscribers only
  useEffect(() => {
    if (isOpen && !isProfessional) {
      toast({
        title: "Professional Subscription Required",
        description: "USB MIDI features are only available for Professional subscribers (Level 3)",
        variant: "destructive",
      });
      onClose();
    }
  }, [isOpen, isProfessional, onClose, toast]);

  // Save connected devices to localStorage
  const saveConnectedDevices = useCallback((devices: USBMIDIDevice[]) => {
    try {
      const deviceData = devices.map(device => ({
        id: device.id,
        name: device.name,
        manufacturer: device.manufacturer,
        type: device.type,
        version: device.version
      }));
      localStorage.setItem(CONNECTED_DEVICES_STORAGE_KEY, JSON.stringify(deviceData));
      console.log(`💾 Saved ${devices.length} connected USB MIDI devices to storage`);
    } catch (error) {
      console.error('Failed to save connected devices:', error);
    }
  }, []);

  // Load connected devices from localStorage
  const loadStoredConnectedDevices = useCallback((): USBMIDIDevice[] => {
    try {
      const stored = localStorage.getItem(CONNECTED_DEVICES_STORAGE_KEY);
      if (stored) {
        const deviceData = JSON.parse(stored);
        console.log(`📂 Loaded ${deviceData.length} previously connected USB MIDI devices from storage`);
        return deviceData.map((device: any) => ({
          ...device,
          state: 'disconnected' as const // Will be updated when reconnecting
        }));
      }
    } catch (error) {
      console.error('Failed to load stored connected devices:', error);
    }
    return [];
  }, []);

  // Auto-reconnect previously connected devices
  const autoReconnectDevices = useCallback(async (midiAccess: any, availableDevices: USBMIDIDevice[]) => {
    const storedDevices = loadStoredConnectedDevices();
    if (storedDevices.length === 0) return;

    console.log(`🔄 Attempting to auto-reconnect ${storedDevices.length} previously connected devices...`);
    
    for (const storedDevice of storedDevices) {
      // Find matching device in currently available devices
      const availableDevice = availableDevices.find(device => 
        device.id === storedDevice.id && device.name === storedDevice.name
      );
      
      if (availableDevice && availableDevice.state === 'connected') {
        console.log(`🔗 Auto-reconnecting ${availableDevice.name} (${availableDevice.type})`);
        try {
          await connectToDevice(availableDevice, midiAccess);
          toast({
            title: "Device Auto-Connected",
            description: `${availableDevice.name} reconnected automatically`,
            duration: 3000,
          });
        } catch (error) {
          console.error(`Failed to auto-reconnect ${availableDevice.name}:`, error);
        }
      } else {
        console.log(`⚠️ Previously connected device not available: ${storedDevice.name}`);
      }
    }
  }, [loadStoredConnectedDevices, toast]);

  // Connect to device (updated to use midiAccess parameter)
  const connectToDevice = async (device: USBMIDIDevice, midiAccess?: any) => {
    console.log(`🔗 Attempting to connect to ${device.name} (${device.type})...`);
    
    try {
      if (!midiAccess) {
        if (!hasWebMIDISupport) {
          throw new Error('Web MIDI API not supported');
        }
        midiAccess = await navigator.requestMIDIAccess({ sysex: false });
      }

      if (device.type === 'input') {
        const input = midiAccess.inputs.get(device.id);
        if (input) {
          console.log(`🔌 USB MIDI input device ready: ${device.name}`);
          
          input.onmidimessage = (event: any) => {
            const message: USBMIDIMessage = {
              timestamp: Date.now(),
              deviceId: device.id,
              deviceName: device.name,
              data: event.data,
              type: 'received'
            };
            
            console.log(`📥 USB MIDI Received from ${device.name}:`, Array.from(event.data as ArrayLike<number>).map((b: number) => `0x${b.toString(16).padStart(2, '0')}`).join(' '));
            setMessages(prev => [...prev.slice(-19), message]);
          };
          
          input.onstatechange = (event: any) => {
            console.log(`🔄 USB MIDI Input state change for ${device.name}:`, event.port.state);
            if (event.port.state === 'disconnected') {
              handleDisconnectDevice(device);
            }
          };
        } else {
          throw new Error(`Input device ${device.id} not found`);
        }
      } else {
        const output = midiAccess.outputs.get(device.id);
        if (output) {
          console.log(`🔌 USB MIDI output device ready: ${device.name}`);
          
          output.onstatechange = (event: any) => {
            console.log(`🔄 USB MIDI Output state change for ${device.name}:`, event.port.state);
            if (event.port.state === 'disconnected') {
              handleDisconnectDevice(device);
            }
          };
        } else {
          throw new Error(`Output device ${device.id} not found`);
        }
      }
      
      // Update device state
      setDevices(prev => prev.map(d => 
        d.id === device.id ? { ...d, state: 'connected' } : d
      ));
      setConnectedDevices(prev => {
        const updated = [...prev.filter(d => d.id !== device.id), { ...device, state: 'connected' as const }];
        saveConnectedDevices(updated); // Save to localStorage
        
        // Notify parent component of device changes
        if (onConnectedDevicesChange) {
          onConnectedDevicesChange(updated);
        }
        
        return updated;
      });
      
      toast({
        title: "Device Connected",
        description: `${device.name} is now connected and monitoring ${device.type === 'input' ? 'incoming' : 'outgoing'} MIDI`,
      });
    } catch (error) {
      console.error('USB MIDI Connection Error:', error);
      toast({
        title: "Connection Failed",
        description: `Unable to connect to ${device.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    }
  };

  // Check Web MIDI API support
  useEffect(() => {
    const checkWebMIDISupport = async () => {
      console.log('🔍 Checking Web MIDI API support...');
      console.log('Navigator available:', typeof navigator !== 'undefined');
      console.log('requestMIDIAccess available:', 'requestMIDIAccess' in navigator);
      
      if (typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator) {
        console.log('✅ Web MIDI API is supported');
        setHasWebMIDISupport(true);
        try {
          console.log('🔐 Requesting MIDI access...');
          const midiAccess = await navigator.requestMIDIAccess({ sysex: false });
          console.log('✅ MIDI access granted:', midiAccess);
          console.log('Available inputs:', midiAccess.inputs.size);
          console.log('Available outputs:', midiAccess.outputs.size);
          
          setPermissionStatus('granted');
          loadMIDIDevices(midiAccess);
        } catch (error) {
          console.error('❌ MIDI access denied:', error);
          setPermissionStatus('denied');
          toast({
            title: "MIDI Access Denied",
            description: "Please allow MIDI device access in your browser settings",
            variant: "destructive",
          });
        }
      } else {
        console.log('❌ Web MIDI API not supported in this browser');
        setHasWebMIDISupport(false);
        // No devices available without Web MIDI API support
        setDevices([]);
        toast({
          title: "Web MIDI Not Supported",
          description: "This browser doesn't support Web MIDI API. Try Chrome or Edge.",
          variant: "destructive",
        });
      }
    };

    checkWebMIDISupport();
  }, []);

  // Load MIDI devices from Web MIDI API
  const loadMIDIDevices = useCallback((midiAccess: any) => {
    console.log('🔍 Loading MIDI devices from API...');
    const deviceList: USBMIDIDevice[] = [];
    
    console.log('📥 Processing input devices...');
    // Input devices
    midiAccess.inputs.forEach((input: any, id: string) => {
      console.log(`Found input device: ${input.name} (${input.manufacturer}) - State: ${input.state}`);
      deviceList.push({
        id,
        name: input.name || `USB Input ${id}`,
        manufacturer: input.manufacturer || 'Unknown',
        type: 'input',
        state: input.state === 'connected' ? 'connected' : 'disconnected',
        portIndex: deviceList.filter(d => d.type === 'input').length + 1,
        version: input.version || '1.0'
      });
    });

    console.log('📤 Processing output devices...');
    // Output devices
    midiAccess.outputs.forEach((output: any, id: string) => {
      console.log(`Found output device: ${output.name} (${output.manufacturer}) - State: ${output.state}`);
      deviceList.push({
        id,
        name: output.name || `USB Output ${id}`,
        manufacturer: output.manufacturer || 'Unknown',
        type: 'output',
        state: output.state === 'connected' ? 'connected' : 'disconnected',
        portIndex: deviceList.filter(d => d.type === 'output').length + 1,
        version: output.version || '1.0'
      });
    });

    console.log(`✅ Loaded ${deviceList.length} total devices (${deviceList.filter(d => d.type === 'input').length} inputs, ${deviceList.filter(d => d.type === 'output').length} outputs)`);
    setDevices(deviceList);
    setConnectedDevices(deviceList.filter(d => d.state === 'connected'));
    
    if (deviceList.length === 0) {
      console.log('⚠️ No MIDI devices found. Make sure devices are connected and drivers are installed.');
    }
    
    // Auto-reconnect previously connected devices after a short delay
    setTimeout(() => {
      autoReconnectDevices(midiAccess, deviceList);
      
      // Auto-select previously selected output device if it's available
      const savedDeviceId = localStorage.getItem(SELECTED_OUTPUT_DEVICE_KEY);
      if (savedDeviceId) {
        const availableDevice = deviceList.find(device => 
          device.id === savedDeviceId && device.type === 'output'
        );
        if (availableDevice) {
          setSelectedOutputDevice(savedDeviceId);
          console.log(`🔄 Auto-selected output device: ${availableDevice.name}`);
          
          // Notify parent about connection status
          if (onConnectedDevicesChange) {
            onConnectedDevicesChange(deviceList.filter(d => d.state === 'connected'));
          }
        } else {
          console.log(`⚠️ Previously selected output device not available: ${savedDeviceId}`);
        }
      }
    }, 500);
  }, [autoReconnectDevices]);

  // Scan for USB MIDI devices
  const handleScanDevices = async () => {
    console.log('🔍 Starting USB MIDI device scan...');
    setIsScanning(true);
    
    try {
      if (hasWebMIDISupport) {
        console.log('🔐 Requesting fresh MIDI access for scan...');
        const midiAccess = await navigator.requestMIDIAccess({ sysex: false });
        console.log('✅ Got MIDI access for scan:', midiAccess);
        
        // Clear existing devices first
        setDevices([]);
        setConnectedDevices([]);
        
        // Load fresh device list
        const deviceList: USBMIDIDevice[] = [];
        
        console.log(`📥 Scanning ${midiAccess.inputs.size} input devices...`);
        // Input devices
        midiAccess.inputs.forEach((input: any, id: string) => {
          console.log(`Input: ${input.name} | Manufacturer: ${input.manufacturer} | State: ${input.state} | ID: ${id}`);
          deviceList.push({
            id,
            name: input.name || `USB Input ${id}`,
            manufacturer: input.manufacturer || 'Unknown',
            type: 'input',
            state: input.state === 'connected' ? 'connected' : 'disconnected',
            portIndex: deviceList.filter(d => d.type === 'input').length + 1,
            version: input.version || '1.0'
          });
        });

        console.log(`📤 Scanning ${midiAccess.outputs.size} output devices...`);
        // Output devices
        midiAccess.outputs.forEach((output: any, id: string) => {
          console.log(`Output: ${output.name} | Manufacturer: ${output.manufacturer} | State: ${output.state} | ID: ${id}`);
          deviceList.push({
            id,
            name: output.name || `USB Output ${id}`,
            manufacturer: output.manufacturer || 'Unknown',
            type: 'output',
            state: output.state === 'connected' ? 'connected' : 'disconnected',
            portIndex: deviceList.filter(d => d.type === 'output').length + 1,
            version: output.version || '1.0'
          });
        });

        setDevices(deviceList);
        setConnectedDevices(deviceList.filter(d => d.state === 'connected'));
        
        // Show detailed scan results
        const inputCount = deviceList.filter(d => d.type === 'input').length;
        const outputCount = deviceList.filter(d => d.type === 'output').length;
        const connectedCount = deviceList.filter(d => d.state === 'connected').length;
        
        // Store scan results for display
        setLastScanResults({
          timestamp: Date.now(),
          deviceCount: deviceList.length,
          inputCount,
          outputCount,
          connectedCount,
          devices: deviceList
        });
        
        console.log(`📊 Scan complete: ${deviceList.length} devices found (${inputCount} inputs, ${outputCount} outputs, ${connectedCount} connected)`);
        
        if (deviceList.length === 0) {
          console.log('⚠️ No MIDI devices detected. Possible causes:');
          console.log('  - No MIDI devices are physically connected');
          console.log('  - MIDI device drivers are not installed');
          console.log('  - Devices are not recognized by the operating system');
          console.log('  - Browser does not have MIDI permissions');
          
          toast({
            title: "No USB MIDI Devices Found",
            description: "Check that devices are connected and drivers are installed",
            variant: "default",
          });
        } else {
          // Show device names in the toast
          const deviceNames = deviceList.slice(0, 3).map(d => `• ${d.name}`).join('\n');
          const moreDevices = deviceList.length > 3 ? `\n• ...and ${deviceList.length - 3} more` : '';
          
          toast({
            title: `Found ${deviceList.length} USB MIDI Device${deviceList.length !== 1 ? 's' : ''}`,
            description: `${inputCount} input, ${outputCount} output (${connectedCount} connected)\n\nDevices found:\n${deviceNames}${moreDevices}`,
          });
        }
      } else {
        console.log('❌ Cannot scan - Web MIDI API not supported');
        toast({
          title: "Web MIDI Not Supported",
          description: "Web MIDI API not available in this browser",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('❌ Scan failed:', error);
      toast({
        title: "Scan Failed",
        description: `Unable to access USB MIDI devices: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setIsScanning(false);
    }
  };

  // Connect to device
  const handleConnectDevice = async (device: USBMIDIDevice) => {
    await connectToDevice(device);
  };

  // Disconnect from device
  const handleDisconnectDevice = (device: USBMIDIDevice) => {
    try {
      if (hasWebMIDISupport) {
        const midiAccess = navigator.requestMIDIAccess({ sysex: false }).then(access => {
          if (device.type === 'input') {
            const input = access.inputs.get(device.id);
            if (input) {
              input.onmidimessage = null;
              input.onstatechange = null;
              console.log(`🔌 USB MIDI input listener removed for: ${device.name}`);
            }
          } else {
            const output = access.outputs.get(device.id);
            if (output) {
              output.onstatechange = null;
              console.log(`🔌 USB MIDI output listener removed for: ${device.name}`);
            }
          }
        });
      }
    } catch (error) {
      console.error('Error disconnecting USB MIDI device:', error);
    }
    
    setDevices(prev => prev.map(d => 
      d.id === device.id ? { ...d, state: 'disconnected' } : d
    ));
    setConnectedDevices(prev => {
      const updated = prev.filter(d => d.id !== device.id);
      saveConnectedDevices(updated); // Update localStorage
      
      // Notify parent component of device changes
      if (onConnectedDevicesChange) {
        onConnectedDevicesChange(updated);
      }
      
      return updated;
    });
    
    toast({
      title: "Device Disconnected",
      description: `${device.name} has been disconnected`,
    });
  };

  // Send MIDI message
  const handleSendMessage = async () => {
    if (!selectedOutputDevice || !midiCommand.trim()) return;

    try {
      if (hasWebMIDISupport) {
        const midiAccess = await navigator.requestMIDIAccess({ sysex: false });
        const output = midiAccess.outputs.get(selectedOutputDevice);
        
        if (output) {
          // Parse MIDI command using proper parser (supports [[PC:12:1]], hex, and text formats)
          const parseResult = parseMIDICommand(midiCommand);
          
          if (parseResult && parseResult.bytes.length > 0) {
            console.log(`📤 USB MIDI Sending: ${midiCommand} → [${parseResult.bytes.map(b => b.toString(16).padStart(2, '0')).join(' ')}]`);
            output.send(parseResult.bytes);
            
            // Add sent message to the message log
            const sentMessage: USBMIDIMessage = {
              timestamp: Date.now(),
              deviceId: selectedOutputDevice,
              deviceName: connectedDevices.find(d => d.id === selectedOutputDevice)?.name || 'Unknown Device',
              data: new Uint8Array(parseResult.bytes),
              type: 'sent'
            };
            setMessages(prev => [...prev.slice(-49), sentMessage]);
            
            toast({
              title: "Message Sent",
              description: `${parseResult.formatted} sent to ${sentMessage.deviceName}`,
            });
          } else {
            toast({
              title: "Invalid MIDI Command",
              description: "Please use format: [[PC:12:1]], [[CC:7:64:1]], or hex bytes",
              variant: "destructive",
            });
            return;
          }
        } else {
          toast({
            title: "Device Not Found",
            description: "Selected output device is not available",
            variant: "destructive",
          });
          return;
        }
      }
      
      setMidiCommand('');
    } catch (error) {
      console.error('USB MIDI Send Error:', error);
      toast({
        title: "Send Failed",
        description: `Unable to send MIDI message: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    }
  };

  // Filter devices by search term
  const filteredDevices = devices.filter(device =>
    device.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (device.manufacturer && device.manufacturer.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Format MIDI message for display
  const formatMIDIMessage = (message: USBMIDIMessage) => {
    const timestamp = new Date(message.timestamp).toLocaleTimeString();
    const formattedData = formatMIDIData(Array.from(message.data));
    return `[${timestamp}] ${message.deviceName}: ${formattedData}`;
  };

  // Clear messages
  const handleClearMessages = () => {
    setMessages([]);
  };

  // Don't render for non-professional users, but still call all hooks above
  if (!isProfessional) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl h-[85vh] flex flex-col" data-testid="modal-usb-midi">
        <DialogHeader className="pb-4">
          <DialogTitle className="flex items-center gap-3">
            <Usb className="h-6 w-6 text-blue-500" />
            <span className="text-xl font-semibold">USB MIDI Devices</span>
            <Badge variant={hasWebMIDISupport ? "default" : "secondary"} className="ml-2">
              {hasWebMIDISupport ? "Native Support" : "Development Mode"}
            </Badge>
            {permissionStatus === 'denied' && (
              <Badge variant="destructive" className="ml-2">
                Permission Denied
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Web MIDI Support Warning */}
        {!hasWebMIDISupport && (
          <Card className="mb-4 border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm font-medium">
                  Web MIDI API not supported in this browser. USB MIDI devices require a compatible browser.
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        <ScrollArea className="flex-1">
          <div className="space-y-4 p-1">
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
                        data-testid="input-search-devices"
                      />
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleScanDevices}
                      disabled={isScanning}
                      data-testid="button-scan-usb-devices"
                    >
                      <RefreshCw className={`h-4 w-4 mr-1 ${isScanning ? 'animate-spin' : ''}`} />
                      {isScanning ? "Scanning..." : "Scan USB"}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              
              {/* Scan Results Summary */}
              {lastScanResults && (
                <CardContent className="pt-0 pb-4">
                  <div className="bg-muted/50 rounded-lg p-3 border-l-4 border-blue-500">
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="text-sm font-medium text-blue-700 dark:text-blue-300">Latest Scan Results</h5>
                      <span className="text-xs text-muted-foreground">
                        {new Date(lastScanResults.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div className="text-center">
                        <div className="font-semibold text-lg">{lastScanResults.deviceCount}</div>
                        <div className="text-muted-foreground">Total Devices</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-lg text-green-600">{lastScanResults.inputCount}</div>
                        <div className="text-muted-foreground">Input Devices</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-lg text-blue-600">{lastScanResults.outputCount}</div>
                        <div className="text-muted-foreground">Output Devices</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-lg text-orange-600">{lastScanResults.connectedCount}</div>
                        <div className="text-muted-foreground">Connected</div>
                      </div>
                    </div>
                    {lastScanResults.deviceCount > 0 && (
                      <div className="mt-3 pt-3 border-t border-muted-foreground/20">
                        <p className="text-xs font-medium text-muted-foreground mb-2">Detected USB MIDI Devices:</p>
                        <div className="space-y-1">
                          {lastScanResults.devices.slice(0, 4).map((device, index) => (
                            <div key={device.id} className="flex items-center gap-2 text-xs">
                              <div className={`w-2 h-2 rounded-full ${device.state === 'connected' ? 'bg-green-500' : 'bg-gray-400'}`} />
                              <span className="font-mono">{device.name}</span>
                              <span className="text-muted-foreground">({device.type})</span>
                            </div>
                          ))}
                          {lastScanResults.devices.length > 4 && (
                            <div className="text-xs text-muted-foreground font-medium">
                              ...and {lastScanResults.devices.length - 4} more devices
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              )}
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Input Devices */}
                  <div>
                    <h4 className="text-sm font-medium mb-3 flex items-center gap-2 text-green-600 dark:text-green-400">
                      <Volume2 className="h-4 w-4" />
                      USB Input Devices ({filteredDevices.filter(d => d.type === 'input').length})
                    </h4>
                    <div className="space-y-2">
                      {filteredDevices.filter(d => d.type === 'input').length === 0 ? (
                        <div className="text-center py-4 text-muted-foreground text-sm border-2 border-dashed rounded-lg">
                          No USB input devices found
                        </div>
                      ) : (
                        filteredDevices.filter(d => d.type === 'input').map((device) => (
                          <div key={device.id} className="border rounded-lg p-3 bg-card hover:bg-accent transition-colors">
                            <div className="flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate flex items-center gap-2">
                                  {device.state === 'connected' ? 
                                    <CheckCircle className="h-3 w-3 text-green-500" /> : 
                                    <div className="h-3 w-3 border border-gray-400 rounded-full" />
                                  }
                                  {device.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {device.manufacturer} • Port {device.portIndex} • v{device.version}
                                </p>
                              </div>
                              <Button
                                size="sm"
                                variant={device.state === 'connected' ? "destructive" : "default"}
                                onClick={() => device.state === 'connected' ? 
                                  handleDisconnectDevice(device) : handleConnectDevice(device)}
                                data-testid={`button-${device.state === 'connected' ? 'disconnect' : 'connect'}-usb-input-${device.id}`}
                                className="ml-2 shrink-0"
                              >
                                {device.state === 'connected' ? (
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
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Output Devices */}
                  <div>
                    <h4 className="text-sm font-medium mb-3 flex items-center gap-2 text-blue-600 dark:text-blue-400">
                      <VolumeX className="h-4 w-4" />
                      USB Output Devices ({filteredDevices.filter(d => d.type === 'output').length})
                    </h4>
                    <div className="space-y-2">
                      {filteredDevices.filter(d => d.type === 'output').length === 0 ? (
                        <div className="text-center py-4 text-muted-foreground text-sm border-2 border-dashed rounded-lg">
                          No USB output devices found
                        </div>
                      ) : (
                        filteredDevices.filter(d => d.type === 'output').map((device) => (
                          <div key={device.id} className="border rounded-lg p-3 bg-card hover:bg-accent transition-colors">
                            <div className="flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate flex items-center gap-2">
                                  {device.state === 'connected' ? 
                                    <CheckCircle className="h-3 w-3 text-green-500" /> : 
                                    <div className="h-3 w-3 border border-gray-400 rounded-full" />
                                  }
                                  {device.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {device.manufacturer} • Port {device.portIndex} • v{device.version}
                                </p>
                              </div>
                              <Button
                                size="sm"
                                variant={device.state === 'connected' ? "destructive" : "default"}
                                onClick={() => device.state === 'connected' ? 
                                  handleDisconnectDevice(device) : handleConnectDevice(device)}
                                data-testid={`button-${device.state === 'connected' ? 'disconnect' : 'connect'}-usb-output-${device.id}`}
                                className="ml-2 shrink-0"
                              >
                                {device.state === 'connected' ? (
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
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Live Messages */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-medium">Live USB MIDI Messages</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className="text-xs">
                      {messages.length} messages
                    </Badge>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleClearMessages}
                      data-testid="button-clear-usb-messages"
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
                        <p className="text-sm">Connect USB devices to see live MIDI messages</p>
                      </div>
                    ) : (
                      messages.slice().reverse().map((message, index) => (
                        <div 
                          key={`${message.timestamp}-${index}`} 
                          className={`p-3 bg-muted rounded-lg border-l-4 font-mono text-xs break-all ${
                            message.type === 'sent' ? 'border-green-500' : 
                            message.type === 'received' ? 'border-blue-500' : 'border-gray-500'
                          }`}
                          data-testid={`usb-midi-message-${index}`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs font-semibold ${
                              message.type === 'sent' ? 'text-green-600' : 
                              message.type === 'received' ? 'text-blue-600' : 'text-gray-600'
                            }`}>
                              {message.type === 'sent' ? '📤 SENT' : message.type === 'received' ? '📥 RECEIVED' : '📨 MESSAGE'}
                            </span>
                          </div>
                          {formatMIDIMessage(message)}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Send Commands */}
            <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-blue-200 dark:border-blue-800">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-medium flex items-center gap-2">
                  <Send className="h-4 w-4" />
                  Send USB MIDI Command
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium block mb-2">USB Output Device</label>
                    <select 
                      value={selectedOutputDevice} 
                      onChange={(e) => {
                        const deviceId = e.target.value;
                        setSelectedOutputDevice(deviceId);
                        // Save selected device to localStorage for sequencer
                        if (deviceId) {
                          localStorage.setItem(SELECTED_OUTPUT_DEVICE_KEY, deviceId);
                          console.log(`💾 Saved selected USB output device: ${deviceId}`);
                        } else {
                          localStorage.removeItem(SELECTED_OUTPUT_DEVICE_KEY);
                        }
                      }}
                      className="w-full p-3 border rounded-lg bg-background text-sm"
                      data-testid="select-usb-output-device"
                    >
                      <option value="">Select USB output device...</option>
                      {connectedDevices.filter(d => d.type === 'output').map(device => (
                        <option key={device.id} value={device.id}>
                          {device.name} ({device.manufacturer})
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium block mb-2">MIDI Command</label>
                    <div className="flex gap-2">
                      <Input
                        value={midiCommand}
                        onChange={(e) => setMidiCommand(e.target.value)}
                        placeholder="e.g., [[PC:12:1]], [[CC:7:64:1]], [[NOTE:60:127:1]]"
                        className="font-mono text-sm text-black dark:text-white"
                        data-testid="input-usb-midi-command"
                      />
                      <Button 
                        onClick={handleSendMessage}
                        disabled={!selectedOutputDevice || !midiCommand.trim()}
                        data-testid="button-send-usb-midi"
                        className="shrink-0"
                      >
                        <Send className="h-4 w-4 mr-1" />
                        Send
                      </Button>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">USB MIDI Command Examples:</p>
                  <div className="text-xs text-muted-foreground space-y-1 bg-muted/50 p-3 rounded">
                    <div>• Program Change: <code className="bg-background px-1 rounded">[[PC:12:1]]</code> (Program 12, Channel 1)</div>
                    <div>• Control Change: <code className="bg-background px-1 rounded">[[CC:7:64:1]]</code> (Volume, Channel 1)</div>
                    <div>• Note On: <code className="bg-background px-1 rounded">[[NOTE:60:127:1]]</code> (Middle C, Channel 1)</div>
                    <div>• Legacy: <code className="bg-background px-1 rounded">90 3C 7F</code> (Hex format still supported)</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose} data-testid="button-close-usb-midi">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}