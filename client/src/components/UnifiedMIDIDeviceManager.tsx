import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { 
  Music, 
  Volume2, 
  VolumeX,
  Wifi, 
  WifiOff, 
  RefreshCw, 
  Power, 
  PowerOff,
  Send,
  Monitor,
  AlertCircle,
  CheckCircle2,
  Zap,
  Target,
  Loader2,
  X,
  Trash2
} from 'lucide-react';
import { useGlobalWebMIDI } from '@/hooks/useGlobalWebMIDI';

interface MIDIDevice {
  id: string;
  name: string;
  manufacturer: string;
  state: string;
  type: 'input' | 'output';
  connection: string;
  isConnected?: boolean;
}

interface MIDIMessage {
  timestamp: number;
  data: number[];
  formatted: string;
  direction: 'in' | 'out';
  deviceName: string;
}

export function UnifiedMIDIDeviceManager() {
  const [testMessage, setTestMessage] = useState('[[PC:1:1]]');
  const [midiMessages, setMidiMessages] = useState<MIDIMessage[]>([]);
  const [availableDevices, setAvailableDevices] = useState<MIDIDevice[]>([]);
  const [connectedDevices, setConnectedDevices] = useState<Set<string>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [showMessages, setShowMessages] = useState(false);
  const [forgottenDevices, setForgottenDevices] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  
  const globalMidi = useGlobalWebMIDI();

  // Refresh available devices with timeout protection
  const refreshDevices = async () => {
    if (isRefreshing) return; // Prevent multiple simultaneous refreshes
    
    setIsRefreshing(true);
    setIsInitializing(true);
    
    try {
      console.log('🔍 Refreshing MIDI devices with timeout protection...');
      
      // Initialize with timeout protection
      const initPromise = globalMidi.refreshDevices();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Device refresh timeout')), 3000);
      });
      
      await Promise.race([initPromise, timeoutPromise]);
      
      // Get all available devices (inputs and outputs)
      const outputs = globalMidi.getAvailableOutputs();
      const inputs = globalMidi.getAvailableInputs();
      
      // Sync with global MIDI connection state
      const actuallyConnectedDevices = new Set<string>();
      
      // Check if global output device is connected
      if (globalMidi.isConnected && globalMidi.deviceName) {
        // Find device by name (since we may not have exact ID match)
        const connectedOutput = outputs.find(d => d.name === globalMidi.deviceName);
        if (connectedOutput) {
          actuallyConnectedDevices.add(connectedOutput.id);
        }
      }
      
      // Filter out forgotten devices and mark connection status
      const allDevices = [...outputs, ...inputs]
        .filter(device => !Array.from(forgottenDevices).includes(device.id))
        .map(device => ({
          ...device,
          isConnected: actuallyConnectedDevices.has(device.id)
        }));
      
      setConnectedDevices(actuallyConnectedDevices);
      setAvailableDevices(allDevices);
      console.log(`🔄 Found ${allDevices.length} MIDI devices (${outputs.length} outputs, ${inputs.length} inputs)`);
      
    } catch (error) {
      console.error('❌ Device refresh failed:', error);
      toast({
        title: "Device Refresh Failed", 
        description: error instanceof Error ? error.message : "Failed to refresh MIDI devices",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
      setIsInitializing(false);
    }
  };

  // Connect to a specific device
  const connectToDevice = async (deviceId: string, deviceName: string) => {
    try {
      const device = availableDevices.find(d => d.id === deviceId);
      if (!device) return;

      let success = false;
      if (device.type === 'output') {
        success = await globalMidi.connectToDevice(deviceId);
      } else {
        success = await globalMidi.connectToInputDevice(deviceId);
      }

      if (success) {
        setConnectedDevices(prev => new Set([...Array.from(prev), deviceId]));
        setAvailableDevices(prev => 
          prev.map(d => d.id === deviceId ? { ...d, isConnected: true } : d)
        );
        
        toast({
          title: "Device Connected",
          description: `Connected to ${deviceName}`,
        });
        
        addMessage({
          timestamp: Date.now(),
          data: [],
          formatted: `Connected to ${device.type}: ${deviceName}`,
          direction: 'in',
          deviceName
        });
      } else {
        toast({
          title: "Connection Failed",
          description: `Failed to connect to ${deviceName}`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Connection failed:', error);
      toast({
        title: "Connection Error",
        description: "Failed to establish device connection",
        variant: "destructive",
      });
    }
  };

  // Disconnect from a device
  const disconnectFromDevice = async (deviceId: string, deviceName: string) => {
    try {
      // Use the global MIDI system to actually disconnect the device
      const success = await globalMidi.disconnectDevice(deviceId);
      
      if (success) {
        // Update local state to reflect disconnection
        setConnectedDevices(prev => {
          const newArray = Array.from(prev).filter(id => id !== deviceId);
          return new Set(newArray);
        });
        
        setAvailableDevices(prev => 
          prev.map(d => d.id === deviceId ? { ...d, isConnected: false } : d)
        );

        addMessage({
          timestamp: Date.now(),
          data: [],
          formatted: `Disconnected from: ${deviceName}`,
          direction: 'out',
          deviceName
        });

        toast({
          title: "Device Disconnected",
          description: `Successfully disconnected from ${deviceName}`,
        });
        
        // Refresh device list to sync state
        setTimeout(() => {
          refreshDevices();
        }, 500);
        
      } else {
        toast({
          title: "Disconnect Failed",
          description: "Device may not be connected or already disconnected",
          variant: "destructive",
        });
      }
      
    } catch (error) {
      console.error('Failed to disconnect device:', error);
      toast({
        title: "Disconnect Failed",
        description: "Failed to disconnect from device",
        variant: "destructive",
      });
    }
  };

  // Forget a device (remove from list)
  const forgetDevice = (deviceId: string, deviceName: string) => {
    setForgottenDevices(prev => new Set([...Array.from(prev), deviceId]));
    setAvailableDevices(prev => prev.filter(d => d.id !== deviceId));
    
    toast({
      title: "Device Forgotten",
      description: `${deviceName} removed from device list`,
    });
  };

  // Clear all unavailable devices
  const clearUnavailableDevices = () => {
    const unavailableDevices = availableDevices.filter(d => d.state !== 'connected');
    const forgottenIds = unavailableDevices.map(d => d.id);
    
    setForgottenDevices(prev => new Set([...Array.from(prev), ...forgottenIds]));
    setAvailableDevices(prev => prev.filter(d => d.state === 'connected'));
    
    toast({
      title: "Devices Cleared",
      description: `Removed ${unavailableDevices.length} unavailable device${unavailableDevices.length !== 1 ? 's' : ''}`,
    });
  };

  // Send MIDI command
  const sendMIDICommand = async () => {
    if (!testMessage.trim()) return;
    
    try {
      const success = await globalMidi.sendCommand(testMessage.trim());
      if (success) {
        addMessage({
          timestamp: Date.now(),
          data: [],
          formatted: testMessage.trim(),
          direction: 'out',
          deviceName: globalMidi.deviceName || 'Unknown Device'
        });
        
        toast({
          title: "MIDI Command Sent",
          description: `Sent: ${testMessage.trim()}`,
        });
        
        setTestMessage('');
      } else {
        toast({
          title: "Send Failed",
          description: "No connected output devices",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "MIDI Error",
        description: "Failed to send MIDI command",
        variant: "destructive",
      });
    }
  };

  // Add message to log
  const addMessage = (message: MIDIMessage) => {
    setMidiMessages(prev => [message, ...prev].slice(0, 50)); // Keep last 50 messages
  };

  // Clear message log
  const clearMessages = () => {
    setMidiMessages([]);
  };

  // Sync with actually connected devices on mount
  const syncConnectedDevices = useCallback(() => {
    const actuallyConnected = new Set<string>();
    
    if (globalMidi.isConnected && globalMidi.deviceName) {
      // For now, we'll use device name matching since the global system uses names
      // This should be improved to use proper device IDs in the future
      console.log('🔄 Syncing with connected device:', globalMidi.deviceName);
      
      // We'll mark this device as connected when we refresh devices
      // The actual sync happens in refreshDevices()
    }
    
    return actuallyConnected;
  }, [globalMidi.isConnected, globalMidi.deviceName]);
  
  // Initial device refresh and state sync on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      refreshDevices();
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  // Listen for global device changes
  useEffect(() => {
    const handleDeviceChange = () => {
      console.log('🔄 Global device change detected, refreshing...');
      refreshDevices();
    };

    window.addEventListener('globalMidiDeviceChange', handleDeviceChange);
    return () => {
      window.removeEventListener('globalMidiDeviceChange', handleDeviceChange);
    };
  }, []);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Music className="h-5 w-5" />
          MIDI Device Manager
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Connect to multiple MIDI devices simultaneously (USB, Bluetooth, Network)
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Connection Status & Controls */}
        <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
          <div className="flex items-center gap-3">
            {Array.from(connectedDevices).length > 0 ? (
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            ) : (
              <AlertCircle className="w-5 h-5 text-yellow-500" />
            )}
            <div>
              <p className="font-medium">
                {Array.from(connectedDevices).length > 0 
                  ? `${Array.from(connectedDevices).length} Device${Array.from(connectedDevices).length > 1 ? 's' : ''} Connected`
                  : 'No Connections'
                }
              </p>
              <p className="text-sm text-muted-foreground">
                {availableDevices.length} device{availableDevices.length !== 1 ? 's' : ''} available
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={refreshDevices}
              disabled={isRefreshing || isInitializing}
            >
              {isRefreshing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              {isInitializing ? 'Initializing...' : 'Refresh'}
            </Button>
            {availableDevices.some(d => d.state !== 'connected') && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearUnavailableDevices}
                className="text-orange-600 border-orange-200 hover:bg-orange-50"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Clear Unavailable
              </Button>
            )}
          </div>
        </div>

        {/* Device List */}
        <div>
          <h3 className="font-medium mb-3 flex items-center gap-2">
            <Target className="w-4 h-4" />
            Available MIDI Devices
          </h3>
          <ScrollArea className="h-64 border rounded-lg p-2">
            <div className="space-y-2">
              {availableDevices.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {isInitializing ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Scanning for devices...</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p>No MIDI devices found</p>
                      <p className="text-xs">Connect a MIDI device and click Refresh</p>
                    </div>
                  )}
                </div>
              ) : (
                availableDevices.map((device) => (
                  <div
                    key={device.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {device.type === 'output' ? (
                        <Volume2 className="w-4 h-4 text-blue-500" />
                      ) : (
                        <VolumeX className="w-4 h-4 text-green-500" />
                      )}
                      <div>
                        <p className="font-medium text-sm">{device.name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{device.manufacturer}</span>
                          <Badge variant="outline" className="text-xs">
                            {device.type}
                          </Badge>
                          <Badge 
                            variant={device.state === 'connected' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {device.state === 'connected' ? 'Available' : 'Unavailable'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {device.isConnected ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => disconnectFromDevice(device.id, device.name)}
                          className="text-red-600 border-red-200 hover:bg-red-50"
                        >
                          <PowerOff className="w-3 h-3 mr-1" />
                          Disconnect
                        </Button>
                      ) : (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => connectToDevice(device.id, device.name)}
                            disabled={device.state !== 'connected'}
                          >
                            <Power className="w-3 h-3 mr-1" />
                            Connect
                          </Button>
                          {device.state !== 'connected' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => forgetDevice(device.id, device.name)}
                              className="text-gray-500 border-gray-200 hover:bg-gray-50"
                              title="Remove from device list"
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* MIDI Commands */}
        {Array.from(connectedDevices).length > 0 && (
          <>
            <Separator />
            <div>
              <h3 className="font-medium mb-3 flex items-center gap-2">
                <Send className="w-4 h-4" />
                Send MIDI Command
              </h3>
              <div className="flex gap-2 mb-3">
                <Input
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  placeholder="[[PC:1:1]], [[CC:7:64:1]], [[NOTE:60:127:1]]"
                  onKeyPress={(e) => e.key === 'Enter' && sendMIDICommand()}
                />
                <Button onClick={sendMIDICommand} disabled={!testMessage.trim()}>
                  <Send className="w-4 h-4 mr-2" />
                  Send
                </Button>
              </div>
              
              {/* Quick Test Commands */}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setTestMessage('[[PC:1:1]]')}>
                  Program 1
                </Button>
                <Button variant="outline" size="sm" onClick={() => setTestMessage('[[CC:7:127:1]]')}>
                  Volume Max
                </Button>
                <Button variant="outline" size="sm" onClick={() => setTestMessage('[[NOTE:60:127:1]]')}>
                  Middle C
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Message Monitor */}
        {midiMessages.length > 0 && (
          <>
            <Separator />
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium flex items-center gap-2">
                  <Monitor className="w-4 h-4" />
                  MIDI Messages ({midiMessages.length})
                </h3>
                <Button variant="outline" size="sm" onClick={clearMessages}>
                  Clear
                </Button>
              </div>
              <ScrollArea className="h-32 border rounded-lg p-2">
                <div className="space-y-1">
                  {midiMessages.map((message, index) => (
                    <div
                      key={index}
                      className={`text-xs p-2 rounded flex items-center justify-between ${
                        message.direction === 'out' 
                          ? 'bg-blue-50 border-l-2 border-blue-400' 
                          : 'bg-green-50 border-l-2 border-green-400'
                      }`}
                    >
                      <div className="font-mono">{message.formatted}</div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <span>{message.deviceName}</span>
                        <span>{new Date(message.timestamp).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}