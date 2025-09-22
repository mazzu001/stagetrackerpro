import { createContext, useContext, ReactNode } from 'react';
import { useSimpleMidi } from '@/hooks/useSimpleMidi';

// Create context with the return type of useSimpleMidi
const MidiContext = createContext<ReturnType<typeof useSimpleMidi> | null>(null);

export function MidiProvider({ children }: { children: ReactNode }) {
  const midi = useSimpleMidi();
  
  return (
    <MidiContext.Provider value={midi}>
      {children}
    </MidiContext.Provider>
  );
}

export function useMidi() {
  const context = useContext(MidiContext);
  if (!context) {
    throw new Error('useMidi must be used within a MidiProvider');
  }
  return context;
}