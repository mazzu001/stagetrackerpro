// MIDI command parsing and formatting utilities for mobile

export interface MIDIParseResult {
  bytes: number[];
  description: string;
  type: 'note_on' | 'note_off' | 'control_change' | 'program_change' | 'unknown';
  channel?: number;
  note?: number;
  velocity?: number;
  controller?: number;
  value?: number;
  program?: number;
}

/**
 * Parse MIDI command from various formats
 * Supports: [[PC:12:1]], [[CC:7:64:1]], [[NOTE:60:127:1]], hex bytes, text
 */
export function parseMIDICommand(input: string): MIDIParseResult | null {
  if (!input || typeof input !== 'string') {
    return null;
  }

  const trimmed = input.trim();

  // Handle bracket format: [[PC:12:1]], [[CC:7:64:1]], [[NOTE:60:127:1]]
  const bracketMatch = trimmed.match(/^\[\[([^\]]+)\]\]$/);
  if (bracketMatch) {
    return parseBracketFormat(bracketMatch[1]);
  }

  // Handle hex format: "c0 0c" or "90 40 7f"
  const hexMatch = trimmed.match(/^([0-9a-fA-F\s]+)$/);
  if (hexMatch) {
    return parseHexFormat(trimmed);
  }

  // Handle text format: "program change 12 channel 1"
  return parseTextFormat(trimmed);
}

function parseBracketFormat(command: string): MIDIParseResult | null {
  const parts = command.split(':').map(p => p.trim().toLowerCase());
  
  if (parts.length < 2) {
    return null;
  }

  const type = parts[0];
  
  switch (type) {
    case 'pc':
    case 'program':
    case 'program_change':
      return parseProgramChange(parts);
      
    case 'cc':
    case 'control':
    case 'control_change':
      return parseControlChange(parts);
      
    case 'note':
    case 'note_on':
      return parseNoteOn(parts);
      
    case 'note_off':
      return parseNoteOff(parts);
      
    default:
      return null;
  }
}

function parseProgramChange(parts: string[]): MIDIParseResult | null {
  // Format: PC:program:channel or PC:program (channel defaults to 1)
  if (parts.length < 2) return null;
  
  const program = parseInt(parts[1]);
  const channel = parts.length > 2 ? parseInt(parts[2]) : 1;
  
  if (isNaN(program) || isNaN(channel) || 
      program < 0 || program > 127 || 
      channel < 1 || channel > 16) {
    return null;
  }

  const statusByte = 0xc0 + (channel - 1); // Program Change = 0xC0 + channel (0-based)
  
  return {
    bytes: [statusByte, program],
    description: `Program Change: Program ${program}, Channel ${channel}`,
    type: 'program_change',
    channel,
    program
  };
}

function parseControlChange(parts: string[]): MIDIParseResult | null {
  // Format: CC:controller:value:channel or CC:controller:value (channel defaults to 1)
  if (parts.length < 3) return null;
  
  const controller = parseInt(parts[1]);
  const value = parseInt(parts[2]);
  const channel = parts.length > 3 ? parseInt(parts[3]) : 1;
  
  if (isNaN(controller) || isNaN(value) || isNaN(channel) || 
      controller < 0 || controller > 127 || 
      value < 0 || value > 127 ||
      channel < 1 || channel > 16) {
    return null;
  }

  const statusByte = 0xb0 + (channel - 1); // Control Change = 0xB0 + channel (0-based)
  
  return {
    bytes: [statusByte, controller, value],
    description: `Control Change: CC${controller} = ${value}, Channel ${channel}`,
    type: 'control_change',
    channel,
    controller,
    value
  };
}

function parseNoteOn(parts: string[]): MIDIParseResult | null {
  // Format: NOTE:note:velocity:channel or NOTE:note:velocity (channel defaults to 1)
  if (parts.length < 3) return null;
  
  const note = parseInt(parts[1]);
  const velocity = parseInt(parts[2]);
  const channel = parts.length > 3 ? parseInt(parts[3]) : 1;
  
  if (isNaN(note) || isNaN(velocity) || isNaN(channel) || 
      note < 0 || note > 127 || 
      velocity < 0 || velocity > 127 ||
      channel < 1 || channel > 16) {
    return null;
  }

  const statusByte = 0x90 + (channel - 1); // Note On = 0x90 + channel (0-based)
  
  return {
    bytes: [statusByte, note, velocity],
    description: `Note On: Note ${note}, Velocity ${velocity}, Channel ${channel}`,
    type: 'note_on',
    channel,
    note,
    velocity
  };
}

function parseNoteOff(parts: string[]): MIDIParseResult | null {
  // Format: NOTE_OFF:note:velocity:channel or NOTE_OFF:note:velocity (channel defaults to 1)
  if (parts.length < 3) return null;
  
  const note = parseInt(parts[1]);
  const velocity = parseInt(parts[2]);
  const channel = parts.length > 3 ? parseInt(parts[3]) : 1;
  
  if (isNaN(note) || isNaN(velocity) || isNaN(channel) || 
      note < 0 || note > 127 || 
      velocity < 0 || velocity > 127 ||
      channel < 1 || channel > 16) {
    return null;
  }

  const statusByte = 0x80 + (channel - 1); // Note Off = 0x80 + channel (0-based)
  
  return {
    bytes: [statusByte, note, velocity],
    description: `Note Off: Note ${note}, Velocity ${velocity}, Channel ${channel}`,
    type: 'note_off',
    channel,
    note,
    velocity
  };
}

function parseHexFormat(input: string): MIDIParseResult | null {
  const hexBytes = input.split(/\s+/).filter(b => b.length > 0);
  const bytes: number[] = [];
  
  for (const hexByte of hexBytes) {
    const byte = parseInt(hexByte, 16);
    if (isNaN(byte) || byte < 0 || byte > 255) {
      return null;
    }
    bytes.push(byte);
  }
  
  if (bytes.length === 0) {
    return null;
  }
  
  // Analyze the bytes to determine type
  const statusByte = bytes[0];
  const command = statusByte & 0xf0;
  const channel = (statusByte & 0x0f) + 1;
  
  switch (command) {
    case 0x80: // Note Off
      if (bytes.length >= 3) {
        return {
          bytes,
          description: `Note Off: Note ${bytes[1]}, Velocity ${bytes[2]}, Channel ${channel}`,
          type: 'note_off',
          channel,
          note: bytes[1],
          velocity: bytes[2]
        };
      }
      break;
      
    case 0x90: // Note On
      if (bytes.length >= 3) {
        return {
          bytes,
          description: `Note On: Note ${bytes[1]}, Velocity ${bytes[2]}, Channel ${channel}`,
          type: 'note_on',
          channel,
          note: bytes[1],
          velocity: bytes[2]
        };
      }
      break;
      
    case 0xb0: // Control Change
      if (bytes.length >= 3) {
        return {
          bytes,
          description: `Control Change: CC${bytes[1]} = ${bytes[2]}, Channel ${channel}`,
          type: 'control_change',
          channel,
          controller: bytes[1],
          value: bytes[2]
        };
      }
      break;
      
    case 0xc0: // Program Change
      if (bytes.length >= 2) {
        return {
          bytes,
          description: `Program Change: Program ${bytes[1]}, Channel ${channel}`,
          type: 'program_change',
          channel,
          program: bytes[1]
        };
      }
      break;
  }
  
  return {
    bytes,
    description: `Unknown MIDI Command: ${bytes.map(b => b.toString(16).padStart(2, '0')).join(' ')}`,
    type: 'unknown'
  };
}

function parseTextFormat(input: string): MIDIParseResult | null {
  const lower = input.toLowerCase();
  
  // Program Change patterns
  const pcMatch = lower.match(/program\s+change\s+(\d+)(?:\s+channel\s+(\d+))?/);
  if (pcMatch) {
    const program = parseInt(pcMatch[1]);
    const channel = pcMatch[2] ? parseInt(pcMatch[2]) : 1;
    
    if (program >= 0 && program <= 127 && channel >= 1 && channel <= 16) {
      const statusByte = 0xc0 + (channel - 1);
      return {
        bytes: [statusByte, program],
        description: `Program Change: Program ${program}, Channel ${channel}`,
        type: 'program_change',
        channel,
        program
      };
    }
  }
  
  // Control Change patterns
  const ccMatch = lower.match(/(?:control\s+change|cc)\s+(\d+)\s+(?:value\s+)?(\d+)(?:\s+channel\s+(\d+))?/);
  if (ccMatch) {
    const controller = parseInt(ccMatch[1]);
    const value = parseInt(ccMatch[2]);
    const channel = ccMatch[3] ? parseInt(ccMatch[3]) : 1;
    
    if (controller >= 0 && controller <= 127 && 
        value >= 0 && value <= 127 && 
        channel >= 1 && channel <= 16) {
      const statusByte = 0xb0 + (channel - 1);
      return {
        bytes: [statusByte, controller, value],
        description: `Control Change: CC${controller} = ${value}, Channel ${channel}`,
        type: 'control_change',
        channel,
        controller,
        value
      };
    }
  }
  
  // Note patterns
  const noteMatch = lower.match(/note\s+(?:on\s+)?([a-g]#?\d+|\d+)(?:\s+velocity\s+(\d+))?(?:\s+channel\s+(\d+))?/);
  if (noteMatch) {
    let note: number;
    const velocity = noteMatch[2] ? parseInt(noteMatch[2]) : 127;
    const channel = noteMatch[3] ? parseInt(noteMatch[3]) : 1;
    
    // Parse note (either number or note name like C4)
    if (/^\d+$/.test(noteMatch[1])) {
      note = parseInt(noteMatch[1]);
    } else {
      note = noteNameToNumber(noteMatch[1]);
    }
    
    if (note >= 0 && note <= 127 && 
        velocity >= 0 && velocity <= 127 && 
        channel >= 1 && channel <= 16) {
      const statusByte = 0x90 + (channel - 1);
      return {
        bytes: [statusByte, note, velocity],
        description: `Note On: Note ${note}, Velocity ${velocity}, Channel ${channel}`,
        type: 'note_on',
        channel,
        note,
        velocity
      };
    }
  }
  
  return null;
}

function noteNameToNumber(noteName: string): number {
  const match = noteName.match(/([A-G])(#?)(\d+)/i);
  if (!match) return -1;
  
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const noteLetter = match[1].toUpperCase();
  const isSharp = match[2] === '#';
  const octave = parseInt(match[3]);
  
  const noteIndex = noteNames.indexOf(noteLetter + (isSharp ? '#' : ''));
  if (noteIndex === -1) return -1;
  
  return (octave + 1) * 12 + noteIndex;
}

/**
 * Format MIDI bytes as readable bracket format
 */
export function formatMIDIMessage(bytes: number[]): string {
  if (!bytes || bytes.length === 0) return '';
  
  const statusByte = bytes[0];
  const command = statusByte & 0xf0;
  const channel = (statusByte & 0x0f) + 1;
  
  switch (command) {
    case 0x80: // Note Off
      if (bytes.length >= 3) {
        return `[[NOTE_OFF:${bytes[1]}:${bytes[2]}:${channel}]]`;
      }
      break;
      
    case 0x90: // Note On
      if (bytes.length >= 3) {
        return `[[NOTE:${bytes[1]}:${bytes[2]}:${channel}]]`;
      }
      break;
      
    case 0xb0: // Control Change
      if (bytes.length >= 3) {
        return `[[CC:${bytes[1]}:${bytes[2]}:${channel}]]`;
      }
      break;
      
    case 0xc0: // Program Change
      if (bytes.length >= 2) {
        return `[[PC:${bytes[1]}:${channel}]]`;
      }
      break;
  }
  
  return bytes.map(b => b.toString(16).padStart(2, '0')).join(' ');
}

/**
 * Validate MIDI command format
 */
export function isValidMIDICommand(input: string): boolean {
  return parseMIDICommand(input) !== null;
}