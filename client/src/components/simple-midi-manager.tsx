import React from 'react';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Music, Play, Square, Trash2 } from 'lucide-react';

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
  const [isListening, setIsListening] = useState(false);
  const [recordedMessages, setRecordedMessages] = useState<MIDIMessage[]>([]);

  useEffect(() => {
    if (!isOpen) return;

    const initMIDI = async () => {
      try {
        const access = await (navigator as any).requestMIDIAccess({ sysex: false });
        setMidiAccess(access);
        scanDevices(access);
        access.onstatechange = () => scanDevices(access);
      } catch (error) {
        console.error('MIDI initialization failed:', error);
      }
    };

    initMIDI();
  }, [isOpen]);

  const scanDevices = (access: any) => {
    const inputs: any[] = [];
    const outputs: any[] = [];

    access.inputs.forEach((input: any) => {
      inputs.push({
        id: input.id,
        name: input.name || 'Unknown Input',
        state: input.state,
        connection: input.connection
      });

      // Force open the input device if it's closed
      if (input.connection === 'closed') {
        input.open();
      }

      input.onmidimessage = (event: any) => {
        console.log('MIDI message received:', event.data);
        const data = Array.from(event.data as Uint8Array) as number[];
        const message = formatMIDIMessage(data);
        const newMessage: MIDIMessage = {
          device: input.name || 'Unknown',
          message: message,
          timestamp: Date.now()
        };
        
        setReceivedMessages(prev => [newMessage, ...prev.slice(0, 19)]);
        
        if (isListening) {
          setRecordedMessages(prev => [...prev, newMessage]);
        }
      };
    });

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

  const toggleListen = () => {
    if (isListening) {
      setIsListening(false);
    } else {
      setRecordedMessages([]);
      setIsListening(true);
    }
  };

  const clearRecording = () => {
    setRecordedMessages([]);
  };

  const testMIDI = () => {
    console.log('Testing MIDI - injecting test message');
    const testMessage: MIDIMessage = {
      device: 'Test Device',
      message: 'Test Note ON Ch1 Note60 Vel127',
      timestamp: Date.now()
    };
    setReceivedMessages(prev => [testMessage, ...prev.slice(0, 19)]);
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] bg-gray-900 text-white overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Music className="w-5 h-5" />
            Simple MIDI Manager
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-4 text-sm">
          {/* Input Devices */}
          <div className="space-y-2">
            <h3 className="font-semibold text-green-400">Input Devices ({inputDevices.length})</h3>
            <ScrollArea className="h-32 border border-gray-700 rounded p-2">
              {inputDevices.map(device => (
                <div key={device.id} className="mb-1 p-2 bg-gray-800 rounded">
                  <div className="font-medium text-green-300">{device.name}</div>
                  <div className="text-xs text-gray-400">
                    {device.state} | {device.connection}
                  </div>
                </div>
              ))}
              {inputDevices.length === 0 && (
                <div className="text-gray-500">No input devices found</div>
              )}
            </ScrollArea>
          </div>

          {/* Output Devices */}
          <div className="space-y-2">
            <h3 className="font-semibold text-blue-400">Output Devices ({outputDevices.length})</h3>
            <ScrollArea className="h-32 border border-gray-700 rounded p-2">
              {outputDevices.map(device => (
                <div key={device.id} className="mb-1 p-2 bg-gray-800 rounded">
                  <div className="font-medium text-blue-300">{device.name}</div>
                  <div className="text-xs text-gray-400">
                    {device.state} | {device.connection}
                  </div>
                </div>
              ))}
              {outputDevices.length === 0 && (
                <div className="text-gray-500">No output devices found</div>
              )}
            </ScrollArea>
          </div>

          {/* Controls */}
          <div className="space-y-2">
            <h3 className="font-semibold text-yellow-400">Controls</h3>
            
            <Button 
              onClick={toggleListen} 
              variant={isListening ? "destructive" : "default"}
              className="w-full flex items-center gap-2 mb-2"
            >
              {isListening ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {isListening ? 'Stop Listen' : 'Start Listen'}
            </Button>

            <Button 
              onClick={testMIDI} 
              variant="outline"
              className="w-full"
            >
              Test UI
            </Button>
            
            {recordedMessages.length > 0 && (
              <div className="text-sm bg-gray-800 p-2 rounded">
                Recorded: {recordedMessages.length} messages
                <Button 
                  onClick={clearRecording} 
                  size="sm" 
                  variant="outline" 
                  className="ml-2 h-6"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Live Messages */}
          <div className="space-y-2">
            <h3 className="font-semibold text-purple-400">Live Messages</h3>
            <ScrollArea className="h-40 border border-gray-700 rounded p-2">
              {receivedMessages.map((msg, idx) => (
                <div key={idx} className="text-xs mb-1 p-1 bg-gray-800 rounded">
                  <span className="text-gray-400">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                  <span className="text-blue-300 ml-2">{msg.device}</span>
                  <span className="text-white ml-2">{msg.message}</span>
                </div>
              ))}
              {receivedMessages.length === 0 && (
                <div className="text-gray-500 text-xs">No messages received</div>
              )}
            </ScrollArea>
          </div>

          {/* Recorded Messages */}
          <div className="space-y-2">
            <h3 className="font-semibold text-red-400">
              Recorded Messages {isListening && <span className="text-xs">(Recording...)</span>}
            </h3>
            <ScrollArea className="h-40 border border-gray-700 rounded p-2">
              {recordedMessages.map((msg, idx) => (
                <div key={idx} className="text-xs mb-1 p-1 bg-gray-800 rounded">
                  <span className="text-gray-400">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                  <span className="text-blue-300 ml-2">{msg.device}</span>
                  <span className="text-white ml-2">{msg.message}</span>
                </div>
              ))}
              {recordedMessages.length === 0 && !isListening && (
                <div className="text-gray-500 text-xs">No recorded messages</div>
              )}
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}