// Simple MIDI Hook - Clean wrapper around the new useMidiManager
// Provides compatibility with existing components

import { useMidiManager } from './useMidiManager';

// Legacy compatibility interface
export interface GlobalMIDIHook {
  // State
  isConnected: boolean;
  deviceName: string;
  inputDeviceName: string;
  isLoading: boolean;
  loadingMessage: string;
  midiInitMessage: string;
  midiInitProgress: string;
  isMIDIAvailable: boolean;
  isMIDIInitializing: boolean;
  
  // Core functions
  initializeMIDI: () => Promise<boolean>;
  connectToDevice: (deviceId: string) => Promise<boolean>;
  sendCommand: (command: string) => Promise<boolean>;
  
  // Device management
  getAvailableOutputs: () => Array<{
    id: string;
    name: string;
    manufacturer: string;
    state: string;
    type: 'input' | 'output';
    connection: string;
  }>;
  getAvailableInputs: () => Array<{
    id: string;
    name: string;
    manufacturer: string;
    state: string;
    type: 'input' | 'output';
    connection: string;
  }>;
  getConnectedDevices: () => Array<{
    id: string;
    name: string;
    manufacturer: string;
    state: string;
    type: 'input' | 'output';
    connection: string;
  }>;
  
  // Multi-device support
  connectToMultipleDevices: (deviceIds: string[]) => Promise<{connected: string[], failed: string[]}>;
  disconnectDevice: (deviceId: string) => Promise<boolean>;
  isDeviceConnected: (deviceId: string) => boolean;
  sendCommandToDevice: (command: string, deviceId: string) => Promise<boolean>;
  
  // Compatibility functions
  refreshDevices: () => Promise<boolean>;
  retryMIDIInitialization: () => Promise<boolean>;
  connectToInputDevice: (deviceId: string) => Promise<boolean>;
  sendMIDICommand: (command: string) => Promise<boolean>;
  sendCommandToAll: (command: string) => Promise<boolean>;
  
  // Additional compatibility
  connectionProgress?: Array<{device: string, status: string}>;
  getConnectedOutputs?: () => Array<{id: string, name: string, channel?: number}>;
}

// Main hook that wraps the new simple MIDI manager
export function useGlobalWebMIDI(): GlobalMIDIHook {
  const midi = useMidiManager();
  
  return {
    // State mapping
    isConnected: midi.isConnected,
    deviceName: midi.deviceName || '',
    inputDeviceName: midi.inputDeviceName || '',
    isLoading: midi.isLoading,
    loadingMessage: midi.loadingMessage,
    midiInitMessage: midi.loadingMessage,
    midiInitProgress: midi.loadingMessage,
    isMIDIAvailable: midi.isMIDIAvailable,
    isMIDIInitializing: midi.isLoading,
    
    // Core functions
    initializeMIDI: midi.initializeMIDI,
    connectToDevice: midi.connectToDevice,
    sendCommand: async (command: string) => {
      return Promise.resolve(midi.sendCommand(command));
    },
    
    // Device management
    getAvailableOutputs: midi.getAvailableOutputs,
    getAvailableInputs: midi.getAvailableInputs,
    getConnectedDevices: midi.getConnectedDevices,
    
    // Multi-device support
    connectToMultipleDevices: midi.connectToMultipleDevices,
    disconnectDevice: midi.disconnectDevice,
    isDeviceConnected: midi.isDeviceConnected,
    sendCommandToDevice: async (command: string, deviceId: string) => {
      return Promise.resolve(midi.sendCommandToDevice(command, deviceId));
    },
    
    // Compatibility functions
    refreshDevices: midi.refreshDevices,
    retryMIDIInitialization: midi.retryMIDIInitialization,
    connectToInputDevice: midi.connectToDevice, // Same function for inputs
    sendMIDICommand: async (command: string) => {
      return Promise.resolve(midi.sendCommand(command));
    },
    sendCommandToAll: async (command: string) => {
      return Promise.resolve(midi.sendCommand(command));
    },
    
    // Additional compatibility
    connectionProgress: [],
    getConnectedOutputs: () => midi.getConnectedDevices().filter(d => d.type === 'output').map(d => ({ ...d, channel: 1 })),
  };
}

// Global event compatibility - minimal implementation for existing components
export const dispatchGlobalMidiConnectionChange = (deviceName: string, connected: boolean) => {
  window.dispatchEvent(new CustomEvent('globalMidiConnectionChange', {
    detail: { deviceName, connected }
  }));
};

export const dispatchGlobalMidiDeviceChange = () => {
  window.dispatchEvent(new CustomEvent('globalMidiDeviceChange'));
};

// Legacy compatibility function
export const setupGlobalMIDIEventListener = () => {
  console.log('🎵 Global MIDI event listener setup (legacy compatibility)');
  // No-op for compatibility
};

console.log('🎵 useGlobalWebMIDI hook mounted - MIDI will initialize when needed');