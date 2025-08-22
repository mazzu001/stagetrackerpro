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
      <DialogContent className="max-w-6xl h-[85vh] flex flex-col" data-testid="modal-midi-devices">
        <DialogHeader className="pb-4">
          <DialogTitle className="flex items-center gap-3">
            <Music className="h-6 w-6 text-primary" />
            <span className="text-xl font-semibold">MIDI Devices Manager</span>
            <Badge variant={isStreamConnected ? "default" : "secondary"} className="ml-2">
              {isStreamConnected ? "Live" : "Offline"}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <div className="space-y-4 p-1">
            {/* Available Devices */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-medium">Available Devices</CardTitle>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={scanDevices}
                    disabled={isLoading}
                    data-testid="button-scan-devices"
                  >
                    {isLoading ? "Scanning..." : "Refresh"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Input Devices */}
                <div>
                  <h4 className="text-sm font-medium mb-3 flex items-center gap-2 text-green-600 dark:text-green-400">
                    <Volume2 className="h-4 w-4" />
                    Input Devices ({availableDevices.inputs.length})
                  </h4>
                  <div className="space-y-2">
                    {availableDevices.inputs.length === 0 ? (
                      <div className="text-center py-4 text-muted-foreground text-sm border-2 border-dashed rounded-lg">
                        No input devices found
                      </div>
                    ) : (
                      availableDevices.inputs.map((device) => (
                        <div key={device.id} className="border rounded-lg p-3 bg-card hover:bg-accent transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{device.name}</p>
                              <p className="text-xs text-muted-foreground">Port {device.portIndex}</p>
                            </div>
                            <Button
                              size="sm"
                              variant={device.isConnected ? "destructive" : "default"}
                              onClick={() => device.isConnected ? disconnectDevice(device) : connectDevice(device)}
                              data-testid={`button-${device.isConnected ? 'disconnect' : 'connect'}-input-${device.id}`}
                              className="ml-2 shrink-0"
                            >
                              {device.isConnected ? (
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

                <Separator />

                {/* Output Devices */}
                <div>
                  <h4 className="text-sm font-medium mb-3 flex items-center gap-2 text-blue-600 dark:text-blue-400">
                    <VolumeX className="h-4 w-4" />
                    Output Devices ({availableDevices.outputs.length})
                  </h4>
                  <div className="space-y-2">
                    {availableDevices.outputs.length === 0 ? (
                      <div className="text-center py-4 text-muted-foreground text-sm border-2 border-dashed rounded-lg">
                        No output devices found
                      </div>
                    ) : (
                      availableDevices.outputs.map((device) => (
                        <div key={device.id} className="border rounded-lg p-3 bg-card hover:bg-accent transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{device.name}</p>
                              <p className="text-xs text-muted-foreground">Port {device.portIndex}</p>
                            </div>
                            <Button
                              size="sm"
                              variant={device.isConnected ? "destructive" : "default"}
                              onClick={() => device.isConnected ? disconnectDevice(device) : connectDevice(device)}
                              data-testid={`button-${device.isConnected ? 'disconnect' : 'connect'}-output-${device.id}`}
                              className="ml-2 shrink-0"
                            >
                              {device.isConnected ? (
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
              </CardContent>
            </Card>

            {/* Live MIDI Messages */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-medium">Live MIDI Messages</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant={connectionError ? "destructive" : "default"} className="text-xs">
                      {connectionError || `${midiMessages.length} messages`}
                    </Badge>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={clearMessages}
                      data-testid="button-clear-messages"
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
                    {midiMessages.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                        <Music className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">
                          {isStreamConnected ? "Waiting for MIDI messages..." : "Connect to stream to see messages"}
                        </p>
                      </div>
                    ) : (
                      midiMessages.slice().reverse().map((message, index) => (
                        <div 
                          key={`${message.timestamp}-${index}`} 
                          className="p-3 bg-muted rounded-lg border-l-4 border-primary font-mono text-xs break-all"
                          data-testid={`midi-message-${index}`}
                        >
                          {formatMIDIMessage(message)}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Send MIDI Command */}
            <Card className="bg-gradient-to-br from-primary/5 to-secondary/5 border-primary/20">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-medium flex items-center gap-2">
                  <Send className="h-4 w-4" />
                  Send MIDI Command
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium block mb-2">Output Device</label>
                    <select 
                      value={selectedOutputDevice} 
                      onChange={(e) => setSelectedOutputDevice(e.target.value)}
                      className="w-full p-3 border rounded-lg bg-background text-sm"
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
                    <label className="text-sm font-medium block mb-2">MIDI Command</label>
                    <div className="flex gap-2">
                      <Input
                        value={midiCommand}
                        onChange={(e) => setMidiCommand(e.target.value)}
                        placeholder="e.g., '90 40 7F' or 'note on C4 127'"
                        className="font-mono text-sm"
                        data-testid="input-midi-command"
                      />
                      <Button 
                        onClick={sendMIDIMessage}
                        disabled={!selectedOutputDevice || !midiCommand.trim()}
                        data-testid="button-send-midi"
                        className="shrink-0"
                      >
                        <Send className="h-4 w-4 mr-1" />
                        Send
                      </Button>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Command Formats:</p>
                  <div className="text-xs text-muted-foreground space-y-1 bg-muted/50 p-3 rounded">
                    <div>• Hex: <code className="bg-background px-1 rounded">90 40 7F</code></div>
                    <div>• Simple: <code className="bg-background px-1 rounded">note on C4 127</code></div>
                    <div>• CC: <code className="bg-background px-1 rounded">cc 1 127</code></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose} data-testid="button-close-midi">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}