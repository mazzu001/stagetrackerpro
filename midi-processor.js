// midi-processor.js
// Process embedded MIDI commands in lyrics and handle MIDI indicator flashing

// Process all non-timestamped MIDI commands from lyrics when a song is selected
export function processNonTimedMidiCommands(lyrics) {
  if (!lyrics || typeof lyrics !== 'string') return false;
  
  console.log("Processing non-timestamped MIDI commands from song lyrics");
  
  // Split lyrics into lines
  const lines = lyrics.split('\n');
  let processed = false;
  let processedCount = 0;
  
  // Look for lines without timestamps but with MIDI commands
  for (const line of lines) {
    // Check if line has no timestamp but has MIDI commands
    const hasTimestamp = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/.test(line);
    const hasMidi = /\[\[[^\]]+\]\]/g.test(line);
    
    // Process only lines with MIDI commands but without timestamps
    if (!hasTimestamp && hasMidi) {
      console.log("Found non-timestamped line with MIDI commands:", line);
      
      // Process MIDI commands in this line
      if (processMidiFromLyrics(line)) {
        processed = true;
        processedCount++;
      }
    }
  }
  
  console.log(`Processed ${processedCount} non-timestamped MIDI commands`);
  return processed;
}

// Extract MIDI commands from a lyrics line and process them
export function processMidiFromLyrics(text) {
  if (!text || typeof text !== 'string') return false;
  
  // Extract MIDI tags [[...]]
  const midiRegex = /\[\[([^\]]+)\]\]/g;
  let match;
  let processed = false;
  
  while ((match = midiRegex.exec(text)) !== null) {
    const tag = `[[${match[1]}]]`;
    
    // Get MIDI state from window.STP_MIDI if available
    const midiState = window.STP_MIDI || {};
    
    // Use the STP_MIDI.sendTag method if available (preferred)
    if (midiState.sendTag && typeof midiState.sendTag === 'function') {
      if (midiState.sendTag(tag) > 0) {
        processed = true;
      }
    } else {
      // Fallback to our own implementation
      const midiMessage = tagToMidiMessage(tag);
      if (midiMessage) {
        // Send the MIDI message to all connected outputs
        sendMidiToOutputs(midiMessage, tag);
        processed = true;
      }
    }
  }
  
  return processed;
}

// Convert a tag like [[PC:1:1]] to a MIDI message array
function tagToMidiMessage(tag) {
  const m = String(tag || '').trim().match(/^\[\[(.+?)\]\]$/);
  if (!m) return null;
  
  const parts = m[1].split(':');
  const kind = (parts[0]||'').toUpperCase();
  const num = (i, def=0) => Math.max(0, parseInt(parts[i] ?? def, 10) || def);
  const ch = Math.max(1, Math.min(16, num(1,1)));
  const ch0 = ch - 1;
  
  switch (kind) {
    case 'PC': { 
      const prog1 = num(1,1); 
      const pcCh = Math.max(1, Math.min(16, num(2,1))); 
      const pcCh0 = pcCh - 1; 
      const prog0 = Math.max(0, Math.min(127, prog1 - 1)); 
      return [0xC0 | pcCh0, prog0]; 
    }
    case 'CC': { 
      const cc = num(2,0); 
      const val = num(3,0); 
      return [0xB0 | ch0, Math.min(127, cc), Math.min(127, val)]; 
    }
    case 'NOTE_ON': { 
      const note = num(2,60); 
      const vel = num(3,100); 
      return [0x90 | ch0, Math.min(127,note), Math.min(127,vel)]; 
    }
    case 'NOTE_OFF': { 
      const note = num(2,60); 
      const vel = num(3,0); 
      return [0x80 | ch0, Math.min(127,note), Math.min(127,vel)]; 
    }
    case 'PB': { 
      let value = parseInt(parts[2] ?? '0', 10); 
      if (!Number.isFinite(value)) value = 0; 
      value = Math.max(-8192, Math.min(8191, value)); 
      const v14 = value + 8192; 
      const lsb = v14 & 0x7F; 
      const msb = (v14 >> 7) & 0x7F; 
      return [0xE0 | ch0, lsb, msb]; 
    }
    case 'CP': { 
      const pres = num(2,0); 
      return [0xD0 | ch0, Math.min(127,pres)]; 
    }
    case 'POLY_PRESS': { 
      const note = num(2,60); 
      const pres = num(3,0); 
      return [0xA0 | ch0, Math.min(127,note), Math.min(127,pres)]; 
    }
    // Support additional tags from lyrics.js
    case 'AT': {
      const pressure = num(1,0);
      const atCh = Math.max(1, Math.min(16, num(2,1)));
      const atCh0 = atCh - 1;
      return [0xD0 | atCh0, Math.min(127, pressure)];
    }
    case 'PAT': {
      const note = num(1,60);
      const pressure = num(2,0);
      const patCh = Math.max(1, Math.min(16, num(3,1)));
      const patCh0 = patCh - 1;
      return [0xA0 | patCh0, Math.min(127, note), Math.min(127, pressure)];
    }
    default: 
      return null;
  }
}

// Send MIDI message to all connected outputs
function sendMidiToOutputs(midiMessage, tag) {
  if (!midiMessage || !Array.isArray(midiMessage) || !tag) return;
  
  // Flash the indicator light directly if needed
  if (typeof window.flashMidiIndicator === 'function') {
    window.flashMidiIndicator();
  }
  
  // Get MIDI state from window.STP_MIDI if available
  const midiState = window.STP_MIDI || {};
  
  // Log to console for debugging
  console.log('Processing MIDI from lyrics:', tag, midiMessage);
  
  // If we have access to the dashboard.js MIDI state
  if (midiState.getConnectedCounts && typeof midiState.getConnectedCounts === 'function') {
    try {
      // Use the sendTag method if available (preferred)
      if (typeof midiState.sendTag === 'function') {
        return midiState.sendTag(tag);
      }
      // Fallback to sendMessage if sendTag is not available
      else if (typeof midiState.sendMessage === 'function') {
        return midiState.sendMessage(midiMessage, tag);
      }
    } catch(e) {
      console.error('Error sending MIDI message:', e);
    }
  }
  return 0;
}