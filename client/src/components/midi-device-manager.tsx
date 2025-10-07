import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Usb, 
  Bluetooth, 
  Volume2, 
  VolumeX, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  Send, 
  AlertCircle,
  CheckCircle,
  Circle,
  Activity,
  Keyboard
} from 'lucide-react';
import { MidiDevice, MidiCommand } from '@/hooks/useMidiDevices';
import { useMidi } from '@/contexts/MidiProvider';

interface MidiDeviceManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MidiDeviceManager({ isOpen, onClose }: MidiDeviceManagerProps) {
  const {
    devices,
    connectedDevices,
    isSupported,
    isInitialized,
    error,
    connectDevice,
    disconnectDevice,
    sendMidiCommand,
    parseMidiCommand,
    refreshDevices,
    initializeMidi,
    initializeBluetoothMidi
  } = useMidi();

  const [testCommand, setTestCommand] = useState('[[PC:1:1]]');
  const [connectionStates, setConnectionStates] = useState<Record<string, 'connecting' | 'idle'>>({});

  // Refresh devices when dialog opens
  useEffect(() => {
    if (isOpen && isInitialized) {
      refreshDevices();
    }
  }, [isOpen, isInitialized, refreshDevices]);
  


  const handleScan = async () => {
    try {
      // First ensure USB MIDI is initialized
      if (!isInitialized) {
        await initializeMidi();
      }
      // Then scan for Bluetooth devices
      await initializeBluetoothMidi(); 
    } catch (err) {
      console.error('Failed to scan for MIDI devices:', err);
    }
  };

  const handleConnect = async (deviceId: string) => {
    setConnectionStates(prev => ({ ...prev, [deviceId]: 'connecting' }));
    try {
      const success = await connectDevice(deviceId);
      if (!success) {
        console.error('Failed to connect to device:', deviceId);
      }
    } finally {
      setConnectionStates(prev => ({ ...prev, [deviceId]: 'idle' }));
    }
  };

  const handleDisconnect = async (deviceId: string) => {
    // Immediately set to idle (no "disconnecting" state)
    setConnectionStates(prev => ({ ...prev, [deviceId]: 'idle' }));
    try {
      const success = await disconnectDevice(deviceId);
      if (!success) {
        console.error('Failed to disconnect from device:', deviceId);
      }
    } catch (err) {
      console.error('Error disconnecting device:', err);
    }
  };


  const handleTestCommand = async () => {
    const command = parseMidiCommand(testCommand);
    if (!command) {
      alert('Invalid MIDI command format. Use: [[PC:value:channel]] or [[CC:controller:value:channel]]');
      return;
    }

    const outputDevices = connectedDevices.filter(d => d.type === 'output');
    if (outputDevices.length === 0) {
      alert('No connected MIDI output devices found');
      return;
    }

    const success = await sendMidiCommand(command);
    if (success) {
      console.log(`✅ Sent test command: ${testCommand}`);
    } else {
      alert('Failed to send MIDI command');
    }
  };

  const getDeviceIcon = (device: MidiDevice) => {
    if (device.isBluetooth) return <Bluetooth className="h-4 w-4" />;
    if (device.isUSB) return <Usb className="h-4 w-4" />;
    return <Keyboard className="h-4 w-4" />;
  };


  if (!isSupported) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-midi-not-supported">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              MIDI Not Supported
            </DialogTitle>
          </DialogHeader>
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">
              Your browser doesn't support the Web MIDI API. Please use a modern browser like Chrome, Firefox, or Edge.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh]" data-testid="dialog-midi-device-manager">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              MIDI Device Manager
              {connectedDevices.length > 0 && (
                <Badge variant="secondary" data-testid="badge-connected-count">
                  {connectedDevices.length} Connected
                </Badge>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleScan}
              data-testid="button-scan-devices"
              title="Scan for MIDI devices"
              className="mr-8"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Scan MIDI
            </Button>
          </DialogTitle>
        </DialogHeader>

        {error && (
          <div className="bg-destructive/10 border border-destructive rounded-lg p-3 mb-4">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm font-medium">MIDI Error</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
          </div>
        )}

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-6">
            
            {/* All MIDI Devices */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Activity className="h-4 w-4" />
                <h3 className="font-semibold">All MIDI Devices</h3>
                <Badge variant="outline">{devices.length}</Badge>
              </div>
              
              {devices.length === 0 ? (
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center text-muted-foreground">
                      <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No MIDI devices detected</p>
                      <p className="text-xs">Connect a MIDI device or click "Scan Bluetooth" to find devices</p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-2">
                  {devices.map((device, index) => {
                    const isConnected = connectedDevices.some(d => d.id === device.id);
                    const state = connectionStates[device.id] || 'idle';
                    
                    return (
                      <Card key={device.id} className="py-2">
                        <CardContent className="py-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {getDeviceIcon(device)}
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm" data-testid={`device-name-${index}`}>
                                    {device.name}
                                  </span>
                                  {device.manufacturer !== 'Unknown' && (
                                    <span className="text-xs text-muted-foreground">
                                      ({device.manufacturer})
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant="secondary" className="text-xs">
                                    {device.type === 'input' ? 'IN' : 'OUT'}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {isConnected ? 'Connected' : 'Available'}
                                  </span>
                                </div>
                              </div>
                            </div>
                            
                            <Button
                              variant={isConnected ? "destructive" : "default"}
                              size="sm"
                              onClick={() => isConnected ? handleDisconnect(device.id) : handleConnect(device.id)}
                              disabled={state === 'connecting'}
                              data-testid={`button-toggle-${index}`}
                            >
                              {state === 'connecting' ? (
                                <>
                                  <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                                  Connecting...
                                </>
                              ) : isConnected ? (
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
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Test MIDI Commands */}
            {connectedDevices.filter(d => d.type === 'output').length > 0 && (
              <>
                <Separator />
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Send className="h-4 w-4" />
                    <h3 className="font-semibold">Test MIDI Commands</h3>
                  </div>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Send Test Command</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <Label htmlFor="test-command" className="text-xs">
                            MIDI Command
                          </Label>
                          <Input
                            id="test-command"
                            value={testCommand}
                            onChange={(e) => setTestCommand(e.target.value)}
                            placeholder="[[PC:1:1]]"
                            className="mt-1"
                            data-testid="input-test-command"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Examples: [[PC:1:1]], [[CC:7:127:1]], [[NOTE:60:127:1]]
                          </p>
                        </div>
                        <div className="flex items-end">
                          <Button 
                            onClick={handleTestCommand}
                            size="sm"
                            data-testid="button-send-test-command"
                          >
                            <Send className="h-4 w-4 mr-1" />
                            Send
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}

          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}