import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Keyboard,
  Search
} from 'lucide-react';
import { MidiDevice, MidiCommand } from '@/hooks/useMidiDevices';
import { useMidi } from '@/contexts/MidiProvider';

interface MidiDeviceManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

// LocalStorage key for auto-reconnect
const MIDI_AUTO_RECONNECT_KEY = 'midi-auto-reconnect-devices';

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
    isWebBluetoothSupported,
    scanForBluetoothDevices
  } = useMidi();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [testCommand, setTestCommand] = useState('[[PC:1:1]]');
  const [connectionStates, setConnectionStates] = useState<Record<string, 'connecting' | 'disconnecting' | 'idle'>>({});
  const [activeTab, setActiveTab] = useState('midi');

  // Load auto-reconnect devices on initialization
  useEffect(() => {
    if (!isInitialized) return;
    
    const autoReconnectDevices = localStorage.getItem(MIDI_AUTO_RECONNECT_KEY);
    if (autoReconnectDevices) {
      const deviceIds = JSON.parse(autoReconnectDevices);
      console.log('🔄 Auto-reconnecting to devices:', deviceIds);
      
      // Attempt to reconnect to each device
      deviceIds.forEach((deviceId: string) => {
        const device = devices.find(d => d.id === deviceId);
        if (device && !connectedDevices.some(d => d.id === deviceId)) {
          // Don't auto-connect Bluetooth devices (requires user gesture)
          if (!deviceId.startsWith('BLE:')) {
            handleConnect(deviceId);
          }
        }
      });
    }
  }, [isInitialized, devices]);

  // Save connected devices for auto-reconnect
  useEffect(() => {
    const deviceIds = connectedDevices
      .filter(d => !d.id.startsWith('BLE:')) // Don't auto-reconnect Bluetooth
      .map(d => d.id);
    
    // Always update localStorage, even if empty (to clear stale devices)
    if (deviceIds.length > 0) {
      localStorage.setItem(MIDI_AUTO_RECONNECT_KEY, JSON.stringify(deviceIds));
    } else {
      localStorage.removeItem(MIDI_AUTO_RECONNECT_KEY); // Clear when no devices connected
    }
  }, [connectedDevices]);

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

  // Scan for Bluetooth MIDI devices
  const handleBluetoothScan = async () => {
    setIsScanning(true);
    try {
      await scanForBluetoothDevices();
    } catch (error) {
      // Show user-friendly error message
      alert((error as Error).message || 'Failed to scan for Bluetooth devices');
    } finally {
      setIsScanning(false);
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
    if (device.isBluetooth || device.id.startsWith('BLE:')) return <Bluetooth className="h-4 w-4" />;
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

  // Group devices by physical device (name + manufacturer) for unified list
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

    // Function to normalize device name by removing common input/output suffixes
    const normalizeDeviceName = (name: string): string => {
      return name
        .replace(/\s+(IN|OUT|Input|Output)$/i, '')  // Remove trailing IN/OUT/Input/Output
        .replace(/A\s+(IN|OUT)$/i, '')  // Handle "MidiPortA IN" -> "MidiPort"
        .replace(/\s+BLE$/i, '') // Remove BLE suffix for grouping
        .trim();
    };

    // Filter devices by type (regular MIDI vs Bluetooth)
    const regularDevices = devices.filter(d => !d.id.startsWith('BLE:'));
    const bluetoothDevices = devices.filter(d => d.id.startsWith('BLE:'));

    // Group regular MIDI devices
    regularDevices.forEach(device => {
      const normalizedName = normalizeDeviceName(device.name);
      const key = `${normalizedName}-${device.manufacturer}`;
      
      if (!deviceMap.has(key)) {
        deviceMap.set(key, {
          name: normalizedName,
          manufacturer: device.manufacturer,
          isUSB: device.isUSB,
          isBluetooth: device.isBluetooth,
          capabilities: []
        });
      }
      
      const unified = deviceMap.get(key)!;
      if (device.type === 'input') {
        unified.inputDevice = device;
        unified.capabilities.push('Input');
      } else {
        unified.outputDevice = device;
        unified.capabilities.push('Output');
      }
    });

    return {
      regular: Array.from(deviceMap.values()),
      bluetooth: bluetoothDevices
    };
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
              className="mr-[83px]"
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

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="midi" data-testid="tab-midi">
              <Keyboard className="h-4 w-4 mr-2" />
              MIDI Devices
              {unifiedDevices.regular.length > 0 && (
                <Badge variant="outline" className="ml-2">{unifiedDevices.regular.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="bluetooth" data-testid="tab-bluetooth">
              <Bluetooth className="h-4 w-4 mr-2" />
              Bluetooth MIDI
              {unifiedDevices.bluetooth.length > 0 && (
                <Badge variant="outline" className="ml-2">{unifiedDevices.bluetooth.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="midi">
            <ScrollArea className="max-h-[50vh]">
              <div className="space-y-4">
                {unifiedDevices.regular.length === 0 ? (
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center text-muted-foreground">
                        <Keyboard className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No MIDI devices found</p>
                        <p className="text-xs">Connect a MIDI device and click Refresh</p>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-3">
                    {unifiedDevices.regular.map((unifiedDevice, index) => {
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
                                    <span className="font-medium text-sm" data-testid={`device-name-${index}`}>
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
                                    <span className="text-xs text-muted-foreground" data-testid={`device-status-${index}`}>
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
                                data-testid={`button-${isConnected ? 'disconnect' : 'connect'}-${index}`}
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
            </ScrollArea>
          </TabsContent>

          <TabsContent value="bluetooth">
            <ScrollArea className="max-h-[50vh]">
              <div className="space-y-4">
                {/* Check if we're in an iframe (Replit editor) */}
                {window.self !== window.top && (
                  <Card className="border-yellow-500">
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <AlertCircle className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
                        <p className="text-sm font-medium">Bluetooth Blocked in Preview</p>
                        <p className="text-xs mt-1 text-muted-foreground">
                          Bluetooth doesn't work in the Replit preview iframe.
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-3"
                          onClick={() => window.open(window.location.href, '_blank')}
                          data-testid="button-open-new-tab"
                        >
                          Open in New Tab ↗
                        </Button>
                        <p className="text-xs mt-2 text-muted-foreground">
                          Or click the ↗ button in the preview header
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}
                
                {!isWebBluetoothSupported ? (
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center text-muted-foreground">
                        <AlertCircle className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
                        <p className="text-sm font-medium">Bluetooth MIDI Not Supported</p>
                        <p className="text-xs mt-1">
                          Your browser doesn't support Web Bluetooth API. 
                          Please use Chrome or Edge browser.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    <div className="flex justify-center mb-4">
                      <Button 
                        onClick={handleBluetoothScan}
                        disabled={isScanning}
                        data-testid="button-scan-bluetooth"
                      >
                        {isScanning ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Scanning...
                          </>
                        ) : (
                          <>
                            <Search className="h-4 w-4 mr-2" />
                            Scan for Bluetooth MIDI Devices
                          </>
                        )}
                      </Button>
                    </div>
                    
                    {unifiedDevices.bluetooth.length === 0 ? (
                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-center text-muted-foreground">
                            <Bluetooth className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No Bluetooth MIDI devices connected</p>
                            <p className="text-xs">Click "Scan" to discover nearby devices</p>
                          </div>
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="grid gap-3">
                        {unifiedDevices.bluetooth.map((device, index) => {
                          const isConnected = connectedDevices.some(d => d.id === device.id);
                          const state = connectionStates[device.id] || 'idle';
                          
                          return (
                            <Card key={device.id}>
                              <CardContent className="pt-4">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <Bluetooth className="h-4 w-4" />
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium text-sm" data-testid={`ble-device-name-${index}`}>
                                          {device.name}
                                        </span>
                                        <Badge variant="secondary" className="text-xs">BLE</Badge>
                                      </div>
                                      <div className="flex items-center gap-2 mt-1">
                                        {getConnectionIcon(device)}
                                        <span className="text-xs text-muted-foreground" data-testid={`ble-device-status-${index}`}>
                                          {getConnectionStatus(device)}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  <Button
                                    variant={isConnected ? "destructive" : "outline"}
                                    size="sm"
                                    onClick={() => isConnected ? handleDisconnect(device.id) : handleConnect(device.id)}
                                    disabled={state !== 'idle'}
                                    data-testid={`button-ble-${isConnected ? 'disconnect' : 'connect'}-${index}`}
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
                  </>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

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

      </DialogContent>
    </Dialog>
  );
}