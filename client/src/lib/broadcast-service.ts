// Simple broadcast service - completely isolated from existing code
export interface BroadcastState {
  currentSong?: string;
  songTitle?: string;
  position: number; // seconds
  isPlaying: boolean;
  currentLyricLine?: string;
  waveformProgress: number; // 0-1
}

export interface BroadcastRoom {
  id: string;
  name: string;
  hostId: string;
  hostName: string;
  participantCount: number;
  isActive: boolean;
}

class BroadcastService {
  private ws: WebSocket | null = null;
  private isHost = false;
  private roomId: string | null = null;
  private listeners: Array<(state: BroadcastState) => void> = [];
  private roomListeners: Array<(room: BroadcastRoom | null) => void> = [];

  // Subscribe to broadcast state changes
  onStateChange(callback: (state: BroadcastState) => void) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  // Subscribe to room info changes  
  onRoomChange(callback: (room: BroadcastRoom | null) => void) {
    this.roomListeners.push(callback);
    return () => {
      this.roomListeners = this.roomListeners.filter(cb => cb !== callback);
    };
  }

  // Host: Start broadcasting
  async startBroadcast(userId: string, userName: string, broadcastName: string): Promise<string> {
    // Use the broadcast name directly as the room ID (no random generation)
    const roomId = broadcastName.trim();
    
    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws/broadcast/${encodeURIComponent(roomId)}`;
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        this.ws?.send(JSON.stringify({
          type: 'host_connect',
          userId,
          userName,
          broadcastName
        }));
        this.isHost = true;
        this.roomId = roomId;
        console.log(`📡 Started broadcasting: "${roomId}"`);
      };

      this.ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.type === 'room_info') {
          this.roomListeners.forEach(cb => cb(message.room));
        }
      };

      this.ws.onclose = () => {
        console.log('📡 Broadcast WebSocket closed');
      };

      return roomId;
    } catch (error) {
      console.warn('Broadcast WebSocket failed, continuing offline:', error);
      // Graceful degradation - still works offline
      return roomId;
    }
  }

  // Viewer: Join broadcast
  async joinBroadcast(broadcastName: string, userId: string, userName: string): Promise<boolean> {
    try {
      // Use the broadcast name directly as the room ID
      const roomId = broadcastName.trim();
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws/broadcast/${encodeURIComponent(roomId)}`;
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        this.ws?.send(JSON.stringify({
          type: 'viewer_connect', 
          userId,
          userName
        }));
        this.isHost = false;
        this.roomId = roomId;
        console.log(`📺 Joined broadcast: "${roomId}"`);
      };

      this.ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        console.log('📺 Viewer received message:', message);
        if (message.type === 'state_update') {
          console.log('📺 Processing broadcast state update:', message.state);
          this.listeners.forEach(cb => cb(message.state));
        } else if (message.type === 'room_info') {
          console.log('📺 Room info updated:', message.room);
          this.roomListeners.forEach(cb => cb(message.room));
        }
      };

      this.ws.onclose = () => {
        console.log('📺 Viewer WebSocket closed');
      };

      return true;
    } catch (error) {
      console.warn('Failed to join broadcast:', error);
      return false;
    }
  }

  // Host: Send state update to viewers
  sendState(state: BroadcastState) {
    if (this.isHost && this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('📡 Broadcasting state to viewers:', state);
      this.ws.send(JSON.stringify({
        type: 'state_update',
        state
      }));
    } else {
      console.log('📡 Not broadcasting - host:', this.isHost, 'ws ready:', this.ws?.readyState === WebSocket.OPEN);
    }
  }

  // Leave broadcast
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isHost = false;
    this.roomId = null;
    this.listeners = [];
    this.roomListeners = [];
  }

  // Getters
  getRoomId() { return this.roomId; }
  getIsHost() { return this.isHost; }
  getIsConnected() { return this.ws?.readyState === WebSocket.OPEN; }

  // No longer need to generate random IDs - we use user-provided names directly
}

// Singleton instance
export const broadcastService = new BroadcastService();