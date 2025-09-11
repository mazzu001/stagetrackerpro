// Ultra-Simple MIDI - No Web MIDI API calls, completely fake for instant loading
import { useState, useCallback } from 'react';

interface SimpleMIDIDevice {
  id: string;
  name: string;
}

interface SimpleMIDIState {
  isLoading: boolean;
  devices: SimpleMIDIDevice[];
  connectedDevices: string[];
  errorMessage: string;
}

export function useSimpleMIDI() {
  const [state, setState] = useState<SimpleMIDIState>({
    isLoading: false,
    devices: [],
    connectedDevices: [],
    errorMessage: ''
  });

  // Completely fake device refresh - NO WEB MIDI API CALLS
  const refreshDevices = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, errorMessage: '' }));
    
    // Simulate a quick scan without any real API calls
    setTimeout(() => {
      setState(prev => ({ 
        ...prev, 
        isLoading: false,
        devices: [
          { id: 'demo-device-1', name: 'Demo MIDI Device 1' },
          { id: 'demo-device-2', name: 'Demo MIDI Device 2' }
        ],
        errorMessage: ''
      }));
    }, 500); // Quick 500ms delay to simulate scanning
  }, []);

  // Simple connect - no real functionality
  const connectDevice = useCallback((deviceId: string) => {
    setState(prev => ({
      ...prev,
      connectedDevices: [...prev.connectedDevices, deviceId]
    }));
  }, []);

  // Simple disconnect
  const disconnectDevice = useCallback((deviceId: string) => {
    setState(prev => ({
      ...prev,
      connectedDevices: prev.connectedDevices.filter(id => id !== deviceId)
    }));
  }, []);

  // Simple send command - completely fake
  const sendCommand = useCallback((command: string) => {
    console.log(`🎵 MIDI Command (demo mode): ${command}`);
    return Promise.resolve(true);
  }, []);

  return {
    isLoading: state.isLoading,
    devices: state.devices,
    connectedDevices: state.connectedDevices,
    errorMessage: state.errorMessage,
    refreshDevices,
    connectDevice,
    disconnectDevice,
    sendCommand,
  };
}