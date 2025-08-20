import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Bluetooth, Music, CheckCircle, AlertCircle, Activity, Search } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

interface MIDIDeviceManagerProps {
  midiAccess: any;
  isConnected: boolean;
  deviceCount: number;
  sendCommand: (command: string) => boolean;
  scanForBluetoothDevices?: () => Promise<void>;
}

export function MIDIDeviceManager({ midiAccess, isConnected, deviceCount, sendCommand, scanForBluetoothDevices }: MIDIDeviceManagerProps) {
  const [testCommand, setTestCommand] = useState("CC:1:64:1");
  const [lastActivity, setLastActivity] = useState<string>("");
  const [isScanning, setIsScanning] = useState(false);
  const { toast } = useToast();

  // Handle Bluetooth scanning with proper error handling
  const handleBluetoothScan = async () => {
    if (!scanForBluetoothDevices) return;
    
    setIsScanning(true);
    try {
      const deviceName = await scanForBluetoothDevices();
      toast({
        title: "Bluetooth Device Connected",
        description: `Successfully connected to ${deviceName}`,
      });
      setLastActivity(`Connected: ${deviceName}`);
    } catch (error: any) {
      console.error('Bluetooth scan error:', error);
      const errorMsg = error.message || 'Unknown error';
      
      if (errorMsg.includes('cancelled') || errorMsg.includes('selected')) {
        toast({
          title: "Scan Cancelled",
          description: "No device was selected",
          variant: "default"
        });
      } else if (errorMsg.includes('not supported')) {
        toast({
          title: "Bluetooth Not Supported",
          description: "Your browser doesn't support Bluetooth connectivity",
          variant: "destructive"
        });
      } else if (errorMsg.includes('access denied') || errorMsg === 'BLUETOOTH_PERMISSION_DENIED') {
        toast({
          title: "Chrome Bluetooth Permission Required",
          description: "Click the address bar lock icon → Bluetooth → Allow, then try again",
          variant: "destructive",
          duration: 8000
        });
      } else if (errorMsg.includes('Failed to connect')) {
        toast({
          title: "Connection Failed",
          description: "Device found but couldn't connect. Try putting it in pairing mode.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Connection Error",
          description: errorMsg,
          variant: "destructive"
        });
      }
      setLastActivity(`Error: ${errorMsg}`);
    } finally {
      setIsScanning(false);
    }
  };

  // Run test sequence
  const runTestSequence = () => {
    const testCommands = [
      "CC:1:127:1",    // Control Change
      "NOTE:60:100:1", // Note On
      "NOTEOFF:60:1",  // Note Off
      "PC:5:1"         // Program Change
    ];

    testCommands.forEach((cmd, index) => {
      setTimeout(() => {
        const success = sendCommand(`[[${cmd}]]`);
        setLastActivity(`Test ${index + 1}: ${cmd} - ${success ? 'Sent' : 'Failed'}`);
      }, index * 500);
    });

    toast({
      title: "Test Sequence Started",
      description: "Running 4 test commands...",
    });
  };

  // Send custom test command
  const sendTestCommand = () => {
    if (!testCommand.trim()) return;
    
    const success = sendCommand(`[[${testCommand}]]`);
    setLastActivity(`Manual: ${testCommand} - ${success ? 'Sent' : 'Failed'}`);
    
    toast({
      title: success ? "Command Sent" : "Command Failed",
      description: `${testCommand}`,
      variant: success ? "default" : "destructive"
    });
  };

  const getDeviceList = () => {
    if (!midiAccess) return [];
    
    const devices: any[] = [];
    
    if (midiAccess.outputs) {
      midiAccess.outputs.forEach((output: any) => {
        devices.push({
          id: output.id || 'unknown',
          name: output.name || 'Unknown Device',
          type: output.type === 'bluetooth' ? 'bluetooth' : 'output',
          state: output.state || 'connected'
        });
      });
    }
    
    return devices;
  };

  const devices = getDeviceList();

  return (
    <div className="space-y-4">
      {/* Status Overview */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isConnected ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-500" />
            )}
            <span className="font-semibold">
              {isConnected ? 'MIDI Connected' : 'MIDI Disconnected'}
            </span>
          </div>
          <Badge variant={isConnected ? "default" : "destructive"}>
            {deviceCount} device(s)
          </Badge>
        </div>
        
        {lastActivity && (
          <div className="mt-2 text-sm text-gray-600 dark:text-gray-400 font-mono">
            Last: {lastActivity}
          </div>
        )}
      </Card>

      {/* Device List */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Music className="w-4 h-4" />
            Connected Devices
          </h3>
          {scanForBluetoothDevices && (
            <Button
              onClick={handleBluetoothScan}
              size="sm"
              variant="outline"
              className="flex items-center gap-1"
              disabled={isScanning}
            >
              <Search className={`w-3 h-3 ${isScanning ? 'animate-spin' : ''}`} />
              {isScanning ? 'Scanning...' : 'Find Bluetooth'}
            </Button>
          )}
        </div>
        
        <ScrollArea className="h-32">
          {devices.length > 0 ? (
            <div className="space-y-2">
              {devices.map((device) => (
                <div key={device.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded text-gray-900 dark:text-gray-100">
                  <div className="flex items-center gap-2">
                    <Bluetooth className="w-4 h-4 text-blue-500" />
                    <span className="text-sm">{device.name}</span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {device.type}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-500 dark:text-gray-400 py-4">
              <Music className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No MIDI devices found</p>
              <p className="text-xs mt-1">Console mode active</p>
            </div>
          )}
        </ScrollArea>
      </Card>

      {/* Test Controls */}
      <Card className="p-4">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
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
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm font-mono bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
            <Button onClick={sendTestCommand} size="sm">
              Send
            </Button>
          </div>
          
          <Button 
            onClick={runTestSequence} 
            variant="outline" 
            className="w-full"
            disabled={!isConnected}
          >
            Run Test Sequence
          </Button>
        </div>
      </Card>

      {/* Chrome Bluetooth Permission Help */}
      <Card className="p-4 bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
        <h4 className="font-semibold text-amber-800 dark:text-amber-200 mb-2">Chrome Bluetooth Setup</h4>
        <div className="text-sm text-amber-700 dark:text-amber-300 space-y-2">
          <div className="font-semibold">If "Permission Denied" appears:</div>
          <div className="ml-2 space-y-1">
            <div>1. Look for 🔒 lock icon in address bar</div>
            <div>2. Click lock → Bluetooth → Allow</div>
            <div>3. If no lock icon, try F5 to refresh</div>
          </div>
          <div className="font-semibold mt-3">Alternative methods:</div>
          <div className="ml-2 space-y-1">
            <div>• Type: chrome://settings/content/bluetooth</div>
            <div>• Enable "Sites can ask to connect"</div>
            <div>• Right-click page → Site settings</div>
          </div>
        </div>
      </Card>

      {/* Help */}
      <Card className="p-4 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">MIDI Command Format</h4>
        <div className="text-sm text-blue-700 dark:text-blue-300 space-y-2">
          <div className="font-mono space-y-1">
            <div>CC:controller:value:channel</div>
            <div>NOTE:note:velocity:channel</div>
            <div>NOTEOFF:note:channel</div>
            <div>PC:program:channel</div>
          </div>
          <div className="border-t border-blue-300 dark:border-blue-700 pt-2">
            <div className="font-semibold mb-1">Device Setup:</div>
            <div>• Turn on device Bluetooth/pairing mode</div>
            <div>• Click "Find Bluetooth" above</div>
            <div>• Select device from browser popup</div>
          </div>
        </div>
      </Card>
    </div>
  );
}