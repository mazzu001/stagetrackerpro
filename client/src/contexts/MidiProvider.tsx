import { createContext, useContext, ReactNode } from 'react';
import { useMidiDevices } from '@/hooks/useMidiDevices';

// Define the context type
interface MidiContextType {
  devices: any[];
  connectedDevices: any[];
  isSupported: boolean;
  isInitialized: boolean;
  isInitializing: boolean;
  error: string | null;
  connectDevice: (deviceId: string) => Promise<boolean>;
  connectBleDevice: (deviceId: string) => Promise<boolean>;
  disconnectDevice: (deviceId: string) => Promise<boolean>;
  sendMidiCommand: (command: any, deviceIds?: string[]) => Promise<boolean>;
  parseMidiCommand: (commandString: string) => any;
  refreshDevices: () => Promise<void>;
  shouldUseBleAdapter: (device: { name?: string | null }) => boolean;
  registerMessageListener: (id: string, callback: (message: any) => void) => void;
  unregisterMessageListener: (id: string) => void;
  initializeMidi: () => Promise<void>;
  initializeBluetoothMidi: () => Promise<void>;
}

// Create the context
const MidiContext = createContext<MidiContextType | null>(null);

// Provider component
export function MidiProvider({ children }: { children: ReactNode }) {
  // Single instance of useMidiDevices that will be shared
  const midiDevices = useMidiDevices();
  
  return (
    <MidiContext.Provider value={midiDevices}>
      {children}
    </MidiContext.Provider>
  );
}

// Hook to use the MIDI context
export function useMidi() {
  const context = useContext(MidiContext);
  if (!context) {
    throw new Error('useMidi must be used within a MidiProvider');
  }
  return context;
}