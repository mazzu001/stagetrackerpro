import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Music, Volume2, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { useGlobalWebMIDI } from '@/hooks/useGlobalWebMIDI';

interface MIDIDevice {
  id: string;
  name: string;
  manufacturer: string;
  state: string;
  type: 'input' | 'output';
  connection: string;
}

export function PersistentWebMIDIManager() {
  const [testMessage, setTestMessage] = useState('[[PC:1:1]]');
  const [midiMessages, setMidiMessages] = useState<string[]>([]);
  const [lastSentMessage, setLastSentMessage] = useState('');
  const [availableOutputs, setAvailableOutputs] = useState<MIDIDevice[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();
  
  const globalMidi = useGlobalWebMIDI();

  // Refresh available devices - MINIMAL, NO REPEATED CALLS
  const refreshDevices = async () => {
    setIsRefreshing(true);
    try {
      const outputs = globalMidi.getAvailableOutputs();
      console.log('🔍 UI Component: Got outputs from hook:', outputs.length, outputs.map(o => o.name));
      setAvailableOutputs(outputs);
      console.log('🔄 Refreshed MIDI devices:', outputs.length, 'outputs found');
    } catch (error) {
      console.error('❌ Failed to refresh devices:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Get devices on mount only (remove dependency to prevent infinite loop)
  useEffect(() => {
    // Delay the initial refresh to prevent blocking
    const timer = setTimeout(() => {
      refreshDevices();
    }, 100);
    
    return () => clearTimeout(timer);
  }, []); // Empty dependency array - only run on mount

  // Listen for global device changes
  useEffect(() => {
    const handleDeviceChange = () => {
      console.log('🔄 Device change detected, refreshing...');
      refreshDevices();
    };

    window.addEventListener('globalMidiDeviceChange', handleDeviceChange);
    return () => {
      window.removeEventListener('globalMidiDeviceChange', handleDeviceChange);
    };
  }, [refreshDevices]); // Include refreshDevices in dependency

  // Connect to output device
  const connectToOutput = async (deviceId: string) => {
    try {
      const success = await globalMidi.connectToDevice(deviceId);
      if (success) {
        toast({
          title: "Device Connected",
          description: "MIDI device connected successfully",
        });
        refreshDevices();
      } else {
        toast({
          title: "Connection Failed",
          description: "Failed to connect to MIDI device",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('❌ Failed to connect:', error);
      toast({
        title: "Connection Error",
        description: "An error occurred while connecting",
        variant: "destructive",
      });
    }
  };

  // Send MIDI command
  const sendMIDICommand = async () => {
    if (!globalMidi.isConnected) {
      toast({
        title: "No Device Connected",
        description: "Please connect to an output device first",
        variant: "destructive",
      });
      return;
    }

    if (!testMessage.trim()) {
      toast({
        title: "No Command",
        description: "Enter a MIDI command to send",
        variant: "destructive",
      });
      return;
    }

    try {
      const success = await globalMidi.sendCommand(testMessage);
      if (success) {
        setLastSentMessage(testMessage);
        
        const message = `📤 ${testMessage} (sent successfully)`;
        setMidiMessages(prev => [message, ...prev.slice(0, 9)]);
        
        console.log('✅ MIDI sent successfully:', testMessage);
        
        toast({
          title: "MIDI Sent",
          description: testMessage,
        });
      } else {
        toast({
          title: "Send Failed",
          description: "Failed to send MIDI command",
          variant: "destructive",
        });
      }
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

  // Check Web MIDI support
  const isSupported = typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator;

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
          Persistent Web MIDI Manager
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Connection Status */}
        <div className="bg-muted/50 p-3 rounded-lg">
          <h4 className="font-medium mb-2">Connection Status</h4>
          <div className="flex items-center gap-2">
            {globalMidi.isConnected ? (
              <>
                <Wifi className="h-4 w-4 text-green-600" />
                <Badge variant="default">Connected: {globalMidi.deviceName}</Badge>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4 text-red-600" />
                <Badge variant="secondary">Not Connected</Badge>
              </>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            🔄 This connection persists even when closing this dialog
          </p>
        </div>

        {/* Output Devices */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold">MIDI Output Devices</h3>
            <Button 
              onClick={refreshDevices} 
              disabled={isRefreshing}
              size="sm" 
              variant="outline"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {availableOutputs.length === 0 ? (
            <div className="text-muted-foreground space-y-2">
              <p>No MIDI output devices found</p>
              <div className="text-xs bg-muted/50 p-3 rounded">
                <p className="font-medium mb-1">Troubleshooting:</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Connect your MIDI device to your computer</li>
                  <li>For Bluetooth MIDI: Pair and connect your device first</li>
                  <li>Ensure your device appears in system MIDI settings</li>
                  <li>Try clicking "Refresh" above</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="grid gap-2">
              {availableOutputs.map((device) => (
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
                      variant={globalMidi.isConnected && globalMidi.deviceName === device.name ? 'default' : 'outline'}
                    >
                      {globalMidi.isConnected && globalMidi.deviceName === device.name ? 'Connected' : 'Connect'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        

        {/* MIDI Messages */}
        {midiMessages.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-3">Recent Messages</h3>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {midiMessages.map((message, index) => (
                <div key={index} className="text-sm font-mono bg-muted p-2 rounded">
                  {message}
                </div>
              ))}
            </div>
          </div>
        )}

        
      </CardContent>
    </Card>
  );
}