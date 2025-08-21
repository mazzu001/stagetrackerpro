// MIDI parsing functionality has been completely removed
// This module is disabled

export interface ParsedLyricsLine {
  timestamp: number;
  content: string;
  type: 'lyrics';
}

// All MIDI functions have been removed
export function parseLyricsWithMidi(): ParsedLyricsLine[] {
  return [];
}

export function parseMidiEvents(): any[] {
  return [];
}