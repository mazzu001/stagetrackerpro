import { useState, useRef, useCallback } from 'react';

interface MidiDevice {
  id: string;
  name: string;
  type: 'input' | 'output';
  connected: boolean;
}

interface MidiCommand {
  type: 'PC' | 'CC' | 'NOTE';
  value: number;
  value2?: number;
  channel: number;
}

export function useSimpleMidi() {
  const [devices, setDevices] = useState<MidiDevice[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const midiAccessRef = useRef<MIDIAccess | null>(null);
  const outputsRef = useRef<Map<string, MIDIOutput>>(new Map());
  const inputsRef = useRef<Map<string, MIDIInput>>(new Map());

  // Initialize MIDI - called on user interaction only
  const initMidi = useCallback(async () => {
    if (isInitialized) return;
    
    try {
      if (!navigator.requestMIDIAccess) {
        setError('Web MIDI API not supported');
        return;
      }

      const access = await navigator.requestMIDIAccess();
      midiAccessRef.current = access;
      
      // Store devices
      const deviceList: MidiDevice[] = [];
      
      // Process inputs
      access.inputs.forEach((input, id) => {
        inputsRef.current.set(id, input);
        deviceList.push({
          id,
          name: input.name || 'Unknown Input',
          type: 'input',
          connected: true
        });
      });
      
      // Process outputs
      access.outputs.forEach((output, id) => {
        outputsRef.current.set(id, output);
        deviceList.push({
          id,
          name: output.name || 'Unknown Output',
          type: 'output',
          connected: true
        });
      });
      
      setDevices(deviceList);
      setIsInitialized(true);
      
      // Listen for device changes
      access.onstatechange = (e) => {
        const port = (e as any).port;
        if (!port) return;
        
        if (port.state === 'connected') {
          // Add device
          const newDevice: MidiDevice = {
            id: port.id,
            name: port.name || 'Unknown Device',
            type: port.type as 'input' | 'output',
            connected: true
          };
          
          if (port.type === 'input') {
            inputsRef.current.set(port.id, port);
          } else {
            outputsRef.current.set(port.id, port);
          }
          
          setDevices(prev => [...prev.filter(d => d.id !== port.id), newDevice]);
        } else if (port.state === 'disconnected') {
          // Remove device
          if (port.type === 'input') {
            inputsRef.current.delete(port.id);
          } else {
            outputsRef.current.delete(port.id);
          }
          
          setDevices(prev => prev.filter(d => d.id !== port.id));
        }
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize MIDI');
    }
  }, [isInitialized]);

  // Parse MIDI command from string format like [[PC:2:1]] or [[CC:7:127:1]]
  const parseCommand = useCallback((commandStr: string): MidiCommand | null => {
    const match = commandStr.match(/\[\[([A-Z]+):(\d+)(?::(\d+))?:(\d+)\]\]/);
    if (!match) return null;
    
    const [, type, val1, val2, channel] = match;
    
    return {
      type: type as 'PC' | 'CC' | 'NOTE',
      value: parseInt(val1),
      value2: val2 ? parseInt(val2) : undefined,
      channel: parseInt(channel)
    };
  }, []);

  // Send MIDI command to all connected outputs
  const sendCommand = useCallback((command: MidiCommand): boolean => {
    if (!isInitialized || outputsRef.current.size === 0) return false;
    
    let data: number[] = [];
    const channel = (command.channel - 1) & 0x0F; // Convert 1-16 to 0-15
    
    switch (command.type) {
      case 'PC':
        data = [0xC0 | channel, command.value & 0x7F];
        break;
      case 'CC':
        data = [0xB0 | channel, command.value & 0x7F, (command.value2 || 0) & 0x7F];
        break;
      case 'NOTE':
        data = [0x90 | channel, command.value & 0x7F, (command.value2 || 127) & 0x7F];
        break;
      default:
        return false;
    }
    
    // Send to all connected outputs
    let sent = false;
    outputsRef.current.forEach(output => {
      try {
        output.send(data);
        sent = true;
      } catch (err) {
        console.error('Failed to send MIDI:', err);
      }
    });
    
    return sent;
  }, [isInitialized]);

  // Listen for incoming MIDI messages
  const listenForMessages = useCallback((callback: (message: any) => void) => {
    if (!isInitialized) return () => {};
    
    const handleMessage = (event: any) => {
      callback(event);
    };
    
    // Add listener to all inputs
    inputsRef.current.forEach(input => {
      input.onmidimessage = handleMessage;
    });
    
    // Return cleanup function
    return () => {
      inputsRef.current.forEach(input => {
        input.onmidimessage = null;
      });
    };
  }, [isInitialized]);

  return {
    devices,
    isInitialized,
    error,
    initMidi,
    parseCommand,
    sendCommand,
    listenForMessages
  };
}