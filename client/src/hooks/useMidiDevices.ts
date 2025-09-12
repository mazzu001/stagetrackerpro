import { useState, useEffect, useCallback, useRef } from 'react';

export interface MidiDevice {
  id: string;
  name: string;
  manufacturer: string;
  type: 'input' | 'output';
  connection: 'open' | 'closed' | 'pending';
  state: 'connected' | 'disconnected';
  isUSB: boolean;
  isBluetooth: boolean;
}

export interface MidiCommand {
  type: 'PC' | 'CC' | 'NOTE_ON' | 'NOTE_OFF';
  value: number;
  channel: number;
  velocity?: number; // For note commands
}

export interface UseMidiDevicesReturn {
  devices: MidiDevice[];
  connectedDevices: MidiDevice[];
  isSupported: boolean;
  isInitialized: boolean;
  error: string | null;
  connectDevice: (deviceId: string) => Promise<boolean>;
  disconnectDevice: (deviceId: string) => Promise<boolean>;
  sendMidiCommand: (command: MidiCommand, deviceIds?: string[]) => boolean;
  parseMidiCommand: (commandString: string) => MidiCommand | null;
  refreshDevices: () => Promise<void>;
}

export function useMidiDevices(): UseMidiDevicesReturn {
  const [devices, setDevices] = useState<MidiDevice[]>([]);
  const [connectedDevices, setConnectedDevices] = useState<MidiDevice[]>([]);
  const [isSupported, setIsSupported] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const midiAccessRef = useRef<MIDIAccess | null>(null);
  const deviceConnectionsRef = useRef<Map<string, MIDIInput | MIDIOutput>>(new Map());

  // Mobile browser detection for Android MIDI compatibility
  const getBrowserInfo = () => {
    const userAgent = navigator.userAgent;
    return {
      isAndroid: /Android/i.test(userAgent),
      isChrome: /Chrome/i.test(userAgent) && !/Edg|Edge/i.test(userAgent),
      isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent),
      isAndroidChrome: /Android/i.test(userAgent) && /Chrome/i.test(userAgent) && !/Edg|Edge/i.test(userAgent)
    };
  };

  const browserInfo = getBrowserInfo();

  // Check if Web MIDI API is supported
  useEffect(() => {
    const checkSupport = () => {
      if ('requestMIDIAccess' in navigator) {
        setIsSupported(true);
        initializeMidi();
      } else {
        setIsSupported(false);
        setError('Web MIDI API not supported in this browser');
      }
    };

    checkSupport();
  }, []);

  // Initialize MIDI access
  const initializeMidi = useCallback(async () => {
    try {
      setError(null);
      console.log('🎹 Initializing MIDI access...');
      
      // Android Chrome browser detection and compatibility logging
      if (browserInfo.isAndroidChrome) {
        console.log('📱 Android Chrome detected - using mobile MIDI compatibility mode');
      } else if (browserInfo.isAndroid) {
        console.log('📱 Android device detected - using mobile compatibility mode');
      }
      
      const access = await navigator.requestMIDIAccess({ sysex: false });
      midiAccessRef.current = access;
      
      // Listen for device state changes
      access.onstatechange = (event: Event) => {
        const midiEvent = event as MIDIConnectionEvent;
        console.log(`🎹 MIDI device state change:`, midiEvent.port?.name, midiEvent.port?.state, midiEvent.port?.connection);
        refreshDeviceList();
      };
      
      await refreshDeviceList();
      setIsInitialized(true);
      console.log('✅ MIDI system initialized successfully');
      
    } catch (err) {
      let errorMessage = 'Failed to initialize MIDI';
      
      if (err instanceof Error) {
        if (err.message.includes('SecurityError') || err.message.includes('NotAllowedError')) {
          errorMessage = 'MIDI access denied. Please allow MIDI permissions and refresh the page.';
        } else if (err.message.includes('NotSupportedError')) {
          errorMessage = 'MIDI not supported on this device or browser.';
        } else {
          errorMessage = err.message;
        }
      }
      
      setError(errorMessage);
      console.error('❌ MIDI initialization failed:', err);
    }
  }, []);

  // Refresh device list from MIDI access
  const refreshDeviceList = useCallback(async () => {
    if (!midiAccessRef.current) return;
    
    const access = midiAccessRef.current;
    const deviceList: MidiDevice[] = [];
    const currentDeviceIds = new Set<string>();
    
    // Helper function to detect device type
    const detectDeviceType = (device: MIDIPort): { isUSB: boolean; isBluetooth: boolean } => {
      const name = (device.name || '').toLowerCase();
      const manufacturer = device.manufacturer?.toLowerCase() || '';
      
      // Common Bluetooth MIDI indicators
      const bluetoothIndicators = ['bluetooth', 'bt', 'wireless', 'ble'];
      const isBluetooth = bluetoothIndicators.some(indicator => 
        name.includes(indicator) || manufacturer.includes(indicator)
      );
      
      // If not explicitly Bluetooth, assume USB (most common)
      const isUSB = !isBluetooth;
      
      return { isUSB, isBluetooth };
    };
    
    // Process input devices
    access.inputs.forEach((input: MIDIInput) => {
      const { isUSB, isBluetooth } = detectDeviceType(input);
      currentDeviceIds.add(input.id);
      
      deviceList.push({
        id: input.id,
        name: input.name || 'Unknown Input Device',
        manufacturer: input.manufacturer || 'Unknown',
        type: 'input',
        connection: input.connection as 'open' | 'closed' | 'pending',
        state: input.state as 'connected' | 'disconnected',
        isUSB,
        isBluetooth
      });
    });
    
    // Process output devices
    access.outputs.forEach((output: MIDIOutput) => {
      const { isUSB, isBluetooth } = detectDeviceType(output);
      currentDeviceIds.add(output.id);
      
      deviceList.push({
        id: output.id,
        name: output.name || 'Unknown Output Device',
        manufacturer: output.manufacturer || 'Unknown',
        type: 'output',
        connection: output.connection as 'open' | 'closed' | 'pending',
        state: output.state as 'connected' | 'disconnected',
        isUSB,
        isBluetooth
      });
    });
    
    // Clean up stale device connections (devices no longer available)
    const staleDeviceIds: string[] = [];
    deviceConnectionsRef.current.forEach((device, deviceId) => {
      if (!currentDeviceIds.has(deviceId)) {
        console.warn(`🧹 Cleaning up stale MIDI device connection: ${device.name || deviceId}`);
        staleDeviceIds.push(deviceId);
      }
    });
    
    // Remove stale connections
    staleDeviceIds.forEach(deviceId => {
      const device = deviceConnectionsRef.current.get(deviceId);
      if (device) {
        try {
          // Clear any message handlers
          if (device.type === 'input') {
            (device as MIDIInput).onmidimessage = null;
          }
          // Note: Don't call close() here as the device might already be gone
        } catch (err) {
          console.warn(`⚠️ Error cleaning up stale device: ${err}`);
        }
      }
      deviceConnectionsRef.current.delete(deviceId);
    });
    
    console.log(`🎹 Found ${deviceList.length} MIDI devices:`, deviceList);
    setDevices(deviceList);
    
    // Update connected devices list - more robust logic
    const connected = deviceList.filter(device => {
      // Device must be physically connected
      if (device.state !== 'connected') return false;
      
      // Check if we have this device in our connections and it's actually open
      const managedDevice = deviceConnectionsRef.current.get(device.id);
      return managedDevice && device.connection === 'open';
    });
    
    console.log(`🎹 Connected devices: ${connected.length}/${deviceList.length}`, 
      connected.map(d => `${d.name} (${d.type})`));
    setConnectedDevices(connected);
  }, []);

  // Connect to a specific device
  const connectDevice = useCallback(async (deviceId: string): Promise<boolean> => {
    if (!midiAccessRef.current) {
      console.error('❌ MIDI not initialized');
      return false;
    }
    
    try {
      const access = midiAccessRef.current;
      let device: MIDIInput | MIDIOutput | undefined;
      
      // Try to find device in inputs first, then outputs
      device = access.inputs.get(deviceId) || access.outputs.get(deviceId);
      
      if (!device) {
        console.error(`❌ Device ${deviceId} not found`);
        return false;
      }
      
      // Check if already connected
      if (deviceConnectionsRef.current.has(deviceId) && device.connection === 'open') {
        console.log(`⚠️ Device ${device.name} already connected`);
        return true;
      }
      
      // Open the device connection with timeout
      if (device.connection !== 'open') {
        console.log(`🔌 Opening MIDI device: ${device.name}`);
        
        await new Promise<void>((resolve, reject) => {
          let resolved = false;
          
          // Set up timeout with Android compatibility
          const timeoutMs = browserInfo.isAndroidChrome ? 12000 : browserInfo.isMobile ? 8000 : 5000;
          const timeout = setTimeout(() => {
            if (!resolved) {
              resolved = true;
              device!.onstatechange = null;
              reject(new Error(`Connection timeout after ${timeoutMs/1000} seconds`));
            }
          }, timeoutMs);
          
          // Set up state change handler
          const originalHandler = device!.onstatechange;
          device!.onstatechange = (event: MIDIConnectionEvent) => {
            if (resolved) return;
            
            if (event.port?.connection === 'open') {
              resolved = true;
              clearTimeout(timeout);
              device!.onstatechange = originalHandler;
              resolve();
            } else if (event.port?.connection === 'closed' && event.port?.state === 'disconnected') {
              resolved = true;
              clearTimeout(timeout);
              device!.onstatechange = originalHandler;
              reject(new Error('Device disconnected during connection'));
            }
          };
          
          // Actually open the device
          try {
            device!.open();
          } catch (openErr) {
            resolved = true;
            clearTimeout(timeout);
            device!.onstatechange = originalHandler;
            reject(openErr);
          }
        });
      }
      
      // Set up message handler for inputs
      if (device.type === 'input') {
        (device as MIDIInput).onmidimessage = (message: MIDIMessageEvent) => {
          console.log(`🎹 MIDI message from ${device.name}:`, message.data ? Array.from(message.data) : []);
        };
      }
      
      deviceConnectionsRef.current.set(deviceId, device);
      await refreshDeviceList();
      
      // Android Chrome fix: Add delay to ensure connection is fully established
      if (browserInfo.isAndroidChrome) {
        console.log(`📱 Android Chrome: Adding 2-second stabilization delay for ${device.name}`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        console.log(`📱 Android Chrome: Connection stabilization complete for ${device.name}`);
      }
      
      console.log(`✅ Connected to MIDI device: ${device.name}`);
      return true;
      
    } catch (err) {
      console.error(`❌ Failed to connect to device ${deviceId}:`, err);
      return false;
    }
  }, [refreshDeviceList]);

  // Disconnect from a specific device
  const disconnectDevice = useCallback(async (deviceId: string): Promise<boolean> => {
    try {
      const device = deviceConnectionsRef.current.get(deviceId);
      if (!device) {
        console.log(`⚠️ Device ${deviceId} not in connections map`);
        return false;
      }
      
      console.log(`🔌 Closing MIDI device: ${device.name}`);
      
      // Clear message handlers for inputs before closing
      if (device.type === 'input') {
        (device as MIDIInput).onmidimessage = null;
      }
      
      // Actually close the device with timeout handling
      if (device.connection === 'open') {
        await new Promise<void>((resolve, reject) => {
          let resolved = false;
          
          // Set up timeout
          const timeout = setTimeout(() => {
            if (!resolved) {
              resolved = true;
              device.onstatechange = null;
              console.warn(`⚠️ Close timeout for device: ${device.name}`);
              resolve(); // Don't fail on timeout, just warn
            }
          }, 3000);
          
          // Set up state change handler
          const originalHandler = device.onstatechange;
          device.onstatechange = (event: MIDIConnectionEvent) => {
            if (resolved) return;
            
            if (event.port?.connection === 'closed') {
              resolved = true;
              clearTimeout(timeout);
              device.onstatechange = originalHandler;
              resolve();
            }
          };
          
          // Actually close the device
          try {
            device.close();
          } catch (closeErr) {
            resolved = true;
            clearTimeout(timeout);
            device.onstatechange = originalHandler;
            console.warn(`⚠️ Error closing device: ${closeErr}`);
            resolve(); // Don't fail on close error, just warn
          }
        });
      }
      
      // Remove from connections map
      deviceConnectionsRef.current.delete(deviceId);
      await refreshDeviceList();
      
      console.log(`✅ Disconnected from MIDI device: ${device.name}`);
      return true;
      
    } catch (err) {
      console.error(`❌ Failed to disconnect from device ${deviceId}:`, err);
      return false;
    }
  }, [refreshDeviceList]);

  // Parse MIDI command string in format [[PC:2:1]], [[CC:7:127:1]], or [[NOTE:60:1]] (NOTE defaults to NOTE_ON with velocity 127)
  const parseMidiCommand = useCallback((commandString: string): MidiCommand | null => {
    // Remove outer brackets and trim
    const cleaned = commandString.replace(/^\[\[|\]\]$/g, '').trim();
    const parts = cleaned.split(':');
    
    if (parts.length < 3) {
      console.error('❌ Invalid MIDI command format. Expected: [[TYPE:VALUE:CHANNEL]] or [[TYPE:VALUE:VELOCITY:CHANNEL]]');
      return null;
    }
    
    // Handle NOTE alias for NOTE_ON with default velocity
    let type = parts[0].toUpperCase();
    if (type === 'NOTE') {
      type = 'NOTE_ON';
    }
    
    const midiType = type as 'PC' | 'CC' | 'NOTE_ON' | 'NOTE_OFF';
    const value = parseInt(parts[1]);
    
    let channel: number;
    let velocity: number | undefined;
    
    if (parts.length === 3) {
      // Format: [[PC:2:1]], [[CC:7:1]], or [[NOTE:60:1]]
      channel = parseInt(parts[2]);
      
      // For NOTE alias, default velocity to 127
      if (parts[0].toUpperCase() === 'NOTE') {
        velocity = 127;
      }
    } else if (parts.length === 4) {
      // Format: [[CC:7:127:1]] or [[NOTE_ON:60:127:1]]
      velocity = parseInt(parts[2]);
      channel = parseInt(parts[3]);
    } else {
      console.error('❌ Invalid MIDI command format');
      return null;
    }
    
    // Validate channel
    if (isNaN(channel) || channel < 1 || channel > 16) {
      console.error('❌ Invalid MIDI channel. Must be 1-16, got:', channel);
      return null;
    }
    
    // Validate main value range based on command type
    if (isNaN(value)) {
      console.error('❌ Invalid MIDI value - not a number:', parts[1]);
      return null;
    }
    
    switch (midiType) {
      case 'PC': // Program Change: 0-127
        if (value < 0 || value > 127) {
          console.error('❌ Program Change value must be 0-127, got:', value);
          return null;
        }
        break;
        
      case 'CC': // Control Change: controller 0-127
        if (value < 0 || value > 127) {
          console.error('❌ Control Change controller must be 0-127, got:', value);
          return null;
        }
        break;
        
      case 'NOTE_ON':
      case 'NOTE_OFF': // Note number: 0-127
        if (value < 0 || value > 127) {
          console.error('❌ Note number must be 0-127, got:', value);
          return null;
        }
        break;
        
      default:
        console.error('❌ Unsupported MIDI command type:', type);
        return null;
    }
    
    // Validate velocity if provided
    if (velocity !== undefined && (isNaN(velocity) || velocity < 0 || velocity > 127)) {
      console.error('❌ MIDI velocity must be 0-127, got:', velocity);
      return null;
    }
    
    return { type: midiType, value, channel, velocity };
  }, []);

  // Send MIDI command to connected devices
  const sendMidiCommand = useCallback((command: MidiCommand, deviceIds?: string[]): boolean => {
    if (!midiAccessRef.current) {
      console.error('❌ MIDI not initialized');
      return false;
    }
    
    const targetDevices = deviceIds || Array.from(deviceConnectionsRef.current.keys());
    let success = false;
    
    targetDevices.forEach(deviceId => {
      const device = deviceConnectionsRef.current.get(deviceId);
      if (!device || device.type !== 'output') return;
      
      const output = device as MIDIOutput;
      const channel = command.channel - 1; // MIDI channels are 0-based internally
      
      try {
        let midiData: number[];
        
        switch (command.type) {
          case 'PC': // Program Change
            midiData = [0xC0 + channel, command.value];
            break;
            
          case 'CC': // Control Change
            const ccValue = command.velocity !== undefined ? command.velocity : 127;
            midiData = [0xB0 + channel, command.value, ccValue];
            break;
            
          case 'NOTE_ON':
            const noteOnVel = command.velocity || 127;
            midiData = [0x90 + channel, command.value, noteOnVel];
            break;
            
          case 'NOTE_OFF':
            const noteOffVel = command.velocity || 0;
            midiData = [0x80 + channel, command.value, noteOffVel];
            break;
            
          default:
            console.error('❌ Unsupported MIDI command type:', command.type);
            return;
        }
        
        // Android Chrome debugging - add extra logging and validation
        if (browserInfo.isAndroidChrome) {
          console.log(`📱 Android Chrome MIDI Debug:`, {
            deviceName: device.name,
            deviceId: device.id,
            deviceConnection: device.connection,
            deviceState: device.state,
            commandType: command.type,
            midiData: midiData,
            timestamp: Date.now()
          });
        }
        
        output.send(midiData);
        console.log(`🎹 Sent ${command.type} command to ${device.name}:`, midiData);
        
        // Android Chrome - add confirmation logging with delay
        if (browserInfo.isAndroidChrome) {
          setTimeout(() => {
            console.log(`📱 Android Chrome: Confirmed command sent to ${device.name} after 100ms delay`);
          }, 100);
        }
        
        success = true;
        
      } catch (err) {
        console.error(`❌ Failed to send MIDI command to ${device.name}:`, err);
      }
    });
    
    return success;
  }, []);

  // Public refresh function
  const refreshDevices = useCallback(async () => {
    await refreshDeviceList();
  }, [refreshDeviceList]);

  return {
    devices,
    connectedDevices,
    isSupported,
    isInitialized,
    error,
    connectDevice,
    disconnectDevice,
    sendMidiCommand,
    parseMidiCommand,
    refreshDevices
  };
}