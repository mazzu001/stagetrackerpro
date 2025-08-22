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