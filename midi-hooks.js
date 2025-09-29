// midi-hooks.js
// Direct hooks to the Web MIDI API for better MIDI indicator feedback

// Auto-initialize when this module is loaded
initDirectMidiHooks();

// Run this when the page loads to set up MIDI hooks
export function initDirectMidiHooks() {
  console.log('[MIDI-HOOKS] Initializing direct Web MIDI API hooks');
  
  // Request MIDI access
  if (navigator.requestMIDIAccess) {
    navigator.requestMIDIAccess({ sysex: false })
      .then(onMIDISuccess)
      .catch(err => console.error('[MIDI-HOOKS] Failed to get MIDI access:', err));
  } else {
    console.warn('[MIDI-HOOKS] Web MIDI API not supported in this browser');
  }
  
  // Add global test function
  window.testMidiIndicator = testMidiIndicator;
}

// Called when MIDI access is successfully obtained
function onMIDISuccess(midiAccess) {
  console.log('[MIDI-HOOKS] MIDI access granted');
  
  // Add direct listeners to all MIDI inputs
  midiAccess.inputs.forEach(input => {
    console.log(`[MIDI-HOOKS] Adding direct listener to input: ${input.name || input.id}`);
    
    // Remove any existing listeners from our direct hooks
    input.removeEventListener('midimessage', onMIDIMessage);
    
    // Add our listener
    input.addEventListener('midimessage', onMIDIMessage);
  });
  
  // Listen for device connection/disconnection
  midiAccess.addEventListener('statechange', event => {
    const port = event.port;
    if (port.type === 'input') {
      if (port.state === 'connected') {
        console.log(`[MIDI-HOOKS] Input connected: ${port.name || port.id}`);
        port.removeEventListener('midimessage', onMIDIMessage);
        port.addEventListener('midimessage', onMIDIMessage);
      } else {
        console.log(`[MIDI-HOOKS] Input disconnected: ${port.name || port.id}`);
      }
    }
  });
}

// Handle incoming MIDI messages directly
function onMIDIMessage(event) {
  // We don't need to process the message, just flash the indicator
  flashMidiIndicator();
}

// Flash the MIDI indicator
function flashMidiIndicator() {
  if (typeof window.flashMidiIndicator === 'function') {
    window.flashMidiIndicator();
  } else {
    console.warn('[MIDI-HOOKS] flashMidiIndicator function not found');
  }
}

// Test function to manually trigger the MIDI indicator
export function testMidiIndicator() {
  console.log('[MIDI-HOOKS] Testing MIDI indicator');
  flashMidiIndicator();
}