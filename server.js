// Simple broadcasting server for StageTracker Pro
// - Serves static files from the project directory
// - Relays host state to viewers via Socket.IO rooms keyed by broadcast name

const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { 
    origin: '*', 
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 30000,
  pingInterval: 10000
});

// Content Security Policy: allow app assets, inline scripts used by pages, Google Fonts, and WebSockets
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "img-src 'self' data: blob:",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "connect-src 'self' ws: wss:",
  "frame-ancestors 'self'"
].join('; ');

app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', CSP);
  next();
});

// Serve static files (performance.html, broadcast-viewer.html, etc.)
const rootDir = __dirname;
app.use(express.static(rootDir));

// Friendly aliases for extensionless routes
app.get('/performance', (req, res) => {
  res.sendFile(path.join(rootDir, 'performance.html'));
});
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(rootDir, 'dashboard.html'));
});
app.get('/viewer', (req, res) => {
  res.sendFile(path.join(rootDir, 'broadcast-viewer.html'));
});

// Keep last known state per room so new viewers get an instant snapshot
const lastStateByRoom = new Map(); // room -> state
// Track active hosts by room
const activeHostsByRoom = new Map(); // room -> socketId

io.on('connection', (socket) => {
  console.log(`[Socket.IO] New connection: ${socket.id}`);
  
  let joinedRoom = null;
  let role = 'viewer';

  socket.on('host:join', ({ room, hostName }) => {
    console.log(`[Socket.IO] Host join attempt: ${socket.id}, Room: ${room}, Host: ${hostName}`);
    try {
      if (!room || typeof room !== 'string') {
        console.log(`[Socket.IO] Host join rejected - invalid room: ${room}`);
        return;
      }
      
      if (joinedRoom) {
        console.log(`[Socket.IO] Host leaving previous room: ${joinedRoom}`);
        socket.leave(joinedRoom);
      }
      
      joinedRoom = room.trim();
      role = 'host';
      console.log(`[Socket.IO] Host joining room: ${joinedRoom}`);
      
      socket.join(joinedRoom);
      // Register as active host for this room
      activeHostsByRoom.set(joinedRoom, socket.id);
      
      console.log(`[Socket.IO] Host registered for room: ${joinedRoom}, Total active hosts: ${activeHostsByRoom.size}`);
      socket.emit('host:joined', { room: joinedRoom });
      
      // Notify viewers that a host is present
      io.to(joinedRoom).emit('system', { type: 'host-online', hostName: hostName || 'Host' });
      console.log(`[Socket.IO] Notified viewers in room ${joinedRoom} that host is online`);
    } catch (e) { 
      console.error(`[Socket.IO] Error in host:join: ${e.message}`); 
    }
  });

  socket.on('viewer:join', ({ room, displayName }) => {
    console.log(`[Socket.IO] Viewer join attempt: ${socket.id}, Room: ${room}, Name: ${displayName}`);
    try {
      if (!room || typeof room !== 'string') {
        console.log(`[Socket.IO] Viewer join rejected - invalid room: ${room}`);
        socket.emit('viewer:rejected', { 
          reason: 'Invalid broadcast name. Please enter a valid name.'
        });
        return;
      }
      
      const trimmedRoom = room.trim();
      console.log(`[Socket.IO] Checking if room exists: ${trimmedRoom}`);
      
      // Check if the room has an active host or recent state
      const hasActiveHost = activeHostsByRoom.has(trimmedRoom);
      const hasRecentState = lastStateByRoom.has(trimmedRoom);
      
      console.log(`[Socket.IO] Room status - Has host: ${hasActiveHost}, Has state: ${hasRecentState}`);
      
      if (!hasActiveHost && !hasRecentState) {
        // No active host and no state - reject the connection
        console.log(`[Socket.IO] Viewer join rejected - no active broadcast for room: ${trimmedRoom}`);
        socket.emit('viewer:rejected', { 
          reason: 'Broadcast not found. The broadcast name may be incorrect or the broadcast has ended.'
        });
        return;
      }
      
      if (joinedRoom) {
        console.log(`[Socket.IO] Viewer leaving previous room: ${joinedRoom}`);
        socket.leave(joinedRoom);
      }
      
      joinedRoom = trimmedRoom;
      role = 'viewer';
      console.log(`[Socket.IO] Viewer joining room: ${joinedRoom}`);
      
      socket.join(joinedRoom);
      socket.emit('viewer:joined', { room: joinedRoom });
      console.log(`[Socket.IO] Viewer joined room: ${joinedRoom}`);
      
      // Send last known state immediately if any
      const last = lastStateByRoom.get(joinedRoom);
      if (last) {
        console.log(`[Socket.IO] Sending last state to viewer in room: ${joinedRoom}`);
        socket.emit('state:update', last);
      } else {
        console.log(`[Socket.IO] No state available to send for room: ${joinedRoom}`);
      }
    } catch (e) { 
      console.error(`[Socket.IO] Error in viewer:join: ${e.message}`);
      socket.emit('viewer:rejected', { 
        reason: 'Error joining broadcast. Please try again.'
      });
    }
  });

  socket.on('viewer:leave', ({ room }) => {
    try {
      if (!room) return;
      if (joinedRoom === room) {
        socket.leave(joinedRoom);
        joinedRoom = null;
        role = 'viewer';
      }
    } catch (_) {}
  });

  // Host pushes state snapshots here
  socket.on('state:push', ({ room, state }) => {
    if (role !== 'host' || !room || room !== joinedRoom) return;
    // Validate minimal payload
    if (!state || typeof state !== 'object') return;
    lastStateByRoom.set(room, state);
    socket.to(room).emit('state:update', state);
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.IO] Client disconnected: ${socket.id}, Role: ${role}, Room: ${joinedRoom}`);
    
    // If host disconnects, notify viewers and remove from active hosts
    if (role === 'host' && joinedRoom) {
      console.log(`[Socket.IO] Host disconnected from room: ${joinedRoom}`);
      io.to(joinedRoom).emit('system', { type: 'host-offline' });
      
      // Remove from active hosts if this socket was the registered host
      if (activeHostsByRoom.get(joinedRoom) === socket.id) {
        activeHostsByRoom.delete(joinedRoom);
        console.log(`[Socket.IO] Host removed from active hosts list. Room: ${joinedRoom}, Total active hosts: ${activeHostsByRoom.size}`);
        
        // Log active hosts for debugging
        console.log(`[Socket.IO] Active hosts: ${Array.from(activeHostsByRoom.entries()).map(([room, id]) => `${room}:${id}`).join(', ')}`);
      }
    } else if (role === 'viewer' && joinedRoom) {
      console.log(`[Socket.IO] Viewer disconnected from room: ${joinedRoom}`);
    }
  });
});

const PORT = process.env.PORT || 5173;
server.listen(PORT, () => {
  console.log(`StageTracker Pro server running at http://localhost:${PORT}`);
  console.log(`Socket.IO configured with transports: ${io.engine.opts.transports.join(', ')}`);
  console.log('Access broadcast viewer at: http://localhost:' + PORT + '/viewer');
  console.log('Broadcasting info available at startup!');
});
