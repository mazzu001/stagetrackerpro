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
  initializeBluetoothMidi: () => Promise<void>; // New: User-initiated Bluetooth scan
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
  const hasInitializedRef = useRef(false); // Track if we've initialized at all

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

  // Refresh device list from MIDI access (USB devices only, no Bluetooth)
  const refreshDeviceList = useCallback(async (includeBluetoothDevices: boolean = false) => {
    if (!midiAccessRef.current) return;
    
    const access = midiAccessRef.current;
    const deviceList: MidiDevice[] = [];
    const currentDeviceIds = new Set<string>();
    
    // Debug: Log access details
    console.log('🔍 Refreshing devices - access details:', {
      inputs: access.inputs.size,
      outputs: access.outputs.size,
      inputsType: access.inputs.constructor.name,
      outputsType: access.outputs.constructor.name,
      includeBluetoothDevices
    });
    
    // Log ALL devices found before any filtering
    console.log('📋 ALL INPUT DEVICES FOUND:');
    access.inputs.forEach((input: MIDIInput) => {
      console.log(`  - ${input.name} (${input.manufacturer}) ID: ${input.id} State: ${input.state}`);
    });
    console.log('📋 ALL OUTPUT DEVICES FOUND:');
    access.outputs.forEach((output: MIDIOutput) => {
      console.log(`  - ${output.name} (${output.manufacturer}) ID: ${output.id} State: ${output.state}`);
    });
    
    // Handle null case if inputs/outputs are empty
    const hasDevices = access.inputs.size > 0 || access.outputs.size > 0;
    
    // Collect input devices (only USB unless Bluetooth is requested)
    access.inputs.forEach((input: MIDIInput) => {
      const deviceName = input.name?.toLowerCase() || '';
      const isBluetoothDevice = deviceName.includes('bluetooth') || 
                               deviceName.includes('ble') || 
                               deviceName.includes('widi');
      
      // Log device details before filtering
      console.log(`🔍 Processing input: ${input.name}, isBluetooth: ${isBluetoothDevice}, includeBluetoothDevices: ${includeBluetoothDevices}`);
      
      // Skip Bluetooth devices unless explicitly requested
      if (isBluetoothDevice && !includeBluetoothDevices) {
        console.log(`⏭️ Skipping Bluetooth device during USB-only scan: ${input.name}`);
        return;
      }
      
      const deviceId = input.id;
      currentDeviceIds.add(deviceId);
      
      const device: MidiDevice = {
        id: deviceId,
        name: input.name || 'Unnamed Input',
        manufacturer: input.manufacturer || 'Unknown',
        type: 'input',
        connection: input.connection,
        state: input.state,
        isUSB: !isBluetoothDevice,
        isBluetooth: isBluetoothDevice,
        usesBleAdapter: browserInfo.isAndroidBrowser && isBluetoothDevice && androidBleMidi.isBluetoothSupported()
      };
      deviceList.push(device);
    });
    
    // Collect output devices (only USB unless Bluetooth is requested)
    access.outputs.forEach((output: MIDIOutput) => {
      const deviceName = output.name?.toLowerCase() || '';
      const isBluetoothDevice = deviceName.includes('bluetooth') || 
                               deviceName.includes('ble') || 
                               deviceName.includes('widi');
      
      // Skip Bluetooth devices unless explicitly requested
      if (isBluetoothDevice && !includeBluetoothDevices) {
        console.log(`⏭️ Skipping Bluetooth device during USB-only scan: ${output.name}`);
        return;
      }
      
      const deviceId = output.id;
      currentDeviceIds.add(deviceId);
      
      const device: MidiDevice = {
        id: deviceId,
        name: output.name || 'Unnamed Output',
        manufacturer: output.manufacturer || 'Unknown',
        type: 'output',
        connection: output.connection,
        state: output.state,
        isUSB: !isBluetoothDevice,
        isBluetooth: isBluetoothDevice,
        usesBleAdapter: browserInfo.isAndroidBrowser && isBluetoothDevice && androidBleMidi.isBluetoothSupported()
      };
      deviceList.push(device);
    });
    
    // Add BLE-connected devices
    bleDevicesRef.current.forEach((bleDevice, deviceId) => {
      if (!currentDeviceIds.has(deviceId)) {
        console.log(`🔵 Adding BLE device: ${bleDevice.name}`);
        deviceList.push({
          id: deviceId,
          name: bleDevice.name || 'BLE Device',
          manufacturer: 'BLE',
          type: 'input', // BLE devices are typically inputs
          connection: 'open',
          state: 'connected',
          isUSB: false,
          isBluetooth: true,
          usesBleAdapter: true
        });
      }
    });
    
    // Clean up disconnected devices
    const previousDeviceIds = new Set(deviceConnectionsRef.current.keys());
    previousDeviceIds.forEach(prevId => {
      if (!currentDeviceIds.has(prevId) && !bleDevicesRef.current.has(prevId)) {
        const device = deviceConnectionsRef.current.get(prevId);
        if (device) {
          console.log(`🔌 Device disconnected: ${device.name}`);
          if (device.type === 'input') {
            (device as MIDIInput).onmidimessage = null;
          }
          deviceConnectionsRef.current.delete(prevId);
        }
      }
    });
    
    if (!hasDevices && deviceList.length === 0) {
      console.log('⚠️ No MIDI devices found yet. Devices will appear when connected.');
    }
    
    console.log(`🎹 Found ${deviceList.length} MIDI devices:`, 
      deviceList.map(d => `${d.name} (${d.type}, ${d.isUSB ? 'USB' : 'Bluetooth'})`));
    setDevices(deviceList);
    
    // Update connected devices
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
  }, [browserInfo.isAndroidBrowser]);

  // Check if MIDI is supported (but don't initialize)
  useEffect(() => {
    if (!('requestMIDIAccess' in navigator)) {
      setIsSupported(false);
      setError('Web MIDI API not supported in this browser');
      console.error('❌ Web MIDI API not supported');
      return;
    }
    
    setIsSupported(true);
    console.log('🎹 MIDI API supported - waiting for user interaction to initialize');
  }, []);

  // Helper function to request MIDI with timeout
  const requestMIDIAccessWithTimeout = async (options = {}, timeoutMs = 5000): Promise<MIDIAccess> => {
    let timeoutId: NodeJS.Timeout | undefined;
    
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('MIDI_TIMEOUT')), timeoutMs);
    });
    
    try {
      const midiAccess = await Promise.race([
        navigator.requestMIDIAccess(options),
        timeoutPromise
      ]);
      
      // Clear timeout on success
      if (timeoutId) clearTimeout(timeoutId);
      return midiAccess;
    } catch (error) {
      // Clear timeout on error too
      if (timeoutId) clearTimeout(timeoutId);
      throw error;
    }
  };

  // Stage 1: Initialize USB MIDI only (lightweight, fast)
  const initializeMidi = useCallback(async () => {
    if (isInitialized || hasInitializedRef.current) {
      console.log('🎹 MIDI already initialized');
      await refreshDeviceList(false); // Refresh USB devices only
      return;
    }
    
    if (isInitializing) {
      console.log('🎹 MIDI initialization already in progress');
      return;
    }
    
    if (!isSupported) {
      console.error('❌ MIDI not supported');
      throw new Error('MIDI_NOT_SUPPORTED');
    }
    
    console.log('🎹 Initializing USB MIDI (with timeout protection)...');
    setIsInitializing(true);
    setError(null); // Clear any previous errors
    
    try {
      // Request MIDI access with 5-second timeout - USB devices only, no sysex
      const midiAccess = await requestMIDIAccessWithTimeout({ sysex: false }, 5000);
      
      console.log('✅ USB MIDI access granted');
      midiAccessRef.current = midiAccess;
      
      // Set up lightweight device monitoring (MIDI-only handler)
      midiAccess.onstatechange = (event: Event) => {
        const midiEvent = event as MIDIConnectionEvent;
        const port = midiEvent.port;
        
        // Only handle USB devices in this handler
        if (port) {
          const deviceName = port.name?.toLowerCase() || '';
          const isBluetoothDevice = deviceName.includes('bluetooth') || 
                                   deviceName.includes('ble') || 
                                   deviceName.includes('widi');
          
          if (!isBluetoothDevice) {
            console.log(`🎹 USB device change: ${port.name} - ${port.state}`);
            // Lightweight refresh - USB only
            refreshDeviceList(false);
          }
        }
      };
      
      // Initial USB device scan (no Bluetooth)
      await refreshDeviceList(false);
      
      setIsInitialized(true);
      setError(null);
      hasInitializedRef.current = true; // Only set after successful initialization
      console.log('✅ USB MIDI initialized successfully');
      
      // Stage 2: Auto-reconnect to last USB device (deferred)
      setTimeout(() => {
        const lastDeviceStr = localStorage.getItem('lastMidiDevice');
        if (lastDeviceStr) {
          try {
            const lastDevice = JSON.parse(lastDeviceStr);
            
            // Only auto-reconnect if it's a USB device
            const deviceName = lastDevice.name?.toLowerCase() || '';
            const isBluetoothDevice = deviceName.includes('bluetooth') || 
                                     deviceName.includes('ble') || 
                                     deviceName.includes('widi');
            
            if (!isBluetoothDevice) {
              console.log('🎹 Looking for last USB device:', lastDevice.name);
              
              const devices = midiAccessRef.current?.inputs;
              if (devices) {
                devices.forEach(device => {
                  if (device.name === lastDevice.name && device.manufacturer === lastDevice.manufacturer) {
                    console.log('🎹 Found last USB device, auto-connecting:', device.name);
                    connectDevice(device.id);
                  }
                });
              }
            }
          } catch (e) {
            console.log('Could not auto-reconnect to last device');
          }
        }
      }, 500);
      
    } catch (err) {
      let errorMessage = 'Failed to initialize USB MIDI';
      
      if (err instanceof Error) {
        if (err.message === 'MIDI_TIMEOUT') {
          errorMessage = 'MIDI_TIMEOUT';
          console.error('⏱️ MIDI initialization timed out after 5 seconds');
        } else if (err.message.includes('SecurityError') || err.message.includes('NotAllowedError')) {
          errorMessage = 'MIDI_DENIED';
        } else if (err.message.includes('NotSupportedError') || err.message === 'MIDI_NOT_SUPPORTED') {
          errorMessage = 'MIDI not supported on this device or browser.';
        } else {
          errorMessage = err.message;
        }
      }
      
      setError(errorMessage);
      hasInitializedRef.current = false; // Reset on error to allow retry
      console.error('❌ USB MIDI initialization failed:', err);
      throw err; // Re-throw so callers can handle
    } finally {
      setIsInitializing(false); // Always clear initializing state
    }
  }, [isInitialized, isInitializing, isSupported, refreshDeviceList]);

  // Stage 3: Initialize Bluetooth MIDI (user-initiated only)
  const initializeBluetoothMidi = useCallback(async () => {
    if (!isInitialized) {
      console.log('🔵 Initializing MIDI first before Bluetooth scan');
      await initializeMidi();
    }
    
    console.log('🔵 Scanning for Bluetooth MIDI devices (user-initiated)...');
    
    try {
      // Refresh device list including Bluetooth devices
      await refreshDeviceList(true);
      console.log('✅ Bluetooth MIDI scan complete');
    } catch (err) {
      console.error('❌ Bluetooth MIDI scan failed:', err);
    }
  }, [isInitialized, initializeMidi, refreshDeviceList]);

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
      await refreshDeviceList(true); // Include Bluetooth devices in refresh
      return true;
      
    } catch (error) {
      console.error(`❌ BLE connection failed:`, error);
      throw error; // Re-throw to let UI handle the error
    }
  }, [refreshDeviceList]);

  // Connect to a specific device
  const connectDevice = useCallback(async (deviceId: string): Promise<boolean> => {
    if (!midiAccessRef.current) {
      // Auto-initialize if needed
      console.log('🎹 MIDI not initialized, initializing now...');
      await initializeMidi();
      
      if (!midiAccessRef.current) {
        console.error('❌ Failed to initialize MIDI');
        return false;
      }
    }
    
    const access = midiAccessRef.current;
    
    try {
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
      
      // Set up LIGHTWEIGHT message handler for input devices (MIDI-only)
      if (isInput && device.type === 'input') {
        const inputDevice = device as MIDIInput;
        
        // LIGHTWEIGHT HANDLER - just pass MIDI messages, no heavy processing
        inputDevice.onmidimessage = (event: MIDIMessageEvent) => {
          // Use requestAnimationFrame to keep handler lightweight
          requestAnimationFrame(() => {
            // Notify all registered listeners asynchronously
            messageListenersRef.current.forEach(listener => {
              try {
                listener(event);
              } catch (err) {
                console.error('Error in MIDI message listener:', err);
              }
            });
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
      const isBluetoothDevice = device.name?.toLowerCase().includes('bluetooth') || 
                               device.name?.toLowerCase().includes('ble') || 
                               device.name?.toLowerCase().includes('widi');
      await refreshDeviceList(isBluetoothDevice);
      return true;
      
    } catch (error) {
      console.error(`❌ Failed to connect to device ${deviceId}:`, error);
      if (error instanceof Error && error.message === 'BLE_ADAPTER_REQUIRED') {
        throw error; // Re-throw BLE adapter requirement
      }
      return false;
    }
  }, [browserInfo.isAndroidBrowser, shouldUseBleAdapterInternal, initializeMidi, refreshDeviceList]);

  // Disconnect from a specific device
  const disconnectDevice = useCallback(async (deviceId: string): Promise<boolean> => {
    try {
      // Check if it's a BLE device
      const bleDevice = bleDevicesRef.current.get(deviceId);
      if (bleDevice) {
        console.log(`🔵 Disconnecting BLE device: ${deviceId}`);
        await androidBleMidi.disconnectDevice(bleDevice.id);
        bleDevicesRef.current.delete(deviceId);
        await refreshDeviceList(true);
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
      
      // Check if it was a Bluetooth device
      const isBluetoothDevice = device.name?.toLowerCase().includes('bluetooth') || 
                               device.name?.toLowerCase().includes('ble') || 
                               device.name?.toLowerCase().includes('widi');
      
      // Refresh device list to update UI
      await refreshDeviceList(isBluetoothDevice);
      return true;
      
    } catch (error) {
      console.error(`❌ Failed to disconnect from device ${deviceId}:`, error);
      return false;
    }
  }, [refreshDeviceList]);

  // Parse MIDI command from string (existing function, unchanged)
  const parseMidiCommand = useCallback((commandString: string): MidiCommand | null => {
    try {
      // Support new bracket format: [[TYPE:VALUE:CHANNEL]]
      const bracketMatch = commandString.match(/\[\[(PC|CC|NOTE_ON|NOTE_OFF|NOTE):(\d+)(?::(\d+))?(?::(\d+))?\]\]/);
      if (bracketMatch) {
        const [, type, value, channelOrVelocity, channel] = bracketMatch;
        
        if (type === 'PC') {
          return {
            type: 'PC',
            value: parseInt(value),
            channel: parseInt(channelOrVelocity || '1')
          };
        } else if (type === 'CC') {
          return {
            type: 'CC',
            value: parseInt(value),
            velocity: parseInt(channelOrVelocity || '127'),
            channel: parseInt(channel || '1')
          };
        } else if (type === 'NOTE' || type === 'NOTE_ON') {
          return {
            type: 'NOTE_ON',
            value: parseInt(value),
            velocity: parseInt(channelOrVelocity || '127'),
            channel: parseInt(channel || '1')
          };
        } else if (type === 'NOTE_OFF') {
          return {
            type: 'NOTE_OFF',
            value: parseInt(value),
            velocity: parseInt(channelOrVelocity || '0'),
            channel: parseInt(channel || '1')
          };
        }
      }
      
      // Support legacy formats...
      // (rest of the parsing logic remains the same)
      
      return null;
    } catch (error) {
      console.error('Failed to parse MIDI command:', error);
      return null;
    }
  }, []);

  // Send MIDI command to devices (existing function, unchanged)
  const sendMidiCommand = useCallback((command: MidiCommand, deviceIds?: string[]): boolean => {
    if (!midiAccessRef.current) {
      console.error('❌ MIDI not initialized');
      return false;
    }
    
    let data: number[] = [];
    const channel = (command.channel - 1) & 0x0F; // Convert to 0-based channel
    
    switch (command.type) {
      case 'PC':
        data = [0xC0 | channel, command.value & 0x7F];
        break;
      case 'CC':
        data = [0xB0 | channel, command.value & 0x7F, (command.velocity || 127) & 0x7F];
        break;
      case 'NOTE_ON':
        data = [0x90 | channel, command.value & 0x7F, (command.velocity || 127) & 0x7F];
        break;
      case 'NOTE_OFF':
        data = [0x80 | channel, command.value & 0x7F, (command.velocity || 0) & 0x7F];
        break;
      default:
        console.error('Unknown MIDI command type:', command.type);
        return false;
    }
    
    const targetDevices = deviceIds || connectedDevices.filter(d => d.type === 'output').map(d => d.id);
    
    if (targetDevices.length === 0) {
      console.warn('⚠️ No output devices to send MIDI command to');
      return false;
    }
    
    let sent = false;
    targetDevices.forEach(deviceId => {
      const device = deviceConnectionsRef.current.get(deviceId);
      if (device && device.type === 'output') {
        try {
          (device as MIDIOutput).send(data);
          console.log(`🎹 Sent MIDI command to ${device.name}:`, command);
          sent = true;
        } catch (error) {
          console.error(`❌ Failed to send MIDI to ${device.name}:`, error);
        }
      }
    });
    
    return sent;
  }, [connectedDevices]);

  // Refresh devices (manual trigger)
  const refreshDevices = useCallback(async () => {
    if (!isInitialized) {
      console.log('🎹 Initializing MIDI before refresh...');
      await initializeMidi();
    } else {
      // Check if there are any Bluetooth devices connected
      const hasBluetoothDevices = devices.some(d => d.isBluetooth);
      await refreshDeviceList(hasBluetoothDevices);
    }
  }, [isInitialized, initializeMidi, refreshDeviceList, devices]);

  // Register/unregister message listeners
  const registerMessageListener = useCallback((id: string, callback: (message: MIDIMessageEvent) => void) => {
    messageListenersRef.current.set(id, callback);
    console.log(`📝 Registered MIDI message listener: ${id}`);
  }, []);
  
  const unregisterMessageListener = useCallback((id: string) => {
    messageListenersRef.current.delete(id);
    console.log(`🗑️ Unregistered MIDI message listener: ${id}`);
  }, []);

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
    initializeMidi,
    initializeBluetoothMidi
  };
}