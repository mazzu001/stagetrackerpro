/**
 * BLE-MIDI Adapter
 * 
 * Provides Web Bluetooth-based MIDI transmission for all platforms
 * to handle BLE MIDI devices that don't appear in Web MIDI API.
 * 
 * Implements BLE-MIDI specification for direct characteristic writes.
 */

/// <reference types="web-bluetooth" />

// BLE-MIDI Service and Characteristic UUIDs
const BLE_MIDI_SERVICE_UUID = '03b80e5a-ede8-4b33-a751-6ce34ec4c700';
const BLE_MIDI_CHARACTERISTIC_UUID = '7772e5db-3868-4112-a1a9-f2669d106bf3';

export interface BleMidiDevice {
  device: BluetoothDevice;
  server: BluetoothRemoteGATTServer;
  service: BluetoothRemoteGATTService;
  characteristic: BluetoothRemoteGATTCharacteristic;
  name: string;
  id: string;
}

export class BleMidiAdapter {
  private connectedDevices = new Map<string, BleMidiDevice>();
  private isSupported = false;

  constructor() {
    // Check if Web Bluetooth is supported
    this.isSupported = typeof navigator !== 'undefined' && 
                      'bluetooth' in navigator && 
                      typeof navigator.bluetooth.requestDevice === 'function';
    
    if (this.isSupported) {
      console.log('🔵 BLE-MIDI adapter initialized');
    } else {
      console.log('❌ Web Bluetooth not supported - BLE-MIDI fallback unavailable');
    }
  }

  /**
   * Check if Web Bluetooth is supported in this browser
   */
  isBluetoothSupported(): boolean {
    return this.isSupported;
  }

  /**
   * Connect to a BLE MIDI device
   */
  async connectDevice(deviceName?: string): Promise<BleMidiDevice> {
    if (!this.isSupported) {
      throw new Error('Web Bluetooth not supported');
    }

    try {
      console.log('🔵 Requesting BLE MIDI device connection...');
      
      // Use a single broad request that shows ALL Bluetooth devices
      // This ensures all devices appear regardless of their name format
      console.log('🔵 Showing all Bluetooth devices - please select your MIDI device from the list...');
      
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,  // Show ALL Bluetooth devices
        optionalServices: [BLE_MIDI_SERVICE_UUID]  // We'll try to connect to MIDI service if available
      });
      
      console.log(`✅ User selected device: ${device.name || 'Unknown'}`);

      if (!device.gatt) {
        throw new Error('Device does not support GATT');
      }

      console.log(`🔵 Connecting to BLE device: ${device.name || 'Unknown'}`);
      
      // Connect to GATT server
      const server = await device.gatt.connect();
      console.log('🔵 GATT server connected');

      // Get BLE-MIDI service
      const service = await server.getPrimaryService(BLE_MIDI_SERVICE_UUID);
      console.log('🔵 BLE-MIDI service found');

      // Get BLE-MIDI characteristic
      const characteristic = await service.getCharacteristic(BLE_MIDI_CHARACTERISTIC_UUID);
      console.log('🔵 BLE-MIDI characteristic found');

      const bleMidiDevice: BleMidiDevice = {
        device,
        server,
        service,
        characteristic,
        name: device.name || 'Unknown BLE MIDI Device',
        id: device.id || `ble-${Date.now()}`
      };

      // Store the connected device
      this.connectedDevices.set(bleMidiDevice.id, bleMidiDevice);
      
      // Listen for disconnection
      device.addEventListener('gattserverdisconnected', () => {
        console.log(`🔵 BLE device disconnected: ${bleMidiDevice.name}`);
        this.connectedDevices.delete(bleMidiDevice.id);
      });

      console.log(`✅ BLE-MIDI device connected: ${bleMidiDevice.name}`);
      return bleMidiDevice;

    } catch (error) {
      const bleError = error as DOMException;
      console.error('❌ BLE-MIDI connection failed:', {
        name: bleError.name,
        message: bleError.message,
        code: bleError.code,
        stack: bleError.stack
      });
      
      // Provide user-friendly error messages
      if (bleError.name === 'NotAllowedError') {
        throw new Error('Permission denied. Please allow Bluetooth access and try again.');
      } else if (bleError.name === 'NotFoundError') {
        throw new Error('No compatible BLE MIDI devices found. Make sure your device is powered on and in pairing mode.');
      } else if (bleError.name === 'SecurityError') {
        // Check if we're in an iframe (Replit editor)
        if (window.self !== window.top) {
          throw new Error('⚠️ Bluetooth is blocked in iframe. Click the "Open in new tab" button (↗) at the top-right of the preview to use Bluetooth.');
        } else {
          throw new Error('BLE access requires a secure connection (HTTPS). Please use HTTPS.');
        }
      } else {
        throw new Error(`BLE connection failed: ${bleError.message || 'Unknown error'}`);
      }
    }
  }

  /**
   * Send MIDI command to BLE device using direct characteristic write
   */
  async sendMidiCommand(deviceId: string, midiData: number[]): Promise<boolean> {
    const device = this.connectedDevices.get(deviceId);
    if (!device) {
      console.error(`❌ BLE device not found: ${deviceId}`);
      return false;
    }

    if (!device.server.connected) {
      console.error(`❌ BLE device ${device.name} is not connected`);
      return false;
    }

    try {
      // Create BLE-MIDI packet with timestamp header
      const packet = this.createBleMidiPacket(midiData);
      
      // Check if packet exceeds typical BLE MTU
      if (packet.length > 20) {
        console.warn(`⚠️ Large BLE-MIDI packet (${packet.length} bytes) may fail on some devices`);
      }
      
      console.log(`🔵 Sending BLE-MIDI packet to ${device.name}:`, {
        packet: Array.from(packet),
        midiData,
        packetSize: packet.length
      });
      
      // Prefer writeValueWithoutResponse for lower latency when supported
      const characteristic = device.characteristic;
      const properties = characteristic.properties;
      
      if (properties.writeWithoutResponse) {
        await characteristic.writeValueWithoutResponse(packet);
        console.log(`🔵 Sent via writeValueWithoutResponse (low latency)`);
      } else if (properties.write) {
        await characteristic.writeValueWithResponse(packet);
        console.log(`🔵 Sent via writeValueWithResponse (with ACK)`);
      } else {
        // Fallback to legacy writeValue method
        await characteristic.writeValue(packet);
        console.log(`🔵 Sent via legacy writeValue method`);
      }
      
      console.log(`✅ BLE-MIDI command sent to ${device.name}:`, midiData);
      return true;

    } catch (error) {
      console.error(`❌ Failed to send BLE-MIDI command to ${device.name}:`, {
        error: error instanceof Error ? error.message : String(error),
        midiData,
        deviceConnected: device.server.connected
      });
      return false;
    }
  }

  /**
   * Create BLE-MIDI packet from MIDI data
   * Format: [timestamp_header, midi_data...]
   */
  private createBleMidiPacket(midiData: number[]): Uint8Array {
    // BLE-MIDI timestamp header (simplified - using immediate mode)
    // Bit 7 = 1 (header), bits 6-0 = timestamp (using current time & 0x7F)
    const timestamp = (Date.now() & 0x7F) | 0x80;
    
    // Create packet: [timestamp_header, ...midi_data]
    const packet = new Uint8Array(1 + midiData.length);
    packet[0] = timestamp;
    
    for (let i = 0; i < midiData.length; i++) {
      packet[i + 1] = midiData[i];
    }
    
    return packet;
  }

  /**
   * Get connected BLE MIDI devices
   */
  getConnectedDevices(): BleMidiDevice[] {
    return Array.from(this.connectedDevices.values());
  }

  /**
   * Disconnect a specific BLE device
   */
  async disconnectDevice(deviceId: string): Promise<boolean> {
    const device = this.connectedDevices.get(deviceId);
    if (!device) {
      return false;
    }

    try {
      if (device.server.connected) {
        device.server.disconnect();
      }
      this.connectedDevices.delete(deviceId);
      console.log(`🔵 Disconnected BLE device: ${device.name}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to disconnect BLE device: ${device.name}`, error);
      return false;
    }
  }

  /**
   * Disconnect all BLE devices
   */
  async disconnectAllDevices(): Promise<void> {
    const deviceIds = Array.from(this.connectedDevices.keys());
    await Promise.all(deviceIds.map(id => this.disconnectDevice(id)));
  }

  /**
   * Check if a device is connected via BLE
   */
  isDeviceConnected(deviceId: string): boolean {
    const device = this.connectedDevices.get(deviceId);
    return device ? device.server.connected : false;
  }
}

// Export singleton instance
export const bleMidiAdapter = new BleMidiAdapter();

// Legacy export for compatibility  
export const androidBleMidi = bleMidiAdapter;