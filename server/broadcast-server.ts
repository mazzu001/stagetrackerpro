import WebSocket, { WebSocketServer } from 'ws';
import type { Server } from 'http';

interface BroadcastRoom {
  id: string;
  name: string;
  hostId: string;
  hostName: string;
  host: WebSocket | null;
  viewers: Map<string, { ws: WebSocket; userId: string; userName: string }>;
  isActive: boolean;
  createdAt: Date;
}

interface BroadcastState {
  currentSong?: string;
  songTitle?: string;
  position: number;
  isPlaying: boolean;
  currentLyricLine?: string;
  waveformProgress: number;
}

class BroadcastServer {
  private rooms = new Map<string, BroadcastRoom>();
  private wss: WebSocketServer;

  constructor(server: Server) {
    // Create WebSocket server on /ws/broadcast path (handles subpaths)
    this.wss = new WebSocketServer({ 
      server,
      verifyClient: (info) => {
        // Allow connections to /ws/broadcast/* paths
        return info.req.url?.startsWith('/ws/broadcast/') || false;
      }
    });

    this.wss.on('connection', this.handleConnection.bind(this));
    console.log('📡 Broadcast WebSocket server initialized on /ws/broadcast/*');
  }

  private handleConnection(ws: WebSocket, request: any) {
    const url = new URL(request.url!, `http://${request.headers.host}`);
    const roomId = url.pathname.split('/').pop();
    
    if (!roomId) {
      ws.close(1000, 'Invalid room ID');
      return;
    }

    console.log(`📡 New WebSocket connection for room: ${roomId}`);

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(ws, roomId, message);
      } catch (error) {
        console.error('Invalid WebSocket message:', error);
      }
    });

    ws.on('close', () => {
      this.handleDisconnection(ws, roomId);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  }

  private handleMessage(ws: WebSocket, roomId: string, message: any) {
    switch (message.type) {
      case 'host_connect':
        this.handleHostConnect(ws, roomId, message);
        break;
      case 'viewer_connect':
        this.handleViewerConnect(ws, roomId, message);
        break;
      case 'state_update':
        this.handleStateUpdate(roomId, message.state);
        break;
    }
  }

  private handleHostConnect(ws: WebSocket, roomId: string, message: any) {
    const { userId, userName, broadcastName } = message;

    const room: BroadcastRoom = {
      id: roomId,
      name: broadcastName,
      hostId: userId,
      hostName: userName,
      host: ws,
      viewers: new Map(),
      isActive: true,
      createdAt: new Date()
    };

    this.rooms.set(roomId, room);
    console.log(`📡 Host ${userName} started broadcast: ${roomId} - ${broadcastName}`);

    // Send room info to host
    this.sendRoomInfo(room);
  }

  private handleViewerConnect(ws: WebSocket, roomId: string, message: any) {
    const { userId, userName } = message;
    const room = this.rooms.get(roomId);

    if (!room || !room.isActive) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Room not found or not active'
      }));
      ws.close(1000, 'Room not found');
      return;
    }

    room.viewers.set(userId, { ws, userId, userName });
    console.log(`📺 Viewer ${userName} joined broadcast: ${roomId}`);

    // Update room info for all participants
    this.sendRoomInfo(room);
  }

  private handleStateUpdate(roomId: string, state: BroadcastState) {
    const room = this.rooms.get(roomId);
    if (!room || !room.isActive) return;

    // Broadcast state to all viewers
    const stateMessage = JSON.stringify({
      type: 'state_update',
      state
    });

    Array.from(room.viewers.values()).forEach(({ ws }) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(stateMessage);
      }
    });
  }

  private handleDisconnection(ws: WebSocket, roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    // Check if host disconnected
    if (room.host === ws) {
      console.log(`📡 Host disconnected from room: ${roomId}`);
      room.isActive = false;
      
      // Notify all viewers
      const closeMessage = JSON.stringify({
        type: 'broadcast_ended',
        message: 'Host has ended the broadcast'
      });

      Array.from(room.viewers.values()).forEach(({ ws: viewerWs }) => {
        if (viewerWs.readyState === WebSocket.OPEN) {
          viewerWs.send(closeMessage);
          viewerWs.close(1000, 'Broadcast ended');
        }
      });

      // Clean up room
      this.rooms.delete(roomId);
      return;
    }

    // Remove viewer
    for (const [userId, viewer] of room.viewers) {
      if (viewer.ws === ws) {
        room.viewers.delete(userId);
        console.log(`📺 Viewer disconnected from room: ${roomId}`);
        this.sendRoomInfo(room);
        break;
      }
    }
  }

  private sendRoomInfo(room: BroadcastRoom) {
    const roomInfo = {
      type: 'room_info',
      room: {
        id: room.id,
        name: room.name,
        hostId: room.hostId,
        hostName: room.hostName,
        participantCount: room.viewers.size + 1, // +1 for host
        isActive: room.isActive
      }
    };

    const message = JSON.stringify(roomInfo);

    // Send to host
    if (room.host && room.host.readyState === WebSocket.OPEN) {
      room.host.send(message);
    }

    // Send to all viewers
    Array.from(room.viewers.values()).forEach(({ ws }) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }

  // Clean up inactive rooms periodically
  public startCleanup() {
    setInterval(() => {
      const now = new Date();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours

      for (const [roomId, room] of Array.from(this.rooms.entries())) {
        if (!room.isActive || (now.getTime() - room.createdAt.getTime()) > maxAge) {
          console.log(`🧹 Cleaning up inactive room: ${roomId}`);
          this.rooms.delete(roomId);
        }
      }
    }, 60 * 60 * 1000); // Check every hour
  }
}

export function setupBroadcastServer(server: Server) {
  const broadcastServer = new BroadcastServer(server);
  broadcastServer.startCleanup();
  return broadcastServer;
}