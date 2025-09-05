import { useState, useEffect, useCallback } from 'react';
import { broadcastService, type BroadcastState, type BroadcastRoom } from '@/lib/broadcast-service';

// Simple hook that overlays existing functionality without breaking it
export function useBroadcast() {
  const [broadcastState, setBroadcastState] = useState<BroadcastState | null>(null);
  const [currentRoom, setCurrentRoom] = useState<BroadcastRoom | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [isViewer, setIsViewer] = useState(false);

  useEffect(() => {
    // Subscribe to broadcast updates (viewer mode)
    const unsubscribeState = broadcastService.onStateChange((state) => {
      setBroadcastState(state);
      setIsViewer(true);
      setIsHost(false);
    });

    // Subscribe to room info updates
    const unsubscribeRoom = broadcastService.onRoomChange((room) => {
      setCurrentRoom(room);
    });

    // Check initial state
    setIsHost(broadcastService.getIsHost());
    
    return () => {
      unsubscribeState();
      unsubscribeRoom();
    };
  }, []);

  // Host: Start broadcasting current performance state
  const startBroadcast = useCallback(async (userId: string, userName: string, broadcastName: string) => {
    const roomId = await broadcastService.startBroadcast(userId, userName, broadcastName);
    setIsHost(true);
    setIsViewer(false);
    return roomId;
  }, []);

  // Viewer: Join someone's broadcast
  const joinBroadcast = useCallback(async (roomId: string, userId: string, userName: string) => {
    const success = await broadcastService.joinBroadcast(roomId, userId, userName);
    if (success) {
      setIsViewer(true);
      setIsHost(false);
    }
    return success;
  }, []);

  // Host: Send current performance state to viewers
  const sendPerformanceState = useCallback((currentState: {
    currentSong?: string;
    songTitle?: string;
    position: number;
    isPlaying: boolean;
    currentLyricLine?: string;
    waveformProgress: number;
  }) => {
    if (isHost) {
      broadcastService.sendState(currentState);
    }
  }, [isHost]);

  // Leave broadcast (host or viewer)
  const leaveBroadcast = useCallback(() => {
    broadcastService.disconnect();
    setBroadcastState(null);
    setCurrentRoom(null);
    setIsHost(false);
    setIsViewer(false);
  }, []);

  return {
    // State
    broadcastState,     // What viewers see from broadcaster
    currentRoom,        // Current broadcast room info
    isHost,            // Am I broadcasting?
    isViewer,          // Am I viewing someone's broadcast?
    isConnected: broadcastService.getIsConnected(),

    // Actions
    startBroadcast,     // Start broadcasting
    joinBroadcast,      // Join someone's broadcast
    sendPerformanceState, // Send state to viewers (host only)
    leaveBroadcast      // Disconnect
  };
}