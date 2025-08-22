import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
// Progress component not available, will use alternative
// import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { 
  Bluetooth, 
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
  CheckCircle,
  Signal,
  Battery,
  Info,
  Settings,
  Loader2
} from 'lucide-react';

interface BluetoothDevice {
  id: string;
  name: string;
  type: 'audio' | 'midi' | 'hid' | 'unknown';
  connected: boolean;
  paired: boolean;
  rssi?: number; // Signal strength
  batteryLevel?: number;
  deviceClass: string;
  services: string[];
  lastSeen: number;
  manufacturer?: string;
  model?: string;
}

interface BluetoothMessage {
  timestamp: number;
  deviceId: string;
  deviceName: string;
  data: string;
  type: 'midi' | 'audio' | 'data';
}

interface BluetoothDevicesManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BluetoothDevicesManager({ isOpen, onClose }: BluetoothDevicesManagerProps) {
  const [devices, setDevices] = useState<BluetoothDevice[]>([]);
  const [connectedDevices, setConnectedDevices] = useState<BluetoothDevice[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [messages, setMessages] = useState<BluetoothMessage[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [command, setCommand] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [hasBluetoothSupport, setHasBluetoothSupport] = useState(false);
  const [bluetoothState, setBluetoothState] = useState<'unavailable' | 'poweredOff' | 'poweredOn' | 'unauthorized'>('unavailable');
  const [selectedTab, setSelectedTab] = useState<'devices' | 'messages' | 'commands'>('devices');
  
  const { toast } = useToast();

  // Check Bluetooth support
  useEffect(() => {
    const checkBluetoothSupport = async () => {
      if (typeof navigator !== 'undefined' && 'bluetooth' in navigator) {
        setHasBluetoothSupport(true);
        try {
          const availability = await navigator.bluetooth.getAvailability();
          setBluetoothState(availability ? 'poweredOn' : 'poweredOff');
          
          // Load mock devices for development
          loadMockDevices();
        } catch (error) {
          console.error('Bluetooth access error:', error);
          setBluetoothState('unauthorized');
          loadMockDevices();
        }
      } else {
        setHasBluetoothSupport(false);
        // Load mock devices for development
        loadMockDevices();
      }
    };

    checkBluetoothSupport();
  }, []);

  // Load mock devices for development
  const loadMockDevices = () => {
    const mockDevices: BluetoothDevice[] = [
      {
        id: 'bt_audio_1',
        name: 'Sony WH-1000XM4',
        type: 'audio',
        connected: false,
        paired: true,
        rssi: -45,
        batteryLevel: 78,
        deviceClass: 'Audio/Video',
        services: ['AudioSink', 'AVRCP', 'A2DP'],
        lastSeen: Date.now() - 300000, // 5 minutes ago
        manufacturer: 'Sony',
        model: 'WH-1000XM4'
      },
      {
        id: 'bt_midi_1',
        name: 'Yamaha MD-BT01',
        type: 'midi',
        connected: false,
        paired: true,
        rssi: -52,
        deviceClass: 'Peripheral',
        services: ['MIDI', 'DUN'],
        lastSeen: Date.now() - 120000, // 2 minutes ago
        manufacturer: 'Yamaha',
        model: 'MD-BT01'
      },
      {
        id: 'bt_audio_2',
        name: 'AirPods Pro',
        type: 'audio',
        connected: true,
        paired: true,
        rssi: -38,
        batteryLevel: 92,
        deviceClass: 'Audio/Video',
        services: ['AudioSink', 'AVRCP', 'HFP'],
        lastSeen: Date.now(),
        manufacturer: 'Apple',
        model: 'AirPods Pro'
      },
      {
        id: 'bt_midi_2',
        name: 'KORG microKEY Air',
        type: 'midi',
        connected: false,
        paired: false,
        rssi: -67,
        deviceClass: 'Peripheral',
        services: ['MIDI', 'HID'],
        lastSeen: Date.now() - 600000, // 10 minutes ago
        manufacturer: 'KORG',
        model: 'microKEY Air'
      },
      {
        id: 'bt_unknown_1',
        name: 'Unknown Device',
        type: 'unknown',
        connected: false,
        paired: false,
        rssi: -89,
        deviceClass: 'Miscellaneous',
        services: ['Generic'],
        lastSeen: Date.now() - 900000, // 15 minutes ago
      }
    ];
    
    setDevices(mockDevices);
    setConnectedDevices(mockDevices.filter(d => d.connected));
  };

  // Scan for Bluetooth devices
  const handleScanDevices = async () => {
    setIsScanning(true);
    setScanProgress(0);
    
    // Simulate scanning progress
    const progressInterval = setInterval(() => {
      setScanProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 10;
      });
    }, 200);

    try {
      if (hasBluetoothSupport && bluetoothState === 'poweredOn') {
        // Real Bluetooth scanning would go here
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        toast({
          title: "Scan Complete",
          description: `Found ${devices.length} Bluetooth devices`,
        });
      } else {
        // Simulate scan for development
        setTimeout(() => {
          // Add a new mock device to simulate discovery
          const newDevice: BluetoothDevice = {
            id: `bt_new_${Date.now()}`,
            name: 'Discovered Device',
            type: 'audio',
            connected: false,
            paired: false,
            rssi: -55,
            deviceClass: 'Audio/Video',
            services: ['AudioSink'],
            lastSeen: Date.now(),
            manufacturer: 'Generic'
          };
          
          setDevices(prev => [...prev, newDevice]);
          
          toast({
            title: "Development Mode",
            description: "Using mock Bluetooth devices for testing",
            variant: "default",
          });
        }, 2000);
      }
    } catch (error) {
      toast({
        title: "Scan Failed",
        description: "Unable to scan for Bluetooth devices. Check permissions.",
        variant: "destructive",
      });
    } finally {
      setTimeout(() => {
        setIsScanning(false);
        setScanProgress(0);
      }, 2500);
    }
  };

  // Connect to device
  const handleConnectDevice = async (device: BluetoothDevice) => {
    try {
      if (hasBluetoothSupport && bluetoothState === 'poweredOn') {
        // Real Bluetooth connection would go here
        // For now, simulate connection
      }
      
      // Update device state
      setDevices(prev => prev.map(d => 
        d.id === device.id ? { ...d, connected: true, paired: true, lastSeen: Date.now() } : d
      ));
      setConnectedDevices(prev => [...prev.filter(d => d.id !== device.id), { ...device, connected: true }]);
      
      // Simulate receiving messages for MIDI devices
      if (device.type === 'midi') {
        const message: BluetoothMessage = {
          timestamp: Date.now(),
          deviceId: device.id,
          deviceName: device.name,
          data: 'Connection established - MIDI ready',
          type: 'midi'
        };
        setMessages(prev => [...prev.slice(-49), message]);
      }
      
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
  const handleDisconnectDevice = (device: BluetoothDevice) => {
    setDevices(prev => prev.map(d => 
      d.id === device.id ? { ...d, connected: false } : d
    ));
    setConnectedDevices(prev => prev.filter(d => d.id !== device.id));
    
    toast({
      title: "Device Disconnected",
      description: `${device.name} has been disconnected`,
    });
  };

  // Pair device
  const handlePairDevice = async (device: BluetoothDevice) => {
    try {
      setDevices(prev => prev.map(d => 
        d.id === device.id ? { ...d, paired: true } : d
      ));
      
      toast({
        title: "Device Paired",
        description: `${device.name} has been paired successfully`,
      });
    } catch (error) {
      toast({
        title: "Pairing Failed",
        description: `Unable to pair with ${device.name}`,
        variant: "destructive",
      });
    }
  };

  // Send command
  const handleSendCommand = async () => {
    if (!selectedDevice || !command.trim()) return;

    const device = connectedDevices.find(d => d.id === selectedDevice);
    if (!device) return;

    try {
      const message: BluetoothMessage = {
        timestamp: Date.now(),
        deviceId: device.id,
        deviceName: device.name,
        data: `Sent: ${command}`,
        type: device.type as 'midi' | 'audio' | 'data'
      };
      
      setMessages(prev => [...prev.slice(-49), message]);
      
      toast({
        title: "Command Sent",
        description: `Command sent to ${device.name}`,
      });
      setCommand('');
    } catch (error) {
      toast({
        title: "Send Failed",
        description: "Unable to send command",
        variant: "destructive",
      });
    }
  };

  // Filter devices by search term
  const filteredDevices = devices.filter(device =>
    device.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (device.manufacturer && device.manufacturer.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Get signal strength description
  const getSignalStrength = (rssi?: number) => {
    if (!rssi) return { strength: 'Unknown', bars: 0 };
    if (rssi >= -30) return { strength: 'Excellent', bars: 4 };
    if (rssi >= -50) return { strength: 'Good', bars: 3 };
    if (rssi >= -70) return { strength: 'Fair', bars: 2 };
    return { strength: 'Poor', bars: 1 };
  };

  // Format message for display
  const formatMessage = (message: BluetoothMessage) => {
    const timestamp = new Date(message.timestamp).toLocaleTimeString();
    return `[${timestamp}] ${message.deviceName}: ${message.data}`;
  };

  // Clear messages
  const handleClearMessages = () => {
    setMessages([]);
  };

  // Get device type icon
  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'audio': return <Volume2 className="h-4 w-4" />;
      case 'midi': return <Music className="h-4 w-4" />;
      default: return <Bluetooth className="h-4 w-4" />;
    }
  };

  // Get device type color
  const getDeviceColor = (type: string) => {
    switch (type) {
      case 'audio': return 'text-blue-600 dark:text-blue-400';
      case 'midi': return 'text-purple-600 dark:text-purple-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl h-[85vh] flex flex-col" data-testid="modal-bluetooth-devices">
        <DialogHeader className="pb-4">
          <DialogTitle className="flex items-center gap-3">
            <Bluetooth className="h-6 w-6 text-blue-500" />
            <span className="text-xl font-semibold">Bluetooth Devices</span>
            <Badge variant={hasBluetoothSupport ? "default" : "secondary"} className="ml-2">
              {hasBluetoothSupport ? bluetoothState : "Not Supported"}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {/* Bluetooth Support Warning */}
        {!hasBluetoothSupport && (
          <Card className="mb-4 border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm font-medium">
                  Web Bluetooth API not supported in this browser. Using mock devices for development.
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tab Navigation */}
        <div className="flex gap-1 mb-4">
          <Button
            variant={selectedTab === 'devices' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedTab('devices')}
            className="flex-1"
          >
            <Bluetooth className="h-4 w-4 mr-2" />
            Devices
          </Button>
          <Button
            variant={selectedTab === 'messages' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedTab('messages')}
            className="flex-1"
          >
            <Music className="h-4 w-4 mr-2" />
            Messages
          </Button>
          <Button
            variant={selectedTab === 'commands' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedTab('commands')}
            className="flex-1"
          >
            <Send className="h-4 w-4 mr-2" />
            Commands
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="space-y-4 p-1">
            {selectedTab === 'devices' && (
              <>
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
                            data-testid="input-search-bluetooth"
                          />
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={handleScanDevices}
                          disabled={isScanning}
                          data-testid="button-scan-bluetooth"
                        >
                          {isScanning ? (
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4 mr-1" />
                          )}
                          {isScanning ? "Scanning..." : "Scan"}
                        </Button>
                      </div>
                    </div>
                    {isScanning && (
                      <div className="mt-2">
                        <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${scanProgress}%` }}
                          ></div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Scanning for nearby Bluetooth devices...
                        </p>
                      </div>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {filteredDevices.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                          <Bluetooth className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No Bluetooth devices found</p>
                          <p className="text-xs">Click "Scan" to discover nearby devices</p>
                        </div>
                      ) : (
                        filteredDevices.map((device) => {
                          const signal = getSignalStrength(device.rssi);
                          return (
                            <div key={device.id} className="border rounded-lg p-4 bg-card hover:bg-accent transition-colors">
                              <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <div className={getDeviceColor(device.type)}>
                                      {getDeviceIcon(device.type)}
                                    </div>
                                    <p className="text-sm font-medium truncate flex items-center gap-2">
                                      {device.connected ? 
                                        <CheckCircle className="h-3 w-3 text-green-500" /> : 
                                        device.paired ?
                                        <div className="h-3 w-3 bg-blue-500 rounded-full" /> :
                                        <div className="h-3 w-3 border border-gray-400 rounded-full" />
                                      }
                                      {device.name}
                                    </p>
                                    <Badge variant="outline" className="text-xs">
                                      {device.type.toUpperCase()}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                    <span>{device.manufacturer || 'Unknown'}</span>
                                    {device.rssi && (
                                      <div className="flex items-center gap-1">
                                        <Signal className="h-3 w-3" />
                                        <span>{signal.strength} ({device.rssi}dBm)</span>
                                      </div>
                                    )}
                                    {device.batteryLevel && (
                                      <div className="flex items-center gap-1">
                                        <Battery className="h-3 w-3" />
                                        <span>{device.batteryLevel}%</span>
                                      </div>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Services: {device.services.join(', ')}
                                  </p>
                                </div>
                                <div className="flex gap-2 ml-2 shrink-0">
                                  {!device.paired && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handlePairDevice(device)}
                                      data-testid={`button-pair-${device.id}`}
                                    >
                                      Pair
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant={device.connected ? "destructive" : "default"}
                                    onClick={() => device.connected ? 
                                      handleDisconnectDevice(device) : handleConnectDevice(device)}
                                    data-testid={`button-${device.connected ? 'disconnect' : 'connect'}-${device.id}`}
                                    disabled={!device.paired && !device.connected}
                                  >
                                    {device.connected ? (
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
                            </div>
                          );
                        })
                      )}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {selectedTab === 'messages' && (
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-medium">Live Messages</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="default" className="text-xs">
                        {messages.length} messages
                      </Badge>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleClearMessages}
                        data-testid="button-clear-bluetooth-messages"
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
                          <p className="text-sm">Connect Bluetooth devices to see live messages</p>
                        </div>
                      ) : (
                        messages.slice().reverse().map((message, index) => (
                          <div 
                            key={`${message.timestamp}-${index}`} 
                            className="p-3 bg-muted rounded-lg border-l-4 border-blue-500 font-mono text-xs break-all"
                            data-testid={`bluetooth-message-${index}`}
                          >
                            {formatMessage(message)}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {selectedTab === 'commands' && (
              <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-blue-200 dark:border-blue-800">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg font-medium flex items-center gap-2">
                    <Send className="h-4 w-4" />
                    Send Bluetooth Command
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium block mb-2">Connected Device</label>
                      <select 
                        value={selectedDevice} 
                        onChange={(e) => setSelectedDevice(e.target.value)}
                        className="w-full p-3 border rounded-lg bg-background text-sm"
                        data-testid="select-bluetooth-device"
                      >
                        <option value="">Select connected device...</option>
                        {connectedDevices.map(device => (
                          <option key={device.id} value={device.id}>
                            {device.name} ({device.type.toUpperCase()})
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium block mb-2">Command</label>
                      <div className="flex gap-2">
                        <Input
                          value={command}
                          onChange={(e) => setCommand(e.target.value)}
                          placeholder="Enter command..."
                          className="text-sm"
                          data-testid="input-bluetooth-command"
                        />
                        <Button 
                          onClick={handleSendCommand}
                          disabled={!selectedDevice || !command.trim()}
                          data-testid="button-send-bluetooth"
                          className="shrink-0"
                        >
                          <Send className="h-4 w-4 mr-1" />
                          Send
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Connected Devices:</p>
                    <div className="flex flex-wrap gap-2">
                      {connectedDevices.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No devices connected</p>
                      ) : (
                        connectedDevices.map(device => (
                          <Badge key={device.id} variant="outline" className="text-xs">
                            {device.name}
                          </Badge>
                        ))
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose} data-testid="button-close-bluetooth">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}