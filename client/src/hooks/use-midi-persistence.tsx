interface SavedMidiDevice {
  id: string;
  name: string;
  manufacturer: string;
  lastConnected: number;
}

export function useMidiPersistence() {
  // Save connected device to localStorage
  const saveConnectedDevice = (device: MIDIInput) => {
    try {
      const savedDevices = getSavedDevices();
      const deviceInfo: SavedMidiDevice = {
        id: device.id,
        name: device.name || 'Unknown Device',
        manufacturer: device.manufacturer || 'Unknown',
        lastConnected: Date.now()
      };

      // Remove duplicates and add new device
      const filtered = savedDevices.filter(d => d.id !== device.id);
      filtered.unshift(deviceInfo); // Add to beginning (most recent first)

      // Keep only last 5 devices
      const toSave = filtered.slice(0, 5);
      
      localStorage.setItem('midi_devices', JSON.stringify(toSave));
      console.log('✅ Saved MIDI device:', deviceInfo.name);
    } catch (error) {
      console.error('Failed to save MIDI device:', error);
    }
  };

  // Get saved devices from localStorage
  const getSavedDevices = (): SavedMidiDevice[] => {
    try {
      const saved = localStorage.getItem('midi_devices');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  };

  // Remove a device from saved list
  const removeSavedDevice = (deviceId: string) => {
    try {
      const savedDevices = getSavedDevices();
      const filtered = savedDevices.filter(d => d.id !== deviceId);
      localStorage.setItem('midi_devices', JSON.stringify(filtered));
    } catch (error) {
      console.error('Failed to remove MIDI device:', error);
    }
  };

  // Attempt to reconnect to previously connected devices (SILENT)
  // Runs on EVERY app launch (no session tracking - we want it to work after close/reopen)
  const attemptReconnection = async (
    onDeviceConnected: (device: MIDIInput) => void
  ): Promise<void> => {
    const savedDevices = getSavedDevices();
    if (savedDevices.length === 0) {
      console.log('📱 No saved MIDI devices to reconnect');
      return;
    }

    console.log(`🎹 Attempting silent reconnection of ${savedDevices.length} MIDI device(s)...`);

    try {
      // Request MIDI access silently (non-blocking)
      const midiAccess = await navigator.requestMIDIAccess({ sysex: false });
      
      let reconnectedCount = 0;
      const availableInputs = Array.from(midiAccess.inputs.values());

      // Try to reconnect each saved device
      for (const savedDevice of savedDevices) {
        const matchingDevice = availableInputs.find(
          input => input.id === savedDevice.id || input.name === savedDevice.name
        );

        if (matchingDevice) {
          // Device found - reconnect silently
          onDeviceConnected(matchingDevice);
          reconnectedCount++;
          console.log(`✅ Silently reconnected: ${matchingDevice.name}`);
        } else {
          console.log(`⚠️ Device not available: ${savedDevice.name}`);
          // Don't remove - device might be temporarily unplugged
        }
      }

      // Log results (console only, no UI notifications)
      if (reconnectedCount > 0) {
        console.log(`🎹 Successfully reconnected ${reconnectedCount} MIDI device(s)`);
      } else {
        console.log(`📱 No previously connected MIDI devices available`);
      }
    } catch (error) {
      // Fail completely silently - only log to console
      console.log('📱 MIDI reconnection skipped (browser permission or device unavailable)');
    }
  };

  return {
    saveConnectedDevice,
    getSavedDevices,
    removeSavedDevice,
    attemptReconnection
  };
}
