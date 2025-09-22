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
    isInitializing,
    error,
    connectDevice,
    disconnectDevice,
    sendMidiCommand,
    parseMidiCommand,
    refreshDevices,
    initializeMidi,
    initializeBluetoothMidi
  } = useMidi();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [testCommand, setTestCommand] = useState('[[PC:1:1]]');
  const [connectionStates, setConnectionStates] = useState<Record<string, 'connecting' | 'disconnecting' | 'idle'>>({});
  const [hasInitializedOnce, setHasInitializedOnce] = useState(false);

  // Initialize USB MIDI when dialog opens for the first time
  useEffect(() => {
    if (isOpen && !hasInitializedOnce) {
      // Initialize USB MIDI on first open (lightweight, fast)
      initializeMidi().then(() => {
        console.log('🎹 USB MIDI initialized from device manager');
        setHasInitializedOnce(true);
      });
    } else if (isOpen && isInitialized) {
      // Just refresh if already initialized
      refreshDevices();
    }
  }, [isOpen, hasInitializedOnce, isInitialized, initializeMidi, refreshDevices]);
  
  // Track if we've attempted auto-reconnect (one-shot)
  const hasAttemptedAutoReconnectRef = useRef(false);
  
  // Auto-reconnect to last device after MIDI is initialized (one-shot)
  useEffect(() => {
    // Only attempt once per session to prevent infinite loops
    if (hasAttemptedAutoReconnectRef.current) return;
    if (!isInitialized || devices.length === 0) return;
    
    const lastDeviceStr = localStorage.getItem('lastMidiDevice');
    if (!lastDeviceStr) return;
    
    // Mark as attempted immediately to prevent multiple runs
    hasAttemptedAutoReconnectRef.current = true;
    
    try {
      const lastDevice = JSON.parse(lastDeviceStr);
      
      // Skip Bluetooth devices during USB-only initialization
      const deviceName = lastDevice.name?.toLowerCase() || '';
      const isBluetoothDevice = deviceName.includes('bluetooth') || 
                               deviceName.includes('ble') || 
                               deviceName.includes('widi');
      
      if (isBluetoothDevice) {
        console.log('🎹 Skipping auto-reconnect for Bluetooth device:', lastDevice.name);
        return;
      }
      
      console.log('🎹 Attempting auto-reconnect to:', lastDevice.name, '(one-shot)');
      
      // Find matching device in current device list
      const matchingDevice = unifiedDevices.find(d => 
        d.name === lastDevice.name && 
        d.manufacturer === lastDevice.manufacturer
      );
      
      if (matchingDevice && !isUnifiedDeviceConnected(matchingDevice)) {
        console.log('🎹 Auto-reconnecting to last device:', matchingDevice.name);
        handleUnifiedConnect(matchingDevice);
      }
    } catch (e) {
      console.error('Failed to auto-reconnect:', e);
    }
  }, [isInitialized, devices]); // Re-run when devices change

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshDevices();
    } catch (err) {
      console.error('Failed to refresh devices:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleBluetoothScan = async () => {
    setIsRefreshing(true);
    try {
      // Initialize Bluetooth MIDI scanning (user-initiated)
      await initializeBluetoothMidi();
    } catch (err) {
      console.error('Failed to scan for Bluetooth devices:', err);
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
    const deviceIds: string[] = [];
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
      } else {
        // Save last connected device for auto-reconnect
        const deviceInfo = {
          name: unifiedDevice.name,
          manufacturer: unifiedDevice.manufacturer,
          inputId: unifiedDevice.inputDevice?.id,
          outputId: unifiedDevice.outputDevice?.id
        };
        localStorage.setItem('lastMidiDevice', JSON.stringify(deviceInfo));
        console.log('🎹 Saved last connected device:', deviceInfo.name);
      }
    } finally {
      // Reset states immediately to allow button to update
      const resetStates: Record<string, 'connecting' | 'disconnecting' | 'idle'> = {};
      deviceIds.forEach(id => resetStates[id] = 'idle');
      setConnectionStates(prev => ({ ...prev, ...resetStates }));
    }
  };

  const handleUnifiedDisconnect = async (unifiedDevice: any) => {
    const deviceIds: string[] = [];
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
      // Reset states immediately to allow button to update
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

  // Detect if a device is a ghost (appears in list but not actually available)
  const isGhostDevice = (device: MidiDevice) => {
    // A ghost device has BOTH disconnected state AND closed connection
    // We need both conditions because some devices may have one or the other temporarily
    // Real connected devices have state='connected' and connection='open'
    // Real available devices have state='connected' and connection='closed' (not yet opened)
    return device.state === 'disconnected' && device.connection === 'closed';
  };

  const getConnectionIcon = (device: MidiDevice) => {
    const isConnected = connectedDevices.some(d => d.id === device.id);
    const state = connectionStates[device.id];
    const isGhost = isGhostDevice(device);
    
    if (state === 'connecting' || state === 'disconnecting') {
      return <RefreshCw className="h-4 w-4 animate-spin" />;
    }
    
    if (isGhost) {
      return <Circle className="h-4 w-4 text-gray-400" />;
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
    const isGhost = isGhostDevice(device);
    
    if (state === 'connecting') return 'Connecting...';
    if (state === 'disconnecting') return 'Disconnecting...';
    if (isGhost) return 'Unavailable';
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
        .trim();
    };

    devices.forEach(device => {
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
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing || isInitializing}
                data-testid="button-refresh-devices"
                title="Refresh USB MIDI devices"
              >
                <Usb className={`h-4 w-4 mr-2`} />
                USB Scan
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleBluetoothScan}
                disabled={isRefreshing || isInitializing}
                data-testid="button-bluetooth-scan"
                title="Scan for Bluetooth MIDI devices (may be slow)"
              >
                <Bluetooth className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-pulse' : ''}`} />
                BT Scan
              </Button>
            </div>
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
              
              {isInitializing ? (
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center text-muted-foreground">
                      <RefreshCw className="h-8 w-8 mx-auto mb-2 animate-spin" />
                      <p className="text-sm">Scanning for MIDI devices...</p>
                      <p className="text-xs">This may take a moment with many devices</p>
                    </div>
                  </CardContent>
                </Card>
              ) : unifiedDevices.length === 0 ? (
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center text-muted-foreground">
                      <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No MIDI devices detected</p>
                      <p className="text-xs">Connect a MIDI device and it will appear automatically</p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-3">
                  {unifiedDevices.map((unifiedDevice, index) => {
                    const isConnected = isUnifiedDeviceConnected(unifiedDevice);
                    const state = getUnifiedDeviceState(unifiedDevice);
                    const deviceForIcon = unifiedDevice.outputDevice || unifiedDevice.inputDevice;
                    const isGhost = deviceForIcon && isGhostDevice(deviceForIcon);
                    
                    return (
                      <Card key={`${unifiedDevice.name}-${unifiedDevice.manufacturer}-${index}`}
                            className={isGhost ? 'opacity-60' : ''}>
                        <CardContent className="pt-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {deviceForIcon && getDeviceIcon(deviceForIcon)}
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className={`font-medium text-sm ${isGhost ? 'text-gray-500' : ''}`} 
                                        data-testid={`device-name-unified-${index}`}>
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
                                    {isGhost ? 'Unavailable' : (isConnected ? 'Connected' : 'Available')}
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
                              disabled={state !== 'idle' || isGhost}
                              data-testid={`button-${isConnected ? 'disconnect' : 'connect'}-unified-${index}`}
                              title={isGhost ? 'Device is unavailable - please turn on the device' : ''}
                            >
                              {(() => {
                                // Always check actual connection state first
                                if (state === 'connecting') return 'Connecting...';
                                if (state === 'disconnecting') return 'Disconnecting...';
                                if (isGhost) return 'Unavailable';
                                // Check the real connection state from connectedDevices
                                const actuallyConnected = isUnifiedDeviceConnected(unifiedDevice);
                                return actuallyConnected ? 'Disconnect' : 'Connect';
                              })()}
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