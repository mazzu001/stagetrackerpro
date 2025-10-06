import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as express from 'express';
import * as cors from 'cors';

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Create Express app
const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// In-memory storage for quick access (sessions will persist in Firestore)
const broadcasts = new Map<string, any>();
const broadcastStates = new Map<string, any>();
const songs = new Map<string, any>();

// Helper function to sync from Firestore
async function syncFromFirestore() {
  try {
    const broadcastsSnapshot = await db.collection('broadcasts').get();
    broadcastsSnapshot.docs.forEach(doc => {
      broadcasts.set(doc.id, doc.data());
    });
    
    const statesSnapshot = await db.collection('broadcast_states').get();
    statesSnapshot.docs.forEach(doc => {
      broadcastStates.set(doc.id, doc.data());
    });
    
    const songsSnapshot = await db.collection('broadcast_songs').get();
    songsSnapshot.docs.forEach(doc => {
      songs.set(doc.id, doc.data());
    });
  } catch (error) {
    console.error('Error syncing from Firestore:', error);
  }
}

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'BandMaestro Broadcast Server (Firebase Functions)', 
    status: 'running',
    time: new Date().toISOString(),
    activeBroadcasts: broadcasts.size
  });
});

// Start a broadcast
app.post('/api/broadcast/create', async (req, res) => {
  const { id, name, hostName } = req.body;
  
  const broadcastData = {
    id,
    name: name || `${hostName}'s Broadcast`,
    hostName: hostName || 'Host',
    isActive: true,
    lastActivity: Date.now(),
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  };
  
  try {
    // Store in Firestore
    await db.collection('broadcasts').doc(id).set(broadcastData);
    
    // Store in memory
    broadcasts.set(id, broadcastData);
    
    console.log(`📻 Started broadcast: ${id} by ${hostName}`);
    res.json({ success: true, broadcast: broadcastData });
  } catch (error) {
    console.error('Error creating broadcast:', error);
    res.status(500).json({ error: 'Failed to create broadcast' });
  }
});

// Get broadcast info
app.get('/api/broadcast/:id', async (req, res) => {
  const broadcastId = req.params.id;
  
  try {
    // Try memory first
    let broadcast = broadcasts.get(broadcastId);
    
    // If not in memory, try Firestore
    if (!broadcast) {
      const doc = await db.collection('broadcasts').doc(broadcastId).get();
      if (doc.exists) {
        broadcast = doc.data();
        broadcasts.set(broadcastId, broadcast);
      }
    }
    
    if (broadcast) {
      console.log(`📊 Fetched broadcast info: ${broadcastId}`);
      res.json(broadcast);
    } else {
      console.log(`❌ Broadcast not found: ${broadcastId}`);
      res.status(404).json({ error: 'Broadcast not found' });
    }
  } catch (error) {
    console.error('Error fetching broadcast:', error);
    res.status(500).json({ error: 'Failed to fetch broadcast' });
  }
});

// Get broadcast state (position, playing status)
app.get('/api/broadcast/:id/state', async (req, res) => {
  const broadcastId = req.params.id;
  
  try {
    // Try memory first
    let state = broadcastStates.get(broadcastId);
    
    // If not in memory, try Firestore
    if (!state) {
      const doc = await db.collection('broadcast_states').doc(broadcastId).get();
      if (doc.exists) {
        state = doc.data();
        broadcastStates.set(broadcastId, state);
      }
    }
    
    if (state) {
      console.log(`📊 Fetched broadcast state: ${broadcastId}`);
      res.json(state);
    } else {
      console.log(`❌ Broadcast state not found: ${broadcastId}`);
      res.status(404).json({ error: 'Broadcast state not found' });
    }
  } catch (error) {
    console.error('Error fetching broadcast state:', error);
    res.status(500).json({ error: 'Failed to fetch broadcast state' });
  }
});

// Update broadcast state (song and position)
app.put('/api/broadcast/:id/state', async (req, res) => {
  const broadcastId = req.params.id;
  const { position, isPlaying, lastUpdated } = req.body;
  
  try {
    // Get current state
    const currentState = broadcastStates.get(broadcastId) || {};
    
    const newState = {
      ...currentState,
      position: position || 0,
      isPlaying: isPlaying !== undefined ? isPlaying : false,
      lastUpdated: lastUpdated || Date.now(),
      isActive: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    // Update Firestore
    await db.collection('broadcast_states').doc(broadcastId).set(newState, { merge: true });
    
    // Update memory
    broadcastStates.set(broadcastId, newState);
    
    console.log(`📻 Updated broadcast state ${broadcastId}: position=${position}s, playing=${isPlaying}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating broadcast state:', error);
    res.status(500).json({ error: 'Failed to update broadcast state' });
  }
});

// Send song data
app.put('/api/broadcast/:id/song', async (req, res) => {
  const broadcastId = req.params.id;
  const { song } = req.body;
  
  if (!song || !song.id) {
    res.status(400).json({ error: 'Song data required' });
    return;
  }
  
  try {
    // Store song data in Firestore
    await db.collection('broadcast_songs').doc(song.id).set({
      ...song,
      broadcastId,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Store in memory
    songs.set(song.id, song);
    
    // Update broadcast state with current song
    const currentState = broadcastStates.get(broadcastId) || {};
    const newState = {
      ...currentState,
      currentSong: song.id,
      position: 0,
      isPlaying: true,
      duration: song.duration || 0,
      lastUpdated: Date.now(),
      isActive: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    // Update state in Firestore
    await db.collection('broadcast_states').doc(broadcastId).set(newState, { merge: true });
    
    // Update memory
    broadcastStates.set(broadcastId, newState);
    
    console.log(`📻 Updated broadcast ${broadcastId} with song: ${song.title}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating broadcast song:', error);
    res.status(500).json({ error: 'Failed to update broadcast song' });
  }
});

// Get song data
app.get('/api/broadcast/song/:songId', async (req, res) => {
  const songId = req.params.songId;
  
  try {
    // Try memory first
    let song = songs.get(songId);
    
    // If not in memory, try Firestore
    if (!song) {
      const doc = await db.collection('broadcast_songs').doc(songId).get();
      if (doc.exists) {
        song = doc.data();
        songs.set(songId, song);
      }
    }
    
    if (song) {
      console.log(`🎵 Fetched song: ${song.title}`);
      res.json({ song });
    } else {
      console.log(`❌ Song not found: ${songId}`);
      res.status(404).json({ error: 'Song not found' });
    }
  } catch (error) {
    console.error('Error fetching song:', error);
    res.status(500).json({ error: 'Failed to fetch song' });
  }
});

// Stop broadcast
app.delete('/api/broadcast/:id', async (req, res) => {
  const broadcastId = req.params.id;
  
  try {
    // Mark as inactive in Firestore
    await db.collection('broadcasts').doc(broadcastId).update({
      isActive: false,
      endedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Remove from memory
    broadcasts.delete(broadcastId);
    broadcastStates.delete(broadcastId);
    
    console.log(`📻 Stopped broadcast: ${broadcastId}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Error stopping broadcast:', error);
    res.status(500).json({ error: 'Failed to stop broadcast' });
  }
});

// List all active broadcasts (for debugging)
app.get('/api/broadcasts', async (req, res) => {
  try {
    await syncFromFirestore();
    const activeBroadcasts = Array.from(broadcasts.values()).filter(b => b.isActive);
    res.json({ broadcasts: activeBroadcasts });
  } catch (error) {
    console.error('Error fetching broadcasts:', error);
    res.status(500).json({ error: 'Failed to fetch broadcasts' });
  }
});

// Initialize memory from Firestore on cold start
syncFromFirestore();

// Export the Cloud Function
export const broadcastApi = functions.https.onRequest(app);