import { useState, useCallback, useRef, useEffect } from 'react';

interface MIDIDevice {
  id: string;
  name: string;
  type: 'usb' | 'bluetooth';
  send: (data: number[]) => void;
}

export function useMIDISystem() {
  const [devices, setDevices] = useState<MIDIDevice[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const deviceIdCounter = useRef(0);

  // Add console MIDI device by default
  const consoleDevice: MIDIDevice = {
    id: 'console',
    name: 'Console MIDI Output',
    type: 'usb',
    send: (data: number[]) => {
      const hex = data.map(b => b.toString(16).padStart(2, '0')).join(' ');
      console.log(`🎹 MIDI: [${data.join(', ')}] [${hex}]`);
    }
  };

  // Initialize with console device
  useEffect(() => {
    setDevices([consoleDevice]);
  }, []);

  // Scan for Bluetooth MIDI devices
  const scanForBluetoothDevices = useCallback(async (): Promise<string> => {
    if (!(navigator as any).bluetooth) {
      throw new Error('Bluetooth not supported in this browser');
    }

    setIsScanning(true);
    
    try {
      console.log('[MIDI] Requesting Bluetooth device...');
      
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['03b80e5a-ede8-4b33-a751-6ce34ec4c700'] // MIDI service
      });

      console.log('[MIDI] Device selected:', device.name || device.id);

      // Connect to device
      const server = await device.gatt!.connect();
      console.log('[MIDI] Connected to GATT server');

      // Create device object
      const newDevice: MIDIDevice = {
        id: `bluetooth-${deviceIdCounter.current++}`,
        name: device.name || `Bluetooth Device ${deviceIdCounter.current}`,
        type: 'bluetooth',
        send: async (data: number[]) => {
          try {
            // For now, just log Bluetooth commands
            const hex = data.map(b => b.toString(16).padStart(2, '0')).join(' ');
            console.log(`🔵 BLUETOOTH: [${data.join(', ')}] [${hex}] to ${device.name}`);
          } catch (error) {
            console.error('[MIDI] Bluetooth send error:', error);
          }
        }
      };

      // Add to device list
      setDevices(prev => [...prev, newDevice]);
      
      return newDevice.name;
      
    } catch (error: any) {
      console.error('[MIDI] Bluetooth error:', error);
      
      if (error.name === 'NotFoundError') {
        throw new Error('No device selected');
      } else if (error.name === 'SecurityError' || error.name === 'NotAllowedError') {
        throw new Error('Bluetooth permission denied. Please enable Bluetooth access in browser settings.');
      } else if (error.message?.includes('User cancelled')) {
        throw new Error('User cancelled device selection');
      }
      
      throw new Error(`Bluetooth error: ${error.message}`);
    } finally {
      setIsScanning(false);
    }
  }, []);

  // Parse and send MIDI command
  const sendMIDICommand = useCallback((commandStr: string): boolean => {
    // Remove brackets and parse command
    const clean = commandStr.replace(/[\[\]]/g, '').trim().toUpperCase();
    const parts = clean.split(':');
    
    if (parts.length < 2) {
      console.error('[MIDI] Invalid command format:', commandStr);
      return false;
    }

    const type = parts[0];
    const channel = Math.max(1, Math.min(16, parseInt(parts[parts.length - 1]) || 1));
    let data: number[] = [];

    try {
      switch (type) {
        case 'CC': {
          const controller = Math.min(127, parseInt(parts[1]) || 0);
          const value = Math.min(127, parseInt(parts[2]) || 64);
          data = [0xB0 + (channel - 1), controller, value];
          break;
        }
        case 'NOTE': {
          const note = Math.min(127, parseInt(parts[1]) || 60);
          const velocity = Math.min(127, parseInt(parts[2]) || 127);
          data = [0x90 + (channel - 1), note, velocity];
          break;
        }
        case 'NOTEOFF': {
          const note = Math.min(127, parseInt(parts[1]) || 60);
          data = [0x80 + (channel - 1), note, 0];
          break;
        }
        case 'PC': {
          const program = Math.min(127, parseInt(parts[1]) || 0);
          data = [0xC0 + (channel - 1), program];
          break;
        }
        default:
          console.error('[MIDI] Unknown command type:', type);
          return false;
      }

      // Send to all devices
      devices.forEach(device => {
        try {
          device.send(data);
        } catch (error) {
          console.error(`[MIDI] Send error to ${device.name}:`, error);
        }
      });

      console.log(`[MIDI] Sent ${commandStr} to ${devices.length} device(s)`);
      return true;

    } catch (error) {
      console.error('[MIDI] Command error:', error);
      return false;
    }
  }, [devices]);

  return {
    devices,
    isScanning,
    scanForBluetoothDevices,
    sendMIDICommand,
    isConnected: devices.length > 0,
    deviceCount: devices.length
  };
}