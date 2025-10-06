import { doc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { db } from './firebase-config';

// Use local dev server simple in-memory endpoints (kept for backwards compatibility)
const SERVER = 'http://localhost:5000';

export const Broadcast = {
  // 1. Create broadcast (simple local)
  async create(broadcastName: string) {
    const response = await fetch(`${SERVER}/api/simple-broadcast/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: broadcastName, name: broadcastName })
    });
    return response.ok;
  },

  // 2. Send song
  async sendSong(broadcastName: string, songName: string, artist: string, lyrics: string, waveform: any) {
    const response = await fetch(`${SERVER}/api/simple-broadcast/${broadcastName}/state`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentSong: { songName, artist, lyrics, waveform }, position: 0, isPlaying: false })
    });
    return response.ok;
  },

  // 3. Send position
  async sendPosition(broadcastName: string, position: number, isPlaying: boolean) {
    const response = await fetch(`${SERVER}/api/simple-broadcast/${broadcastName}/state`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ position, isPlaying })
    });
    return response.ok;
  },

  // 4. Get broadcast data (deprecated - use SimpleBroadcastViewer for real-time sync)
  async getData(broadcastName: string) {
    const response = await fetch(`${SERVER}/api/simple-broadcast/${broadcastName}`);
    if (!response.ok) return null;
    const text = await response.text();
    if (text.startsWith('<!DOCTYPE') || text.startsWith('<html')) {
      console.warn('[Broadcast.getData] Received HTML instead of JSON', { url: `${SERVER}/api/simple-broadcast/${broadcastName}` });
      return null;
    }
    try {
      return JSON.parse(text);
    } catch (e) {
      console.error('[Broadcast.getData] JSON parse failed', e, { raw: text.slice(0,200) });
      return null;
    }
  }
};

/**
 * SimpleBroadcastViewer - Firebase Firestore real-time broadcast viewer
 * Replaces polling-based approach with real-time Firestore synchronization
 */
export class SimpleBroadcastViewer {
  private unsubscribe: Unsubscribe | null = null;
  private onUpdate: ((data: any) => void) | null = null;
  private onEnd: (() => void) | null = null;
  private broadcastName: string = '';

  /**
   * Connect to a broadcast session using Firebase Firestore
   * @param broadcastName - The normalized broadcast session name
   * @param onUpdate - Callback for broadcast state updates
   * @param onEnd - Callback when broadcast ends
   */
  async connect(
    broadcastName: string, 
    onUpdate: (data: any) => void,
    onEnd: () => void
  ): Promise<void> {
    this.broadcastName = broadcastName.toLowerCase().trim();
    this.onUpdate = onUpdate;
    this.onEnd = onEnd;
    
    console.log(`📡 Connecting to Firebase broadcast: ${this.broadcastName}`);
    
    // Subscribe to Firestore document for real-time updates
    const docRef = doc(db, 'broadcasts', this.broadcastName);
    
    this.unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          console.log('📡 Received broadcast update from Firebase:', {
            curTimeDs: data.curTimeDs,
            isPlaying: data.isPlaying,
            curSong: data.curSong
          });
          
          // Forward update to callback
          if (this.onUpdate) {
            this.onUpdate(data);
          }
        } else {
          console.log('❌ Broadcast document not found in Firebase');
          this.handleBroadcastEnd();
        }
      },
      (error) => {
        console.error('❌ Firebase snapshot error:', error);
        this.handleBroadcastEnd();
      }
    );
    
    console.log(`✅ Connected to Firebase broadcast: ${this.broadcastName}`);
  }

  /**
   * Disconnect from the broadcast session
   */
  disconnect(): void {
    console.log(`📡 Disconnecting from broadcast: ${this.broadcastName}`);
    
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    
    this.onUpdate = null;
    this.onEnd = null;
    this.broadcastName = '';
  }

  /**
   * Handle broadcast ended or error
   */
  private handleBroadcastEnd(): void {
    console.log('❌ Broadcast ended or connection lost');
    
    if (this.onEnd) {
      this.onEnd();
    }
    
    this.disconnect();
  }

  /**
   * Check if viewer is currently connected
   */
  isConnected(): boolean {
    return this.unsubscribe !== null;
  }

  /**
   * Get current broadcast name
   */
  getBroadcastName(): string {
    return this.broadcastName;
  }
}