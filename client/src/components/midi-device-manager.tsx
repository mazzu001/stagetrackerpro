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
        
        <ScrollArea className="h-20">
          {devices.length > 0 ? (
            <div className="space-y-1">
              {devices.map((device) => (
                <div key={device.id} className="flex items-center justify-between p-1.5 bg-gray-50 dark:bg-gray-800 rounded text-gray-900 dark:text-gray-100">
                  <div className="flex items-center gap-2">
                    <Bluetooth className="w-3 h-3 text-blue-500" />
                    <span className="text-xs">{device.name}</span>
                  </div>
                  <Badge variant="outline" className="text-xs px-1 py-0">
                    {device.type}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-500 dark:text-gray-400 py-2">
              <Music className="w-6 h-6 mx-auto mb-1 opacity-50" />
              <p className="text-xs">Console mode active</p>
            </div>
          )}
        </ScrollArea>
      </Card>

      {/* Test Controls */}
      <Card className="p-3">
        <h3 className="font-semibold mb-2 flex items-center gap-2 text-sm">
          <Activity className="w-4 h-4" />
          Test Commands
        </h3>
        
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={testCommand}
              onChange={(e) => setTestCommand(e.target.value)}
              placeholder="CC:1:64:1"
              className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-xs font-mono bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
            <Button onClick={sendTestCommand} size="sm" className="text-xs px-2">
              Send
            </Button>
          </div>
          
          <Button 
            onClick={runTestSequence} 
            variant="outline" 
            className="w-full text-xs py-1"
            disabled={!isConnected}
          >
            Run Test Sequence
          </Button>
        </div>
      </Card>

      {/* Compact Help */}
      <Card className="p-2 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-1 text-sm">Setup & Commands</h4>
        <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="font-semibold">Commands:</div>
              <div className="font-mono space-y-0.5">
                <div>CC:ctrl:val:ch</div>
                <div>NOTE:note:vel:ch</div>
                <div>PC:prog:ch</div>
              </div>
            </div>
            <div>
              <div className="font-semibold">Chrome Setup:</div>
              <div>🔒 address bar lock</div>
              <div>→ Bluetooth → Allow</div>
              <div>Or: chrome://settings/content/bluetooth</div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}