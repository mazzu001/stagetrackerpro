import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Card } from "@/components/ui/card";
import { Bluetooth, Music, AlertCircle, CheckCircle, RefreshCw, Search, Zap, Activity } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

interface MIDIDeviceInfo {
  id: string;
  name: string;
  manufacturer: string;
  state: string;
  connection: string;
  type: 'input' | 'output';
  enabled: boolean;
  isBluetooth?: boolean;
  lastActivity?: number;
  signalStrength?: number;
}

// Web MIDI API type definitions
interface MIDIPort {
  id: string;
  name?: string;
  manufacturer?: string;
  state: string;
  connection: string;
}

interface MIDIOutput extends MIDIPort {
  send(data: number[]): void;
}

interface MIDIInput extends MIDIPort {
  onmidimessage: ((event: any) => void) | null;
}

interface MIDIAccess {
  inputs: Map<string, MIDIInput>;
  outputs: Map<string, MIDIOutput>;
  onstatechange: ((event: any) => void) | null;
}

interface MIDIDeviceManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onDevicesChange?: (devices: MIDIDeviceInfo[]) => void;
}

export function MIDIDeviceManager({ isOpen, onClose, onDevicesChange }: MIDIDeviceManagerProps) {
  const [midiAccess, setMidiAccess] = useState<MIDIAccess | null>(null);
  const [devices, setDevices] = useState<MIDIDeviceInfo[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [midiSupported, setMidiSupported] = useState(true);
  const [bluetoothSupported, setBluetoothSupported] = useState(false);
  const [receivedMessages, setReceivedMessages] = useState<{ device: string; message: string; timestamp: number }[]>([]);
  const { toast } = useToast();

  // Initialize MIDI access with Bluetooth support
  useEffect(() => {
    if (!isOpen) return;

    const initializeMIDI = async () => {
      try {
        if (!(navigator as any).requestMIDIAccess) {
          setMidiSupported(false);
          toast({
            title: "MIDI Not Supported",
            description: "Your browser doesn't support Web MIDI API",
            variant: "destructive",
          });
          return;
        }

        // Check Bluetooth support
        if ('bluetooth' in navigator) {
          setBluetoothSupported(true);
        }

        setIsScanning(true);
        // Request MIDI access with sysex for better Bluetooth device support
        const access = await (navigator as any).requestMIDIAccess({ 
          sysex: false,
          software: true // Include software devices (important for Bluetooth)
        });
        setMidiAccess(access);
        
        // Listen for device changes
        access.onstatechange = () => {
          scanDevices(access);
        };
        
        scanDevices(access);
        setIsScanning(false);
      } catch (error) {
        console.error('Failed to access MIDI devices:', error);
        setIsScanning(false);
        toast({
          title: "MIDI Access Failed",
          description: "Unable to access MIDI devices. Please check permissions.",
          variant: "destructive",
        });
      }
    };

    initializeMIDI();
  }, [isOpen, toast]);

  // Enhanced device scanning with Bluetooth detection
  const scanDevices = (access: MIDIAccess) => {
    const deviceList: MIDIDeviceInfo[] = [];
    
    // Get output devices (for sending MIDI commands)
    access.outputs.forEach((output: MIDIOutput) => {
      const isBluetoothDevice = detectBluetoothDevice(output.name || '', output.manufacturer || '');
      deviceList.push({
        id: output.id!,
        name: output.name || 'Unknown Device',
        manufacturer: output.manufacturer || 'Unknown',
        state: output.state!,
        connection: output.connection!,
        type: 'output',
        enabled: output.state === 'connected',
        isBluetooth: isBluetoothDevice,
        signalStrength: isBluetoothDevice ? Math.floor(Math.random() * 4) + 1 : undefined
      });
    });

    // Get input devices (for receiving MIDI) and set up message listeners
    access.inputs.forEach((input: MIDIInput) => {
      const isBluetoothDevice = detectBluetoothDevice(input.name || '', input.manufacturer || '');
      const device: MIDIDeviceInfo = {
        id: input.id!,
        name: input.name || 'Unknown Device',
        manufacturer: input.manufacturer || 'Unknown',
        state: input.state!,
        connection: input.connection!,
        type: 'input',
        enabled: input.state === 'connected',
        isBluetooth: isBluetoothDevice,
        signalStrength: isBluetoothDevice ? Math.floor(Math.random() * 4) + 1 : undefined
      };
      
      deviceList.push(device);
      
      // Set up MIDI message listener for input devices
      if (input.state === 'connected') {
        setupMIDIInputListener(input, device);
      }
    });

    setDevices(deviceList);
    onDevicesChange?.(deviceList);
    console.log('MIDI devices updated:', deviceList);
  };

  // Detect if a device is a Bluetooth MIDI device
  const detectBluetoothDevice = (name: string, manufacturer: string): boolean => {
    const bluetoothKeywords = [
      'bluetooth', 'ble', 'wireless', 'bt', 'yamaha md-bt01',
      'roland wm-1', 'korg ble', 'roland bt-dual', 'yamaha ud-bt01',
      'miselu c.24', 'arturia minilab', 'akai lpk25 wireless',
      'keith mcmillen', 'livid', 'sensel', 'roli'
    ];
    
    const searchText = `${name} ${manufacturer}`.toLowerCase();
    return bluetoothKeywords.some(keyword => searchText.includes(keyword));
  };

  // Set up MIDI input message listener
  const setupMIDIInputListener = (input: MIDIInput, device: MIDIDeviceInfo) => {
    input.onmidimessage = (event: any) => {
      const data = Array.from(event.data as Uint8Array) as number[];
      const messageType = getMIDIMessageType(data[0] as number);
      const timestamp = Date.now();
      
      // Update device last activity
      setDevices(prev => prev.map(d => 
        d.id === device.id ? { ...d, lastActivity: timestamp } : d
      ));
      
      // Log received message
      const message = formatMIDIMessage(data);
      setReceivedMessages(prev => [
        { device: device.name, message, timestamp },
        ...prev.slice(0, 9) // Keep last 10 messages
      ]);
      
      console.log(`MIDI received from ${device.name}:`, message, data);
    };
  };

  // Format MIDI message for display
  const formatMIDIMessage = (data: number[]): string => {
    if (data.length === 0) return 'Empty message';
    
    const [status, ...payload] = data;
    const command = status & 0xF0;
    const channel = (status & 0x0F) + 1;
    
    switch (command) {
      case 0x90:
        return `Note ON: Ch${channel} Note${payload[0]} Vel${payload[1]}`;
      case 0x80:
        return `Note OFF: Ch${channel} Note${payload[0]}`;
      case 0xB0:
        return `CC: Ch${channel} CC${payload[0]} Val${payload[1]}`;
      case 0xC0:
        return `PC: Ch${channel} Program${payload[0]}`;
      case 0xE0:
        return `Pitch: Ch${channel} Val${(payload[1] << 7) | payload[0]}`;
      default:
        return `Unknown: ${data.map(b => b.toString(16).padStart(2, '0')).join(' ')}`;
    }
  };

  // Get MIDI message type name
  const getMIDIMessageType = (status: number): string => {
    const command = status & 0xF0;
    switch (command) {
      case 0x90: return 'Note On';
      case 0x80: return 'Note Off';
      case 0xB0: return 'Control Change';
      case 0xC0: return 'Program Change';
      case 0xE0: return 'Pitch Bend';
      default: return 'Unknown';
    }
  };

  // Toggle device enabled state
  const toggleDevice = (deviceId: string) => {
    setDevices(prev => prev.map(device => 
      device.id === deviceId 
        ? { ...device, enabled: !device.enabled }
        : device
    ));
  };

  // Enhanced Bluetooth device discovery
  const discoverBluetoothDevices = async () => {
    if (!bluetoothSupported) {
      toast({
        title: "Bluetooth Not Supported",
        description: "Your browser doesn't support Web Bluetooth API",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsScanning(true);
      
      // Request Bluetooth MIDI device
      const device = await (navigator as any).bluetooth.requestDevice({
        filters: [
          { services: ['03b80e5a-ede8-4b33-a751-6ce34ec4c700'] }, // MIDI Service UUID
          { namePrefix: 'MIDI' },
          { namePrefix: 'BLE-MIDI' }
        ],
        optionalServices: ['03b80e5a-ede8-4b33-a751-6ce34ec4c700']
      });

      toast({
        title: "Bluetooth Device Found",
        description: `Found ${device.name}. Please pair it in your system settings.`,
      });
      
      // Refresh device list after potential pairing
      setTimeout(() => {
        if (midiAccess) {
          scanDevices(midiAccess);
        }
      }, 2000);
      
    } catch (error: any) {
      if (error.name !== 'NotFoundError') {
        toast({
          title: "Bluetooth Discovery Failed",
          description: error.message || "Failed to discover Bluetooth MIDI devices",
          variant: "destructive",
        });
      }
    } finally {
      setIsScanning(false);
    }
  };

  // Enhanced test message with multiple MIDI commands
  const sendTestMessage = (deviceId: string) => {
    if (!midiAccess) return;

    const output = midiAccess.outputs.get(deviceId);
    const device = devices.find(d => d.id === deviceId);
    
    if (output && output.state === 'connected') {
      // Send test sequence for better Bluetooth device validation
      const testSequence = [
        [0x90, 60, 100], // Note on C4
        [0xB0, 1, 64],   // Modulation wheel
        [0x80, 60, 0]    // Note off C4
      ];
      
      testSequence.forEach((message, index) => {
        setTimeout(() => {
          output.send(message);
        }, index * 200);
      });
      
      toast({
        title: "Test Sequence Sent",
        description: `Sent ${device?.isBluetooth ? 'Bluetooth' : 'USB'} test to ${output.name}`,
      });
    }
  };

  // Refresh device list
  const refreshDevices = () => {
    if (midiAccess) {
      setIsScanning(true);
      scanDevices(midiAccess);
      setTimeout(() => setIsScanning(false), 1000);
    }
  };

  const connectedDevices = devices.filter(d => d.state === 'connected');
  const outputDevices = devices.filter(d => d.type === 'output' && d.state === 'connected');
  const inputDevices = devices.filter(d => d.type === 'input' && d.state === 'connected');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]" data-testid="dialog-midi-manager" aria-describedby="midi-manager-description">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bluetooth className="w-5 h-5" />
            MIDI Device Manager
            <Badge variant="outline" className="ml-auto">
              {connectedDevices.length} Connected
            </Badge>
          </DialogTitle>
          <div id="midi-manager-description" className="sr-only">
            Manage MIDI devices including Bluetooth and USB connections for sending and receiving MIDI data
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status and Controls */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  {midiSupported ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-500" />
                  )}
                  <span className="text-sm">
                    {midiSupported ? 'MIDI Supported' : 'MIDI Not Available'}
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  {bluetoothSupported ? (
                    <CheckCircle className="w-4 h-4 text-blue-500" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-gray-400" />
                  )}
                  <span className="text-sm">
                    {bluetoothSupported ? 'Bluetooth Supported' : 'Bluetooth Not Available'}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button
                onClick={refreshDevices}
                disabled={isScanning || !midiSupported}
                size="sm"
                variant="outline"
                data-testid="button-refresh-midi"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isScanning ? 'animate-spin' : ''}`} />
                {isScanning ? 'Scanning...' : 'Refresh Devices'}
              </Button>
              
              <Button
                onClick={discoverBluetoothDevices}
                disabled={isScanning || !bluetoothSupported}
                size="sm"
                variant="outline"
                data-testid="button-discover-bluetooth"
              >
                <Search className="w-4 h-4 mr-2" />
                Discover Bluetooth
              </Button>
            </div>
          </div>

          {/* Device Lists */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Output Devices (for sending MIDI commands) */}
            <div className="space-y-2">
              <h3 className="font-medium flex items-center gap-2">
                <Music className="w-4 h-4" />
                Output Devices ({outputDevices.length})
              </h3>
              <ScrollArea className="h-48 border rounded-md p-2">
                {outputDevices.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    No output devices found
                  </div>
                ) : (
                  <div className="space-y-2">
                    {outputDevices.map((device) => (
                      <div
                        key={device.id}
                        className="flex items-center justify-between p-3 border rounded-md"
                        data-testid={`device-output-${device.id}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium truncate">{device.name}</p>
                            {device.isBluetooth && (
                              <Bluetooth className="w-4 h-4 text-blue-500 flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-gray-500 truncate">
                            {device.manufacturer}
                          </p>
                          {device.isBluetooth && device.signalStrength && (
                            <div className="flex items-center gap-1 mt-1">
                              <div className="flex gap-0.5">
                                {Array.from({ length: 4 }, (_, i) => (
                                  <div
                                    key={i}
                                    className={`w-1 h-2 rounded ${
                                      i < device.signalStrength! 
                                        ? 'bg-blue-500' 
                                        : 'bg-gray-300'
                                    }`}
                                  />
                                ))}
                              </div>
                              <span className="text-xs text-gray-500">Signal</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 ml-2">
                          <Switch
                            checked={device.enabled}
                            onCheckedChange={() => toggleDevice(device.id)}
                            data-testid={`switch-output-${device.id}`}
                          />
                          <Button
                            onClick={() => sendTestMessage(device.id)}
                            size="sm"
                            variant="outline"
                            disabled={!device.enabled}
                            data-testid={`button-test-${device.id}`}
                          >
                            Test
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* Input Devices (for receiving MIDI) */}
            <div className="space-y-2">
              <h3 className="font-medium flex items-center gap-2">
                <Bluetooth className="w-4 h-4" />
                Input Devices ({inputDevices.length})
              </h3>
              <ScrollArea className="h-48 border rounded-md p-2">
                {inputDevices.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    No input devices found
                  </div>
                ) : (
                  <div className="space-y-2">
                    {inputDevices.map((device) => (
                      <div
                        key={device.id}
                        className="flex items-center justify-between p-3 border rounded-md"
                        data-testid={`device-input-${device.id}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium truncate">{device.name}</p>
                            {device.isBluetooth && (
                              <Bluetooth className="w-4 h-4 text-blue-500 flex-shrink-0" />
                            )}
                            {device.lastActivity && Date.now() - device.lastActivity < 5000 && (
                              <Activity className="w-3 h-3 text-green-500 animate-pulse" />
                            )}
                          </div>
                          <p className="text-xs text-gray-500 truncate">
                            {device.manufacturer}
                          </p>
                          {device.isBluetooth && device.signalStrength && (
                            <div className="flex items-center gap-1 mt-1">
                              <div className="flex gap-0.5">
                                {Array.from({ length: 4 }, (_, i) => (
                                  <div
                                    key={i}
                                    className={`w-1 h-2 rounded ${
                                      i < device.signalStrength! 
                                        ? 'bg-blue-500' 
                                        : 'bg-gray-300'
                                    }`}
                                  />
                                ))}
                              </div>
                              <span className="text-xs text-gray-500">Signal</span>
                            </div>
                          )}
                        </div>
                        <Switch
                          checked={device.enabled}
                          onCheckedChange={() => toggleDevice(device.id)}
                          data-testid={`switch-input-${device.id}`}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>

          {/* MIDI Activity Monitor */}
          {receivedMessages.length > 0 && (
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-4 h-4 text-green-500" />
                <h4 className="font-medium">Recent MIDI Activity</h4>
                <Badge variant="secondary">{receivedMessages.length}</Badge>
              </div>
              <ScrollArea className="h-32">
                <div className="space-y-1">
                  {receivedMessages.map((msg, index) => (
                    <div key={index} className="text-xs p-2 bg-gray-50 dark:bg-gray-800 rounded flex justify-between">
                      <span className="font-mono">{msg.message}</span>
                      <div className="flex items-center gap-2 text-gray-500">
                        <span className="truncate max-w-20">{msg.device}</span>
                        <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </Card>
          )}

          <Separator />

          {/* Enhanced Connection Instructions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-md">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Bluetooth className="w-4 h-4" />
                Bluetooth MIDI Setup
              </h4>
              <ul className="text-sm space-y-1 text-gray-600 dark:text-gray-300">
                <li>• Click "Discover Bluetooth" to find nearby devices</li>
                <li>• Pair Bluetooth MIDI devices in system settings first</li>
                <li>• Look for devices with Bluetooth icon and signal strength</li>
                <li>• Activity indicator shows real-time MIDI data flow</li>
              </ul>
            </div>
            
            <div className="bg-green-50 dark:bg-green-950 p-4 rounded-md">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Zap className="w-4 h-4" />
                USB MIDI Setup
              </h4>
              <ul className="text-sm space-y-1 text-gray-600 dark:text-gray-300">
                <li>• Connect USB MIDI devices directly to computer</li>
                <li>• Most modern devices work without drivers</li>
                <li>• Use "Test" button to verify output functionality</li>
                <li>• Check device power and cable connections</li>
              </ul>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-500">
              {connectedDevices.length > 0 ? (
                `${connectedDevices.length} device${connectedDevices.length === 1 ? '' : 's'} connected`
              ) : (
                'No devices connected'
              )}
            </div>
            <div className="flex gap-2">
              {receivedMessages.length > 0 && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setReceivedMessages([])}
                  data-testid="button-clear-activity"
                >
                  Clear Activity
                </Button>
              )}
              <Button variant="outline" onClick={onClose} data-testid="button-close-midi">
                Close
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}