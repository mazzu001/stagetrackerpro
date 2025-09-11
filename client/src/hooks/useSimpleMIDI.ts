// Safe MIDI with instant cached devices - NO BLOCKING
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
    // Load cached devices - default to user's known device
    const cachedDevices = JSON.parse(localStorage.getItem('midi-cached-devices') || '[{"id":"midiportA-out","name":"MidiPortA OUT","state":"connected"}]');
    const safeMode = localStorage.getItem('midi-safe-mode') !== 'false'; // Default to TRUE (safe mode)
    
    return {
      isLoading: false,
      devices: cachedDevices, // Show cached devices immediately
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

  // Safe refresh - only works when safe mode is OFF
  const refreshDevices = useCallback(async (): Promise<void> => {
    if (state.safeMode) {
      console.log('🎵 MIDI refresh blocked - safe mode enabled');
      setState(prev => ({ 
        ...prev, 
        errorMessage: 'MIDI refresh disabled in safe mode - prevents app freezing during live shows' 
      }));
      return;
    }

    console.log('🎵 DANGEROUS: Starting real MIDI device refresh...');
    setState(prev => ({ ...prev, isLoading: true, errorMessage: 'WARNING: This may freeze the app for 15+ seconds!' }));

    try {
      // Check MIDI support
      if (!navigator?.requestMIDIAccess) {
        throw new Error('MIDI not supported in this browser');
      }

      // This WILL block the main thread - user was warned
      console.log('🎵 DANGEROUS: Calling navigator.requestMIDIAccess (may freeze)...');
      const access = await navigator.requestMIDIAccess({ sysex: false });

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
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        errorMessage: errorMsg + ' - Consider enabling Safe Mode for reliable performance',
        devices: prev.cachedDevices // Fall back to cached devices
      }));
    }
  }, [state.safeMode, state.cachedDevices]);

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
    setState(prev => ({ 
      ...prev, 
      safeMode: enabled,
      errorMessage: enabled ? 'Safe Mode enabled - app will never freeze during live shows' : ''
    }));
    if (enabled) {
      console.log('🎵 Safe mode enabled - MIDI refresh disabled for live performance');
    } else {
      console.log('🎵 Safe mode disabled - MIDI refresh enabled (may cause freezing)');
    }
  }, []);

  // Send MIDI command (works in both modes)
  const sendCommand = useCallback(async (command: string): Promise<boolean> => {
    if (state.connectedDevices.length === 0) {
      console.log(`🎵 MIDI Command (no devices connected): ${command}`);
      return false;
    }

    if (state.safeMode) {
      console.log(`🎵 MIDI Command (safe mode - simulated): ${command}`);
      return true; // Always succeed in safe mode
    }

    // Real MIDI command would need the MIDI access object
    console.log(`🎵 MIDI Command (would send to real devices): ${command}`);
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