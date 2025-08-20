import { useState, useEffect } from 'react';
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Music, Zap, Clock } from 'lucide-react';
import type { MIDICommand } from '@/hooks/useMIDISequencer';

interface MIDICommandDisplayProps {
  commands: MIDICommand[];
  currentTime: number;
  lastTriggeredIndex: number;
  isActive: boolean;
  className?: string;
}

export function MIDICommandDisplay({ 
  commands, 
  currentTime, 
  lastTriggeredIndex, 
  isActive,
  className = "" 
}: MIDICommandDisplayProps) {
  const [upcomingCommands, setUpcomingCommands] = useState<MIDICommand[]>([]);

  // Filter upcoming commands (next 10 seconds)
  useEffect(() => {
    const upcoming = commands.filter(command => 
      command.timestamp > currentTime && 
      command.timestamp <= currentTime + 10
    ).slice(0, 3); // Show only next 3 commands
    
    setUpcomingCommands(upcoming);
  }, [commands, currentTime]);

  const getCommandTypeIcon = (type: string) => {
    switch (type) {
      case 'note_on':
      case 'note_off':
        return <Music className="w-3 h-3" />;
      case 'control_change':
        return <Zap className="w-3 h-3" />;
      case 'program_change':
        return <Music className="w-3 h-3" />;
      default:
        return <Zap className="w-3 h-3" />;
    }
  };

  const getCommandTypeBadge = (command: MIDICommand) => {
    const typeMap = {
      'note_on': { label: 'Note', variant: 'default' as const },
      'note_off': { label: 'Note Off', variant: 'secondary' as const },
      'control_change': { label: 'CC', variant: 'outline' as const },
      'program_change': { label: 'PC', variant: 'destructive' as const }
    };

    const config = typeMap[command.type] || { label: 'MIDI', variant: 'default' as const };
    return <Badge variant={config.variant} className="text-xs">{config.label}</Badge>;
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getCommandDetails = (command: MIDICommand) => {
    const channel = command.channel !== undefined ? ` Ch${command.channel + 1}` : '';
    
    switch (command.type) {
      case 'note_on':
        return `Note ${command.note} Vel ${command.velocity}${channel}`;
      case 'note_off':
        return `Note ${command.note}${channel}`;
      case 'control_change':
        return `CC${command.controller} = ${command.value}${channel}`;
      case 'program_change':
        return `Program ${command.program}${channel}`;
      default:
        return 'MIDI Command';
    }
  };

  if (commands.length === 0) {
    return (
      <Card className={`w-full ${className}`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Music className="w-4 h-4" />
            MIDI Commands
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500 py-4">
            <p className="text-sm">No MIDI commands found in lyrics</p>
            <p className="text-xs mt-1">
              Add commands like <code>[[CC:1:127]]</code> to your lyrics
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`w-full ${className}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Music className="w-4 h-4" />
            MIDI Commands
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={isActive ? "default" : "secondary"} className="text-xs">
              {isActive ? 'Active' : 'Inactive'}
            </Badge>
            <span className="text-xs text-gray-500">
              {lastTriggeredIndex + 1}/{commands.length}
            </span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Current Status */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{formatTime(currentTime)}</span>
          </div>
          <span className="text-gray-500">
            {commands.length} total commands
          </span>
        </div>

        {/* Upcoming Commands */}
        {upcomingCommands.length > 0 && (
          <div>
            <h4 className="text-xs font-medium mb-2 text-gray-400">Next Commands</h4>
            <ScrollArea className="h-24">
              <div className="space-y-1">
                {upcomingCommands.map((command, index) => (
                  <div 
                    key={index}
                    className="flex items-center justify-between p-2 rounded border bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {getCommandTypeIcon(command.type)}
                      <span className="text-xs font-mono">
                        {formatTime(command.timestamp)}
                      </span>
                      {getCommandTypeBadge(command)}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 ml-2 truncate">
                      {getCommandDetails(command)}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Recently Triggered Commands */}
        {lastTriggeredIndex >= 0 && (
          <div>
            <h4 className="text-xs font-medium mb-2 text-gray-400">Recently Triggered</h4>
            <ScrollArea className="h-16">
              <div className="space-y-1">
                {commands.slice(Math.max(0, lastTriggeredIndex - 1), lastTriggeredIndex + 1).map((command, index) => (
                  <div 
                    key={index}
                    className="flex items-center justify-between p-1 rounded text-xs bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800"
                  >
                    <div className="flex items-center gap-2">
                      {getCommandTypeIcon(command.type)}
                      <span className="font-mono">{formatTime(command.timestamp)}</span>
                      {getCommandTypeBadge(command)}
                    </div>
                    <span className="text-gray-600 dark:text-gray-400 truncate ml-2">
                      {getCommandDetails(command)}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Command Summary */}
        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
          <div className="flex flex-wrap gap-1">
            {Object.entries(
              commands.reduce((acc, cmd) => {
                acc[cmd.type] = (acc[cmd.type] || 0) + 1;
                return acc;
              }, {} as Record<string, number>)
            ).map(([type, count]) => (
              <Badge key={type} variant="outline" className="text-xs">
                {type.replace('_', ' ')}: {count}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}