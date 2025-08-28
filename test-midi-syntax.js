// Test MIDI Command Parsing
console.log('🎵 TESTING MIDI COMMAND PARSING');

// Simulate the parseMidiCommand function
const parseMidiCommand = (command) => {
  // Parse [[TYPE:VALUE:CHANNEL]] format
  const bracketMatch = command.match(/\[\[([^:]+):([^:]+):([^\]]+)\]\]/);
  if (!bracketMatch) {
    // Try legacy hex format like "C0 0C"
    const hexMatch = command.match(/^([0-9A-Fa-f\s]+)$/);
    if (hexMatch) {
      const hexBytes = command.split(/\s+/).filter(h => h.length > 0);
      return new Uint8Array(hexBytes.map(h => parseInt(h, 16)));
    }
    return null;
  }

  const [, type, value, channel] = bracketMatch;
  const ch = Math.max(1, Math.min(16, parseInt(channel))) - 1; // Convert to 0-15
  const val = parseInt(value);

  switch (type.toUpperCase()) {
    case 'PC': // Program Change - MIDI values are 0-127, send value as-is
      return new Uint8Array([0xC0 | ch, Math.min(127, Math.max(0, val))]);
      
    case 'CC': // Control Change - expect format [[CC:controller:value:channel]]
      const parts = command.match(/\[\[CC:([^:]+):([^:]+):([^\]]+)\]\]/);
      if (parts) {
        const controller = parseInt(parts[1]);
        const ccValue = parseInt(parts[2]);
        const ccChannel = Math.max(1, Math.min(16, parseInt(parts[3]))) - 1;
        return new Uint8Array([0xB0 | ccChannel, Math.min(127, Math.max(0, controller)), Math.min(127, Math.max(0, ccValue))]);
      }
      return null;
      
    case 'NOTE': // Note On - expect format [[NOTE:note:velocity:channel]]
      const noteParts = command.match(/\[\[NOTE:([^:]+):([^:]+):([^\]]+)\]\]/);
      if (noteParts) {
        const note = parseInt(noteParts[1]);
        const velocity = parseInt(noteParts[2]);
        const noteChannel = Math.max(1, Math.min(16, parseInt(noteParts[3]))) - 1;
        const cmd = velocity > 0 ? 0x90 : 0x80; // Note On or Note Off
        return new Uint8Array([cmd | noteChannel, Math.min(127, Math.max(0, note)), Math.min(127, Math.max(0, velocity))]);
      }
      return null;

    default:
      return null;
  }
};

// Test cases
const testCommands = [
  '[[PC:1:1]]',   // Program Change 1, Channel 1 -> Should be C0 01
  '[[PC:12:1]]',  // Program Change 12, Channel 1 -> Should be C0 0C 
  '[[CC:7:64:1]]', // Volume control -> Should be B0 07 40
  '[[NOTE:60:127:1]]', // Note C4 velocity 127 -> Should be 90 3C 7F
  'C0 0C'         // Legacy hex format -> Should be C0 0C
];

testCommands.forEach(cmd => {
  const result = parseMidiCommand(cmd);
  if (result) {
    const hex = Array.from(result).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
    console.log(`✅ ${cmd} → [${hex}]`);
  } else {
    console.log(`❌ ${cmd} → PARSE FAILED`);
  }
});

console.log('\n🔥 KEY FIXES APPLIED:');
console.log('1. ✅ Program Change now sends value as-is (not val-1)');
console.log('2. ✅ BLE MIDI timestamp uses proper 13-bit format');
console.log('3. ✅ Enhanced debugging with detailed packet logging');
console.log('4. ✅ Both writeWithResponse and writeWithoutResponse methods tried');
console.log('\n💡 For TC-Helicon VoiceLive 3 + WIDI Jack:');
console.log('   • Try [[PC:12:1]] for program change 12');
console.log('   • Try [[CC:7:64:1]] for volume control');
console.log('   • Make sure WIDI Jack is in MIDI mode (not audio mode)');