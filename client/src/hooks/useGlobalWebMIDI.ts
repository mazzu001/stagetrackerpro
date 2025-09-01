import { useState, useEffect, useCallback } from 'react';

// Global MIDI state for persistence across dialog closures
let globalMidiAccess: MIDIAccess | null = null;
let globalSelectedOutputs: MIDIOutput[] = [];
let globalSelectedInputs: MIDIInput[] = [];
let globalConnectionStatus = 'Disconnected';
let globalConnectedDeviceNames: string[] = [];
let globalConnectedInputDeviceNames: string[] = [];

// Store last connected devices info in localStorage for auto-reconnect
const MIDI_DEVICES_STORAGE_KEY = 'lastConnectedMidiDevices';
const MIDI_INPUT_DEVICES_STORAGE_KEY = 'lastConnectedMidiInputDevices';

interface StoredMidiDevice {
  id: string;
  name: string;
  manufacturer: string;
}

interface StoredMidiDevices {
  outputs: StoredMidiDevice[];
  inputs: StoredMidiDevice[];
}

// Save connected devices to localStorage
const saveConnectedDevices = () => {
  try {
    const outputDevices: StoredMidiDevice[] = globalSelectedOutputs.map(output => ({
      id: output.id,
      name: output.name || 'Unknown Device',
      manufacturer: output.manufacturer || 'Unknown'
    }));
    
    const inputDevices: StoredMidiDevice[] = globalSelectedInputs.map(input => ({
      id: input.id,
      name: input.name || 'Unknown Device', 
      manufacturer: input.manufacturer || 'Unknown'
    }));
    
    const deviceData: StoredMidiDevices = {
      outputs: outputDevices,
      inputs: inputDevices
    };
    
    localStorage.setItem(MIDI_DEVICES_STORAGE_KEY, JSON.stringify(deviceData));
    console.log('💾 Saved connected MIDI devices:', outputDevices.length, 'outputs,', inputDevices.length, 'inputs');
  } catch (error) {
    console.error('❌ Failed to save connected devices:', error);
  }
};

// Get last connected devices from localStorage
const getLastConnectedDevices = (): StoredMidiDevices => {
  try {
    const stored = localStorage.getItem(MIDI_DEVICES_STORAGE_KEY);
    if (stored) {
      const deviceData = JSON.parse(stored) as StoredMidiDevices;
      console.log('📱 Found last connected MIDI devices:', deviceData.outputs.length, 'outputs,', deviceData.inputs.length, 'inputs');
      return deviceData;
    }
  } catch (error) {
    console.error('❌ Failed to load last connected devices:', error);
  }
  return { outputs: [], inputs: [] };
};

interface GlobalMIDIState {
  isConnected: boolean;
  deviceName: string;
  inputDeviceName: string;
  sendCommand: (command: string) => Promise<boolean>;
  connectToDevice: (deviceId: string) => Promise<boolean>;
  disconnectFromDevice: (deviceId: string) => Promise<boolean>;
  connectToInputDevice: (deviceId: string) => Promise<boolean>;
  disconnectFromInputDevice: (deviceId: string) => Promise<boolean>;
  refreshDevices: () => Promise<void>;
  getAvailableOutputs: () => MIDIDevice[];
  getAvailableInputs: () => MIDIDevice[];
  isDeviceConnected: (deviceId: string, type: 'input' | 'output') => boolean;
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

// Auto-reconnect to last known devices - CHECK ONLY ONCE, NO LOOPS
const attemptAutoReconnect = async (): Promise<boolean> => {
  const lastDevices = getLastConnectedDevices();
  if (!globalMidiAccess || (lastDevices.outputs.length === 0 && lastDevices.inputs.length === 0)) {
    return false;
  }
  
  let reconnectedAny = false;
  
  // Reconnect output devices
  for (const deviceInfo of lastDevices.outputs) {
    console.log('🔄 Attempting auto-reconnect to output:', deviceInfo.name);
    
    const output = globalMidiAccess.outputs.get(deviceInfo.id);
    if (!output) {
      console.log('⚠️ Last connected output device not available:', deviceInfo.name);
      continue;
    }
    
    try {
      await output.open();
      if (!globalSelectedOutputs.find(o => o.id === output.id)) {
        globalSelectedOutputs.push(output);
        globalConnectedDeviceNames.push(output.name || 'Unknown Device');
      }
      
      console.log('✅ Auto-reconnected to MIDI output device:', output.name);
      reconnectedAny = true;
      
    } catch (error) {
      console.error('❌ Auto-reconnect failed for output:', deviceInfo.name, error);
    }
  }
  
  // Reconnect input devices
  for (const deviceInfo of lastDevices.inputs) {
    console.log('🔄 Attempting auto-reconnect to input:', deviceInfo.name);
    
    const input = globalMidiAccess.inputs.get(deviceInfo.id);
    if (!input) {
      console.log('⚠️ Last connected input device not available:', deviceInfo.name);
      continue;
    }
    
    try {
      await input.open();
      if (!globalSelectedInputs.find(i => i.id === input.id)) {
        globalSelectedInputs.push(input);
        globalConnectedInputDeviceNames.push(input.name || 'Unknown Input Device');
        input.onmidimessage = handleIncomingMIDI;
      }
      
      console.log('✅ Auto-reconnected to MIDI input device:', input.name);
      reconnectedAny = true;
      
    } catch (error) {
      console.error('❌ Auto-reconnect failed for input:', deviceInfo.name, error);
    }
  }
  
  if (reconnectedAny) {
    globalConnectionStatus = 'Connected';
    
    // Dispatch connection status change
    window.dispatchEvent(new CustomEvent('globalMidiConnectionChange', {
      detail: {
        connected: true,
        deviceNames: globalConnectedDeviceNames,
        devices: globalSelectedOutputs.map(o => ({ id: o.id, name: o.name }))
      }
    }));
  }
  
  return reconnectedAny;
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
    
    // Add timeout to prevent hanging
    const midiAccessPromise = navigator.requestMIDIAccess({ sysex: true });
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('MIDI initialization timeout')), 5000);
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

// Connect to a specific device (adds to array, doesn't replace)
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
  
  // Check if already connected
  if (globalSelectedOutputs.find(o => o.id === deviceId)) {
    console.log('⚠️ Device already connected:', output.name);
    return true;
  }
  
  try {
    await output.open();
    
    // Add to connected devices array
    globalSelectedOutputs.push(output);
    globalConnectedDeviceNames.push(output.name || 'Unknown Device');
    globalConnectionStatus = 'Connected';
    
    // Save all connected devices
    saveConnectedDevices();
    
    console.log('✅ Connected to MIDI device:', output.name, '(Total connected:', globalSelectedOutputs.length, ')');
    
    // Dispatch connection status change
    window.dispatchEvent(new CustomEvent('globalMidiConnectionChange', {
      detail: {
        connected: true,
        deviceNames: globalConnectedDeviceNames,
        devices: globalSelectedOutputs.map(o => ({ id: o.id, name: o.name }))
      }
    }));
    
    return true;
    
  } catch (error) {
    console.error('❌ Failed to connect to device:', error);
    return false;
  }
};

// Disconnect from a specific device
const disconnectFromDevice = async (deviceId: string): Promise<boolean> => {
  const deviceIndex = globalSelectedOutputs.findIndex(o => o.id === deviceId);
  if (deviceIndex === -1) {
    console.log('⚠️ Device not connected:', deviceId);
    return false;
  }
  
  try {
    const output = globalSelectedOutputs[deviceIndex];
    await output.close();
    
    // Remove from connected arrays
    globalSelectedOutputs.splice(deviceIndex, 1);
    globalConnectedDeviceNames.splice(deviceIndex, 1);
    
    // Update connection status
    globalConnectionStatus = globalSelectedOutputs.length > 0 ? 'Connected' : 'Disconnected';
    
    // Save updated devices
    saveConnectedDevices();
    
    console.log('✅ Disconnected from MIDI device:', output.name, '(Remaining:', globalSelectedOutputs.length, ')');
    
    // Dispatch connection status change
    window.dispatchEvent(new CustomEvent('globalMidiConnectionChange', {
      detail: {
        connected: globalSelectedOutputs.length > 0,
        deviceNames: globalConnectedDeviceNames,
        devices: globalSelectedOutputs.map(o => ({ id: o.id, name: o.name }))
      }
    }));
    
    return true;
    
  } catch (error) {
    console.error('❌ Failed to disconnect from device:', error);
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
const handleIncomingMIDI = (deviceName: string) => (event: MIDIMessageEvent) => {
  if (event.data && event.data.length > 0) {
    const command = formatIncomingMIDI(event.data);
    if (command) {
      console.log('📨 Incoming MIDI:', command, 'from', deviceName);
      
      // Dispatch event for components to listen to
      window.dispatchEvent(new CustomEvent('incomingMIDI', {
        detail: {
          command,
          timestamp: Date.now(),
          deviceName: deviceName
        }
      }));
    }
  }
};

// Connect to input device (adds to array, doesn't replace)
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
  
  // Check if already connected
  if (globalSelectedInputs.find(i => i.id === deviceId)) {
    console.log('⚠️ Input device already connected:', input.name);
    return true;
  }
  
  try {
    await input.open();
    
    // Add to connected input devices array
    globalSelectedInputs.push(input);
    globalConnectedInputDeviceNames.push(input.name || 'Unknown Input Device');
    
    // Set up message listener for this specific device
    input.onmidimessage = handleIncomingMIDI(input.name || 'Unknown Input Device');
    
    // Save all connected devices
    saveConnectedDevices();
    
    console.log('✅ Connected to MIDI input device:', input.name, '(Total connected:', globalSelectedInputs.length, ')');
    
    // Dispatch connection status change
    window.dispatchEvent(new CustomEvent('globalMidiInputConnectionChange', {
      detail: {
        connected: true,
        deviceNames: globalConnectedInputDeviceNames,
        devices: globalSelectedInputs.map(i => ({ id: i.id, name: i.name }))
      }
    }));
    
    return true;
    
  } catch (error) {
    console.error('❌ Failed to connect to input device:', error);
    return false;
  }
};

// Disconnect from a specific input device
const disconnectFromInputDevice = async (deviceId: string): Promise<boolean> => {
  const deviceIndex = globalSelectedInputs.findIndex(i => i.id === deviceId);
  if (deviceIndex === -1) {
    console.log('⚠️ Input device not connected:', deviceId);
    return false;
  }
  
  try {
    const input = globalSelectedInputs[deviceIndex];
    input.onmidimessage = null;
    await input.close();
    
    // Remove from connected arrays
    globalSelectedInputs.splice(deviceIndex, 1);
    globalConnectedInputDeviceNames.splice(deviceIndex, 1);
    
    // Save updated devices
    saveConnectedDevices();
    
    console.log('✅ Disconnected from MIDI input device:', input.name, '(Remaining:', globalSelectedInputs.length, ')');
    
    // Dispatch connection status change
    window.dispatchEvent(new CustomEvent('globalMidiInputConnectionChange', {
      detail: {
        connected: globalSelectedInputs.length > 0,
        deviceNames: globalConnectedInputDeviceNames,
        devices: globalSelectedInputs.map(i => ({ id: i.id, name: i.name }))
      }
    }));
    
    return true;
    
  } catch (error) {
    console.error('❌ Failed to disconnect from input device:', error);
    return false;
  }
};

// Send MIDI command to all connected devices
const sendMIDICommand = async (command: string): Promise<boolean> => {
  if (globalSelectedOutputs.length === 0) {
    console.error('❌ No MIDI devices connected');
    return false;
  }
  
  const midiBytes = parseMIDICommand(command);
  if (!midiBytes) {
    console.error('❌ Invalid MIDI command format:', command);
    return false;
  }
  
  let sentCount = 0;
  const errors: string[] = [];
  
  // Send to all connected output devices
  for (const output of globalSelectedOutputs) {
    try {
      output.send(midiBytes);
      sentCount++;
      console.log('🎵 Sent MIDI to', output.name + ':', command, '→', Array.from(midiBytes).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' '));
    } catch (error) {
      const errorMsg = `Failed to send to ${output.name}: ${error}`;
      console.error('❌', errorMsg);
      errors.push(errorMsg);
    }
  }
  
  if (sentCount > 0) {
    console.log(`✅ MIDI command sent to ${sentCount}/${globalSelectedOutputs.length} devices`);
    return true;
  } else {
    console.error('❌ Failed to send MIDI command to any device. Errors:', errors);
    return false;
  }
};

export const useGlobalWebMIDI = (): GlobalMIDIState => {
  const [isConnected, setIsConnected] = useState(globalConnectionStatus === 'Connected');
  const [deviceName, setDeviceName] = useState(globalConnectedDeviceNames.join(', ') || '');
  const [inputDeviceName, setInputDeviceName] = useState(globalConnectedInputDeviceNames.join(', ') || '');
  
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
      setDeviceName(event.detail.deviceNames ? event.detail.deviceNames.join(', ') : '');
    };
    
    const handleInputConnectionChange = (event: any) => {
      setInputDeviceName(event.detail.deviceNames ? event.detail.deviceNames.join(', ') : '');
    };
    
    const handleDeviceChange = () => {
      // Re-check connection status when devices change
      const disconnectedOutputs = globalSelectedOutputs.filter(output => output.state !== 'connected');
      if (disconnectedOutputs.length > 0) {
        // Remove disconnected devices
        for (const disconnectedOutput of disconnectedOutputs) {
          const index = globalSelectedOutputs.findIndex(o => o.id === disconnectedOutput.id);
          if (index > -1) {
            globalSelectedOutputs.splice(index, 1);
            globalConnectedDeviceNames.splice(index, 1);
          }
        }
        
        // Update connection status
        globalConnectionStatus = globalSelectedOutputs.length > 0 ? 'Connected' : 'Disconnected';
        setIsConnected(globalSelectedOutputs.length > 0);
        setDeviceName(globalConnectedDeviceNames.join(', '));
        
        // Save updated device list
        saveConnectedDevices();
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
  
  const disconnectFromDeviceCallback = useCallback(async (deviceId: string) => {
    return await disconnectFromDevice(deviceId);
  }, []);
  
  const disconnectFromInputDeviceCallback = useCallback(async (deviceId: string) => {
    return await disconnectFromInputDevice(deviceId);
  }, []);
  
  const isDeviceConnectedCallback = useCallback((deviceId: string, type: 'input' | 'output') => {
    if (type === 'output') {
      return globalSelectedOutputs.some(output => output.id === deviceId);
    } else {
      return globalSelectedInputs.some(input => input.id === deviceId);
    }
  }, []);
  
  return {
    isConnected,
    deviceName,
    inputDeviceName,
    sendCommand: sendCommandCallback,
    connectToDevice: connectToDeviceCallback,
    disconnectFromDevice: disconnectFromDeviceCallback,
    connectToInputDevice: connectToInputDeviceCallback,
    disconnectFromInputDevice: disconnectFromInputDeviceCallback,
    refreshDevices,
    getAvailableOutputs: getAvailableOutputsCallback,
    getAvailableInputs: getAvailableInputsCallback,
    isDeviceConnected: isDeviceConnectedCallback
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