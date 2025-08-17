import type { MidiEvent } from "@shared/schema";

export interface ParsedLyricsLine {
  timestamp: number; // in seconds
  content: string;
  type: 'lyrics' | 'midi';
}

export function parseLyricsWithMidi(lyrics: string): ParsedLyricsLine[] {
  const lines = lyrics.split('\n');
  const parsed: ParsedLyricsLine[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    // Match timestamp pattern [mm:ss] or [hh:mm:ss]
    const timestampMatch = trimmedLine.match(/^\[(\d{1,2}):(\d{2})(?::(\d{2}))?\]/);
    if (!timestampMatch) continue;

    const minutes = parseInt(timestampMatch[1]);
    const seconds = parseInt(timestampMatch[2]);
    const hours = timestampMatch[3] ? parseInt(timestampMatch[3]) : 0;
    const timestamp = hours * 3600 + minutes * 60 + seconds;

    const content = trimmedLine.substring(timestampMatch[0].length).trim();

    // Check if this is a MIDI command
    const isMidiCommand = content.includes('MIDI') || content.includes('<!--') || content.includes('Program Change') || content.includes('Control Change');

    parsed.push({
      timestamp,
      content: content || '',
      type: isMidiCommand ? 'midi' : 'lyrics'
    });
  }

  return parsed.sort((a, b) => a.timestamp - b.timestamp);
}

export function parseMidiEvents(lyrics: string, songId: string): MidiEvent[] {
  const events: Omit<MidiEvent, 'id'>[] = [];
  const lines = lyrics.split('\n');

  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Match timestamp
    const timestampMatch = trimmedLine.match(/^\[(\d{1,2}):(\d{2})(?::(\d{2}))?\]/);
    if (!timestampMatch) continue;

    const minutes = parseInt(timestampMatch[1]);
    const seconds = parseInt(timestampMatch[2]);
    const hours = timestampMatch[3] ? parseInt(timestampMatch[3]) : 0;
    const timestamp = (hours * 3600 + minutes * 60 + seconds) * 1000; // Convert to milliseconds

    const content = trimmedLine.substring(timestampMatch[0].length).trim();

    // Parse MIDI commands
    if (content.includes('Program Change')) {
      const programMatch = content.match(/Program Change (\d+)/i);
      if (programMatch) {
        events.push({
          songId,
          timestamp,
          eventType: 'program_change',
          channel: 1,
          data1: parseInt(programMatch[1]),
          data2: 0,
          description: content
        });
      }
    } else if (content.includes('Control Change')) {
      const controlMatch = content.match(/Control Change (\d+),?\s*(?:Value\s*)?(\d+)/i);
      if (controlMatch) {
        events.push({
          songId,
          timestamp,
          eventType: 'control_change',
          channel: 1,
          data1: parseInt(controlMatch[1]),
          data2: parseInt(controlMatch[2]),
          description: content
        });
      }
    } else if (content.includes('Note On') || content.includes('Note Off')) {
      const noteMatch = content.match(/(Note (?:On|Off)) (\d+),?\s*(?:Velocity\s*)?(\d+)/i);
      if (noteMatch) {
        events.push({
          songId,
          timestamp,
          eventType: noteMatch[1].toLowerCase().replace(' ', '_'),
          channel: 1,
          data1: parseInt(noteMatch[2]),
          data2: parseInt(noteMatch[3]),
          description: content
        });
      }
    }
  }

  return events as MidiEvent[];
}

export function formatMidiEvent(event: MidiEvent): string {
  switch (event.eventType) {
    case 'program_change':
      return `Program Change ${event.data1}`;
    case 'control_change':
      return `Control Change ${event.data1}, Value ${event.data2}`;
    case 'note_on':
      return `Note On ${event.data1}, Velocity ${event.data2}`;
    case 'note_off':
      return `Note Off ${event.data1}, Velocity ${event.data2}`;
    default:
      return event.description || 'Unknown MIDI Event';
  }
}
