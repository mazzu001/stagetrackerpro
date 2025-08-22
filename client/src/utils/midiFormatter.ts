// MIDI Message Formatting Utility
// Converts raw MIDI data to readable bracket format: [[PC:12:1]]

export function formatMIDIMessage(rawData: number[]): string {
  if (!rawData || rawData.length === 0) return 'Unknown MIDI';
  
  const status = rawData[0];
  const channel = (status & 0x0F) + 1; // Convert 0-15 to 1-16
  const messageType = status & 0xF0;
  
  switch (messageType) {
    case 0x90: // Note On
      if (rawData.length >= 3) {
        return `[[NOTE:${rawData[1]}:${rawData[2]}:${channel}]]`;
      }
      break;
    case 0x80: // Note Off  
      if (rawData.length >= 3) {
        return `[[NOTEOFF:${rawData[1]}:${rawData[2]}:${channel}]]`;
      }
      break;
    case 0xB0: // Control Change
      if (rawData.length >= 3) {
        return `[[CC:${rawData[1]}:${rawData[2]}:${channel}]]`;
      }
      break;
    case 0xC0: // Program Change
      if (rawData.length >= 2) {
        return `[[PC:${rawData[1]}:${channel}]]`;
      }
      break;
    case 0xE0: // Pitch Bend
      if (rawData.length >= 3) {
        const value = (rawData[2] << 7) | rawData[1];
        return `[[PITCHBEND:${value}:${channel}]]`;
      }
      break;
    case 0xA0: // Aftertouch/Key Pressure
      if (rawData.length >= 3) {
        return `[[AFTERTOUCH:${rawData[1]}:${rawData[2]}:${channel}]]`;
      }
      break;
    case 0xD0: // Channel Pressure
      if (rawData.length >= 2) {
        return `[[CHANNELPRESSURE:${rawData[1]}:${channel}]]`;
      }
      break;
  }
  
  // Fallback to hex format for unknown/malformed messages
  return `[${rawData.map(byte => byte.toString(16).padStart(2, '0').toUpperCase()).join(' ')}]`;
}

export function getMIDIMessageType(rawData: number[]): string {
  if (!rawData || rawData.length === 0) return 'Unknown';
  
  const messageType = rawData[0] & 0xF0;
  switch (messageType) {
    case 0x80: return 'Note Off';
    case 0x90: return 'Note On';
    case 0xA0: return 'Aftertouch';
    case 0xB0: return 'Control Change';
    case 0xC0: return 'Program Change';
    case 0xD0: return 'Channel Pressure';
    case 0xE0: return 'Pitch Bend';
    case 0xF0: return 'System';
    default: return 'Unknown';
  }
}

// Parse MIDI commands from various formats into byte arrays
export function parseMIDICommand(command: string): { bytes: number[], formatted: string } | null {
  const trimmed = command.trim();
  if (!trimmed) return null;

  // Try bracket format first: [[PC:12:1]]
  const bracketMatch = trimmed.match(/\[\[([A-Z]+):(\d+)(?::(\d+))?(?::(\d+))?\]\]/i);
  if (bracketMatch) {
    const result = parseBracketMIDICommand(bracketMatch);
    if (result) {
      return {
        bytes: result,
        formatted: formatMIDIMessage(result)
      };
    }
  }

  // Try hex format: 90 40 7F
  const hexMatch = trimmed.match(/^([0-9A-Fa-f]{2}\s*)+$/);
  if (hexMatch) {
    const bytes = trimmed.split(/\s+/).map(hex => parseInt(hex, 16));
    if (bytes.every(byte => byte >= 0 && byte <= 255)) {
      return {
        bytes: bytes,
        formatted: formatMIDIMessage(bytes)
      };
    }
  }

  // Try text format: note on C4 127
  const textResult = parseTextMIDICommand(trimmed);
  if (textResult) {
    return {
      bytes: textResult,
      formatted: formatMIDIMessage(textResult)
    };
  }

  return null;
}

function parseBracketMIDICommand(match: RegExpMatchArray): number[] | null {
  const [, type, param1, param2, param3] = match;
  const channel = param3 ? Math.max(1, Math.min(16, parseInt(param3))) - 1 : 0; // Convert 1-16 to 0-15
  
  switch (type.toUpperCase()) {
    case 'PC': // Program Change [[PC:12:1]]
      const program = parseInt(param1);
      if (program >= 0 && program <= 127) {
        return [0xC0 + channel, program];
      }
      break;
      
    case 'CC': // Control Change [[CC:7:64:1]]
      const controller = parseInt(param1);
      const value = parseInt(param2 || '0');
      if (controller >= 0 && controller <= 127 && value >= 0 && value <= 127) {
        return [0xB0 + channel, controller, value];
      }
      break;
      
    case 'NOTE': // Note On [[NOTE:60:127:1]]
      const note = parseInt(param1);
      const velocity = parseInt(param2 || '127');
      if (note >= 0 && note <= 127 && velocity >= 0 && velocity <= 127) {
        return [0x90 + channel, note, velocity];
      }
      break;
      
    case 'NOTEOFF': // Note Off [[NOTEOFF:60:64:1]]
      const noteOff = parseInt(param1);
      const velocityOff = parseInt(param2 || '64');
      if (noteOff >= 0 && noteOff <= 127 && velocityOff >= 0 && velocityOff <= 127) {
        return [0x80 + channel, noteOff, velocityOff];
      }
      break;
  }
  
  return null;
}

function parseTextMIDICommand(command: string): number[] | null {
  const lower = command.toLowerCase();
  
  // Note on/off patterns
  const noteOnMatch = lower.match(/note\s*on\s+([a-g]#?\d+|\d+)\s+(\d+)(?:\s+ch(?:annel)?\s*(\d+))?/);
  if (noteOnMatch) {
    const note = parseNoteValue(noteOnMatch[1]);
    const velocity = Math.max(0, Math.min(127, parseInt(noteOnMatch[2])));
    const channel = noteOnMatch[3] ? Math.max(1, Math.min(16, parseInt(noteOnMatch[3]))) - 1 : 0;
    if (note !== null) {
      return [0x90 + channel, note, velocity];
    }
  }

  const noteOffMatch = lower.match(/note\s*off\s+([a-g]#?\d+|\d+)\s+(\d+)(?:\s+ch(?:annel)?\s*(\d+))?/);
  if (noteOffMatch) {
    const note = parseNoteValue(noteOffMatch[1]);
    const velocity = Math.max(0, Math.min(127, parseInt(noteOffMatch[2])));
    const channel = noteOffMatch[3] ? Math.max(1, Math.min(16, parseInt(noteOffMatch[3]))) - 1 : 0;
    if (note !== null) {
      return [0x80 + channel, note, velocity];
    }
  }

  return null;
}

function parseNoteValue(noteStr: string): number | null {
  // If it's already a number
  const num = parseInt(noteStr);
  if (!isNaN(num) && num >= 0 && num <= 127) {
    return num;
  }

  // Parse note names like C4, C#4, etc.
  const noteMatch = noteStr.match(/([A-G])(#|b)?(\d+)/i);
  if (noteMatch) {
    const [, noteName, accidental, octave] = noteMatch;
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    let noteValue = noteNames.indexOf(noteName.toUpperCase());
    
    if (noteValue === -1) return null;
    
    if (accidental === '#') noteValue += 1;
    if (accidental === 'b') noteValue -= 1;
    
    const octaveNum = parseInt(octave);
    const midiNote = (octaveNum + 1) * 12 + noteValue;
    
    return (midiNote >= 0 && midiNote <= 127) ? midiNote : null;
  }

  return null;
}