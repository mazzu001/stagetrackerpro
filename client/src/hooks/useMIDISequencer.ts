import { useState, useEffect, useCallback, useRef } from 'react';
import { parseMIDICommand } from '@/utils/midiFormatter';

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
                type: getMIDICommandType(midiBytes[0]),
                channel: (midiBytes[0] & 0x0F) + 1,
                originalText: midiMatch,
                description: `${commandText} at ${timestampMatch[0]}`
              };

              // Add specific properties based on command type
              switch (command.type) {
                case 'note_on':
                case 'note_off':
                  command.note = midiBytes[1];
                  command.velocity = midiBytes[2];
                  break;
                case 'control_change':
                  command.controller = midiBytes[1];
                  command.value = midiBytes[2];
                  break;
                case 'program_change':
                  command.program = midiBytes[1];
                  break;
              }

              console.log(`✅ Created MIDI command:`, command);
              parsedCommands.push(command);
            } else {
              console.warn(`⚠️ Failed to parse MIDI command bytes: ${commandText}`);
            }
          } catch (error) {
            console.warn(`❌ Error parsing MIDI command: ${commandText}`, error);
          }
        });
      } else {
        console.log(`⚠️ Line has no valid timestamp + MIDI command combination`);
      }
    });

    console.log(`🎼 Final parsed commands (${parsedCommands.length}):`, parsedCommands);
    return parsedCommands.sort((a, b) => a.timestamp - b.timestamp);
  }, []);

  // Get MIDI command type from status byte
  const getMIDICommandType = (statusByte: number): MIDICommand['type'] => {
    const command = statusByte & 0xF0;
    switch (command) {
      case 0x90: return 'note_on';
      case 0x80: return 'note_off';
      case 0xB0: return 'control_change';
      case 0xC0: return 'program_change';
      default: return 'note_on';
    }
  };

  // Execute a MIDI command
  const executeMIDICommand = useCallback(async (command: MIDICommand): Promise<boolean> => {
    if (!onExecuteCommand || !command.originalText) return false;

    try {
      console.log(`🎹 Executing MIDI command at ${command.timestamp}ms: ${command.originalText}`);
      const success = await onExecuteCommand(command.originalText);
      if (success) {
        console.log(`✅ MIDI command executed successfully: ${command.description}`);
      } else {
        console.warn(`⚠️ MIDI command execution failed: ${command.description}`);
      }
      return success;
    } catch (error) {
      console.error(`❌ Error executing MIDI command: ${command.description}`, error);
      return false;
    }
  }, [onExecuteCommand]);

  // Start the sequencer
  const startSequencer = useCallback((playbackTimeMs: number = 0) => {
    console.log(`🎵 Starting MIDI sequencer at ${playbackTimeMs}ms`);
    setIsActive(true);
    setCurrentPlaybackTime(playbackTimeMs);
    setLastTriggeredIndex(-1);

    // Find commands that should have already been triggered
    const currentCommands = commandsRef.current;
    let initialIndex = -1;
    for (let i = 0; i < currentCommands.length; i++) {
      if (currentCommands[i].timestamp <= playbackTimeMs) {
        initialIndex = i;
      } else {
        break;
      }
    }
    setLastTriggeredIndex(initialIndex);

    // Start the sequencer loop
    intervalRef.current = setInterval(() => {
      setCurrentPlaybackTime(prev => {
        const newTime = prev + 100; // Update every 100ms
        
        // Check for commands to execute
        const currentCommands = commandsRef.current;
        const currentLastTriggered = lastTriggeredIndex;
        
        for (let i = currentLastTriggered + 1; i < currentCommands.length; i++) {
          const command = currentCommands[i];
          if (command.timestamp <= newTime) {
            executeMIDICommand(command);
            setLastTriggeredIndex(i);
          } else {
            break; // Commands are sorted by timestamp
          }
        }
        
        return newTime;
      });
    }, 100);
  }, [executeMIDICommand, lastTriggeredIndex]);

  // Stop the sequencer
  const stopSequencer = useCallback(() => {
    console.log('🛑 Stopping MIDI sequencer');
    setIsActive(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = undefined;
    }
  }, []);

  // Update sequencer with new playback time
  const updateSequencer = useCallback((playbackTimeMs: number) => {
    if (!isActive) {
      console.log(`⏸️ Sequencer not active, ignoring update at ${playbackTimeMs}ms`);
      return;
    }
    
    console.log(`⏱️ Sequencer update: ${playbackTimeMs}ms, ${commandsRef.current.length} commands loaded, lastTriggered: ${lastTriggeredIndex}`);
    
    // Handle seek backwards - reset triggered commands first
    if (playbackTimeMs < currentPlaybackTime) {
      let newLastTriggered = -1;
      for (let i = 0; i < commandsRef.current.length; i++) {
        if (commandsRef.current[i].timestamp <= playbackTimeMs) {
          newLastTriggered = i;
        } else {
          break;
        }
      }
      console.log(`🔄 Seek backward detected, resetting lastTriggeredIndex from ${lastTriggeredIndex} to ${newLastTriggered}`);
      setLastTriggeredIndex(newLastTriggered);
    }
    
    setCurrentPlaybackTime(playbackTimeMs);
    
    // Check for commands to trigger
    const currentCommands = commandsRef.current;
    console.log(`🔍 Checking commands to trigger: commands=${currentCommands.length}, lastTriggered=${lastTriggeredIndex}`);
    
    for (let i = lastTriggeredIndex + 1; i < currentCommands.length; i++) {
      const command = currentCommands[i];
      console.log(`🔍 Checking command ${i}: timestamp=${command.timestamp}ms vs playback=${playbackTimeMs}ms`);
      if (command.timestamp <= playbackTimeMs) {
        console.log(`🎯 Triggering MIDI command at ${playbackTimeMs}ms: ${command.originalText}`);
        executeMIDICommand(command);
        setLastTriggeredIndex(i);
        console.log(`✅ Updated lastTriggeredIndex to ${i}`);
      } else {
        console.log(`⏭️ Command ${i} not ready yet (${command.timestamp}ms > ${playbackTimeMs}ms)`);
        break; // Commands are sorted by timestamp
      }
    }
  }, [isActive, currentPlaybackTime, lastTriggeredIndex, executeMIDICommand]);

  // Reset sequencer
  const resetSequencer = useCallback(() => {
    stopSequencer();
    setLastTriggeredIndex(-1);
    setCurrentPlaybackTime(0);
  }, [stopSequencer]);

  // Get upcoming commands (next 5 seconds)
  const getUpcomingCommands = useCallback(() => {
    const lookAheadTime = 5000; // 5 seconds
    return commands.filter(cmd => 
      cmd.timestamp > currentPlaybackTime && 
      cmd.timestamp <= currentPlaybackTime + lookAheadTime
    );
  }, [commands, currentPlaybackTime]);

  // Get command statistics
  const getCommandStats = useCallback(() => {
    const total = commands.length;
    const triggered = commands.filter(cmd => cmd.timestamp <= currentPlaybackTime).length;
    const upcoming = commands.filter(cmd => cmd.timestamp > currentPlaybackTime).length;
    
    const types = commands.reduce((acc, cmd) => {
      acc[cmd.type] = (acc[cmd.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return { total, triggered, upcoming, types };
  }, [commands, currentPlaybackTime]);

  // Set commands from external source
  const setMIDICommands = useCallback((lyricsText: string) => {
    console.log(`🎼 Parsing MIDI commands from lyrics:`, lyricsText);
    const parsedCommands = parseMIDICommands(lyricsText);
    console.log(`🎹 Parsed ${parsedCommands.length} commands:`, parsedCommands);
    
    setCommands(parsedCommands);
    commandsRef.current = parsedCommands;
    
    console.log(`✅ Commands set - State: ${parsedCommands.length}, Ref: ${commandsRef.current.length}`);
    console.log(`🎹 Final loaded MIDI commands:`, commandsRef.current);
  }, [parseMIDICommands]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    commands,
    isActive,
    lastTriggeredIndex,
    currentPlaybackTime,
    startSequencer,
    stopSequencer,
    updateSequencer,
    resetSequencer,
    getUpcomingCommands,
    getCommandStats,
    parseMIDICommands,
    executeMIDICommand,
    setMIDICommands
  };
}