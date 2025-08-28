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
      const access = await navigator.requestMIDIAccess({ sysex: false });
      setMidiAccess(access);
      console.log('✅ MIDI access granted');
      
      // Set up device change listeners
      access.onstatechange = handleDeviceChange;
      
      // Scan for devices
      scanDevices(access);
      onStatusChange?.('Connected');
      
    } catch (error) {
      console.error('❌ Failed to get MIDI access:', error);
      onStatusChange?.('Error');
      toast({
        title: "MIDI Access Failed",
        description: "Could not access MIDI devices",
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
      console.log('🎹 Found input device:', device);

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
      console.log('🎵 Found output device:', device);
    });

    setInputDevices(inputs);
    setOutputDevices(outputs);

    console.log(`📊 Found ${inputs.length} input devices and ${outputs.length} output devices`);
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
        
        {/* Output Devices */}
        <div>
          <h3 className="text-lg font-semibold mb-3">Output Devices</h3>
          {outputDevices.length === 0 ? (
            <p className="text-muted-foreground">No MIDI output devices found</p>
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
            <p className="text-muted-foreground">No MIDI input devices found</p>
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

        {/* Refresh Button */}
        <Button onClick={requestMIDIAccess} variant="outline" className="w-full" data-testid="button-refresh-devices">
          Refresh Devices
        </Button>
      </CardContent>
    </Card>
  );
}