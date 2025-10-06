// broadcast-adapter.ts - Replaced with database-only approach
import { db } from './firebase-config';
import { collection, doc, getDocs, query, where, updateDoc } from 'firebase/firestore';
import type { BroadcastData } from './broadcast-firebase';

// Check if a broadcast exists in Firebase
export async function checkBroadcastExists(broadcastName: string): Promise<boolean> {
  try {
    // Make sure broadcastName is normalized (lowercase) for consistency
    const normalizedRoomName = broadcastName.toLowerCase().trim();
    
    const docSnap = await getDocs(query(
      collection(db, 'broadcasts'), 
      where('broadcastName', '==', normalizedRoomName)
    ));
    
    return !docSnap.empty;
  } catch (error) {
    console.error('❌ Error checking if broadcast exists:', error);
    return false;
  }
}

// Check if broadcast is still active (has recent updates)
export function isBroadcastActive(data: BroadcastData | null): boolean {
  if (!data) return false;
  
  // Consider inactive if explicitly marked inactive
  if (data.isActive === false) return false;
  
  // Check if broadcast has been updated in the last 10 seconds
  const now = Date.now();
  const lastUpdate = data.lastUpdateTimestamp || 0;
  
  // Broadcasts are considered active if updated in the last 10 seconds
  return (now - lastUpdate) < 10000;
}

// Normalize broadcast name for consistency
export function normalizeBroadcastName(name: string): string {
  return name.toLowerCase().trim();
}

// Update broadcast state in Firebase
export async function updateBroadcastState(roomId: string, state: any) {
  // Normalize room name
  const normalizedRoomId = normalizeBroadcastName(roomId);
  
  // Update Firebase with state data
  const broadcastRef = doc(collection(db, 'broadcasts'), normalizedRoomId);
  await updateDoc(broadcastRef, {
    curSong: state.currentSong,
    curTime: state.position,
    curWaveform: state.waveformData,
    curLyrics: state.currentLyricLine,
    lastUpdateTimestamp: Date.now(),
    isActive: true
  }).catch(error => {
    console.error('❌ Error updating Firebase broadcast:', error);
    throw error; // Re-throw for caller to handle
  });

  // Also ping the server to update session activity
  try {
    await fetch(`/api/broadcast/${encodeURIComponent(normalizedRoomId)}/ping`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('❌ Error pinging broadcast server:', error);
    // Don't throw here - Firebase update is more important
  }
}