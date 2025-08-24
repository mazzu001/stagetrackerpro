import { useState, useEffect, useRef, useCallback } from 'react';
import { parseMIDICommand, MIDIParseResult } from '../utils/midiFormatter';

export interface MIDICommand {
  timestamp: number;
  type: 'note_on' | 'note_off' | 'control_change' | 'program_change';
  channel?: number;
  note?: number;
  velocity?: number;
  controller?: number;
  value?: number;
  program?: number;
  description?: string;
  originalText?: string;
}

interface MIDISequencerProps {
  onExecuteCommand?: (command: string) => Promise<boolean>;
}

export function useMIDISequencer({ onExecuteCommand }: MIDISequencerProps = {}) {
  const [commands, setCommands] = useState<MIDICommand[]>([]);
  const [isActive, setIsActive] = useState(false);
  const [lastTriggeredIndex, setLastTriggeredIndex] = useState(-1);
  const [currentPlaybackTime, setCurrentPlaybackTime] = useState(0);
  
  const intervalRef = useRef<NodeJS.Timeout>();
  const commandsRef = useRef<MIDICommand[]>([]);

  // Update commands ref when commands change
  useEffect(() => {
    commandsRef.current = commands;
    console.log(`🔄 Commands ref updated: ${commands.length} commands`, commands);
  }, [commands]);

  // Parse MIDI commands from lyrics text
  const parseMIDICommands = useCallback((lyricsText: string): MIDICommand[] => {
    const lines = lyricsText.split('\n');
    const parsedCommands: MIDICommand[] = [];
    console.log(`🔍 Parsing lyrics with ${lines.length} lines:`, lines);

    lines.forEach((line, lineIndex) => {
      console.log(`📝 Processing line ${lineIndex}: "${line}"`);
      
      // Look for MIDI commands in bracket format: [[PC:12:1]] or with timestamps: [00:30] [[PC:12:1]]
      const timestampMatch = line.match(/\[(\d{1,2}):(\d{2})\]/);
      const midiMatches = line.match(/\[\[([^\]]+)\]\]/g);
      
      console.log(`⏰ Timestamp match:`, timestampMatch);
      console.log(`🎵 MIDI matches:`, midiMatches);

      if (timestampMatch && midiMatches) {
        const minutes = parseInt(timestampMatch[1]);
        const seconds = parseInt(timestampMatch[2]);
        const timestamp = (minutes * 60 + seconds) * 1000; // Convert to milliseconds
        console.log(`⏱️ Parsed timestamp: ${timestampMatch[0]} → ${timestamp}ms`);

        midiMatches.forEach(midiMatch => {
          const commandText = midiMatch.slice(2, -2); // Remove [[ ]]
          console.log(`🎯 Processing MIDI command: "${commandText}"`);
          try {
            const midiResult = parseMIDICommand(commandText);
            console.log(`🔧 Parse result:`, midiResult);
            if (midiResult && midiResult.bytes.length > 0) {
              const midiBytes = midiResult.bytes;
              // Convert MIDI bytes to MIDICommand structure
              const command: MIDICommand = {
                timestamp,
                type: midiResult.type as MIDICommand['type'],
                channel: midiResult.channel,
                note: midiResult.note,
                velocity: midiResult.velocity,
                controller: midiResult.controller,
                value: midiResult.value,
                program: midiResult.program,
                description: midiResult.description,
                originalText: midiMatch
              };
              
              parsedCommands.push(command);
              console.log(`✅ Added MIDI command:`, command);
            } else {
              console.warn(`⚠️ Invalid MIDI command: "${commandText}"`);
            }
          } catch (error) {
            console.error(`❌ Error parsing MIDI command "${commandText}":`, error);
          }
        });
      } else {
        console.log(`⚠️ Line has no valid timestamp + MIDI command combination`);
      }
    });

    // Sort commands by timestamp
    parsedCommands.sort((a, b) => a.timestamp - b.timestamp);
    console.log(`🎼 Final parsed commands (${parsedCommands.length}):`, parsedCommands);
    
    return parsedCommands;
  }, []);

  // Execute a MIDI command
  const executeMIDICommand = useCallback(async (command: MIDICommand): Promise<boolean> => {
    try {
      console.log(`🎹 Executing MIDI command:`, command);
      
      if (onExecuteCommand && command.originalText) {
        const success = await onExecuteCommand(command.originalText);
        console.log(`📤 MIDI command execution result: ${success ? 'success' : 'failed'}`);
        return success;
      } else {
        // Mock execution for mobile - in real app this would send to MIDI devices
        console.log(`📱 Mock MIDI execution: ${command.description}`);
        return true;
      }
    } catch (error) {
      console.error(`❌ Error executing MIDI command:`, error);
      return false;
    }
  }, [onExecuteCommand]);

  // Start/stop sequencer
  const startSequencer = useCallback((currentTime: number = 0) => {
    console.log(`🎹 Starting MIDI sequencer at time: ${currentTime}ms`);
    setIsActive(true);
    setCurrentPlaybackTime(currentTime);
    setLastTriggeredIndex(-1);
    
    // Check for commands to execute immediately
    checkAndExecuteCommands(currentTime);
  }, []);

  const stopSequencer = useCallback(() => {
    console.log(`🛑 Stopping MIDI sequencer`);
    setIsActive(false);
    setLastTriggeredIndex(-1);
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = undefined;
    }
  }, []);

  // Check and execute commands at current time
  const checkAndExecuteCommands = useCallback((currentTime: number) => {
    const currentCommands = commandsRef.current;
    
    if (!currentCommands || currentCommands.length === 0) {
      return;
    }
    
    // Find commands that should be triggered at current time
    currentCommands.forEach((command, index) => {
      if (index > lastTriggeredIndex && command.timestamp <= currentTime) {
        console.log(`⏰ Triggering MIDI command at ${currentTime}ms:`, command);
        executeMIDICommand(command);
        setLastTriggeredIndex(index);
      }
    });
  }, [lastTriggeredIndex, executeMIDICommand]);

  // Update sequencer time (called by audio engine)
  const updateTime = useCallback((currentTime: number) => {
    setCurrentPlaybackTime(currentTime);
    
    if (isActive) {
      checkAndExecuteCommands(currentTime);
    }
  }, [isActive, checkAndExecuteCommands]);

  // Set MIDI commands
  const setMIDICommands = useCallback((newCommands: MIDICommand[]) => {
    console.log(`🎹 Setting ${newCommands.length} MIDI commands:`, newCommands);
    setCommands(newCommands);
    setLastTriggeredIndex(-1);
  }, []);

  // Load commands from lyrics
  const loadFromLyrics = useCallback((lyricsText: string) => {
    console.log(`🎼 Parsing MIDI commands from lyrics:`, lyricsText);
    const parsed = parseMIDICommands(lyricsText);
    console.log(`🎹 Parsed ${parsed.length} commands:`, parsed);
    setMIDICommands(parsed);
    console.log(`✅ Commands set - State: ${parsed.length}, Ref: ${commandsRef.current.length}`);
    console.log(`🎹 Final loaded MIDI commands:`, commandsRef.current);
  }, [parseMIDICommands, setMIDICommands]);

  // Get next command to be triggered
  const getNextCommand = useCallback((): MIDICommand | null => {
    const currentCommands = commandsRef.current;
    
    if (!currentCommands || currentCommands.length === 0) {
      return null;
    }
    
    for (let i = lastTriggeredIndex + 1; i < currentCommands.length; i++) {
      if (currentCommands[i].timestamp > currentPlaybackTime) {
        return currentCommands[i];
      }
    }
    
    return null;
  }, [lastTriggeredIndex, currentPlaybackTime]);

  // Get upcoming commands in next N seconds
  const getUpcomingCommands = useCallback((lookAheadSeconds: number = 5): MIDICommand[] => {
    const currentCommands = commandsRef.current;
    const lookAheadTime = currentPlaybackTime + (lookAheadSeconds * 1000);
    
    if (!currentCommands || currentCommands.length === 0) {
      return [];
    }
    
    return currentCommands.filter(command => 
      command.timestamp > currentPlaybackTime && 
      command.timestamp <= lookAheadTime
    );
  }, [currentPlaybackTime]);

  // Reset sequencer
  const reset = useCallback(() => {
    console.log(`🔄 Resetting MIDI sequencer`);
    stopSequencer();
    setLastTriggeredIndex(-1);
    setCurrentPlaybackTime(0);
  }, [stopSequencer]);

  return {
    commands,
    isActive,
    lastTriggeredIndex,
    currentPlaybackTime,
    startSequencer,
    stopSequencer,
    updateTime,
    loadFromLyrics,
    parseMIDICommands,
    executeMIDICommand,
    setMIDICommands,
    getNextCommand,
    getUpcomingCommands,
    reset
  };
}