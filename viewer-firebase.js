// Firebase viewer subscriber: listens to RTDB for broadcast state and applies it to the page.
import { initializeApp, getApp, getApps } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js';
import { getDatabase, ref, onValue, child, get } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-database.js';

const firebaseConfig = {
  apiKey: "AIzaSyD8rSfprxxMT9mfuoaKTM5YM-P_aY_nSo4",
  authDomain: "stagetrackerpro-a193d.firebaseapp.com",
  projectId: "stagetrackerpro-a193d",
  storageBucket: "stagetrackerpro-a193d.firebasestorage.app",
  messagingSenderId: "885349041871",
  appId: "1:885349041871:web:6e92489488fc66e86dd9ba"
};

function formatTime(sec){ sec=Math.max(0,sec||0); const m=Math.floor(sec/60), s=Math.floor(sec%60).toString().padStart(2,'0'); return `${m}:${s}`; }

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
        if (waveImg.src !== state.waveformDataUrl) waveImg.src = state.waveformDataUrl;
        waveImg.style.display = 'block';
        if (progressLine && waveImg.complete && waveImg.naturalWidth > 0) {
          const waveWidth = waveImg.offsetWidth;
          const position = state.duration > 0 ? (state.position / state.duration) : 0;
          const linePosition = Math.max(0, Math.min(waveWidth, waveWidth * position));
          progressLine.style.left = `${linePosition}px`;
          progressLine.style.display = 'block';
        }
      } else {
        waveImg.removeAttribute('src');
        waveImg.style.display = 'none';
        if (progressLine) progressLine.style.display = 'none';
      }
    }

    if (lyricsEl) {
      lyricsEl.innerHTML = '';
      const lines = Array.isArray(state.lyrics) ? state.lyrics : [];
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

  // Fetch static once
  (async () => {
    try {
      const snap = await get(child(ref(db), `rooms/${room}/static`));
      const staticState = snap.val() || {};
      // Seed a minimal structure; live updates will override position etc.
      applyStateToDom({
        song: staticState.song || {},
        songText: staticState.songText || '',
        lyricsText: staticState.lyricsText || '',
        lyrics: [], // will rely on broadcaster to send array in live payload
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
    const state = {
      position: Number(live.position||0),
      positionText: live.positionText || formatTime(Number(live.position||0)),
      playing: !!live.playing,
      activeIndex: (typeof live.activeIndex === 'number') ? live.activeIndex : -1,
      duration: Number(live.duration||0)
    };
    // Apply only fast-moving bits; static is handled separately
    try {
      const cur = document.getElementById('cur');
      const dur = document.getElementById('dur');
      const fill = document.getElementById('fill');
      if (cur) cur.textContent = state.positionText;
      if (dur) dur.textContent = formatTime(state.duration);
      if (fill) {
        const pct = (state.duration>0) ? Math.min(100, Math.max(0, (state.position/state.duration)*100)) : 0;
        fill.style.width = pct + '%';
      }
      const progressLine = document.getElementById('progressLine');
      const waveImg = document.getElementById('waveImg');
      if (progressLine && waveImg && waveImg.complete && waveImg.naturalWidth > 0) {
        const waveWidth = waveImg.offsetWidth;
        const position = state.duration > 0 ? (state.position / state.duration) : 0;
        const linePosition = Math.max(0, Math.min(waveWidth, waveWidth * position));
        progressLine.style.left = `${linePosition}px`;
      }
    } catch(e) { console.warn('[Viewer-FB] live apply error', e); }
  });
})();
