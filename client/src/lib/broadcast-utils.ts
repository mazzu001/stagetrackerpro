// broadcast-utils.ts - Simple utilities for the database-only broadcasting approach
import { db } from './firebase-config';
import { collection, doc, getDocs, query, where } from 'firebase/firestore';
import type { BroadcastData } from './broadcast-firebase';

// Check if a broadcast exists in Firebase
export async function checkBroadcastExists(broadcastName: string): Promise<boolean> {
  try {
    // Make sure broadcastName is normalized (lowercase) for consistency
    const normalizedRoomName = broadcastName.toLowerCase();
    
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