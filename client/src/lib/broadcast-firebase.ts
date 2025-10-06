// Firestore-based broadcast service
import { collection, doc, setDoc, updateDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase-config';

export interface BroadcastData {
  broadcastName: string;
  curSong?: string;
  curWaveform?: string;
  curLyrics?: string;
  curTime?: number;
  artistName?: string;
  lastUpdateTimestamp?: number;  // Timestamp of last update (for freshness check)
  isActive?: boolean;           // Whether the broadcast is active
  isPlaying?: boolean;          // Whether playback is currently active
  duration?: number;            // Total duration of the current song
}

export async function createBroadcast(broadcastName: string) {
  const ref = doc(collection(db, 'broadcasts'), broadcastName);
  await setDoc(ref, { 
    broadcastName,
    lastUpdateTimestamp: Date.now(),
    isActive: true
  });
}

export async function updateBroadcast(broadcastName: string, data: Partial<BroadcastData>) {
  const ref = doc(collection(db, 'broadcasts'), broadcastName);
  await updateDoc(ref, data);
}

export function subscribeToBroadcast(broadcastName: string, cb: (data: BroadcastData) => void) {
  const ref = doc(collection(db, 'broadcasts'), broadcastName);
  return onSnapshot(ref, (snap) => {
    if (snap.exists()) cb(snap.data() as BroadcastData);
  });
}

export async function getBroadcast(broadcastName: string) {
  const ref = doc(collection(db, 'broadcasts'), broadcastName);
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data() as BroadcastData) : null;
}
