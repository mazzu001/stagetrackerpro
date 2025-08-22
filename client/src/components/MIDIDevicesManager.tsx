import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useMIDIWebSocket, type MIDIMessage } from '@/hooks/useMIDIWebSocket';
import { apiRequest } from '@/lib/queryClient';
import { Music, Wifi, WifiOff, Send, Trash2, Volume2, VolumeX } from 'lucide-react';

export interface MIDIDevice {
  id: string;
  name: string;
  type: 'input' | 'output';
  isConnected: boolean;
  channel?: number;
  portIndex: number;
}

interface MIDIDevicesManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MIDIDevicesManager({ isOpen, onClose }: MIDIDevicesManagerProps) {
  const [availableDevices, setAvailableDevices] = useState<{ inputs: MIDIDevice[], outputs: MIDIDevice[] }>({ inputs: [], outputs: [] });
  const [connectedDevices, setConnectedDevices] = useState<{ inputs: MIDIDevice[], outputs: MIDIDevice[] }>({ inputs: [], outputs: [] });
  const [midiCommand, setMidiCommand] = useState('');
  const [selectedOutputDevice, setSelectedOutputDevice] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  
  const { 
    isConnected: isStreamConnected, 
    messages: midiMessages, 
    connectionError, 
    connect: connectStream, 
    disconnect: disconnectStream,
    clearMessages 
  } = useMIDIWebSocket();

  // Scan for available MIDI devices
  const scanDevices = async () => {
    setIsLoading(true);
    try {
      const response = await apiRequest('GET', '/api/midi/devices');
      const devices = await response.json();
      setAvailableDevices(devices);
      console.log('🎹 Available MIDI devices:', devices);
    } catch (error: any) {
      console.error('Failed to scan MIDI devices:', error);
      toast({
        title: "MIDI Scan Failed",
        description: error.message.includes('professional_required') 
          ? "Professional subscription required for MIDI features"
          : "Failed to scan MIDI devices",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Get connected devices
  const getConnectedDevices = async () => {
    try {
      const response = await apiRequest('GET', '/api/midi/connected');
      const devices = await response.json();
      setConnectedDevices(devices);
    } catch (error: any) {
      console.error('Failed to get connected devices:', error);
    }
  };

  // Connect to a MIDI device
  const connectDevice = async (device: MIDIDevice) => {
    try {
      await apiRequest('POST', '/api/midi/connect', {
        deviceId: device.id,
        type: device.type,
        channel: device.channel || 1
      });
      
      toast({
        title: "Device Connected",
        description: `Connected to ${device.name}`,
      });
      
      // Refresh device lists
      await Promise.all([scanDevices(), getConnectedDevices()]);
    } catch (error: any) {
      console.error('Failed to connect device:', error);
      toast({
        title: "Connection Failed",
        description: error.message || `Failed to connect to ${device.name}`,
        variant: "destructive",
      });
    }
  };

  // Disconnect from a MIDI device
  const disconnectDevice = async (device: MIDIDevice) => {
    try {
      await apiRequest('POST', '/api/midi/disconnect', {
        deviceId: device.id,
        type: device.type
      });
      
      toast({
        title: "Device Disconnected",
        description: `Disconnected from ${device.name}`,
      });
      
      // Refresh device lists
      await Promise.all([scanDevices(), getConnectedDevices()]);
    } catch (error: any) {
      console.error('Failed to disconnect device:', error);
      toast({
        title: "Disconnection Failed",
        description: error.message || `Failed to disconnect from ${device.name}`,
        variant: "destructive",
      });
    }
  };

  // Send MIDI message
  const sendMIDIMessage = async () => {
    if (!selectedOutputDevice || !midiCommand.trim()) {
      toast({
        title: "Invalid Input",
        description: "Please select an output device and enter a MIDI command",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await apiRequest('POST', '/api/midi/send', {
        deviceId: selectedOutputDevice,
        command: midiCommand.trim()
      });
      
      const result = await response.json();
      
      toast({
        title: "MIDI Message Sent",
        description: `Sent: ${midiCommand} → [${result.parsedData?.join(', ')}]`,
      });
      
      setMidiCommand('');
    } catch (error: any) {
      console.error('Failed to send MIDI message:', error);
      toast({
        title: "Send Failed",
        description: error.message || "Failed to send MIDI message",
        variant: "destructive",
      });
    }
  };

  // Format MIDI message for display
  const formatMIDIMessage = (message: MIDIMessage) => {
    const time = new Date(message.timestamp).toLocaleTimeString();
    const dataStr = message.rawData.map(d => d.toString(16).padStart(2, '0')).join(' ');
    return `${time} | ${message.deviceName} | Ch${message.channel} | ${message.command} | [${dataStr}]`;
  };

  // Initialize component
  useEffect(() => {
    if (isOpen) {
      scanDevices();
      getConnectedDevices();
      
      // Connect to MIDI message stream
      if (!isStreamConnected) {
        connectStream();
      }
    } else {
      // Disconnect stream when modal closes
      disconnectStream();
    }
  }, [isOpen, isStreamConnected, connectStream, disconnectStream]);

  // Set default output device when connected devices change
  useEffect(() => {
    if (connectedDevices.outputs.length > 0 && !selectedOutputDevice) {
      setSelectedOutputDevice(connectedDevices.outputs[0].id);
    }
  }, [connectedDevices.outputs, selectedOutputDevice]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[95vh] overflow-hidden" data-testid="modal-midi-devices">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Music className="h-5 w-5" />
            MIDI Devices Manager - NEW LAYOUT
            <Badge variant={isStreamConnected ? "default" : "secondary"}>
              {isStreamConnected ? "Live" : "Offline"}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col h-[75vh] gap-4">
          {/* Top Row: Available Devices and Live MIDI Messages */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[50vh]">
            {/* Left Panel: Available Devices */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Available Devices</CardTitle>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={scanDevices}
                    disabled={isLoading}
                    data-testid="button-scan-devices"
                  >
                    {isLoading ? "Scanning..." : "Scan"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <ScrollArea className="h-[30vh]">
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Volume2 className="h-4 w-4" />
                    Input Devices ({availableDevices.inputs.length})
                  </h4>
                  <div className="space-y-2">
                    {availableDevices.inputs.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No input devices found</p>
                    ) : (
                      availableDevices.inputs.map((device) => (
                        <div key={device.id} className="flex items-center justify-between p-2 border rounded">
                          <div>
                            <p className="text-sm font-medium">{device.name}</p>
                            <p className="text-xs text-muted-foreground">Port {device.portIndex}</p>
                          </div>
                          <Button
                            size="sm"
                            variant={device.isConnected ? "destructive" : "default"}
                            onClick={() => device.isConnected ? disconnectDevice(device) : connectDevice(device)}
                            data-testid={`button-${device.isConnected ? 'disconnect' : 'connect'}-input-${device.id}`}
                          >
                            {device.isConnected ? (
                              <>
                                <WifiOff className="h-4 w-4 mr-1" />
                                Disconnect
                              </>
                            ) : (
                              <>
                                <Wifi className="h-4 w-4 mr-1" />
                                Connect
                              </>
                            )}
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <VolumeX className="h-4 w-4" />
                    Output Devices ({availableDevices.outputs.length})
                  </h4>
                  <div className="space-y-2">
                    {availableDevices.outputs.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No output devices found</p>
                    ) : (
                      availableDevices.outputs.map((device) => (
                        <div key={device.id} className="flex items-center justify-between p-2 border rounded">
                          <div>
                            <p className="text-sm font-medium">{device.name}</p>
                            <p className="text-xs text-muted-foreground">Port {device.portIndex}</p>
                          </div>
                          <Button
                            size="sm"
                            variant={device.isConnected ? "destructive" : "default"}
                            onClick={() => device.isConnected ? disconnectDevice(device) : connectDevice(device)}
                            data-testid={`button-${device.isConnected ? 'disconnect' : 'connect'}-output-${device.id}`}
                          >
                            {device.isConnected ? (
                              <>
                                <WifiOff className="h-4 w-4 mr-1" />
                                Disconnect
                              </>
                            ) : (
                              <>
                                <Wifi className="h-4 w-4 mr-1" />
                                Connect
                              </>
                            )}
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Right Panel: Live MIDI Messages */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Live MIDI Messages</CardTitle>
                  <div className="flex gap-2">
                    <Badge variant={connectionError ? "destructive" : "default"}>
                      {connectionError || `${midiMessages.length} messages`}
                    </Badge>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={clearMessages}
                      data-testid="button-clear-messages"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Clear
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[30vh]">
                  <div className="space-y-1 font-mono text-xs">
                    {midiMessages.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">
                        {isStreamConnected ? "Waiting for MIDI messages..." : "Connect to stream to see messages"}
                      </p>
                    ) : (
                      midiMessages.slice().reverse().map((message, index) => (
                        <div 
                          key={`${message.timestamp}-${index}`} 
                          className="p-2 bg-muted rounded border-l-2 border-primary"
                          data-testid={`midi-message-${index}`}
                        >
                          {formatMIDIMessage(message)}
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Bottom Row: MIDI Command Sender */}
          <Card className="h-[20vh] bg-blue-50 dark:bg-blue-950 border-2 border-blue-200 dark:border-blue-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Send MIDI Command</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Output Device:</label>
                  <select 
                    value={selectedOutputDevice} 
                    onChange={(e) => setSelectedOutputDevice(e.target.value)}
                    className="w-full mt-1 p-2 border rounded"
                    data-testid="select-output-device"
                  >
                    <option value="">Select output device...</option>
                    {connectedDevices.outputs.map(device => (
                      <option key={device.id} value={device.id}>
                        {device.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">MIDI Command:</label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      value={midiCommand}
                      onChange={(e) => setMidiCommand(e.target.value)}
                      placeholder="e.g., '90 40 7F' or 'note on C4 127'"
                      className="flex-1"
                      data-testid="input-midi-command"
                    />
                    <Button 
                      onClick={sendMIDIMessage}
                      disabled={!selectedOutputDevice || !midiCommand.trim()}
                      data-testid="button-send-midi"
                    >
                      <Send className="h-4 w-4 mr-1" />
                      Send
                    </Button>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Formats: Hex (90 40 7F), Simple (note on C4 127), CC (cc 1 127)
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end mt-4">
          <Button variant="outline" onClick={onClose} data-testid="button-close-midi">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}