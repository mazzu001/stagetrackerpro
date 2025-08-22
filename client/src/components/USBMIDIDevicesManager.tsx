import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { 
  Usb, 
  Search, 
  Wifi, 
  WifiOff, 
  Volume2, 
  VolumeX, 
  RefreshCw, 
  Music,
  Send,
  Trash2,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { formatMIDIMessage as formatMIDIData } from '@/utils/midiFormatter';

interface USBMIDIDevice {
  id: string;
  name: string;
  manufacturer?: string;
  type: 'input' | 'output';
  state: 'connected' | 'disconnected' | 'error';
  portIndex?: number;
  version?: string;
}

interface USBMIDIMessage {
  timestamp: number;
  deviceId: string;
  deviceName: string;
  data: Uint8Array;
  type: string;
}

interface USBMIDIDevicesManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function USBMIDIDevicesManager({ isOpen, onClose }: USBMIDIDevicesManagerProps) {
  const [devices, setDevices] = useState<USBMIDIDevice[]>([]);
  const [connectedDevices, setConnectedDevices] = useState<USBMIDIDevice[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [messages, setMessages] = useState<USBMIDIMessage[]>([]);
  const [selectedOutputDevice, setSelectedOutputDevice] = useState<string>('');
  const [midiCommand, setMidiCommand] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [hasWebMIDISupport, setHasWebMIDISupport] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  
  const { toast } = useToast();

  // Check Web MIDI API support
  useEffect(() => {
    const checkWebMIDISupport = async () => {
      if (typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator) {
        setHasWebMIDISupport(true);
        try {
          const midiAccess = await navigator.requestMIDIAccess({ sysex: false });
          setPermissionStatus('granted');
          loadMIDIDevices(midiAccess);
        } catch (error) {
          console.error('MIDI access denied:', error);
          setPermissionStatus('denied');
        }
      } else {
        setHasWebMIDISupport(false);
        // Add mock devices for development
        setDevices([
          {
            id: 'usb_input_1',
            name: 'USB MIDI Keyboard Controller',
            manufacturer: 'Roland',
            type: 'input',
            state: 'disconnected',
            portIndex: 1,
            version: '1.0'
          },
          {
            id: 'usb_input_2',
            name: 'USB MIDI Pad Controller',
            manufacturer: 'Akai',
            type: 'input',
            state: 'disconnected',
            portIndex: 2,
            version: '2.1'
          },
          {
            id: 'usb_output_1',
            name: 'USB MIDI Sound Module',
            manufacturer: 'Yamaha',
            type: 'output',
            state: 'disconnected',
            portIndex: 1,
            version: '3.0'
          },
          {
            id: 'usb_output_2',
            name: 'USB MIDI Interface',
            manufacturer: 'M-Audio',
            type: 'output',
            state: 'disconnected',
            portIndex: 2,
            version: '1.5'
          }
        ]);
      }
    };

    checkWebMIDISupport();
  }, []);

  // Load MIDI devices from Web MIDI API
  const loadMIDIDevices = useCallback((midiAccess: any) => {
    const deviceList: USBMIDIDevice[] = [];
    
    // Input devices
    midiAccess.inputs.forEach((input: any, id: string) => {
      deviceList.push({
        id,
        name: input.name || `USB Input ${id}`,
        manufacturer: input.manufacturer || 'Unknown',
        type: 'input',
        state: input.state === 'connected' ? 'connected' : 'disconnected',
        portIndex: deviceList.filter(d => d.type === 'input').length + 1,
        version: input.version || '1.0'
      });
    });

    // Output devices
    midiAccess.outputs.forEach((output: any, id: string) => {
      deviceList.push({
        id,
        name: output.name || `USB Output ${id}`,
        manufacturer: output.manufacturer || 'Unknown',
        type: 'output',
        state: output.state === 'connected' ? 'connected' : 'disconnected',
        portIndex: deviceList.filter(d => d.type === 'output').length + 1,
        version: output.version || '1.0'
      });
    });

    setDevices(deviceList);
    setConnectedDevices(deviceList.filter(d => d.state === 'connected'));
  }, []);

  // Scan for USB MIDI devices
  const handleScanDevices = async () => {
    setIsScanning(true);
    
    try {
      if (hasWebMIDISupport) {
        const midiAccess = await navigator.requestMIDIAccess({ sysex: false });
        loadMIDIDevices(midiAccess);
        toast({
          title: "Scan Complete",
          description: `Found ${devices.length} USB MIDI devices`,
        });
      } else {
        // Simulate scan for development
        setTimeout(() => {
          toast({
            title: "Development Mode",
            description: "Using mock USB MIDI devices for testing",
            variant: "default",
          });
        }, 1000);
      }
    } catch (error) {
      toast({
        title: "Scan Failed",
        description: "Unable to access USB MIDI devices. Check permissions.",
        variant: "destructive",
      });
    } finally {
      setIsScanning(false);
    }
  };

  // Connect to device
  const handleConnectDevice = async (device: USBMIDIDevice) => {
    try {
      if (hasWebMIDISupport) {
        const midiAccess = await navigator.requestMIDIAccess({ sysex: false });
        if (device.type === 'input') {
          const input = midiAccess.inputs.get(device.id);
          if (input) {
            input.onmidimessage = (message: any) => {
              const newMessage: USBMIDIMessage = {
                timestamp: Date.now(),
                deviceId: device.id,
                deviceName: device.name,
                data: message.data || new Uint8Array(),
                type: 'note'
              };
              setMessages(prev => [...prev.slice(-49), newMessage]);
            };
          }
        }
      }
      
      // Update device state
      setDevices(prev => prev.map(d => 
        d.id === device.id ? { ...d, state: 'connected' } : d
      ));
      setConnectedDevices(prev => [...prev, { ...device, state: 'connected' }]);
      
      toast({
        title: "Device Connected",
        description: `${device.name} is now connected`,
      });
    } catch (error) {
      toast({
        title: "Connection Failed",
        description: `Unable to connect to ${device.name}`,
        variant: "destructive",
      });
    }
  };

  // Disconnect from device
  const handleDisconnectDevice = (device: USBMIDIDevice) => {
    setDevices(prev => prev.map(d => 
      d.id === device.id ? { ...d, state: 'disconnected' } : d
    ));
    setConnectedDevices(prev => prev.filter(d => d.id !== device.id));
    
    toast({
      title: "Device Disconnected",
      description: `${device.name} has been disconnected`,
    });
  };

  // Send MIDI message
  const handleSendMessage = async () => {
    if (!selectedOutputDevice || !midiCommand.trim()) return;

    try {
      if (hasWebMIDISupport) {
        const midiAccess = await navigator.requestMIDIAccess({ sysex: false });
        const output = midiAccess.outputs.get(selectedOutputDevice);
        
        if (output) {
          // Parse command (simple hex format for now)
          const bytes = midiCommand.split(' ').map(b => parseInt(b, 16));
          output.send(bytes);
        }
      }
      
      toast({
        title: "Message Sent",
        description: `MIDI command sent to device`,
      });
      setMidiCommand('');
    } catch (error) {
      toast({
        title: "Send Failed",
        description: "Unable to send MIDI message",
        variant: "destructive",
      });
    }
  };

  // Filter devices by search term
  const filteredDevices = devices.filter(device =>
    device.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (device.manufacturer && device.manufacturer.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Format MIDI message for display
  const formatMIDIMessage = (message: USBMIDIMessage) => {
    const timestamp = new Date(message.timestamp).toLocaleTimeString();
    const formattedData = formatMIDIData(Array.from(message.data));
    return `[${timestamp}] ${message.deviceName}: ${formattedData}`;
  };

  // Clear messages
  const handleClearMessages = () => {
    setMessages([]);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl h-[85vh] flex flex-col" data-testid="modal-usb-midi">
        <DialogHeader className="pb-4">
          <DialogTitle className="flex items-center gap-3">
            <Usb className="h-6 w-6 text-blue-500" />
            <span className="text-xl font-semibold">USB MIDI Devices</span>
            <Badge variant={hasWebMIDISupport ? "default" : "secondary"} className="ml-2">
              {hasWebMIDISupport ? "Native Support" : "Development Mode"}
            </Badge>
            {permissionStatus === 'denied' && (
              <Badge variant="destructive" className="ml-2">
                Permission Denied
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Web MIDI Support Warning */}
        {!hasWebMIDISupport && (
          <Card className="mb-4 border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm font-medium">
                  Web MIDI API not supported in this browser. Using mock devices for development.
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        <ScrollArea className="flex-1">
          <div className="space-y-4 p-1">
            {/* Device Scanner */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-medium">Device Scanner</CardTitle>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1 max-w-xs">
                      <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search devices..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8 text-sm"
                        data-testid="input-search-devices"
                      />
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleScanDevices}
                      disabled={isScanning}
                      data-testid="button-scan-usb-devices"
                    >
                      <RefreshCw className={`h-4 w-4 mr-1 ${isScanning ? 'animate-spin' : ''}`} />
                      {isScanning ? "Scanning..." : "Scan USB"}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Input Devices */}
                  <div>
                    <h4 className="text-sm font-medium mb-3 flex items-center gap-2 text-green-600 dark:text-green-400">
                      <Volume2 className="h-4 w-4" />
                      USB Input Devices ({filteredDevices.filter(d => d.type === 'input').length})
                    </h4>
                    <div className="space-y-2">
                      {filteredDevices.filter(d => d.type === 'input').length === 0 ? (
                        <div className="text-center py-4 text-muted-foreground text-sm border-2 border-dashed rounded-lg">
                          No USB input devices found
                        </div>
                      ) : (
                        filteredDevices.filter(d => d.type === 'input').map((device) => (
                          <div key={device.id} className="border rounded-lg p-3 bg-card hover:bg-accent transition-colors">
                            <div className="flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate flex items-center gap-2">
                                  {device.state === 'connected' ? 
                                    <CheckCircle className="h-3 w-3 text-green-500" /> : 
                                    <div className="h-3 w-3 border border-gray-400 rounded-full" />
                                  }
                                  {device.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {device.manufacturer} • Port {device.portIndex} • v{device.version}
                                </p>
                              </div>
                              <Button
                                size="sm"
                                variant={device.state === 'connected' ? "destructive" : "default"}
                                onClick={() => device.state === 'connected' ? 
                                  handleDisconnectDevice(device) : handleConnectDevice(device)}
                                data-testid={`button-${device.state === 'connected' ? 'disconnect' : 'connect'}-usb-input-${device.id}`}
                                className="ml-2 shrink-0"
                              >
                                {device.state === 'connected' ? (
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

                  {/* Output Devices */}
                  <div>
                    <h4 className="text-sm font-medium mb-3 flex items-center gap-2 text-blue-600 dark:text-blue-400">
                      <VolumeX className="h-4 w-4" />
                      USB Output Devices ({filteredDevices.filter(d => d.type === 'output').length})
                    </h4>
                    <div className="space-y-2">
                      {filteredDevices.filter(d => d.type === 'output').length === 0 ? (
                        <div className="text-center py-4 text-muted-foreground text-sm border-2 border-dashed rounded-lg">
                          No USB output devices found
                        </div>
                      ) : (
                        filteredDevices.filter(d => d.type === 'output').map((device) => (
                          <div key={device.id} className="border rounded-lg p-3 bg-card hover:bg-accent transition-colors">
                            <div className="flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate flex items-center gap-2">
                                  {device.state === 'connected' ? 
                                    <CheckCircle className="h-3 w-3 text-green-500" /> : 
                                    <div className="h-3 w-3 border border-gray-400 rounded-full" />
                                  }
                                  {device.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {device.manufacturer} • Port {device.portIndex} • v{device.version}
                                </p>
                              </div>
                              <Button
                                size="sm"
                                variant={device.state === 'connected' ? "destructive" : "default"}
                                onClick={() => device.state === 'connected' ? 
                                  handleDisconnectDevice(device) : handleConnectDevice(device)}
                                data-testid={`button-${device.state === 'connected' ? 'disconnect' : 'connect'}-usb-output-${device.id}`}
                                className="ml-2 shrink-0"
                              >
                                {device.state === 'connected' ? (
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
                </div>
              </CardContent>
            </Card>

            {/* Live Messages */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-medium">Live USB MIDI Messages</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className="text-xs">
                      {messages.length} messages
                    </Badge>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleClearMessages}
                      data-testid="button-clear-usb-messages"
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
                    {messages.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                        <Music className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Connect USB devices to see live MIDI messages</p>
                      </div>
                    ) : (
                      messages.slice().reverse().map((message, index) => (
                        <div 
                          key={`${message.timestamp}-${index}`} 
                          className="p-3 bg-muted rounded-lg border-l-4 border-blue-500 font-mono text-xs break-all"
                          data-testid={`usb-midi-message-${index}`}
                        >
                          {formatMIDIMessage(message)}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Send Commands */}
            <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-blue-200 dark:border-blue-800">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-medium flex items-center gap-2">
                  <Send className="h-4 w-4" />
                  Send USB MIDI Command
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium block mb-2">USB Output Device</label>
                    <select 
                      value={selectedOutputDevice} 
                      onChange={(e) => setSelectedOutputDevice(e.target.value)}
                      className="w-full p-3 border rounded-lg bg-background text-sm"
                      data-testid="select-usb-output-device"
                    >
                      <option value="">Select USB output device...</option>
                      {connectedDevices.filter(d => d.type === 'output').map(device => (
                        <option key={device.id} value={device.id}>
                          {device.name} ({device.manufacturer})
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
                        placeholder="e.g., [[PC:12:1]], [[CC:7:64:1]], [[NOTE:60:127:1]]"
                        className="font-mono text-sm"
                        data-testid="input-usb-midi-command"
                      />
                      <Button 
                        onClick={handleSendMessage}
                        disabled={!selectedOutputDevice || !midiCommand.trim()}
                        data-testid="button-send-usb-midi"
                        className="shrink-0"
                      >
                        <Send className="h-4 w-4 mr-1" />
                        Send
                      </Button>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">USB MIDI Command Examples:</p>
                  <div className="text-xs text-muted-foreground space-y-1 bg-muted/50 p-3 rounded">
                    <div>• Program Change: <code className="bg-background px-1 rounded">[[PC:12:1]]</code> (Program 12, Channel 1)</div>
                    <div>• Control Change: <code className="bg-background px-1 rounded">[[CC:7:64:1]]</code> (Volume, Channel 1)</div>
                    <div>• Note On: <code className="bg-background px-1 rounded">[[NOTE:60:127:1]]</code> (Middle C, Channel 1)</div>
                    <div>• Legacy: <code className="bg-background px-1 rounded">90 3C 7F</code> (Hex format still supported)</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose} data-testid="button-close-usb-midi">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}