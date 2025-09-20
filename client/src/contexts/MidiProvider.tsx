import { createContext, useContext, ReactNode } from 'react';

// Define the context type
interface MidiContextType {
  devices: any[];
  connectedDevices: any[];
  isSupported: boolean;
  isInitialized: boolean;
  error: string | null;
  connectDevice: (deviceId: string) => Promise<boolean>;
  disconnectDevice: (deviceId: string) => Promise<boolean>;
  sendMidiCommand: (command: any) => Promise<boolean>;
  parseMidiCommand: (commandString: string) => any;
  refreshDevices: () => Promise<void>;
  registerMessageListener: (id: string, callback: (message: any) => void) => void;
  unregisterMessageListener: (id: string) => void;
}

// Create stub MIDI implementation to prevent startup errors
const stubMidiImplementation: MidiContextType = {
  devices: [],
  connectedDevices: [],
  isSupported: false,
  isInitialized: false,
  error: null,
  connectDevice: async () => false,
  disconnectDevice: async () => false,
  sendMidiCommand: async () => false,
  parseMidiCommand: () => null,
  refreshDevices: async () => {},
  registerMessageListener: () => {},
  unregisterMessageListener: () => {},
};

// Create the context
const MidiContext = createContext<MidiContextType | null>(null);

// Provider component
export function MidiProvider({ children }: { children: ReactNode }) {
  // Use stub implementation to prevent React hooks errors
  const midiDevices = stubMidiImplementation;
  
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