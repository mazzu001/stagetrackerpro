import { useCallback, useRef, useEffect } from 'react';
import { useMIDISystem } from './useMIDISystem';

interface MIDIEvent {
  timestamp: number;
  command: string;
  description: string;
}

export function useMIDISequencer() {
  const { sendMIDICommand, isConnected } = useMIDISystem();
  const sequenceRef = useRef<MIDIEvent[]>([]);
  const timeoutsRef = useRef<NodeJS.Timeout[]>([]);
  const isRunningRef = useRef(false);

  // Parse lyrics text for timestamped MIDI commands
  const parseLyricsForMIDI = useCallback((lyrics: string): MIDIEvent[] => {
    const events: MIDIEvent[] = [];
    const lines = lyrics.split('\n');

    for (const line of lines) {
      // Match [MM:SS] [[MIDI_COMMAND]] pattern
      const timestampMatch = line.match(/\[(\d{1,2}):(\d{2})\]/);
      const midiMatch = line.match(/\[\[([^\]]+)\]\]/);

      if (timestampMatch && midiMatch) {
        const minutes = parseInt(timestampMatch[1]);
        const seconds = parseInt(timestampMatch[2]);
        const timestamp = minutes * 60 + seconds;
        const command = midiMatch[1];

        events.push({
          timestamp,
          command: `[[${command}]]`,
          description: `${command} at ${timestampMatch[1]}:${timestampMatch[2]}`
        });
      }
    }

    return events.sort((a, b) => a.timestamp - b.timestamp);
  }, []);

  // Start MIDI sequencing for a song
  const startSequence = useCallback((lyrics: string) => {
    console.log('[MIDI SEQUENCER] Starting sequence...');
    
    // Stop any existing sequence
    stopSequence();

    const events = parseLyricsForMIDI(lyrics);
    sequenceRef.current = events;

    if (events.length === 0) {
      console.log('[MIDI SEQUENCER] No MIDI events found in lyrics');
      return;
    }

    console.log(`[MIDI SEQUENCER] Found ${events.length} MIDI events`);
    events.forEach((event, index) => {
      console.log(`[MIDI SEQUENCER] Event ${index}: ${event.description} at ${event.timestamp}s`);
    });

    isRunningRef.current = true;
  }, [parseLyricsForMIDI]);

  // Process MIDI events at current playback time
  const processEvents = useCallback((currentTime: number) => {
    if (!isRunningRef.current || !isConnected) return;

    const tolerance = 0.5; // 500ms tolerance
    const eventsToProcess = sequenceRef.current.filter(event => {
      const timeDiff = Math.abs(currentTime - event.timestamp);
      return timeDiff <= tolerance;
    });

    eventsToProcess.forEach(event => {
      console.log(`[MIDI SEQUENCER] Triggering: ${event.description} at ${currentTime.toFixed(1)}s`);
      sendMIDICommand(event.command);
      
      // Remove processed event to prevent re-triggering
      sequenceRef.current = sequenceRef.current.filter(e => e !== event);
    });
  }, [isConnected, sendMIDICommand]);

  // Stop sequencing
  const stopSequence = useCallback(() => {
    console.log('[MIDI SEQUENCER] Stopping sequence');
    isRunningRef.current = false;
    
    // Clear any pending timeouts
    timeoutsRef.current.forEach(timeout => clearTimeout(timeout));
    timeoutsRef.current = [];
    
    // Reset sequence
    sequenceRef.current = [];
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSequence();
    };
  }, [stopSequence]);

  return {
    startSequence,
    stopSequence,
    processEvents,
    isRunning: isRunningRef.current,
    eventCount: sequenceRef.current.length
  };
}