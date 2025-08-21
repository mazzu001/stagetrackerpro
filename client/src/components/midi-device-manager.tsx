import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Bluetooth, Music, AlertCircle, CheckCircle, RefreshCw, Usb, Activity } from 'lucide-react';
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
  const [receivedMessages, setReceivedMessages] = useState<{ device: string; message: string; timestamp: number }[]>([]);
  const { toast } = useToast();

  // Initialize MIDI access when dialog opens
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

        setIsScanning(true);
        const access = await (navigator as any).requestMIDIAccess({ 
          sysex: false,
          software: true // Include software devices
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
          description: "Unable to access MIDI devices. Check your browser permissions.",
          variant: "destructive",
        });
      }
    };

    initializeMIDI();
  }, [isOpen, toast]);

  // Scan for available MIDI devices
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
      
      // Broadcast MIDI message as custom event for lyrics editor to capture
      const midiEvent = new CustomEvent('midiMessage', {
        detail: {
          device: device.name,
          data: data,
          timestamp: timestamp
        }
      });
      window.dispatchEvent(midiEvent);
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

  // Refresh devices manually
  const refreshDevices = () => {
    if (midiAccess) {
      setIsScanning(true);
      scanDevices(midiAccess);
      setTimeout(() => setIsScanning(false), 1000);
    }
  };

  // Test MIDI device by sending a simple message
  const testDevice = (deviceId: string) => {
    if (!midiAccess) return;

    const output = midiAccess.outputs.get(deviceId);
    if (!output || output.state !== 'connected') {
      toast({
        title: "Device Not Ready",
        description: "Device is not connected or available",
        variant: "destructive",
      });
      return;
    }

    try {
      // Send a simple test sequence: Note on C4, wait, Note off C4
      output.send([0x90, 60, 127]); // Note on C4
      setTimeout(() => {
        output.send([0x80, 60, 0]); // Note off C4
      }, 200);
      
      toast({
        title: "Test Signal Sent",
        description: "Sent test note to device",
      });
    } catch (error) {
      toast({
        title: "Test Failed",
        description: "Failed to send test signal",
        variant: "destructive",
      });
    }
  };

  const connectedDevices = devices.filter(d => d.state === 'connected');
  const outputDevices = devices.filter(d => d.type === 'output' && d.state === 'connected');
  const inputDevices = devices.filter(d => d.type === 'input' && d.state === 'connected');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh]" data-testid="dialog-midi-manager" aria-describedby="midi-manager-description">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Music className="w-5 h-5" />
            MIDI Devices
            <Badge variant="outline" className="ml-auto">
              {connectedDevices.length} Connected
            </Badge>
          </DialogTitle>
          <div id="midi-manager-description" className="sr-only">
            Manage MIDI devices for sending and receiving MIDI data during performance
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status and Controls */}
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
            </div>
            
            <Button
              onClick={refreshDevices}
              disabled={isScanning || !midiSupported}
              size="sm"
              variant="outline"
              data-testid="button-refresh-midi"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isScanning ? 'animate-spin' : ''}`} />
              {isScanning ? 'Scanning...' : 'Refresh'}
            </Button>
          </div>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Side: Available Devices */}
            <div className="space-y-4">
              <h3 className="font-medium text-lg">Available MIDI Devices</h3>
              
              {/* Input Devices */}
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2 text-blue-600">
                  <Activity className="w-4 h-4" />
                  Input Devices ({inputDevices.length})
                </h4>
                <ScrollArea className="h-40 border rounded-md p-2">
                  {inputDevices.length === 0 ? (
                    <div className="text-center text-gray-500 py-8 text-sm">
                      No input devices found<br />
                      <span className="text-xs">Connect a MIDI keyboard or controller</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {inputDevices.map((device) => (
                        <div
                          key={device.id}
                          className="flex items-center justify-between p-3 border rounded-md bg-blue-50 dark:bg-blue-950"
                          data-testid={`device-input-${device.id}`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium truncate">{device.name}</p>
                              {device.isBluetooth ? (
                                <Bluetooth className="w-4 h-4 text-blue-500 flex-shrink-0" />
                              ) : (
                                <Usb className="w-4 h-4 text-gray-500 flex-shrink-0" />
                              )}
                              {device.lastActivity && Date.now() - device.lastActivity < 2000 && (
                                <Activity className="w-3 h-3 text-green-500 animate-pulse" />
                              )}
                            </div>
                            <p className="text-xs text-gray-500 truncate">
                              {device.manufacturer}
                            </p>
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

              {/* Output Devices */}
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2 text-green-600">
                  <Music className="w-4 h-4" />
                  Output Devices ({outputDevices.length})
                </h4>
                <ScrollArea className="h-40 border rounded-md p-2">
                  {outputDevices.length === 0 ? (
                    <div className="text-center text-gray-500 py-8 text-sm">
                      No output devices found<br />
                      <span className="text-xs">Connect a MIDI synthesizer or interface</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {outputDevices.map((device) => (
                        <div
                          key={device.id}
                          className="flex items-center justify-between p-3 border rounded-md bg-green-50 dark:bg-green-950"
                          data-testid={`device-output-${device.id}`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium truncate">{device.name}</p>
                              {device.isBluetooth ? (
                                <Bluetooth className="w-4 h-4 text-blue-500 flex-shrink-0" />
                              ) : (
                                <Usb className="w-4 h-4 text-gray-500 flex-shrink-0" />
                              )}
                            </div>
                            <p className="text-xs text-gray-500 truncate">
                              {device.manufacturer}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => testDevice(device.id)}
                              disabled={!device.enabled}
                              data-testid={`button-test-${device.id}`}
                              className="h-8 px-2 text-xs"
                            >
                              Test
                            </Button>
                            <Switch
                              checked={device.enabled}
                              onCheckedChange={() => toggleDevice(device.id)}
                              data-testid={`switch-output-${device.id}`}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </div>

            {/* Right Side: Activity Monitor */}
            <div className="space-y-4">
              <h3 className="font-medium text-lg">MIDI Activity</h3>
              
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Recent Messages
                </h4>
                <ScrollArea className="h-80 border rounded-md p-3 bg-gray-50 dark:bg-gray-900">
                  {receivedMessages.length === 0 ? (
                    <div className="text-center text-gray-500 py-8 text-sm">
                      No MIDI activity<br />
                      <span className="text-xs">Play notes or move controls on your MIDI device</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {receivedMessages.map((msg, index) => (
                        <div
                          key={index}
                          className="p-2 border rounded text-xs font-mono bg-white dark:bg-gray-800"
                        >
                          <div className="flex justify-between items-start mb-1">
                            <span className="font-semibold text-blue-600 dark:text-blue-400">
                              {msg.device}
                            </span>
                            <span className="text-gray-500 text-xs">
                              {new Date(msg.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          <div className="text-gray-700 dark:text-gray-300">
                            {msg.message}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </div>
          </div>

          {/* Connection Instructions */}
          {connectedDevices.length === 0 && (
            <div className="p-4 border rounded-md bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
              <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">
                How to Connect MIDI Devices
              </h4>
              <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                <p><strong>USB MIDI:</strong> Connect your device and it will appear automatically</p>
                <p><strong>Bluetooth MIDI:</strong> Pair the device in your system Bluetooth settings first, then refresh</p>
                <p><strong>Virtual MIDI:</strong> Software instruments and DAWs will appear as available devices</p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}