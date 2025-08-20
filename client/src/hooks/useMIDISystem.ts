import { useState, useEffect, useCallback, useRef } from 'react';

interface MIDICommand {
  type: 'cc' | 'note' | 'noteoff' | 'pc' | 'pitch';
  controller?: number;
  note?: number;
  program?: number;
  value?: number;
  velocity?: number;
  channel: number;
  data: number[];
}

interface MIDIAccess {
  inputs: Map<string, any>;
  outputs: Map<string, any>;
  onstatechange: ((event: any) => void) | null;
}

export function useMIDISystem() {
  const [midiAccess, setMidiAccess] = useState<MIDIAccess | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [deviceCount, setDeviceCount] = useState(0);
  const initializingRef = useRef(false);

  // Initialize MIDI system
  const initializeMIDI = useCallback(async () => {
    if (initializingRef.current) return;
    initializingRef.current = true;

    try {
      console.log('[MIDI SYSTEM] Initializing MIDI access...');
      
      if (!(navigator as any).requestMIDIAccess) {
        console.warn('[MIDI SYSTEM] Web MIDI API not supported');
        createFallbackMIDI();
        return;
      }

      const access = await (navigator as any).requestMIDIAccess({ 
        sysex: false,
        software: true 
      });

      console.log('[MIDI SYSTEM] MIDI access granted');
      console.log(`[MIDI SYSTEM] Found ${access.outputs.size} output devices`);
      
      setMidiAccess(access);
      setIsConnected(true);
      setDeviceCount(access.outputs.size);

      // Listen for device changes
      access.onstatechange = () => {
        console.log('[MIDI SYSTEM] Device state changed');
        setDeviceCount(access.outputs.size);
      };

    } catch (error) {
      console.warn('[MIDI SYSTEM] Failed to access MIDI, using console mode:', error);
      createFallbackMIDI();
    } finally {
      initializingRef.current = false;
    }
  }, []);

  // Create fallback MIDI for testing when real MIDI fails
  const createFallbackMIDI = useCallback(() => {
    const consoleMIDI = {
      inputs: new Map(),
      outputs: new Map([
        ['console', {
          id: 'console',
          name: 'Console MIDI Output',
          send: (data: number[]) => {
            const hex = data.map(b => b.toString(16).padStart(2, '0')).join(' ');
            console.log(`🎹 MIDI COMMAND: [${data.join(', ')}] [${hex}]`);
          }
        }]
      ]),
      onstatechange: null
    };

    setMidiAccess(consoleMIDI as any);
    setIsConnected(true);
    setDeviceCount(1);
    console.log('[MIDI SYSTEM] Console MIDI mode activated');
  }, []);

  // Parse MIDI command string into structured data
  const parseMIDICommand = useCallback((commandStr: string): MIDICommand | null => {
    // Remove brackets and whitespace
    const clean = commandStr.replace(/[\[\]]/g, '').trim().toUpperCase();
    const parts = clean.split(':');

    if (parts.length < 2) return null;

    const type = parts[0].toLowerCase() as MIDICommand['type'];
    const channel = Math.max(1, Math.min(16, parseInt(parts[parts.length - 1]) || 1));

    try {
      switch (type) {
        case 'cc': {
          const controller = parseInt(parts[1]) || 0;
          const value = parseInt(parts[2]) || 64;
          return {
            type: 'cc',
            controller: Math.min(127, controller),
            value: Math.min(127, value),
            channel,
            data: [0xB0 + (channel - 1), Math.min(127, controller), Math.min(127, value)]
          };
        }
        
        case 'note': {
          const note = parseInt(parts[1]) || 60;
          const velocity = parseInt(parts[2]) || 127;
          return {
            type: 'note',
            note: Math.min(127, note),
            velocity: Math.min(127, velocity),
            channel,
            data: [0x90 + (channel - 1), Math.min(127, note), Math.min(127, velocity)]
          };
        }
        
        case 'noteoff': {
          const note = parseInt(parts[1]) || 60;
          return {
            type: 'noteoff',
            note: Math.min(127, note),
            channel,
            data: [0x80 + (channel - 1), Math.min(127, note), 0]
          };
        }
        
        case 'pc': {
          const program = parseInt(parts[1]) || 0;
          return {
            type: 'pc',
            program: Math.min(127, program),
            channel,
            data: [0xC0 + (channel - 1), Math.min(127, program)]
          };
        }
        
        case 'pitch': {
          const value = parseInt(parts[1]) || 8192;
          const lsb = value & 0x7F;
          const msb = (value >> 7) & 0x7F;
          return {
            type: 'pitch',
            value,
            channel,
            data: [0xE0 + (channel - 1), lsb, msb]
          };
        }
        
        default:
          return null;
      }
    } catch (error) {
      console.error('[MIDI SYSTEM] Error parsing command:', error);
      return null;
    }
  }, []);

  // Send MIDI command to all connected devices
  const sendMIDICommand = useCallback((commandStr: string): boolean => {
    if (!midiAccess) {
      console.warn('[MIDI SYSTEM] No MIDI access available');
      return false;
    }

    const command = parseMIDICommand(commandStr);
    if (!command) {
      console.error('[MIDI SYSTEM] Invalid MIDI command:', commandStr);
      return false;
    }

    let sentCount = 0;
    midiAccess.outputs.forEach((output: any) => {
      try {
        output.send(command.data);
        sentCount++;
        console.log(`[MIDI SYSTEM] Sent ${commandStr} to ${output.name || 'Unknown Device'}`);
      } catch (error) {
        console.error(`[MIDI SYSTEM] Failed to send to ${output.name}:`, error);
      }
    });

    if (sentCount === 0) {
      console.warn('[MIDI SYSTEM] No devices received the command');
      return false;
    }

    console.log(`[MIDI SYSTEM] Command sent to ${sentCount} device(s)`);
    return true;
  }, [midiAccess, parseMIDICommand]);

  // Initialize on mount
  useEffect(() => {
    initializeMIDI();
  }, [initializeMIDI]);

  return {
    midiAccess,
    isConnected,
    deviceCount,
    sendMIDICommand,
    parseMIDICommand,
    initializeMIDI
  };
}