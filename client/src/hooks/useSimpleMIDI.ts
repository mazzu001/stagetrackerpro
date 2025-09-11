// Non-blocking MIDI with device caching and safe mode
import { useState, useEffect, useCallback } from 'react';

interface MIDIDevice {
  id: string;
  name: string;
  state?: string;
}

interface MIDIState {
  isLoading: boolean;
  devices: MIDIDevice[];
  connectedDevices: string[];
  errorMessage: string;
  safeMode: boolean;
  cachedDevices: MIDIDevice[];
}

export function useSimpleMIDI() {
  const [state, setState] = useState<MIDIState>(() => {
    // Load cached devices and safe mode from localStorage
    const cachedDevices = JSON.parse(localStorage.getItem('midi-cached-devices') || '[]');
    const safeMode = localStorage.getItem('midi-safe-mode') === 'true';
    
    return {
      isLoading: false,
      devices: [],
      connectedDevices: [],
      errorMessage: '',
      safeMode,
      cachedDevices
    };
  });

  // Update localStorage when state changes
  useEffect(() => {
    localStorage.setItem('midi-safe-mode', state.safeMode.toString());
  }, [state.safeMode]);

  useEffect(() => {
    if (state.devices.length > 0) {
      localStorage.setItem('midi-cached-devices', JSON.stringify(state.devices));
    }
  }, [state.devices]);

  // Refresh devices with visible permission modal and 3-second timeout
  const refreshDevices = useCallback(async (): Promise<void> => {
    if (state.safeMode) {
      console.log('🎵 MIDI refresh skipped - safe mode enabled');
      return;
    }

    console.log('🎵 Starting MIDI device refresh...');
    setState(prev => ({ ...prev, isLoading: true, errorMessage: '' }));

    try {
      // Check MIDI support
      if (!navigator?.requestMIDIAccess) {
        throw new Error('MIDI not supported in this browser');
      }

      // Hard 3-second timeout using Promise.race
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('MIDI scan timeout (3 seconds)')), 3000);
      });

      const midiPromise = navigator.requestMIDIAccess({ sysex: false });

      console.log('🎵 Calling navigator.requestMIDIAccess with 3-second timeout...');
      const access = await Promise.race([midiPromise, timeoutPromise]);

      console.log('🎵 MIDI access granted, scanning devices...');
      
      const deviceList: MIDIDevice[] = [];
      Array.from(access.outputs.values()).forEach((output) => {
        deviceList.push({
          id: output.id,
          name: output.name || 'Unknown MIDI Device',
          state: output.state
        });
      });

      console.log(`🎵 Found ${deviceList.length} MIDI device(s):`, deviceList.map(d => d.name));

      setState(prev => ({
        ...prev,
        isLoading: false,
        devices: deviceList,
        errorMessage: deviceList.length === 0 ? 'No MIDI devices found - check connections' : ''
      }));

      // Set up device state change listener
      access.onstatechange = (event: any) => {
        console.log('🎵 MIDI device state changed:', event.port?.name, event.port?.state);
        setTimeout(() => {
          const updatedDevices: MIDIDevice[] = [];
          Array.from(access.outputs.values()).forEach((output) => {
            updatedDevices.push({
              id: output.id,
              name: output.name || 'Unknown MIDI Device',
              state: output.state
            });
          });
          setState(prev => ({ ...prev, devices: updatedDevices }));
        }, 100);
      };

    } catch (error) {
      console.error('🎵 MIDI refresh failed:', error);
      const errorMsg = error instanceof Error ? error.message : 'MIDI refresh failed';
      
      // Auto-enable safe mode after 3 consecutive timeouts
      const timeoutCount = parseInt(localStorage.getItem('midi-timeout-count') || '0');
      if (errorMsg.includes('timeout')) {
        const newCount = timeoutCount + 1;
        localStorage.setItem('midi-timeout-count', newCount.toString());
        
        if (newCount >= 3) {
          console.log('🎵 Auto-enabling safe mode after 3 consecutive timeouts');
          setState(prev => ({
            ...prev,
            isLoading: false,
            errorMessage: 'Auto-enabled Safe Mode after repeated timeouts',
            safeMode: true,
            devices: []
          }));
          localStorage.removeItem('midi-timeout-count');
          return;
        }
      } else {
        // Reset timeout count on non-timeout errors
        localStorage.removeItem('midi-timeout-count');
      }

      setState(prev => ({
        ...prev,
        isLoading: false,
        errorMessage: errorMsg,
        devices: []
      }));
    }
  }, [state.safeMode]);

  // Connect device
  const connectDevice = useCallback((deviceId: string) => {
    setState(prev => ({
      ...prev,
      connectedDevices: [...prev.connectedDevices.filter(id => id !== deviceId), deviceId]
    }));
  }, []);

  // Disconnect device
  const disconnectDevice = useCallback((deviceId: string) => {
    setState(prev => ({
      ...prev,
      connectedDevices: prev.connectedDevices.filter(id => id !== deviceId)
    }));
  }, []);

  // Toggle safe mode
  const setSafeMode = useCallback((enabled: boolean) => {
    setState(prev => ({ ...prev, safeMode: enabled }));
    if (enabled) {
      console.log('🎵 Safe mode enabled - MIDI disabled for live performance');
    } else {
      console.log('🎵 Safe mode disabled - MIDI enabled');
    }
  }, []);

  // Send MIDI command (mock in safe mode)
  const sendCommand = useCallback(async (command: string): Promise<boolean> => {
    if (state.safeMode) {
      console.log(`🎵 MIDI Command (safe mode - not sent): ${command}`);
      return false;
    }

    if (state.connectedDevices.length === 0) {
      console.log(`🎵 MIDI Command (no devices connected): ${command}`);
      return false;
    }

    // For now, just log - real implementation would need the MIDI access object
    console.log(`🎵 MIDI Command (would send to connected devices): ${command}`);
    return true;
  }, [state.safeMode, state.connectedDevices]);

  return {
    isLoading: state.isLoading,
    devices: state.devices,
    connectedDevices: state.connectedDevices,
    errorMessage: state.errorMessage,
    safeMode: state.safeMode,
    cachedDevices: state.cachedDevices,
    refreshDevices,
    connectDevice,
    disconnectDevice,
    setSafeMode,
    sendCommand,
  };
}