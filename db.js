// IndexedDB utility for StageTracker Pro
// Uses idb library for simplicity (can be replaced with vanilla IndexedDB)

const DB_NAME = 'StageTrackerPro';
const DB_VERSION = 2;
const SONG_STORE = 'songs';
const TRACK_STORE = 'tracks';
const AUDIO_STORE = 'audioFiles';
const WAVEFORM_STORE = 'waveforms';

let dbPromise = null;

function openDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function(e) {
        const db = req.result;
        if (!db.objectStoreNames.contains(SONG_STORE)) {
          db.createObjectStore(SONG_STORE, { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains(TRACK_STORE)) {
          const trackStore = db.createObjectStore(TRACK_STORE, { keyPath: 'id', autoIncrement: true });
          trackStore.createIndex('songId', 'songId', { unique: false });
        }
        if (!db.objectStoreNames.contains(AUDIO_STORE)) {
          const audioStore = db.createObjectStore(AUDIO_STORE, { keyPath: 'id', autoIncrement: true });
          audioStore.createIndex('trackId', 'trackId', { unique: false });
        }
        if (!db.objectStoreNames.contains(WAVEFORM_STORE)) {
          // Use a composite string key so we can upsert by (type,songId,trackId)
          const wf = db.createObjectStore(WAVEFORM_STORE, { keyPath: 'key' });
          wf.createIndex('songId', 'songId', { unique: false });
          wf.createIndex('trackId', 'trackId', { unique: false });
          wf.createIndex('type', 'type', { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

// Danger: Deletes the entire IndexedDB database for StageTracker Pro.
// Use for factory reset / clearing artifacts.
export async function wipeDatabase() {
  return new Promise((resolve, reject) => {
    try {
      const req = indexedDB.deleteDatabase(DB_NAME);
      req.onsuccess = () => { dbPromise = null; resolve(); };
      req.onerror = () => reject(req.error);
      req.onblocked = () => {
        // If blocked by open connections, we still resolve after a short delay; a reload is recommended.
        setTimeout(() => { resolve(); }, 300);
      };
    } catch (e) {
      reject(e);
    }
  });
}

// Song CRUD
export async function addSong(song) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SONG_STORE, 'readwrite');
    const store = tx.objectStore(SONG_STORE);
    const req = store.add(song);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getSongs() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SONG_STORE, 'readonly');
    const store = tx.objectStore(SONG_STORE);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function updateSong(song) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SONG_STORE, 'readwrite');
    const store = tx.objectStore(SONG_STORE);
    const req = store.put(song);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteSong(id) {
  const db = await openDB();
  // Cascade delete: tracks, audio files, per-track waveforms, and master waveform for this song
  // 1) Gather tracks for the song
  const tracks = await new Promise((resolve, reject) => {
    const tx = db.transaction(TRACK_STORE, 'readonly');
    const store = tx.objectStore(TRACK_STORE);
    const idx = store.index('songId');
    const req = idx.getAll(id);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
  // 2) For each track: delete audio files, then the track
  for (const t of tracks) {
    // Delete audio files for this track
    const files = await new Promise((resolve, reject) => {
      const tx = db.transaction(AUDIO_STORE, 'readonly');
      const store = tx.objectStore(AUDIO_STORE);
      const idx = store.index('trackId');
      const req = idx.getAll(t.id);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
    for (const f of files) {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(AUDIO_STORE, 'readwrite');
        const store = tx.objectStore(AUDIO_STORE);
        const req = store.delete(f.id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    }
    // Delete the track
    await new Promise((resolve, reject) => {
      const tx = db.transaction(TRACK_STORE, 'readwrite');
      const store = tx.objectStore(TRACK_STORE);
      const req = store.delete(t.id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
  // 3) Delete ALL waveform records (master and per-track) tied to this song (safety net)
  try {
    const waveRecs = await new Promise((resolve, reject) => {
      const tx = db.transaction(WAVEFORM_STORE, 'readonly');
      const store = tx.objectStore(WAVEFORM_STORE);
      const idx = store.index('songId');
      const req = idx.getAll(id);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
    if (waveRecs && waveRecs.length) {
      // Delete in a single RW txn for efficiency
      await new Promise((resolve, reject) => {
        const tx = db.transaction(WAVEFORM_STORE, 'readwrite');
        const store = tx.objectStore(WAVEFORM_STORE);
        let remaining = waveRecs.length;
        if (remaining === 0) { resolve(); return; }
        waveRecs.forEach((rec) => {
          const del = store.delete(rec.key);
          del.onsuccess = () => { if (--remaining === 0) resolve(); };
          del.onerror = () => { if (--remaining === 0) resolve(); /* best-effort */ };
        });
      });
    }
  } catch(_) {}
  // 4) Finally delete the song itself
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SONG_STORE, 'readwrite');
    const store = tx.objectStore(SONG_STORE);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// Track CRUD
export async function addTrack(track) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(TRACK_STORE, 'readwrite');
    const store = tx.objectStore(TRACK_STORE);
    const req = store.add(track);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getTracks(songId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(TRACK_STORE, 'readonly');
    const store = tx.objectStore(TRACK_STORE);
    const idx = store.index('songId');
    const req = idx.getAll(songId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function updateTrack(track) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(TRACK_STORE, 'readwrite');
    const store = tx.objectStore(TRACK_STORE);
    const req = store.put(track);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteTrack(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(TRACK_STORE, 'readwrite');
    const store = tx.objectStore(TRACK_STORE);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// Audio file CRUD
export async function addAudioFile(audio) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(AUDIO_STORE, 'readwrite');
    const store = tx.objectStore(AUDIO_STORE);
    const req = store.add(audio);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getAudioFiles(trackId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(AUDIO_STORE, 'readonly');
    const store = tx.objectStore(AUDIO_STORE);
    const idx = store.index('trackId');
    const req = idx.getAll(trackId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function updateAudioFile(audio) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(AUDIO_STORE, 'readwrite');
    const store = tx.objectStore(AUDIO_STORE);
    const req = store.put(audio);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteAudioFile(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(AUDIO_STORE, 'readwrite');
    const store = tx.objectStore(AUDIO_STORE);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// Waveforms CRUD
function makeWaveKey(type, songId, trackId) {
  return `${type}:${songId}:${trackId||0}`;
}

// wf = { type: 'track'|'master', songId: number, trackId?: number|null, bins: number, peaks: Uint8Array }
export async function putWaveform(wf) {
  const db = await openDB();
  const key = makeWaveKey(wf.type, wf.songId, wf.trackId || 0);
  const rec = { key, type: wf.type, songId: wf.songId, trackId: wf.trackId || null, bins: wf.bins, peaks: wf.peaks };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(WAVEFORM_STORE, 'readwrite');
    const store = tx.objectStore(WAVEFORM_STORE);
    const req = store.put(rec);
    req.onsuccess = () => resolve(key);
    req.onerror = () => reject(req.error);
  });
}

export async function getWaveformByTrack(trackId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(WAVEFORM_STORE, 'readonly');
    const store = tx.objectStore(WAVEFORM_STORE);
    const idx = store.index('trackId');
    const req = idx.getAll(trackId);
    req.onsuccess = () => {
      const list = req.result || [];
      // There should be at most one per track
      resolve(list.find(w => w.type === 'track') || null);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getMasterWaveformBySong(songId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(WAVEFORM_STORE, 'readonly');
    const store = tx.objectStore(WAVEFORM_STORE);
    const idx = store.index('songId');
    const req = idx.getAll(songId);
    req.onsuccess = () => {
      const list = req.result || [];
      resolve(list.find(w => w.type === 'master') || null);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteWaveformByTrack(trackId) {
  const db = await openDB();
  const rec = await new Promise((resolve, reject) => {
    const tx = db.transaction(WAVEFORM_STORE, 'readonly');
    const store = tx.objectStore(WAVEFORM_STORE);
    const idx = store.index('trackId');
    const req = idx.getAll(trackId);
    req.onsuccess = () => {
      const list = req.result || [];
      resolve(list.find(w => w.type === 'track') || null);
    };
    req.onerror = () => reject(req.error);
  });
  if (!rec) return;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(WAVEFORM_STORE, 'readwrite');
    const store = tx.objectStore(WAVEFORM_STORE);
    const req = store.delete(rec.key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function deleteMasterWaveformBySong(songId) {
  const db = await openDB();
  const rec = await new Promise((resolve, reject) => {
    const tx = db.transaction(WAVEFORM_STORE, 'readonly');
    const store = tx.objectStore(WAVEFORM_STORE);
    const idx = store.index('songId');
    const req = idx.getAll(songId);
    req.onsuccess = () => {
      const list = req.result || [];
      resolve(list.find(w => w.type === 'master') || null);
    };
    req.onerror = () => reject(req.error);
  });
  if (!rec) return;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(WAVEFORM_STORE, 'readwrite');
    const store = tx.objectStore(WAVEFORM_STORE);
    const req = store.delete(rec.key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
