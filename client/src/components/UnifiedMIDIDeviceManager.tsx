import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { 
  Music, 
  RefreshCw, 
  Send,
  Target,
  Loader2,
  Trash2,
  X
} from 'lucide-react';
import { useGlobalWebMIDI } from '@/hooks/useGlobalWebMIDI';

interface SimpleDevice {
  name: string;
  manufacturer: string;
  state: string;
  isConnected: boolean;
  outputId?: string;
  inputId?: string;
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
  const [devices, setDevices] = useState<SimpleDevice[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showMessages, setShowMessages] = useState(false);
  const [forgottenDevices, setForgottenDevices] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  
  const globalMidi = useGlobalWebMIDI();

  // Add MIDI message to the list
  const addMessage = (message: MIDIMessage) => {
    setMidiMessages(prev => [message, ...prev.slice(0, 99)]);
  };

  // Refresh devices and group by name
  const refreshDevices = async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    
    try {
      await globalMidi.refreshDevices();
      
      const outputs = globalMidi.getAvailableOutputs();
      const inputs = globalMidi.getAvailableInputs();
      
      // Group by BASE device name (strip IN/OUT suffixes)
      const deviceMap = new Map<string, SimpleDevice>();
      
      // Process all devices and group by base name
      [...outputs, ...inputs].forEach(device => {
        // Remove IN/OUT suffixes to get base device name
        const baseName = device.name.replace(/ (IN|OUT)$/i, '');
        
        if (!forgottenDevices.has(baseName)) {
          if (!deviceMap.has(baseName)) {
            deviceMap.set(baseName, {
              name: baseName,
              manufacturer: device.manufacturer,
              state: device.state,
              isConnected: false, // Will be set correctly below
              outputId: undefined,
              inputId: undefined
            });
          }
          
          const existing = deviceMap.get(baseName)!;
          
          // Store the appropriate ID
          if (device.type === 'output') {
            existing.outputId = device.id;
          } else {
            existing.inputId = device.id;
          }
          
          // Update state if this port is available
          if (device.state === 'connected') {
            existing.state = 'connected';
          }
          
          // Check if this device is currently connected
          // Check both primary device and multi-device collections
          if (globalMidi.isConnected && globalMidi.deviceName.replace(/ (IN|OUT)$/i, '') === baseName) {
            existing.isConnected = true;
          }
          
          // Also check if any port of this device is in the connected collections
          const allOutputs = globalMidi.getAvailableOutputs();
          const allInputs = globalMidi.getAvailableInputs();
          const devicePorts = [...allOutputs, ...allInputs].filter(d => 
            d.name.replace(/ (IN|OUT)$/i, '') === baseName
          );
          
          // For now, mark as connected if primary device matches
          // TODO: Implement proper multi-device status checking
        }
      });
      
      setDevices(Array.from(deviceMap.values()));
      
    } catch (error) {
      console.error('Device refresh failed:', error);
      toast({
        title: "Refresh Failed", 
        description: "Failed to refresh MIDI devices",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Simple toggle: connect/disconnect both input AND output for the device
  const toggleDevice = async (deviceName: string, isCurrentlyConnected: boolean) => {
    try {
      if (isCurrentlyConnected) {
        // Disconnect just this device (not all devices)
        const device = devices.find(d => d.name === deviceName);
        if (device) {
          // Try to disconnect by device ID
          if (device.outputId) {
            await globalMidi.disconnectDevice(device.outputId);
          }
          if (device.inputId) {
            await globalMidi.disconnectDevice(device.inputId);
          }
        }
        
        // Update UI state immediately
        setDevices(prev => prev.map(d => 
          d.name === deviceName ? { ...d, isConnected: false } : d
        ));
        
        toast({
          title: "Disconnected",
          description: `Disconnected from ${deviceName}`,
        });
      } else {
        // Connect both input and output for this device
        const device = devices.find(d => d.name === deviceName);
        if (!device) {
          toast({
            title: "Failed",
            description: `Device ${deviceName} not found`,
            variant: "destructive",
          });
          return;
        }

        let outputConnected = false;
        let inputConnected = false;

        // Connect output if available
        if (device.outputId) {
          outputConnected = await globalMidi.connectToDevice(device.outputId);
        }

        // Connect input if available  
        if (device.inputId) {
          inputConnected = await globalMidi.connectToInputDevice(device.inputId);
        }

        if (outputConnected || inputConnected) {
          const connections = [];
          if (outputConnected) connections.push('output');
          if (inputConnected) connections.push('input');
          
          // Update UI state immediately
          setDevices(prev => prev.map(d => 
            d.name === deviceName ? { ...d, isConnected: true } : d
          ));
          
          toast({
            title: "Connected",
            description: `Connected ${deviceName} (${connections.join(' & ')})`,
          });
        } else {
          toast({
            title: "Failed",
            description: `Failed to connect to ${deviceName}`,
            variant: "destructive",
          });
        }
      }
      
      // Refresh after toggle to sync with actual state
      setTimeout(() => refreshDevices(), 300);
      
    } catch (error) {
      console.error('Toggle failed:', error);
      toast({
        title: "Error",
        description: "Failed to toggle device",
        variant: "destructive",
      });
    }
  };

  // Forget a device
  const forgetDevice = (deviceName: string) => {
    setForgottenDevices(prev => new Set([...Array.from(prev), deviceName]));
    setDevices(prev => prev.filter(d => d.name !== deviceName));
    
    toast({
      title: "Device Forgotten",
      description: `${deviceName} removed from list`,
    });
  };

  // Clear unavailable devices
  const clearUnavailableDevices = () => {
    const unavailable = devices.filter(d => d.state !== 'connected');
    const names = unavailable.map(d => d.name);
    
    setForgottenDevices(prev => new Set([...Array.from(prev), ...names]));
    setDevices(prev => prev.filter(d => d.state === 'connected'));
    
    toast({
      title: "Cleared",
      description: `Removed ${unavailable.length} unavailable devices`,
    });
  };

  // Send MIDI command
  const sendMIDICommand = async () => {
    if (!testMessage.trim()) return;
    
    const success = await globalMidi.sendCommand(testMessage);
    
    addMessage({
      timestamp: Date.now(),
      data: [],
      formatted: testMessage,
      direction: 'out',
      deviceName: globalMidi.deviceName || 'Unknown'
    });

    if (success) {
      toast({
        title: "MIDI Sent",
        description: `Sent: ${testMessage}`,
      });
    } else {
      toast({
        title: "Send Failed",
        description: "Failed to send MIDI command",
        variant: "destructive",
      });
    }
  };

  // Initial refresh
  useEffect(() => {
    const timer = setTimeout(() => refreshDevices(), 100);
    return () => clearTimeout(timer);
  }, []);

  // Listen for connection changes
  useEffect(() => {
    const handleConnectionChange = () => {
      refreshDevices();
    };

    window.addEventListener('globalMidiConnectionChange', handleConnectionChange);
    return () => {
      window.removeEventListener('globalMidiConnectionChange', handleConnectionChange);
    };
  }, []);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Music className="h-5 w-5" />
          MIDI Devices
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Simple toggle switches for MIDI devices
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Controls */}
        <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
          <div>
            <p className="font-medium">
              {globalMidi.isConnected ? `Connected: ${globalMidi.deviceName}` : 'No Connection'}
            </p>
            <p className="text-sm text-muted-foreground">
              {devices.length} device{devices.length !== 1 ? 's' : ''} found
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={refreshDevices}
              disabled={isRefreshing}
            >
              {isRefreshing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Refresh
            </Button>
            {devices.some(d => d.state !== 'connected') && (
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
            MIDI Devices
          </h3>
          <ScrollArea className="h-64 border rounded-lg p-2">
            <div className="space-y-2">
              {devices.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {isRefreshing ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Scanning...</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p>No MIDI devices found</p>
                      <p className="text-xs">Connect a device and click Refresh</p>
                    </div>
                  )}
                </div>
              ) : (
                devices.map((device) => (
                  <div
                    key={device.name}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Music className="w-4 h-4 text-blue-500" />
                      <div>
                        <p className="font-medium text-sm">{device.name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{device.manufacturer}</span>
                          <Badge 
                            variant={device.state === 'connected' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {device.state === 'connected' ? 'Available' : 'Unavailable'}
                          </Badge>
                          {device.isConnected && (
                            <Badge variant="default" className="text-xs bg-green-500">
                              Connected
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant={device.isConnected ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleDevice(device.name, device.isConnected)}
                        disabled={device.state !== 'connected'}
                        className={device.isConnected ? "bg-red-600 hover:bg-red-700" : ""}
                      >
                        {device.isConnected ? 'Disconnect' : 'Connect'}
                      </Button>
                      {device.state !== 'connected' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => forgetDevice(device.name)}
                          className="text-gray-500 border-gray-200 hover:bg-gray-50"
                          title="Remove from device list"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* MIDI Commands */}
        {globalMidi.isConnected && (
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
              
              {/* Quick Commands */}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setTestMessage('[[PC:1:1]]')}>
                  Program 1
                </Button>
                <Button variant="outline" size="sm" onClick={() => setTestMessage('[[CC:7:127:1]]')}>
                  Volume Max
                </Button>
                <Button variant="outline" size="sm" onClick={() => setTestMessage('[[CC:7:0:1]]')}>
                  Volume Off
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Message Log */}
        {showMessages && midiMessages.length > 0 && (
          <>
            <Separator />
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium">MIDI Messages</h3>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setMidiMessages([])}
                >
                  Clear
                </Button>
              </div>
              <ScrollArea className="h-32 border rounded-lg p-2">
                <div className="space-y-1">
                  {midiMessages.map((msg, index) => (
                    <div key={index} className="text-xs font-mono p-1 rounded bg-muted">
                      <span className={msg.direction === 'out' ? 'text-blue-600' : 'text-green-600'}>
                        {msg.direction === 'out' ? '→' : '←'} {msg.formatted}
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </>
        )}

        <div className="flex justify-between items-center">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setShowMessages(!showMessages)}
          >
            {showMessages ? 'Hide' : 'Show'} Messages ({midiMessages.length})
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}