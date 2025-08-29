import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { 
  Usb, 
  Power, 
  PowerOff, 
  Send, 
  Monitor, 
  AlertCircle, 
  CheckCircle2, 
  Zap,
  RefreshCw,
  Volume2,
  VolumeX,
  TestTube,
  Loader2
} from 'lucide-react';

interface MIDIDevice {
  id: string;
  name: string;
  manufacturer: string;
  state: string;
  connection: string;
  type: 'input' | 'output';
  port: any; // WebMIDI port object
}

interface MIDIMessage {
  timestamp: number;
  data: number[];
  formatted: string;
  direction: 'in' | 'out';
}

export function USBMidiManager() {
  const [midiAccess, setMidiAccess] = useState<any>(null);
  const [inputDevices, setInputDevices] = useState<MIDIDevice[]>([]);
  const [outputDevices, setOutputDevices] = useState<MIDIDevice[]>([]);
  const [selectedInputId, setSelectedInputId] = useState<string>('');
  const [selectedOutputId, setSelectedOutputId] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);
  const [midiCommand, setMidiCommand] = useState('');
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [messages, setMessages] = useState<MIDIMessage[]>([]);
  const [isSupported, setIsSupported] = useState(true);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResults, setTestResults] = useState<{passed: number, failed: number, details: string[]}>({passed: 0, failed: 0, details: []});
  
  const { toast } = useToast();

  // Check Web MIDI API support
  useEffect(() => {
    if (!navigator.requestMIDIAccess) {
      setIsSupported(false);
      console.warn('Web MIDI API not supported in this browser');
    }
  }, []);

  // Initialize MIDI access
  const initializeMIDI = useCallback(async () => {
    if (!navigator.requestMIDIAccess) {
      toast({
        title: "MIDI Not Supported",
        description: "Your browser doesn't support the Web MIDI API",
        variant: "destructive",
      });
      return;
    }

    setIsInitializing(true);
    try {
      const access = await navigator.requestMIDIAccess({ sysex: false });
      setMidiAccess(access);
      
      // Listen for device connections/disconnections
      access.onstatechange = () => {
        updateDeviceList(access);
      };
      
      updateDeviceList(access);
      
      toast({
        title: "MIDI Initialized",
        description: "USB MIDI interface is ready",
      });
    } catch (error) {
      console.error('Failed to initialize MIDI:', error);
      toast({
        title: "MIDI Initialization Failed",
        description: "Could not access MIDI devices. Check browser permissions.",
        variant: "destructive",
      });
    } finally {
      setIsInitializing(false);
    }
  }, [toast]);

  // Update device list
  const updateDeviceList = useCallback((access: any) => {
    const inputs: MIDIDevice[] = [];
    const outputs: MIDIDevice[] = [];

    // Process input devices
    for (const input of access.inputs.values()) {
      inputs.push({
        id: input.id,
        name: input.name || 'Unknown Device',
        manufacturer: input.manufacturer || 'Unknown',
        state: input.state,
        connection: input.connection,
        type: 'input',
        port: input
      });
    }

    // Process output devices
    for (const output of access.outputs.values()) {
      outputs.push({
        id: output.id,
        name: output.name || 'Unknown Device',
        manufacturer: output.manufacturer || 'Unknown',
        state: output.state,
        connection: output.connection,
        type: 'output',
        port: output
      });
    }

    setInputDevices(inputs);
    setOutputDevices(outputs);
    
    console.log(`🎹 Found ${inputs.length} MIDI inputs and ${outputs.length} MIDI outputs`);
  }, []);

  // Connect to selected devices
  const connectToDevices = useCallback(() => {
    if (!midiAccess || !selectedInputId || !selectedOutputId) {
      toast({
        title: "Device Selection Required",
        description: "Please select both input and output devices",
        variant: "destructive",
      });
      return;
    }

    try {
      const inputDevice = inputDevices.find(d => d.id === selectedInputId);
      const outputDevice = outputDevices.find(d => d.id === selectedOutputId);

      if (!inputDevice || !outputDevice) {
        throw new Error('Selected devices not found');
      }

      // Set up input monitoring
      if (inputDevice.port) {
        inputDevice.port.onmidimessage = (event: any) => {
          const message = formatMIDIMessage(event.data);
          addMessage({
            timestamp: Date.now(),
            data: Array.from(event.data),
            formatted: message,
            direction: 'in'
          });
        };
      }

      setIsConnected(true);
      
      toast({
        title: "MIDI Connected",
        description: `Connected to ${inputDevice.name} → ${outputDevice.name}`,
      });
      
      console.log(`🔗 Connected: ${inputDevice.name} → ${outputDevice.name}`);
    } catch (error) {
      console.error('Connection failed:', error);
      toast({
        title: "Connection Failed",
        description: "Could not connect to selected MIDI devices",
        variant: "destructive",
      });
    }
  }, [midiAccess, selectedInputId, selectedOutputId, inputDevices, outputDevices, toast]);

  // Disconnect from devices
  const disconnectFromDevices = useCallback(() => {
    const inputDevice = inputDevices.find(d => d.id === selectedInputId);
    if (inputDevice?.port) {
      inputDevice.port.onmidimessage = null;
    }
    
    setIsConnected(false);
    setIsMonitoring(false);
    
    toast({
      title: "MIDI Disconnected",
      description: "Disconnected from MIDI devices",
    });
    
    console.log('🔌 Disconnected from MIDI devices');
  }, [inputDevices, selectedInputId, toast]);

  // Send MIDI command
  const sendMIDICommand = useCallback(() => {
    if (!isConnected || !midiCommand.trim()) return;

    try {
      const outputDevice = outputDevices.find(d => d.id === selectedOutputId);
      if (!outputDevice?.port) {
        throw new Error('Output device not available');
      }

      const midiData = parseMIDICommand(midiCommand.trim());
      if (!midiData) {
        throw new Error('Invalid MIDI command format');
      }

      outputDevice.port.send(midiData);
      
      const formatted = formatMIDIMessage(midiData);
      addMessage({
        timestamp: Date.now(),
        data: midiData,
        formatted,
        direction: 'out'
      });

      toast({
        title: "MIDI Sent",
        description: formatted,
      });
      
      console.log('📤 Sent MIDI:', formatted);
      setMidiCommand('');
    } catch (error) {
      console.error('Send failed:', error);
      toast({
        title: "Send Failed",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive",
      });
    }
  }, [isConnected, midiCommand, outputDevices, selectedOutputId, toast]);

  // Add message to log
  const addMessage = useCallback((message: MIDIMessage) => {
    setMessages(prev => {
      const newMessages = [message, ...prev].slice(0, 100); // Keep last 100 messages
      return newMessages;
    });
  }, []);

  // Parse MIDI command (supports bracket format and hex)
  const parseMIDICommand = (command: string): number[] | null => {
    // Bracket format: [[PC:12:1]], [[CC:7:64:1]], [[NOTE:60:127:1]]
    const bracketMatch = command.match(/\[\[([A-Z]+):(\d+):(\d+)(?::(\d+))?\]\]/);
    if (bracketMatch) {
      const [, type, value1, value2, channel] = bracketMatch;
      const ch = channel ? parseInt(channel) - 1 : 0; // Convert to 0-based
      
      switch (type) {
        case 'PC': // Program Change
          return [0xC0 + ch, parseInt(value1)];
        case 'CC': // Control Change
          return [0xB0 + ch, parseInt(value1), parseInt(value2)];
        case 'NOTE': // Note On
          return [0x90 + ch, parseInt(value1), parseInt(value2)];
        default:
          return null;
      }
    }
    
    // Hex format: "B0 07 40"
    const hexMatch = command.match(/^([0-9A-Fa-f]{2}\s*)+$/);
    if (hexMatch) {
      return command.split(/\s+/).map(hex => parseInt(hex, 16));
    }
    
    return null;
  };

  // Format MIDI message for display
  const formatMIDIMessage = (data: number[]): string => {
    if (data.length === 0) return 'Empty message';
    
    const status = data[0];
    const channel = (status & 0x0F) + 1;
    const command = status & 0xF0;
    
    switch (command) {
      case 0x80: // Note Off
        return `[[NOTE_OFF:${data[1]}:${data[2]}:${channel}]]`;
      case 0x90: // Note On
        return `[[NOTE:${data[1]}:${data[2]}:${channel}]]`;
      case 0xB0: // Control Change
        return `[[CC:${data[1]}:${data[2]}:${channel}]]`;
      case 0xC0: // Program Change
        return `[[PC:${data[1]}:${channel}]]`;
      default:
        return `Raw: ${data.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ')}`;
    }
  };

  // Clear message log
  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  // MIDI Test Function
  const runMIDITest = useCallback(async () => {
    if (!isConnected || !midiAccess) {
      toast({
        title: "Test Failed",
        description: "Please connect to MIDI devices first",
        variant: "destructive",
      });
      return;
    }

    setIsTesting(true);
    setTestResults({passed: 0, failed: 0, details: []});
    
    const results = {
      passed: 0,
      failed: 0,
      details: [] as string[]
    };

    const outputDevice = outputDevices.find(d => d.id === selectedOutputId);
    const inputDevice = inputDevices.find(d => d.id === selectedInputId);

    if (!outputDevice?.port || !inputDevice?.port) {
      results.failed++;
      results.details.push("❌ Device ports not available");
      setTestResults(results);
      setIsTesting(false);
      return;
    }

    // Test commands to send
    const testCommands = [
      { name: "Program Change", data: [0xC0, 0x00], format: "[[PC:0:1]]" },
      { name: "Control Change (Volume)", data: [0xB0, 0x07, 0x64], format: "[[CC:7:100:1]]" },
      { name: "Note On", data: [0x90, 0x60, 0x7F], format: "[[NOTE:96:127:1]]" },
      { name: "Note Off", data: [0x80, 0x60, 0x00], format: "[[NOTE_OFF:96:0:1]]" }
    ];

    results.details.push("🧪 Starting MIDI loopback test...");
    setTestResults({...results});

    // Set up temporary input listener for test
    let receivedMessages: number[][] = [];
    const testListener = (event: any) => {
      receivedMessages.push(Array.from(event.data));
    };

    inputDevice.port.onmidimessage = testListener;

    try {
      for (let i = 0; i < testCommands.length; i++) {
        const command = testCommands[i];
        results.details.push(`📤 Sending ${command.name}: ${command.format}`);
        setTestResults({...results});

        // Clear received messages
        receivedMessages = [];
        
        // Send command
        outputDevice.port.send(command.data);
        
        // Wait for response (500ms timeout)
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Check if we received the message back
        const received = receivedMessages.find(msg => 
          msg.length >= command.data.length && 
          msg.slice(0, command.data.length).every((val, idx) => val === command.data[idx])
        );

        if (received) {
          results.passed++;
          results.details.push(`✅ ${command.name} - Received: ${formatMIDIMessage(received)}`);
        } else {
          results.failed++;
          results.details.push(`❌ ${command.name} - No response received`);
        }
        
        setTestResults({...results});
      }

      // Restore original input listener
      inputDevice.port.onmidimessage = (event: any) => {
        const message = formatMIDIMessage(event.data);
        addMessage({
          timestamp: Date.now(),
          data: Array.from(event.data),
          formatted: message,
          direction: 'in'
        });
      };

      results.details.push(`🏁 Test completed: ${results.passed} passed, ${results.failed} failed`);
      
      if (results.passed === testCommands.length) {
        toast({
          title: "MIDI Test Passed",
          description: `All ${results.passed} commands sent and received successfully`,
        });
      } else {
        toast({
          title: "MIDI Test Issues",
          description: `${results.passed} passed, ${results.failed} failed. Check loopback connection.`,
          variant: "destructive",
        });
      }

    } catch (error) {
      results.failed++;
      results.details.push(`❌ Test error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error('MIDI test error:', error);
    }

    setTestResults(results);
    setIsTesting(false);
  }, [isConnected, midiAccess, outputDevices, inputDevices, selectedOutputId, selectedInputId, formatMIDIMessage, addMessage, toast]);

  // Auto-initialize on component mount
  useEffect(() => {
    initializeMIDI();
  }, [initializeMIDI]);

  if (!isSupported) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardContent className="p-6">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
            <h3 className="text-lg font-semibold mb-2">Web MIDI Not Supported</h3>
            <p className="text-muted-foreground">
              Your browser doesn't support the Web MIDI API. Try using Chrome, Edge, or Opera.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Usb className="w-5 h-5" />
          USB MIDI Manager
        </CardTitle>
        <CardDescription>
          Connect and control USB MIDI devices using the Web MIDI API
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Connection Status */}
        <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
          <div className="flex items-center gap-3">
            {isConnected ? (
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            ) : (
              <AlertCircle className="w-5 h-5 text-yellow-500" />
            )}
            <div>
              <p className="font-medium">
                {isConnected ? 'Connected' : 'Disconnected'}
              </p>
              <p className="text-sm text-muted-foreground">
                {isConnected 
                  ? `${inputDevices.find(d => d.id === selectedInputId)?.name} → ${outputDevices.find(d => d.id === selectedOutputId)?.name}`
                  : 'No active MIDI connection'
                }
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={initializeMIDI}
              disabled={isInitializing}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isInitializing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {isConnected ? (
              <Button
                variant="outline"
                size="sm"
                onClick={disconnectFromDevices}
              >
                <PowerOff className="w-4 h-4 mr-2" />
                Disconnect
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={connectToDevices}
                disabled={!selectedInputId || !selectedOutputId}
              >
                <Power className="w-4 h-4 mr-2" />
                Connect
              </Button>
            )}
          </div>
        </div>

        {/* Device Selection */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Input Devices */}
          <div>
            <h3 className="font-medium mb-3 flex items-center gap-2">
              <VolumeX className="w-4 h-4" />
              MIDI Input Devices
            </h3>
            <div className="space-y-2">
              {inputDevices.length === 0 ? (
                <p className="text-sm text-muted-foreground">No input devices found</p>
              ) : (
                inputDevices.map((device) => (
                  <div
                    key={device.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedInputId === device.id
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => setSelectedInputId(device.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{device.name}</p>
                        <p className="text-xs text-muted-foreground">{device.manufacturer}</p>
                      </div>
                      <Badge variant={device.state === 'connected' ? 'default' : 'secondary'}>
                        {device.state}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Output Devices */}
          <div>
            <h3 className="font-medium mb-3 flex items-center gap-2">
              <Volume2 className="w-4 h-4" />
              MIDI Output Devices
            </h3>
            <div className="space-y-2">
              {outputDevices.length === 0 ? (
                <p className="text-sm text-muted-foreground">No output devices found</p>
              ) : (
                outputDevices.map((device) => (
                  <div
                    key={device.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedOutputId === device.id
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => setSelectedOutputId(device.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{device.name}</p>
                        <p className="text-xs text-muted-foreground">{device.manufacturer}</p>
                      </div>
                      <Badge variant={device.state === 'connected' ? 'default' : 'secondary'}>
                        {device.state}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* MIDI Commands */}
        {isConnected && (
          <>
            <Separator />
            <div>
              <h3 className="font-medium mb-3 flex items-center gap-2">
                <Send className="w-4 h-4" />
                Send MIDI Commands
              </h3>
              <div className="flex gap-2">
                <Input
                  value={midiCommand}
                  onChange={(e) => setMidiCommand(e.target.value)}
                  placeholder="e.g., [[PC:12:1]], [[CC:7:64:1]], B0 07 40"
                  className="font-mono"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      sendMIDICommand();
                    }
                  }}
                />
                <Button 
                  onClick={sendMIDICommand}
                  disabled={!midiCommand.trim()}
                >
                  <Send className="w-4 h-4 mr-2" />
                  Send
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Supports bracket format ([[PC:12:1]]) and hex format (B0 07 40)
              </p>
            </div>

            {/* MIDI Test Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium flex items-center gap-2">
                  <TestTube className="w-4 h-4" />
                  MIDI Loopback Test
                </h3>
                <Button
                  onClick={runMIDITest}
                  disabled={isTesting || !isConnected}
                  size="sm"
                >
                  {isTesting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <TestTube className="w-4 h-4 mr-2" />
                  )}
                  {isTesting ? 'Testing...' : 'Run Test'}
                </Button>
              </div>
              
              {testResults.details.length > 0 && (
                <div className="mb-4 p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium">
                      Test Results: {testResults.passed} passed, {testResults.failed} failed
                    </span>
                  </div>
                  <ScrollArea className="h-32">
                    <div className="space-y-1">
                      {testResults.details.map((detail, index) => (
                        <div key={index} className="text-xs font-mono">
                          {detail}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
              
              <p className="text-xs text-muted-foreground mb-4">
                This test sends MIDI commands and checks if they're received back. 
                Connect MIDI OUT to MIDI IN (loopback cable) for full testing.
              </p>
            </div>

            <Separator />

            {/* Message Monitor */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium flex items-center gap-2">
                  <Monitor className="w-4 h-4" />
                  MIDI Message Log
                </h3>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsMonitoring(!isMonitoring)}
                  >
                    {isMonitoring ? (
                      <PowerOff className="w-4 h-4 mr-2" />
                    ) : (
                      <Power className="w-4 h-4 mr-2" />
                    )}
                    {isMonitoring ? 'Stop' : 'Monitor'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearMessages}
                  >
                    Clear
                  </Button>
                </div>
              </div>
              
              <ScrollArea className="h-48 border rounded-lg p-2">
                {messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No MIDI messages yet
                  </p>
                ) : (
                  <div className="space-y-1">
                    {messages.map((message, index) => (
                      <div
                        key={index}
                        className={`text-xs font-mono p-2 rounded ${
                          message.direction === 'in' 
                            ? 'bg-blue-100 dark:bg-blue-900/20' 
                            : 'bg-green-100 dark:bg-green-900/20'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`font-medium ${
                            message.direction === 'in' ? 'text-blue-600' : 'text-green-600'
                          }`}>
                            {message.direction === 'in' ? '← IN' : '→ OUT'}
                          </span>
                          <span className="text-muted-foreground">
                            {new Date(message.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <div className="mt-1">{message.formatted}</div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}