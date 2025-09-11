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

  // Real device refresh with guaranteed 3-second timeout - ONLY when user clicks refresh
  const refreshDevices = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, errorMessage: '' }));
    
    let timeoutId: NodeJS.Timeout | undefined;
    let completed = false;
    
    // Guaranteed 3-second timeout - app will never hang longer than this
    const timeoutPromise = new Promise<void>((resolve) => {
      timeoutId = setTimeout(() => {
        if (!completed) {
          completed = true;
          setState(prev => ({ 
            ...prev, 
            isLoading: false, 
            errorMessage: 'MIDI scan timeout - try again or check device connections',
            devices: []
          }));
          resolve();
        }
      }, 3000);
    });
    
    // Real MIDI device scan
    const midiPromise = (async () => {
      try {
        if (!navigator?.requestMIDIAccess) {
          throw new Error('MIDI not supported in this browser');
        }
        
        const access = await navigator.requestMIDIAccess({ sysex: false });
        
        if (!completed) {
          completed = true;
          if (timeoutId) clearTimeout(timeoutId);
          
          // Store MIDI access for sending commands
          setMidiAccess(access);
          
          const deviceList: SimpleMIDIDevice[] = [];
          // Use Array.from for more reliable device discovery
          Array.from(access.outputs.values()).forEach((output) => {
            deviceList.push({
              id: output.id,
              name: output.name || 'Unknown MIDI Device'
            });
          });
          
          // Add state change listener for dynamic device updates
          access.onstatechange = (event: any) => {
            console.log('🎵 MIDI device state changed:', event.port?.name, event.port?.state);
            // Re-scan devices when state changes
            if (!completed) {
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
            }
          };
          
          setState(prev => ({ 
            ...prev, 
            isLoading: false,
            devices: deviceList,
            errorMessage: deviceList.length === 0 ? 'No MIDI devices found - check connections' : ''
          }));
        }
      } catch (error) {
        if (!completed) {
          completed = true;
          if (timeoutId) clearTimeout(timeoutId);
          setState(prev => ({ 
            ...prev, 
            isLoading: false,
            errorMessage: 'MIDI not available - check browser permissions',
            devices: []
          }));
        }
      }
    })();
    
    // Race between timeout and MIDI scan - whichever completes first wins
    await Promise.race([timeoutPromise, midiPromise]);
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

  // Store MIDI access for sending commands
  const [midiAccess, setMidiAccess] = useState<any>(null);

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