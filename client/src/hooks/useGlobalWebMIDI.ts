import { useState, useEffect, useCallback } from 'react';

// Global MIDI state for persistence across dialog closures
let globalMidiAccess: MIDIAccess | null = null;
let globalSelectedOutput: MIDIOutput | null = null; // Primary device (backwards compatibility)
let globalSelectedInput: MIDIInput | null = null;
let globalConnectionStatus = 'Disconnected';
let globalDeviceName = ''; // Primary device name (backwards compatibility)
let globalInputDeviceName = '';

// NEW: Multi-device support - maps device ID to connection info
let globalConnectedOutputs: Map<string, {device: MIDIOutput, channel: number, name: string}> = new Map();
let globalConnectedInputs: Map<string, {device: MIDIInput, name: string}> = new Map();
let globalNextChannel = 1; // Auto-assign channels 1-16

// Store last connected device info in localStorage for auto-reconnect
const MIDI_DEVICE_STORAGE_KEY = 'lastConnectedMidiDevice'; // Keep existing for compatibility
const MIDI_DEVICES_STORAGE_KEY = 'connectedMidiDevices'; // NEW: Multi-device storage

interface StoredMidiDevice {
  id: string;
  name: string;
  manufacturer: string;
}

// NEW: Multi-device storage interface
interface StoredMultiMidiDevice {
  id: string;
  name: string;
  manufacturer: string;
  channel: number;
  type: 'input' | 'output';
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

// NEW: Multi-device storage functions
const saveConnectedDevices = () => {
  try {
    const devices: StoredMultiMidiDevice[] = [];
    
    // Save all connected outputs
    globalConnectedOutputs.forEach((info, deviceId) => {
      devices.push({
        id: deviceId,
        name: info.name,
        manufacturer: info.device.manufacturer || 'Unknown',
        channel: info.channel,
        type: 'output'
      });
    });
    
    // Save all connected inputs  
    globalConnectedInputs.forEach((info, deviceId) => {
      devices.push({
        id: deviceId,
        name: info.name,
        manufacturer: info.device.manufacturer || 'Unknown', 
        channel: 0, // Inputs don't need channels
        type: 'input'
      });
    });
    
    localStorage.setItem(MIDI_DEVICES_STORAGE_KEY, JSON.stringify(devices));
    console.log('💾 Saved', devices.length, 'connected MIDI devices');
  } catch (error) {
    console.error('❌ Failed to save connected devices:', error);
  }
};

const getStoredDevices = (): StoredMultiMidiDevice[] => {
  try {
    const stored = localStorage.getItem(MIDI_DEVICES_STORAGE_KEY);
    if (stored) {
      const devices = JSON.parse(stored) as StoredMultiMidiDevice[];
      console.log('📱 Found', devices.length, 'stored MIDI devices');
      return devices;
    }
  } catch (error) {
    console.error('❌ Failed to load stored devices:', error);
  }
  return [];
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
  // NEW: Multi-device functions
  getConnectedDevices: () => Array<{id: string, name: string, channel: number, type: 'input' | 'output'}>;
  connectToMultipleDevices: (deviceIds: string[]) => Promise<{connected: string[], failed: string[]}>;
  disconnectDevice: (deviceId: string) => Promise<boolean>;
  sendCommandToAll: (command: string) => Promise<boolean>;
  sendCommandToDevice: (command: string, deviceId: string) => Promise<boolean>;
  isDeviceConnected: (deviceId: string) => boolean;
  // NEW: Loading states
  isLoading: boolean;
  loadingMessage: string;
  connectionProgress: Array<{device: string, status: 'pending' | 'connecting' | 'connected' | 'failed'}>;
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
const attemptAutoReconnect = async (setLoadingState?: (loading: boolean, message: string) => void): Promise<boolean> => {
  const lastDevice = getLastConnectedDevice();
  if (!lastDevice || !globalMidiAccess) {
    return false;
  }
  
  setLoadingState?.(true, `Please wait - Reconnecting to ${lastDevice.name}...`);
  console.log('🔄 Attempting auto-reconnect to:', lastDevice.name);
  
  // Try to find the device by ID ONLY - no loops or searching
  const output = globalMidiAccess.outputs.get(lastDevice.id);
  
  if (!output) {
    console.log('⚠️ Last connected device not available:', lastDevice.name);
    setLoadingState?.(false, '');
    return false;
  }
  
  // Don't await - handle auto-reconnection in background
  Promise.race([
    output.open(),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Auto-reconnect timeout')), 2000))
  ])
    .then(() => {
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
      
      setLoadingState?.(false, '');
    })
    .catch(error => {
      console.error('❌ Auto-reconnect failed:', error);
      setLoadingState?.(false, '');
    });
  
  // Return immediately - don't wait for connection
  return false;
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
    
    // Add shorter timeout to prevent hanging
    const midiAccessPromise = navigator.requestMIDIAccess({ sysex: true });
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('MIDI initialization timeout')), 3000);
    });
    
    // Use requestIdleCallback if available for even better non-blocking behavior
    const startMIDIInit = () => {
      Promise.race([midiAccessPromise, timeoutPromise])
        .then((midiAccess) => {
          globalMidiAccess = midiAccess as MIDIAccess;
          
          // Minimal device change listener - no complex logic
          globalMidiAccess.onstatechange = (event: any) => {
            if (event.port) {
              console.log('🔄 Global MIDI device state changed:', event.port.name, event.port.state);
            }
          };
          
          console.log('✅ Global Web MIDI access initialized');
          
          // Check for auto-reconnect ONCE only, no repeated attempts
          attemptAutoReconnect();
        })
        .catch(error => {
          console.error('❌ Failed to initialize Web MIDI:', error);
        });
    };
    
    // Fire and forget - start immediately, never wait
    startMIDIInit();
    
    // Always return false - never indicate success/failure
    return false;
    
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
    // Fire and forget - try to initialize MIDI but don't wait
    initializeWebMIDI();
    return false;
  }
  
  const output = globalMidiAccess!.outputs.get(deviceId);
  if (!output) {
    console.error('❌ Device not found:', deviceId);
    return false;
  }
  
  // Don't await - handle device connection in background
  output.open()
    .then(() => {
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
    })
    .catch(error => {
      console.error('❌ Failed to connect to device:', error);
    });
  
  // Return immediately - connection happens in background
  return true;
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
    // Fire and forget - try to initialize MIDI but don't wait
    initializeWebMIDI();
    return false;
  }
  
  const input = globalMidiAccess!.inputs.get(deviceId);
  if (!input) {
    console.error('❌ Input device not found:', deviceId);
    return false;
  }
  
  // Don't await - handle input device connection in background
  input.open()
    .then(() => {
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
    })
    .catch(error => {
      console.error('❌ Failed to connect to input device:', error);
    });
  
  // Return immediately - connection happens in background
  return true;
};

// Send MIDI command - FIRE AND FORGET
const sendMIDICommand = async (command: string): Promise<boolean> => {
  // Fire and forget - try to send MIDI but never wait or return status
  if (!globalSelectedOutput) {
    // Try to initialize if not ready, but don't wait
    initializeWebMIDI();
    return true; // Always return true - fire and forget
  }
  
  const midiBytes = parseMIDICommand(command);
  if (!midiBytes) {
    console.log('🎵 MIDI command format issue:', command);
    return true; // Even invalid commands return true - fire and forget
  }
  
  try {
    // Fire and forget - send the command but don't wait for confirmation
    console.log('🎵 MIDI fired:', command, '→', Array.from(midiBytes).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' '));
    globalSelectedOutput.send(midiBytes);
  } catch (error) {
    console.log('🎵 MIDI send attempted:', command);
  }
  
  // Always return true - we fired the command regardless of success
  return true;
};

// NEW: Multi-device functions
const getConnectedDevices = () => {
  const devices: Array<{id: string, name: string, channel: number, type: 'input' | 'output'}> = [];
  
  // Add connected outputs
  globalConnectedOutputs.forEach((info, deviceId) => {
    devices.push({
      id: deviceId,
      name: info.name,
      channel: info.channel,
      type: 'output'
    });
  });
  
  // Add connected inputs
  globalConnectedInputs.forEach((info, deviceId) => {
    devices.push({
      id: deviceId,
      name: info.name,
      channel: 0, // Inputs don't use channels
      type: 'input'
    });
  });
  
  return devices;
};

const connectToMultipleDevices = async (deviceIds: string[], setLoadingState?: (loading: boolean, message: string, progress: Array<{device: string, status: 'pending' | 'connecting' | 'connected' | 'failed'}>) => void): Promise<{connected: string[], failed: string[]}> => {
  const connected: string[] = [];
  const failed: string[] = [];
  
  // Set up initial loading state
  const progress = deviceIds.map(id => ({
    device: globalMidiAccess?.outputs.get(id)?.name || 'Unknown Device',
    status: 'pending' as 'pending' | 'connecting' | 'connected' | 'failed'
  }));
  
  setLoadingState?.(true, 'Please wait - Connecting to MIDI devices...', progress);
  
  if (!globalMidiAccess) {
    setLoadingState?.(false, '', []);
    // Fire and forget - try to initialize MIDI but don't wait
    initializeWebMIDI();
    return { connected: [], failed: deviceIds };
  }
  
  console.log('🔄 Connecting to multiple devices...', deviceIds);
  
  for (let i = 0; i < deviceIds.length; i++) {
    const deviceId = deviceIds[i];
    
    // Update progress for current device
    progress[i].status = 'connecting';
    setLoadingState?.(true, `Please wait - Connecting to ${progress[i].device}... (${i + 1}/${deviceIds.length})`, [...progress]);
    
    try {
      const output = globalMidiAccess!.outputs.get(deviceId);
      if (!output) {
        console.log('❌ Device not found:', deviceId);
        failed.push(deviceId);
        progress[i].status = 'failed';
        continue;
      }
      
      // Don't await - handle device connection in background with timeout
      try {
        Promise.race([
          output.open(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 2000))
        ])
        .then(() => {
          // Device opened successfully - continue with connection logic
          console.log('✅ Device opened successfully:', output.name);
        })
        .catch((error) => {
          console.error('❌ Failed to open device:', output.name, error);
          // Remove from connected devices if opening failed
          globalConnectedOutputs.delete(deviceId);
        });
        
        // Continue immediately without waiting for device to open
      } catch (error) {
        // If opening fails, still treat as failed but don't block
        throw error;
      }
      
      // Assign channel (1-16, cycling)
      const channel = globalNextChannel;
      globalNextChannel = (globalNextChannel % 16) + 1;
      
      // Add to connected devices
      globalConnectedOutputs.set(deviceId, {
        device: output,
        channel: channel,
        name: output.name || 'Unknown Device'
      });
      
      connected.push(deviceId);
      progress[i].status = 'connected';
      console.log('✅ Connected to device:', output.name, 'on channel', channel);
      
    } catch (error) {
      console.error('❌ Failed to connect to device:', deviceId, error);
      failed.push(deviceId);
      progress[i].status = 'failed';
    }
  }
  
  // Save connected devices to localStorage
  saveConnectedDevices();
  
  // Clear loading state
  setLoadingState?.(false, '', []);
  
  return { connected, failed };
};

const disconnectDevice = async (deviceId: string): Promise<boolean> => {
  try {
    // Check outputs
    if (globalConnectedOutputs.has(deviceId)) {
      const info = globalConnectedOutputs.get(deviceId)!;
      // Don't await - handle device closing in background
      info.device.close().catch(error => {
        console.error('❌ Error closing output device:', error);
      });
      globalConnectedOutputs.delete(deviceId);
      console.log('✅ Disconnected output device:', info.name);
      
      // Update primary device if this was it
      if (globalSelectedOutput?.id === deviceId) {
        globalSelectedOutput = null;
        globalConnectionStatus = 'Disconnected';
        globalDeviceName = '';
      }
      
      saveConnectedDevices();
      return true;
    }
    
    // Check inputs
    if (globalConnectedInputs.has(deviceId)) {
      const info = globalConnectedInputs.get(deviceId)!;
      // Don't await - handle device closing in background
      info.device.close().catch(error => {
        console.error('❌ Error closing input device:', error);
      });
      globalConnectedInputs.delete(deviceId);
      console.log('✅ Disconnected input device:', info.name);
      
      // Update primary input if this was it
      if (globalSelectedInput?.id === deviceId) {
        globalSelectedInput = null;
        globalInputDeviceName = '';
      }
      
      saveConnectedDevices();
      return true;
    }
    
    console.log('⚠️ Device not found in connected devices:', deviceId);
    return false;
    
  } catch (error) {
    console.error('❌ Failed to disconnect device:', deviceId, error);
    return false;
  }
};

const sendCommandToAll = async (command: string): Promise<boolean> => {
  if (globalConnectedOutputs.size === 0) {
    console.error('❌ No MIDI devices connected');
    return false;
  }
  
  const midiBytes = parseMIDICommand(command);
  if (!midiBytes) {
    console.error('❌ Invalid MIDI command format:', command);
    return false;
  }
  
  let success = true;
  
  globalConnectedOutputs.forEach((info, deviceId) => {
    try {
      // Override channel with device-specific channel
      const channelOverrideBytes = new Uint8Array(midiBytes);
      if (channelOverrideBytes.length > 0 && (channelOverrideBytes[0] & 0xF0) !== 0xF0) {
        // Set channel bits for channel voice messages
        channelOverrideBytes[0] = (channelOverrideBytes[0] & 0xF0) | ((info.channel - 1) & 0x0F);
      }
      
      console.log('🎵 Sending to', info.name, 'channel', info.channel, ':', command);
      info.device.send(channelOverrideBytes);
      
    } catch (error) {
      console.error('❌ Failed to send to device:', info.name, error);
      success = false;
    }
  });
  
  return success;
};

const sendCommandToDevice = async (command: string, deviceId: string): Promise<boolean> => {
  const deviceInfo = globalConnectedOutputs.get(deviceId);
  if (!deviceInfo) {
    console.error('❌ Device not connected:', deviceId);
    return false;
  }
  
  const midiBytes = parseMIDICommand(command);
  if (!midiBytes) {
    console.error('❌ Invalid MIDI command format:', command);
    return false;
  }
  
  try {
    // Override channel with device-specific channel
    const channelOverrideBytes = new Uint8Array(midiBytes);
    if (channelOverrideBytes.length > 0 && (channelOverrideBytes[0] & 0xF0) !== 0xF0) {
      channelOverrideBytes[0] = (channelOverrideBytes[0] & 0xF0) | ((deviceInfo.channel - 1) & 0x0F);
    }
    
    console.log('🎵 Sending to', deviceInfo.name, 'channel', deviceInfo.channel, ':', command);
    deviceInfo.device.send(channelOverrideBytes);
    return true;
    
  } catch (error) {
    console.error('❌ Failed to send to device:', deviceInfo.name, error);
    return false;
  }
};

const isDeviceConnected = (deviceId: string): boolean => {
  return globalConnectedOutputs.has(deviceId) || globalConnectedInputs.has(deviceId);
};

export const useGlobalWebMIDI = (): GlobalMIDIState => {
  const [isConnected, setIsConnected] = useState(globalConnectionStatus === 'Connected');
  const [deviceName, setDeviceName] = useState(globalDeviceName);
  const [inputDeviceName, setInputDeviceName] = useState(globalInputDeviceName);
  
  // NEW: Loading states for background tasks
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [connectionProgress, setConnectionProgress] = useState<Array<{device: string, status: 'pending' | 'connecting' | 'connected' | 'failed'}>>([]);
  
  useEffect(() => {
    // Start MIDI in background immediately - NEVER wait for it
    console.log('🎵 Starting background Web MIDI - fire and forget...');
    // Fire and forget - don't care if it succeeds or fails
    initializeWebMIDI();
    
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
    // Fire and forget - refresh MIDI in background
    console.log('🎵 Refreshing MIDI devices in background...');
    initializeWebMIDI();
  }, []);
  
  const connectToDeviceCallback = useCallback(async (deviceId: string) => {
    // Don't await - return the promise directly for non-blocking operation
    return connectToDevice(deviceId);
  }, []);
  
  const sendCommandCallback = useCallback(async (command: string) => {
    // Don't await - return the promise directly for non-blocking operation
    return sendMIDICommand(command);
  }, []);
  
  const getAvailableOutputsCallback = useCallback(() => {
    return getAvailableOutputs();
  }, []);
  
  const getAvailableInputsCallback = useCallback(() => {
    return getAvailableInputs();
  }, []);
  
  const connectToInputDeviceCallback = useCallback(async (deviceId: string) => {
    // Don't await - return the promise directly for non-blocking operation
    return connectToInputDevice(deviceId);
  }, []);
  
  // NEW: Multi-device callbacks with loading state support
  const getConnectedDevicesCallback = useCallback(() => {
    return getConnectedDevices();
  }, []);
  
  const connectToMultipleDevicesCallback = useCallback(async (deviceIds: string[]) => {
    const setLoadingState = (loading: boolean, message: string, progress: Array<{device: string, status: 'pending' | 'connecting' | 'connected' | 'failed'}>) => {
      setIsLoading(loading);
      setLoadingMessage(message);
      setConnectionProgress(progress);
    };
    
    // Don't await - return the promise directly for non-blocking operation
    return connectToMultipleDevices(deviceIds, setLoadingState);
  }, []);
  
  const disconnectDeviceCallback = useCallback(async (deviceId: string) => {
    // Don't await - return the promise directly for non-blocking operation
    return disconnectDevice(deviceId);
  }, []);
  
  const sendCommandToAllCallback = useCallback(async (command: string) => {
    // Don't await - return the promise directly for non-blocking operation
    return sendCommandToAll(command);
  }, []);
  
  const sendCommandToDeviceCallback = useCallback(async (command: string, deviceId: string) => {
    // Don't await - return the promise directly for non-blocking operation
    return sendCommandToDevice(command, deviceId);
  }, []);
  
  const isDeviceConnectedCallback = useCallback((deviceId: string) => {
    return isDeviceConnected(deviceId);
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
    getAvailableInputs: getAvailableInputsCallback,
    // NEW: Multi-device functions
    getConnectedDevices: getConnectedDevicesCallback,
    connectToMultipleDevices: connectToMultipleDevicesCallback,
    disconnectDevice: disconnectDeviceCallback,
    sendCommandToAll: sendCommandToAllCallback,
    sendCommandToDevice: sendCommandToDeviceCallback,
    isDeviceConnected: isDeviceConnectedCallback,
    // NEW: Loading states
    isLoading,
    loadingMessage,
    connectionProgress
  };
};

// Global event listener for external MIDI commands (from lyrics, footer, etc.)
export const setupGlobalMIDIEventListener = () => {
  const handleExternalMIDI = async (event: any) => {
    const command = event.detail?.command;
    if (command) {
      // Don't await - handle MIDI sending in background
      sendMIDICommand(command)
        .then((success) => {
          if (success) {
            console.log('✅ External MIDI command sent successfully:', command);
          } else {
            console.error('❌ Failed to send external MIDI command:', command);
          }
        })
        .catch((error) => {
          console.error('❌ Failed to send external MIDI command:', command, error);
        });
    }
  };
  
  window.addEventListener('sendBluetoothMIDI', handleExternalMIDI);
  
  return () => {
    window.removeEventListener('sendBluetoothMIDI', handleExternalMIDI);
  };
};