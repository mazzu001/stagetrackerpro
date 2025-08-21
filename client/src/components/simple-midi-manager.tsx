import React from 'react';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Music, RefreshCw, Play, Square, Trash2 } from 'lucide-react';

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
  const [isListening, setIsListening] = useState(false);
  const [recordedMessages, setRecordedMessages] = useState<MIDIMessage[]>([]);

  useEffect(() => {
    if (!isOpen) return;

    const initMIDI = async () => {
      try {
        console.log('Requesting MIDI access...');
        const access = await (navigator as any).requestMIDIAccess({ sysex: false });
        console.log('MIDI access granted:', access);
        setMidiAccess(access);
        
        scanDevices(access);
        
        access.onstatechange = () => {
          console.log('MIDI state changed, rescanning...');
          scanDevices(access);
        };
      } catch (error) {
        console.error('MIDI initialization failed:', error);
      }
    };

    initMIDI();
  }, [isOpen]);

  const scanDevices = (access: any) => {
    console.log('SCANNING MIDI DEVICES...');
    const inputs: any[] = [];
    const outputs: any[] = [];

    console.log('Available MIDI inputs:', access.inputs.size);
    
    access.inputs.forEach((input: any) => {
      console.log('Found MIDI input device:', input.name, 'State:', input.state);
      inputs.push({
        id: input.id,
        name: input.name || 'Unknown Input',
        state: input.state,
        connection: input.connection
      });

      // Clear any existing listener first
      input.onmidimessage = null;
      
      // Set up fresh message listener with current state
      input.onmidimessage = (event: any) => {
        console.log('🎹 MIDI MESSAGE RECEIVED from', input.name + ':', Array.from(event.data));
        
        // PLAY BEEP TO CONFIRM MIDI RECEIVED
        try {
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          
          oscillator.frequency.setValueAtTime(800, audioContext.currentTime); // 800Hz beep
          gainNode.gain.setValueAtTime(0.1, audioContext.currentTime); // Low volume
          gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.1);
          
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.1);
          
          console.log('🔊 BEEP! MIDI received from', input.name);
        } catch (error) {
          console.warn('Could not play beep:', error);
        }
        
        const data = Array.from(event.data as Uint8Array) as number[];
        const message = formatMIDIMessage(data);
        const newMessage: MIDIMessage = {
          device: input.name || 'Unknown',
          message: message,
          timestamp: Date.now()
        };
        
        console.log('📝 Adding message to UI:', message);
        setReceivedMessages(prev => {
          const updated = [newMessage, ...prev.slice(0, 19)];
          console.log('📋 UI messages updated, total:', updated.length);
          return updated;
        });
        
        // Also record if listening
        setIsListening(current => {
          if (current) {
            console.log('📹 Recording message (listening active)');
            setRecordedMessages(prev => [...prev, newMessage]);
          }
          return current;
        });
      };
      
      console.log('✅ MIDI listener attached to:', input.name);
    });

    access.outputs.forEach((output: any) => {
      console.log('Found MIDI output device:', output.name, 'State:', output.state, 'Connection:', output.connection);
      outputs.push({
        id: output.id,
        name: output.name || 'Unknown Output',
        state: output.state,
        connection: output.connection
      });
      
      // Try to open output device if it's closed
      if (output.state === 'closed') {
        console.log('⚠️ Output device is closed, attempting to open:', output.name);
        try {
          output.open();
          console.log('✅ Successfully opened output device:', output.name);
        } catch (error) {
          console.error('❌ Failed to open output device:', output.name, error);
        }
      } else {
        console.log('✅ Output device already open:', output.name);
      }
    });

    console.log('Found', inputs.length, 'inputs and', outputs.length, 'outputs');
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
      console.log('🔴 Stopped listening. Recorded', recordedMessages.length, 'messages');
    } else {
      setRecordedMessages([]);
      setIsListening(true);
      console.log('🟢 Started listening for MIDI messages');
    }
  };

  const clearRecording = () => {
    setRecordedMessages([]);
  };

  const openOutputDevice = async (deviceId: string, deviceName: string) => {
    if (!midiAccess) return;
    
    try {
      const output = midiAccess.outputs.get(deviceId);
      if (output) {
        await output.open();
        console.log('✅ Manually opened output device:', deviceName);
        // Rescan to update state
        scanDevices(midiAccess);
      }
    } catch (error) {
      console.error('❌ Failed to manually open output device:', deviceName, error);
    }
  };

  const testFullDuplex = async () => {
    if (!midiAccess || outputDevices.length === 0) return;

    const output = midiAccess.outputs.get(outputDevices[0].id);
    if (!output) return;

    console.log('🧪 Starting full duplex test with output:', outputDevices[0].name);
    
    let sent = 0;
    let received = 0;
    const originalCount = receivedMessages.length;

    const testCommands = [
      [0x90, 60, 100], // Note on
      [0x80, 60, 0],   // Note off
      [0xB0, 1, 64],   // CC
      [0xC0, 1]        // PC
    ];

    for (const cmd of testCommands) {
      try {
        console.log('📤 Sending MIDI command:', cmd);
        output.send(cmd);
        sent++;
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.error('❌ Send failed:', error);
      }
    }

    setTimeout(() => {
      received = receivedMessages.length - originalCount;
      console.log('📊 Test results: sent=' + sent + ', received=' + received);
      setTestResults({ sent, received });
    }, 1000);
  };

  const testMIDIInput = () => {
    console.log('🔍 Testing MIDI input directly...');
    console.log('Available inputs:', midiAccess?.inputs.size);
    
    if (midiAccess) {
      midiAccess.inputs.forEach((input: any) => {
        console.log('Input device:', input.name, 'State:', input.state, 'Has listener:', !!input.onmidimessage);
      });
    }
    
    // Inject a test message directly
    const testMessage: MIDIMessage = {
      device: 'Test Device',
      message: 'Test Message - ' + new Date().toLocaleTimeString(),
      timestamp: Date.now()
    };
    
    console.log('💉 Injecting test message into UI');
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
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-medium text-blue-300">{device.name}</div>
                      <div className="text-xs text-gray-400">
                        {device.state} | {device.connection}
                      </div>
                    </div>
                    {device.connection === 'closed' && (
                      <Button
                        size="sm"
                        onClick={() => openOutputDevice(device.id, device.name)}
                        className="h-6 text-xs"
                      >
                        Open
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {outputDevices.length === 0 && (
                <div className="text-gray-500">No output devices found</div>
              )}
            </ScrollArea>
          </div>

          {/* Listen & Test Controls */}
          <div className="space-y-2">
            <h3 className="font-semibold text-yellow-400">Controls</h3>
            
            <Button 
              onClick={toggleListen} 
              variant={isListening ? "destructive" : "default"}
              className="w-full flex items-center gap-2"
            >
              {isListening ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {isListening ? 'Stop Listen' : 'Start Listen'}
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

            <Button onClick={testMIDIInput} className="w-full mb-1" variant="outline">
              Test Input
            </Button>
            
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
                <div className="text-gray-500 text-xs">No messages received - try playing your keyboard</div>
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