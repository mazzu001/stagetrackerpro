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

interface BluetoothDeviceInfo {
  id: string;
  name: string;
  connected: boolean;
  type: 'bluetooth';
  rssi?: number;
  services?: string[];
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
  const [bluetoothDevices, setBluetoothDevices] = useState<BluetoothDeviceInfo[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [midiSupported, setMidiSupported] = useState(true);
  const [bluetoothSupported, setBluetoothSupported] = useState(false);
  const [receivedMessages, setReceivedMessages] = useState<{ device: string; message: string; timestamp: number }[]>([]);
  const [testingDevice, setTestingDevice] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<{ device: string; sent: number; received: number; timestamp: number } | null>(null);
  const { toast } = useToast();

  // Initialize MIDI access and check Bluetooth when dialog opens
  useEffect(() => {
    if (!isOpen) return;

    const initializeDevices = async () => {
      // Check Bluetooth support
      if ('bluetooth' in navigator) {
        setBluetoothSupported(true);
        await scanBluetoothDevices();
      }

      // Initialize MIDI
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

    initializeDevices();
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

  // Scan for Bluetooth devices
  const scanBluetoothDevices = async () => {
    if (!bluetoothSupported) return;

    try {
      // Get already paired devices
      const pairedDevices = await (navigator as any).bluetooth.getDevices();
      const bluetoothList: BluetoothDeviceInfo[] = pairedDevices.map((device: any) => ({
        id: device.id,
        name: device.name || 'Unknown Bluetooth Device',
        connected: device.gatt?.connected || false,
        type: 'bluetooth' as const,
        services: []
      }));

      setBluetoothDevices(bluetoothList);
      console.log('Bluetooth devices found:', bluetoothList);
    } catch (error) {
      console.log('Bluetooth scan failed:', error);
    }
  };

  // Request Bluetooth device pairing with broader filters
  const requestBluetoothDevice = async () => {
    if (!bluetoothSupported) return;

    try {
      setIsScanning(true);
      console.log('Starting Bluetooth device discovery...');
      
      // Try broad discovery first - this should catch most devices
      const device = await (navigator as any).bluetooth.requestDevice({
        filters: [
          // MIDI-specific services
          { services: ['03b80e5a-ede8-4b33-a751-6ce34ec4c700'] }, // Standard MIDI Service
          // Common MIDI device name patterns
          { namePrefix: 'MIDI' },
          { namePrefix: 'BLE-MIDI' },
          { namePrefix: 'Yamaha' },
          { namePrefix: 'Roland' },
          { namePrefix: 'Korg' },
          { namePrefix: 'Matt' }, // For "Matts Pedal"
          { namePrefix: 'Pedal' },
          // Generic patterns that might catch other devices
          { namePrefix: 'BT-' },
          { namePrefix: 'Wireless' },
          // Try to catch devices with "Pedal" in the name
          { name: 'Matts Pedal' }
        ],
        optionalServices: [
          '03b80e5a-ede8-4b33-a751-6ce34ec4c700', // MIDI
          '0000180f-0000-1000-8000-00805f9b34fb', // Battery Service
          '0000180a-0000-1000-8000-00805f9b34fb'  // Device Information
        ]
      });

      console.log('Found Bluetooth device:', device.name, device.id);
      
      toast({
        title: "Bluetooth Device Found",
        description: `Found ${device.name}. Attempting to connect...`,
      });

      // Try to connect to the device
      try {
        await device.gatt?.connect();
        toast({
          title: "Bluetooth Device Connected",
          description: `Connected to ${device.name}. Check MIDI devices section.`,
        });
      } catch (connectError) {
        console.log('Connection failed, but device is paired:', connectError);
        toast({
          title: "Device Paired",
          description: `${device.name} is now paired. It may appear in MIDI devices after refresh.`,
        });
      }

      // Refresh both Bluetooth and MIDI devices
      await scanBluetoothDevices();
      if (midiAccess) {
        scanDevices(midiAccess);
      }
    } catch (error: any) {
      console.log('Bluetooth discovery error:', error);
      if (error.name === 'NotFoundError') {
        toast({
          title: "No Devices Found",
          description: "Make sure your device is in pairing mode and try again.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Bluetooth Discovery Failed",
          description: `${error.message}. Try: 1) Put device in pairing mode 2) Check Windows Bluetooth settings`,
          variant: "destructive",
        });
      }
    } finally {
      setIsScanning(false);
    }
  };

  // Alternative method - try to discover without filters (more permissive)
  const requestAnyBluetoothDevice = async () => {
    if (!bluetoothSupported) return;

    try {
      setIsScanning(true);
      console.log('Starting broad Bluetooth discovery...');
      
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          '03b80e5a-ede8-4b33-a751-6ce34ec4c700', // MIDI
          '0000180f-0000-1000-8000-00805f9b34fb', // Battery
          '0000180a-0000-1000-8000-00805f9b34fb'  // Device Info
        ]
      });

      console.log('Found device with broad search:', device.name, device.id);
      
      toast({
        title: "Device Found",
        description: `Found ${device.name || 'Unknown Device'}. Checking for MIDI capability...`,
      });

      // Refresh devices
      await scanBluetoothDevices();
      if (midiAccess) {
        scanDevices(midiAccess);
      }
    } catch (error: any) {
      console.log('Broad discovery error:', error);
      toast({
        title: "Discovery Failed",
        description: error.message || "Unable to discover devices",
        variant: "destructive",
      });
    } finally {
      setIsScanning(false);
    }
  };

  // Refresh devices manually
  const refreshDevices = async () => {
    setIsScanning(true);
    
    // Refresh Bluetooth devices
    if (bluetoothSupported) {
      await scanBluetoothDevices();
    }
    
    // Refresh MIDI devices
    if (midiAccess) {
      scanDevices(midiAccess);
    }
    
    setTimeout(() => setIsScanning(false), 1000);
  };

  // Full duplex test - send commands and monitor responses
  const testDeviceFullDuplex = async (deviceId: string) => {
    if (!midiAccess || testingDevice) return;

    const output = midiAccess.outputs.get(deviceId);
    const input = Array.from(midiAccess.inputs.values()).find(inp => 
      inp.name === output?.name || inp.manufacturer === output?.manufacturer
    );

    if (!output || output.state !== 'connected') {
      toast({
        title: "Output Device Not Ready",
        description: "Device is not connected or available for sending",
        variant: "destructive",
      });
      return;
    }

    setTestingDevice(deviceId);
    let sentCount = 0;
    let receivedCount = 0;
    const testStartTime = Date.now();

    // Set up temporary listener for test responses
    const testListener = (event: any) => {
      receivedCount++;
      setTestResults({ device: output.name || 'Unknown', sent: sentCount, received: receivedCount, timestamp: Date.now() });
    };

    if (input && input.state === 'connected') {
      input.onmidimessage = testListener;
    }

    try {
      // Send comprehensive test sequence
      const testSequence = [
        // Note test
        [0x90, 60, 127], // Note on C4
        [0x80, 60, 0],   // Note off C4
        [0x90, 64, 100], // Note on E4
        [0x80, 64, 0],   // Note off E4
        
        // Control change test
        [0xB0, 1, 64],   // Modulation wheel
        [0xB0, 7, 100],  // Volume
        [0xB0, 10, 64],  // Pan center
        
        // Program change test
        [0xC0, 1],       // Program change to 1
        [0xC0, 0],       // Program change back to 0
      ];

      for (let i = 0; i < testSequence.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 100)); // Small delay between commands
        output.send(testSequence[i]);
        sentCount++;
        setTestResults({ device: output.name || 'Unknown', sent: sentCount, received: receivedCount, timestamp: Date.now() });
      }

      // Wait a bit for any delayed responses
      await new Promise(resolve => setTimeout(resolve, 500));

      const testDuration = Date.now() - testStartTime;
      toast({
        title: "Full Duplex Test Complete",
        description: `Sent: ${sentCount} commands, Received: ${receivedCount} responses (${testDuration}ms)`,
      });

    } catch (error) {
      toast({
        title: "Test Failed",
        description: "Failed to complete full duplex test",
        variant: "destructive",
      });
    } finally {
      // Restore normal listener
      if (input && input.state === 'connected') {
        const device = devices.find(d => d.id === input.id);
        if (device) {
          setupMIDIInputListener(input, device);
        }
      }
      setTestingDevice(null);
    }
  };

  // Simple test - just send a note
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
      <DialogContent className="max-w-6xl max-h-[90vh]" data-testid="dialog-midi-manager">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Music className="w-5 h-5" />
            MIDI & Bluetooth Device Manager
            <Badge variant="outline" className="ml-auto">
              {connectedDevices.length} MIDI Connected
            </Badge>
          </DialogTitle>
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
              
              <div className="flex items-center gap-2">
                {bluetoothSupported ? (
                  <CheckCircle className="w-4 h-4 text-blue-500" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-gray-400" />
                )}
                <span className="text-sm">
                  {bluetoothSupported ? 'Bluetooth Ready' : 'Bluetooth Not Available'}
                </span>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button
                onClick={refreshDevices}
                disabled={isScanning}
                size="sm"
                variant="outline"
                data-testid="button-refresh-devices"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isScanning ? 'animate-spin' : ''}`} />
                {isScanning ? 'Scanning...' : 'Refresh'}
              </Button>
              
              {bluetoothSupported && (
                <div className="flex gap-2">
                  <Button
                    onClick={requestBluetoothDevice}
                    disabled={isScanning}
                    size="sm"
                    variant="default"
                    data-testid="button-pair-bluetooth"
                  >
                    <Bluetooth className="w-4 h-4 mr-2" />
                    Pair MIDI
                  </Button>
                  <Button
                    onClick={requestAnyBluetoothDevice}
                    disabled={isScanning}
                    size="sm"
                    variant="outline"
                    data-testid="button-pair-any-bluetooth"
                  >
                    <Bluetooth className="w-4 h-4 mr-2" />
                    Find Any
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Three Column Layout */}
          <div className="grid grid-cols-1 xl:grid-cols-3 lg:grid-cols-2 gap-4">
            {/* Left Side: Bluetooth Devices - Expanded */}
            <div className="space-y-3">
              <h3 className="font-medium text-base">Bluetooth Devices</h3>
              
              <ScrollArea className="h-80 border rounded-md p-2">
                {!bluetoothSupported ? (
                  <div className="text-center text-gray-500 py-8 text-sm">
                    Bluetooth not supported<br />
                    <span className="text-xs">Your browser doesn't support Bluetooth</span>
                  </div>
                ) : bluetoothDevices.length === 0 ? (
                  <div className="text-center text-gray-500 py-8 text-sm">
                    No Bluetooth devices found<br />
                    <span className="text-xs">Click "Pair Device" to add MIDI devices</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {bluetoothDevices.map((device) => (
                      <div
                        key={device.id}
                        className="flex items-center justify-between p-3 border rounded-md bg-blue-50 dark:bg-blue-950"
                        data-testid={`bluetooth-device-${device.id}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Bluetooth className="w-4 h-4 text-blue-500 flex-shrink-0" />
                            <p className="font-medium truncate">{device.name}</p>
                            <div className={`w-2 h-2 rounded-full ${device.connected ? 'bg-green-500' : 'bg-gray-400'}`} />
                          </div>
                          <p className="text-xs text-gray-500">
                            {device.connected ? 'Connected' : 'Paired but disconnected'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* Middle: MIDI Devices - Moved up */}
            <div className="space-y-2">
              <h3 className="font-medium text-base">MIDI Devices</h3>
              
              {/* Input Devices */}
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2 text-blue-600 text-sm">
                  <Activity className="w-4 h-4" />
                  Input Devices ({inputDevices.length})
                </h4>
                <ScrollArea className="h-32 border rounded-md p-2">
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
                <h4 className="font-medium flex items-center gap-2 text-green-600 text-sm">
                  <Music className="w-4 h-4" />
                  Output Devices ({outputDevices.length})
                </h4>
                <ScrollArea className="h-32 border rounded-md p-2">
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
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => testDevice(device.id)}
                              disabled={!device.enabled || testingDevice === device.id}
                              data-testid={`button-test-${device.id}`}
                              className="h-8 px-2 text-xs"
                            >
                              Test
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => testDeviceFullDuplex(device.id)}
                              disabled={!device.enabled || testingDevice === device.id}
                              data-testid={`button-duplex-test-${device.id}`}
                              className="h-8 px-2 text-xs"
                            >
                              {testingDevice === device.id ? 'Testing...' : 'Full Test'}
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

            {/* Right Side: Activity Monitor & Test Results */}
            <div className="space-y-3">
              <h3 className="font-medium text-base">Activity & Testing</h3>
              
              {/* Test Results */}
              {testResults && (
                <div className="p-3 border rounded-md bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                  <h4 className="font-medium text-green-800 dark:text-green-200 mb-2">
                    Last Test Results - {testResults.device}
                  </h4>
                  <div className="text-sm text-green-700 dark:text-green-300 space-y-1">
                    <p><strong>Sent:</strong> {testResults.sent} commands</p>
                    <p><strong>Received:</strong> {testResults.received} responses</p>
                    <p><strong>Success Rate:</strong> {testResults.sent > 0 ? Math.round((testResults.received / testResults.sent) * 100) : 0}%</p>
                    <p className="text-xs">
                      {new Date(testResults.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              )}
              
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Recent Messages
                </h4>
                <ScrollArea className="h-48 border rounded-md p-3 bg-gray-50 dark:bg-gray-900">
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
          <div className="p-4 border rounded-md bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
            <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">
              Connection Instructions
            </h4>
            <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
              <p><strong>USB MIDI:</strong> Connect your device and click "Refresh" to scan</p>
              <p><strong>Bluetooth MIDI:</strong> Click "Pair MIDI" for standard MIDI devices, or "Find Any" for other Bluetooth devices</p>
              <p><strong>For "Matts Pedal" type devices:</strong> First pair in Windows Bluetooth settings, then click "Find Any"</p>
              <p><strong>Virtual MIDI:</strong> Software instruments and DAWs will appear automatically</p>
              <p><strong>Testing:</strong> Use "Test" for simple note sending or "Full Test" for duplex communication testing</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}