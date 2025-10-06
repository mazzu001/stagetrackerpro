import { useState, useEffect, useCallback, useRef } from 'react';
import {
  createBroadcast,
  updateBroadcast,
  subscribeToBroadcast,
  getBroadcast,
  type BroadcastData
} from '@/lib/broadcast-firebase';
import { 
  normalizeBroadcastName, 
  isBroadcastActive 
} from '@/lib/broadcast-utils';
import { useLocalStorage } from '@/hooks/useLocalStorage';

// Updated hook that uses database polling instead of WebSockets
export function useBroadcast() {
  const [broadcastState, setBroadcastState] = useState<BroadcastData | null>(null);
  const [currentRoom, setCurrentRoom] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [isViewer, setIsViewer] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const { user } = useLocalStorage();

  useEffect(() => {
    // Clean up on unmount
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Host: Start broadcasting
  const startBroadcast = useCallback(async (broadcastName: string) => {
    // Normalize the broadcast name for consistency
    const normalizedName = normalizeBroadcastName(broadcastName);
    
    // Create broadcast in Firebase
    await createBroadcast(normalizedName);
    
    // Set up polling interval for broadcasting state
    if (intervalRef.current) clearInterval(intervalRef.current);
    
    // Mark as connected immediately since we're just using the database
    setIsConnected(true);
    console.log('✅ Host broadcast initialized in database:', normalizedName);
    
    setIsHost(true);
    setIsViewer(false);
    setCurrentRoom(normalizedName);
    
    // Set up interval to regularly update the "heartbeat" of the broadcast
    // This ensures viewers can detect if the host is still active
    intervalRef.current = setInterval(() => {
      if (isHost && currentRoom) {
        // Update Firebase with timestamp
        updateBroadcast(currentRoom, {
          lastUpdateTimestamp: Date.now(),
          isActive: true
        }).catch(err => {
          console.error('❌ Error updating broadcast heartbeat in Firebase:', err);
        });
        
        // Also ping the server to update session activity
        fetch(`/api/broadcast/${encodeURIComponent(currentRoom)}/ping`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        }).catch(err => {
          console.error('❌ Error pinging broadcast server:', err);
        });
      }
    }, 5000); // Update every 5 seconds
    
    return broadcastName;
  }, [user?.email, isHost, currentRoom]);

  // Viewer: Join someone's broadcast
  const joinBroadcast = useCallback((broadcastName: string) => {
    // Normalize the broadcast name for consistency
    const normalizedName = normalizeBroadcastName(broadcastName);
    
    // Clean up any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    setIsViewer(true);
    setIsHost(false);
    setCurrentRoom(normalizedName);
    
    // First get initial state
    getBroadcast(normalizedName)
      .then(data => {
        if (data && isBroadcastActive(data)) {
          setBroadcastState(data);
          setIsConnected(true);
          console.log('✅ Viewer broadcast connection established to:', normalizedName);
        } else if (data) {
          console.error('❌ Broadcast exists but is inactive:', normalizedName);
          setIsConnected(false);
        } else {
          console.error('❌ Broadcast not found:', normalizedName);
          setIsConnected(false);
        }
      })
      .catch(error => {
        console.error('❌ Error joining broadcast:', error);
        setIsConnected(false);
      });
    
    // Set up polling interval to check for updates every second
    intervalRef.current = setInterval(() => {
      // Skip polling if we're not connected or no room is selected
      if (!isConnected || !currentRoom) return;
      
      getBroadcast(normalizedName)
        .then(data => {
          if (data && isBroadcastActive(data)) {
            // Update state with fresh data
            setBroadcastState(data);
          } else {
            // If data is missing, stale or inactive, broadcast has ended
            console.log('📺 Broadcast is no longer active:', normalizedName);
            if (isConnected) {
              setIsConnected(false);
            }
          }
        })
        .catch(error => {
          console.error('❌ Error polling broadcast:', error);
          if (isConnected) {
            setIsConnected(false);
          }
        });
    }, 1000); // Poll every second
    
    // Return cleanup function
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isConnected, currentRoom, user?.email]);

  // Host: Send current performance state to viewers (periodic update)
  const sendPerformanceState = useCallback((currentState: BroadcastData) => {
    if (!isHost || !currentRoom) return;
    
    // Update Firebase with current state and timestamp
    updateBroadcast(currentRoom, {
      ...currentState,
      lastUpdateTimestamp: Date.now() // Add timestamp for viewers to check freshness
    });
    
    console.log('📡 Broadcasting state updated in database:', {
      song: currentState.curSong,
      position: currentState.curTime
    });
  }, [isHost, currentRoom]);

  // Leave broadcast (host or viewer)
  const leaveBroadcast = useCallback(() => {
    setBroadcastState(null);
    setCurrentRoom(null);
    setIsHost(false);
    setIsViewer(false);
    setIsConnected(false);
    
    // Clear polling interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    // If we were a host, update the broadcast to inactive
    if (isHost && currentRoom) {
      updateBroadcast(currentRoom, {
        isActive: false,
        lastUpdateTimestamp: Date.now()
      }).catch(err => {
        console.error('❌ Error marking broadcast as inactive:', err);
      });
    }
  }, [isHost, currentRoom]);

  // Helper to clean up resources
  const cleanup = useCallback(() => {
    if (isHost && currentRoom) {
      // Mark the broadcast as inactive in the database
      updateBroadcast(currentRoom, { 
        isActive: false,
        lastUpdateTimestamp: Date.now()
      }).catch(err => {
        console.error('❌ Error marking broadcast as inactive:', err);
      });
      
      // Also update server-side status
      fetch(`/api/broadcast/${encodeURIComponent(currentRoom)}`, {
        method: 'DELETE'
      }).catch(err => {
        console.error('❌ Error marking broadcast as inactive on server:', err);
      });
    }
    
    // Clear intervals
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [isHost, currentRoom]);
  
  // Make sure to clean up on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    // State
    broadcastState,     // What viewers see from broadcaster
    currentRoom,        // Current broadcast room name
    isHost,            // Am I broadcasting?
    isViewer,          // Am I viewing someone's broadcast?
    isConnected,       // Is database connection active?

    // Actions
    startBroadcast,     // Start broadcasting
    joinBroadcast,      // Join someone's broadcast (returns unsubscribe)
    sendPerformanceState, // Send state to viewers (host only)
    leaveBroadcast,     // Disconnect
    cleanup            // Explicit cleanup function
  };
}