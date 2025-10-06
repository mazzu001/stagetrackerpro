
import { useState, useRef, useCallback } from 'react';
import {
  createBroadcast,
  updateBroadcast,
  subscribeBroadcast,
  getBroadcast,
  endBroadcast,
  type BroadcastDoc
} from '@/lib/broadcast-firestore';

// Minimal, Firestore-native broadcast hook (no polling, no server endpoints, no local storage)
export function useBroadcast() {
  const [broadcast, setBroadcast] = useState<BroadcastDoc | null>(null);
  const [broadcastId, setBroadcastId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [isViewer, setIsViewer] = useState(false);
  const unsubscribeRef = useRef<null | (() => void)>(null);

  // Host: Start a new broadcast
  const startBroadcast = useCallback(async (id: string) => {
    await createBroadcast(id);
    setBroadcastId(id);
    setIsHost(true);
    setIsViewer(false);
    // Subscribe to own broadcast
    if (unsubscribeRef.current) unsubscribeRef.current();
    unsubscribeRef.current = subscribeBroadcast(id, setBroadcast);
  }, []);

  // Viewer: Join an existing broadcast
  const joinBroadcast = useCallback((id: string) => {
    setBroadcastId(id);
    setIsHost(false);
    setIsViewer(true);
    if (unsubscribeRef.current) unsubscribeRef.current();
    unsubscribeRef.current = subscribeBroadcast(id, setBroadcast);
  }, []);

  // Host: Update broadcast state (send to viewers)
  const update = useCallback((data: Partial<BroadcastDoc>) => {
    if (isHost && broadcastId) {
      updateBroadcast(broadcastId, data);
    }
  }, [isHost, broadcastId]);

  // Host: End broadcast
  const end = useCallback(() => {
    if (isHost && broadcastId) {
      endBroadcast(broadcastId);
    }
    leave();
  }, [isHost, broadcastId]);

  // Leave broadcast (host or viewer)
  const leave = useCallback(() => {
    setBroadcast(null);
    setBroadcastId(null);
    setIsHost(false);
    setIsViewer(false);
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
  }, []);

  return {
    broadcast,      // Current broadcast state (null if not joined)
    broadcastId,    // Broadcast document ID
    isHost,         // Am I the host?
    isViewer,       // Am I a viewer?
    startBroadcast, // Host: start a broadcast
    joinBroadcast,  // Viewer: join a broadcast
    update,         // Host: update broadcast state
    end,            // Host: end broadcast
    leave           // Leave broadcast (host or viewer)
  };
}