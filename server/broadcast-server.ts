import WebSocket, { WebSocketServer } from 'ws';
import { db } from './db';
import { broadcastSessions } from '../shared/schema';
import { eq, sql } from 'drizzle-orm';
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
  songEntryId?: string; // Database ID of the broadcast song entry
  position: number;
  isPlaying: boolean;
  currentLyricLine?: string;
  waveformProgress: number;
  // Removed full song data - viewers fetch from database using songEntryId
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

  private async handleMessage(ws: WebSocket, roomId: string, message: any) {
    console.log(`📨 Server received message:`, { 
      type: message.type, 
      roomId, 
      hasSongEntryId: !!message.state?.songEntryId 
    });
    
    switch (message.type) {
      case 'host_connect':
        this.handleHostConnect(ws, roomId, message);
        break;
      case 'viewer_connect':
        await this.handleViewerConnect(ws, roomId, message);
        break;
      case 'state_update':
        this.handleStateUpdate(roomId, message.state);
        break;
      default:
        console.log(`❓ Unknown message type: ${message.type}`);
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

  private async handleViewerConnect(ws: WebSocket, roomId: string, message: any) {
    const { userId, userName } = message;
    console.log(`📺 Processing viewer_connect for room ${roomId}, user: ${userName}`);
    
    let room = this.rooms.get(roomId);

    // If room not found in memory, check database and recreate if active
    if (!room || !room.isActive) {
      try {
        // Simple SQL query - use ACTUAL database columns!
        const result = await db.execute(sql`
          SELECT id, name, host_id, host_name, is_active, created_at
          FROM broadcast_sessions 
          WHERE id = ${roomId} AND is_active = true
          LIMIT 1
        `);
          
        if (result.rows.length > 0) {
          const dbSession = result.rows[0];
          console.log(`🔄 Recreating WebSocket room from database session: ${roomId}`);
          // Recreate room from database session
          room = {
            id: dbSession.id as string,
            name: dbSession.name as string,
            hostId: dbSession.host_id as string,
            hostName: dbSession.host_name as string,
            host: null, // Host will reconnect separately
            viewers: new Map(),
            isActive: true,
            createdAt: new Date(dbSession.created_at as string)
          };
          this.rooms.set(roomId, room);
        } else {
          console.log(`❌ Room ${roomId} not found in database or inactive`);
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Room not found or not active'
          }));
          ws.close(1000, 'Room not found');
          return;
        }
      } catch (error) {
        console.error(`❌ Error checking database for room ${roomId}:`, error);
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Room not found or not active'
        }));
        ws.close(1000, 'Room not found');
        return;
      }
    }

    room.viewers.set(userId, { ws, userId, userName });
    console.log(`✅ Viewer ${userName} joined broadcast: ${roomId}, total viewers: ${room.viewers.size}`);

    // Update room info for all participants
    this.sendRoomInfo(room);
  }

  private handleStateUpdate(roomId: string, state: BroadcastState) {
    const room = this.rooms.get(roomId);
    if (!room || !room.isActive) {
      console.log(`❌ State update failed: Room ${roomId} not found or inactive`);
      return;
    }

    console.log(`🎭 Server received state update for room ${roomId}:`, {
      songEntryId: state.songEntryId,
      songTitle: state.songTitle,
      viewerCount: room.viewers.size
    });

    // Broadcast state to all viewers
    const stateMessage = JSON.stringify({
      type: 'state_update',
      state
    });

    let sentCount = 0;
    Array.from(room.viewers.values()).forEach(({ ws, userName }) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(stateMessage);
        sentCount++;
        console.log(`📺 State forwarded to viewer: ${userName}`);
      }
    });

    console.log(`✅ State update broadcasted to ${sentCount}/${room.viewers.size} viewers`);
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