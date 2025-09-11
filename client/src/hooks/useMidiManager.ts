// Simple MIDI Manager - Clean rewrite from scratch
// Never blocks UI for more than 3 seconds, works in background

import { useState, useEffect, useCallback, useRef } from 'react';

// Simple state machine
type MidiState = 'idle' | 'initializing' | 'ready' | 'unsupported' | 'timeout' | 'error';

// Device storage keys
const MIDI_OUTPUTS_KEY = 'midi.outputs';
const MIDI_INPUTS_KEY = 'midi.inputs';

// Simple device info
interface MidiDevice {
  id: string;
  name: string;
  manufacturer: string;
  state: string;
  type: 'input' | 'output';
  connection: string;
}

// In-memory state
let midiAccess: MIDIAccess | null = null;
let connectedOutputs = new Map<string, MIDIOutput>();
let connectedInputs = new Map<string, MIDIInput>();
let generation = 0; // Ignore stale results

export function useMidiManager() {
  const [state, setState] = useState<MidiState>('idle');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [devices, setDevices] = useState<MidiDevice[]>([]);
  const [connectedDevices, setConnectedDevices] = useState<string[]>([]);
  
  const deadlineTimerRef = useRef<NodeJS.Timeout>();
  const currentGeneration = useRef(0);

  // Save connected devices to localStorage
  const saveConnectedDevices = useCallback(() => {
    try {
      const outputIds = Array.from(connectedOutputs.keys());
      const inputIds = Array.from(connectedInputs.keys());
      localStorage.setItem(MIDI_OUTPUTS_KEY, JSON.stringify(outputIds));
      localStorage.setItem(MIDI_INPUTS_KEY, JSON.stringify(inputIds));
    } catch (error) {
      console.warn('Failed to save MIDI devices:', error);
    }
  }, []);

  // Load saved devices from localStorage
  const loadSavedDevices = useCallback((): string[] => {
    try {
      const outputs = JSON.parse(localStorage.getItem(MIDI_OUTPUTS_KEY) || '[]');
      const inputs = JSON.parse(localStorage.getItem(MIDI_INPUTS_KEY) || '[]');
      return [...outputs, ...inputs];
    } catch (error) {
      console.warn('Failed to load saved MIDI devices:', error);
      return [];
    }
  }, []);

  // Convert MIDI ports to device list
  const updateDeviceList = useCallback(() => {
    if (!midiAccess) {
      setDevices([]);
      return;
    }

    const deviceList: MidiDevice[] = [];
    
    // Add outputs
    midiAccess.outputs.forEach((output) => {
      deviceList.push({
        id: output.id,
        name: output.name || 'Unknown Device',
        manufacturer: output.manufacturer || 'Unknown',
        state: output.state,
        type: 'output',
        connection: output.connection
      });
    });

    // Add inputs  
    midiAccess.inputs.forEach((input) => {
      deviceList.push({
        id: input.id,
        name: input.name || 'Unknown Device', 
        manufacturer: input.manufacturer || 'Unknown',
        state: input.state,
        type: 'input',
        connection: input.connection
      });
    });

    setDevices(deviceList);
    setConnectedDevices(Array.from(connectedOutputs.keys()).concat(Array.from(connectedInputs.keys())));
  }, []);

  // Connect to a single device with timeout
  const connectToDevice = useCallback(async (deviceId: string): Promise<boolean> => {
    if (!midiAccess) return false;

    try {
      const output = midiAccess.outputs.get(deviceId);
      const input = midiAccess.inputs.get(deviceId);
      
      if (output) {
        // 500ms timeout per device
        const connectPromise = output.open();
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Device connect timeout')), 500);
        });
        
        await Promise.race([connectPromise, timeoutPromise]);
        connectedOutputs.set(deviceId, output);
        console.log('✅ Connected to output:', output.name);
        saveConnectedDevices();
        updateDeviceList();
        return true;
      }
      
      if (input) {
        const connectPromise = input.open();
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Device connect timeout')), 500);
        });
        
        await Promise.race([connectPromise, timeoutPromise]);
        connectedInputs.set(deviceId, input);
        console.log('✅ Connected to input:', input.name);
        saveConnectedDevices();
        updateDeviceList();
        return true;
      }
      
      return false;
    } catch (error) {
      console.warn('Failed to connect to device:', deviceId, error);
      return false;
    }
  }, [saveConnectedDevices, updateDeviceList]);

  // Disconnect device
  const disconnectDevice = useCallback(async (deviceId: string): Promise<boolean> => {
    try {
      const output = connectedOutputs.get(deviceId);
      const input = connectedInputs.get(deviceId);
      
      if (output) {
        await output.close();
        connectedOutputs.delete(deviceId);
        console.log('❌ Disconnected output:', output.name);
      }
      
      if (input) {
        await input.close();
        connectedInputs.delete(deviceId);
        console.log('❌ Disconnected input:', input.name);
      }
      
      saveConnectedDevices();
      updateDeviceList();
      return true;
    } catch (error) {
      console.warn('Failed to disconnect device:', deviceId, error);
      return false;
    }
  }, [saveConnectedDevices, updateDeviceList]);

  // Auto-reconnect to saved devices
  const autoReconnect = useCallback(async () => {
    const savedDevices = loadSavedDevices();
    if (savedDevices.length === 0) return;

    console.log('🔄 Auto-reconnecting to saved devices:', savedDevices);
    
    // Connect with 2 concurrent connections max
    const concurrency = 2;
    for (let i = 0; i < savedDevices.length; i += concurrency) {
      const batch = savedDevices.slice(i, i + concurrency);
      await Promise.allSettled(batch.map(deviceId => connectToDevice(deviceId)));
    }
  }, [loadSavedDevices, connectToDevice]);

  // Initialize MIDI - NEVER blocks UI longer than 3 seconds
  const initializeMIDI = useCallback((): Promise<boolean> => {
    if (state === 'ready') return Promise.resolve(true);
    if (state === 'initializing') return Promise.resolve(false);

    // Increment generation to ignore stale results
    generation++;
    currentGeneration.current = generation;
    const thisGeneration = generation;

    setState('initializing');
    setIsLoading(true);
    setLoadingMessage('Loading MIDI Services...');

    console.log('🎵 Starting MIDI initialization (generation:', thisGeneration, ')');

    // CRITICAL: Set 3-second deadline timer - UI resolves no matter what
    deadlineTimerRef.current = setTimeout(() => {
      if (currentGeneration.current === thisGeneration) {
        console.log('⏰ MIDI initialization deadline reached (3 seconds)');
        setState('timeout');
        setIsLoading(false);
        setLoadingMessage('MIDI timeout - devices may not be available');
      }
    }, 3000);

    // Start MIDI request in background using setTimeout to avoid blocking
    setTimeout(() => {
      const initializeInBackground = async () => {
        try {
          if (!navigator.requestMIDIAccess) {
            throw new Error('Web MIDI API not supported');
          }

          console.log('🎵 Requesting MIDI access in background...');
          const access = await navigator.requestMIDIAccess({ sysex: false });
          
          // Check if this result is still current
          if (currentGeneration.current === thisGeneration) {
            console.log('✅ MIDI access granted, updating state');
            midiAccess = access;
            
            // Set up device change listener
            access.onstatechange = () => {
              console.log('🔄 MIDI device state changed');
              updateDeviceList();
            };

            setState('ready');
            setIsLoading(false);
            setLoadingMessage('');
            clearTimeout(deadlineTimerRef.current);
            
            updateDeviceList();
            
            // Auto-reconnect to saved devices
            setTimeout(() => autoReconnect(), 100);
          } else {
            console.log('🚫 Ignoring stale MIDI result (generation mismatch)');
          }
        } catch (error) {
          if (currentGeneration.current === thisGeneration) {
            console.error('❌ MIDI initialization failed:', error);
            setState('error');
            setIsLoading(false);
            setLoadingMessage('MIDI not available on this device');
            clearTimeout(deadlineTimerRef.current);
          }
        }
      };

      // Start the async work
      initializeInBackground();
    }, 0);

    // Return false immediately - UI is never blocked
    return Promise.resolve(false);
  }, [state, updateDeviceList, autoReconnect]);

  // Send MIDI command to all connected outputs
  const sendCommand = useCallback((command: string): boolean => {
    try {
      // Simple bracket parser for [[PC:1:1]], [[CC:7:64:1]], [[NOTE:60:127:1]]
      const match = command.match(/\[\[(\w+):(\d+):(\d+)(?::(\d+))?\]\]/);
      if (!match) return false;

      const [, type, value, channel, velocity] = match;
      const ch = parseInt(channel) - 1; // MIDI channels are 0-15
      const val = parseInt(value);
      const vel = velocity ? parseInt(velocity) : 127;

      let message: number[] = [];
      
      if (type === 'PC') {
        message = [0xC0 + ch, val]; // Program Change
      } else if (type === 'CC') {
        message = [0xB0 + ch, val, vel]; // Control Change
      } else if (type === 'NOTE') {
        message = [0x90 + ch, val, vel]; // Note On
      } else {
        return false;
      }

      // Send to all connected outputs
      connectedOutputs.forEach((output) => {
        try {
          output.send(message);
          console.log('🎵 Sent MIDI:', command, 'to', output.name);
        } catch (error) {
          console.warn('Failed to send MIDI to', output.name, error);
        }
      });

      return connectedOutputs.size > 0;
    } catch (error) {
      console.warn('Failed to parse/send MIDI command:', command, error);
      return false;
    }
  }, []);

  // Send command to specific device
  const sendCommandToDevice = useCallback((command: string, deviceId: string): boolean => {
    const output = connectedOutputs.get(deviceId);
    if (!output) return false;

    try {
      const match = command.match(/\[\[(\w+):(\d+):(\d+)(?::(\d+))?\]\]/);
      if (!match) return false;

      const [, type, value, channel, velocity] = match;
      const ch = parseInt(channel) - 1;
      const val = parseInt(value);
      const vel = velocity ? parseInt(velocity) : 127;

      let message: number[] = [];
      
      if (type === 'PC') {
        message = [0xC0 + ch, val];
      } else if (type === 'CC') {
        message = [0xB0 + ch, val, vel];
      } else if (type === 'NOTE') {
        message = [0x90 + ch, val, vel];
      } else {
        return false;
      }

      output.send(message);
      console.log('🎵 Sent MIDI:', command, 'to', output.name);
      return true;
    } catch (error) {
      console.warn('Failed to send MIDI to device:', deviceId, error);
      return false;
    }
  }, []);

  // Connect to multiple devices
  const connectToMultipleDevices = useCallback(async (deviceIds: string[]): Promise<{connected: string[], failed: string[]}> => {
    const connected: string[] = [];
    const failed: string[] = [];

    // Connect with concurrency of 2
    const concurrency = 2;
    for (let i = 0; i < deviceIds.length; i += concurrency) {
      const batch = deviceIds.slice(i, i + concurrency);
      const results = await Promise.allSettled(
        batch.map(deviceId => connectToDevice(deviceId))
      );
      
      results.forEach((result, index) => {
        const deviceId = batch[index];
        if (result.status === 'fulfilled' && result.value) {
          connected.push(deviceId);
        } else {
          failed.push(deviceId);
        }
      });
    }

    return { connected, failed };
  }, [connectToDevice]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (deadlineTimerRef.current) {
        clearTimeout(deadlineTimerRef.current);
      }
    };
  }, []);

  // Return API that matches existing components
  return {
    // State
    isMIDIAvailable: state === 'ready',
    isConnected: connectedOutputs.size > 0 || connectedInputs.size > 0,
    isLoading,
    loadingMessage,
    deviceName: connectedOutputs.size > 0 ? Array.from(connectedOutputs.values())[0].name : '',
    inputDeviceName: connectedInputs.size > 0 ? Array.from(connectedInputs.values())[0].name : '',
    
    // Actions
    initializeMIDI,
    connectToDevice,
    disconnectDevice,
    connectToMultipleDevices,
    sendCommand,
    sendCommandToDevice,
    
    // Device management
    getAvailableOutputs: () => devices.filter(d => d.type === 'output'),
    getAvailableInputs: () => devices.filter(d => d.type === 'input'),
    getConnectedDevices: () => devices.filter(d => connectedDevices.includes(d.id)),
    isDeviceConnected: (deviceId: string) => connectedDevices.includes(deviceId),
    
    // Compatibility
    refreshDevices: initializeMIDI,
    retryMIDIInitialization: initializeMIDI,
  };
}