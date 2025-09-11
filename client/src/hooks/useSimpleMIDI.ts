// Completely Simple MIDI - Absolutely no blocking calls
import { useState, useCallback, useRef } from 'react';

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

  const [midiAccess, setMidiAccess] = useState<any>(null);
  const isScanningRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  // Ultra-simple device refresh with hard abort
  const refreshDevices = useCallback(async () => {
    // Prevent concurrent scans
    if (isScanningRef.current) {
      console.log('🎵 MIDI scan already in progress, ignoring click');
      return;
    }

    console.log('🎵 Starting MIDI device scan...');
    
    // Abort any existing scan
    if (abortRef.current) {
      abortRef.current.abort();
    }
    abortRef.current = new AbortController();
    
    isScanningRef.current = true;
    setState(prev => ({ ...prev, isLoading: true, errorMessage: '' }));

    try {
      // Check MIDI support immediately
      if (!navigator?.requestMIDIAccess) {
        throw new Error('MIDI not supported in this browser');
      }

      console.log('🎵 MIDI API available, starting scan...');

      // Hard timeout - if this doesn't resolve in 2 seconds, we give up
      const timeoutId = setTimeout(() => {
        console.log('🎵 MIDI scan HARD TIMEOUT at 2 seconds - giving up');
        isScanningRef.current = false;
        setState(prev => ({
          ...prev,
          isLoading: false,
          errorMessage: 'MIDI scan timeout - your browser may be slow. Try again or check device connections.',
          devices: []
        }));
      }, 2000);

      try {
        console.log('🎵 Calling navigator.requestMIDIAccess...');
        const access = await navigator.requestMIDIAccess({ sysex: false });
        
        // Clear timeout if we succeeded
        clearTimeout(timeoutId);
        
        if (!isScanningRef.current) {
          console.log('🎵 Scan was aborted, ignoring result');
          return;
        }

        console.log('🎵 MIDI access granted, scanning devices...');
        setMidiAccess(access);
        
        const deviceList: SimpleMIDIDevice[] = [];
        Array.from(access.outputs.values()).forEach((output) => {
          deviceList.push({
            id: output.id,
            name: output.name || 'Unknown MIDI Device'
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
            const updatedDevices: SimpleMIDIDevice[] = [];
            Array.from(access.outputs.values()).forEach((output) => {
              updatedDevices.push({
                id: output.id,
                name: output.name || 'Unknown MIDI Device'
              });
            });
            setState(prev => ({ ...prev, devices: updatedDevices }));
          }, 100);
        };

      } catch (error) {
        clearTimeout(timeoutId);
        if (isScanningRef.current) {
          console.error('🎵 MIDI access failed:', error);
          setState(prev => ({
            ...prev,
            isLoading: false,
            errorMessage: 'MIDI not available - check browser permissions',
            devices: []
          }));
        }
      }

    } catch (error) {
      console.error('🎵 MIDI scan failed:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        errorMessage: error instanceof Error ? error.message : 'MIDI scan failed',
        devices: []
      }));
    } finally {
      isScanningRef.current = false;
      console.log('🎵 MIDI scan completed, flag cleared');
    }
  }, []);

  // Simple connect
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

  // Real MIDI command sending
  const sendCommand = useCallback(async (command: string): Promise<boolean> => {
    if (!midiAccess || state.connectedDevices.length === 0) {
      console.log(`🎵 MIDI Command (no devices): ${command}`);
      return false;
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
        case 'CC': // Control Change (would need 3rd param for value)
          midiBytes = [0xB0 + channelNum, parseInt(value), 127];
          break;
        case 'NOTE': // Note On
          midiBytes = [0x90 + channelNum, parseInt(value), 127];
          break;
        default:
          console.log(`🎵 MIDI Command (unsupported type): ${type}`);
          return false;
      }

      // Send to all connected output devices
      const outputs = Array.from(midiAccess.outputs.values());
      let sent = false;
      
      for (const output of outputs) {
        if (state.connectedDevices.includes(output.id) && output.state === 'connected') {
          output.send(new Uint8Array(midiBytes));
          sent = true;
          console.log(`🎵 MIDI Command sent to ${output.name}: ${command}`);
        }
      }
      
      return sent;
    } catch (error) {
      console.error('🎵 MIDI Command failed:', error);
      return false;
    }
  }, [midiAccess, state.connectedDevices]);

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