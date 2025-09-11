// Ultra-Simple MIDI - Maximum simplicity, minimum complexity
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

  // Simple device refresh - maximum 3 second timeout
  const refreshDevices = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, errorMessage: '' }));
    
    let timeoutId: NodeJS.Timeout;
    let completed = false;
    
    // Guaranteed 3-second timeout
    timeoutId = setTimeout(() => {
      if (!completed) {
        completed = true;
        setState(prev => ({ 
          ...prev, 
          isLoading: false, 
          errorMessage: 'MIDI timeout - no devices available',
          devices: []
        }));
      }
    }, 3000);
    
    try {
      // Simple MIDI check
      if (!navigator?.requestMIDIAccess) {
        throw new Error('MIDI not supported');
      }
      
      const access = await navigator.requestMIDIAccess({ sysex: false });
      
      if (!completed) {
        completed = true;
        clearTimeout(timeoutId);
        
        const deviceList: SimpleMIDIDevice[] = [];
        access.outputs.forEach((output) => {
          deviceList.push({
            id: output.id,
            name: output.name || 'Unknown Device'
          });
        });
        
        setState(prev => ({ 
          ...prev, 
          isLoading: false,
          devices: deviceList,
          errorMessage: deviceList.length === 0 ? 'No MIDI devices found' : ''
        }));
      }
    } catch (error) {
      if (!completed) {
        completed = true;
        clearTimeout(timeoutId);
        setState(prev => ({ 
          ...prev, 
          isLoading: false,
          errorMessage: 'MIDI not available on this device',
          devices: []
        }));
      }
    }
  }, []);

  // Simple connect - no complex state management
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

  return {
    isLoading: state.isLoading,
    devices: state.devices,
    connectedDevices: state.connectedDevices,
    errorMessage: state.errorMessage,
    refreshDevices,
    connectDevice,
    disconnectDevice,
  };
}