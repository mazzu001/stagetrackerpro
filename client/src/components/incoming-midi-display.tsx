import { useState, useEffect } from 'react';

interface MIDIMessage {
  command: string;
  timestamp: number;
  deviceName: string;
}

interface IncomingMIDIDisplayProps {
  maxMessages?: number;
}

export function IncomingMIDIDisplay({ maxMessages = 10 }: IncomingMIDIDisplayProps) {
  const [messages, setMessages] = useState<MIDIMessage[]>([]);

  useEffect(() => {
    const handleIncomingMIDI = (event: any) => {
      const newMessage: MIDIMessage = {
        command: event.detail.command,
        timestamp: event.detail.timestamp,
        deviceName: event.detail.deviceName || 'Unknown Device'
      };

      setMessages(prev => {
        const updated = [newMessage, ...prev.slice(0, maxMessages - 1)];
        return updated;
      });
    };

    window.addEventListener('incomingMIDI', handleIncomingMIDI);
    
    return () => {
      window.removeEventListener('incomingMIDI', handleIncomingMIDI);
    };
  }, [maxMessages]);

  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = Math.floor((now - timestamp) / 1000);
    
    if (diff < 1) return 'now';
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };

  if (messages.length === 0) {
    return (
      <div className="text-center py-2 text-gray-500 text-sm">
        No incoming MIDI messages
      </div>
    );
  }

  return (
    <div className="space-y-1" data-testid="incoming-midi-display">
      <div className="text-xs font-medium text-gray-400 mb-2 flex items-center gap-1">
        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
        Incoming MIDI
      </div>
      <div className="max-h-32 overflow-y-auto space-y-1">
        {messages.map((message, index) => (
          <div
            key={`${message.timestamp}-${index}`}
            className={`text-xs font-mono p-2 rounded transition-all duration-300 ${
              index === 0 
                ? 'bg-green-600/20 border border-green-500/30 text-green-300' 
                : 'bg-gray-700/50 text-gray-400'
            }`}
            data-testid={`midi-message-${index}`}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">{message.command}</span>
              <span className="text-xs text-gray-500">{formatTime(message.timestamp)}</span>
            </div>
            {message.deviceName !== 'Unknown Device' && (
              <div className="text-xs text-gray-500 mt-1">
                from {message.deviceName}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}