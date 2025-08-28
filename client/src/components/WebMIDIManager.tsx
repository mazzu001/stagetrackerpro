import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Bluetooth, Music, Volume2, Wifi, WifiOff } from 'lucide-react';

interface MIDIDevice {
  id: string;
  name: string;
  manufacturer: string;
  state: string;
  type: 'input' | 'output';
  connection: string;
}

// Web MIDI API type declarations
declare global {
  interface Navigator {
    requestMIDIAccess(options?: { sysex?: boolean }): Promise<MIDIAccess>;
  }
  
  interface MIDIAccess extends EventTarget {
    inputs: Map<string, MIDIInput>;
    outputs: Map<string, MIDIOutput>;
    onstatechange: ((event: MIDIConnectionEvent) => void) | null;
  }
  
  interface MIDIPort extends EventTarget {
    id: string;
    name: string;
    manufacturer: string;
    state: 'connected' | 'disconnected';
    connection: 'open' | 'closed' | 'pending';
    type: 'input' | 'output';
    version: string;
  }
  
  interface MIDIInput extends MIDIPort {
    onmidimessage: ((event: MIDIMessageEvent) => void) | null;
  }
  
  interface MIDIOutput extends MIDIPort {
    send(data: Uint8Array, timestamp?: number): void;
  }
  
  interface MIDIConnectionEvent extends Event {
    port: MIDIPort;
  }
  
  interface MIDIMessageEvent extends Event {
    data: Uint8Array;
    timestamp: number;
    target: MIDIInput;
  }
}

interface WebMIDIManagerProps {
  onStatusChange?: (status: string) => void;
}

export function WebMIDIManager({ onStatusChange }: WebMIDIManagerProps) {
  const [isSupported, setIsSupported] = useState(false);
  const [midiAccess, setMidiAccess] = useState<MIDIAccess | null>(null);
  const [inputDevices, setInputDevices] = useState<MIDIDevice[]>([]);
  const [outputDevices, setOutputDevices] = useState<MIDIDevice[]>([]);
  const [selectedOutput, setSelectedOutput] = useState<MIDIOutput | null>(null);
  const [testMessage, setTestMessage] = useState('[[PC:1:1]]');
  const [midiMessages, setMidiMessages] = useState<string[]>([]);
  const [lastSentMessage, setLastSentMessage] = useState('');
  const { toast } = useToast();

  // Check Web MIDI API support
  useEffect(() => {
    const checkSupport = () => {
      if (navigator.requestMIDIAccess) {
        setIsSupported(true);
        console.log('✅ Web MIDI API is supported');
        requestMIDIAccess();
      } else {
        setIsSupported(false);
        console.log('❌ Web MIDI API is not supported');
        onStatusChange?.('Not Supported');
      }
    };

    checkSupport();
  }, [onStatusChange]);

  // Request MIDI access
  const requestMIDIAccess = async () => {
    try {
      console.log('🎵 Requesting MIDI access...');
      
      // Request access with sysex for broader device compatibility
      const access = await navigator.requestMIDIAccess({ sysex: true });
      setMidiAccess(access);
      console.log('✅ MIDI access granted:', access);
      console.log('📊 MIDI inputs available:', access.inputs.size);
      console.log('📊 MIDI outputs available:', access.outputs.size);
      
      // Set up device change listeners
      access.onstatechange = handleDeviceChange;
      
      // Scan for devices
      scanDevices(access);
      
      if (access.inputs.size > 0 || access.outputs.size > 0) {
        onStatusChange?.('Connected');
      } else {
        onStatusChange?.('No Devices Found');
        console.log('⚠️ No MIDI devices found. Make sure your device is connected and recognized by your system.');
      }
      
    } catch (error) {
      console.error('❌ Failed to get MIDI access:', error);
      onStatusChange?.('Error');
      toast({
        title: "MIDI Access Failed",
        description: "Could not access MIDI devices. Make sure your browser supports Web MIDI API.",
        variant: "destructive",
      });
    }
  };

  // Handle device state changes
  const handleDeviceChange = (event: MIDIConnectionEvent) => {
    console.log('🔄 MIDI device state changed:', {
      port: event.port.name,
      state: event.port.state,
      connection: event.port.connection
    });
    
    if (midiAccess) {
      scanDevices(midiAccess);
    }
  };

  // Scan for MIDI devices
  const scanDevices = (access: MIDIAccess) => {
    const inputs: MIDIDevice[] = [];
    const outputs: MIDIDevice[] = [];

    console.log('🔍 Scanning MIDI devices...');
    console.log('🔍 Total inputs available:', access.inputs.size);
    console.log('🔍 Total outputs available:', access.outputs.size);

    // Log all available ports for debugging
    console.log('🔍 All input ports:');
    access.inputs.forEach((input: MIDIInput, key: string) => {
      console.log(`  - ${key}: ${input.name} (${input.manufacturer}) - State: ${input.state}, Connection: ${input.connection}`);
    });
    
    console.log('🔍 All output ports:');
    access.outputs.forEach((output: MIDIOutput, key: string) => {
      console.log(`  - ${key}: ${output.name} (${output.manufacturer}) - State: ${output.state}, Connection: ${output.connection}`);
    });

    // Scan input devices
    access.inputs.forEach((input: MIDIInput) => {
      const device: MIDIDevice = {
        id: input.id,
        name: input.name || 'Unknown Device',
        manufacturer: input.manufacturer || 'Unknown',
        state: input.state,
        connection: input.connection,
        type: 'input'
      };
      inputs.push(device);
      console.log('🎹 Added input device:', device);

      // Set up message listener
      input.onmidimessage = handleMIDIMessage;
    });

    // Scan output devices
    access.outputs.forEach((output: MIDIOutput) => {
      const device: MIDIDevice = {
        id: output.id,
        name: output.name || 'Unknown Device',
        manufacturer: output.manufacturer || 'Unknown',
        state: output.state,
        connection: output.connection,
        type: 'output'
      };
      outputs.push(device);
      console.log('🎵 Added output device:', device);
    });

    setInputDevices(inputs);
    setOutputDevices(outputs);

    console.log(`📊 Scan complete: ${inputs.length} input devices and ${outputs.length} output devices`);
    
    if (inputs.length === 0 && outputs.length === 0) {
      console.log('⚠️ No MIDI devices detected. Troubleshooting steps:');
      console.log('  1. Ensure your MIDI device is connected to your computer');
      console.log('  2. Check if your device appears in your system MIDI settings');
      console.log('  3. For Bluetooth MIDI devices, ensure they are paired and connected');
      console.log('  4. Try refreshing the page or reconnecting your device');
      console.log('  5. For USB MIDI devices, try a different USB port');
    }
  };

  // Handle incoming MIDI messages
  const handleMIDIMessage = (event: MIDIMessageEvent) => {
    const hexString = Array.from(event.data).map((b: number) => b.toString(16).padStart(2, '0')).join(' ');
    const message = `📥 Received: ${hexString}`;
    console.log('🎵 Received MIDI:', hexString);
    
    setMidiMessages(prev => [message, ...prev.slice(0, 9)]);
  };

  // Connect to output device
  const connectToOutput = (deviceId: string) => {
    if (!midiAccess) return;

    const output = midiAccess.outputs.get(deviceId);
    if (output) {
      setSelectedOutput(output);
      console.log('✅ Connected to output device:', output.name);
      onStatusChange?.(`Connected: ${output.name}`);
      
      toast({
        title: "Device Connected",
        description: `Connected to ${output.name}`,
      });
    }
  };

  // Parse MIDI command from text
  const parseMIDICommand = (command: string): Uint8Array | null => {
    const trimmed = command.trim();
    
    // Parse bracket format: [[PC:12:1]], [[CC:7:64:1]], [[NOTE:60:127:1]]
    const bracketMatch = trimmed.match(/\[\[(\w+):(\d+):(\d+)(?::(\d+))?\]\]/);
    if (bracketMatch) {
      const [, type, value1, value2, channel] = bracketMatch;
      const ch = channel ? parseInt(channel) - 1 : 0; // Convert to 0-based
      
      switch (type.toUpperCase()) {
        case 'PC': // Program Change
          return new Uint8Array([0xC0 | ch, parseInt(value1)]);
        case 'CC': // Control Change  
          return new Uint8Array([0xB0 | ch, parseInt(value1), parseInt(value2)]);
        case 'NOTE': // Note On
          return new Uint8Array([0x90 | ch, parseInt(value1), parseInt(value2)]);
        default:
          return null;
      }
    }

    // Parse hex format: C0 01, B0 07 64
    const hexMatch = trimmed.match(/^([0-9A-Fa-f\s]+)$/);
    if (hexMatch) {
      const hexBytes = trimmed.split(/\s+/).map(b => parseInt(b, 16)).filter(b => !isNaN(b));
      return new Uint8Array(hexBytes);
    }

    return null;
  };

  // Send MIDI command
  const sendMIDICommand = async () => {
    if (!selectedOutput) {
      toast({
        title: "No Device Selected",
        description: "Please connect to an output device first",
        variant: "destructive",
      });
      return;
    }

    const midiBytes = parseMIDICommand(testMessage);
    if (!midiBytes) {
      toast({
        title: "Invalid MIDI Command",
        description: "Use format: [[PC:1:1]] or [[CC:7:64:1]]",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log('🎵 SENDING RAW MIDI:', Array.from(midiBytes).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' '));
      
      // Send raw MIDI bytes directly
      selectedOutput.send(midiBytes);
      
      const hexString = Array.from(midiBytes).map(b => b.toString(16).padStart(2, '0')).join(' ');
      setLastSentMessage(`${testMessage} → ${hexString}`);
      
      const message = `📤 ${testMessage} → ${hexString}`;
      setMidiMessages(prev => [message, ...prev.slice(0, 9)]);
      
      console.log('✅ MIDI sent successfully!');
      
      toast({
        title: "MIDI Sent",
        description: `${testMessage} → ${hexString}`,
      });
      
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
          Web MIDI API Manager
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Debug Info */}
        <div className="bg-muted/50 p-3 rounded-lg text-sm">
          <h4 className="font-medium mb-2">Debug Information</h4>
          <div className="space-y-1 text-muted-foreground">
            <p>Web MIDI API Supported: {isSupported ? '✅ Yes' : '❌ No'}</p>
            <p>MIDI Access: {midiAccess ? '✅ Granted' : '❌ Not Available'}</p>
            <p>Total Devices: {inputDevices.length + outputDevices.length}</p>
            <p>Browser: {navigator.userAgent.includes('Chrome') ? 'Chrome ✅' : navigator.userAgent.includes('Edge') ? 'Edge ✅' : 'Other (may not support Web MIDI)'}</p>
          </div>
          
          {/* WIDI Jack Specific Instructions */}
          {outputDevices.length === 0 && (
            <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <h5 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">WIDI Jack / Bluetooth MIDI Setup:</h5>
              <ol className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1 list-decimal list-inside">
                <li>Pair your WIDI Jack in your system's Bluetooth settings first</li>
                <li>Ensure it shows as "Connected" in Bluetooth settings</li>
                <li>Look for a device named "WIDI Jack" or similar in system MIDI settings</li>
                <li>Windows: Check "MIDI Devices" in Device Manager</li>
                <li>Mac: Check "Audio MIDI Setup" application</li>
                <li>After pairing, click "Refresh Devices" below</li>
              </ol>
            </div>
          )}
        </div>

        {/* Output Devices */}
        <div>
          <h3 className="text-lg font-semibold mb-3">Output Devices</h3>
          {outputDevices.length === 0 ? (
            <div className="text-muted-foreground space-y-2">
              <p>No MIDI output devices found</p>
              <div className="text-xs bg-muted/50 p-3 rounded">
                <p className="font-medium mb-1">Troubleshooting:</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Connect your MIDI device to your computer</li>
                  <li>For Bluetooth MIDI: Pair and connect your device first</li>
                  <li>Check your system's MIDI settings</li>
                  <li>Try clicking "Refresh Devices" below</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="grid gap-2">
              {outputDevices.map((device) => (
                <div key={device.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Music className="h-4 w-4" />
                    <div>
                      <div className="font-medium">{device.name}</div>
                      <div className="text-sm text-muted-foreground">{device.manufacturer}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={device.state === 'connected' ? 'default' : 'secondary'}>
                      {device.state}
                    </Badge>
                    <Button
                      size="sm"
                      onClick={() => connectToOutput(device.id)}
                      disabled={device.state !== 'connected'}
                      variant={selectedOutput?.id === device.id ? 'default' : 'outline'}
                    >
                      {selectedOutput?.id === device.id ? 'Connected' : 'Connect'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Input Devices */}
        <div>
          <h3 className="text-lg font-semibold mb-3">Input Devices</h3>
          {inputDevices.length === 0 ? (
            <div className="text-muted-foreground space-y-2">
              <p>No MIDI input devices found</p>
              <div className="text-xs bg-muted/50 p-3 rounded">
                <p className="font-medium mb-1">Note:</p>
                <p>Input devices are MIDI controllers/keyboards that send data to this app. If you only need to send commands to your device, you only need an output device.</p>
              </div>
            </div>
          ) : (
            <div className="grid gap-2">
              {inputDevices.map((device) => (
                <div key={device.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Volume2 className="h-4 w-4" />
                    <div>
                      <div className="font-medium">{device.name}</div>
                      <div className="text-sm text-muted-foreground">{device.manufacturer}</div>
                    </div>
                  </div>
                  <Badge variant={device.state === 'connected' ? 'default' : 'secondary'}>
                    {device.state}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        <Separator />

        {/* Send MIDI Commands */}
        <div>
          <h3 className="text-lg font-semibold mb-3">Send MIDI Commands</h3>
          <div className="flex gap-2 mb-3">
            <Input
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              placeholder="e.g., [[PC:1:1]] [[CC:7:64:1]] [[NOTE:60:127:1]]"
              className="flex-1"
              data-testid="input-midi-command"
            />
            <Button onClick={sendMIDICommand} disabled={!selectedOutput} data-testid="button-send-midi">
              Send
            </Button>
          </div>

          {/* Quick Test Buttons */}
          <div className="flex flex-wrap gap-2 mb-4">
            {quickCommands.map((cmd) => (
              <Button
                key={cmd.label}
                size="sm"
                variant="outline"
                onClick={() => setTestMessage(cmd.command)}
                data-testid={`button-quick-${cmd.label.toLowerCase().replace(' ', '-')}`}
              >
                {cmd.label}
              </Button>
            ))}
          </div>

          {lastSentMessage && (
            <p className="text-sm text-muted-foreground">
              Last sent: {lastSentMessage}
            </p>
          )}
        </div>

        {/* MIDI Messages */}
        {midiMessages.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-3">MIDI Messages</h3>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {midiMessages.map((message, index) => (
                <div key={index} className="text-sm font-mono bg-muted p-2 rounded">
                  {message}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button onClick={requestMIDIAccess} variant="outline" className="flex-1" data-testid="button-refresh-devices">
            Refresh Devices
          </Button>
          <Button 
            onClick={() => {
              console.log('🔍 System MIDI Check:');
              console.log('Navigator:', navigator);
              console.log('User Agent:', navigator.userAgent);
              console.log('Web MIDI Support:', !!navigator.requestMIDIAccess);
              if (midiAccess) {
                console.log('Current MIDI Access:', midiAccess);
                console.log('Input size:', midiAccess.inputs.size);
                console.log('Output size:', midiAccess.outputs.size);
              }
              
              toast({
                title: "Debug Info Logged",
                description: "Check browser console for detailed system information",
              });
            }}
            variant="outline" 
            className="flex-1"
          >
            Debug Info
          </Button>
        </div>
        
        {/* Additional Help */}
        <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded">
          <p className="font-medium mb-1">Still not seeing your device?</p>
          <p>Web MIDI API only detects devices that are already connected to your operating system. Unlike Bluetooth Web API, it cannot discover or pair new devices.</p>
        </div>
      </CardContent>
    </Card>
  );
}