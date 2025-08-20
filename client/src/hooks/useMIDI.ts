import { useState, useEffect, useCallback } from 'react';

interface MIDIDevice {
  id: string;
  name: string;
  manufacturer: string;
  state: string;
  type: 'input' | 'output';
  enabled: boolean;
}

interface MIDIMessage {
  command: number;
  note?: number;
  velocity?: number;
  controller?: number;
  value?: number;
  channel?: number;
}

// Web MIDI API type definitions
interface MIDIPort {
  id: string;
  name?: string;
  manufacturer?: string;
  state: string;
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

export function useMIDI() {
  const [midiAccess, setMidiAccess] = useState<MIDIAccess | null>(null);
  const [devices, setDevices] = useState<MIDIDevice[]>([]);
  const [isSupported, setIsSupported] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize MIDI access
  const initializeMIDI = useCallback(async () => {
    try {
      if (!(navigator as any).requestMIDIAccess) {
        setIsSupported(false);
        return false;
      }

      const access = await (navigator as any).requestMIDIAccess({ sysex: false });
      setMidiAccess(access);
      setIsSupported(true);
      setIsInitialized(true);

      // Listen for device changes
      access.onstatechange = () => {
        updateDeviceList(access);
      };

      updateDeviceList(access);
      return true;
    } catch (error) {
      console.error('Failed to initialize MIDI:', error);
      setIsSupported(false);
      return false;
    }
  }, []);

  // Update device list
  const updateDeviceList = useCallback((access: MIDIAccess) => {
    const deviceList: MIDIDevice[] = [];

    // Add output devices
    access.outputs.forEach((output: MIDIOutput) => {
      deviceList.push({
        id: output.id!,
        name: output.name || 'Unknown Device',
        manufacturer: output.manufacturer || 'Unknown',
        state: output.state!,
        type: 'output',
        enabled: output.state === 'connected'
      });
    });

    // Add input devices
    access.inputs.forEach((input: MIDIInput) => {
      deviceList.push({
        id: input.id!,
        name: input.name || 'Unknown Device',
        manufacturer: input.manufacturer || 'Unknown',
        state: input.state!,
        type: 'input',
        enabled: input.state === 'connected'
      });
    });

    setDevices(deviceList);
  }, []);

  // Send MIDI message to specific device
  const sendMIDIMessage = useCallback((deviceId: string, message: MIDIMessage) => {
    if (!midiAccess) return false;

    const output = midiAccess.outputs.get(deviceId);
    if (!output || output.state !== 'connected') return false;

    try {
      const { command, note, velocity, controller, value, channel = 0 } = message;
      
      // Construct MIDI message based on command type
      let midiData: number[] = [];
      
      switch (command) {
        case 0x90: // Note On
          if (note !== undefined && velocity !== undefined) {
            midiData = [0x90 | channel, note, velocity];
          }
          break;
        case 0x80: // Note Off
          if (note !== undefined) {
            midiData = [0x80 | channel, note, velocity || 0];
          }
          break;
        case 0xB0: // Control Change
          if (controller !== undefined && value !== undefined) {
            midiData = [0xB0 | channel, controller, value];
          }
          break;
        case 0xC0: // Program Change
          if (value !== undefined) {
            midiData = [0xC0 | channel, value];
          }
          break;
        default:
          console.warn('Unsupported MIDI command:', command);
          return false;
      }

      if (midiData.length > 0) {
        output.send(midiData);
        return true;
      }
    } catch (error) {
      console.error('Failed to send MIDI message:', error);
    }
    
    return false;
  }, [midiAccess]);

  // Send MIDI message to all enabled output devices
  const broadcastMIDIMessage = useCallback((message: MIDIMessage) => {
    const enabledOutputs = devices.filter(d => d.type === 'output' && d.enabled && d.state === 'connected');
    let sentCount = 0;

    enabledOutputs.forEach(device => {
      if (sendMIDIMessage(device.id, message)) {
        sentCount++;
      }
    });

    return sentCount;
  }, [devices, sendMIDIMessage]);

  // Convenience functions for common MIDI messages
  const sendNoteOn = useCallback((note: number, velocity: number = 127, channel: number = 0, deviceId?: string) => {
    const message: MIDIMessage = { command: 0x90, note, velocity, channel };
    
    if (deviceId) {
      return sendMIDIMessage(deviceId, message);
    } else {
      return broadcastMIDIMessage(message) > 0;
    }
  }, [sendMIDIMessage, broadcastMIDIMessage]);

  const sendNoteOff = useCallback((note: number, channel: number = 0, deviceId?: string) => {
    const message: MIDIMessage = { command: 0x80, note, velocity: 0, channel };
    
    if (deviceId) {
      return sendMIDIMessage(deviceId, message);
    } else {
      return broadcastMIDIMessage(message) > 0;
    }
  }, [sendMIDIMessage, broadcastMIDIMessage]);

  const sendControlChange = useCallback((controller: number, value: number, channel: number = 0, deviceId?: string) => {
    const message: MIDIMessage = { command: 0xB0, controller, value, channel };
    
    if (deviceId) {
      return sendMIDIMessage(deviceId, message);
    } else {
      return broadcastMIDIMessage(message) > 0;
    }
  }, [sendMIDIMessage, broadcastMIDIMessage]);

  const sendProgramChange = useCallback((program: number, channel: number = 0, deviceId?: string) => {
    const message: MIDIMessage = { command: 0xC0, value: program, channel };
    
    if (deviceId) {
      return sendMIDIMessage(deviceId, message);
    } else {
      return broadcastMIDIMessage(message) > 0;
    }
  }, [sendMIDIMessage, broadcastMIDIMessage]);

  // Enhanced input message handling for Bluetooth devices
  const setupInputListeners = useCallback((access: MIDIAccess) => {
    access.inputs.forEach((input: MIDIInput) => {
      if (input.state === 'connected') {
        input.onmidimessage = (event: any) => {
          const data = Array.from(event.data as Uint8Array) as number[];
          console.log(`MIDI received from ${input.name}:`, data);
          
          // Emit custom event for other components to listen
          window.dispatchEvent(new CustomEvent('midiMessage', {
            detail: {
              device: input.name,
              data,
              timestamp: Date.now()
            }
          }));
        };
      }
    });
  }, []);

  // Auto-initialize on first use with enhanced Bluetooth support
  useEffect(() => {
    if (!isInitialized && isSupported === false) {
      initializeMIDI().then(success => {
        if (success && midiAccess) {
          setupInputListeners(midiAccess);
        }
      });
    }
  }, [initializeMIDI, isInitialized, isSupported, midiAccess, setupInputListeners]);

  return {
    isSupported,
    isInitialized,
    devices,
    initializeMIDI,
    sendMIDIMessage,
    broadcastMIDIMessage,
    sendNoteOn,
    sendNoteOff,
    sendControlChange,
    sendProgramChange,
    connectedOutputs: devices.filter(d => d.type === 'output' && d.state === 'connected' && d.enabled),
    connectedInputs: devices.filter(d => d.type === 'input' && d.state === 'connected' && d.enabled)
  };
}