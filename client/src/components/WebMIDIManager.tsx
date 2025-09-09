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
      console.log('🎵 Requesting Web MIDI access...');
      console.log('🔍 Checking system MIDI availability...');
      
      // Don't await - handle MIDI access in background
      navigator.requestMIDIAccess({ sysex: true })
        .then((access) => {
          setMidiAccess(access);
          
          console.log('✅ Web MIDI access granted successfully');
          console.log('🔍 System reports:', access.inputs.size, 'input devices and', access.outputs.size, 'output devices');
          
          // Additional debugging for paired Bluetooth devices
          console.log('🔍 Detailed device analysis:');
          console.log('  - Web MIDI can only see devices that appear in your system\'s MIDI device list');
          console.log('  - Paired Bluetooth devices must be "connected" (not just paired) to appear');
          console.log('  - Some Bluetooth MIDI devices need to be "activated" in system settings');
          
          // Set up device change listeners
          access.onstatechange = handleDeviceChange;
          
          // Scan for devices
          scanDevices(access);
          
          if (access.inputs.size > 0 || access.outputs.size > 0) {
            onStatusChange?.('Connected');
          } else {
            onStatusChange?.('No System MIDI Devices');
            console.log('⚠️ No MIDI devices detected by system. For Bluetooth MIDI:');
            console.log('  1. Verify device shows as "Connected" in Bluetooth settings');
            console.log('  2. Look for it in system MIDI settings (not just Bluetooth)');
            console.log('  3. Some devices need driver installation or manual activation');
          }
        })
        .catch((error) => {
          console.error('❌ Web MIDI access failed:', error);
          onStatusChange?.('Error');
          toast({
            title: "Web MIDI Access Denied",
            description: "Browser blocked MIDI access. Check permissions and try again.",
            variant: "destructive",
          });
        });
      
    } catch (error) {
      console.error('❌ Web MIDI access failed:', error);
      onStatusChange?.('Error');
      toast({
        title: "Web MIDI Access Denied",
        description: "Browser blocked MIDI access. Check permissions and try again.",
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
      console.log('⚠️ Web MIDI API found no devices. This means:');
      console.log('  - Your system\'s MIDI subsystem has no active MIDI devices');
      console.log('  - Bluetooth MIDI devices must appear in system MIDI settings, not just Bluetooth settings');
      console.log('  - Try: Windows MIDI Settings, Mac Audio MIDI Setup, or Linux ALSA/JACK');
      console.log('  - WIDI Jack should appear as a MIDI device after pairing AND connecting');
      
      // Check for Bluetooth in user agent as additional context
      const hasBluetoothAPI = 'bluetooth' in navigator;
      console.log(`  - Browser Bluetooth API available: ${hasBluetoothAPI}`);
      console.log('  - Web MIDI API is separate from Bluetooth API and only sees system MIDI devices');
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
          
          {/* System MIDI Setup Instructions */}
          {outputDevices.length === 0 && (
            <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <h5 className="font-medium text-red-800 dark:text-red-200 mb-2">Your WIDI Jack is not appearing as a MIDI device</h5>
              <div className="text-sm text-red-700 dark:text-red-300 space-y-3">
                <p className="font-medium">The problem: Web MIDI API only sees devices in your system's MIDI device list.</p>
                
                <div>
                  <p className="font-medium mb-1">Windows Users:</p>
                  <ol className="list-decimal list-inside space-y-1 ml-2">
                    <li>Open Settings → Bluetooth & devices → Make sure WIDI Jack shows "Connected"</li>
                    <li>Open Device Manager → Look for "MIDI" section or "Sound, video and game controllers"</li>
                    <li>If WIDI Jack isn't listed as a MIDI device, try unpairing and re-pairing</li>
                    <li>Some users need to install WIDI Jack drivers manually</li>
                  </ol>
                </div>

                <div>
                  <p className="font-medium mb-1">Mac Users:</p>
                  <ol className="list-decimal list-inside space-y-1 ml-2">
                    <li>Open System Preferences → Bluetooth → Ensure WIDI Jack shows "Connected"</li>
                    <li>Open Applications → Utilities → Audio MIDI Setup</li>
                    <li>Look for WIDI Jack in the MIDI devices list</li>
                    <li>If not there, try forgetting and re-pairing the device</li>
                  </ol>
                </div>

                <p className="text-xs italic">Note: Being "paired" in Bluetooth is not enough - the device must appear in your system's MIDI device list.</p>
              </div>
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
          <p className="font-medium mb-1">Key Difference from Previous Bluetooth Implementation:</p>
          <p>The old version used Bluetooth Web API to connect directly to your WIDI Jack. The new Web MIDI API approach is more reliable but requires your device to be properly installed as a system MIDI device first.</p>
          <p className="mt-2 font-medium">Once your WIDI Jack appears above, MIDI commands will work much more reliably!</p>
        </div>
      </CardContent>
    </Card>
  );
}