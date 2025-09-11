// Ultra-Simple MIDI with non-blocking timeout
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

  // Permission-gated, non-blocking device refresh
  const refreshDevices = useCallback(async () => {
    // Prevent concurrent scans
    if (isScanningRef.current) {
      console.log('🎵 MIDI scan already in progress, ignoring click');
      return;
    }

    console.log('🎵 Starting MIDI device scan...');
    isScanningRef.current = true;
    setState(prev => ({ ...prev, isLoading: true, errorMessage: '' }));

    try {
      // Check MIDI support first
      if (!navigator?.requestMIDIAccess) {
        throw new Error('MIDI not supported in this browser');
      }

      // Check permissions to avoid hanging calls
      try {
        const permissionStatus = await navigator.permissions.query({ name: 'midi' as any });
        if (permissionStatus.state === 'denied') {
          throw new Error('MIDI permission denied - enable in browser settings');
        }
      } catch (permError) {
        console.log('🎵 Permission check failed, proceeding anyway:', permError);
      }

      // Yield the main thread first so UI can update
      await new Promise(resolve => setTimeout(resolve, 0));
      console.log('🎵 UI yielded, starting MIDI access request...');

      // Set up external watchdog timeout using MessageChannel
      const channel = new MessageChannel();
      let watchdogCompleted = false;
      let midiCompleted = false;

      // External timeout mechanism
      const timeoutPromise = new Promise<'timeout'>((resolve) => {
        setTimeout(() => {
          if (!watchdogCompleted) {
            watchdogCompleted = true;
            console.log('🎵 MIDI scan timeout reached (3 seconds)');
            resolve('timeout');
          }
        }, 3000);
      });

      // MIDI access request
      const midiPromise = navigator.requestMIDIAccess({ sysex: false }).then((access) => {
        if (!midiCompleted) {
          midiCompleted = true;
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
          
          return { type: 'success' as const, devices: deviceList };
        }
        return { type: 'ignored' as const };
      }).catch((error) => {
        if (!midiCompleted) {
          midiCompleted = true;
          console.error('🎵 MIDI access failed:', error);
          return { type: 'error' as const, error };
        }
        return { type: 'ignored' as const };
      });

      // Race between timeout and MIDI - timeout wins if MIDI hangs
      const result = await Promise.race([timeoutPromise, midiPromise]);

      // Handle the result
      if (result === 'timeout') {
        watchdogCompleted = true;
        setState(prev => ({
          ...prev,
          isLoading: false,
          errorMessage: 'MIDI scan timeout - devices may take longer to appear',
          devices: []
        }));
      } else if (result.type === 'success') {
        watchdogCompleted = true;
        setState(prev => ({
          ...prev,
          isLoading: false,
          devices: result.devices,
          errorMessage: result.devices.length === 0 ? 'No MIDI devices found - check connections' : ''
        }));
      } else if (result.type === 'error') {
        watchdogCompleted = true;
        setState(prev => ({
          ...prev,
          isLoading: false,
          errorMessage: 'MIDI not available - check browser permissions',
          devices: []
        }));
      }
      // 'ignored' results are discarded

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