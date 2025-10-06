import { doc, setDoc, updateDoc, getDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase-config';

export interface BroadcastDoc {
  curSong: string | null;
  curLyrics: string | null;
  curWaveform: string | null;
  curTimeDs: number; // deciseconds, 0–65535
  isPlaying: boolean;
  isActive: boolean;
  songMeta?: { title?: string; artist?: string; duration?: number };
  updatedAt?: any;
}

export async function createBroadcast(id: string) {
  await setDoc(doc(db, 'broadcasts', id), {
    curSong: null,
    curLyrics: null,
    curWaveform: null,
    curTimeDs: 0,
    isPlaying: false,
    isActive: true,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

export async function updateBroadcast(id: string, data: Partial<BroadcastDoc>) {
  await updateDoc(doc(db, 'broadcasts', id), { ...data, updatedAt: serverTimestamp() });
}

export function subscribeBroadcast(id: string, cb: (b: BroadcastDoc | null) => void) {
  return onSnapshot(doc(db, 'broadcasts', id), snap => cb(snap.exists() ? snap.data() as BroadcastDoc : null));
}

export async function getBroadcast(id: string): Promise<BroadcastDoc | null> {
  const snap = await getDoc(doc(db, 'broadcasts', id));
  return snap.exists() ? snap.data() as BroadcastDoc : null;
}

export async function endBroadcast(id: string) {
  await updateBroadcast(id, { isActive: false, isPlaying: false });
}

export function formatTimeDs(ds: number) {
  const totalSec = ds / 10;
  const min = Math.floor(totalSec / 60);
  const sec = Math.floor(totalSec % 60);
  const hundredths = (ds % 10) * 10;
  return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}.${hundredths.toString().padStart(2, '0')}`;
}
