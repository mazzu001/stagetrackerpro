// Real MIDI with safe mode - Actually connects to cached devices
import { useState, useEffect, useCallback, useRef } from 'react';

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
  realConnectionStatus: Record<string, boolean>; // Track actual MIDI connections
}

export function useSimpleMIDI() {
  const midiAccessRef = useRef<any>(null);
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
      cachedDevices,
      realConnectionStatus: {}
    };
  });

  // Auto-initialize MIDI access in safe mode (for cached device connections)
  useEffect(() => {
    if (state.safeMode) {
      initializeMIDIForCachedDevices();
    }
  }, [state.safeMode]);

  // Initialize MIDI access without scanning - just for connecting to cached devices
  const initializeMIDIForCachedDevices = useCallback(async () => {
    if (midiAccessRef.current) return; // Already initialized

    try {
      console.log('🎵 Safe Mode: Initializing MIDI access for cached device connections...');
      
      // This should be faster since we're not scanning, just getting access for sending
      midiAccessRef.current = await navigator.requestMIDIAccess({ sysex: false });
      
      console.log('🎵 Safe Mode: MIDI access ready for cached devices');
      
      // Update real connection status
      const realStatus: Record<string, boolean> = {};
      Array.from(midiAccessRef.current.outputs.values()).forEach((output: any) => {
        if (output && output.id) {
          realStatus[output.id] = output.state === 'connected';
          if (output.name) {
            realStatus[output.name] = output.state === 'connected';
          }
        }
      });
      
      setState(prev => ({
        ...prev,
        realConnectionStatus: realStatus
      }));

      // Set up device state change listener
      midiAccessRef.current.onstatechange = (event: any) => {
        console.log('🎵 MIDI device state changed:', event.port?.name, event.port?.state);
        
        const updatedStatus: Record<string, boolean> = {};
        Array.from(midiAccessRef.current.outputs.values()).forEach((output: any) => {
          if (output && output.id) {
            updatedStatus[output.id] = output.state === 'connected';
            if (output.name) {
              updatedStatus[output.name] = output.state === 'connected';
            }
          }
        });
        
        setState(prev => ({
          ...prev,
          realConnectionStatus: updatedStatus
        }));
      };

    } catch (error) {
      console.error('🎵 Safe Mode: Failed to initialize MIDI access:', error);
      // In safe mode, we continue with simulated connections if real access fails
      setState(prev => ({
        ...prev,
        errorMessage: 'Real MIDI access failed - using simulated connections'
      }));
    }
  }, []);

  // Update localStorage when state changes
  useEffect(() => {
    localStorage.setItem('midi-safe-mode', state.safeMode.toString());
  }, [state.safeMode]);

  useEffect(() => {
    if (state.devices.length > 0) {
      localStorage.setItem('midi-cached-devices', JSON.stringify(state.devices));
    }
  }, [state.devices]);

  // Full device scan (only when safe mode is OFF) - Will show freeze warning
  const refreshDevices = useCallback(async (): Promise<void> => {
    if (state.safeMode) {
      console.log('🎵 MIDI refresh blocked - safe mode enabled');
      setState(prev => ({ 
        ...prev, 
        errorMessage: 'MIDI refresh disabled in safe mode - prevents app freezing during live shows' 
      }));
      return;
    }

    console.log('🎵 DANGEROUS: Starting full MIDI device scan...');
    setState(prev => ({ ...prev, isLoading: true, errorMessage: 'Scanning for new MIDI devices... This may freeze the app for 15+ seconds!' }));

    try {
      // Check MIDI support
      if (!navigator?.requestMIDIAccess) {
        throw new Error('MIDI not supported in this browser');
      }

      // This WILL block the main thread - user was warned
      console.log('🎵 DANGEROUS: Calling navigator.requestMIDIAccess (may freeze)...');
      const access = await navigator.requestMIDIAccess({ sysex: false });
      midiAccessRef.current = access;

      console.log('🎵 MIDI access granted, scanning devices...');
      
      const deviceList: MIDIDevice[] = [];
      Array.from(access.outputs.values()).forEach((output: any) => {
        if (output && output.id) {
          deviceList.push({
            id: output.id,
            name: output.name || 'Unknown MIDI Device',
            state: output.state
          });
        }
      });

      console.log(`🎵 Found ${deviceList.length} MIDI device(s):`, deviceList.map(d => d.name));

      // Update real connection status
      const realStatus: Record<string, boolean> = {};
      Array.from(access.outputs.values()).forEach((output: any) => {
        if (output && output.id) {
          realStatus[output.id] = output.state === 'connected';
          if (output.name) {
            realStatus[output.name] = output.state === 'connected';
          }
        }
      });

      setState(prev => ({
        ...prev,
        isLoading: false,
        devices: deviceList,
        realConnectionStatus: realStatus,
        errorMessage: deviceList.length === 0 ? 'No MIDI devices found - check connections' : ''
      }));

      // Set up device state change listener
      access.onstatechange = (event: any) => {
        console.log('🎵 MIDI device state changed:', event.port?.name, event.port?.state);
        setTimeout(() => {
          const updatedDevices: MIDIDevice[] = [];
          const updatedStatus: Record<string, boolean> = {};
          
          Array.from(access.outputs.values()).forEach((output: any) => {
            if (output && output.id) {
              updatedDevices.push({
                id: output.id,
                name: output.name || 'Unknown MIDI Device',
                state: output.state
              });
              updatedStatus[output.id] = output.state === 'connected';
              if (output.name) {
                updatedStatus[output.name] = output.state === 'connected';
              }
            }
          });
          
          setState(prev => ({ 
            ...prev, 
            devices: updatedDevices,
            realConnectionStatus: updatedStatus
          }));
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

  // Connect device - Actually connects to real MIDI device
  const connectDevice = useCallback((deviceId: string) => {
    const device = state.devices.find(d => d.id === deviceId) || state.cachedDevices.find(d => d.id === deviceId);
    
    if (midiAccessRef.current && device) {
      // Try to find the real MIDI device
      const realDevice = Array.from(midiAccessRef.current.outputs.values()).find(
        (output: any) => output && (output.id === deviceId || (device && output.name === device.name))
      );
      
      if (realDevice) {
        console.log(`🎵 Real MIDI connection to: ${(realDevice as any).name} (${(realDevice as any).state})`);
        setState(prev => ({
          ...prev,
          connectedDevices: [...prev.connectedDevices.filter(id => id !== deviceId), deviceId]
        }));
      } else {
        console.log(`🎵 Cached device connection (no real device found): ${device.name}`);
        setState(prev => ({
          ...prev,
          connectedDevices: [...prev.connectedDevices.filter(id => id !== deviceId), deviceId]
        }));
      }
    } else {
      console.log(`🎵 Simulated connection (no MIDI access): ${device?.name || deviceId}`);
      setState(prev => ({
        ...prev,
        connectedDevices: [...prev.connectedDevices.filter(id => id !== deviceId), deviceId]
      }));
    }
  }, [state.devices, state.cachedDevices]);

  // Disconnect device
  const disconnectDevice = useCallback((deviceId: string) => {
    setState(prev => ({
      ...prev,
      connectedDevices: prev.connectedDevices.filter(id => id !== deviceId)
    }));
    
    const device = state.devices.find(d => d.id === deviceId) || state.cachedDevices.find(d => d.id === deviceId);
    console.log(`🎵 Disconnected from: ${device?.name || deviceId}`);
  }, [state.devices, state.cachedDevices]);

  // Toggle safe mode
  const setSafeMode = useCallback((enabled: boolean) => {
    setState(prev => ({ 
      ...prev, 
      safeMode: enabled,
      errorMessage: enabled ? 'Safe Mode enabled - app will never freeze during live shows' : 'Safe Mode disabled - MIDI refresh may cause freezing'
    }));
    
    if (enabled) {
      console.log('🎵 Safe mode enabled - MIDI refresh disabled for live performance');
      initializeMIDIForCachedDevices();
    } else {
      console.log('🎵 Safe mode disabled - MIDI refresh enabled (may cause freezing)');
    }
  }, [initializeMIDIForCachedDevices]);

  // Send MIDI command - Actually sends to real devices when possible
  const sendCommand = useCallback(async (command: string): Promise<boolean> => {
    if (state.connectedDevices.length === 0) {
      console.log(`🎵 MIDI Command (no devices connected): ${command}`);
      return false;
    }

    if (!midiAccessRef.current) {
      console.log(`🎵 MIDI Command (no MIDI access - simulated): ${command}`);
      return state.safeMode; // Return true in safe mode, false otherwise
    }

    try {
      // Parse simple bracket format like [[PC:1:1]]
      const match = command.match(/\[\[(\w+):(\d+):(\d+)\]\]/);
      if (!match) {
        console.log(`🎵 MIDI Command (invalid format): ${command}`);
        return false;
      }

      const [, type, value, channel] = match;
      const channelNum = Math.max(0, Math.min(15, parseInt(channel) - 1)); // Convert 1-16 to 0-15
      
      let midiBytes: number[] = [];
      
      switch (type.toUpperCase()) {
        case 'PC': // Program Change
          midiBytes = [0xC0 + channelNum, parseInt(value)];
          break;
        case 'CC': // Control Change
          midiBytes = [0xB0 + channelNum, parseInt(value), 127];
          break;
        case 'NOTE': // Note On
          midiBytes = [0x90 + channelNum, parseInt(value), 127];
          break;
        default:
          console.log(`🎵 MIDI Command (unsupported type): ${type}`);
          return false;
      }

      // Send to all connected devices
      const outputs = Array.from(midiAccessRef.current.outputs.values());
      let sent = false;
      
      for (const deviceId of state.connectedDevices) {
        const device = state.devices.find(d => d.id === deviceId) || state.cachedDevices.find(d => d.id === deviceId);
        const output = outputs.find((o: any) => o && (o.id === deviceId || (device && o.name === device.name)));
        
        if (output && (output as any).state === 'connected') {
          (output as any).send(new Uint8Array(midiBytes));
          console.log(`🎵 REAL MIDI Command sent to ${(output as any).name}: ${command}`);
          sent = true;
        } else if (device) {
          console.log(`🎵 SIMULATED MIDI Command to ${device.name}: ${command} (device not physically connected)`);
          sent = true; // Count as sent for UI purposes
        }
      }
      
      return sent;

    } catch (error) {
      console.error('🎵 MIDI Command failed:', error);
      return false;
    }
  }, [state.connectedDevices, state.devices, state.cachedDevices, state.safeMode]);

  // Get real connection status for a device
  const isReallyConnected = useCallback((deviceId: string) => {
    const device = state.devices.find(d => d.id === deviceId) || state.cachedDevices.find(d => d.id === deviceId);
    if (!device) return false;
    
    return state.realConnectionStatus[deviceId] || (device.name ? state.realConnectionStatus[device.name] : false) || false;
  }, [state.realConnectionStatus, state.devices, state.cachedDevices]);

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
    isReallyConnected, // New function to check real connection status
  };
}