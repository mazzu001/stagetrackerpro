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
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

// Serve static files (performance.html, broadcast-viewer.html, etc.)
const rootDir = __dirname;
app.use(express.static(rootDir));

// Friendly aliases for extensionless routes
app.get('/performance', (req, res) => {
  res.sendFile(path.join(rootDir, 'performance.html'));
});

// Keep last known state per room so new viewers get an instant snapshot
const lastStateByRoom = new Map(); // room -> state

io.on('connection', (socket) => {
  let joinedRoom = null;
  let role = 'viewer';

  socket.on('host:join', ({ room, hostName }) => {
    try {
      if (!room || typeof room !== 'string') return;
      if (joinedRoom) socket.leave(joinedRoom);
      joinedRoom = room.trim();
      role = 'host';
      socket.join(joinedRoom);
      socket.emit('host:joined', { room: joinedRoom });
      // Optionally notify viewers that a host is present
      io.to(joinedRoom).emit('system', { type: 'host-online', hostName: hostName || 'Host' });
    } catch (e) { /* ignore */ }
  });

  socket.on('viewer:join', ({ room, displayName }) => {
    try {
      if (!room || typeof room !== 'string') return;
      if (joinedRoom) socket.leave(joinedRoom);
      joinedRoom = room.trim();
      role = 'viewer';
      socket.join(joinedRoom);
      socket.emit('viewer:joined', { room: joinedRoom });
      // Send last known state immediately if any
      const last = lastStateByRoom.get(joinedRoom);
      if (last) socket.emit('state:update', last);
    } catch (e) { /* ignore */ }
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
    // If host disconnects, viewers keep last state; we can also flag host offline
    if (role === 'host' && joinedRoom) {
      io.to(joinedRoom).emit('system', { type: 'host-offline' });
    }
  });
});

const PORT = process.env.PORT || 5173;
server.listen(PORT, () => {
  console.log(`StageTracker Pro server running at http://localhost:${PORT}`);
});
