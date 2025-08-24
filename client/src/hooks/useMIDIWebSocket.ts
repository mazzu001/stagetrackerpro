import { useEffect, useState, useCallback, useRef } from 'react';

export interface MIDIMessage {
  timestamp: number;
  deviceId: string;
  deviceName: string;
  channel: number;
  command: string;
  data: number[];
  rawData: number[];
}

export interface MIDIWebSocketMessage {
  type: 'midi_message' | 'connection_established';
  data?: MIDIMessage;
  message?: string;
}

export function useMIDIWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<MIDIMessage[]>([]);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  const connect = useCallback(() => {
    try {
      // Close existing connection if any
      if (wsRef.current) {
        wsRef.current.close();
      }

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/api/midi/stream`;
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('🎹 MIDI WebSocket connected');
        setIsConnected(true);
        setConnectionError(null);
      };

      ws.onmessage = (event) => {
        try {
          const message: MIDIWebSocketMessage = JSON.parse(event.data);
          
          if (message.type === 'midi_message' && message.data) {
            setMessages(prev => {
              const newMessages = [...prev, message.data!];
              // Keep only last 50 messages for performance
              return newMessages.slice(-50);
            });
          } else if (message.type === 'connection_established') {
            console.log('🎹 MIDI stream established:', message.message);
          }
        } catch (error) {
          console.error('Failed to parse MIDI WebSocket message:', error);
        }
      };

      ws.onclose = (event) => {
        console.log('🎹 MIDI WebSocket disconnected:', event.code, event.reason);
        setIsConnected(false);
        wsRef.current = null;

        // Auto-reconnect after 3 seconds unless explicitly closed
        if (event.code !== 1000) {
          setConnectionError('Connection lost, reconnecting...');
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 3000);
        }
      };

      ws.onerror = (error) => {
        console.error('🎹 MIDI WebSocket error:', error);
        setConnectionError('Connection error occurred');
        setIsConnected(false);
      };

    } catch (error) {
      console.error('Failed to create MIDI WebSocket:', error);
      setConnectionError('Failed to connect to MIDI stream');
    }
  }, []);

  const disconnect = useCallback(() => {
    console.log('🎹 Disconnecting MIDI WebSocket');
    
    // Clear reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }

    // Close WebSocket connection
    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual disconnect');
      wsRef.current = null;
    }

    setIsConnected(false);
    setConnectionError(null);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected,
    messages,
    connectionError,
    connect,
    disconnect,
    clearMessages
  };
}