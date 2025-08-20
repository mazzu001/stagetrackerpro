import { useState, useEffect, useCallback, useRef } from 'react';
import { useMIDI } from './useMIDI';

export interface MIDICommand {
  timestamp: number; // in seconds
  type: 'note_on' | 'note_off' | 'control_change' | 'program_change';
  channel?: number;
  note?: number;
  velocity?: number;
  controller?: number;
  value?: number;
  program?: number;
  description?: string;
}

interface MIDISequencerState {
  commands: MIDICommand[];
  isActive: boolean;
  lastTriggeredIndex: number;
}

export function useMIDISequencer() {
  const [state, setState] = useState<MIDISequencerState>({
    commands: [],
    isActive: false,
    lastTriggeredIndex: -1
  });
  
  const { broadcastMIDIMessage, sendNoteOn, sendNoteOff, sendControlChange, sendProgramChange } = useMIDI();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Parse MIDI commands from lyrics text
  const parseMIDICommands = useCallback((lyricsText: string): MIDICommand[] => {
    const commands: MIDICommand[] = [];
    const lines = lyricsText.split('\n');
    
    for (const line of lines) {
      // Match MIDI command pattern: [[TYPE:param1:param2:...]] at [MM:SS] or standalone
      const midiMatch = line.match(/\[\[([^[\]]+)\]\]/g);
      
      if (midiMatch) {
        // Look for timestamp in the same line or preceding lines
        let timestamp = 0;
        const timestampMatch = line.match(/\[(\d{1,2}):(\d{2})\]/);
        
        if (timestampMatch) {
          const minutes = parseInt(timestampMatch[1]);
          const seconds = parseInt(timestampMatch[2]);
          timestamp = minutes * 60 + seconds;
        }
        
        midiMatch.forEach(match => {
          const commandStr = match.replace(/[\[\]]/g, '');
          const parts = commandStr.split(':');
          
          if (parts.length < 2) return;
          
          const type = parts[0].toUpperCase();
          const command: Partial<MIDICommand> = {
            timestamp,
            description: `${type} command at ${Math.floor(timestamp / 60)}:${(timestamp % 60).toString().padStart(2, '0')}`
          };
          
          switch (type) {
            case 'NOTE':
            case 'N':
              if (parts.length >= 3) {
                command.type = 'note_on';
                command.note = parseInt(parts[1]);
                command.velocity = parseInt(parts[2]);
                command.channel = parts[3] ? parseInt(parts[3]) : 0;
              }
              break;
              
            case 'CC':
            case 'CONTROL':
              if (parts.length >= 3) {
                command.type = 'control_change';
                command.controller = parseInt(parts[1]);
                command.value = parseInt(parts[2]);
                command.channel = parts[3] ? parseInt(parts[3]) : 0;
              }
              break;
              
            case 'PC':
            case 'PROGRAM':
              if (parts.length >= 2) {
                command.type = 'program_change';
                command.program = parseInt(parts[1]);
                command.channel = parts[2] ? parseInt(parts[2]) : 0;
              }
              break;
              
            case 'NOTEOFF':
            case 'NOFF':
              if (parts.length >= 2) {
                command.type = 'note_off';
                command.note = parseInt(parts[1]);
                command.channel = parts[2] ? parseInt(parts[2]) : 0;
              }
              break;
          }
          
          if (command.type) {
            commands.push(command as MIDICommand);
          }
        });
      }
    }
    
    // Sort commands by timestamp
    return commands.sort((a, b) => a.timestamp - b.timestamp);
  }, []);

  // Execute a MIDI command
  const executeMIDICommand = useCallback((command: MIDICommand) => {
    const channel = command.channel || 0;
    
    switch (command.type) {
      case 'note_on':
        if (command.note !== undefined && command.velocity !== undefined) {
          sendNoteOn(command.note, command.velocity, channel);
        }
        break;
        
      case 'note_off':
        if (command.note !== undefined) {
          sendNoteOff(command.note, channel);
        }
        break;
        
      case 'control_change':
        if (command.controller !== undefined && command.value !== undefined) {
          sendControlChange(command.controller, command.value, channel);
        }
        break;
        
      case 'program_change':
        if (command.program !== undefined) {
          sendProgramChange(command.program, channel);
        }
        break;
    }
    
    console.log('Executed MIDI command:', command);
  }, [sendNoteOn, sendNoteOff, sendControlChange, sendProgramChange]);

  // Start MIDI sequencing
  const startSequencer = useCallback((lyricsText: string) => {
    const commands = parseMIDICommands(lyricsText);
    setState(prev => ({
      ...prev,
      commands,
      isActive: true,
      lastTriggeredIndex: -1
    }));
  }, [parseMIDICommands]);

  // Stop MIDI sequencing
  const stopSequencer = useCallback(() => {
    setState(prev => ({
      ...prev,
      isActive: false,
      lastTriggeredIndex: -1
    }));
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Update sequencer with current playback time
  const updateSequencer = useCallback((currentTime: number, isPlaying: boolean) => {
    if (!state.isActive || !isPlaying) return;

    // Find commands that should be triggered at current time
    const commandsToTrigger = state.commands.filter((command, index) => {
      return index > state.lastTriggeredIndex && 
             command.timestamp <= currentTime && 
             command.timestamp >= currentTime - 0.5; // 500ms tolerance
    });

    if (commandsToTrigger.length > 0) {
      commandsToTrigger.forEach(executeMIDICommand);
      
      // Update last triggered index
      const lastIndex = state.commands.indexOf(commandsToTrigger[commandsToTrigger.length - 1]);
      setState(prev => ({
        ...prev,
        lastTriggeredIndex: lastIndex
      }));
    }
  }, [state.isActive, state.commands, state.lastTriggeredIndex, executeMIDICommand]);

  // Reset sequencer position (for seeking)
  const resetSequencer = useCallback((currentTime: number) => {
    if (!state.isActive) return;
    
    // Find the last command that should have been triggered before current time
    let lastIndex = -1;
    for (let i = 0; i < state.commands.length; i++) {
      if (state.commands[i].timestamp <= currentTime) {
        lastIndex = i;
      } else {
        break;
      }
    }
    
    setState(prev => ({
      ...prev,
      lastTriggeredIndex: lastIndex
    }));
  }, [state.isActive, state.commands]);

  // Get upcoming MIDI commands for preview
  const getUpcomingCommands = useCallback((currentTime: number, lookAheadSeconds = 10): MIDICommand[] => {
    return state.commands.filter(command => 
      command.timestamp > currentTime && 
      command.timestamp <= currentTime + lookAheadSeconds
    );
  }, [state.commands]);

  // Get MIDI command statistics
  const getCommandStats = useCallback(() => {
    const stats = {
      total: state.commands.length,
      triggered: state.lastTriggeredIndex + 1,
      remaining: Math.max(0, state.commands.length - state.lastTriggeredIndex - 1),
      types: {} as Record<string, number>
    };
    
    state.commands.forEach(command => {
      stats.types[command.type] = (stats.types[command.type] || 0) + 1;
    });
    
    return stats;
  }, [state.commands, state.lastTriggeredIndex]);

  return {
    commands: state.commands,
    isActive: state.isActive,
    lastTriggeredIndex: state.lastTriggeredIndex,
    startSequencer,
    stopSequencer,
    updateSequencer,
    resetSequencer,
    getUpcomingCommands,
    getCommandStats,
    parseMIDICommands,
    executeMIDICommand
  };
}