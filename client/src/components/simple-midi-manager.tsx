import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Music, RefreshCw } from 'lucide-react';

interface MIDIMessage {
  device: string;
  message: string;
  timestamp: number;
}

interface SimpleMIDIManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SimpleMIDIManager({ isOpen, onClose }: SimpleMIDIManagerProps) {
  const [midiAccess, setMidiAccess] = useState<any>(null);
  const [inputDevices, setInputDevices] = useState<any[]>([]);
  const [outputDevices, setOutputDevices] = useState<any[]>([]);
  const [receivedMessages, setReceivedMessages] = useState<MIDIMessage[]>([]);
  const [testResults, setTestResults] = useState<{sent: number, received: number} | null>(null);

  // Initialize MIDI when dialog opens
  useEffect(() => {
    if (!isOpen) return;

    const initMIDI = async () => {
      try {
        const access = await (navigator as any).requestMIDIAccess();
        setMidiAccess(access);
        scanDevices(access);
        
        // Listen for device changes
        access.onstatechange = () => scanDevices(access);
      } catch (error) {
        console.error('MIDI initialization failed:', error);
      }
    };

    initMIDI();
  }, [isOpen]);

  // Scan and setup devices
  const scanDevices = (access: any) => {
    const inputs: any[] = [];
    const outputs: any[] = [];

    // Get input devices and set up listeners
    access.inputs.forEach((input: any) => {
      inputs.push({
        id: input.id,
        name: input.name || 'Unknown Input',
        state: input.state,
        connection: input.connection
      });

      // Set up message listener for each input
      input.onmidimessage = (event: any) => {
        const data = Array.from(event.data as Uint8Array) as number[];
        const message = formatMIDIMessage(data);
        const newMessage: MIDIMessage = {
          device: input.name || 'Unknown',
          message: message,
          timestamp: Date.now()
        };
        
        setReceivedMessages(prev => [newMessage, ...prev.slice(0, 19)]); // Keep last 20
        console.log('MIDI received:', message, data);
      };
    });

    // Get output devices
    access.outputs.forEach((output: any) => {
      outputs.push({
        id: output.id,
        name: output.name || 'Unknown Output',
        state: output.state,
        connection: output.connection
      });
    });

    setInputDevices(inputs);
    setOutputDevices(outputs);
  };

  // Format MIDI message for display
  const formatMIDIMessage = (data: number[]): string => {
    if (data.length === 0) return 'Empty';
    
    const [status, data1, data2] = data;
    const command = status & 0xF0;
    const channel = (status & 0x0F) + 1;
    
    switch (command) {
      case 0x90: return `Note ON Ch${channel} Note${data1} Vel${data2}`;
      case 0x80: return `Note OFF Ch${channel} Note${data1}`;
      case 0xB0: return `CC Ch${channel} CC${data1} Val${data2}`;
      case 0xC0: return `PC Ch${channel} Program${data1}`;
      default: return `Raw: ${data.map(b => b.toString(16)).join(' ')}`;
    }
  };

  // Test full duplex communication
  const testFullDuplex = async () => {
    if (!midiAccess || outputDevices.length === 0) return;

    const output = midiAccess.outputs.get(outputDevices[0].id);
    if (!output) return;

    let sent = 0;
    let received = 0;
    const startTime = Date.now();

    // Track received messages during test
    const originalCount = receivedMessages.length;

    // Send test sequence
    const testCommands = [
      [0x90, 60, 100], // Note on
      [0x80, 60, 0],   // Note off
      [0xB0, 1, 64],   // CC
      [0xC0, 1]        // PC
    ];

    for (const cmd of testCommands) {
      try {
        output.send(cmd);
        sent++;
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error('Send failed:', error);
      }
    }

    // Wait for responses
    setTimeout(() => {
      received = receivedMessages.length - originalCount;
      setTestResults({ sent, received });
    }, 500);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[600px] bg-gray-900 text-white border-gray-700">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Music className="w-5 h-5" />
            Simple MIDI Manager
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-4 h-full">
          {/* Input Devices */}
          <div className="space-y-2">
            <h3 className="font-semibold text-green-400">Input Devices</h3>
            <ScrollArea className="h-32 border border-gray-700 rounded p-2">
              {inputDevices.map(device => (
                <div key={device.id} className="text-sm mb-2 p-2 bg-gray-800 rounded">
                  <div className="font-medium">{device.name}</div>
                  <div className="text-xs text-gray-400">
                    {device.state} / {device.connection}
                  </div>
                </div>
              ))}
            </ScrollArea>
          </div>

          {/* Output Devices */}
          <div className="space-y-2">
            <h3 className="font-semibold text-blue-400">Output Devices</h3>
            <ScrollArea className="h-32 border border-gray-700 rounded p-2">
              {outputDevices.map(device => (
                <div key={device.id} className="text-sm mb-2 p-2 bg-gray-800 rounded">
                  <div className="font-medium">{device.name}</div>
                  <div className="text-xs text-gray-400">
                    {device.state} / {device.connection}
                  </div>
                </div>
              ))}
            </ScrollArea>
          </div>

          {/* Test Controls */}
          <div className="space-y-2">
            <h3 className="font-semibold text-yellow-400">Test</h3>
            <Button onClick={testFullDuplex} className="w-full">
              Full Duplex Test
            </Button>
            {testResults && (
              <div className="text-sm bg-gray-800 p-2 rounded">
                Sent: {testResults.sent}<br />
                Received: {testResults.received}
              </div>
            )}
          </div>
        </div>

        {/* Received Messages */}
        <div className="space-y-2">
          <h3 className="font-semibold text-purple-400">Recent MIDI Messages</h3>
          <ScrollArea className="h-40 border border-gray-700 rounded p-2">
            {receivedMessages.map((msg, idx) => (
              <div key={idx} className="text-xs mb-1 p-1 bg-gray-800 rounded">
                <span className="text-gray-400">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                <span className="text-blue-300 ml-2">{msg.device}</span>
                <span className="text-white ml-2">{msg.message}</span>
              </div>
            ))}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}