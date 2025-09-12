import React, { useState, useEffect } from 'react';
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
import { useMidiDevices, MidiDevice, MidiCommand } from '@/hooks/useMidiDevices';

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
    refreshDevices
  } = useMidiDevices();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [testCommand, setTestCommand] = useState('[[PC:1:1]]');
  const [connectionStates, setConnectionStates] = useState<Record<string, 'connecting' | 'disconnecting' | 'idle'>>({});

  // Refresh devices when dialog opens
  useEffect(() => {
    if (isOpen && isInitialized) {
      handleRefresh();
    }
  }, [isOpen, isInitialized]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshDevices();
    } finally {
      setIsRefreshing(false);
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
    setConnectionStates(prev => ({ ...prev, [deviceId]: 'disconnecting' }));
    try {
      const success = await disconnectDevice(deviceId);
      if (!success) {
        console.error('Failed to disconnect from device:', deviceId);
      }
    } finally {
      setConnectionStates(prev => ({ ...prev, [deviceId]: 'idle' }));
    }
  };

  // Handle unified device connections (both input and output)
  const handleUnifiedConnect = async (unifiedDevice: any) => {
    const deviceIds = [];
    if (unifiedDevice.inputDevice) deviceIds.push(unifiedDevice.inputDevice.id);
    if (unifiedDevice.outputDevice) deviceIds.push(unifiedDevice.outputDevice.id);
    
    // Set connecting state for all device IDs
    const newStates: Record<string, 'connecting' | 'disconnecting' | 'idle'> = {};
    deviceIds.forEach(id => newStates[id] = 'connecting');
    setConnectionStates(prev => ({ ...prev, ...newStates }));
    
    try {
      // Connect both input and output devices
      const results = await Promise.all(deviceIds.map(id => connectDevice(id)));
      const anyFailed = results.some(success => !success);
      if (anyFailed) {
        console.error('Failed to connect to some devices:', deviceIds);
      }
    } finally {
      // Reset states
      const resetStates: Record<string, 'connecting' | 'disconnecting' | 'idle'> = {};
      deviceIds.forEach(id => resetStates[id] = 'idle');
      setConnectionStates(prev => ({ ...prev, ...resetStates }));
    }
  };

  const handleUnifiedDisconnect = async (unifiedDevice: any) => {
    const deviceIds = [];
    if (unifiedDevice.inputDevice) deviceIds.push(unifiedDevice.inputDevice.id);
    if (unifiedDevice.outputDevice) deviceIds.push(unifiedDevice.outputDevice.id);
    
    // Set disconnecting state for all device IDs
    const newStates: Record<string, 'connecting' | 'disconnecting' | 'idle'> = {};
    deviceIds.forEach(id => newStates[id] = 'disconnecting');
    setConnectionStates(prev => ({ ...prev, ...newStates }));
    
    try {
      // Disconnect both input and output devices
      const results = await Promise.all(deviceIds.map(id => disconnectDevice(id)));
      const anyFailed = results.some(success => !success);
      if (anyFailed) {
        console.error('Failed to disconnect from some devices:', deviceIds);
      }
    } finally {
      // Reset states
      const resetStates: Record<string, 'connecting' | 'disconnecting' | 'idle'> = {};
      deviceIds.forEach(id => resetStates[id] = 'idle');
      setConnectionStates(prev => ({ ...prev, ...resetStates }));
    }
  };

  // Check if unified device is connected
  const isUnifiedDeviceConnected = (unifiedDevice: any) => {
    const inputConnected = unifiedDevice.inputDevice ? 
      connectedDevices.some(d => d.id === unifiedDevice.inputDevice.id) : true;
    const outputConnected = unifiedDevice.outputDevice ? 
      connectedDevices.some(d => d.id === unifiedDevice.outputDevice.id) : true;
    return inputConnected && outputConnected;
  };

  // Get unified device connection state
  const getUnifiedDeviceState = (unifiedDevice: any) => {
    const states = [];
    if (unifiedDevice.inputDevice) {
      states.push(connectionStates[unifiedDevice.inputDevice.id] || 'idle');
    }
    if (unifiedDevice.outputDevice) {
      states.push(connectionStates[unifiedDevice.outputDevice.id] || 'idle');
    }
    
    if (states.some(s => s === 'connecting')) return 'connecting';
    if (states.some(s => s === 'disconnecting')) return 'disconnecting';
    return 'idle';
  };

  const handleTestCommand = () => {
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

    const success = sendMidiCommand(command);
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

  const getConnectionIcon = (device: MidiDevice) => {
    const isConnected = connectedDevices.some(d => d.id === device.id);
    const state = connectionStates[device.id];
    
    if (state === 'connecting' || state === 'disconnecting') {
      return <RefreshCw className="h-4 w-4 animate-spin" />;
    }
    
    if (device.state === 'disconnected') {
      return <Circle className="h-4 w-4 text-muted-foreground" />;
    }
    
    if (isConnected && device.connection === 'open') {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    
    return <AlertCircle className="h-4 w-4 text-yellow-500" />;
  };

  const getConnectionStatus = (device: MidiDevice) => {
    const isConnected = connectedDevices.some(d => d.id === device.id);
    const state = connectionStates[device.id];
    
    if (state === 'connecting') return 'Connecting...';
    if (state === 'disconnecting') return 'Disconnecting...';
    if (device.state === 'disconnected') return 'Disconnected';
    if (isConnected && device.connection === 'open') return 'Connected';
    return 'Available';
  };

  // Group devices by physical device using simple " IN"/" OUT" suffix pattern
  const unifiedDevices = React.useMemo(() => {
    const deviceMap = new Map<string, {
      name: string;
      manufacturer: string;
      isUSB: boolean;
      isBluetooth: boolean;
      inputDevice?: MidiDevice;
      outputDevice?: MidiDevice;
      capabilities: string[];
    }>();

    devices.forEach(device => {
      // Get base device name by stripping " IN" or " OUT" suffix
      let baseName = device.name;
      if (baseName.endsWith(' IN')) {
        baseName = baseName.slice(0, -3); // Remove " IN"
      } else if (baseName.endsWith(' OUT')) {
        baseName = baseName.slice(0, -4); // Remove " OUT"
      }
      
      const key = `${baseName}-${device.manufacturer}`;
      
      if (!deviceMap.has(key)) {
        deviceMap.set(key, {
          name: baseName,
          manufacturer: device.manufacturer,
          isUSB: device.isUSB,
          isBluetooth: device.isBluetooth,
          capabilities: []
        });
      }
      
      const unified = deviceMap.get(key)!;
      if (device.type === 'input') {
        unified.inputDevice = device;
        if (!unified.capabilities.includes('Input')) {
          unified.capabilities.push('Input');
        }
      } else {
        unified.outputDevice = device;
        if (!unified.capabilities.includes('Output')) {
          unified.capabilities.push('Output');
        }
      }
    });

    return Array.from(deviceMap.values());
  }, [devices]);

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
              onClick={handleRefresh}
              disabled={isRefreshing || !isInitialized}
              data-testid="button-refresh-devices"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
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
            
            {/* Unified MIDI Devices */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Activity className="h-4 w-4" />
                <h3 className="font-semibold">MIDI Devices</h3>
                <Badge variant="outline">{unifiedDevices.length}</Badge>
              </div>
              
              {unifiedDevices.length === 0 ? (
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center text-muted-foreground">
                      <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No MIDI devices found</p>
                      <p className="text-xs">Connect a MIDI device and click Refresh</p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-3">
                  {unifiedDevices.map((unifiedDevice, index) => {
                    const isConnected = isUnifiedDeviceConnected(unifiedDevice);
                    const state = getUnifiedDeviceState(unifiedDevice);
                    const deviceForIcon = unifiedDevice.outputDevice || unifiedDevice.inputDevice;
                    
                    return (
                      <Card key={`${unifiedDevice.name}-${unifiedDevice.manufacturer}-${index}`}>
                        <CardContent className="pt-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {deviceForIcon && getDeviceIcon(deviceForIcon)}
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm" data-testid={`device-name-unified-${index}`}>
                                    {unifiedDevice.name}
                                  </span>
                                  {unifiedDevice.manufacturer && (
                                    <span className="text-xs text-muted-foreground">
                                      by {unifiedDevice.manufacturer}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                  {deviceForIcon && getConnectionIcon(deviceForIcon)}
                                  <span className="text-xs text-muted-foreground" data-testid={`device-status-unified-${index}`}>
                                    {isConnected ? 'Connected' : 'Available'}
                                  </span>
                                  <div className="flex gap-1">
                                    {unifiedDevice.capabilities.map((capability) => (
                                      <span key={capability} className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-0.5 rounded">
                                        {capability}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            <Button
                              variant={isConnected ? "destructive" : "outline"}
                              size="sm"
                              onClick={() => isConnected ? handleUnifiedDisconnect(unifiedDevice) : handleUnifiedConnect(unifiedDevice)}
                              disabled={state !== 'idle'}
                              data-testid={`button-${isConnected ? 'disconnect' : 'connect'}-unified-${index}`}
                            >
                              {state === 'connecting' && 'Connecting...'}
                              {state === 'disconnecting' && 'Disconnecting...'}
                              {state === 'idle' && (isConnected ? 'Disconnect' : 'Connect')}
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