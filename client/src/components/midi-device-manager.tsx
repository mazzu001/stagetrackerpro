import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Bluetooth, Music, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

interface MIDIDeviceInfo {
  id: string;
  name: string;
  manufacturer: string;
  state: string;
  connection: string;
  type: 'input' | 'output';
  enabled: boolean;
}

// Web MIDI API type definitions
interface MIDIPort {
  id: string;
  name?: string;
  manufacturer?: string;
  state: string;
  connection: string;
}

interface MIDIOutput extends MIDIPort {
  send(data: number[]): void;
}

interface MIDIInput extends MIDIPort {
  onmidimessage: ((event: any) => void) | null;
}

interface MIDIAccess {
  inputs: Map<string, MIDIInput>;
  outputs: Map<string, MIDIOutput>;
  onstatechange: ((event: any) => void) | null;
}

interface MIDIDeviceManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onDevicesChange?: (devices: MIDIDeviceInfo[]) => void;
}

export function MIDIDeviceManager({ isOpen, onClose, onDevicesChange }: MIDIDeviceManagerProps) {
  const [midiAccess, setMidiAccess] = useState<MIDIAccess | null>(null);
  const [devices, setDevices] = useState<MIDIDeviceInfo[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [midiSupported, setMidiSupported] = useState(true);
  const { toast } = useToast();

  // Initialize MIDI access
  useEffect(() => {
    if (!isOpen) return;

    const initializeMIDI = async () => {
      try {
        if (!(navigator as any).requestMIDIAccess) {
          setMidiSupported(false);
          toast({
            title: "MIDI Not Supported",
            description: "Your browser doesn't support Web MIDI API",
            variant: "destructive",
          });
          return;
        }

        setIsScanning(true);
        const access = await (navigator as any).requestMIDIAccess({ sysex: false });
        setMidiAccess(access);
        
        // Listen for device changes
        access.onstatechange = () => {
          scanDevices(access);
        };
        
        scanDevices(access);
        setIsScanning(false);
      } catch (error) {
        console.error('Failed to access MIDI devices:', error);
        setIsScanning(false);
        toast({
          title: "MIDI Access Failed",
          description: "Unable to access MIDI devices. Please check permissions.",
          variant: "destructive",
        });
      }
    };

    initializeMIDI();
  }, [isOpen, toast]);

  // Scan for available MIDI devices
  const scanDevices = (access: MIDIAccess) => {
    const deviceList: MIDIDeviceInfo[] = [];
    
    // Get output devices (for sending MIDI commands)
    access.outputs.forEach((output: MIDIOutput) => {
      deviceList.push({
        id: output.id!,
        name: output.name || 'Unknown Device',
        manufacturer: output.manufacturer || 'Unknown',
        state: output.state!,
        connection: output.connection!,
        type: 'output',
        enabled: output.state === 'connected'
      });
    });

    // Get input devices (for receiving MIDI)
    access.inputs.forEach((input: MIDIInput) => {
      deviceList.push({
        id: input.id!,
        name: input.name || 'Unknown Device',
        manufacturer: input.manufacturer || 'Unknown',
        state: input.state!,
        connection: input.connection!,
        type: 'input',
        enabled: input.state === 'connected'
      });
    });

    setDevices(deviceList);
    onDevicesChange?.(deviceList);
  };

  // Toggle device enabled state
  const toggleDevice = (deviceId: string) => {
    setDevices(prev => prev.map(device => 
      device.id === deviceId 
        ? { ...device, enabled: !device.enabled }
        : device
    ));
  };

  // Send test MIDI message
  const sendTestMessage = (deviceId: string) => {
    if (!midiAccess) return;

    const output = midiAccess.outputs.get(deviceId);
    if (output && output.state === 'connected') {
      // Send a test note on/off message (Middle C)
      output.send([0x90, 60, 127]); // Note on
      setTimeout(() => {
        output.send([0x80, 60, 0]); // Note off
      }, 500);
      
      toast({
        title: "Test Message Sent",
        description: `Sent test note to ${output.name}`,
      });
    }
  };

  // Refresh device list
  const refreshDevices = () => {
    if (midiAccess) {
      setIsScanning(true);
      scanDevices(midiAccess);
      setTimeout(() => setIsScanning(false), 1000);
    }
  };

  const connectedDevices = devices.filter(d => d.state === 'connected');
  const outputDevices = devices.filter(d => d.type === 'output' && d.state === 'connected');
  const inputDevices = devices.filter(d => d.type === 'input' && d.state === 'connected');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]" data-testid="dialog-midi-manager">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bluetooth className="w-5 h-5" />
            MIDI Device Manager
            <Badge variant="outline" className="ml-auto">
              {connectedDevices.length} Connected
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status and Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {midiSupported ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-500" />
              )}
              <span className="text-sm">
                {midiSupported ? 'MIDI Supported' : 'MIDI Not Available'}
              </span>
            </div>
            
            <Button
              onClick={refreshDevices}
              disabled={isScanning || !midiSupported}
              size="sm"
              variant="outline"
              data-testid="button-refresh-midi"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isScanning ? 'animate-spin' : ''}`} />
              {isScanning ? 'Scanning...' : 'Refresh'}
            </Button>
          </div>

          {/* Device Lists */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Output Devices (for sending MIDI commands) */}
            <div className="space-y-2">
              <h3 className="font-medium flex items-center gap-2">
                <Music className="w-4 h-4" />
                Output Devices ({outputDevices.length})
              </h3>
              <ScrollArea className="h-48 border rounded-md p-2">
                {outputDevices.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    No output devices found
                  </div>
                ) : (
                  <div className="space-y-2">
                    {outputDevices.map((device) => (
                      <div
                        key={device.id}
                        className="flex items-center justify-between p-3 border rounded-md"
                        data-testid={`device-output-${device.id}`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{device.name}</p>
                          <p className="text-xs text-gray-500 truncate">
                            {device.manufacturer}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 ml-2">
                          <Switch
                            checked={device.enabled}
                            onCheckedChange={() => toggleDevice(device.id)}
                            data-testid={`switch-output-${device.id}`}
                          />
                          <Button
                            onClick={() => sendTestMessage(device.id)}
                            size="sm"
                            variant="outline"
                            disabled={!device.enabled}
                            data-testid={`button-test-${device.id}`}
                          >
                            Test
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* Input Devices (for receiving MIDI) */}
            <div className="space-y-2">
              <h3 className="font-medium flex items-center gap-2">
                <Bluetooth className="w-4 h-4" />
                Input Devices ({inputDevices.length})
              </h3>
              <ScrollArea className="h-48 border rounded-md p-2">
                {inputDevices.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    No input devices found
                  </div>
                ) : (
                  <div className="space-y-2">
                    {inputDevices.map((device) => (
                      <div
                        key={device.id}
                        className="flex items-center justify-between p-3 border rounded-md"
                        data-testid={`device-input-${device.id}`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{device.name}</p>
                          <p className="text-xs text-gray-500 truncate">
                            {device.manufacturer}
                          </p>
                        </div>
                        <Switch
                          checked={device.enabled}
                          onCheckedChange={() => toggleDevice(device.id)}
                          data-testid={`switch-input-${device.id}`}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>

          {/* Connection Instructions */}
          <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-md">
            <h4 className="font-medium mb-2">Connection Tips:</h4>
            <ul className="text-sm space-y-1 text-gray-600 dark:text-gray-300">
              <li>• Ensure Bluetooth MIDI devices are paired with your system</li>
              <li>• For USB MIDI devices, check cable connections</li>
              <li>• Some devices may require specific drivers</li>
              <li>• Use "Test" button to verify output device functionality</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} data-testid="button-close-midi">
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}