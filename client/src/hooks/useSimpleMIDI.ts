// Non-blocking MIDI hook using helper window
import { useState, useEffect, useCallback } from 'react';
import { midiBroker, type MidiBrokerState } from '@/lib/MidiBroker';

export function useSimpleMIDI() {
  const [state, setState] = useState<MidiBrokerState>({
    isLoading: false,
    devices: [],
    connectedDevices: [],
    errorMessage: '',
    isHelperReady: false
  });

  // Subscribe to broker state changes
  useEffect(() => {
    const unsubscribe = midiBroker.subscribe(setState);
    return unsubscribe;
  }, []);

  // Refresh devices (non-blocking with 3-second UI timeout)
  const refreshDevices = useCallback(async () => {
    console.log('🎵 useSimpleMIDI: Starting device refresh...');
    await midiBroker.refreshDevices();
  }, []);

  // Connect device
  const connectDevice = useCallback((deviceId: string) => {
    midiBroker.connectDevice(deviceId);
  }, []);

  // Disconnect device
  const disconnectDevice = useCallback((deviceId: string) => {
    midiBroker.disconnectDevice(deviceId);
  }, []);

  // Send MIDI command
  const sendCommand = useCallback(async (command: string): Promise<boolean> => {
    return await midiBroker.sendCommand(command);
  }, []);

  return {
    isLoading: state.isLoading,
    devices: state.devices,
    connectedDevices: state.connectedDevices,
    errorMessage: state.errorMessage,
    isHelperReady: state.isHelperReady,
    refreshDevices,
    connectDevice,
    disconnectDevice,
    sendCommand,
  };
}