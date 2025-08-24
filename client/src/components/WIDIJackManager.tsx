import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useLocalAuth } from '@/hooks/useLocalAuth';
import { parseMIDICommand } from '@/utils/midiFormatter';
import { 
  Bluetooth, 
  Wifi, 
  WifiOff, 
  X, 
  Music, 
  ArrowRight, 
  Activity,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

interface WIDIDevice {
  id: string;
  name: string;
  connected: boolean;
  bluetoothDevice?: any;
  characteristic?: any;
  server?: any;
}

interface MIDIMessage {
  timestamp: number;
  direction: 'sent' | 'received';
  data: string;
  command: string;
}

interface WIDIJackManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WIDIJackManager({ isOpen, onClose }: WIDIJackManagerProps) {
  const { user } = useLocalAuth();
  const isProfessional = user?.userType === 'professional';
  const { toast } = useToast();

  const [widiDevices, setWidiDevices] = useState<WIDIDevice[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [messages, setMessages] = useState<MIDIMessage[]>([]);
  const [commandInput, setCommandInput] = useState('');
  const [hasBluetoothSupport, setHasBluetoothSupport] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // WIDI Jack specific UUIDs
  const WIDI_MIDI_SERVICE_UUID = '03b80e5a-ede8-4b33-a751-6ce34ec4c700';
  const WIDI_MIDI_CHARACTERISTIC_UUID = '7772e5db-3868-4112-a1a9-f2669d106bf3';

  // Professional subscription check
  useEffect(() => {
    if (isOpen && !isProfessional) {
      toast({
        title: "Professional Subscription Required",
        description: "WIDI Jack features are only available for Professional subscribers",
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
      } else {
        setHasBluetoothSupport(false);
      }
    };
    checkBluetoothSupport();
  }, []);

  // Load saved WIDI devices
  useEffect(() => {
    if (isOpen) {
      const saved = localStorage.getItem('widiDevices');
      if (saved) {
        try {
          const devices = JSON.parse(saved);
          setWidiDevices(devices);
        } catch (error) {
          console.error('Error loading WIDI devices:', error);
        }
      }
    }
  }, [isOpen]);

  // Save WIDI devices
  const saveWidiDevices = (devices: WIDIDevice[]) => {
    localStorage.setItem('widiDevices', JSON.stringify(devices.map(d => ({
      id: d.id,
      name: d.name,
      connected: d.connected
    }))));
  };

  // Scan for WIDI Jack devices
  const scanForWIDI = async () => {
    if (!hasBluetoothSupport) {
      toast({
        title: "Bluetooth Not Supported",
        description: "Your browser doesn't support Bluetooth",
        variant: "destructive",
      });
      return;
    }

    setIsScanning(true);
    console.log('🔍 Scanning for WIDI Jack devices...');

    try {
      const device = await (navigator as any).bluetooth.requestDevice({
        filters: [
          { services: [WIDI_MIDI_SERVICE_UUID] },
          { name: 'WIDI' },
          { namePrefix: 'WIDI' },
          { name: 'Matts Pedal' },
          { namePrefix: 'Matts' }
        ],
        optionalServices: [WIDI_MIDI_SERVICE_UUID]
      });

      console.log('📱 Found WIDI device:', device.name);

      const newDevice: WIDIDevice = {
        id: device.id || `widi_${Date.now()}`,
        name: device.name || 'WIDI Jack',
        connected: false,
        bluetoothDevice: device
      };

      // Check if already exists
      const exists = widiDevices.some(d => d.id === newDevice.id || d.name === newDevice.name);
      if (!exists) {
        const updatedDevices = [...widiDevices, newDevice];
        setWidiDevices(updatedDevices);
        saveWidiDevices(updatedDevices);

        toast({
          title: "WIDI Device Found",
          description: `Added ${newDevice.name} to device list`,
        });
      } else {
        toast({
          title: "Device Already Added",
          description: `${newDevice.name} is already in your list`,
        });
      }

    } catch (error: any) {
      if (error.name !== 'NotFoundError') {
        console.error('WIDI scan error:', error);
        toast({
          title: "Scan Failed", 
          description: error.message || "Failed to scan for WIDI devices",
          variant: "destructive",
        });
      }
    } finally {
      setIsScanning(false);
    }
  };

  // Connect to WIDI Jack device
  const connectToWIDI = async (device: WIDIDevice) => {
    setIsConnecting(true);
    console.log(`🔗 Connecting to WIDI device: ${device.name}`);

    try {
      // Connect to GATT server
      const server = await device.bluetoothDevice.gatt.connect();
      console.log('✅ GATT server connected');

      // Get the MIDI service
      const midiService = await server.getPrimaryService(WIDI_MIDI_SERVICE_UUID);
      console.log('✅ MIDI service found');

      // Get the MIDI Data I/O characteristic
      const midiCharacteristic = await midiService.getCharacteristic(WIDI_MIDI_CHARACTERISTIC_UUID);
      console.log('✅ MIDI characteristic found');

      // Start notifications for receiving MIDI data
      await midiCharacteristic.startNotifications();
      console.log('✅ MIDI notifications started');

      // Listen for incoming MIDI data
      midiCharacteristic.addEventListener('characteristicvaluechanged', (event: any) => {
        const value = event.target.value;
        const data = new Uint8Array(value.buffer);
        
        // Parse BLE MIDI format (skip timestamp headers)
        const midiData = Array.from(data).slice(2); // Skip BLE MIDI headers
        
        console.log('📨 Received MIDI from WIDI:', midiData);
        
        const message: MIDIMessage = {
          timestamp: Date.now(),
          direction: 'received',
          data: `[${midiData.map(b => b.toString(16).padStart(2, '0')).join(' ')}]`,
          command: 'Received from TC-Helicon'
        };
        
        setMessages(prev => [...prev.slice(-49), message]);
      });

      // Update device status
      const updatedDevices = widiDevices.map(d => 
        d.id === device.id 
          ? { ...d, connected: true, server, characteristic: midiCharacteristic }
          : d
      );
      setWidiDevices(updatedDevices);
      saveWidiDevices(updatedDevices);

      toast({
        title: "WIDI Connected",
        description: `Successfully connected to ${device.name}`,
      });

      console.log('🎉 WIDI Jack connection complete!');

    } catch (error: any) {
      console.error('❌ WIDI connection error:', error);
      toast({
        title: "Connection Failed",
        description: `Failed to connect to ${device.name}: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  // Disconnect from WIDI device
  const disconnectFromWIDI = async (device: WIDIDevice) => {
    try {
      if (device.server) {
        device.server.disconnect();
      }

      const updatedDevices = widiDevices.map(d => 
        d.id === device.id 
          ? { ...d, connected: false, server: undefined, characteristic: undefined }
          : d
      );
      setWidiDevices(updatedDevices);
      saveWidiDevices(updatedDevices);

      toast({
        title: "WIDI Disconnected",
        description: `Disconnected from ${device.name}`,
      });

    } catch (error: any) {
      console.error('❌ WIDI disconnect error:', error);
    }
  };

  // Send MIDI command to WIDI Jack (to TC-Helicon VoiceLive 3)
  const sendToWIDI = async (device: WIDIDevice, command: string) => {
    if (!device.connected || !device.characteristic) {
      toast({
        title: "Device Not Connected",
        description: "Please connect to the WIDI device first",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log(`📤 Sending to WIDI Jack → TC-Helicon: ${command}`);

      // Parse MIDI command
      const parsed = parseMIDICommand(command);
      if (!parsed) {
        throw new Error('Invalid MIDI command format. Use [[PC:12:1]], [[CC:7:64:1]], etc.');
      }

      const midiBytes = parsed.bytes;
      console.log(`🎵 MIDI bytes: [${midiBytes.map(b => b.toString(16).padStart(2, '0')).join(' ')}]`);

      // Create BLE MIDI packet with timestamp (WIDI Jack format)
      const timestamp = Date.now() & 0x1FFF; // 13-bit timestamp
      const timestampHigh = 0x80 | (timestamp >> 7);     // Header byte
      const timestampLow = 0x80 | (timestamp & 0x7F);    // Timestamp byte
      const blePacket = new Uint8Array([timestampHigh, timestampLow, ...midiBytes]);

      console.log(`📦 BLE MIDI packet: [${Array.from(blePacket).map(b => b.toString(16).padStart(2, '0')).join(' ')}]`);

      // Send to WIDI Jack using writeValueWithResponse (required for WIDI Jack compatibility)
      await device.characteristic.writeValueWithResponse(blePacket);

      console.log('✅ Command sent to TC-Helicon via WIDI Jack!');

      // Log the sent message
      const message: MIDIMessage = {
        timestamp: Date.now(),
        direction: 'sent',
        data: `[${midiBytes.map(b => b.toString(16).padStart(2, '0')).join(' ')}]`,
        command: `${parsed.formatted} → TC-Helicon`
      };
      setMessages(prev => [...prev.slice(-49), message]);

      toast({
        title: "MIDI Sent",
        description: `Sent ${parsed.formatted} to TC-Helicon VoiceLive 3`,
      });

    } catch (error: any) {
      console.error('❌ WIDI send error:', error);
      toast({
        title: "Send Failed",
        description: error.message || "Failed to send MIDI command",
        variant: "destructive",
      });
    }
  };

  // Remove device
  const removeDevice = (deviceId: string) => {
    const updatedDevices = widiDevices.filter(d => d.id !== deviceId);
    setWidiDevices(updatedDevices);
    saveWidiDevices(updatedDevices);
    
    toast({
      title: "Device Removed",
      description: "WIDI device removed from list",
    });
  };

  // Clear messages
  const clearMessages = () => {
    setMessages([]);
  };

  if (!isProfessional) {
    return null;
  }

  const connectedDevices = widiDevices.filter(d => d.connected);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-black dark:text-white">
            <Music className="h-5 w-5 text-purple-500" />
            WIDI Jack Manager
            <Badge variant="outline" className="ml-2">
              TC-Helicon VoiceLive 3
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
          {/* Device Management */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-black dark:text-white">WIDI Devices</h3>
              <Button
                onClick={scanForWIDI}
                disabled={isScanning || !hasBluetoothSupport}
                size="sm"
                data-testid="button-scan-widi"
              >
                {isScanning ? (
                  <Activity className="h-4 w-4 animate-pulse" />
                ) : (
                  <Bluetooth className="h-4 w-4" />
                )}
                {isScanning ? "Scanning..." : "Scan for WIDI"}
              </Button>
            </div>

            <ScrollArea className="h-64">
              <div className="space-y-2">
                {widiDevices.length === 0 ? (
                  <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                    <Music className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No WIDI devices found</p>
                    <p className="text-sm">Click "Scan for WIDI" to find devices</p>
                  </div>
                ) : (
                  widiDevices.map((device) => (
                    <Card key={device.id} className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Music className="h-4 w-4 text-purple-500" />
                          <div>
                            <p className="font-medium text-black dark:text-white">{device.name}</p>
                            <div className="flex items-center gap-1">
                              {device.connected ? (
                                <>
                                  <CheckCircle className="h-3 w-3 text-green-500" />
                                  <span className="text-xs text-green-600 dark:text-green-400">Connected</span>
                                </>
                              ) : (
                                <>
                                  <AlertCircle className="h-3 w-3 text-gray-500" />
                                  <span className="text-xs text-gray-500">Disconnected</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          {device.connected ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => disconnectFromWIDI(device)}
                              data-testid={`button-disconnect-${device.id}`}
                            >
                              <WifiOff className="h-3 w-3" />
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => connectToWIDI(device)}
                              disabled={isConnecting}
                              data-testid={`button-connect-${device.id}`}
                            >
                              <Wifi className="h-3 w-3" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeDevice(device.id)}
                            data-testid={`button-remove-${device.id}`}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>

            {/* Send Commands */}
            <div className="space-y-3">
              <h4 className="font-medium text-black dark:text-white">Send to TC-Helicon</h4>
              
              {connectedDevices.length === 0 ? (
                <div className="text-center text-gray-500 dark:text-gray-400 py-4">
                  <p className="text-sm">Connect a WIDI device to send commands</p>
                </div>
              ) : (
                connectedDevices.map((device) => (
                  <Card key={device.id} className="p-3">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-black dark:text-white">{device.name}</p>
                      <div className="flex gap-2">
                        <Input
                          type="text"
                          value={commandInput}
                          onChange={(e) => setCommandInput(e.target.value)}
                          placeholder="[[PC:12:1]] - Program Change 12, Channel 1"
                          className="flex-1"
                          data-testid={`input-command-${device.id}`}
                        />
                        <Button
                          onClick={() => sendToWIDI(device, commandInput)}
                          disabled={!commandInput.trim()}
                          size="sm"
                          data-testid={`button-send-${device.id}`}
                        >
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Examples: [[PC:1:1]] (Program), [[CC:7:127:1]] (Volume), [[NOTE:60:127:1]] (Note)
                      </p>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>

          {/* MIDI Messages */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-black dark:text-white">MIDI Messages</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={clearMessages}
                disabled={messages.length === 0}
              >
                Clear
              </Button>
            </div>

            <ScrollArea className="h-96">
              <div className="space-y-2">
                {messages.length === 0 ? (
                  <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                    <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No MIDI activity</p>
                    <p className="text-sm">Connect and send commands to see messages</p>
                  </div>
                ) : (
                  messages.map((message, index) => (
                    <Card key={index} className="p-3">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-medium ${
                            message.direction === 'sent' 
                              ? 'text-blue-600 dark:text-blue-400' 
                              : 'text-green-600 dark:text-green-400'
                          }`}>
                            {message.direction === 'sent' ? '📤 SENT' : '📨 RECEIVED'}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(message.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-sm font-mono text-black dark:text-white">{message.data}</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">{message.command}</p>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}