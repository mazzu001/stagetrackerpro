import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useGlobalWebMIDI } from '@/hooks/useGlobalWebMIDI';
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
  VolumeX
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
  // Use global Web MIDI system for persistent connections
  const { 
    isConnected: globalIsConnected, 
    deviceName: globalDeviceName, 
    sendCommand: globalSendCommand, 
    connectToDevice: globalConnectToDevice, 
    refreshDevices, 
    getAvailableOutputs 
  } = useGlobalWebMIDI();
  
  // Local UI state
  const [outputDevices, setOutputDevices] = useState<MIDIDevice[]>([]);
  const [selectedOutputId, setSelectedOutputId] = useState<string>('');
  const [midiCommand, setMidiCommand] = useState('');
  const [messages, setMessages] = useState<MIDIMessage[]>([]);
  const [isSupported, setIsSupported] = useState(true);
  
  const { toast } = useToast();

  // Check Web MIDI API support
  useEffect(() => {
    if (!navigator.requestMIDIAccess) {
      setIsSupported(false);
      console.warn('Web MIDI API not supported in this browser');
    }
  }, []);

  // Load devices from global system
  const loadDevices = useCallback(async () => {
    try {
      await refreshDevices();
      const availableOutputs = getAvailableOutputs();
      setOutputDevices(availableOutputs);
    } catch (error) {
      console.error('Failed to load MIDI devices:', error);
      toast({
        title: "MIDI Device Loading Failed",
        description: "Could not load MIDI devices. Check browser permissions.",
        variant: "destructive",
      });
    }
  }, [refreshDevices, getAvailableOutputs, toast]);

  // Load available devices on component mount
  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  // Connect to selected output device using global system
  const connectToSelectedDevice = useCallback(async () => {
    if (!selectedOutputId) {
      toast({
        title: "Device Selection Required",
        description: "Please select an output device",
        variant: "destructive",
      });
      return;
    }

    try {
      // Don't await - handle connection in background
      globalConnectToDevice(selectedOutputId)
        .then((success) => {
          if (success) {
            toast({
              title: "MIDI Connected",
              description: `Connected to ${globalDeviceName}`,
            });
          } else {
            throw new Error('Connection failed');
          }
        })
        .catch((error) => {
          console.error('Connection failed:', error);
          toast({
            title: "Connection Failed",
            description: "Could not connect to selected MIDI device",
            variant: "destructive",
          });
        });
    } catch (error) {
      console.error('Connection failed:', error);
      toast({
        title: "Connection Failed",
        description: "Could not connect to selected MIDI device",
        variant: "destructive",
      });
    }
  }, [selectedOutputId, globalConnectToDevice, globalDeviceName, toast]);

  // Send MIDI command using global system
  const sendMIDICommand = useCallback(async () => {
    if (!globalIsConnected || !midiCommand.trim()) return;

    try {
      // Don't await - handle MIDI sending in background
      globalSendCommand(midiCommand.trim())
        .then((success) => {
          if (success) {
            addMessage({
              timestamp: Date.now(),
              data: [],
              formatted: midiCommand.trim(),
              direction: 'out'
            });

            toast({
              title: "MIDI Sent",
              description: midiCommand.trim(),
            });
            
            setMidiCommand('');
          } else {
            throw new Error('Send failed');
          }
        })
        .catch((error) => {
          console.error('Send failed:', error);
          toast({
            title: "Send Failed",
            description: error instanceof Error ? error.message : 'Unknown error',
            variant: "destructive",
          });
        });
    } catch (error) {
      console.error('Send failed:', error);
      toast({
        title: "Send Failed",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive",
      });
    }
  }, [globalIsConnected, midiCommand, globalSendCommand, toast]);

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

  // Remove the old parseMIDICommand and formatMIDIMessage functions since global system handles parsing

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
            {globalIsConnected ? (
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            ) : (
              <AlertCircle className="w-5 h-5 text-yellow-500" />
            )}
            <div>
              <p className="font-medium">
                {globalIsConnected ? 'Connected' : 'Disconnected'}
              </p>
              <p className="text-sm text-muted-foreground">
                {globalIsConnected 
                  ? globalDeviceName
                  : 'No active MIDI connection'
                }
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadDevices}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={connectToSelectedDevice}
              disabled={!selectedOutputId}
            >
              <Power className="w-4 h-4 mr-2" />
              Connect
            </Button>
          </div>
        </div>

        {/* Output Device Selection */}
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

        {/* MIDI Commands */}
        {globalIsConnected && (
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