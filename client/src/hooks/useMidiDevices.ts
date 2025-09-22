import { useState, useEffect, useCallback, useRef } from 'react';
import { androidBleMidi, BleMidiDevice } from '@/lib/android-ble-midi';

export interface MidiDevice {
  id: string;
  name: string;
  manufacturer: string;
  type: 'input' | 'output';
  connection: 'open' | 'closed' | 'pending';
  state: 'connected' | 'disconnected';
  isUSB: boolean;
  isBluetooth: boolean;
  usesBleAdapter?: boolean; // Flag for Android BLE devices using BLE adapter
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
  isInitializing: boolean;
  error: string | null;
  connectDevice: (deviceId: string) => Promise<boolean>;
  connectBleDevice: (deviceId: string) => Promise<boolean>; // Requires user gesture
  disconnectDevice: (deviceId: string) => Promise<boolean>;
  sendMidiCommand: (command: MidiCommand, deviceIds?: string[]) => boolean;
  parseMidiCommand: (commandString: string) => MidiCommand | null;
  refreshDevices: () => Promise<void>;
  shouldUseBleAdapter: (device: { name?: string | null }) => boolean; // Helper for UI
  registerMessageListener: (id: string, callback: (message: MIDIMessageEvent) => void) => void;
  unregisterMessageListener: (id: string) => void;
  initializeMidi: () => Promise<void>;
}

export function useMidiDevices(): UseMidiDevicesReturn {
  const [devices, setDevices] = useState<MidiDevice[]>([]);
  const [connectedDevices, setConnectedDevices] = useState<MidiDevice[]>([]);
  const [isSupported, setIsSupported] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const midiAccessRef = useRef<MIDIAccess | null>(null);
  const deviceConnectionsRef = useRef<Map<string, MIDIInput | MIDIOutput>>(new Map());
  const bleDevicesRef = useRef<Map<string, BleMidiDevice>>(new Map()); // Track BLE devices
  const messageListenersRef = useRef<Map<string, (message: MIDIMessageEvent) => void>>(new Map());

  // Mobile browser detection for Android MIDI compatibility
  const getBrowserInfo = () => {
    const userAgent = navigator.userAgent;
    return {
      isAndroid: /Android/i.test(userAgent),
      isChrome: /Chrome/i.test(userAgent) && !/Edg|Edge/i.test(userAgent),
      isEdge: /Edg|Edge/i.test(userAgent),
      isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent),
      isAndroidChrome: /Android/i.test(userAgent) && /Chrome/i.test(userAgent) && !/Edg|Edge/i.test(userAgent),
      isAndroidEdge: /Android/i.test(userAgent) && /Edg|Edge/i.test(userAgent),
      isAndroidBrowser: /Android/i.test(userAgent) && (/Chrome/i.test(userAgent) || /Edg|Edge/i.test(userAgent))
    };
  };

  const browserInfo = getBrowserInfo();
  
  // Helper to check if a device should use BLE adapter on Android (for UI use)
  const shouldUseBleAdapter = useCallback((device: { name?: string | null }): boolean => {
    // Only use BLE adapter on Android browsers
    if (!browserInfo.isAndroidBrowser) return false;
    
    // Only use for Bluetooth devices (especially WIDI devices)
    const deviceName = device.name?.toLowerCase() || '';
    const isBluetoothDevice = deviceName.includes('widi') || 
                             deviceName.includes('bluetooth') || 
                             deviceName.includes('ble');
    
    // Check if Web Bluetooth is supported
    const hasWebBluetooth = androidBleMidi.isBluetoothSupported();
    
    const shouldUse = isBluetoothDevice && hasWebBluetooth;
    
    if (shouldUse) {
      console.log(`🔵 Device "${device.name}" will use BLE adapter on Android`);
    }
    
    return shouldUse;
  }, [browserInfo.isAndroidBrowser]);
  
  // Internal version that accepts MIDIPort
  const shouldUseBleAdapterInternal = useCallback((device: MIDIInput | MIDIOutput): boolean => {
    return shouldUseBleAdapter(device);
  }, [shouldUseBleAdapter]);
  
  // Debug browser detection for Android MIDI troubleshooting
  console.log('🔍 Browser detection debug:', {
    userAgent: navigator.userAgent,
    isAndroid: browserInfo.isAndroid,
    isChrome: browserInfo.isChrome,
    isEdge: browserInfo.isEdge,
    isAndroidChrome: browserInfo.isAndroidChrome,
    isAndroidEdge: browserInfo.isAndroidEdge,
    isAndroidBrowser: browserInfo.isAndroidBrowser,
    isMobile: browserInfo.isMobile
  });

  // Refresh device list from MIDI access
  const refreshDeviceList = useCallback(async () => {
    if (!midiAccessRef.current) return;
    
    const access = midiAccessRef.current;
    const deviceList: MidiDevice[] = [];
    const currentDeviceIds = new Set<string>();
    
    // Debug: Log access details
    console.log('🔍 Refreshing devices - access details:', {
      inputs: access.inputs.size,
      outputs: access.outputs.size,
      inputsType: access.inputs.constructor.name,
      outputsType: access.outputs.constructor.name
    });
    
    // If no devices found, provide guidance for permission reset
    if (access.inputs.size === 0 && access.outputs.size === 0) {
      console.log('⚠️ No MIDI devices found yet. Devices will appear when connected.');
    }
    
    // Helper function to detect device type
    const detectDeviceType = (device: MIDIPort): { isUSB: boolean; isBluetooth: boolean } => {
      const name = (device.name || '').toLowerCase();
      const manufacturer = device.manufacturer?.toLowerCase() || '';
      
      // Common Bluetooth MIDI indicators
      const bluetoothIndicators = ['bluetooth', 'bt', 'wireless', 'ble', 'widi'];
      const isBluetooth = bluetoothIndicators.some(indicator => 
        name.includes(indicator) || manufacturer.includes(indicator)
      );
      
      // If not explicitly Bluetooth, assume USB (most common)
      const isUSB = !isBluetooth;
      
      return { isUSB, isBluetooth };
    };
    
    // Process input devices
    const inputsArray = Array.from(access.inputs.values());
    for (const input of inputsArray) {
      const { isUSB, isBluetooth } = detectDeviceType(input);
      currentDeviceIds.add(input.id);
      
      // Check if this device is connected via BLE adapter
      const bleDevice = bleDevicesRef.current.get(input.id);
      const usesBleAdapter = !!bleDevice;
      
      deviceList.push({
        id: input.id,
        name: input.name || 'Unknown Input Device',
        manufacturer: input.manufacturer || 'Unknown',
        type: 'input',
        connection: input.connection as 'open' | 'closed' | 'pending',
        state: input.state as 'connected' | 'disconnected',
        isUSB,
        isBluetooth,
        usesBleAdapter
      });
    }
    
    // Process output devices
    const outputsArray = Array.from(access.outputs.values());
    for (const output of outputsArray) {
      const { isUSB, isBluetooth } = detectDeviceType(output);
      currentDeviceIds.add(output.id);
      
      // Check if this device is connected via BLE adapter
      const bleDevice = bleDevicesRef.current.get(output.id);
      const usesBleAdapter = !!bleDevice;
      
      deviceList.push({
        id: output.id,
        name: output.name || 'Unknown Output Device',
        manufacturer: output.manufacturer || 'Unknown',
        type: 'output',
        connection: output.connection as 'open' | 'closed' | 'pending',
        state: output.state as 'connected' | 'disconnected',
        isUSB,
        isBluetooth,
        usesBleAdapter
      });
    }
    
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
    
    // Update connected devices list - include both Web MIDI and BLE devices
    const connected = deviceList.filter(device => {
      // Device must be physically connected
      if (device.state !== 'connected') return false;
      
      // Check if device is connected via BLE adapter
      const bleDevice = bleDevicesRef.current.get(device.id);
      if (bleDevice) {
        console.log(`🔵 BLE device ${device.name} marked as connected via BLE adapter`);
        return true; // BLE devices are connected if they exist in our BLE map
      }
      
      // Check if we have this device in our Web MIDI connections and it's actually open
      const managedDevice = deviceConnectionsRef.current.get(device.id);
      return managedDevice && device.connection === 'open';
    });
    
    console.log(`🎹 Connected devices: ${connected.length}/${deviceList.length}`, 
      connected.map(d => `${d.name} (${d.type})`));
    setConnectedDevices(connected);
  }, []);

  // Initialize MIDI as a background service on app start
  useEffect(() => {
    // Only run once on mount
    if (!('requestMIDIAccess' in navigator)) {
      setIsSupported(false);
      setError('Web MIDI API not supported in this browser');
      console.error('❌ Web MIDI API not supported');
      return;
    }

    setIsSupported(true);
    console.log('🎹 MIDI API supported - starting background service...');

    // Start MIDI in background (fire and forget)
    const startMidiService = async () => {
      try {
        // Check MIDI permission state if available
        if (navigator.permissions) {
          try {
            const midiPermission = await navigator.permissions.query({ name: 'midi' as any });
            console.log('🔐 MIDI Permission State:', midiPermission.state);
            
            if (midiPermission.state === 'denied') {
              setError('MIDI access denied. Please reset MIDI permissions in your browser settings.');
              console.error('❌ MIDI permission denied');
              return;
            }
          } catch (permErr) {
            // Permission API not available, continue anyway
            console.log('🔍 Permission API not available, continuing...');
          }
        }

        // Request MIDI access with a timeout fallback
        console.log('🎹 Requesting MIDI access (this may take a moment with many devices)...');
        setIsInitializing(true);
        
        // Create a timeout promise that rejects after 10 seconds
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('MIDI access request timed out after 10 seconds')), 10000);
        });
        
        // Race between MIDI access and timeout
        let midiAccess: MIDIAccess;
        try {
          midiAccess = await Promise.race([
            navigator.requestMIDIAccess({ sysex: false }),
            timeoutPromise
          ]);
        } catch (err) {
          console.warn('⚠️ MIDI access timed out or failed - app continues without MIDI');
          setIsInitializing(false);
          setError('MIDI initialization timed out. MIDI features unavailable.');
          return;
        }
        
        console.log('✅ MIDI access granted - background service active');
        midiAccessRef.current = midiAccess;
        
        // Set up continuous device monitoring
        midiAccess.onstatechange = (event: Event) => {
          const midiEvent = event as MIDIConnectionEvent;
          console.log(`🎹 Device change detected:`, midiEvent.port?.name, midiEvent.port?.state);
          
          // Update device list immediately when devices change
          refreshDeviceList();
        };
        
        // Initial device scan
        await refreshDeviceList();
        
        setIsInitialized(true);
        setIsInitializing(false);
        setError(null);
        console.log('✅ MIDI background service fully operational');
        
        // Auto-reconnect to last known device if stored
        const lastDeviceStr = localStorage.getItem('lastMidiDevice');
        if (lastDeviceStr) {
          try {
            const lastDevice = JSON.parse(lastDeviceStr);
            console.log('🎹 Looking for last known device:', lastDevice.name);
            
            // Give devices a moment to appear in the list
            setTimeout(() => {
              const devices = midiAccessRef.current?.inputs;
              if (devices) {
                devices.forEach(device => {
                  if (device.name === lastDevice.name && device.manufacturer === lastDevice.manufacturer) {
                    console.log('🎹 Found last device, auto-connecting:', device.name);
                    connectDevice(device.id);
                  }
                });
              }
            }, 500);
          } catch (e) {
            console.log('Could not auto-reconnect to last device');
          }
        }
        
      } catch (err) {
        let errorMessage = 'Failed to start MIDI service';
        
        if (err instanceof Error) {
          if (err.message.includes('SecurityError') || err.message.includes('NotAllowedError')) {
            errorMessage = 'MIDI access denied. Please allow MIDI permissions and refresh.';
          } else if (err.message.includes('NotSupportedError')) {
            errorMessage = 'MIDI not supported on this device or browser.';
          } else {
            errorMessage = err.message;
          }
        }
        
        setError(errorMessage);
        setIsInitializing(false);
        console.error('❌ MIDI service failed to start:', err);
      }
    };

    // Start the service TRULY without blocking the UI
    // Use setTimeout to defer execution to next tick
    // This ensures the main app loads completely before MIDI initialization
    setTimeout(() => {
      startMidiService().catch(err => {
        console.error('❌ MIDI service failed (non-blocking):', err);
        // App continues working without MIDI - it's an optional feature
      });
    }, 100); // Small delay to ensure app is fully loaded
    
    // No cleanup needed - MIDI service runs for app lifetime
  }, []); // Only run once on mount

  // Manual initialization function (kept for compatibility but not needed anymore)
  const initializeMidi = useCallback(async () => {
    if (isInitialized) {
      console.log('🎹 MIDI already initialized');
      return;
    }
    // Since we auto-initialize now, this is a no-op
    console.log('🎹 MIDI auto-initializes on app start');
  }, [isInitialized]);

  // Connect to a specific device via BLE (requires user gesture)
  const connectBleDevice = useCallback(async (deviceId: string): Promise<boolean> => {
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
      
      console.log(`🔵 Connecting via BLE adapter: ${device.name}`);
      
      // Connect via BLE adapter (user gesture required)
      const bleDevice = await androidBleMidi.connectDevice(device.name || undefined);
      bleDevicesRef.current.set(deviceId, bleDevice);
      
      console.log(`✅ Connected via BLE adapter: ${device.name}`);
      await refreshDeviceList();
      return true;
      
    } catch (error) {
      console.error(`❌ BLE connection failed:`, error);
      throw error; // Re-throw to let UI handle the error
    }
  }, [refreshDeviceList]);

  // Connect to a specific device
  const connectDevice = useCallback(async (deviceId: string): Promise<boolean> => {
    if (!midiAccessRef.current) {
      console.error('❌ MIDI not initialized');
      return false;
    }
    
    try {
      const access = midiAccessRef.current;
      let device: MIDIInput | MIDIOutput | undefined;
      let isInput = false;
      
      // Check if device exists in inputs
      if (access.inputs.has(deviceId)) {
        device = access.inputs.get(deviceId);
        isInput = true;
      } else if (access.outputs.has(deviceId)) {
        device = access.outputs.get(deviceId);
        isInput = false;
      }
      
      if (!device) {
        console.error(`❌ Device ${deviceId} not found`);
        return false;
      }
      
      // Check if device needs BLE adapter on Android
      if (browserInfo.isAndroidBrowser && shouldUseBleAdapterInternal(device)) {
        console.log(`🔵 Device ${device.name} requires BLE adapter on Android - use connectBleDevice() with user gesture`);
        throw new Error('BLE_ADAPTER_REQUIRED');
      }
      
      console.log(`🎹 Connecting to ${device.name} (${device.manufacturer})...`);
      
      // Open the device port
      if (device.connection === 'closed') {
        await device.open();
      }
      
      // Set up message handler for input devices
      if (isInput && device.type === 'input') {
        const inputDevice = device as MIDIInput;
        
        inputDevice.onmidimessage = (event: MIDIMessageEvent) => {
          // Notify all registered listeners
          messageListenersRef.current.forEach(listener => {
            try {
              listener(event);
            } catch (err) {
              console.error('Error in MIDI message listener:', err);
            }
          });
        };
      }
      
      // Store the device connection
      deviceConnectionsRef.current.set(deviceId, device);
      
      // Save as last connected device
      const deviceInfo = {
        name: device.name,
        manufacturer: device.manufacturer,
        id: deviceId
      };
      localStorage.setItem('lastMidiDevice', JSON.stringify(deviceInfo));
      
      console.log(`✅ Connected to ${device.name}`);
      
      // Refresh device list to update UI
      await refreshDeviceList();
      return true;
      
    } catch (error) {
      console.error(`❌ Failed to connect to device ${deviceId}:`, error);
      if (error instanceof Error && error.message === 'BLE_ADAPTER_REQUIRED') {
        throw error; // Re-throw BLE adapter requirement
      }
      return false;
    }
  }, [browserInfo.isAndroidBrowser, shouldUseBleAdapter, refreshDeviceList]);

  // Disconnect from a specific device
  const disconnectDevice = useCallback(async (deviceId: string): Promise<boolean> => {
    try {
      // Check if it's a BLE device
      const bleDevice = bleDevicesRef.current.get(deviceId);
      if (bleDevice) {
        console.log(`🔵 Disconnecting BLE device: ${deviceId}`);
        await androidBleMidi.disconnectDevice(bleDevice.id);
        bleDevicesRef.current.delete(deviceId);
        await refreshDeviceList();
        return true;
      }
      
      const device = deviceConnectionsRef.current.get(deviceId);
      if (!device) {
        console.warn(`⚠️ Device ${deviceId} not in connected devices`);
        return false;
      }
      
      console.log(`🎹 Disconnecting from ${device.name}...`);
      
      // Clear message handler if it's an input device
      if (device.type === 'input') {
        (device as MIDIInput).onmidimessage = null;
      }
      
      // Close the device port
      if (device.connection === 'open') {
        await device.close();
      }
      
      // Remove from connected devices
      deviceConnectionsRef.current.delete(deviceId);
      
      console.log(`✅ Disconnected from ${device.name}`);
      
      // Refresh device list to update UI
      await refreshDeviceList();
      return true;
      
    } catch (error) {
      console.error(`❌ Failed to disconnect from device ${deviceId}:`, error);
      return false;
    }
  }, [refreshDeviceList]);

  // Parse MIDI command from string
  const parseMidiCommand = useCallback((commandString: string): MidiCommand | null => {
    try {
      // Support new bracket format: [[PC:12:1]] or [[CC:7:64:1]] or [[NOTE:60:127:1]]
      const bracketMatch = commandString.match(/\[\[(PC|CC|NOTE|NOTE_ON|NOTE_OFF):(\d+)(?::(\d+))?:(\d+)\]\]/);
      if (bracketMatch) {
        const [, type, value, velocityOrValue2, channel] = bracketMatch;
        
        if (type === 'PC') {
          return {
            type: 'PC',
            value: parseInt(value),
            channel: parseInt(channel)
          };
        } else if (type === 'CC') {
          return {
            type: 'CC',
            value: parseInt(value),
            velocity: parseInt(velocityOrValue2 || '0'),
            channel: parseInt(channel)
          };
        } else if (type === 'NOTE' || type === 'NOTE_ON') {
          return {
            type: 'NOTE_ON',
            value: parseInt(value),
            velocity: parseInt(velocityOrValue2 || '127'),
            channel: parseInt(channel)
          };
        } else if (type === 'NOTE_OFF') {
          return {
            type: 'NOTE_OFF',
            value: parseInt(value),
            velocity: 0,
            channel: parseInt(channel)
          };
        }
      }
      
      // Support legacy hex format for backward compatibility
      const hexMatch = commandString.match(/^([0-9A-Fa-f]{2})\s+([0-9A-Fa-f]{2})(?:\s+([0-9A-Fa-f]{2}))?$/);
      if (hexMatch) {
        const [, status, data1, data2] = hexMatch;
        const statusByte = parseInt(status, 16);
        const messageType = statusByte & 0xF0;
        const channel = (statusByte & 0x0F) + 1;
        
        if (messageType === 0xC0) { // Program Change
          return {
            type: 'PC',
            value: parseInt(data1, 16),
            channel
          };
        } else if (messageType === 0xB0) { // Control Change
          return {
            type: 'CC',
            value: parseInt(data1, 16),
            velocity: parseInt(data2 || '0', 16),
            channel
          };
        } else if (messageType === 0x90) { // Note On
          return {
            type: 'NOTE_ON',
            value: parseInt(data1, 16),
            velocity: parseInt(data2 || '7F', 16),
            channel
          };
        } else if (messageType === 0x80) { // Note Off
          return {
            type: 'NOTE_OFF',
            value: parseInt(data1, 16),
            velocity: 0,
            channel
          };
        }
      }
      
      return null;
    } catch (error) {
      console.error('Failed to parse MIDI command:', error);
      return null;
    }
  }, []);

  // Send MIDI command to specific devices or all connected outputs
  const sendMidiCommand = useCallback((command: MidiCommand, deviceIds?: string[]): boolean => {
    try {
      const targetDeviceIds = deviceIds || Array.from(deviceConnectionsRef.current.keys());
      
      if (targetDeviceIds.length === 0) {
        console.warn('⚠️ No connected devices to send MIDI command to');
        return false;
      }
      
      let message: number[] = [];
      
      if (command.type === 'PC') {
        // Program Change: 0xCn, program
        message = [0xC0 | (command.channel - 1), command.value];
      } else if (command.type === 'CC') {
        // Control Change: 0xBn, controller, value
        message = [0xB0 | (command.channel - 1), command.value, command.velocity || 0];
      } else if (command.type === 'NOTE_ON') {
        // Note On: 0x9n, note, velocity
        message = [0x90 | (command.channel - 1), command.value, command.velocity || 127];
      } else if (command.type === 'NOTE_OFF') {
        // Note Off: 0x8n, note, velocity
        message = [0x80 | (command.channel - 1), command.value, 0];
      }
      
      console.log(`🎹 Sending MIDI ${command.type} to ${targetDeviceIds.length} device(s):`, message);
      
      let sentCount = 0;
      targetDeviceIds.forEach(deviceId => {
        const device = deviceConnectionsRef.current.get(deviceId);
        if (device && device.type === 'output' && device.connection === 'open') {
          (device as MIDIOutput).send(message);
          sentCount++;
          console.log(`✅ Sent to ${device.name}`);
        }
      });
      
      return sentCount > 0;
    } catch (error) {
      console.error('Failed to send MIDI command:', error);
      return false;
    }
  }, []);

  // Register a message listener
  const registerMessageListener = useCallback((id: string, callback: (message: MIDIMessageEvent) => void) => {
    messageListenersRef.current.set(id, callback);
    console.log(`📝 Registered MIDI message listener: ${id}`);
  }, []);

  // Unregister a message listener
  const unregisterMessageListener = useCallback((id: string) => {
    messageListenersRef.current.delete(id);
    console.log(`🗑️ Unregistered MIDI message listener: ${id}`);
  }, []);

  // Manual refresh (kept for UI refresh button)
  const refreshDevices = useCallback(async () => {
    await refreshDeviceList();
  }, [refreshDeviceList]);

  return {
    devices,
    connectedDevices,
    isSupported,
    isInitialized,
    isInitializing,
    error,
    connectDevice,
    connectBleDevice,
    disconnectDevice,
    sendMidiCommand,
    parseMidiCommand,
    refreshDevices,
    shouldUseBleAdapter,
    registerMessageListener,
    unregisterMessageListener,
    initializeMidi
  };
}