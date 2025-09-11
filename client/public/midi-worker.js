// MIDI Web Worker - Handles all potentially blocking MIDI operations
// This runs on a separate thread to prevent main thread freezing

let midiAccess = null;
let isInitializing = false;
let initTimeout = null;

// Hard timeout for MIDI initialization (3 seconds maximum)
const MIDI_TIMEOUT_MS = 3000;

// Initialize MIDI access with timeout protection
async function initializeMIDI(options = {}) {
  if (isInitializing) {
    postMessage({ type: 'error', message: 'MIDI initialization already in progress' });
    return;
  }

  if (midiAccess) {
    postMessage({ type: 'initialized', midiAccess: serializeMIDIAccess(midiAccess) });
    return;
  }

  isInitializing = true;
  postMessage({ type: 'initializing' });

  try {
    // Create timeout promise that rejects after 3 seconds
    const timeoutPromise = new Promise((_, reject) => {
      initTimeout = setTimeout(() => {
        reject(new Error('MIDI initialization timed out after 3 seconds'));
      }, MIDI_TIMEOUT_MS);
    });

    // Race the MIDI access request against the timeout
    const midiPromise = navigator.requestMIDIAccess(options);
    
    midiAccess = await Promise.race([midiPromise, timeoutPromise]);
    
    // Clear timeout if we succeeded
    if (initTimeout) {
      clearTimeout(initTimeout);
      initTimeout = null;
    }

    // Set up device state change listener
    midiAccess.onstatechange = (event) => {
      postMessage({
        type: 'deviceStateChanged',
        deviceId: event.port?.id,
        deviceName: event.port?.name,
        deviceState: event.port?.state,
        deviceType: event.port?.type,
        allDevices: serializeMIDIAccess(midiAccess)
      });
    };

    postMessage({
      type: 'initialized',
      midiAccess: serializeMIDIAccess(midiAccess)
    });

  } catch (error) {
    // Clear timeout on error
    if (initTimeout) {
      clearTimeout(initTimeout);
      initTimeout = null;
    }

    const errorMessage = error.message.includes('timeout') 
      ? 'MIDI initialization timed out - continuing with cached devices'
      : `MIDI initialization failed: ${error.message}`;

    postMessage({
      type: 'initializationFailed',
      error: errorMessage,
      isTimeout: error.message.includes('timeout')
    });
  } finally {
    isInitializing = false;
  }
}

// Convert MIDI access object to serializable format
function serializeMIDIAccess(access) {
  if (!access) return null;

  const inputs = Array.from(access.inputs.values()).map(input => ({
    id: input.id,
    name: input.name,
    manufacturer: input.manufacturer,
    state: input.state,
    connection: input.connection,
    type: input.type
  }));

  const outputs = Array.from(access.outputs.values()).map(output => ({
    id: output.id,
    name: output.name,
    manufacturer: output.manufacturer,
    state: output.state,
    connection: output.connection,
    type: output.type
  }));

  return {
    inputs,
    outputs,
    sysexEnabled: access.sysexEnabled
  };
}

// Send MIDI command to specific device
async function sendMIDICommand(deviceId, midiBytes) {
  if (!midiAccess) {
    postMessage({
      type: 'commandResult',
      success: false,
      deviceId,
      message: 'No MIDI access available'
    });
    return;
  }

  try {
    const output = midiAccess.outputs.get(deviceId);
    if (!output) {
      postMessage({
        type: 'commandResult',
        success: false,
        deviceId,
        message: 'Device not found'
      });
      return;
    }

    if (output.state !== 'connected') {
      postMessage({
        type: 'commandResult',
        success: false,
        deviceId,
        message: 'Device not connected'
      });
      return;
    }

    output.send(midiBytes);
    postMessage({
      type: 'commandResult',
      success: true,
      deviceId,
      message: 'Command sent successfully'
    });

  } catch (error) {
    postMessage({
      type: 'commandResult',
      success: false,
      deviceId,
      message: error.message
    });
  }
}

// Handle messages from main thread
self.onmessage = async function(event) {
  const { type, data } = event.data;

  switch (type) {
    case 'initialize':
      await initializeMIDI(data?.options);
      break;

    case 'sendCommand':
      await sendMIDICommand(data.deviceId, data.midiBytes);
      break;

    case 'refreshDevices':
      if (midiAccess) {
        postMessage({
          type: 'devicesRefreshed',
          midiAccess: serializeMIDIAccess(midiAccess)
        });
      } else {
        postMessage({
          type: 'error',
          message: 'No MIDI access to refresh'
        });
      }
      break;

    case 'cleanup':
      // Clean up resources
      if (initTimeout) {
        clearTimeout(initTimeout);
        initTimeout = null;
      }
      if (midiAccess) {
        midiAccess.onstatechange = null;
      }
      midiAccess = null;
      isInitializing = false;
      postMessage({ type: 'cleaned' });
      break;

    default:
      postMessage({
        type: 'error',
        message: `Unknown message type: ${type}`
      });
  }
};

// Handle worker errors
self.onerror = function(error) {
  postMessage({
    type: 'workerError',
    message: error.message,
    filename: error.filename,
    lineno: error.lineno
  });
};

// Signal that worker is ready
postMessage({ type: 'ready' });