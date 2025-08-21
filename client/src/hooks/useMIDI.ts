// MIDI functionality has been completely removed
// This module is disabled

export function useMIDI() {
  // MIDI functionality has been completely removed
  return {
    isSupported: false,
    isInitialized: false,
    devices: [],
    initializeMIDI: async () => false,
    sendMIDIMessage: () => false,
    broadcastMIDIMessage: () => 0,
    sendNoteOn: () => false,
    sendNoteOff: () => false,
    sendControlChange: () => false,
    sendProgramChange: () => false,
    connectedOutputs: [],
    connectedInputs: []
  };
}