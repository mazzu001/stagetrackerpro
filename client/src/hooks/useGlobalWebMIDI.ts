import { useState, useEffect, useCallback } from 'react';

// Global MIDI state for persistence across dialog closures
let globalMidiAccess: MIDIAccess | null = null;
let globalSelectedOutput: MIDIOutput | null = null;
let globalSelectedInput: MIDIInput | null = null;
let globalConnectionStatus = 'Disconnected';
let globalDeviceName = '';
let globalInputDeviceName = '';
let globalIsInitializing = false; // Prevent multiple simultaneous initializations

// Support multiple simultaneous device connections
let globalConnectedOutputs: Map<string, MIDIOutput> = new Map();
let globalConnectedInputs: Map<string, MIDIInput> = new Map();

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
  connectedOutputs: Map<string, MIDIOutput>;
  connectedInputs: Map<string, MIDIInput>;
  sendCommand: (command: string) => Promise<boolean>;
  connectToDevice: (deviceId: string) => Promise<boolean>;
  connectToInputDevice: (deviceId: string) => Promise<boolean>;
  disconnectDevice: (deviceId: string) => Promise<boolean>;
  disconnectAllDevices: () => Promise<boolean>;
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
  
  // Prevent multiple simultaneous initialization attempts
  if (globalIsInitializing) {
    console.log('⚠️ MIDI initialization already in progress, waiting...');
    // Wait for current initialization to complete
    while (globalIsInitializing) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return globalMidiAccess !== null;
  }
  
  globalIsInitializing = true;
  
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
    
    // NO SYSEX - this causes aggressive hardware scanning and 25-second freezes!
    // Increased timeout to 3 seconds for better device detection
    const midiAccessPromise = navigator.requestMIDIAccess();
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('MIDI initialization timeout after 3 seconds')), 3000);
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
  } finally {
    globalIsInitializing = false; // Always clear the flag
  }
};

// Get available MIDI output devices - NO LOOPS, return array directly
const getAvailableOutputs = (): MIDIDevice[] => {
  if (!globalMidiAccess) {
    console.log('🔍 No globalMidiAccess available for outputs');
    return [];
  }
  
  const outputs = Array.from(globalMidiAccess.outputs.values());
  console.log(`🔍 Found ${outputs.length} MIDI output devices:`, outputs.map(o => o.name));
  
  return outputs.map((output: MIDIOutput) => ({
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
  if (!globalMidiAccess) {
    console.log('🔍 No globalMidiAccess available for inputs');
    return [];
  }
  
  const inputs = Array.from(globalMidiAccess.inputs.values());
  console.log(`🔍 Found ${inputs.length} MIDI input devices:`, inputs.map(i => i.name));
  
  return inputs.map((input: MIDIInput) => ({
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
    
    // Add to multi-device collection
    globalConnectedOutputs.set(deviceId, output);
    
    // Also set as primary device (for backward compatibility)
    if (!globalSelectedOutput) {
      globalSelectedOutput = output;
      globalConnectionStatus = 'Connected';
      globalDeviceName = output.name || 'Unknown Device';
      
      // Save this device as the last connected device
      saveLastConnectedDevice(
        deviceId, 
        output.name || 'Unknown Device', 
        output.manufacturer || 'Unknown'
      );
    }
    
    console.log('✅ Connected to MIDI device:', output.name);
    
    // Dispatch connection status change
    window.dispatchEvent(new CustomEvent('globalMidiConnectionChange', {
      detail: {
        connected: true,
        deviceName: output.name || 'Unknown Device',
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
    
    // Add to multi-device collection
    globalConnectedInputs.set(deviceId, input);
    
    // Set up message listener
    input.onmidimessage = handleIncomingMIDI;
    
    // Also set as primary input device (for backward compatibility)
    if (!globalSelectedInput) {
      globalSelectedInput = input;
      globalInputDeviceName = input.name || 'Unknown Input Device';
    }
    
    console.log('✅ Connected to MIDI input device:', input.name);
    
    // Dispatch connection status change
    window.dispatchEvent(new CustomEvent('globalMidiInputConnectionChange', {
      detail: {
        connected: true,
        deviceName: input.name || 'Unknown Input Device',
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

// Disconnect a specific device ONLY
const disconnectDevice = async (deviceId: string): Promise<boolean> => {
  try {
    let disconnectedAny = false;
    
    // Only disconnect from multi-device collections if this exact device ID exists
    if (globalConnectedOutputs.has(deviceId)) {
      const output = globalConnectedOutputs.get(deviceId)!;
      await output.close();
      globalConnectedOutputs.delete(deviceId);
      console.log('✅ Disconnected from multi-device output:', deviceId);
      disconnectedAny = true;
    }
    
    if (globalConnectedInputs.has(deviceId)) {
      const input = globalConnectedInputs.get(deviceId)!;
      input.onmidimessage = null;
      await input.close();
      globalConnectedInputs.delete(deviceId);
      console.log('✅ Disconnected from multi-device input:', deviceId);
      disconnectedAny = true;
    }
    
    // If this was the primary device, clear primary references
    if (globalSelectedOutput && globalSelectedOutput.id === deviceId) {
      globalSelectedOutput = null;
      globalDeviceName = '';
      globalConnectionStatus = 'Disconnected';
      localStorage.removeItem(MIDI_DEVICE_STORAGE_KEY);
    }
    
    if (globalSelectedInput && globalSelectedInput.id === deviceId) {
      globalSelectedInput = null;
      globalInputDeviceName = '';
    }
    
    if (disconnectedAny) {
      // Dispatch disconnection event
      window.dispatchEvent(new CustomEvent('globalMidiConnectionChange', {
        detail: {
          connected: false,
          deviceName: '',
          deviceId: deviceId
        }
      }));
      
      return true;
    } else {
      console.log('⚠️ Device not found in connected devices:', deviceId);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Failed to disconnect device:', error);
    return false;
  }
};

// Disconnect all devices
const disconnectAllDevices = async (): Promise<boolean> => {
  try {
    let disconnectedCount = 0;
    
    // Disconnect primary output
    if (globalSelectedOutput) {
      await globalSelectedOutput.close();
      globalSelectedOutput = null;
      globalDeviceName = '';
      globalConnectionStatus = 'Disconnected';
      disconnectedCount++;
    }
    
    // Disconnect primary input  
    if (globalSelectedInput) {
      globalSelectedInput.onmidimessage = null;
      await globalSelectedInput.close();
      globalSelectedInput = null;
      globalInputDeviceName = '';
      disconnectedCount++;
    }
    
    // Disconnect multi-device outputs
    for (const [deviceId, output] of Array.from(globalConnectedOutputs.entries())) {
      await output.close();
      disconnectedCount++;
    }
    globalConnectedOutputs.clear();
    
    // Disconnect multi-device inputs
    for (const [deviceId, input] of Array.from(globalConnectedInputs.entries())) {
      input.onmidimessage = null;
      await input.close();
      disconnectedCount++;
    }
    globalConnectedInputs.clear();
    
    // Clear localStorage
    localStorage.removeItem(MIDI_DEVICE_STORAGE_KEY);
    
    console.log(`✅ Disconnected from ${disconnectedCount} MIDI devices`);
    
    // Dispatch global disconnection event
    window.dispatchEvent(new CustomEvent('globalMidiConnectionChange', {
      detail: {
        connected: false,
        deviceName: '',
        deviceId: null
      }
    }));
    
    return true;
    
  } catch (error) {
    console.error('❌ Failed to disconnect all devices:', error);
    return false;
  }
};

export const useGlobalWebMIDI = (): GlobalMIDIState => {
  const [isConnected, setIsConnected] = useState(globalConnectionStatus === 'Connected');
  const [deviceName, setDeviceName] = useState(globalDeviceName);
  const [inputDeviceName, setInputDeviceName] = useState(globalInputDeviceName);
  
  useEffect(() => {
    // Check if we should attempt auto-reconnect (but without causing freeze)
    console.log('🎵 Web MIDI hook ready - will initialize lazily when needed');
    
    // Only attempt auto-reconnect if there's a stored device
    const lastDevice = getLastConnectedDevice();
    if (lastDevice) {
      console.log('🔄 Stored device found, will attempt auto-reconnect after UI loads:', lastDevice.name);
      
      // Delay auto-reconnect to prevent startup freeze
      setTimeout(async () => {
        console.log('🔄 Attempting delayed auto-reconnect...');
        await initializeWebMIDI(); // This will trigger attemptAutoReconnect
      }, 1000); // Give UI time to load first
    }
    
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
    console.log('🎵 User requested device refresh - initializing MIDI now...');
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
  
  const disconnectDeviceCallback = useCallback(async (deviceId: string) => {
    return await disconnectDevice(deviceId);
  }, []);
  
  const disconnectAllDevicesCallback = useCallback(async () => {
    return await disconnectAllDevices();
  }, []);
  
  return {
    isConnected,
    deviceName,
    inputDeviceName,
    connectedOutputs: globalConnectedOutputs,
    connectedInputs: globalConnectedInputs,
    sendCommand: sendCommandCallback,
    connectToDevice: connectToDeviceCallback,
    connectToInputDevice: connectToInputDeviceCallback,
    disconnectDevice: disconnectDeviceCallback,
    disconnectAllDevices: disconnectAllDevicesCallback,
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