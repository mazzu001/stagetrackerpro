import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowUpCircle, ArrowDownCircle, Trash2 } from 'lucide-react';

interface MIDIMessage {
  id: string;
  timestamp: number;
  direction: 'in' | 'out';
  data: number[];
  formatted: string;
  command: string;
}

interface MIDIMessageMonitorProps {
  className?: string;
}

export function MIDIMessageMonitor({ className = "" }: MIDIMessageMonitorProps) {
  const [messages, setMessages] = useState<MIDIMessage[]>([]);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const isAutoScrolling = useRef(true);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (isAutoScrolling.current && scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  // Format MIDI data to readable string
  const formatMIDIData = (data: number[]): string => {
    if (data.length === 0) return '';
    
    const [status, ...dataBytes] = data;
    const command = status & 0xF0;
    const channel = (status & 0x0F) + 1;
    
    switch (command) {
      case 0x80: // Note Off
        return `Note Off: ${dataBytes[0]} Vel:${dataBytes[1]} Ch:${channel}`;
      case 0x90: // Note On
        return `Note On: ${dataBytes[0]} Vel:${dataBytes[1]} Ch:${channel}`;
      case 0xB0: // Control Change
        return `CC: ${dataBytes[0]} Val:${dataBytes[1]} Ch:${channel}`;
      case 0xC0: // Program Change
        return `PC: ${dataBytes[0]} Ch:${channel}`;
      case 0xE0: // Pitch Bend
        const pitchValue = dataBytes[0] + (dataBytes[1] << 7);
        return `Pitch Bend: ${pitchValue} Ch:${channel}`;
      default:
        return `MIDI: ${data.map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' ')}`;
    }
  };

  // Convert MIDI data to bracket format
  const toBracketFormat = (data: number[]): string => {
    if (data.length === 0) return '';
    
    const [status, ...dataBytes] = data;
    const command = status & 0xF0;
    const channel = (status & 0x0F) + 1;
    
    switch (command) {
      case 0x80: // Note Off
        return `[[NOTE_OFF:${dataBytes[0]}:${dataBytes[1]}:${channel}]]`;
      case 0x90: // Note On
        return `[[NOTE:${dataBytes[0]}:${dataBytes[1]}:${channel}]]`;
      case 0xB0: // Control Change
        return `[[CC:${dataBytes[0]}:${dataBytes[1]}:${channel}]]`;
      case 0xC0: // Program Change
        return `[[PC:${dataBytes[0]}:${channel}]]`;
      case 0xE0: // Pitch Bend
        const pitchValue = dataBytes[0] + (dataBytes[1] << 7);
        return `[[PITCH:${pitchValue}:${channel}]]`;
      default:
        return `[[RAW:${data.map(b => b.toString()).join(':')}]]`;
    }
  };

  const addMessage = (direction: 'in' | 'out', data: number[], command: string = '') => {
    const message: MIDIMessage = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      direction,
      data,
      formatted: formatMIDIData(data),
      command: command || toBracketFormat(data)
    };
    
    setMessages(prev => {
      const newMessages = [...prev, message];
      // Keep only last 100 messages to prevent memory issues
      return newMessages.slice(-100);
    });
  };

  // Listen for outgoing MIDI messages
  useEffect(() => {
    const handleOutgoingMIDI = (event: CustomEvent) => {
      const { data, command } = event.detail;
      addMessage('out', Array.from(data), command);
    };

    // Listen for incoming MIDI messages  
    const handleIncomingMIDI = (event: CustomEvent) => {
      const { data } = event.detail;
      addMessage('in', Array.from(data));
    };

    window.addEventListener('midiMessageSent', handleOutgoingMIDI as EventListener);
    window.addEventListener('midiMessageReceived', handleIncomingMIDI as EventListener);

    return () => {
      window.removeEventListener('midiMessageSent', handleOutgoingMIDI as EventListener);
      window.removeEventListener('midiMessageReceived', handleIncomingMIDI as EventListener);
    };
  }, []);

  // Set up MIDI input listening when component mounts
  useEffect(() => {
    const setupMIDIInputListening = async () => {
      try {
        if (!navigator.requestMIDIAccess) return;
        
        const midiAccess = await navigator.requestMIDIAccess();
        
        // Listen to all MIDI inputs
        Array.from(midiAccess.inputs.values()).forEach(input => {
          input.onmidimessage = (event: any) => {
            const data = Array.from(event.data);
            window.dispatchEvent(new CustomEvent('midiMessageReceived', {
              detail: { data }
            }));
          };
        });
        
        // Handle device changes
        midiAccess.onstatechange = () => {
          Array.from(midiAccess.inputs.values()).forEach(input => {
            input.onmidimessage = (event: any) => {
              const data = Array.from(event.data);
              window.dispatchEvent(new CustomEvent('midiMessageReceived', {
                detail: { data }
              }));
            };
          });
        };
      } catch (error) {
        console.log('MIDI input monitoring not available:', error);
      }
    };

    setupMIDIInputListening();
  }, []);

  const clearMessages = () => {
    setMessages([]);
  };

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    });
  };

  return (
    <Card className={`${className} flex flex-col h-full`}>
      <CardHeader className="flex-shrink-0 pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">MIDI Messages</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {messages.length} messages
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={clearMessages}
              className="h-6 px-2"
              data-testid="button-clear-midi-messages"
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-2 overflow-hidden">
        <ScrollArea className="h-full w-full" ref={scrollAreaRef}>
          <div className="space-y-1">
            {messages.length === 0 ? (
              <div className="text-center text-muted-foreground text-xs py-4">
                No MIDI messages yet
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className="flex items-start gap-2 text-xs font-mono p-2 rounded bg-muted/50"
                >
                  <div className="flex-shrink-0">
                    {message.direction === 'out' ? (
                      <ArrowUpCircle className="w-3 h-3 text-blue-500" />
                    ) : (
                      <ArrowDownCircle className="w-3 h-3 text-green-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge 
                        variant={message.direction === 'out' ? 'default' : 'secondary'}
                        className="text-[10px] px-1 py-0"
                      >
                        {message.direction === 'out' ? 'OUT' : 'IN'}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {formatTime(message.timestamp)}
                      </span>
                    </div>
                    <div className="text-xs break-all">
                      {message.formatted}
                    </div>
                    <div className="text-[10px] text-muted-foreground break-all mt-1">
                      {message.command}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}