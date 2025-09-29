// lyrics.js
import { updateSong, getSongs } from './db.js?v=2';
import { processMidiFromLyrics, processNonTimedMidiCommands } from './midi-processor.js';
// Handles the Lyrics Editor modal and toolbar interactions.

let _lyricsInitialized = false;
function initLyrics() {
  if (_lyricsInitialized) return;
  _lyricsInitialized = true;
  const addLyricsBtn = document.getElementById('addLyricsBtn');
  const lyricsManagerModal = document.getElementById('lyricsManagerModal');
  const lyricsCancelBtn = document.getElementById('lyricsCancelBtn');
  const lyricsSaveBtn = document.getElementById('lyricsSaveBtn');
  const lyricsPlayBtn = document.getElementById('lyricsPlayBtn');
  const lyricsTimestampBtn = document.getElementById('lyricsTimestampBtn');
  const lyricsSearchBtn = document.getElementById('lyricsSearchBtn');
  const lyricsMidiBtn = document.getElementById('lyricsMidiBtn');
  const lyricsTextarea = document.getElementById('lyricsTextarea');
  const lyricsTimeDisplay = document.getElementById('lyricsTimeDisplay');
  const lyricsSongTitle = document.getElementById('lyricsSongTitle');
  // top-right controls moved to the performance page lyrics display; wiring happens later

  function openLyricsManager() {
    if (!lyricsManagerModal) return;
    // Fill title/time from global song if available
    try {
      const songTitle = (window && window.songs && window.selectedSongId) ? (window.songs.find(s=>s.id===window.selectedSongId)?.title || '') : '';
      if (lyricsSongTitle && songTitle) lyricsSongTitle.textContent = songTitle;
    } catch(_) {}
    lyricsManagerModal.classList.remove('hidden');
    lyricsManagerModal.style.display = 'flex';
    // populate textarea with existing lyrics if available and reflect in viewer/button
    try {
      const sid = window && window.selectedSongId ? window.selectedSongId : null;
      if (sid && lyricsTextarea && window.songs) {
        const s = window.songs.find(x=>x.id===sid);
        if (s && typeof s.lyrics === 'string') {
          lyricsTextarea.value = s.lyrics;
          try { renderLyricsDisplayForSong(s); } catch(_){ }
          try { refreshAddLyricsButton(s); } catch(_){ }
        } else {
          lyricsTextarea.value = '';
          try { refreshAddLyricsButton(s); } catch(_){ }
        }
      }
    } catch(_){}
    if (lyricsTextarea) lyricsTextarea.focus();
  }

  function closeLyricsManager() {
    if (!lyricsManagerModal) return;
    lyricsManagerModal.classList.add('hidden');
    lyricsManagerModal.style.display = 'none';
      // Stop MIDI listening when closing the editor
      try { if (typeof stopMidiListen === 'function') stopMidiListen(); } catch(_){}
  }

  function toggleLyricsPlay() {
    if (!lyricsPlayBtn) return;
    lyricsPlayBtn.textContent = lyricsPlayBtn.textContent.includes('Play') ? '⏸ Pause' : '▶ Play';
    // Toggle playback in the global audioEngine if present
    try {
      if (window && window.audioEngine && window.footerPlayBtn) {
        window.footerPlayBtn.click();
      }
    } catch(_){}
  }

  function timestampAtPlayhead() {
    // Insert current playhead timestamp at the start of the current line,
    // then move the caret to the beginning of the next line (creating it if needed).
    try {
      if (!lyricsTextarea) return;
      const audioEngine = window.audioEngine;
      const pos = audioEngine ? (audioEngine.playing ? Math.max(0, (audioEngine.ctx ? audioEngine.ctx.currentTime : 0) - audioEngine.startTime) + audioEngine.offset : (audioEngine.offset || 0)) : 0;
      const mm = Math.floor(pos/60).toString().padStart(2,'0');
      const ss = Math.floor(pos%60).toString().padStart(2,'0');
      const token = `[${mm}:${ss}]`;

      const ta = lyricsTextarea;
      const v = String(ta.value || '');
      const sel = Math.max(0, ta.selectionStart || 0);
      const lineStart = (function(){ const i = v.lastIndexOf('\n', Math.max(0, sel - 1)); return i === -1 ? 0 : i + 1; })();
      const lineEnd = (function(){ const i = v.indexOf('\n', sel); return i === -1 ? v.length : i; })();
      const line = v.slice(lineStart, lineEnd);

      // If line already starts with a timestamp, replace it; otherwise insert new one
      const tsStartRe = /^\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]\s*/;
      let newLine;
      if (tsStartRe.test(line)) {
        newLine = line.replace(tsStartRe, `${token} `);
      } else {
        const needSpace = line.length && !/^\s/.test(line);
        newLine = `${token}${needSpace ? ' ' : ''}${line}`;
      }

  const pre = v.slice(0, lineStart);
  const post = v.slice(lineEnd); // may start with \r\n or \n
  // Detect if a newline already exists immediately after this line in the original content
  const hasCRLF = post.startsWith('\r\n');
  const hasLF = post.startsWith('\n');
  const hasCR = post.startsWith('\r');
  const nlLenPresent = hasCRLF ? 2 : (hasLF || hasCR ? 1 : 0);

  // Prefer existing newline style in document
  const docHasCRLF = v.indexOf('\r\n') !== -1;
  const NL = docHasCRLF ? '\r\n' : '\n';

  // Only insert a newline if none present
  const ensureNL = nlLenPresent > 0 ? '' : NL;
  const newValue = pre + newLine + ensureNL + post;
  // Compute caret from the final string: anchor at end of edited line, then move past the newline in-place
  const anchor = pre.length + newLine.length;
  let nlLen = 0;
  if (newValue.startsWith('\r\n', anchor)) nlLen = 2; else if (newValue.startsWith('\n', anchor) || newValue.startsWith('\r', anchor)) nlLen = 1;
  const nextLineCaret = anchor + nlLen;

  // Preserve scroll position baseline (we might override if caret goes out of view)
  const prevScrollTop = ta.scrollTop;
  const prevScrollLeft = ta.scrollLeft;
      const wasFocused = document.activeElement === ta;
      try { if (wasFocused) ta.blur(); } catch(_){ }
      ta.value = newValue;
      // Set selection while blurred to minimize user-agent auto-scroll
      try { ta.setSelectionRange(nextLineCaret, nextLineCaret); } catch(_) { ta.selectionStart = ta.selectionEnd = nextLineCaret; }
      // Decide if caret is out of view and compute desired scrollTop accordingly
      const computeDesiredScroll = () => {
        try {
          // Estimate line height and line index
          const cs = window.getComputedStyle ? getComputedStyle(ta) : null;
          let lh = cs ? parseFloat(cs.lineHeight) : NaN;
          if (!lh || Number.isNaN(lh)) {
            const fs = cs ? parseFloat(cs.fontSize) : 16;
            lh = fs ? fs * 1.25 : 20; // fallback
          }
          const before = (ta.value || '').slice(0, nextLineCaret).replace(/\r\n/g, '\n');
          const lineIndex = before.split('\n').length - 1; // 0-based
          const visibleLines = Math.max(1, Math.floor(ta.clientHeight / lh));
          const topLineVisible = Math.floor(ta.scrollTop / lh);
          const bottomLineVisible = topLineVisible + visibleLines - 1;
          const margin = Math.max(1, Math.floor(visibleLines * 0.3));
          let desired = prevScrollTop; // default to previous
          if (lineIndex > bottomLineVisible) {
            const newTopLine = Math.max(0, lineIndex - (visibleLines - margin));
            desired = newTopLine * lh;
          } else if (lineIndex < topLineVisible) {
            const newTopLine = Math.max(0, lineIndex - margin);
            desired = newTopLine * lh;
          }
          // Clamp within scrollable range
          desired = Math.max(0, Math.min(desired, Math.max(0, ta.scrollHeight - ta.clientHeight)));
          return desired;
        } catch(_) {
          return prevScrollTop;
        }
      };
      let desiredScrollTop = prevScrollTop;
      try { desiredScrollTop = computeDesiredScroll(); } catch(_) {}

      // Apply initial scroll position
      ta.scrollTop = desiredScrollTop;
      ta.scrollLeft = prevScrollLeft;
      // Now focus without scrolling and re-assert scroll a few times to defeat late reflows
      const restore = () => {
        try { ta.focus({ preventScroll: true }); } catch(_){ try { ta.focus(); } catch(__) {} }
        const reassert = () => {
          // Re-set selection in case the focus caused a jump
          try { ta.setSelectionRange(nextLineCaret, nextLineCaret); } catch(_) { ta.selectionStart = ta.selectionEnd = nextLineCaret; }
          ta.scrollTop = desiredScrollTop; ta.scrollLeft = prevScrollLeft;
          if (window && window.requestAnimationFrame) {
            requestAnimationFrame(() => {
              try { ta.setSelectionRange(nextLineCaret, nextLineCaret); } catch(_) { ta.selectionStart = ta.selectionEnd = nextLineCaret; }
              ta.scrollTop = desiredScrollTop; ta.scrollLeft = prevScrollLeft;
              requestAnimationFrame(() => {
                try { ta.setSelectionRange(nextLineCaret, nextLineCaret); } catch(_) { ta.selectionStart = ta.selectionEnd = nextLineCaret; }
                ta.scrollTop = desiredScrollTop; ta.scrollLeft = prevScrollLeft;
              });
            });
          }
          // Also use a microtask and a macro task as last resorts
          Promise.resolve().then(() => {
            try { ta.setSelectionRange(nextLineCaret, nextLineCaret); } catch(_) { ta.selectionStart = ta.selectionEnd = nextLineCaret; }
            ta.scrollTop = desiredScrollTop; ta.scrollLeft = prevScrollLeft;
          });
          setTimeout(() => {
            try { ta.setSelectionRange(nextLineCaret, nextLineCaret); } catch(_) { ta.selectionStart = ta.selectionEnd = nextLineCaret; }
            try { ta.scrollTop = desiredScrollTop; ta.scrollLeft = prevScrollLeft; } catch(_){}
          }, 0);
        };
        reassert();
      };
      if (window && window.requestAnimationFrame) requestAnimationFrame(restore); else restore();
    } catch(e) { console.warn('timestampAtPlayhead failed', e); }
  }

  function searchOnline() {
    // Open a web search like: 3am matchbox 20 lyrics (no hyphens or slashes)
    try {
      let title = '';
      let artist = '';
      if (window && window.selectedSongId && Array.isArray(window.songs)) {
        const s = window.songs.find(x => x.id === window.selectedSongId) || null;
        if (s) {
          title = (s.title || '').toString().trim();
          artist = (s.artist || '').toString().trim();
        }
      }
      if (!title) title = (lyricsSongTitle && lyricsSongTitle.textContent) ? lyricsSongTitle.textContent.trim() : (document.title || '').trim();
      // Normalize title/artist: remove hyphens and slashes, collapse whitespace
      const norm = (s) => String(s || '').replace(/[\-\/]+/g, ' ').replace(/\s+/g, ' ').trim();
      const t = norm(title);
      const a = norm(artist);
      const query = [t, a, 'lyrics'].filter(Boolean).join(' ');
      const q = encodeURIComponent(query);
      window.open(`https://www.google.com/search?q=${q}`,'_blank');
    } catch(_){ }
  }

  // --- MIDI Listen state & helpers ---
  let midiListenActive = false;
  let midiAccess = null;
  let midiInputs = [];
  let midiHandler = null;

  function midiListenToggle() {
    if (midiListenActive) {
        stopMidiListen();
    } else {
      startMidiListen();
    }
  }

  function startMidiListen() {
    if (midiListenActive) return;
    if (!navigator.requestMIDIAccess) {
      console.warn('Web MIDI API not supported in this browser');
      return;
    }
    navigator.requestMIDIAccess({ sysex: false }).then(access => {
      midiAccess = access;
      attachMidiInputs();
      midiListenActive = true;
      if (lyricsMidiBtn) lyricsMidiBtn.textContent = '🛑 Stop MIDI';
      if (lyricsTextarea) lyricsTextarea.focus();
    }).catch(err => {
      console.warn('MIDI access denied or failed', err);
    });
  }

  function stopMidiListen() {
    if (!midiListenActive) return;
    detachMidiInputs();
    midiListenActive = false;
    if (lyricsMidiBtn) lyricsMidiBtn.textContent = '🎧 MIDI Listen';
  }

  function attachMidiInputs() {
    if (!midiAccess) return;
    midiInputs = Array.from(midiAccess.inputs.values());
    midiHandler = (e) => {
      try { handleMidiMessage(e); } catch(err) { console.warn('MIDI handler error', err); }
    };
    midiInputs.forEach(inp => { try { inp.onmidimessage = midiHandler; } catch(_){} });
    // Keep inputs up to date on device changes
    try {
      midiAccess.onstatechange = () => {
        detachMidiInputs();
        attachMidiInputs();
      };
    } catch(_){}
  }

  function detachMidiInputs() {
    if (midiInputs && midiInputs.length) {
      midiInputs.forEach(inp => { try { if (inp.onmidimessage === midiHandler) inp.onmidimessage = null; } catch(_){} });
    }
    midiInputs = [];
    midiHandler = null;
    if (midiAccess) { try { midiAccess.onstatechange = null; } catch(_){} }
  }

  function handleMidiMessage(e) {
    if (!lyricsTextarea) return;
    const data = e.data; if (!data || data.length === 0) return;
    const status = data[0];
    const type = status & 0xF0;
    const ch = (status & 0x0F) + 1; // 1..16
    let tag = '';
    switch (type) {
      case 0x90: { // Note On (vel 0 == off)
        const note = data[1] || 0; const vel = data[2] || 0;
        // Unified NOTE format: [[NOTE:note:vel:channel]]; vel 0 implies off
        tag = `[[NOTE:${note}:${vel}:${ch}]]`;
        break;
      }
      case 0x80: { // Note Off
        const note = data[1] || 0; const vel = data[2] || 0;
        tag = `[[NOTE:${note}:${vel}:${ch}]]`;
        break;
      }
      case 0xB0: { // CC
        const num = data[1] || 0; const val = data[2] || 0;
        tag = `[[CC:${num}:${val}:${ch}]]`;
        break;
      }
      case 0xE0: { // Pitch Bend (14-bit)
        const lsb = data[1] || 0; const msb = data[2] || 0; const value = (msb << 7) | lsb; // 0..16383
        tag = `[[PB:${value}:${ch}]]`;
        break;
      }
      case 0xC0: { // Program Change
        const prog = data[1] || 0;
        tag = `[[PC:${prog}:${ch}]]`;
        break;
      }
      case 0xD0: { // Channel Aftertouch
        const pressure = data[1] || 0;
        tag = `[[AT:${pressure}:${ch}]]`;
        break;
      }
      case 0xA0: { // Poly Aftertouch
        const note = data[1] || 0; const pressure = data[2] || 0;
        tag = `[[PAT:${note}:${pressure}:${ch}]]`;
        break;
      }
      default: {
        // System or unhandled -> ignore silently
        return;
      }
    }
    insertMidiTag(tag);
  }

  function insertMidiTag(tag) {
    const ta = lyricsTextarea; if (!ta) return;
    // Ensure focus so selection reflects caret
    ta.focus();
    const text = ta.value || '';
    let start = ta.selectionStart ?? text.length;
    let end = ta.selectionEnd ?? start;
    // Collapse selection to start for insertion
    end = start;
    // Determine current line boundaries
    const lineStart = (function(){ const idx = text.lastIndexOf('\n', Math.max(0, start - 1)); return idx === -1 ? 0 : idx + 1; })();
    const nextNL = text.indexOf('\n', start);
    const lineEnd = nextNL === -1 ? text.length : nextNL;
    const curLine = text.slice(lineStart, lineEnd);
    const isBlankLine = curLine.trim().length === 0;

    // If inserting into non-empty line and there is no space before, prepend one
    const needSpace = !isBlankLine && start > lineStart && !/\s$/.test(text.slice(lineStart, start));
    let insert = (needSpace ? ' ' : '') + tag;
    let newCaretPos = start + insert.length;

    if (isBlankLine) {
      // Put tag on its own line and create a fresh empty line after
      // If caret is mid-line on a blank, we still replace at caret; ensure newline follows the tag
      // Avoid double-newline if already at end-of-line with newline next
      const hasNLAtCaret = (start < text.length) && text[start] === '\n';
      if (!hasNLAtCaret) insert += '\n';
      newCaretPos = start + insert.length; // caret lands at start of the new empty line
    }

    const newText = text.slice(0, start) + insert + text.slice(end);
    ta.value = newText;
    // Place caret
    ta.selectionStart = ta.selectionEnd = newCaretPos;

  }

  async function saveLyrics() {
    try {
      if (window && window.selectedSongId) {
        const sid = window.selectedSongId;
        const newText = (lyricsTextarea ? lyricsTextarea.value : '').trim();
        let song = null;
        if (window.songs) song = window.songs.find(s => s.id === sid) || null;
        if (!song) {
          try { const list = await getSongs(); song = list.find(s => s.id === sid) || null; } catch(_) {}
        }
        if (song) {
          song.lyrics = newText;
          song.hasLyrics = newText.length > 0;
          await updateSong(song);
          if (window.songs) {
            const idx = window.songs.findIndex(x=>x.id===song.id);
            if (idx>=0) window.songs[idx] = song;
          }
          // Always re-render the viewer on save, even if cleared, to reflect current state
          renderLyricsDisplayForSong(song);
          refreshAddLyricsButton(song);
        }
      }
    } catch(e) { console.error('saveLyrics failed', e); }
    try { if (window && window.STP_Broadcast) window.STP_Broadcast.pushSnapshot(true); } catch(_){ }
    closeLyricsManager();
  }

  // Render lyrics into the page-level display box for the provided song
  function renderLyricsDisplayForSong(song) {
    try {
      const dd = document.getElementById('lyricsDisplay');
      const empty = document.getElementById('lyricsEmptyState');
      const titleEl = document.getElementById('displaySongTitle');
      if (!dd || !empty) return;

      // Set the title header (Song – Artist) if available
      try {
        if (titleEl) {
          const t = song && song.title ? String(song.title) : '';
          const a = song && song.artist ? String(song.artist) : '';
          titleEl.textContent = t && a ? `${t} – ${a}` : (t || '');
        }
      } catch(_) {}

      const raw = (song && typeof song.lyrics === 'string') ? song.lyrics : '';
      const text = raw.replace(/\r\n/g, '\n');
      const hasTS = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/.test(text);

      // Process non-timestamped MIDI commands immediately when song is selected
      try {
        // Process any MIDI commands that aren't in timestamped lines
        processNonTimedMidiCommands(text);
      } catch(e) {
        console.error('Error processing non-timestamped MIDI commands:', e);
      }

      // Toggle between content vs empty state
      if ((text || '').trim().length > 0) {
        dd.classList.remove('hidden');
        empty.classList.add('hidden');
      } else {
        dd.textContent = '';
        dd.classList.add('hidden');
        empty.classList.remove('hidden');
        stopTimedLyricsLoop();
        toggleScrollSpeedButtons(true); // show buttons when no lyrics
        return;
      }

      if (!hasTS) {
        // Plain, untimed render (strip timestamps if any stray)
        const cleaned = text
          .replace(/\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g, '')
          .replace(/\[\[[^\]]+\]\]/g, '') // strip midi tags from display
          .trim();
        dd.innerHTML = '';
        dd.textContent = cleaned;
        stopTimedLyricsLoop();
        toggleScrollSpeedButtons(true); // allow manual scroll speed controls
        return;
      }

      // Timed lyrics render
      const lines = parseTimedLyrics(text);
      dd.innerHTML = '';
      for (let i = 0; i < lines.length; i++) {
        const ln = lines[i];
        const div = document.createElement('div');
        div.className = 'lyrics-line';
        div.dataset.t = String(ln.t);
        div.dataset.index = String(i);
        div.dataset.hasMidi = ln.hasMidi ? 'true' : 'false';
        div.textContent = ln.text;
        if (ln.hasMidi) {
          const note = document.createElement('span');
          note.className = 'midi-note';
          note.textContent = '🎵';
          div.appendChild(note);
        }
        dd.appendChild(div);
      }
      startTimedLyricsLoop(lines, dd);
      toggleScrollSpeedButtons(false); // hide scroll speed when timed
    } catch(e) { console.warn('renderLyricsDisplayForSong failed', e); }
  }

  // --- Timed lyrics helpers and state ---
  let timedState = { lines: [], cur: -1, raf: 0, lastPos: -1, container: null };
  function stopTimedLyricsLoop() {
    if (timedState.raf) { cancelAnimationFrame(timedState.raf); timedState.raf = 0; }
    timedState = { lines: [], cur: -1, raf: 0, lastPos: -1, container: null };
    try { window.LYRICS_ACTIVE_INDEX = -1; } catch(_) {}
  }
  function startTimedLyricsLoop(lines, container) {
    stopTimedLyricsLoop();
    timedState.lines = lines;
    timedState.container = container;
    const step = () => {
      const ae = window.audioEngine;
      let pos = 0;
      if (ae) {
        const now = ae.ctx ? ae.ctx.currentTime : 0;
        pos = ae.playing ? Math.max(0, now - ae.startTime) + (ae.offset || 0) : (ae.offset || 0);
      }
      
      // Always check for active line on every animation frame
      timedState.lastPos = pos;
      const i = findActiveIndex(lines, pos);
      
      // Always update the active line, even if the index hasn't changed,
      // to ensure the UI stays in sync
      updateActiveLine(i);
      
      timedState.raf = requestAnimationFrame(step);
    };
    timedState.raf = requestAnimationFrame(step);
    // Initialize immediately using current offset
    const ae = window.audioEngine;
    const initPos = ae ? (ae.offset || 0) : 0;
    updateActiveLine(findActiveIndex(lines, initPos));
  }
  function updateActiveLine(i) {
    const cont = timedState.container; if (!cont) return;
    const prev = timedState.cur; timedState.cur = i;
    // Expose active index globally for broadcaster snapshotting
    try { window.LYRICS_ACTIVE_INDEX = (typeof i === 'number' ? i : -1); } catch(_) {}
    
    // First, remove 'current' class from all elements to ensure clean state
    for (let j = 0; j < cont.children.length; j++) {
      cont.children[j].classList.remove('current');
    }
    
    // Add current
    if (i >= 0 && i < cont.children.length) {
      const el = cont.children[i];
      el.classList.add('current');
      
      // Log for debugging
      console.log(`[LYRICS] Highlighting line ${i}: "${el.textContent}"`);
      
      // Process any MIDI commands in this line
      if (el.dataset.hasMidi === 'true') {
        // Process MIDI commands from the text content
        try {
          const lineText = el.textContent || '';
          // Get line from original data which contains the MIDI commands
          const lineIndex = parseInt(el.dataset.index, 10);
          if (!isNaN(lineIndex) && timedState.lines[lineIndex]) {
            const originalText = timedState.lines[lineIndex].rawText || lineText;
            processMidiFromLyrics(originalText);
          }
        } catch(e) {
          console.error('Error processing MIDI commands:', e);
        }
      }
      // Smooth scroll to keep the active line about 35% from top
      const target = Math.max(0, el.offsetTop - Math.floor(cont.clientHeight * 0.35));
      cont.scrollTo({ top: target, behavior: 'smooth' });
    }
  }
  function findActiveIndex(lines, t) {
    if (!lines || !lines.length) return -1;
    
    // Log the current time for debugging
    console.log(`[LYRICS] Finding active index for time ${t.toFixed(2)}s`);
    
    // Binary search by time to find the last line with timestamp <= current time
    let lo = 0, hi = lines.length - 1, ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (lines[mid].t <= t) { 
        ans = mid; 
        lo = mid + 1; 
      } else { 
        hi = mid - 1; 
      }
    }
    
    // If we found a match, log it
    if (ans >= 0) {
      console.log(`[LYRICS] Found active line ${ans}: "${lines[ans].text}" (t=${lines[ans].t.toFixed(2)}s)`);
    }
    
    return ans;
  }
  function parseTimedLyrics(text) {
    const out = [];
    const tsRe = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;
    const midiRe = /\[\[[^\]]+\]\]/g;
    const lines = String(text || '').split(/\n/);
    for (const raw of lines) {
      const line = String(raw || '').trim();
      if (!line) continue;
      let match; let times = [];
      tsRe.lastIndex = 0;
      while ((match = tsRe.exec(line)) !== null) {
        const mm = parseInt(match[1], 10) || 0;
        const ss = parseInt(match[2], 10) || 0;
        const ms = parseInt(match[3] || '0', 10) || 0;
        const t = mm * 60 + ss + (ms / 1000);
        times.push(t);
      }
      const hasMidi = midiRe.test(line);
      const clean = line.replace(tsRe, '').replace(midiRe, '').trim();
      if (!clean) continue;
      if (!times.length) {
        // Will assign later relative to previous lines
        out.push({ t: NaN, text: clean, hasMidi, rawText: line });
      } else {
        // If multiple timestamps on one line, duplicate or pick first?
        // We pick the first for display; advanced syncing can be added later
        out.push({ t: times[0], text: clean, hasMidi, rawText: line });
      }
    }
    // Normalize untimed lines to follow the previous timed line by +2s each
    out.sort((a,b) => (isNaN(a.t)? Infinity : a.t) - (isNaN(b.t)? Infinity : b.t));
    let lastT = 0;
    for (let i=0;i<out.length;i++) {
      if (isNaN(out[i].t)) { lastT = lastT + 2; out[i].t = lastT; } else { lastT = out[i].t; }
    }
    out.sort((a,b)=>a.t-b.t);
    for (let i=1;i<out.length;i++) { if (out[i].t <= out[i-1].t) out[i].t = out[i-1].t + 0.01; }
    return out;
  }
  function toggleScrollSpeedButtons(show) {
    const up = document.getElementById('lyricsScrollUpBtn');
    const down = document.getElementById('lyricsScrollDownBtn');
    if (up) up.classList.toggle('hidden', !show);
    if (down) down.classList.toggle('hidden', !show);
    // Also stop manual auto-scroll if we are hiding controls due to timed lyrics
    if (!show) { try { stopPageAutoScroll(); } catch(_){} }
  }

  // Wire buttons
  if (addLyricsBtn) addLyricsBtn.addEventListener('click', openLyricsManager);
  if (lyricsCancelBtn) lyricsCancelBtn.addEventListener('click', closeLyricsManager);
  if (lyricsSaveBtn) lyricsSaveBtn.addEventListener('click', saveLyrics);
  if (lyricsPlayBtn) lyricsPlayBtn.addEventListener('click', toggleLyricsPlay);
  if (lyricsTimestampBtn) lyricsTimestampBtn.addEventListener('click', timestampAtPlayhead);
  if (lyricsSearchBtn) lyricsSearchBtn.addEventListener('click', searchOnline);
  if (lyricsMidiBtn) lyricsMidiBtn.addEventListener('click', midiListenToggle);

  // PAGE-LEVEL LYRICS DISPLAY CONTROLS (top-right on performance page)
  const lyricsDisplay = document.getElementById('lyricsDisplay');
  const displayTitle = document.getElementById('displaySongTitle');
  const scrollUpBtn = document.getElementById('lyricsScrollUpBtn');
  const scrollDownBtn = document.getElementById('lyricsScrollDownBtn');
  const fontUpBtn = document.getElementById('lyricsFontUpBtn');
  const fontDownBtn = document.getElementById('lyricsFontDownBtn');
  const editPageBtn = document.getElementById('lyricsEditPageBtn');
  // page-level state
  let pageAutoScrollSpeed = 0;
  let pageAutoScrollInterval = null;
  let pageFontSize = 18;

  function startPageAutoScroll() {
    if (pageAutoScrollInterval) clearInterval(pageAutoScrollInterval);
    if (!pageAutoScrollSpeed || !lyricsDisplay) return;
    const stepMs = 100;
    const stepPx = (pageAutoScrollSpeed / 1000) * stepMs;
    pageAutoScrollInterval = setInterval(() => {
      if (!lyricsDisplay) return;
      lyricsDisplay.scrollTop += stepPx;
    }, stepMs);
  }

  function stopPageAutoScroll() { if (pageAutoScrollInterval) { clearInterval(pageAutoScrollInterval); pageAutoScrollInterval = null; } }

  if (scrollUpBtn) scrollUpBtn.addEventListener('click', () => { pageAutoScrollSpeed = Math.min(300, (pageAutoScrollSpeed || 20) + 30); startPageAutoScroll(); });
  if (scrollDownBtn) scrollDownBtn.addEventListener('click', () => { pageAutoScrollSpeed = Math.max(0, (pageAutoScrollSpeed || 20) - 30); if (pageAutoScrollSpeed===0) stopPageAutoScroll(); else startPageAutoScroll(); });
  const fontBadge = document.getElementById('lyricsFontSizeLabel');
  function updateFontBadge() { if (fontBadge) fontBadge.textContent = String(pageFontSize); }
  function applyFont() { if (lyricsDisplay) lyricsDisplay.style.fontSize = pageFontSize + 'px'; updateFontBadge(); }
  applyFont();
  if (fontUpBtn) fontUpBtn.addEventListener('click', () => { pageFontSize = Math.min(48, pageFontSize + 2); applyFont(); });
  if (fontDownBtn) fontDownBtn.addEventListener('click', () => { pageFontSize = Math.max(10, pageFontSize - 2); applyFont(); });
  if (editPageBtn) editPageBtn.addEventListener('click', () => {
    // Open the lyrics editor modal for editing
    if (typeof openLyricsManager === 'function') openLyricsManager();
    else {
      const btn = document.getElementById('addLyricsBtn');
      if (btn) btn.click();
    }
  });

  // Update lyrics time display periodically if modal open
  setInterval(() => {
    try {
      if (!lyricsManagerModal || lyricsManagerModal.classList.contains('hidden')) return;
      const audioEngine = window.audioEngine;
      if (!audioEngine) return;
      const now = audioEngine.ctx ? audioEngine.ctx.currentTime : 0;
      const pos = audioEngine.playing ? Math.max(0, now - audioEngine.startTime) + audioEngine.offset : audioEngine.offset || 0;
      if (lyricsTimeDisplay) lyricsTimeDisplay.textContent = `${Math.floor(pos/60)}:${Math.floor(pos%60).toString().padStart(2,'0')} / ${Math.floor((audioEngine.duration||0)/60)}:${Math.floor((audioEngine.duration||0)%60).toString().padStart(2,'0')}`;
    } catch(_){}
  }, 300);

  // Poll for selected song changes so Add Lyrics button visibility updates automatically
  try {
    let lastSelected = typeof window !== 'undefined' ? (window.selectedSongId || null) : null;
    setInterval(() => {
      try {
        const sel = (window && window.selectedSongId) ? window.selectedSongId : null;
        if (sel !== lastSelected) {
          lastSelected = sel;
          // determine if the selected song has lyrics and render into viewer
          if (window && window.songs) {
            const s = window.songs.find(x=>x.id===sel) || null;
            try { renderLyricsDisplayForSong(s); } catch(_){}
            // update add lyrics button
            refreshAddLyricsButton(s);
          }
        }
      } catch(_){}
    }, 500);
  } catch(_){}

  // Initial render and button state on load
  try {
    const sel = (window && window.selectedSongId) ? window.selectedSongId : null;
    if (window && window.songs && sel) {
      const s = window.songs.find(x=>x.id===sel) || null;
      renderLyricsDisplayForSong(s);
      refreshAddLyricsButton(s);
    } else {
      refreshAddLyricsButton();
    }
  } catch(_){ }

}

// Helper to show/hide the Add Lyrics button depending on whether the selected song has lyrics
export function refreshAddLyricsButton(song) {
  const addLyricsBtn = document.getElementById('addLyricsBtn');
  if (!addLyricsBtn) return;
  // If a song object is provided, use its lyrics flag; otherwise try global window.songs / selectedSongId
  function songHasLyricsObj(s) {
    if (!s) return false;
    if (typeof s.hasLyrics !== 'undefined') return !!s.hasLyrics;
    if (typeof s.lyrics === 'string') return s.lyrics.trim().length > 0;
    if (typeof s.lyricsText === 'string') return s.lyricsText.trim().length > 0;
    if (typeof s.text === 'string') return s.text.trim().length > 0;
    if (Array.isArray(s.lyrics) && s.lyrics.length > 0) return true;
    if (s.metadata && typeof s.metadata.lyrics === 'string' && s.metadata.lyrics.trim().length > 0) return true;
    return false;
  }

  let hasLyrics = false;
  if (song) hasLyrics = songHasLyricsObj(song);
  else {
    try {
      if (window && window.selectedSongId && window.songs) {
        const s = window.songs.find(x => x.id === window.selectedSongId);
        hasLyrics = songHasLyricsObj(s);
      }
    } catch (_) { hasLyrics = false }
  }

  if (hasLyrics) addLyricsBtn.classList.add('hidden'); else addLyricsBtn.classList.remove('hidden');
}

// Initialize once and refresh button
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { initLyrics(); refreshAddLyricsButton(); }); else (function(){ initLyrics(); refreshAddLyricsButton(); })();

// Exported helpers (if other modules want to open/close)
export function openLyrics() { initLyrics(); const btn = document.getElementById('addLyricsBtn'); if (btn) btn.click(); }
