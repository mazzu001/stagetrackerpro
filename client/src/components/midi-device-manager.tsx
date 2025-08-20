import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bluetooth, Music, Activity, Loader } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

interface MIDIDevice {
  id: string;
  name: string;
  type: 'usb' | 'bluetooth';
}

interface MIDIDeviceManagerProps {
  devices: MIDIDevice[];
  isScanning: boolean;
  scanForBluetoothDevices: () => Promise<string>;
  sendMIDICommand: (command: string) => boolean;
}

export function MIDIDeviceManager({ 
  devices, 
  isScanning, 
  scanForBluetoothDevices, 
  sendMIDICommand 
}: MIDIDeviceManagerProps) {
  const [testCommand, setTestCommand] = useState("CC:1:64:1");
  const { toast } = useToast();

  const handleBluetoothScan = async () => {
    try {
      const deviceName = await scanForBluetoothDevices();
      toast({
        title: "Device Connected",
        description: `Connected to ${deviceName}`,
      });
    } catch (error: any) {
      const message = error.message || 'Unknown error';
      
      if (message.includes('permission denied')) {
        toast({
          title: "Permission Required",
          description: "Please enable Bluetooth in browser settings",
          variant: "destructive",
          duration: 5000
        });
      } else if (message.includes('No device selected')) {
        // Don't show error for user cancellation
        return;
      } else {
        toast({
          title: "Connection Failed",
          description: message,
          variant: "destructive"
        });
      }
    }
  };

  const handleSendTest = () => {
    const success = sendMIDICommand(`[[${testCommand}]]`);
    toast({
      title: success ? "Command Sent" : "Send Failed",
      description: testCommand,
      variant: success ? "default" : "destructive"
    });
  };

  const runTestSequence = () => {
    const commands = ["CC:1:127:1", "NOTE:60:100:1", "NOTEOFF:60:1", "PC:5:1"];
    
    commands.forEach((cmd, index) => {
      setTimeout(() => {
        sendMIDICommand(`[[${cmd}]]`);
      }, index * 300);
    });

    toast({
      title: "Test Sequence",
      description: "Running 4 test commands...",
    });
  };

  return (
    <div className="space-y-4">
      {/* Status */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Music className="w-5 h-5 text-blue-500" />
            <span className="font-medium">MIDI Devices</span>
          </div>
          <Badge>{devices.length} connected</Badge>
        </div>
      </Card>

      {/* Device List */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium">Connected Devices</h3>
          <Button
            onClick={handleBluetoothScan}
            size="sm"
            variant="outline"
            disabled={isScanning}
            className="flex items-center gap-2"
          >
            {isScanning ? (
              <Loader className="w-4 h-4 animate-spin" />
            ) : (
              <Bluetooth className="w-4 h-4" />
            )}
            {isScanning ? 'Scanning...' : 'Find Bluetooth'}
          </Button>
        </div>
        
        <div className="space-y-2">
          {devices.map((device) => (
            <div key={device.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded">
              <div className="flex items-center gap-2">
                {device.type === 'bluetooth' ? (
                  <Bluetooth className="w-4 h-4 text-blue-500" />
                ) : (
                  <Music className="w-4 h-4 text-gray-500" />
                )}
                <span className="text-sm">{device.name}</span>
              </div>
              <Badge variant="outline" className="text-xs">
                {device.type}
              </Badge>
            </div>
          ))}
        </div>
      </Card>

      {/* Test Controls */}
      <Card className="p-4">
        <h3 className="font-medium mb-3 flex items-center gap-2">
          <Activity className="w-4 h-4" />
          Test Commands
        </h3>
        
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={testCommand}
              onChange={(e) => setTestCommand(e.target.value)}
              placeholder="CC:1:64:1"
              className="flex-1 px-3 py-2 border rounded text-sm font-mono"
            />
            <Button onClick={handleSendTest} size="sm">
              Send
            </Button>
          </div>
          
          <Button 
            onClick={runTestSequence} 
            variant="outline" 
            className="w-full"
          >
            Run Test Sequence
          </Button>
        </div>
      </Card>

      {/* Setup Help */}
      <Card className="p-3 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2 text-sm">
          Chrome Bluetooth Setup
        </h4>
        <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
          <div>1. Click address bar lock icon 🔒</div>
          <div>2. Set Bluetooth → Allow</div>
          <div>3. Put device in pairing mode</div>
          <div>4. Click "Find Bluetooth"</div>
        </div>
      </Card>
    </div>
  );
}