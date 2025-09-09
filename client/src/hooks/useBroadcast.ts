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
      console.log('📺 useBroadcast received state update:', state);
      setBroadcastState(state);
      setIsViewer(true);
      setIsHost(false);
    });

    // Subscribe to room info updates
    const unsubscribeRoom = broadcastService.onRoomChange((room) => {
      console.log('📺 Room changed, setting viewer state:', room);
      console.log('📺 Current state - isHost:', broadcastService.getIsHost(), 'roomId:', broadcastService.getRoomId());
      setCurrentRoom(room);
      // Let the explicit joinBroadcast/startBroadcast callbacks handle the isViewer/isHost state
      // This prevents race conditions between room updates and explicit state setting
    });

    // Check initial state
    const serviceIsHost = broadcastService.getIsHost();
    console.log('🔍 Initial service isHost check:', { 
      serviceIsHost, 
      serviceConnected: broadcastService.getIsConnected(),
      serviceRoomId: broadcastService.getRoomId()
    });
    setIsHost(serviceIsHost);
    
    // Check for fallback broadcast in localStorage (for cross-device consistency)
    const fallbackBroadcast = localStorage.getItem('fallback_broadcast');
    const fallbackViewer = localStorage.getItem('fallback_viewer');
    
    if (fallbackBroadcast) {
      try {
        const broadcastData = JSON.parse(fallbackBroadcast);
        const now = Date.now();
        // Only restore if less than 24 hours old
        if (now - broadcastData.timestamp < 24 * 60 * 60 * 1000) {
          console.log('🎭 Restored fallback broadcast from localStorage:', broadcastData);
          console.log('🎭 Setting isHost to true via fallback broadcast restore');
          setIsHost(true);
          setCurrentRoom({
            id: broadcastData.roomId,
            name: broadcastData.broadcastName,
            hostId: broadcastData.userId,
            hostName: broadcastData.userName,
            participantCount: 1,
            isActive: true
          });
        }
      } catch (error) {
        console.warn('Failed to restore fallback broadcast:', error);
      }
    } else if (fallbackViewer) {
      try {
        const viewerData = JSON.parse(fallbackViewer);
        const now = Date.now();
        // Only restore if less than 24 hours old
        if (now - viewerData.timestamp < 24 * 60 * 60 * 1000) {
          console.log('📺 Restored fallback viewer from localStorage:', viewerData);
          setIsViewer(true);
          setCurrentRoom({
            id: viewerData.roomId,
            name: viewerData.broadcastName,
            hostId: 'unknown',
            hostName: 'Unknown Host',
            participantCount: 2,
            isActive: true
          });
        }
      } catch (error) {
        console.warn('Failed to restore fallback viewer:', error);
      }
    }
    
    return () => {
      unsubscribeState();
      unsubscribeRoom();
    };
  }, []);

  // Host: Start broadcasting current performance state
  const startBroadcast = useCallback(async (userId: string, userName: string, broadcastName: string) => {
    console.log('🎭 Starting broadcast:', { userId, userName, broadcastName });
    const roomId = await broadcastService.startBroadcast(userId, userName, broadcastName);
    console.log('🎭 Broadcast started, roomId:', roomId);
    setIsHost(true);
    setIsViewer(false);
    console.log('🎭 Set as host, isHost:', true);
    return roomId;
  }, []);

  // Viewer: Join someone's broadcast
  const joinBroadcast = useCallback(async (roomId: string, userId: string, userName: string) => {
    console.log('🎵 Joining broadcast:', { roomId, userId, userName });
    const success = await broadcastService.joinBroadcast(roomId, userId, userName);
    console.log('🎵 Join result:', success);
    if (success) {
      setIsViewer(true);
      setIsHost(false);
      console.log('🎵 Set as viewer, isViewer:', true);
      
      // Persist viewer state in localStorage as backup
      localStorage.setItem('broadcast_viewer_state', JSON.stringify({
        isViewer: true,
        broadcastName: roomId,
        userId,
        userName,
        timestamp: Date.now()
      }));
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
    // Always check the actual service state, not just the hook state
    const actualIsHost = broadcastService.getIsHost();
    const actualConnected = broadcastService.getIsConnected();
    
    console.log('🎭 sendPerformanceState called:', { 
      hookIsHost: isHost, 
      serviceIsHost: actualIsHost,
      serviceConnected: actualConnected,
      currentState 
    });
    
    if (actualIsHost && actualConnected) {
      console.log('🎭 About to call broadcastService.sendState with:', currentState);
      broadcastService.sendState(currentState);
      console.log('🎭 Finished calling broadcastService.sendState');
    } else {
      console.log('🎭 Not sending - service state check failed:', { 
        hookIsHost: isHost,
        serviceIsHost: actualIsHost,
        serviceConnected: actualConnected,
        reason: !actualIsHost ? 'Service not host' : 'Service not connected'
      });
    }
  }, [isHost]);

  // Leave broadcast (host or viewer)  
  const leaveBroadcast = useCallback(() => {
    broadcastService.disconnect();
    setBroadcastState(null);
    localStorage.removeItem('broadcast_viewer_state');
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