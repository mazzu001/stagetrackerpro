import { useState, useEffect, useCallback } from 'react';

// Global MIDI state for persistence across dialog closures
let globalMidiAccess: MIDIAccess | null = null;
let globalSelectedOutput: MIDIOutput | null = null;
let globalConnectionStatus = 'Disconnected';
let globalDeviceName = '';

interface GlobalMIDIState {
  isConnected: boolean;
  deviceName: string;
  sendCommand: (command: string) => Promise<boolean>;
  connectToDevice: (deviceId: string) => Promise<boolean>;
  refreshDevices: () => Promise<void>;
  getAvailableOutputs: () => MIDIDevice[];
}

interface MIDIDevice {
  id: string;
  name: string;
  manufacturer: string;
  state: string;
  type: 'input' | 'output';
  connection: string;
}

// MIDI command parser - same as WebMIDIManager
const parseMIDICommand = (command: string): Uint8Array | null => {
  const trimmed = command.trim();
  
  // Handle bracket format: [[PC:12:1]], [[CC:7:64:1]], [[NOTE:60:127:1]]
  const bracketMatch = trimmed.match(/\[\[([^\]]+)\]\]/);
  if (bracketMatch) {
    const inner = bracketMatch[1];
    const parts = inner.split(':');
    
    if (parts.length >= 2) {
      const type = parts[0].toUpperCase();
      
      if (type === 'PC' && parts.length >= 3) {
        // Program Change: [[PC:program:channel]]
        const program = parseInt(parts[1]);
        const channel = parseInt(parts[2]) - 1; // Convert to 0-based
        if (program >= 0 && program <= 127 && channel >= 0 && channel <= 15) {
          return new Uint8Array([0xC0 | channel, program]);
        }
      } else if (type === 'CC' && parts.length >= 4) {
        // Control Change: [[CC:controller:value:channel]]
        const controller = parseInt(parts[1]);
        const value = parseInt(parts[2]);
        const channel = parseInt(parts[3]) - 1; // Convert to 0-based
        if (controller >= 0 && controller <= 127 && value >= 0 && value <= 127 && channel >= 0 && channel <= 15) {
          return new Uint8Array([0xB0 | channel, controller, value]);
        }
      } else if (type === 'NOTE' && parts.length >= 4) {
        // Note On: [[NOTE:note:velocity:channel]]
        const note = parseInt(parts[1]);
        const velocity = parseInt(parts[2]);
        const channel = parseInt(parts[3]) - 1; // Convert to 0-based
        if (note >= 0 && note <= 127 && velocity >= 0 && velocity <= 127 && channel >= 0 && channel <= 15) {
          return new Uint8Array([0x90 | channel, note, velocity]);
        }
      }
    }
  }
  
  return null;
};

// Initialize Web MIDI access once
const initializeWebMIDI = async (): Promise<boolean> => {
  if (globalMidiAccess) return true;
  
  try {
    // Check if we're in a browser environment
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      console.log('⚠️ Not in browser environment, skipping Web MIDI initialization');
      return false;
    }
    
    if (!navigator.requestMIDIAccess) {
      console.log('❌ Web MIDI API not supported in this browser');
      return false;
    }
    
    console.log('🎵 Initializing global Web MIDI access...');
    
    // Add timeout to prevent hanging
    const midiAccessPromise = navigator.requestMIDIAccess({ sysex: true });
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('MIDI initialization timeout')), 5000);
    });
    
    globalMidiAccess = await Promise.race([midiAccessPromise, timeoutPromise]) as MIDIAccess;
    
    // Set up device change listener
    globalMidiAccess.onstatechange = (event) => {
      console.log('🔄 Global MIDI device state changed:', event.port.name, event.port.state);
      // Dispatch global event for UI updates
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('globalMidiDeviceChange', {
          detail: { port: event.port }
        }));
      }, 0);
    };
    
    console.log('✅ Global Web MIDI access initialized');
    return true;
    
  } catch (error) {
    console.error('❌ Failed to initialize Web MIDI:', error);
    return false;
  }
};

// Get available MIDI output devices
const getAvailableOutputs = (): MIDIDevice[] => {
  if (!globalMidiAccess) return [];
  
  const outputs: MIDIDevice[] = [];
  globalMidiAccess.outputs.forEach((output: MIDIOutput) => {
    outputs.push({
      id: output.id,
      name: output.name || 'Unknown Device',
      manufacturer: output.manufacturer || 'Unknown',
      state: output.state,
      type: 'output',
      connection: output.connection
    });
  });
  
  return outputs;
};

// Connect to a specific device
const connectToDevice = async (deviceId: string): Promise<boolean> => {
  if (!globalMidiAccess) {
    const initialized = await initializeWebMIDI();
    if (!initialized) return false;
  }
  
  const output = globalMidiAccess!.outputs.get(deviceId);
  if (!output) {
    console.error('❌ Device not found:', deviceId);
    return false;
  }
  
  try {
    await output.open();
    globalSelectedOutput = output;
    globalConnectionStatus = 'Connected';
    globalDeviceName = output.name || 'Unknown Device';
    
    console.log('✅ Connected to MIDI device:', globalDeviceName);
    
    // Dispatch connection status change
    window.dispatchEvent(new CustomEvent('globalMidiConnectionChange', {
      detail: {
        connected: true,
        deviceName: globalDeviceName,
        deviceId: deviceId
      }
    }));
    
    return true;
    
  } catch (error) {
    console.error('❌ Failed to connect to device:', error);
    return false;
  }
};

// Send MIDI command
const sendMIDICommand = async (command: string): Promise<boolean> => {
  if (!globalSelectedOutput) {
    console.error('❌ No MIDI device connected');
    return false;
  }
  
  const midiBytes = parseMIDICommand(command);
  if (!midiBytes) {
    console.error('❌ Invalid MIDI command format:', command);
    return false;
  }
  
  try {
    console.log('🎵 Sending global MIDI:', command, '→', Array.from(midiBytes).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' '));
    globalSelectedOutput.send(midiBytes);
    return true;
    
  } catch (error) {
    console.error('❌ Failed to send MIDI command:', error);
    return false;
  }
};

export const useGlobalWebMIDI = (): GlobalMIDIState => {
  const [isConnected, setIsConnected] = useState(globalConnectionStatus === 'Connected');
  const [deviceName, setDeviceName] = useState(globalDeviceName);
  
  useEffect(() => {
    // Initialize Web MIDI asynchronously to prevent blocking
    const initAsync = async () => {
      try {
        await initializeWebMIDI();
      } catch (error) {
        console.error('❌ Failed to initialize Web MIDI in useGlobalWebMIDI:', error);
      }
    };
    
    // Don't block the component mounting
    initAsync();
    
    // Listen for global connection changes
    const handleConnectionChange = (event: any) => {
      setIsConnected(event.detail.connected);
      setDeviceName(event.detail.deviceName);
    };
    
    const handleDeviceChange = () => {
      // Re-check connection status when devices change
      if (globalSelectedOutput && globalSelectedOutput.state !== 'connected') {
        setIsConnected(false);
        setDeviceName('');
        globalSelectedOutput = null;
        globalConnectionStatus = 'Disconnected';
        globalDeviceName = '';
      }
    };
    
    window.addEventListener('globalMidiConnectionChange', handleConnectionChange);
    window.addEventListener('globalMidiDeviceChange', handleDeviceChange);
    
    return () => {
      window.removeEventListener('globalMidiConnectionChange', handleConnectionChange);
      window.removeEventListener('globalMidiDeviceChange', handleDeviceChange);
    };
  }, []);
  
  const refreshDevices = useCallback(async () => {
    await initializeWebMIDI();
  }, []);
  
  const connectToDeviceCallback = useCallback(async (deviceId: string) => {
    return await connectToDevice(deviceId);
  }, []);
  
  const sendCommandCallback = useCallback(async (command: string) => {
    return await sendMIDICommand(command);
  }, []);
  
  const getAvailableOutputsCallback = useCallback(() => {
    return getAvailableOutputs();
  }, []);
  
  return {
    isConnected,
    deviceName,
    sendCommand: sendCommandCallback,
    connectToDevice: connectToDeviceCallback,
    refreshDevices,
    getAvailableOutputs: getAvailableOutputsCallback
  };
};

// Global event listener for external MIDI commands (from lyrics, footer, etc.)
export const setupGlobalMIDIEventListener = () => {
  const handleExternalMIDI = async (event: any) => {
    const command = event.detail?.command;
    if (command) {
      const success = await sendMIDICommand(command);
      if (success) {
        console.log('✅ External MIDI command sent successfully:', command);
      } else {
        console.error('❌ Failed to send external MIDI command:', command);
      }
    }
  };
  
  window.addEventListener('sendBluetoothMIDI', handleExternalMIDI);
  
  return () => {
    window.removeEventListener('sendBluetoothMIDI', handleExternalMIDI);
  };
};