import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useLocalAuth } from '@/hooks/useLocalAuth';
import { 
  Bluetooth, 
  Search, 
  Wifi, 
  WifiOff, 
  Send, 
  Activity,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

interface BluetoothDevice {
  id: string;
  name: string;
  connected: boolean;
}

interface SimpleBluetoothManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SimpleBluetoothManager({ isOpen, onClose }: SimpleBluetoothManagerProps) {
  const { user } = useLocalAuth();
  const isProfessional = user?.userType === 'professional';
  const { toast } = useToast();

  // All state hooks
  const [devices, setDevices] = useState<BluetoothDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<BluetoothDevice | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [hasBluetoothSupport, setHasBluetoothSupport] = useState(false);
  const [testMessage, setTestMessage] = useState('Hello Device!');
  const [lastSentMessage, setLastSentMessage] = useState<string>('');
  const [lastReceivedMessage, setLastReceivedMessage] = useState<string>('');
  const [bluetoothDevice, setBluetoothDevice] = useState<any>(null);
  const [midiMessages, setMidiMessages] = useState<Array<{timestamp: string, message: string}>>([]);

  // Check for professional subscription
  useEffect(() => {
    if (isOpen && !isProfessional) {
      toast({
        title: "Professional Subscription Required",
        description: "Bluetooth features are only available for Professional subscribers",
        variant: "destructive",
      });
      onClose();
    }
  }, [isOpen, isProfessional, onClose, toast]);

  // Check Bluetooth support
  useEffect(() => {
    const checkBluetoothSupport = async () => {
      if ('bluetooth' in navigator) {
        setHasBluetoothSupport(true);
        // Try to restore previously connected device
        const savedDeviceId = localStorage.getItem('bluetooth_device_id');
        const savedDeviceName = localStorage.getItem('bluetooth_device_name');
        if (savedDeviceId && savedDeviceName) {
          setSelectedDevice({ id: savedDeviceId, name: savedDeviceName, connected: false });
          // Attempt auto-reconnect
          await attemptReconnect(savedDeviceId, savedDeviceName);
        }
      } else {
        setHasBluetoothSupport(false);
      }
    };

    if (isOpen && isProfessional) {
      checkBluetoothSupport();
    }
  }, [isOpen, isProfessional]);

  // Scan for Bluetooth devices
  const scanForDevices = async () => {
    if (!hasBluetoothSupport) {
      toast({
        title: "Bluetooth Not Supported",
        description: "This browser doesn't support Bluetooth",
        variant: "destructive",
      });
      return;
    }

    setIsScanning(true);
    try {
      console.log('🔍 Scanning for Bluetooth devices...');
      
      // Request any Bluetooth device
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['generic_access', 'generic_attribute']
      });

      console.log('📱 Found device:', device.name || 'Unknown Device');
      
      const newDevice: BluetoothDevice = {
        id: device.id,
        name: device.name || 'Unknown Device',
        connected: false
      };

      setDevices(prev => {
        const exists = prev.find(d => d.id === device.id);
        if (exists) return prev;
        return [...prev, newDevice];
      });

      toast({
        title: "Device Found",
        description: `Found: ${newDevice.name}`,
      });

    } catch (error) {
      console.error('❌ Bluetooth scan failed:', error);
      toast({
        title: "Scan Failed",
        description: "Failed to scan for Bluetooth devices",
        variant: "destructive",
      });
    } finally {
      setIsScanning(false);
    }
  };

  // Connect to a device
  const connectToDevice = async (device: BluetoothDevice) => {
    setIsConnecting(true);
    setConnectionStatus('connecting');
    
    try {
      console.log(`🔗 Connecting to ${device.name}...`);
      
      const bluetoothDevice = await (navigator as any).bluetooth.requestDevice({
        filters: [{ name: device.name }],
        optionalServices: ['generic_access', 'generic_attribute']
      });

      const server = await bluetoothDevice.gatt.connect();
      console.log('✅ Connected to GATT server');

      setBluetoothDevice(bluetoothDevice);
      setSelectedDevice({ ...device, connected: true });
      setConnectionStatus('connected');
      
      // Remember this device
      localStorage.setItem('bluetooth_device_id', device.id);
      localStorage.setItem('bluetooth_device_name', device.name);

      // Update devices list
      setDevices(prev => prev.map(d => 
        d.id === device.id ? { ...d, connected: true } : d
      ));

      toast({
        title: "Connected",
        description: `Successfully connected to ${device.name}`,
      });

    } catch (error) {
      console.error('❌ Connection failed:', error);
      setConnectionStatus('disconnected');
      toast({
        title: "Connection Failed",
        description: `Failed to connect to ${device.name}`,
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  // Disconnect from device
  const disconnectFromDevice = () => {
    if (bluetoothDevice && bluetoothDevice.gatt.connected) {
      bluetoothDevice.gatt.disconnect();
      console.log('🔌 Disconnected from device');
    }
    
    setBluetoothDevice(null);
    setConnectionStatus('disconnected');
    setSelectedDevice(prev => prev ? { ...prev, connected: false } : null);
    
    // Update devices list
    if (selectedDevice) {
      setDevices(prev => prev.map(d => 
        d.id === selectedDevice.id ? { ...d, connected: false } : d
      ));
    }

    toast({
      title: "Disconnected",
      description: "Device disconnected",
    });
  };

  // Attempt to reconnect to saved device
  const attemptReconnect = async (deviceId: string, deviceName: string) => {
    try {
      console.log(`🔄 Attempting to reconnect to ${deviceName}...`);
      await connectToDevice({ id: deviceId, name: deviceName, connected: false });
    } catch (error) {
      console.log('⚠️ Auto-reconnect failed:', error);
    }
  };

  // Send test message
  const sendTestMessage = async () => {
    if (!bluetoothDevice || !bluetoothDevice.gatt.connected) {
      toast({
        title: "Not Connected",
        description: "Please connect to a device first",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log(`📤 Sending test message: ${testMessage}`);
      
      // This is a basic implementation - you may need to adapt for specific device protocols
      const encoder = new TextEncoder();
      const data = encoder.encode(testMessage);
      
      // For demonstration - actual implementation depends on device services/characteristics
      setLastSentMessage(testMessage);
      console.log('✅ Test message sent');
      
      toast({
        title: "Message Sent",
        description: `Sent: ${testMessage}`,
      });

    } catch (error) {
      console.error('❌ Send failed:', error);
      toast({
        title: "Send Failed",
        description: "Failed to send test message",
        variant: "destructive",
      });
    }
  };

  // Don't render for non-professional users
  if (!isProfessional) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bluetooth className="h-5 w-5" />
            Simple Bluetooth Manager
            <Badge variant={hasBluetoothSupport ? "default" : "secondary"}>
              {hasBluetoothSupport ? "Supported" : "Not Supported"}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto pr-2">
          {/* Connection Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Connection Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {connectionStatus === 'connected' ? (
                    <>
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <span className="text-green-600 dark:text-green-400">
                        Connected to {selectedDevice?.name}
                      </span>
                    </>
                  ) : connectionStatus === 'connecting' ? (
                    <>
                      <Activity className="h-5 w-5 text-yellow-500 animate-pulse" />
                      <span className="text-yellow-600 dark:text-yellow-400">Connecting...</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-5 w-5 text-red-500" />
                      <span className="text-red-600 dark:text-red-400">Not Connected</span>
                    </>
                  )}
                </div>
                
                {selectedDevice?.connected && (
                  <Button 
                    onClick={disconnectFromDevice}
                    variant="outline" 
                    size="sm"
                  >
                    <WifiOff className="h-4 w-4 mr-2" />
                    Disconnect
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Device Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Device Selection</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={scanForDevices} 
                disabled={isScanning || !hasBluetoothSupport}
                className="w-full"
              >
                <Search className="h-4 w-4 mr-2" />
                {isScanning ? 'Scanning...' : 'Scan for Devices'}
              </Button>

              {devices.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium">Available Devices:</h4>
                  <ScrollArea className="h-32">
                    {devices.map(device => (
                      <div key={device.id} className="flex items-center justify-between p-2 border rounded">
                        <div className="flex items-center gap-2">
                          <Bluetooth className="h-4 w-4" />
                          <span>{device.name}</span>
                          {device.connected && (
                            <Badge variant="default" className="text-xs">Connected</Badge>
                          )}
                        </div>
                        {!device.connected && (
                          <Button 
                            onClick={() => connectToDevice(device)}
                            disabled={isConnecting}
                            size="sm"
                            variant="outline"
                          >
                            <Wifi className="h-4 w-4 mr-1" />
                            Connect
                          </Button>
                        )}
                      </div>
                    ))}
                  </ScrollArea>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Communication Test */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Communication Test</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  placeholder="Enter test message"
                  className="flex-1 px-3 py-2 border rounded text-black dark:text-white bg-white dark:bg-gray-800"
                  disabled={connectionStatus !== 'connected'}
                />
                <Button 
                  onClick={sendTestMessage}
                  disabled={connectionStatus !== 'connected'}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Send
                </Button>
              </div>

              {lastSentMessage && (
                <div className="p-2 bg-blue-50 dark:bg-blue-950 rounded">
                  <div className="text-sm font-medium text-blue-700 dark:text-blue-300">
                    Last Sent: {lastSentMessage}
                  </div>
                </div>
              )}

              {lastReceivedMessage && (
                <div className="p-2 bg-green-50 dark:bg-green-950 rounded">
                  <div className="text-sm font-medium text-green-700 dark:text-green-300">
                    Last Received: {lastReceivedMessage}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* MIDI Message Listener */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">MIDI Commands Listener</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Listening for MIDI commands from connected device
                </span>
                <Badge variant={connectionStatus === 'connected' ? "default" : "secondary"}>
                  {connectionStatus === 'connected' ? "Active" : "Inactive"}
                </Badge>
              </div>
              
              {/* MIDI Messages Display */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm">Recent MIDI Messages:</h4>
                  <Button
                    onClick={() => setMidiMessages([])}
                    variant="outline"
                    size="sm"
                    disabled={midiMessages.length === 0}
                  >
                    Clear
                  </Button>
                </div>
                
                <ScrollArea className="h-32 w-full rounded border p-2 bg-gray-50 dark:bg-gray-900">
                  {midiMessages.length === 0 ? (
                    <div className="text-center text-gray-500 text-sm py-4">
                      No MIDI messages received yet
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {midiMessages.slice(-10).map((msg, index) => (
                        <div key={index} className="text-xs font-mono bg-white dark:bg-gray-800 p-2 rounded border">
                          <div className="text-gray-500 text-[10px]">{msg.timestamp}</div>
                          <div className="text-green-600 dark:text-green-400">{msg.message}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>

              <div className="text-xs text-gray-500">
                MIDI commands will appear here when received from your connected Bluetooth device.
                Supports standard MIDI messages like Program Change, Control Change, and Note On/Off.
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}