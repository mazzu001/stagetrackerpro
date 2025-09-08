import { useState, useEffect, useCallback } from 'react';

// Global MIDI state for persistence across dialog closures
let globalMidiAccess: MIDIAccess | null = null;
let globalSelectedOutput: MIDIOutput | null = null;
let globalSelectedInput: MIDIInput | null = null;
let globalConnectionStatus = 'Disconnected';
let globalDeviceName = '';
let globalInputDeviceName = '';

// Store last connected device info in localStorage for auto-reconnect
const MIDI_DEVICE_STORAGE_KEY = 'lastConnectedMidiDevice';

interface StoredMidiDevice {
  id: string;
  name: string;
  manufacturer: string;
}

// Save last connected device to localStorage
const saveLastConnectedDevice = (deviceId: string, deviceName: string, manufacturer: string) => {
  try {
    const deviceInfo: StoredMidiDevice = {
      id: deviceId,
      name: deviceName,
      manufacturer: manufacturer
    };
    localStorage.setItem(MIDI_DEVICE_STORAGE_KEY, JSON.stringify(deviceInfo));
    console.log('💾 Saved last connected MIDI device:', deviceName);
  } catch (error) {
    console.error('❌ Failed to save last connected device:', error);
  }
};

// Get last connected device from localStorage
const getLastConnectedDevice = (): StoredMidiDevice | null => {
  try {
    const stored = localStorage.getItem(MIDI_DEVICE_STORAGE_KEY);
    if (stored) {
      const deviceInfo = JSON.parse(stored) as StoredMidiDevice;
      console.log('📱 Found last connected MIDI device:', deviceInfo.name);
      return deviceInfo;
    }
  } catch (error) {
    console.error('❌ Failed to load last connected device:', error);
  }
  return null;
};

interface GlobalMIDIState {
  isConnected: boolean;
  deviceName: string;
  inputDeviceName: string;
  sendCommand: (command: string) => Promise<boolean>;
  connectToDevice: (deviceId: string) => Promise<boolean>;
  connectToInputDevice: (deviceId: string) => Promise<boolean>;
  refreshDevices: () => Promise<void>;
  getAvailableOutputs: () => MIDIDevice[];
  getAvailableInputs: () => MIDIDevice[];
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

// Auto-reconnect to last known device - CHECK ONLY ONCE, NO LOOPS
const attemptAutoReconnect = async (): Promise<boolean> => {
  const lastDevice = getLastConnectedDevice();
  if (!lastDevice || !globalMidiAccess) {
    return false;
  }
  
  console.log('🔄 Attempting auto-reconnect to:', lastDevice.name);
  
  // Try to find the device by ID ONLY - no loops or searching
  const output = globalMidiAccess.outputs.get(lastDevice.id);
  
  if (!output) {
    console.log('⚠️ Last connected device not available:', lastDevice.name);
    return false;
  }
  
  try {
    await output.open();
    globalSelectedOutput = output;
    globalConnectionStatus = 'Connected';
    globalDeviceName = output.name || 'Unknown Device';
    
    console.log('✅ Auto-reconnected to MIDI device:', globalDeviceName);
    
    // Dispatch connection status change
    window.dispatchEvent(new CustomEvent('globalMidiConnectionChange', {
      detail: {
        connected: true,
        deviceName: globalDeviceName,
        deviceId: output.id
      }
    }));
    
    return true;
    
  } catch (error) {
    console.error('❌ Auto-reconnect failed:', error);
    return false;
  }
};

// Initialize Web MIDI access once - NO REPEATED CHECKING
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
    
    // Add aggressive timeout to prevent hanging - 500ms max
    const midiAccessPromise = navigator.requestMIDIAccess({ sysex: true });
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('MIDI initialization timeout')), 500);
    });
    
    globalMidiAccess = await Promise.race([midiAccessPromise, timeoutPromise]) as MIDIAccess;
    
    // Minimal device change listener - no complex logic
    globalMidiAccess.onstatechange = (event: any) => {
      if (event.port) {
        console.log('🔄 Global MIDI device state changed:', event.port.name, event.port.state);
      }
    };
    
    console.log('✅ Global Web MIDI access initialized');
    
    // Check for auto-reconnect ONCE only, no repeated attempts
    attemptAutoReconnect();
    
    return true;
    
  } catch (error) {
    console.error('❌ Failed to initialize Web MIDI:', error);
    return false;
  }
};

// Get available MIDI output devices - NO LOOPS, return array directly
const getAvailableOutputs = (): MIDIDevice[] => {
  if (!globalMidiAccess) return [];
  
  // Convert to array without loops
  return Array.from(globalMidiAccess.outputs.values()).map((output: MIDIOutput) => ({
    id: output.id,
    name: output.name || 'Unknown Device',
    manufacturer: output.manufacturer || 'Unknown',
    state: output.state,
    type: 'output' as const,
    connection: output.connection
  }));
};

// Get available MIDI input devices
const getAvailableInputs = (): MIDIDevice[] => {
  if (!globalMidiAccess) return [];
  
  return Array.from(globalMidiAccess.inputs.values()).map((input: MIDIInput) => ({
    id: input.id,
    name: input.name || 'Unknown Device',
    manufacturer: input.manufacturer || 'Unknown',
    state: input.state,
    type: 'input' as const,
    connection: input.connection
  }));
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
    
    // Save this device as the last connected device
    saveLastConnectedDevice(
      deviceId, 
      output.name || 'Unknown Device', 
      output.manufacturer || 'Unknown'
    );
    
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

// Format incoming MIDI message as bracket command
const formatIncomingMIDI = (data: Uint8Array): string => {
  if (data.length === 0) return '';
  
  const status = data[0];
  const channel = (status & 0x0F) + 1; // Convert to 1-based
  const command = status & 0xF0;
  
  try {
    switch (command) {
      case 0x90: // Note On
        if (data.length >= 3) {
          const note = data[1];
          const velocity = data[2];
          return `[[NOTE:${note}:${velocity}:${channel}]]`;
        }
        break;
      case 0x80: // Note Off
        if (data.length >= 3) {
          const note = data[1];
          return `[[NOTE:${note}:0:${channel}]]`;
        }
        break;
      case 0xB0: // Control Change
        if (data.length >= 3) {
          const controller = data[1];
          const value = data[2];
          return `[[CC:${controller}:${value}:${channel}]]`;
        }
        break;
      case 0xC0: // Program Change
        if (data.length >= 2) {
          const program = data[1];
          return `[[PC:${program}:${channel}]]`;
        }
        break;
      default:
        // For other message types, show as hex
        const hex = Array.from(data).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' ');
        return `[${hex}]`;
    }
  } catch (error) {
    console.error('❌ Error formatting MIDI message:', error);
  }
  
  return '';
};

// Handle incoming MIDI message
const handleIncomingMIDI = (event: MIDIMessageEvent) => {
  if (event.data && event.data.length > 0) {
    const command = formatIncomingMIDI(event.data);
    if (command) {
      console.log('📨 Incoming MIDI:', command);
      
      // Dispatch event for components to listen to
      window.dispatchEvent(new CustomEvent('incomingMIDI', {
        detail: {
          command,
          timestamp: Date.now(),
          deviceName: globalInputDeviceName
        }
      }));
    }
  }
};

// Connect to input device
const connectToInputDevice = async (deviceId: string): Promise<boolean> => {
  if (!globalMidiAccess) {
    const initialized = await initializeWebMIDI();
    if (!initialized) return false;
  }
  
  const input = globalMidiAccess!.inputs.get(deviceId);
  if (!input) {
    console.error('❌ Input device not found:', deviceId);
    return false;
  }
  
  try {
    await input.open();
    
    // Disconnect previous input if any
    if (globalSelectedInput) {
      globalSelectedInput.onmidimessage = null;
    }
    
    globalSelectedInput = input;
    globalInputDeviceName = input.name || 'Unknown Input Device';
    
    // Set up message listener
    input.onmidimessage = handleIncomingMIDI;
    
    console.log('✅ Connected to MIDI input device:', globalInputDeviceName);
    
    // Dispatch connection status change
    window.dispatchEvent(new CustomEvent('globalMidiInputConnectionChange', {
      detail: {
        connected: true,
        deviceName: globalInputDeviceName,
        deviceId: deviceId
      }
    }));
    
    return true;
    
  } catch (error) {
    console.error('❌ Failed to connect to input device:', error);
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
  const [inputDeviceName, setInputDeviceName] = useState(globalInputDeviceName);
  
  useEffect(() => {
    // Defer MIDI initialization to prevent startup freeze
    const deferredInit = () => {
      // Give UI time to render first, then try MIDI
      setTimeout(async () => {
        try {
          await initializeWebMIDI();
        } catch (error) {
          console.error('❌ Failed to initialize Web MIDI in useGlobalWebMIDI:', error);
        }
      }, 100); // Small delay to let UI render
    };
    
    // Don't block the component mounting
    deferredInit();
    
    // Listen for global connection changes
    const handleConnectionChange = (event: any) => {
      setIsConnected(event.detail.connected);
      setDeviceName(event.detail.deviceName);
    };
    
    const handleInputConnectionChange = (event: any) => {
      setInputDeviceName(event.detail.deviceName);
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
    window.addEventListener('globalMidiInputConnectionChange', handleInputConnectionChange);
    window.addEventListener('globalMidiDeviceChange', handleDeviceChange);
    
    return () => {
      window.removeEventListener('globalMidiConnectionChange', handleConnectionChange);
      window.removeEventListener('globalMidiInputConnectionChange', handleInputConnectionChange);
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
  
  const getAvailableInputsCallback = useCallback(() => {
    return getAvailableInputs();
  }, []);
  
  const connectToInputDeviceCallback = useCallback(async (deviceId: string) => {
    return await connectToInputDevice(deviceId);
  }, []);
  
  return {
    isConnected,
    deviceName,
    inputDeviceName,
    sendCommand: sendCommandCallback,
    connectToDevice: connectToDeviceCallback,
    connectToInputDevice: connectToInputDeviceCallback,
    refreshDevices,
    getAvailableOutputs: getAvailableOutputsCallback,
    getAvailableInputs: getAvailableInputsCallback
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