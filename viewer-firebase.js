// Firebase viewer subscriber: listens to RTDB for broadcast state and applies it to the page.
import { initializeApp, getApp, getApps } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js';
import { getDatabase, ref, onValue, child, get } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-database.js';

const firebaseConfig = {
  apiKey: "AIzaSyD8rSfprxxMT9mfuoaKTM5YM-P_aY_nSo4",
  authDomain: "stagetrackerpro-a193d.firebaseapp.com",
  projectId: "stagetrackerpro-a193d",
  storageBucket: "stagetrackerpro-a193d.firebasestorage.app",
  messagingSenderId: "885349041871",
  appId: "1:885349041871:web:6e92489488fc66e86dd9ba",
  databaseURL: "https://stagetrackerpro-a193d-default-rtdb.firebaseio.com"
};

function formatTime(sec){ sec=Math.max(0,sec||0); const m=Math.floor(sec/60), s=Math.floor(sec%60).toString().padStart(2,'0'); return `${m}:${s}`; }

// Local UI state for smooth interpolation between live updates
const LiveUI = {
  basePos: 0,        // seconds at last live update
  lastUpdateMs: 0,   // performance.now() at last live update
  playing: false,
  duration: 0,
  rafId: 0,
  lyrics: [],
  _prevPlaying: null
};

function parseLyricsText(txt){
  try {
    const out = [];
    const src = String(txt||'').replace(/\r\n/g,'\n');
    const lines = src.split(/\n/);
    const tsRe = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;
    let lastT = 0;
    for (const raw of lines){
      if (!raw || !raw.trim()) continue;
      const matches = [...raw.matchAll(tsRe)];
      const text = raw.replace(tsRe,'').trim();
      if (matches.length){
        for (const m of matches){
          const mm = parseInt(m[1]||'0',10);
          const ss = parseInt(m[2]||'0',10);
          const ms = parseInt(m[3]||'0',10);
          const t = mm*60 + ss + (ms/1000);
          out.push({ t, text });
        }
      } else {
        lastT += 2; // space untimed lines every 2s
        out.push({ t: lastT, text });
      }
    }
    out.sort((a,b)=>a.t-b.t);
    return out;
  } catch(_){ return []; }
}

function startUiLoop(){
  if (LiveUI.rafId) return;
  const curEl = document.getElementById('cur');
  const durEl = document.getElementById('dur');
  const fillEl = document.getElementById('fill');
  const progressLine = document.getElementById('progressLine');
  const waveImg = document.getElementById('waveImg');
  const lyricsBox = document.getElementById('lyrics');
  const step = () => {
    const now = performance.now();
    let pos = LiveUI.basePos;
    if (LiveUI.playing && LiveUI.lastUpdateMs) {
      pos = LiveUI.basePos + Math.max(0, (now - LiveUI.lastUpdateMs) / 1000);
    }
    const duration = Math.max(0, LiveUI.duration || 0);
    if (duration > 0) pos = Math.min(pos, duration);
    // Update DOM
    try {
      if (curEl) curEl.textContent = formatTime(pos);
      if (durEl) durEl.textContent = formatTime(duration);
      if (fillEl) {
        const pct = duration > 0 ? Math.min(100, Math.max(0, (pos / duration) * 100)) : 0;
        fillEl.style.width = pct + '%';
      }
      if (progressLine && waveImg && waveImg.complete && waveImg.naturalWidth > 0) {
        const waveWidth = waveImg.offsetWidth;
        const position = duration > 0 ? (pos / duration) : 0;
        const linePosition = Math.max(0, Math.min(waveWidth, waveWidth * position));
        progressLine.style.left = `${linePosition}px`;
      }
      // Lyrics highlighting based on current position
      if (lyricsBox && LiveUI.lyrics && LiveUI.lyrics.length) {
        let idx = -1;
        for (let i = 0; i < LiveUI.lyrics.length; i++) {
          const t = Number(LiveUI.lyrics[i]?.t || 0);
          if (!Number.isFinite(t)) continue;
          if (t <= pos) idx = i; else break;
        }
        const nodes = lyricsBox.children || [];
        for (let i = 0; i < nodes.length; i++) {
          const el = nodes[i];
          const should = (i === idx);
          const has = el.classList.contains('active');
          if (should !== has) {
            el.classList.toggle('active', should);
            if (should) {
              try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch(_){}
            }
          }
        }
      }
    } catch(_){}
    LiveUI.rafId = requestAnimationFrame(step);
  };
  LiveUI.rafId = requestAnimationFrame(step);
  // Fallback timer to mitigate any rAF throttling
  try {
    if (!LiveUI._intervalId) {
      LiveUI._intervalId = setInterval(() => {
        try { step(); } catch(_){}
      }, 120);
    }
  } catch(_){ }
}

function applyStateToDom(state){
  try {
    const titleEl = document.getElementById('songTitle');
    const artistEl = document.getElementById('songArtist');
    const waveImg = document.getElementById('waveImg');
    const progressLine = document.getElementById('progressLine');
    const cur = document.getElementById('cur');
    const dur = document.getElementById('dur');
    const fill = document.getElementById('fill');
    const lyricsEl = document.getElementById('lyrics');

    titleEl && (titleEl.textContent = state.songText || state.song?.title || '');
    artistEl && (artistEl.textContent = state.song?.artist || '');

    if (cur) cur.textContent = state.positionText || formatTime(state.position || 0);
    if (dur) dur.textContent = formatTime(state.duration || 0);
    if (fill) {
      const pct = (state.duration>0) ? Math.min(100, Math.max(0, (state.position/state.duration)*100)) : 0;
      fill.style.width = pct + '%';
    }

    if (waveImg) {
      if (state.waveformDataUrl) {
        if (waveImg.src !== state.waveformDataUrl) {
          waveImg.onload = () => {
            try {
              if (!progressLine) return;
              const waveWidth = waveImg.offsetWidth;
              const position = state.duration > 0 ? (state.position / state.duration) : 0;
              const linePosition = Math.max(0, Math.min(waveWidth, waveWidth * position));
              progressLine.style.left = `${linePosition}px`;
              progressLine.style.display = 'block';
            } catch(_){}
          };
          waveImg.src = state.waveformDataUrl;
        }
        waveImg.style.display = 'block';
        if (progressLine && waveImg.complete && waveImg.naturalWidth > 0) {
          const waveWidth = waveImg.offsetWidth;
          const position = state.duration > 0 ? (state.position / state.duration) : 0;
          const linePosition = Math.max(0, Math.min(waveWidth, waveWidth * position));
          progressLine.style.left = `${linePosition}px`;
          progressLine.style.display = 'block';
        }
      } else {
        // If static payload has no waveform, don't forcibly hide an existing image
        // This avoids flicker between updates. Only hide if there was never an image.
        if (!waveImg.src) {
          waveImg.removeAttribute('src');
          waveImg.style.display = 'none';
          if (progressLine) progressLine.style.display = 'none';
        }
      }
    }

    if (lyricsEl) {
      lyricsEl.innerHTML = '';
      const lines = Array.isArray(state.lyrics) ? state.lyrics : [];
      LiveUI.lyrics = lines;
      lines.forEach((ln) => {
        const div = document.createElement('div');
        div.className = 'line';
        div.textContent = ln.text || '';
        lyricsEl.appendChild(div);
      });
    }
  } catch (e) {
    console.warn('[Viewer-FB] applyStateToDom error', e);
  }
}

(function main(){
  const params = new URLSearchParams(location.search);
  const room = params.get('room');
  if (!room) return; // no-op without room

  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const db = getDatabase(app);

  // Subscribe to static so we react when host selects a song after viewer loads
  onValue(ref(db, `rooms/${room}/static`), (snap) => {
    const staticState = snap.val() || {};
    // Build lyrics array with fallback to parsing lyricsText
    const lyricsArr = Array.isArray(staticState.lyrics) && staticState.lyrics.length
      ? staticState.lyrics
      : parseLyricsText(staticState.lyricsText || '');
    applyStateToDom({
      song: staticState.song || {},
      songText: staticState.songText || '',
      lyricsText: staticState.lyricsText || '',
      lyrics: lyricsArr,
      waveformDataUrl: staticState.waveformDataUrl || '',
      duration: 0,
      position: 0,
      positionText: '0:00',
      playing: false
    });
  });

  // Also fetch once at startup to paint immediately if already present
  (async () => {
    try {
      const snap = await get(child(ref(db), `rooms/${room}/static`));
      const staticState = snap.val() || {};
      // Seed a minimal structure; live updates will override position etc.
      const lyricsArr = Array.isArray(staticState.lyrics) && staticState.lyrics.length
        ? staticState.lyrics
        : parseLyricsText(staticState.lyricsText || '');
      applyStateToDom({
        song: staticState.song || {},
        songText: staticState.songText || '',
        lyricsText: staticState.lyricsText || '',
        lyrics: lyricsArr,
        waveformDataUrl: staticState.waveformDataUrl || '',
        duration: 0,
        position: 0,
        positionText: '0:00',
        playing: false
      });
    } catch(_){}
  })();

  // Subscribe to live state
  onValue(ref(db, `rooms/${room}/live`), (snap) => {
    const live = snap.val();
    if (!live) return;
    const reportedPos = Number(live.position||0);
    const newPlaying = !!live.playing;
    LiveUI.duration = Number(live.duration||0);
    const now = performance.now();

    if (LiveUI._prevPlaying === null || LiveUI._prevPlaying !== newPlaying) {
      // First packet or play/pause toggled: sync and set playing flag
      LiveUI.basePos = reportedPos;
      LiveUI.lastUpdateMs = now;
      LiveUI.playing = newPlaying;
    } else if (newPlaying) {
      // While playing: compute expected position and only resync if drift is large
      const elapsed = Math.max(0, (now - LiveUI.lastUpdateMs) / 1000);
      const expected = LiveUI.basePos + elapsed;
      const drift = Math.abs(expected - reportedPos);
      if (drift > 1.0) { // resync only when >1s off
        LiveUI.basePos = reportedPos;
        LiveUI.lastUpdateMs = now;
      }
      // keep playing flag true; timer continues locally
    } else {
      // Paused/stopped: adopt broadcaster position
      LiveUI.basePos = reportedPos;
      LiveUI.lastUpdateMs = now;
      LiveUI.playing = false;
    }
    LiveUI._prevPlaying = newPlaying;
    if (Array.isArray(live.lyrics)) {
      LiveUI.lyrics = live.lyrics;
      // if DOM already rendered, ensure same count; if not, it'll update on next static change
      const lyricsBox = document.getElementById('lyrics');
      if (lyricsBox && lyricsBox.children.length === 0) {
        live.lyrics.forEach(ln => {
          const d = document.createElement('div');
          d.className = 'line';
          d.textContent = ln.text || '';
          lyricsBox.appendChild(d);
        });
      }
    }
    // Ensure UI loop is running for smooth updates
    startUiLoop();
  });
})();
