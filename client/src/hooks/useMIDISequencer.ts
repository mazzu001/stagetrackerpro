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
    
    console.log('[MIDI PARSER] Parsing lyrics for MIDI commands...');
    console.log('[MIDI PARSER] Total lines to parse:', lines.length);
    
    for (const line of lines) {
      // Match MIDI command pattern: [[TYPE:param1:param2:...]] at [MM:SS] or standalone
      const midiMatch = line.match(/\[\[([^[\]]+)\]\]/g);
      
      if (midiMatch) {
        console.log('[MIDI PARSER] Found MIDI commands in line:', line);
        
        // Look for timestamp in the same line BEFORE the MIDI command
        let timestamp = 0;
        const timestampMatch = line.match(/\[(\d{1,2}):(\d{2})\]/);
        
        if (timestampMatch) {
          const minutes = parseInt(timestampMatch[1]);
          const seconds = parseInt(timestampMatch[2]);
          timestamp = minutes * 60 + seconds;
          console.log('[MIDI PARSER] Found timestamp:', timestampMatch[0], '=', timestamp, 'seconds');
        } else {
          console.log('[MIDI PARSER] No timestamp found in line, using 0');
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
            console.log('[MIDI PARSER] Added command:', command);
          } else {
            console.log('[MIDI PARSER] Failed to parse command:', parts);
          }
        });
      }
    }
    
    // Sort commands by timestamp
    const sortedCommands = commands.sort((a, b) => a.timestamp - b.timestamp);
    console.log('[MIDI PARSER] Total commands parsed:', sortedCommands.length);
    console.log('[MIDI PARSER] Commands:', sortedCommands);
    return sortedCommands;
  }, []);

  // Execute a MIDI command
  const executeMIDICommand = useCallback((command: MIDICommand) => {
    const channel = command.channel || 0;
    
    console.log(`[MIDI SEQUENCER] Executing command: ${command.type} at ${command.timestamp}s`);
    
    try {
      switch (command.type) {
        case 'note_on':
          if (command.note !== undefined && command.velocity !== undefined) {
            console.log(`[MIDI SEQUENCER] Sending Note On: note=${command.note}, vel=${command.velocity}, ch=${channel}`);
            sendNoteOn(command.note, command.velocity, channel);
          }
          break;
          
        case 'note_off':
          if (command.note !== undefined) {
            console.log(`[MIDI SEQUENCER] Sending Note Off: note=${command.note}, ch=${channel}`);
            sendNoteOff(command.note, channel);
          }
          break;
          
        case 'control_change':
          if (command.controller !== undefined && command.value !== undefined) {
            console.log(`[MIDI SEQUENCER] Sending CC: controller=${command.controller}, value=${command.value}, ch=${channel}`);
            sendControlChange(command.controller, command.value, channel);
          }
          break;
          
        case 'program_change':
          if (command.program !== undefined) {
            console.log(`[MIDI SEQUENCER] Sending PC: program=${command.program}, ch=${channel}`);
            console.log(`[MIDI SEQUENCER] This should send MIDI data: [${0xC0 | channel}, ${command.program}]`);
            sendProgramChange(command.program, channel);
          }
          break;
      }
      
      console.log('[MIDI SEQUENCER] Successfully executed MIDI command:', command);
    } catch (error) {
      console.error('[MIDI SEQUENCER] Error executing MIDI command:', error, command);
    }
  }, [sendNoteOn, sendNoteOff, sendControlChange, sendProgramChange]);

  // Start MIDI sequencing
  const startSequencer = useCallback((lyricsText: string) => {
    console.log('[MIDI SEQUENCER] Starting sequencer with lyrics...');
    const commands = parseMIDICommands(lyricsText);
    setState(prev => ({
      ...prev,
      commands,
      isActive: true,
      lastTriggeredIndex: -1
    }));
    console.log(`[MIDI SEQUENCER] Sequencer started with ${commands.length} commands`);
    commands.forEach((cmd, idx) => {
      console.log(`[MIDI SEQUENCER] Command ${idx}: ${cmd.type} at ${cmd.timestamp}s`);
    });
  }, [parseMIDICommands]);

  // Stop MIDI sequencing
  const stopSequencer = useCallback(() => {
    console.log('[MIDI SEQUENCER] Stopping sequencer');
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
    if (!state.isActive || !isPlaying) {
      return;
    }

    console.log(`[MIDI SEQUENCER] Update: time=${currentTime.toFixed(1)}s, active=${state.isActive}, playing=${isPlaying}, totalCommands=${state.commands.length}, lastIndex=${state.lastTriggeredIndex}`);

    // Find commands that should be triggered at current time
    const commandsToTrigger = state.commands.filter((command, index) => {
      const shouldTrigger = index > state.lastTriggeredIndex && 
                           command.timestamp <= currentTime && 
                           command.timestamp >= currentTime - 0.2; // Tight 200ms window to prevent early triggering
      
      if (shouldTrigger) {
        console.log(`[MIDI SEQUENCER] Command ready to trigger:`, command);
      }
      
      return shouldTrigger;
    });

    if (commandsToTrigger.length > 0) {
      console.log(`[MIDI SEQUENCER] Triggering ${commandsToTrigger.length} commands at time ${currentTime.toFixed(1)}s`);
      
      // Execute each command and log success
      commandsToTrigger.forEach(command => {
        console.log(`[MIDI SEQUENCER] About to execute:`, command);
        executeMIDICommand(command);
      });
      
      // Update last triggered index
      const lastIndex = state.commands.indexOf(commandsToTrigger[commandsToTrigger.length - 1]);
      console.log(`[MIDI SEQUENCER] Updating lastTriggeredIndex from ${state.lastTriggeredIndex} to ${lastIndex}`);
      setState(prev => ({
        ...prev,
        lastTriggeredIndex: lastIndex
      }));
    }
  }, [state.isActive, state.commands, state.lastTriggeredIndex, executeMIDICommand]);

  // Reset sequencer position (for seeking)
  const resetSequencer = useCallback((currentTime: number) => {
    console.log(`[MIDI SEQUENCER] Resetting position to ${currentTime.toFixed(1)}s`);
    
    // Find the last command that should have been triggered before current time
    let lastIndex = -1;
    for (let i = 0; i < state.commands.length; i++) {
      if (state.commands[i].timestamp <= currentTime) {
        lastIndex = i;
        console.log(`[MIDI SEQUENCER] Command ${i} at ${state.commands[i].timestamp}s should have been triggered`);
      } else {
        break;
      }
    }
    
    console.log(`[MIDI SEQUENCER] Reset lastTriggeredIndex from ${state.lastTriggeredIndex} to ${lastIndex}`);
    
    setState(prev => ({
      ...prev,
      lastTriggeredIndex: lastIndex
    }));
  }, [state.commands, state.lastTriggeredIndex]);

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