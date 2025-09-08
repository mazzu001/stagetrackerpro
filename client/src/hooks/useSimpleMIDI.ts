import { useState, useCallback, useRef } from 'react';

interface MIDIDevice {
  id: string;
  name: string;
  manufacturer: string;
  state: 'connected' | 'disconnected';
}

interface SimpleMessage {
  timestamp: number;
  command: string;
  direction: 'in' | 'out';
}

export function useSimpleMIDI() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [connectedDevice, setConnectedDevice] = useState<MIDIDevice | null>(null);
  const [availableDevices, setAvailableDevices] = useState<MIDIDevice[]>([]);
  const [messages, setMessages] = useState<SimpleMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const midiAccessRef = useRef<MIDIAccess | null>(null);
  const connectedOutputRef = useRef<MIDIOutput | null>(null);
  const connectedInputRef = useRef<MIDIInput | null>(null);

  // Initialize MIDI API
  const initialize = useCallback(async (): Promise<boolean> => {
    if (!navigator.requestMIDIAccess) {
      console.log('Web MIDI API not supported');
      return false;
    }

    setIsLoading(true);
    try {
      console.log('🎵 Requesting MIDI access with permissions...');
      
      // Request MIDI access with sysex permissions for broader device support
      const access = await navigator.requestMIDIAccess({ sysex: true });
      midiAccessRef.current = access;
      setIsInitialized(true);
      
      // Set up state change listener
      access.onstatechange = (event) => {
        console.log('🔄 MIDI device state changed:', event.port?.name, event.port?.state);
        loadDevices(); // Reload devices when state changes
      };
      
      // Load available devices
      loadDevices();
      
      console.log('✅ MIDI access granted successfully');
      return true;
    } catch (error) {
      console.error('❌ MIDI access denied or failed:', error);
      console.log('💡 Try clicking "Refresh" to request MIDI permissions again');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load available MIDI devices
  const loadDevices = useCallback(() => {
    const access = midiAccessRef.current;
    if (!access) {
      console.log('❌ No MIDI access - call initialize() first');
      return;
    }

    const devices: MIDIDevice[] = [];
    
    console.log('🔍 Scanning for MIDI devices...');
    console.log(`📊 MIDI Access Status: inputs=${access.inputs.size}, outputs=${access.outputs.size}`);
    
    // Add output devices with detailed logging
    access.outputs.forEach((output) => {
      console.log(`🎯 Found output device: "${output.name}" (${output.manufacturer}) - ${output.state}`);
      devices.push({
        id: output.id,
        name: output.name || 'Unknown Device',
        manufacturer: output.manufacturer || 'Unknown',
        state: output.state
      });
    });

    // Also check input devices for completeness
    access.inputs.forEach((input) => {
      console.log(`🎯 Found input device: "${input.name}" (${input.manufacturer}) - ${input.state}`);
    });

    setAvailableDevices(devices);
    console.log(`🔍 Found ${devices.length} MIDI output devices total`);
    
    if (devices.length === 0) {
      console.log('💡 No MIDI devices found. Make sure your MIDI device is:');
      console.log('   1. Connected via USB or Bluetooth');  
      console.log('   2. Powered on and recognized by your system');
      console.log('   3. Not being used by another application');
    }
  }, []);

  // Connect to a single MIDI device
  const connect = useCallback(async (deviceId: string): Promise<boolean> => {
    const access = midiAccessRef.current;
    if (!access) {
      console.error('MIDI not initialized');
      return false;
    }

    // Disconnect existing device first
    if (connectedOutputRef.current) {
      await disconnect();
    }

    const output = access.outputs.get(deviceId);
    if (!output) {
      console.error('Device not found:', deviceId);
      return false;
    }

    try {
      await output.open();
      connectedOutputRef.current = output;
      
      const deviceInfo: MIDIDevice = {
        id: output.id,
        name: output.name || 'Unknown Device',
        manufacturer: output.manufacturer || 'Unknown',
        state: output.state
      };
      
      setConnectedDevice(deviceInfo);
      console.log('✅ Connected to:', deviceInfo.name);
      return true;
    } catch (error) {
      console.error('❌ Connection failed:', error);
      return false;
    }
  }, []);

  // Disconnect from current device
  const disconnect = useCallback(async (): Promise<boolean> => {
    try {
      if (connectedOutputRef.current) {
        await connectedOutputRef.current.close();
        connectedOutputRef.current = null;
      }
      if (connectedInputRef.current) {
        connectedInputRef.current.onmidimessage = null;
        await connectedInputRef.current.close();
        connectedInputRef.current = null;
      }
      
      setConnectedDevice(null);
      console.log('✅ Disconnected');
      return true;
    } catch (error) {
      console.error('❌ Disconnect failed:', error);
      return false;
    }
  }, []);

  // Parse MIDI command in bracket format
  const parseMIDICommand = useCallback((command: string): Uint8Array | null => {
    const trimmed = command.trim();
    
    // Handle bracket format: [[PC:12:1]], [[CC:7:64:1]], [[NOTE:60:127:1]]
    const bracketMatch = trimmed.match(/\[\[([^\]]+)\]\]/);
    if (!bracketMatch) {
      console.error('Invalid MIDI command format. Use: [[TYPE:VALUE:CHANNEL]]');
      return null;
    }

    const parts = bracketMatch[1].split(':');
    if (parts.length < 2) {
      console.error('Invalid command format');
      return null;
    }

    const type = parts[0].toUpperCase();
    
    try {
      if (type === 'PC' && parts.length >= 3) {
        // Program Change: [[PC:program:channel]]
        const program = parseInt(parts[1]);
        const channel = parseInt(parts[2]) - 1; // Convert to 0-based
        if (program >= 0 && program <= 127 && channel >= 0 && channel <= 15) {
          return new Uint8Array([0xC0 | channel, program]);
        }
      } else if (type === 'CC' && parts.length >= 4) {
        // Control Change: [[CC:controller:value:channel]]
        const controller = parseInt(parts[1]);
        const value = parseInt(parts[2]);
        const channel = parseInt(parts[3]) - 1; // Convert to 0-based
        if (controller >= 0 && controller <= 127 && value >= 0 && value <= 127 && channel >= 0 && channel <= 15) {
          return new Uint8Array([0xB0 | channel, controller, value]);
        }
      } else if (type === 'NOTE' && parts.length >= 4) {
        // Note On: [[NOTE:note:velocity:channel]]
        const note = parseInt(parts[1]);
        const velocity = parseInt(parts[2]);
        const channel = parseInt(parts[3]) - 1; // Convert to 0-based
        if (note >= 0 && note <= 127 && velocity >= 0 && velocity <= 127 && channel >= 0 && channel <= 15) {
          return new Uint8Array([0x90 | channel, note, velocity]);
        }
      }
    } catch (error) {
      console.error('Error parsing MIDI command:', error);
    }
    
    return null;
  }, []);

  // Send MIDI command
  const sendCommand = useCallback(async (command: string): Promise<boolean> => {
    const output = connectedOutputRef.current;
    if (!output) {
      console.error('No MIDI device connected');
      return false;
    }

    const midiBytes = parseMIDICommand(command);
    if (!midiBytes) {
      return false;
    }

    try {
      output.send(midiBytes);
      
      // Add to message log
      const message: SimpleMessage = {
        timestamp: Date.now(),
        command,
        direction: 'out'
      };
      setMessages(prev => [message, ...prev.slice(0, 49)]); // Keep last 50 messages
      
      console.log('🎵 Sent MIDI:', command);
      return true;
    } catch (error) {
      console.error('❌ Failed to send MIDI:', error);
      return false;
    }
  }, [parseMIDICommand]);

  // Refresh device list and re-request permissions if needed
  const refresh = useCallback(async () => {
    console.log('🔄 Refreshing MIDI devices...');
    
    // Always re-initialize to handle permission changes
    setIsInitialized(false);
    midiAccessRef.current = null;
    
    const success = await initialize();
    if (!success) {
      console.log('💡 MIDI refresh failed - this might be a permissions issue');
      console.log('🔐 Some browsers require you to click a button to grant MIDI access');
    }
  }, [initialize, loadDevices]);

  return {
    // State
    isInitialized,
    isLoading,
    connectedDevice,
    availableDevices,
    messages,
    
    // Actions
    initialize,
    connect,
    disconnect,
    sendCommand,
    refresh
  };
}