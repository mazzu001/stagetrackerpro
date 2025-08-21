// MIDI Sequencer functionality has been completely removed
// This module is disabled

export interface MIDICommand {
  timestamp: number;
  type: 'note_on' | 'note_off' | 'control_change' | 'program_change';
  channel?: number;
  note?: number;
  velocity?: number;
  controller?: number;
  value?: number;
  program?: number;
  description?: string;
}

export function useMIDISequencer() {
  // MIDI sequencer functionality has been completely removed
  return {
    commands: [],
    isActive: false,
    lastTriggeredIndex: -1,
    startSequencer: () => {},
    stopSequencer: () => {},
    updateSequencer: () => {},
    resetSequencer: () => {},
    getUpcomingCommands: () => [],
    getCommandStats: () => ({ total: 0, triggered: 0, upcoming: 0, types: {} }),
    parseMIDICommands: () => [],
    executeMIDICommand: () => false
  };
}