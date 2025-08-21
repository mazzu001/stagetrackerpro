import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Bluetooth, Plus, Trash2, Play, Activity, CheckCircle, AlertCircle } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

interface SimpleBluetoothDevice {
  id: string;
  name: string;
  connected: boolean;
  saved: boolean;
  device?: any; // BluetoothDevice
  characteristic?: any; // BluetoothRemoteGATTCharacteristic
  lastActivity?: number;
}

interface SimpleBluetoothManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onDeviceSelected?: (device: SimpleBluetoothDevice) => void;
}

export function SimpleBluetoothManager({ isOpen, onClose, onDeviceSelected }: SimpleBluetoothManagerProps) {
  const [discoveredDevices, setDiscoveredDevices] = useState<SimpleBluetoothDevice[]>([]);
  const [savedDevices, setSavedDevices] = useState<SimpleBluetoothDevice[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isConnecting, setIsConnecting] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<{ device: string; success: boolean; message: string } | null>(null);
  const [bluetoothSupported, setBluetoothSupported] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setBluetoothSupported('bluetooth' in navigator);
    loadSavedDevices();
  }, []);

  // Load saved devices from localStorage
  const loadSavedDevices = () => {
    try {
      const saved = localStorage.getItem('bluetoothDevices');
      if (saved) {
        const devices = JSON.parse(saved);
        setSavedDevices(devices.map((d: any) => ({ ...d, connected: false, device: null })));
      }
    } catch (error) {
      console.log('Failed to load saved devices:', error);
    }
  };

  // Save device to localStorage
  const saveDevice = (device: SimpleBluetoothDevice) => {
    const deviceToSave = {
      id: device.id,
      name: device.name,
      saved: true
    };
    
    const existing = savedDevices.find(d => d.id === device.id);
    if (!existing) {
      const updated = [...savedDevices, { ...deviceToSave, connected: false, device: null }];
      setSavedDevices(updated);
      localStorage.setItem('bluetoothDevices', JSON.stringify(updated.map(d => ({ id: d.id, name: d.name, saved: true }))));
      
      toast({
        title: "Device Saved",
        description: `${device.name} has been saved for future use`,
      });
    }
  };

  // Remove saved device
  const removeSavedDevice = (deviceId: string) => {
    const updated = savedDevices.filter(d => d.id !== deviceId);
    setSavedDevices(updated);
    localStorage.setItem('bluetoothDevices', JSON.stringify(updated.map(d => ({ id: d.id, name: d.name, saved: true }))));
    
    toast({
      title: "Device Removed",
      description: "Device has been removed from saved devices",
    });
  };

  // Discover all available Bluetooth devices
  const discoverDevices = async () => {
    if (!bluetoothSupported) {
      toast({
        title: "Bluetooth Not Supported",
        description: "Your browser doesn't support Bluetooth",
        variant: "destructive",
      });
      return;
    }

    setIsScanning(true);
    setDiscoveredDevices([]);

    try {
      console.log('Starting Bluetooth device discovery...');
      
      // Use acceptAllDevices to find any Bluetooth device
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          '03b80e5a-ede8-4b33-a751-6ce34ec4c700', // MIDI Service
          '0000180f-0000-1000-8000-00805f9b34fb', // Battery Service
          '0000180a-0000-1000-8000-00805f9b34fb', // Device Information Service
          '12345678-1234-1234-1234-123456789abc', // Generic custom service
        ]
      });

      console.log('Device discovered:', device.name, device.id);

      const newDevice: SimpleBluetoothDevice = {
        id: device.id,
        name: device.name || 'Unknown Device',
        connected: false,
        saved: false,
        device: device
      };

      setDiscoveredDevices([newDevice]);
      
      toast({
        title: "Device Found",
        description: `Found: ${newDevice.name}`,
      });

    } catch (error: any) {
      console.log('Discovery error:', error);
      
      if (error.name === 'NotFoundError') {
        toast({
          title: "No Device Selected",
          description: "Please select a device from the list to continue",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Discovery Failed", 
          description: `Error: ${error.message}`,
          variant: "destructive",
        });
      }
    } finally {
      setIsScanning(false);
    }
  };

  // Connect to a Bluetooth device
  const connectToDevice = async (deviceInfo: SimpleBluetoothDevice) => {
    if (!deviceInfo.device) {
      toast({
        title: "No Device Reference",
        description: "Device needs to be discovered first",
        variant: "destructive",
      });
      return;
    }

    setIsConnecting(deviceInfo.id);

    try {
      console.log('Connecting to device:', deviceInfo.name);
      
      // Connect to GATT server
      const server = await deviceInfo.device.gatt?.connect();
      if (!server) {
        throw new Error('Failed to connect to GATT server');
      }

      console.log('Connected to GATT server');

      // Try to find any available service
      const services = await server.getPrimaryServices();
      console.log('Available services:', services.map((s: any) => s.uuid));

      let characteristic = null;
      
      // Try to find a writable characteristic
      for (const service of services) {
        try {
          const characteristics = await service.getCharacteristics();
          for (const char of characteristics) {
            if (char.properties.write || char.properties.writeWithoutResponse) {
              characteristic = char;
              console.log('Found writable characteristic:', char.uuid);
              break;
            }
          }
          if (characteristic) break;
        } catch (e) {
          console.log('Service access failed:', e);
        }
      }

      // Update device status
      const updatedDevice = {
        ...deviceInfo,
        connected: true,
        characteristic: characteristic || undefined
      };

      // Update in discovered devices
      setDiscoveredDevices(prev => prev.map(d => d.id === deviceInfo.id ? updatedDevice : d));
      
      // Update in saved devices if it exists there
      setSavedDevices(prev => prev.map(d => d.id === deviceInfo.id ? updatedDevice : d));

      toast({
        title: "Device Connected",
        description: `Connected to ${deviceInfo.name}${characteristic ? ' with communication capability' : ' (read-only)'}`,
      });

      // Set up disconnect handler
      deviceInfo.device.addEventListener('gattserverdisconnected', () => {
        console.log('Device disconnected:', deviceInfo.name);
        setDiscoveredDevices(prev => prev.map(d => d.id === deviceInfo.id ? { ...d, connected: false } : d));
        setSavedDevices(prev => prev.map(d => d.id === deviceInfo.id ? { ...d, connected: false } : d));
      });

    } catch (error: any) {
      console.log('Connection error:', error);
      toast({
        title: "Connection Failed",
        description: `Failed to connect: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsConnecting(null);
    }
  };

  // Test communication with device
  const testDevice = async (deviceInfo: SimpleBluetoothDevice) => {
    if (!deviceInfo.connected || !deviceInfo.characteristic) {
      toast({
        title: "Device Not Ready",
        description: "Device must be connected with communication capability",
        variant: "destructive",
      });
      return;
    }

    setIsTesting(deviceInfo.id);

    try {
      console.log('Testing device:', deviceInfo.name);
      
      // Send a simple test message
      const testData = new Uint8Array([0x90, 0x3C, 0x7F]); // MIDI Note On C4
      await deviceInfo.characteristic.writeValue(testData);
      
      console.log('Test data sent successfully');
      
      setTestResults({
        device: deviceInfo.name,
        success: true,
        message: 'Test signal sent successfully'
      });

      toast({
        title: "Test Successful",
        description: `Communication test passed for ${deviceInfo.name}`,
      });

    } catch (error: any) {
      console.log('Test error:', error);
      
      setTestResults({
        device: deviceInfo.name,
        success: false,
        message: error.message
      });

      toast({
        title: "Test Failed",
        description: `Communication test failed: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsTesting(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh]" data-testid="dialog-bluetooth-manager">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bluetooth className="w-5 h-5" />
            Simple Bluetooth Device Manager
            <Badge variant="outline" className="ml-auto">
              {savedDevices.filter(d => d.connected).length} Connected
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status and Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {bluetoothSupported ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-500" />
              )}
              <span className="text-sm">
                {bluetoothSupported ? 'Bluetooth Ready' : 'Bluetooth Not Available'}
              </span>
            </div>
            
            <Button
              onClick={discoverDevices}
              disabled={isScanning || !bluetoothSupported}
              size="sm"
              variant="default"
              data-testid="button-discover-bluetooth"
            >
              <Plus className="w-4 h-4 mr-2" />
              {isScanning ? 'Scanning...' : 'Find Devices'}
            </Button>
          </div>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Side: Discovered Devices */}
            <div className="space-y-4">
              <h3 className="font-medium text-lg">Discovered Devices</h3>
              
              <ScrollArea className="h-60 border rounded-md p-3">
                {discoveredDevices.length === 0 ? (
                  <div className="text-center text-gray-500 py-8 text-sm">
                    No devices discovered<br />
                    <span className="text-xs">Click "Find Devices" to scan for Bluetooth devices</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {discoveredDevices.map((device) => (
                      <div
                        key={device.id}
                        className="flex items-center justify-between p-3 border rounded-md"
                        data-testid={`discovered-device-${device.id}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium truncate">{device.name}</p>
                            <div className={`w-2 h-2 rounded-full ${device.connected ? 'bg-green-500' : 'bg-gray-400'}`} />
                          </div>
                          <p className="text-xs text-gray-500 truncate">{device.id}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {!device.connected ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => connectToDevice(device)}
                              disabled={isConnecting === device.id}
                              data-testid={`button-connect-${device.id}`}
                              className="h-8 px-2 text-xs"
                            >
                              {isConnecting === device.id ? 'Connecting...' : 'Connect'}
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => testDevice(device)}
                              disabled={isTesting === device.id}
                              data-testid={`button-test-${device.id}`}
                              className="h-8 px-2 text-xs"
                            >
                              {isTesting === device.id ? 'Testing...' : 'Test'}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => saveDevice(device)}
                            disabled={device.saved || savedDevices.some(d => d.id === device.id)}
                            data-testid={`button-save-${device.id}`}
                            className="h-8 px-2 text-xs"
                          >
                            Save
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* Right Side: Saved Devices */}
            <div className="space-y-4">
              <h3 className="font-medium text-lg">Saved Devices</h3>
              
              <ScrollArea className="h-60 border rounded-md p-3">
                {savedDevices.length === 0 ? (
                  <div className="text-center text-gray-500 py-8 text-sm">
                    No saved devices<br />
                    <span className="text-xs">Discover and save devices for quick access</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {savedDevices.map((device) => (
                      <div
                        key={device.id}
                        className="flex items-center justify-between p-3 border rounded-md bg-blue-50 dark:bg-blue-950"
                        data-testid={`saved-device-${device.id}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium truncate">{device.name}</p>
                            <div className={`w-2 h-2 rounded-full ${device.connected ? 'bg-green-500' : 'bg-gray-400'}`} />
                          </div>
                          <p className="text-xs text-gray-500">
                            {device.connected ? 'Connected' : 'Saved - click to discover again'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeSavedDevice(device.id)}
                            data-testid={`button-remove-${device.id}`}
                            className="h-8 px-2 text-xs"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>

          {/* Test Results */}
          {testResults && (
            <div className={`p-3 border rounded-md ${testResults.success ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800' : 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800'}`}>
              <h4 className={`font-medium mb-2 ${testResults.success ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}`}>
                Test Results - {testResults.device}
              </h4>
              <p className={`text-sm ${testResults.success ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                {testResults.message}
              </p>
            </div>
          )}

          {/* Simple Instructions */}
          <div className="p-4 border rounded-md bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
            <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">
              How to Use
            </h4>
            <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
              <p><strong>1.</strong> Click "Find Devices" to scan for all Bluetooth devices</p>
              <p><strong>2.</strong> Select your device from the browser popup (including "Matts Pedal")</p>
              <p><strong>3.</strong> Click "Connect" to establish connection</p>
              <p><strong>4.</strong> Click "Test" to verify communication</p>
              <p><strong>5.</strong> Click "Save" to remember the device for future use</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}