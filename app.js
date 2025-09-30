import { getSongs, addSong, updateSong, deleteSong, getTracks, addTrack, updateTrack as dbUpdateTrack, deleteTrack, getAudioFiles, addAudioFile, updateAudioFile, deleteAudioFile, putWaveform, getWaveformByTrack, getMasterWaveformBySong, deleteWaveformByTrack, deleteMasterWaveformBySong, wipeDatabase } from './db.js?v=3';
import { exportCompleteDatabase, importCompleteDatabase, showNotification, createSampleData, showExportPreview, showImportPreview } from './io.js?v=7';
import './broadcast.js';

// Firebase initialization (CDN modular SDK). Safe side-effect only; no services used yet.
// Uses CDN so we don't require a bundler. Keys are public by design in Firebase web apps.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js';
import { getDatabase, ref, set, update, onDisconnect, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-database.js';

const firebaseConfig = {
	apiKey: "AIzaSyD8rSfprxxMT9mfuoaKTM5YM-P_aY_nSo4",
	authDomain: "stagetrackerpro-a193d.firebaseapp.com",
	projectId: "stagetrackerpro-a193d",
	storageBucket: "stagetrackerpro-a193d.firebasestorage.app",
	messagingSenderId: "885349041871",
	appId: "1:885349041871:web:6e92489488fc66e86dd9ba",
	// Explicit RTDB URL so getDatabase works in production
	databaseURL: "https://stagetrackerpro-a193d-default-rtdb.firebaseio.com"
};

export const firebaseApp = initializeApp(firebaseConfig);
// Optional global for convenience in other scripts without imports
window.firebaseApp = firebaseApp;
// Create a shared RTDB instance if available
let RTDB = null;
try { RTDB = getDatabase(firebaseApp); } catch { RTDB = null; }

// Wrap the updateTrack function to add debugging for regions
async function updateTrack(track) {
    // Enhanced wrapper with logging for regions-related updates
    if (Array.isArray(track.regions)) {
        console.log(`Saving track ${track.id} with ${track.regions.length} regions to IndexedDB`);
        console.log('Regions data:', JSON.stringify(track.regions));
    }
    // Call the original function from db.js
			return await dbUpdateTrack(track);
		}

console.log('app.js: script loaded');
const songsContainer = document.getElementById('songsContainer');
const songCountEl = document.getElementById('songCount');
const addSongBtn = document.getElementById('addSongBtn');
const addSongModal = document.getElementById('addSongModal');
const closeAddSongBtn = document.getElementById('closeAddSong');
const addSongForm = document.getElementById('addSongForm');
const newSongTitle = document.getElementById('newSongTitle');
const newSongArtist = document.getElementById('newSongArtist');
const deleteSongBtn = document.getElementById('deleteSongBtn');
const deleteSongModal = document.getElementById('deleteSongModal');
const closeDeleteSongBtn = document.getElementById('closeDeleteSong');
const confirmDeleteSongBtn = document.getElementById('confirmDeleteSong');
const cancelDeleteSongBtn = document.getElementById('cancelDeleteSong');
const deleteSongInfo = document.getElementById('deleteSongInfo');
// const importFilesBtn = document.getElementById('importFilesBtn'); // Removed from menu
const importArchiveBtn = document.getElementById('importArchiveBtn');
const exportArchiveBtn = document.getElementById('exportArchiveBtn');
// const resetStorageBtn = document.getElementById('resetStorageBtn'); // Removed from menu
const audioFileInput = document.getElementById('audioFileInput');
const archiveFileInput = document.getElementById('archiveFileInput');
const settingsRoot = document.getElementById('settingsRoot');
const settingsBtn = document.getElementById('settingsBtn');
const settingsMenu = document.getElementById('settingsMenu');
// Lyrics UI is handled in lyrics.js
const songDetailsTitle = document.querySelector('.song-details h2');
const songDetailsPara = document.querySelector('.song-details p');
// Footer playback controls
const footerPlayBtn = document.getElementById('footerPlayBtn');
// Expose play button so other modules (lyrics.js) can toggle playback via the same control
window.footerPlayBtn = footerPlayBtn;
const footerStopBtn = document.getElementById('footerStopBtn');
// Removed shuttle-time UI; these elements are no longer present on Performance page
const playbackRange = document.getElementById('playbackRange');
const footerTimeCur = document.getElementById('footerTimeCur');
const footerTimeDur = document.getElementById('footerTimeDur');
const masterVolume = document.getElementById('masterVolume');
const masterVolPct = document.getElementById('masterVolPct');
// Sidebar player controls
// Sidebar player controls removed
// Master waveform canvas
const masterWaveCanvas = document.getElementById('masterWaveCanvas');
const masterWaveCtx = masterWaveCanvas ? masterWaveCanvas.getContext('2d') : null;
let masterWaveLastPeaks = null; // cached peaks for overlay redraws
let masterWaveBaseColor = '#4fc3f7';
// Track Manager waveform state (per track)
const trackWaveState = new Map(); // trackId -> { zoom:number, scroll:number, selection:{start:number,end:number}|null }
const trackPeaksCache = new Map(); // trackId -> Uint8Array
const trackPeaksPending = new Set(); // trackIds currently fetching

let songs = [];
let selectedSongId = null;
// Expose to window for cross-module access (lyrics.js, broadcast, etc.)
window.songs = songs;
window.selectedSongId = selectedSongId;
// Test helpers for development and debugging
window.createSampleData = createSampleData;
window.checkDatabase = async function() {
	const songs = await getSongs();
	console.log('Database state:', {
		songCount: songs.length,
		songs: songs.map(s => ({ id: s.id, title: s.title, artist: s.artist }))
	});
	return songs;
};
let trackManagerSongId = null; // the song currently open in Track Manager
let trackManagerDirty = false; // track add/remove changes while Track Manager is open

// Track Manager count-in preferences (legacy defaults; per-song fields now preferred)
let trackMgrCountInEnabled = false;
let trackMgrBPM = 120;
let trackMgrClickBalance = 0; // -1 (Left) .. 0 (Center) .. +1 (Right)
let trackMgrClickVolume = 1.0; // multiplier (legacy default)
try {
	const en = localStorage.getItem('tm.countIn.enabled');
	const bpm = localStorage.getItem('tm.countIn.bpm');
	const bal = localStorage.getItem('tm.countIn.balance');
	const vol = localStorage.getItem('tm.countIn.volume');
	if (en != null) trackMgrCountInEnabled = en === '1' || en === 'true';
	if (bpm != null) {
		const v = parseInt(bpm, 10);
		if (Number.isFinite(v) && v >= 30 && v <= 300) trackMgrBPM = v;
	}
	if (bal != null) {
		const b = parseFloat(bal);
		if (Number.isFinite(b)) trackMgrClickBalance = Math.max(-1, Math.min(1, b));
	}
	if (vol != null) {
		const v = parseFloat(vol);
		if (Number.isFinite(v)) trackMgrClickVolume = Math.max(0, Math.min(4, v));
	}
} catch(_) {}

// Simple in-memory file storage for prototype: {fileId: {name, blob, size}}
let files = {};
let nextFileId = 1;

// ------------------ Broadcast (host) wiring ------------------
// Simple broadcast per spec:
// - On song selection: send Title – Artist (text), small master waveform graphic, and lyrics with timestamps (text + parsed array)
// - Every 1 second: push position (m:ss), and keep viewers adjusted to that
const Broadcast = {
	socket: null,
	room: null,
	started: false,
	lastSentMs: 0,
	minIntervalMs: 500, // push every 0.5s for smoother viewer updates
	// tuned for smoother viewer updates; 500ms provides better fidelity with low overhead
	// (note: the value above is overwritten by this property assignment)
	intervalId: 0,
	waveformCache: new Map(), // songId -> dataURL
	_lastSongKey: null,
	db: RTDB,
	ensureSocket() {
		if (this.socket) return this.socket;
		// Guard: only attempt if socket.io client is present (served by server)
		if (!window.io) { console.warn('[BCAST Host] window.io not available yet'); return null; }
		try {
			this.socket = window.io({ path: '/socket.io/', transports: ['websocket','polling'] });
			// Lightweight debug hooks
			this.socket.on('connect', () => { try { console.log('[BCAST Host] Socket connected', this.socket.id); } catch(_){} });
			this.socket.on('connect_error', (e) => { try { console.warn('[BCAST Host] connect_error', e?.message||e); } catch(_){} });
			this.socket.on('error', (e) => { try { console.warn('[BCAST Host] error', e?.message||e); } catch(_){} });
			return this.socket;
		} catch(e) {
			console.warn('[BCAST Host] Failed to init socket', e);
			return null;
		}
	},
	async setHostPresence(online) {
		if (!this.db || !this.room) return;
		try {
			const hostRef = ref(this.db, `rooms/${this.room}/host`);
			await update(hostRef, { online: !!online, t: serverTimestamp() });
			if (online) {
				try { onDisconnect(hostRef).update({ online: false, t: serverTimestamp() }); } catch(_) {}
			}
		} catch(_) {}
	},
	async pushStaticIfNeeded(state) {
		if (!this.db || !this.room) return;
		const key = `${state.song?.title||''}::${state.song?.artist||''}`;
		if (this._lastSongKey === key) return;
		this._lastSongKey = key;
		try {
			await set(ref(this.db, `rooms/${this.room}/static`), {
				song: state.song,
				songText: state.songText,
				lyricsText: state.lyricsText,
				lyrics: Array.isArray(state.lyrics) ? state.lyrics : [],
				waveformDataUrl: state.waveformDataUrl || null,
				songId: typeof window.selectedSongId !== 'undefined' ? window.selectedSongId : null,
				updatedAt: Date.now()
			});
		} catch(e) { console.warn('[BCAST] Firebase static publish failed', e); }
	},
	async pushLive(state) {
		if (!this.db || !this.room) return;
		try {
			await update(ref(this.db, `rooms/${this.room}/live`), {
				position: state.position,
				positionText: state.positionText,
				playing: !!state.playing,
				activeIndex: (typeof state.activeIndex === 'number') ? state.activeIndex : -1,
				duration: state.duration || 0,
				// include lyrics opportunistically to allow viewers to refresh if needed
				lyrics: Array.isArray(state.lyrics) ? state.lyrics : undefined,
				updatedAt: Date.now()
			});
		} catch(e) { console.warn('[BCAST] Firebase live publish failed', e); }
	},
	start(room) {
		const io = this.ensureSocket();
		this.room = room;
		this.started = true;
		try {
			if (io) {
				console.log('[BCAST Host] Emitting host:join for room', room);
				io.emit('host:join', { room, hostName: 'Host' });
			}
		} catch(e) { console.warn('[BCAST Host] emit host:join failed', e); }
		// Mark presence for Firebase consumers
		this.setHostPresence(true);
		// Send an initial full snapshot asap
		this.pushSnapshot(true);
		// Begin 1-second timer pushes for position updates
		if (this.intervalId) { try { clearInterval(this.intervalId); } catch(_) {} }
		this.intervalId = setInterval(() => { try { this.pushSnapshot(false); } catch(_) {} }, this.minIntervalMs);
	    try { window.updateBroadcastStatusChip?.(); } catch(_) {}
	},
	stop() {
		this.started = false;
		this.room = null;
		if (this.intervalId) { try { clearInterval(this.intervalId); } catch(_) {} this.intervalId = 0; }
		// Mark offline for Firebase consumers
		this.setHostPresence(false);
		// Keep socket connected; viewers simply stop receiving updates
	    try { window.updateBroadcastStatusChip?.(); } catch(_) {}
	},
	async getMasterWaveformDataUrl(songId, opts={}) {
		const cached = this.waveformCache.get(songId);
		if (cached) return cached;
		try {
			const rec = await getMasterWaveformBySong(songId);
			if (!rec || !rec.peaks || !rec.bins) return '';
			const peaks = rec.peaks; // Uint8Array
			const w = Math.max(240, Math.min(800, opts.width || 480));
			const h = Math.max(40, Math.min(160, opts.height || 60));
			const c = document.createElement('canvas'); c.width = w; c.height = h;
			const ctx = c.getContext('2d');
			// background
			ctx.fillStyle = '#0f1419'; ctx.fillRect(0,0,w,h);
			ctx.strokeStyle = '#2b3138'; ctx.strokeRect(0.5,0.5,w-1,h-1);
			// draw peaks as bars
			const len = peaks.length || rec.bins;
			const bar = 1, gap = 1, col = bar + gap; const cols = Math.min(Math.floor(w/col), len);
			for (let i=0;i<cols;i++){
				const start = Math.floor((i/cols)*len);
				const end = Math.floor(((i+1)/cols)*len);
				let vmax = 0; for (let j=start;j<end;j++){ const v=(peaks[j]||0)/255; if (v>vmax) vmax=v; }
				const bh = Math.max(1, Math.floor(vmax*(h-6)));
				const x = i*col + 0.5; const y = Math.floor((h-bh)/2)+0.5;
				ctx.fillStyle = '#3a90e5';
				ctx.fillRect(x, y, bar, bh);
			}
			const url = c.toDataURL('image/png');
			this.waveformCache.set(songId, url);
			return url;
		} catch(e) { return ''; }
	},
	getLyricsForSong(songId) {
		// Prefer the song.lyrics field from DB; fallback to textarea; finally use displayed lyrics
		try {
			// Guard against invalid songId
			if (!songId) return [];
			
			const song = songs.find(s => s.id === songId);
			let srcRaw = '';
			
			// Memory safety - wrap each access in try/catch
			try {
				srcRaw = (song && typeof song.lyrics === 'string' && song.lyrics.trim())
					? song.lyrics
					: '';
			} catch (e) {
				console.warn('Error accessing song lyrics:', e);
			}
			
			// If no lyrics in song object, try textarea
			if (!srcRaw) {
				try {
					srcRaw = document.getElementById('lyricsTextarea')?.value || '';
				} catch (e) {
					console.warn('Error accessing lyrics textarea:', e);
				}
			}
			
			// Last-resort: capture what's currently shown in the lyrics display
			if (!srcRaw) {
				try {
					const disp = document.getElementById('lyricsDisplay');
					if (disp) {
						// Use textContent to strip any spans/timestamps rendered by lyrics.js
						srcRaw = (disp.textContent || '').trim();
					}
				} catch (e) {
					console.warn('Error accessing lyrics display:', e);
				}
			}
			
			// Limit the lyrics size to prevent memory issues
			const maxSize = 50000; // 50KB is plenty for lyrics
			const src = String(srcRaw || '').replace(/\r\n/g, '\n').substring(0, maxSize);
			if (!src) return [];
			
			const lines = src.split(/\n/);
			const out = [];
			// Timestamp like [mm:ss] or [m:ss.mmm]
			const tsRe = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;
			// Process lines with a safety limit to prevent infinite loops
			const maxProcessedLines = 500; // Limit to 500 lines for safety
			const linesToProcess = lines.slice(0, maxProcessedLines);
			
			for (const raw of linesToProcess) {
				if (!raw || !raw.trim()) continue;
				
				// Limit line length for safety
				const maxLineLength = 1000;
				const trimmedRaw = raw.slice(0, maxLineLength);
				
				// Remove embedded MIDI tags from the lyric text for viewers
				const noMidi = trimmedRaw.replace(/\[\[[^\]]+\]\]/g, '');
				let foundTS = false;
				
				try {
					// Safer approach to prevent infinite loops or excessive memory usage
					// Create a fresh regex instance each time instead of reusing
					const timestamps = [...trimmedRaw.matchAll(/\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g)];
					
					// Process each found timestamp - with limit for safety
					const maxTimestamps = 10; // Limit to 10 timestamps per line for safety
					const limitedTimestamps = timestamps.slice(0, maxTimestamps);
					
					// Process each found timestamp
					for (const match of limitedTimestamps) {
						foundTS = true;
						const mm = parseInt(match[1], 10) || 0;
						const ss = parseInt(match[2], 10) || 0;
						const ms = parseInt(match[3] || '0', 10) || 0;
						const t = mm * 60 + ss + (ms/1000);
						out.push({ t, text: noMidi.replace(/\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g, '').trim() });
					}
					
					if (!foundTS) {
						out.push({ t: NaN, text: noMidi.replace(tsRe, '').trim() });
					}
				} catch (err) {
					console.warn('Error processing lyrics timestamp:', err);
					// Add the line without timestamp if there was an error
					out.push({ t: NaN, text: noMidi.trim() });
				}
			}
			// Normalize untimed lines relative to previous timestamp - with safety limits
			try {
				// Limit output size for safety before sorting
				const maxLyricLines = 300;
				if (out.length > maxLyricLines) {
					console.warn(`Truncating lyrics from ${out.length} to ${maxLyricLines} lines for memory safety`);
					out.splice(maxLyricLines); // Truncate to prevent excessive memory usage
				}
				
				// Sort with error handling
				try {
					out.sort((a,b) => (isNaN(a.t)? Infinity : a.t) - (isNaN(b.t)? Infinity : b.t));
				} catch (e) {
					console.warn('Error sorting lyrics by timestamp:', e);
				}
				
				let lastT = 0;
				for (let i=0; i<out.length; i++) {
					if (isNaN(out[i].t)) {
						lastT = lastT + 2; // space untimed lines by 2s
						out[i].t = lastT;
					} else {
						lastT = out[i].t;
					}
				}
				
				// Final sort with error handling
				try {
					out.sort((a,b) => a.t-b.t);
				} catch (e) {
					console.warn('Error in final lyrics sort:', e);
				}
				
				// Ensure no duplicate timestamps
				for (let i=1; i<out.length; i++) {
					if (out[i].t <= out[i-1].t) out[i].t = out[i-1].t + 0.01;
				}
			} catch (e) {
				console.warn('Error normalizing lyrics timestamps:', e);
			}
			return out;
		} catch (e) {
			console.warn('Broadcast.getLyricsForSong failed', e);
			return [];
		}
	},
	currentSongMeta() {
		const song = songs.find(s => s.id === selectedSongId) || {};
		let title = song.title || '';
		let artist = song.artist || '';
		if (!title) {
			try {
				const tEl = document.getElementById('displaySongTitle');
				const txt = (tEl && tEl.textContent) ? String(tEl.textContent).trim() : '';
				if (txt) {
					const parts = txt.split(' – ');
					title = parts[0] || title;
					artist = parts[1] || artist;
				}
			} catch(_) {}
		}
		return { title, artist };
	},
	formatTimeText(sec){ sec=Math.max(0,sec||0); const m=Math.floor(sec/60); const s=Math.floor(sec%60).toString().padStart(2,'0'); return `${m}:${s}`; },
	lyricsTextFromLines(lines){
		try { return (lines||[]).map(l=>`[${this.formatTimeText(l.t)}] ${l.text||''}`).join('\n'); } catch(_) { return ''; }
	},
	async snapshot() {
		const meta = this.currentSongMeta();
		const pos = (function(){
			if (!audioEngine.ctx) return audioEngine.offset || 0;
			const now = audioEngine.ctx.currentTime;
			return audioEngine.playing ? Math.max(0, now - audioEngine.startTime) + audioEngine.offset : audioEngine.offset || 0;
		})();
		const lyr = this.getLyricsForSong(selectedSongId);
		const songId = selectedSongId;
		let waveformDataUrl = '';
		if (songId) { try { waveformDataUrl = await this.getMasterWaveformDataUrl(songId, { width: 480, height: 60 }); } catch(_) {} }
		return {
			song: meta,
			songText: (meta.title || meta.artist) ? `${meta.title||''} – ${meta.artist||''}`.trim() : '',
			duration: audioEngine.duration || 0,
			position: pos,
			positionText: this.formatTimeText(pos),
			playing: !!audioEngine.playing,
			lyrics: lyr,
			lyricsText: this.lyricsTextFromLines(lyr),
			activeIndex: (function(){ try { return typeof window.LYRICS_ACTIVE_INDEX === 'number' ? window.LYRICS_ACTIVE_INDEX : -1; } catch(_) { return -1; } })(),
			waveformDataUrl
		};
	},
	async pushSnapshot(force=false) {
		if (!this.started || !this.room) return;
		const now = performance.now();
		if (!force && now - this.lastSentMs < this.minIntervalMs) return;
		const io = this.ensureSocket();
		const state = await this.snapshot();
		this.lastSentMs = now;
		try { console.log('[BCAST] push', { room: this.room, title: state.song?.title, pos: state.positionText, lyrics: (state.lyrics||[]).length }); } catch(_) {}
		// Socket emit (if available)
		try { io?.emit('state:push', { room: this.room, state }); } catch(_) {}
		// Firebase publish (static occasionally, live every tick)
		try { await this.pushStaticIfNeeded(state); } catch(_) {}
		try { await this.pushLive(state); } catch(_) {}
	}
};
// Expose a minimal API to the page for UI wiring
window.STP_Broadcast = {
	start: (room) => { Broadcast.start(room); try { window.updateBroadcastStatusChip?.(); } catch(_) {}; },
	stop: () => { Broadcast.stop(); try { window.updateBroadcastStatusChip?.(); } catch(_) {}; }
};

function renderSongs() {
	if (!songsContainer) return;
	songsContainer.innerHTML = '';
	if (songCountEl) songCountEl.textContent = `(${songs.length})`;
	// Sort songs by title (case-insensitive, numeric-aware)
	const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
	const sorted = (songs || []).slice().sort((a,b) => collator.compare(a?.title || '', b?.title || ''));
	// Group by first character header
	const headerFor = (title) => {
		const t = String(title || '').trim();
		if (!t) return '#';
		const ch = t[0].toUpperCase();
		if (/^[A-Z0-9]$/.test(ch)) return ch;
		return '#';
	};
	let lastHeader = null;
	sorted.forEach(song => {
		const hdr = headerFor(song.title);
		if (hdr !== lastHeader) {
			lastHeader = hdr;
			const h = document.createElement('div');
			h.className = 'song-section-header';
			h.textContent = hdr;
			songsContainer.appendChild(h);
		}
		const card = document.createElement('div');
		card.className = 'song-card' + (song.id === selectedSongId ? ' active' : '');
		card.tabIndex = 0;

			// Faint background stereo meters (top half = L, bottom half = R)
			const bg = document.createElement('div');
			bg.className = 'song-bg-meters';
			bg.innerHTML = `
				<div class="song-bg-row song-bg-row-L">
					<div class="song-bg-track"><div class="song-bg-bar song-bg-bar-L"></div></div>
				</div>
				<div class="song-bg-row song-bg-row-R">
					<div class="song-bg-track"><div class="song-bg-bar song-bg-bar-R"></div></div>
				</div>`;
			card.appendChild(bg);

		// Song title, artist, time
		const title = document.createElement('div');
		title.className = 'song-title';
		title.textContent = song.title;
		card.appendChild(title);

		const artist = document.createElement('div');
		artist.className = 'song-artist';
		artist.textContent = song.artist;
		card.appendChild(artist);

		// Song time (stub: random or fixed for now)
		const time = document.createElement('div');
		time.className = 'song-time';
		time.textContent = song.duration || (song.title === 'Comfortably Numb' ? '6:34' : song.title === 'Already Gone' ? '4:26' : '3:49');
		card.appendChild(time);

		// Track count button
		const controls = document.createElement('div');
		controls.className = 'song-controls';
		let trackCount = (typeof song.tracks === 'number' ? song.tracks : 0);
		const trackBtn = document.createElement('button');
		trackBtn.className = 'track-btn';
		trackBtn.textContent = `${trackCount} tracks`;
		trackBtn.title = 'Open Track Manager';
		// If we don't have a reliable trackCount, resolve it asynchronously
		if (!song.tracks || song.tracks === 0) {
			// Best-effort: fetch tracks count and update button label
			(async () => {
				try {
					const list = await getTracks(song.id);
					if (Array.isArray(list)) {
						const c = list.length;
						if (c !== trackCount) {
							trackCount = c;
							trackBtn.textContent = `${trackCount} tracks`;
						}
					}
				} catch(_) {}
			})();
		}
		trackBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			// Always resolve the opener from window to avoid module-scope ReferenceError
			const opener = window.openTrackManager;
			if (typeof opener === 'function') {
				try { opener(song.id); } catch (err) { console.error('openTrackManager threw:', err); }
			} else {
				console.error('openTrackManager is not available on window');
			}
		});
		controls.appendChild(trackBtn);
		card.appendChild(controls);

		// Original per-card meters removed; using background meters instead

		card.addEventListener('click', () => {
			// Prevent switching songs while any song is currently playing
			try {
				if (audioEngine && audioEngine.playing) {
					try { showNotification('Stop playback to switch songs.', 'info'); } catch(_) { alert('Stop playback to switch songs.'); }
					return;
				}
			} catch(_) { /* noop */ }
			selectedSongId = song.id;
			window.selectedSongId = selectedSongId;
			// Reset offset when switching songs so subsequent plays start from 0 unless user seeks
			audioEngine.offset = 0;
			audioEngine.previewStopAt = null;
			audioEngine.pendingSeekPct = null;
			audioEngine.lastSeekSec = null;
			audioEngine.loadedSongId = null;
			audioEngine.loadingPromise = null;
			audioEngine.loadingSongId = null;
			updateDetails(song);
			renderSongs();
			// Preload audio buffers using the same deduped path as playback
			ensureSongLoaded(selectedSongId).catch(err => console.warn('preload error', err));
			// Render stored master waveform if available
			renderMasterWaveFromDB(selectedSongId).catch(()=>{});
			// Notify viewers about the newly selected song immediately
			try { Broadcast.pushSnapshot(true); } catch(_) {}
		});
		card.addEventListener('keydown', (e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				card.click();
			}
		});
		songsContainer.appendChild(card);
	});
}

function updateDetails(song) {
	if (!songDetailsTitle) return;
	songDetailsTitle.textContent = song.title + (song.artist ? ' – ' + song.artist : '');
	// Paragraph may not exist in Performance page; guard access
	if (songDetailsPara) {
		const write = (count) => {
			songDetailsPara.textContent = song.artist ? (song.artist + ' — ' + count + ' tracks') : 'No artist information.';
		};
		if (typeof song.tracks === 'number') {
			write(song.tracks);
		} else {
			write(0);
			// Fetch dynamically
			(async () => {
				try {
					const list = await getTracks(song.id);
					if (Array.isArray(list)) write(list.length);
				} catch(_) {}
			})();
		}
	}
}

function openAddSongModal() {
	console.log('openAddSongModal called');
	if (addSongModal) {
		addSongModal.classList.remove('hidden');
		addSongModal.style.display = 'flex'; // force show for debug
	}
	if (newSongTitle) newSongTitle.value = '';
	if (newSongArtist) newSongArtist.value = '';
	if (newSongTitle) newSongTitle.focus();
}

function closeAddSongModal() {
	console.log('closeAddSongModal called');
	if (addSongModal) {
		addSongModal.classList.add('hidden');
		addSongModal.style.display = ''; // reset forced display
	}
}

async function handleAddSong(e) {
	e.preventDefault();
	const title = newSongTitle.value.trim();
	const artist = newSongArtist.value.trim();
	if (!title) {
		newSongTitle.focus();
		return;
	}
	// Initialize per-song count-in defaults (including volume multiplier)
	const song = { title, artist, tracks: 0, countInEnabled: false, countInBPM: 120, countInBalance: 0, countInVolume: 1.0 };
	const id = await addSong(song);
	// Fetch updated songs from IndexedDB
	songs = await getSongs();
	window.songs = songs;
	selectedSongId = id;
	window.selectedSongId = selectedSongId;
	await renderSongs();
	updateDetails({ ...song, id });
	closeAddSongModal();
}

function openDeleteSongModal() {
	const song = songs.find(s => s.id === selectedSongId);
	if (!song) return;
	if (deleteSongInfo) {
		deleteSongInfo.innerHTML = `<strong>${escapeHtml(song.title)}</strong><br>${escapeHtml(song.artist)}`;
	}
	if (deleteSongModal) {
		deleteSongModal.classList.remove('hidden');
		deleteSongModal.style.display = 'flex';
	}
}

function closeDeleteSongModal() {
	if (deleteSongModal) {
		deleteSongModal.classList.add('hidden');
		deleteSongModal.style.display = ''; // reset to stylesheet control
	}
}

async function handleConfirmDeleteSong() {
	const song = songs.find(s => s.id === selectedSongId);
	if (!song) return closeDeleteSongModal();
	// If the song is currently playing or loaded, stop and clear audio graph to avoid dangling refs
	try {
		if (audioEngine && (audioEngine.songId === selectedSongId || audioEngine.loadedSongId === selectedSongId)) {
			if (audioEngine.playing) { try { stopPlayback(); } catch(_) {} }
			// Extra hard clear
			try { clearGraph(); } catch(_) {}
			audioEngine.buffers.clear();
			audioEngine.duration = 0;
			audioEngine.offset = 0;
			audioEngine.loadedSongId = null;
			audioEngine.loadingSongId = null;
			audioEngine.loadingPromise = null;
		}
	} catch(_) {}
	await deleteSong(selectedSongId);
	// Refresh song list
	songs = await getSongs();
	window.songs = songs;
	await renderSongs();
	// If there are still songs, do not auto-select; require explicit user click
	selectedSongId = null;
	window.selectedSongId = selectedSongId;
	if (songDetailsTitle) songDetailsTitle.textContent = '';
	if (songDetailsPara) songDetailsPara.textContent = 'No song selected.';
	// Clear header waveform since no selection now
	try { await renderMasterWaveFromDB(null); } catch(_) {}
	closeDeleteSongModal();
}

function escapeHtml(unsafe) {
	return String(unsafe || '').replace(/[&<>"']/g, function(m){
		return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m];
	});
}

if (addSongBtn) addSongBtn.addEventListener('click', openAddSongModal);
console.log('Add Song button:', addSongBtn);
console.log('Add Song form:', addSongForm);
if (addSongBtn) addSongBtn.addEventListener('click', () => { console.log('Add Song button clicked'); openAddSongModal(); });
if (closeAddSongBtn) closeAddSongBtn.addEventListener('click', closeAddSongModal);
if (addSongForm) addSongForm.addEventListener('submit', handleAddSong);
window.addEventListener('keydown', (e) => {
	if (e.key === 'Escape' && addSongModal && !addSongModal.classList.contains('hidden')) {
		closeAddSongModal();
	}
});

// Settings menu open/close
function closeSettingsMenu() {
	if (!settingsRoot) return;
	settingsRoot.classList.remove('open');
	if (settingsBtn) settingsBtn.setAttribute('aria-expanded', 'false');
	if (settingsMenu) settingsMenu.setAttribute('aria-hidden', 'true');
}
function toggleSettingsMenu() {
	if (!settingsRoot || !settingsBtn || !settingsMenu) return;
	const isOpen = settingsRoot.classList.toggle('open');
	settingsBtn.setAttribute('aria-expanded', String(isOpen));
	settingsMenu.setAttribute('aria-hidden', String(!isOpen));
}
if (settingsBtn) settingsBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleSettingsMenu(); });
document.addEventListener('click', (e) => {
	if (!settingsRoot) return;
	if (!settingsRoot.contains(e.target)) closeSettingsMenu();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSettingsMenu(); });

// Import / Export bindings
async function handleAudioFiles(e) {
	const list = e.target.files;
	if (!list || !list.length) return;
	// Prototype: add each file as a new song with one track is not used anymore in production; leaving empty.
}

async function exportArchive() {
	try {
		const result = await exportCompleteDatabase();
		console.log('Export completed:', result);
	} catch (error) {
		console.error('Export error:', error);
		showNotification(error.message, 'error');
	}
}

async function importArchive() {
	const fileInput = document.getElementById('archiveFileInput');
	if (!fileInput) {
		showNotification('Import functionality not available', 'error');
		return;
	}
	
	// Trigger file picker
	fileInput.click();
}

// Refresh UI state after a successful import
async function refreshUIAfterImport() {
	console.log('Import completed, refreshing UI...');
	try {
		songs = await getSongs();
		window.songs = songs;
		await renderSongs();
		// Clear any selected song
		selectedSongId = null;
		window.selectedSongId = null;
		// Update song details display
		if (songDetailsTitle) songDetailsTitle.textContent = '';
		if (songDetailsPara) songDetailsPara.textContent = songs.length > 0 ? 'Select a song to view details.' : 'No songs available.';
		// Clear master waveform
		try { await renderMasterWaveFromDB(null); } catch(_) {}
		console.log('UI refreshed successfully');
	} catch (refreshError) {
		console.error('Failed to refresh UI after import:', refreshError);
		// Fall back to page reload if UI refresh fails
		setTimeout(() => { location.reload(); }, 1000);
	}
}

async function handleImportFile(e) {
	const file = e.target.files[0];
	if (!file) return;
	
	// Clear the input so the same file can be selected again if needed
	e.target.value = '';
	// Show preview card and, on confirm, run import and refresh UI
	await showImportPreview(file, { onAfterImport: refreshUIAfterImport });
}
// Fullscreen functionality
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    // Enter fullscreen
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen();
    } else if (document.documentElement.mozRequestFullScreen) { // Firefox
      document.documentElement.mozRequestFullScreen();
    } else if (document.documentElement.webkitRequestFullscreen) { // Chrome, Safari & Opera
      document.documentElement.webkitRequestFullscreen();
    } else if (document.documentElement.msRequestFullscreen) { // IE/Edge
      document.documentElement.msRequestFullscreen();
    }
  } else {
    // Exit fullscreen
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.mozCancelFullScreen) { // Firefox
      document.mozCancelFullScreen();
    } else if (document.webkitExitFullscreen) { // Chrome, Safari & Opera
      document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) { // IE/Edge
      document.msExitFullscreen();
    }
  }
}

if (audioFileInput) audioFileInput.addEventListener('change', handleAudioFiles);
if (exportArchiveBtn) exportArchiveBtn.addEventListener('click', () => { showExportPreview(); closeSettingsMenu(); });
if (importArchiveBtn) importArchiveBtn.addEventListener('click', () => { importArchive(); closeSettingsMenu(); });
if (archiveFileInput) archiveFileInput.addEventListener('change', handleImportFile);
const fullscreenBtn = document.getElementById('fullscreenBtn');
if (fullscreenBtn) fullscreenBtn.addEventListener('click', () => { toggleFullscreen(); closeSettingsMenu(); });

// Start Broadcast menu item removed per UX; broadcasting only via Dashboard
// Reset Storage button removed from menu
// if (resetStorageBtn) resetStorageBtn.addEventListener('click', async () => {
//	closeSettingsMenu();
//	try {
//		await wipeDatabase();
//	} catch (e) {
//		console.warn('wipeDatabase error', e);
//	}
//	// Hard reload to re-open DB and clear in-memory state
//	location.reload();
// });


if (deleteSongBtn) deleteSongBtn.addEventListener('click', openDeleteSongModal);
if (closeDeleteSongBtn) closeDeleteSongBtn.addEventListener('click', closeDeleteSongModal);
if (cancelDeleteSongBtn) cancelDeleteSongBtn.addEventListener('click', closeDeleteSongModal);
if (confirmDeleteSongBtn) confirmDeleteSongBtn.addEventListener('click', handleConfirmDeleteSong);
// MIDI Manager moved to dashboard.js. Only keep a small status-chip updater here.
function updateMidiStatusChip() {
    const chip = document.getElementById('midiStatus');
    const dot = chip ? chip.querySelector('.dot') : null;
    if (!chip || !dot) return;
    const counts = (window.STP_MIDI && typeof window.STP_MIDI.getConnectedCounts === 'function')
        ? window.STP_MIDI.getConnectedCounts()
        : { inputs: 0, outputs: 0 };
    const active = (counts.inputs > 0 || counts.outputs > 0);
    dot.style.backgroundColor = active ? '#2ecc71' : '#9aa7b3';
    chip.title = active ? `MIDI: ${counts.inputs} input(s), ${counts.outputs} output(s)` : 'MIDI disconnected';
}

// Flash the MIDI indicator with multiple blinks when MIDI activity happens
function flashMidiIndicator() {
    console.log('[MIDI] Flashing indicator with multiple blinks');
    const chip = document.getElementById('midiStatus');
    if (!chip) {
        console.warn('[MIDI] MIDI status chip not found');
        return;
    }
    
    // If already flashing, reset the timer but don't restart animation
    if (chip._midiFlashTimer) {
        clearTimeout(chip._midiFlashTimer);
    } else {
        // Only add the class if not already flashing
        chip.classList.add('midi-flash');
    }
    
    // Set timeout to remove class after animation completes
    chip._midiFlashTimer = setTimeout(() => {
        chip.classList.remove('midi-flash');
        chip._midiFlashTimer = null;
    }, 1500);
}
window.updateMidiStatusChip = updateMidiStatusChip;
window.flashMidiIndicator = flashMidiIndicator;
// Try once on load (dashboard.js will call this again on changes)
setTimeout(() => { try { updateMidiStatusChip(); } catch (_) {} }, 0);

// Broadcast status chip updater
function updateBroadcastStatusChip() {
	const chip = document.getElementById('broadcastStatus');
	const dot = chip ? chip.querySelector('.dot') : null;
	if (!chip || !dot) return;
	const active = !!(Broadcast && Broadcast.started);
	dot.style.backgroundColor = active ? '#2ecc71' : '#9aa7b3';
	chip.title = active ? `Broadcasting${Broadcast.room ? `: ${Broadcast.room}` : ''}` : 'Broadcast off';
}
window.updateBroadcastStatusChip = updateBroadcastStatusChip;
setTimeout(() => { try { updateBroadcastStatusChip(); } catch(_) {} }, 0);
// Lyrics Manager Modal logic
function setTrackPan(trackId, pan) {
	const p = Math.max(-1, Math.min(1, Number(pan)));
	const gL = audioEngine.gainsL.get(trackId);
	const gR = audioEngine.gainsR.get(trackId);
	if (!gL || !gR) return;
	const lMul = p >= 0 ? (1 - p) : 1;
	const rMul = p <= 0 ? (1 + p) : 1;
	gL.gain.value = lMul;
	gR.gain.value = rMul;
}
// lyrics.js provides the Lyrics Manager modal functionality

// ------------------ Audio Engine (Web Audio) ------------------
const audioEngine = {
	ctx: null,
	songId: null,
	buffers: new Map(), // trackId -> AudioBuffer
	sources: new Map(), // trackId -> AudioBufferSourceNode
	gains: new Map(),   // trackId -> GainNode (master per-track volume/mute/solo)
	gainsL: new Map(),  // trackId -> GainNode (left balance)
	gainsR: new Map(),  // trackId -> GainNode (right balance)
	analysersL: new Map(), // trackId -> AnalyserNode (left)
	analysersR: new Map(), // trackId -> AnalyserNode (right)
	meterDataL: new Map(), // trackId -> Uint8Array
	meterDataR: new Map(), // trackId -> Uint8Array
	masterGain: null,   // Global headroom gain
	masterMerger: null, // Shared 2-ch merger to preserve stereo separation across tracks
	meterDispL: new Map(), // trackId -> number (smoothed display value)
	meterDispR: new Map(), // trackId -> number
	meterPeakL: new Map(), // trackId -> number (peak-hold value)
	meterPeakR: new Map(), // trackId -> number
	meterPeakHoldL: new Map(), // trackId -> ms timestamp to hold until
	meterPeakHoldR: new Map(),
	meterBarHoldUntilL: new Map(), // short bar hold per channel (ms timestamp)
	meterBarHoldUntilR: new Map(),
	lastMeterTs: 0,
	startTime: 0,
	offset: 0,
	duration: 0,
	pendingSeekPct: null,
	lastSeekSec: null,
	previewStopAt: null,
	playing: false,
	rafId: 0,
	loadingPromise: null,
	loadingSongId: null,
	loadedSongId: null,
	// Strict start latch to prevent first-play jumps
	startSeq: 0,
	expectedStartSec: null,
	startCorrectionDone: false,
	lastStartOpts: null,
	warmed: false
};
// Expose audioEngine so lyrics.js can read playhead/duration if needed
window.audioEngine = audioEngine;

async function ensureAudioCtx() {
	if (!audioEngine.ctx) {
		const AC = window.AudioContext || window.webkitAudioContext;
		audioEngine.ctx = new AC();
	}
	if (audioEngine.ctx.state === 'suspended') {
		await audioEngine.ctx.resume();
	}
}

// Warm up the audio pipeline with a short silent buffer on first user gesture
async function primeAudioOnce() {
	try {
		await ensureAudioCtx();
		if (audioEngine.warmed) return;
		const ctx = audioEngine.ctx;
		const durSec = 0.05;
		const buf = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * durSec)), ctx.sampleRate);
		const src = ctx.createBufferSource();
		src.buffer = buf;
		const g = ctx.createGain();
		g.gain.value = 0.0001; // effectively silent
		src.connect(g);
		g.connect(ctx.destination);
		try { src.start(); } catch(_) {}
		setTimeout(() => {
			try { src.stop(); } catch(_) {}
			try { src.disconnect(); } catch(_) {}
			try { g.disconnect(); } catch(_) {}
		}, 80);
		audioEngine.warmed = true;
	} catch (e) {
		// no-op: warming is best-effort
	}
}

// Create an AudioContext if missing, but do NOT resume.
function ensureDecodeCtx() {
	if (!audioEngine.ctx) {
		const AC = window.AudioContext || window.webkitAudioContext;
		audioEngine.ctx = new AC();
		// leave in 'suspended' state until a user gesture triggers playback
	}
}

function decodeBuffer(arrayBuffer) {
	return new Promise((resolve, reject) => {
		if (!audioEngine.ctx) {
			try { ensureDecodeCtx(); } catch (e) { reject(e); return; }
		}
		audioEngine.ctx.decodeAudioData(arrayBuffer, resolve, reject);
	});
}

// Ensure all track buffers are stereo so the downstream graph is identical for mono/stereo
function upmixToStereoBuffer(buf) {
	try {
		if (!buf || typeof buf.numberOfChannels !== 'number') return buf;
		if (buf.numberOfChannels === 1) {
			const ctx = audioEngine.ctx;
			const out = new AudioBuffer({ length: buf.length, sampleRate: buf.sampleRate, numberOfChannels: 2 });
			// Copy mono samples into both channels
			const mono = buf.getChannelData(0);
			out.copyToChannel(mono, 0);
			out.copyToChannel(mono, 1);
			// Mark for potential future gain compensation or analytics
			out._stpWasMono = true;
			return out;
		}
	} catch (_) { /* no-op; return original buffer on failure */ }
	return buf;
}

async function loadSongAudio(songId) {
	audioEngine.buffers.clear();
	audioEngine.duration = 0;
	const tracks = await getTracks(songId);
	const jobs = tracks.map(async (t) => {
		try {
			const afList = await getAudioFiles(t.id);
			const af = afList && afList[0];
			if (!af || !af.blob) return null;
			const arr = await af.blob.arrayBuffer();
			const raw = await decodeBuffer(arr);
			const buf = upmixToStereoBuffer(raw);
			return { id: t.id, buf };
		} catch (e) {
			console.warn('Failed to decode track', t.id, e);
			return null;
		}
	});
	const results = await Promise.all(jobs);
	for (const r of results) {
		if (!r) continue;
		audioEngine.buffers.set(r.id, r.buf);
		audioEngine.duration = Math.max(audioEngine.duration, r.buf.duration);
	}
	// If we have a pending seek and just learned duration, set the offset now
	if (audioEngine.pendingSeekPct != null && (audioEngine.duration || 0) > 0) {
		const target = Math.max(0, Math.min(audioEngine.duration, audioEngine.pendingSeekPct * audioEngine.duration));
		audioEngine.offset = target;
		audioEngine.lastSeekSec = target;
		audioEngine.expectedStartSec = target;
	}
}

function clearGraph() {
	// Stop any playing sources and disconnect nodes
	audioEngine.sources.forEach((src) => { try { src.stop(); } catch(_){} src.disconnect(); });
	audioEngine.gains.forEach((g)=>g.disconnect());
	audioEngine.gainsL.forEach((g)=>g.disconnect());
	audioEngine.gainsR.forEach((g)=>g.disconnect());
	if (audioEngine.masterMerger) {
		try { audioEngine.masterMerger.disconnect(); } catch(_){}
		audioEngine.masterMerger = null;
	}
	if (audioEngine.masterGain) {
		try { audioEngine.masterGain.disconnect(); } catch(_){}
		audioEngine.masterGain = null;
	}
	audioEngine.sources.clear();
	audioEngine.gains.clear();
	audioEngine.gainsL.clear();
	audioEngine.gainsR.clear();
	audioEngine.analysersL.clear();
	audioEngine.analysersR.clear();
	audioEngine.meterDataL.clear();
	audioEngine.meterDataR.clear();
	audioEngine.meterDispL.clear();
	audioEngine.meterDispR.clear();
	audioEngine.meterPeakL.clear();
	audioEngine.meterPeakR.clear();
	audioEngine.meterPeakHoldL.clear();
	audioEngine.meterPeakHoldR.clear();
	audioEngine.meterBarHoldUntilL.clear();
	audioEngine.meterBarHoldUntilR.clear();
	audioEngine.lastMeterTs = 0;
}

async function buildAndStart(songId, offsetSec = 0, opts = {}) {
	await ensureAudioCtx();
	await ensureSongLoaded(songId);
	// If no audio buffers decoded, do not start playback
	if (audioEngine.buffers.size === 0) {
		console.warn('No decoded audio buffers for song', songId);
		audioEngine.playing = false;
		syncPlayButtons();
		return;
	}
	// If there was a pending seek before duration was known, convert to absolute seconds now
	if (audioEngine.lastSeekSec != null) {
		offsetSec = Math.max(0, Math.min(audioEngine.duration || offsetSec, audioEngine.lastSeekSec));
		audioEngine.offset = offsetSec;
	} else if (audioEngine.pendingSeekPct != null && (audioEngine.duration || 0) > 0) {
		offsetSec = Math.max(0, Math.min(audioEngine.duration, audioEngine.pendingSeekPct * audioEngine.duration));
		audioEngine.offset = offsetSec;
		// Clear after we’ve scheduled start times
	}
	clearGraph();
	const now = audioEngine.ctx.currentTime;
	// Re-apply lastSeekSec just before scheduling to be absolutely sure
	if (audioEngine.lastSeekSec != null) {
		offsetSec = Math.max(0, Math.min(audioEngine.duration || offsetSec, audioEngine.lastSeekSec));
		audioEngine.offset = offsetSec;
	}
	// Guard to prevent device/context start hiccups. Use baseLatency when available.
	const guard = Math.max(0.08, Math.min(0.2, ((audioEngine.ctx.baseLatency || 0.03) * 3)));
	// Warm-start: schedule sources slightly earlier muted, then open at audible time
	const lead = Math.min(0.05, guard * 0.6);
	const startAtRaw = Math.max(now + 0.005, now + guard - lead);
	const audibleAt = now + guard;
	// Create a master headroom gain and a shared stereo merger to preserve discrete L/R sums
	audioEngine.masterGain = audioEngine.ctx.createGain();
	try {
		// Ensure downstream keeps channels discrete and stereo
		audioEngine.masterGain.channelCount = 2;
		audioEngine.masterGain.channelCountMode = 'explicit';
		audioEngine.masterGain.channelInterpretation = 'discrete';
	} catch(_) {}
	// Shared 2-channel merger that all tracks feed: L -> input 0, R -> input 1
	audioEngine.masterMerger = audioEngine.ctx.createChannelMerger(2);
	try {
		audioEngine.masterMerger.channelCount = 2;
		audioEngine.masterMerger.channelCountMode = 'explicit';
		audioEngine.masterMerger.channelInterpretation = 'discrete';
	} catch(_) {}
	audioEngine.masterMerger.connect(audioEngine.masterGain);
	const desiredMaster = (masterVolume && !isNaN(parseFloat(masterVolume.value))) ? parseFloat(masterVolume.value) : 0.5;
	// Start silent at raw start; ramp up around audible time
	audioEngine.masterGain.gain.setValueAtTime(0.0001, startAtRaw);
	audioEngine.masterGain.gain.linearRampToValueAtTime(desiredMaster, audibleAt + 0.03);
	audioEngine.masterGain.connect(audioEngine.ctx.destination);
	const tracks = await getTracks(songId);
	for (const t of tracks) {
		// If solo preview is requested, skip all other tracks
		if (opts && opts.soloTrackId && t.id !== opts.soloTrackId) continue;
		const buf = audioEngine.buffers.get(t.id);
		if (!buf) continue;
		// Respect per-track timeline offset when determining read position and skip logic
		const trackOffset = Number(t.offsetSec) || 0;
		const readAt = Math.max(0, offsetSec - trackOffset);
		// Skip this track if we've already passed its audio content
		if (readAt >= buf.duration) continue;
			const src = audioEngine.ctx.createBufferSource();
			src.buffer = buf;
			try {
				src.channelCount = 2;
				src.channelCountMode = 'explicit';
				src.channelInterpretation = 'discrete';
			} catch(_) {}
			const gain = audioEngine.ctx.createGain(); // master per-track
			const baseVol = Number(t.volume);
			// Preserve perceived loudness: if upmixed from mono, reduce ~3 dB
			const wasMono = !!buf._stpWasMono;
			const loudnessComp = wasMono ? 0.70710678 : 1.0;
			gain.gain.value = (Number.isFinite(baseVol) ? baseVol : 1) * loudnessComp;
			try {
				gain.channelCount = 2;
				gain.channelCountMode = 'explicit';
				gain.channelInterpretation = 'discrete';
			} catch(_) {}

		// Region gate for mute regions (before pan)
			const gate = audioEngine.ctx.createGain();
			gate.gain.value = 1;
			try {
				gate.channelCount = 2;
				gate.channelCountMode = 'explicit';
				gate.channelInterpretation = 'discrete';
			} catch(_) {}

		// Splitter to create L/R branches for pan processing
		const splitter = audioEngine.ctx.createChannelSplitter(2);
		try {
			splitter.channelCount = 2;
			splitter.channelCountMode = 'explicit';
			splitter.channelInterpretation = 'discrete';
		} catch(_) {}
		const gainL = audioEngine.ctx.createGain();
		const gainR = audioEngine.ctx.createGain();
		try {
			gainL.channelCount = 1; gainR.channelCount = 1;
			gainL.channelCountMode = 'explicit'; gainR.channelCountMode = 'explicit';
			gainL.channelInterpretation = 'discrete'; gainR.channelInterpretation = 'discrete';
		} catch(_) {}
		const p0 = Number(t.pan);
		const p = Number.isFinite(p0) ? Math.max(-1, Math.min(1, p0)) : 0;
		const lMul = p >= 0 ? (1 - p) : 1; // pan R reduces L
		const rMul = p <= 0 ? (1 + p) : 1; // pan L reduces R
		try {
			gainL.gain.setValueAtTime(lMul, startAtRaw);
			gainR.gain.setValueAtTime(rMul, startAtRaw);
		} catch(_) { gainL.gain.value = lMul; gainR.gain.value = rMul; }

	// For meters, analysers per channel after balance gains (works for mono or stereo sources)
		const analyserL = audioEngine.ctx.createAnalyser();
		const analyserR = audioEngine.ctx.createAnalyser();
	analyserL.fftSize = 512; analyserR.fftSize = 512; // larger window for smoother RMS
	analyserL.smoothingTimeConstant = 0.85;
	analyserR.smoothingTimeConstant = 0.85;
		try {
			// Force analysers to be mono and discrete to avoid any implicit up/down-mix
			analyserL.channelCount = 1; analyserR.channelCount = 1;
			analyserL.channelCountMode = 'explicit'; analyserR.channelCountMode = 'explicit';
			analyserL.channelInterpretation = 'discrete'; analyserR.channelInterpretation = 'discrete';
		} catch(_) {}
	const dataL = new Uint8Array(analyserL.fftSize);
	const dataR = new Uint8Array(analyserR.fftSize);

		// Connect: src -> gain -> gate -> (duplicate or split) -> gainL/R -> [analysers side-tap] -> masterMerger
		src.connect(gain);
		gain.connect(gate);
			// Buffers are guaranteed stereo; split channels uniformly for pan path
			gate.connect(splitter);
			splitter.connect(gainL, 0);
			splitter.connect(gainR, 1);
		// Side-tap analysers for meters only; do not put them in the audio path
		gainL.connect(analyserL);
		gainR.connect(analyserR);
		// Feed audio directly to the shared masterMerger to preserve discrete L/R
		gainL.connect(audioEngine.masterMerger, 0, 0);
		gainR.connect(audioEngine.masterMerger, 0, 1);
		// Start slightly before audible time so buffers stabilize; keep gate closed until audibleAt
		const off = Math.max(0, Math.min(readAt - lead, Math.max(0, buf.duration - 0.005)));
		try { src.start(startAtRaw, off); } catch (e) { console.warn('source start failed', e); }
		audioEngine.sources.set(t.id, src);
		audioEngine.gains.set(t.id, gain);
		audioEngine.gainsL.set(t.id, gainL);
		audioEngine.gainsR.set(t.id, gainR);
		audioEngine.analysersL.set(t.id, analyserL);
		audioEngine.analysersR.set(t.id, analyserR);
		audioEngine.meterDataL.set(t.id, dataL);
		audioEngine.meterDataR.set(t.id, dataR);

		// Keep gate closed until audible time; then schedule any mute regions using a robust helper
		try {
			gate.gain.cancelScheduledValues(startAtRaw);
			gate.gain.setValueAtTime(0.0, startAtRaw);
			scheduleMutesForTrack({
				ctx: audioEngine.ctx,
				gate,
				regions: Array.isArray(t.regions) ? t.regions : [],
				playheadAtAudibleSec: offsetSec, // song timeline position when gate opens
				trackOffsetSec: trackOffset,
				bufferDuration: buf.duration,
				startAtRaw,
				audibleAt,
				trackId: t.id
			});
		} catch(e) { /* no-op */ }

		// If preview has an explicit stop time, stop this source accordingly
		if (opts && typeof opts.stopAtSec === 'number' && opts.stopAtSec > offsetSec) {
			const stopAt = audibleAt + (opts.stopAtSec - offsetSec);
			try { src.stop(stopAt); } catch(_) {}
		}
	}
	// Latch start state for self-correction against any first-play jump
	audioEngine.songId = songId;
	audioEngine.startTime = audibleAt; // align UI timeline with audible open
	audioEngine.offset = offsetSec;
	audioEngine.startSeq = (audioEngine.startSeq || 0) + 1;
	audioEngine.expectedStartSec = offsetSec;
	audioEngine.startCorrectionDone = false;
	audioEngine.lastStartOpts = opts || null;
	// We have applied the seek; clear lastSeekSec so subsequent resume uses live offset
	audioEngine.lastSeekSec = null;
	// Track preview stop time separately so full playback isn't constrained
	audioEngine.previewStopAt = (opts && typeof opts.stopAtSec === 'number') ? opts.stopAtSec : null;
	audioEngine.playing = true;
	// Now safe to clear pending seek after graph is ready
	if (audioEngine.pendingSeekPct != null) audioEngine.pendingSeekPct = null;
	startProgressLoop();
	syncPlayButtons();
}

function pausePlayback() {
	if (!audioEngine.playing) return;
	const now = audioEngine.ctx.currentTime;
	const elapsed = Math.max(0, now - audioEngine.startTime) + audioEngine.offset;
	audioEngine.offset = Math.min(elapsed, audioEngine.duration);
	// Clear any stale seek so resume continues from pause position
	audioEngine.lastSeekSec = null;
	audioEngine.expectedStartSec = audioEngine.offset;
	clearGraph();
	audioEngine.playing = false;
	stopProgressLoop();
	// Drop background meters immediately on pause
	zeroSongCardBackgroundMeters();
	syncPlayButtons();
}

function stopPlayback() {
	if (!audioEngine.ctx) return;
	audioEngine.offset = 0;
	audioEngine.lastSeekSec = null;
	audioEngine.expectedStartSec = 0;
	clearGraph();
	audioEngine.playing = false;
	audioEngine.previewStopAt = null;
	stopProgressLoop();
	// Drop background meters immediately on stop
	zeroSongCardBackgroundMeters();
	if (playbackRange) playbackRange.value = '0';
	if (footerTimeCur) footerTimeCur.textContent = '0:00';
	if (footerTimeDur) footerTimeDur.textContent = formatTime(audioEngine.duration||0);
	// Sidebar timeline removed
	// Force master waveform to redraw so playhead snaps to the beginning immediately
	redrawMasterOverlays();
	syncPlayButtons();
}

function stopProgressLoop() {
	if (audioEngine.rafId) cancelAnimationFrame(audioEngine.rafId);
	audioEngine.rafId = 0;
}
// Immediately zero the background meters on the active song card
function zeroSongCardBackgroundMeters() {
	const activeCard = document.querySelector('.song-card.active');
	if (!activeCard) return;
	const bgL = activeCard.querySelector('.song-bg-bar-L');
	const bgR = activeCard.querySelector('.song-bg-bar-R');
	if (bgL) { bgL.style.width = '0%'; }
	if (bgR) { bgR.style.width = '0%'; }
}
function formatTime(sec){ sec = Math.max(0, sec||0); const m = Math.floor(sec/60); const s = Math.floor(sec%60); return `${m}:${s.toString().padStart(2,'0')}`; }
function startProgressLoop() {
	const loop = () => {
		if (!audioEngine.ctx) return;
		const now = audioEngine.ctx.currentTime;
		let pos = audioEngine.playing ? Math.max(0, now - audioEngine.startTime) + audioEngine.offset : audioEngine.offset;
		// During warm-start, clamp UI to offset until audible time
		if (audioEngine.playing && now < audioEngine.startTime) {
			pos = audioEngine.offset;
		}
		const clamped = Math.min(pos, audioEngine.duration || 0);
		// Self-correct a spurious jump-to-zero on first frames after start
		if (audioEngine.playing && !audioEngine.startCorrectionDone && audioEngine.expectedStartSec != null) {
			const expected = audioEngine.expectedStartSec;
			// if we expected to start beyond 0.35s but we are still near zero, correct once
			if (expected > 0.35 && clamped < 0.08) {
				audioEngine.startCorrectionDone = true; // ensure single correction
				const sid = audioEngine.songId;
				const opts = audioEngine.lastStartOpts || {};
				// rebuild at the intended offset without changing previewStopAt semantics
				buildAndStart(sid, expected, opts);
				return; // wait for next loop
			}
		}
		// Update footer range
		if (playbackRange && (audioEngine.duration||0) > 0) {
			const pct = (clamped / audioEngine.duration) * 100;
			playbackRange.value = String(Math.max(0, Math.min(100, pct)));
		}
		// Sidebar timeline removed
		if (footerTimeCur) footerTimeCur.textContent = formatTime(clamped);
		if (footerTimeDur) footerTimeDur.textContent = formatTime(audioEngine.duration||0);
		// Master waveform overlays (playhead + pulsing played area)
		redrawMasterOverlays();
		// Update Lyrics time, if visible
		const tdisp = document.getElementById('lyricsTimeDisplay');
		if (tdisp) tdisp.textContent = `${formatTime(clamped)} / ${formatTime(audioEngine.duration||0)}`;
		// Update meters using time-domain RMS per channel with smoothing, slow decay, and peak-hold
	let mixL = 0, mixR = 0; // for song-card background meters
	audioEngine.analysersL.forEach((anL, trackId) => {
			const arrL = audioEngine.meterDataL.get(trackId);
			const anR = audioEngine.analysersR.get(trackId);
			const arrR = audioEngine.meterDataR.get(trackId);
			if (!arrL || !arrR || !anR) return;
			anL.getByteTimeDomainData(arrL);
			anR.getByteTimeDomainData(arrR);
			// compute RMS and instantaneous PEAK from 8-bit time domain (center ~128)
			const n = Math.min(arrL.length, 512);
			let sumSqL = 0, sumSqR = 0;
			let instPeakL = 0, instPeakR = 0;
			for (let i=0;i<n;i++) {
				const vL = (arrL[i] - 128) / 128;
				const vR = (arrR[i] - 128) / 128;
				sumSqL += vL*vL;
				sumSqR += vR*vR;
				const aL = Math.abs(vL);
				const aR = Math.abs(vR);
				if (aL > instPeakL) instPeakL = aL;
				if (aR > instPeakR) instPeakR = aR;
			}
			const rmsL = Math.sqrt(sumSqL / n);
			const rmsR = Math.sqrt(sumSqR / n);
			// map RMS to 0..1 with conservative scaling
			const avgL = Math.min(1, rmsL * 2.3); // keep global punch
			const avgR = Math.min(1, rmsR * 2.3);
			// transient boost for percussive/click content
			const PEAK_WEIGHT = 1.6; // stronger boost for clicks/keys
			const targetL = Math.min(1, Math.max(avgL, instPeakL * PEAK_WEIGHT));
			const targetR = Math.min(1, Math.max(avgR, instPeakR * PEAK_WEIGHT));

			// Smoothed display value: attack fast, decay slow
			const prevL = audioEngine.meterDispL.get(trackId) ?? 0;
			const prevR = audioEngine.meterDispR.get(trackId) ?? 0;
			const decay = 0.08;  // keep slow decay
			// Short bar-hold to improve visual alignment with peak indicators
			const nowMs2 = performance.now();
			const barHoldMs = 90; // hold bars for ~90ms at new peaks
			let holdUntilBarL = audioEngine.meterBarHoldUntilL.get(trackId) ?? 0;
			let holdUntilBarR = audioEngine.meterBarHoldUntilR.get(trackId) ?? 0;
			if (targetL > prevL + 0.003) holdUntilBarL = nowMs2 + barHoldMs;
			if (targetR > prevR + 0.003) holdUntilBarR = nowMs2 + barHoldMs;

			let dispL = prevL;
			let dispR = prevR;
			if (nowMs2 <= holdUntilBarL) {
				dispL = Math.max(prevL, targetL);
			} else {
				dispL = targetL > prevL ? targetL : (prevL + decay*(targetL - prevL));
			}
			if (nowMs2 <= holdUntilBarR) {
				dispR = Math.max(prevR, targetR);
			} else {
				dispR = targetR > prevR ? targetR : (prevR + decay*(targetR - prevR));
			}
			audioEngine.meterBarHoldUntilL.set(trackId, holdUntilBarL);
			audioEngine.meterBarHoldUntilR.set(trackId, holdUntilBarR);
			audioEngine.meterDispL.set(trackId, dispL);
			audioEngine.meterDispR.set(trackId, dispR);
			// accumulate overall mix meters as max across tracks
			mixL = Math.max(mixL, dispL);
			mixR = Math.max(mixR, dispR);

			// Peak-hold line
			const holdMs = 900; // hold peak for ~0.9s
			const fallPerFrame = 0.01; // slow falling peak
			const nowMs = performance.now();
			let peakL = audioEngine.meterPeakL.get(trackId) ?? 0;
			let peakR = audioEngine.meterPeakR.get(trackId) ?? 0;
			let holdUntilL = audioEngine.meterPeakHoldL.get(trackId) ?? 0;
			let holdUntilR = audioEngine.meterPeakHoldR.get(trackId) ?? 0;
			if (dispL > peakL + 0.005) { peakL = dispL; holdUntilL = nowMs + holdMs; }
			if (dispR > peakR + 0.005) { peakR = dispR; holdUntilR = nowMs + holdMs; }
			if (nowMs > holdUntilL) peakL = Math.max(0, peakL - fallPerFrame);
			if (nowMs > holdUntilR) peakR = Math.max(0, peakR - fallPerFrame);
			audioEngine.meterPeakL.set(trackId, peakL);
			audioEngine.meterPeakR.set(trackId, peakR);
			audioEngine.meterPeakHoldL.set(trackId, holdUntilL);
			audioEngine.meterPeakHoldR.set(trackId, holdUntilR);
			const row = document.querySelector(`.track-row[data-track-id="${trackId}"]`);
			if (row) {
				const elL = row.querySelector('.mm-bar-L');
				const elR = row.querySelector('.mm-bar-R');
				const pkL = row.querySelector('.mm-peak-L');
				const pkR = row.querySelector('.mm-peak-R');
				if (elL) {
					const s = Math.max(0.02, Math.min(1, dispL));
					// width-based fill inside mm-track
					elL.style.width = `${s * 100}%`;
					elL.style.background = `linear-gradient(90deg, #1f2730, ${s>0.85?'#f44336':s>0.65?'#ff9800':'#3b4856'})`;
				}
				if (elR) {
					const s = Math.max(0.02, Math.min(1, dispR));
					elR.style.width = `${s * 100}%`;
					elR.style.background = `linear-gradient(90deg, #1f2730, ${s>0.85?'#f44336':s>0.65?'#ff9800':'#3b4856'})`;
				}
				if (pkL) {
					pkL.style.left = `calc(${Math.max(0, Math.min(1, peakL)) * 100}% - 1px)`;
				}
				if (pkR) {
					pkR.style.left = `calc(${Math.max(0, Math.min(1, peakR)) * 100}% - 1px)`;
				}
			}
		});

		// Update the background stereo meters for the selected, playing song
		const activeCard = document.querySelector('.song-card.active');
		const isPlayingSelected = audioEngine.playing && audioEngine.songId === selectedSongId;
		if (activeCard) {
			const bgL = activeCard.querySelector('.song-bg-bar-L');
			const bgR = activeCard.querySelector('.song-bg-bar-R');
			const lvlL = isPlayingSelected ? Math.max(0, Math.min(1, mixL)) : 0;
			const lvlR = isPlayingSelected ? Math.max(0, Math.min(1, mixR)) : 0;
			const wL = lvlL * 100;
			const wR = lvlR * 100;
			// Smooth hue mapping biased to show red only in top ~15%
			// For 0..0.85: hue 120 (green) -> 60 (yellow). For 0.85..1: 60 -> 0 (red)
			function hueForLevel(p) {
				const x = Math.max(0, Math.min(1, p));
				const knee = 0.90;
				if (x <= knee) {
					const t = x / knee; // 0..1
					return 120 - (120 - 60) * t; // 120 -> 60
				} else {
					const t = (x - knee) / (1 - knee); // 0..1
					return 60 - 60 * t; // 60 -> 0
				}
			}
			function gradForLevel(p) {
				const h = Math.max(0, Math.min(120, hueForLevel(p)));
				const sat = 60 + 8 * p; // 60% -> 68%
				const l1 = 26 + 2 * p;  // 26% -> 28%
				const l2 = 42 + 3 * p;  // 42% -> 45%
				const c1 = `hsl(${h}, ${sat}%, ${l1}%)`;
				const c2 = `hsl(${h}, ${sat+6}%, ${l2}%)`;
				return `linear-gradient(90deg, ${c1}, ${c2})`;
			}
			// Color drive compression so reds are rarer: use a reduced color level
			const colorL = gradForLevel(lvlL * 0.45);
			const colorR = gradForLevel(lvlR * 0.45);
			if (bgL) { bgL.style.width = `${wL}%`; bgL.style.background = colorL; }
			if (bgR) { bgR.style.width = `${wR}%`; bgR.style.background = colorR; }
		}
		// Auto stop at end
		const stopBoundary = (audioEngine.previewStopAt ?? audioEngine.duration) || 0;
		if (audioEngine.playing && clamped >= stopBoundary - 0.02) {
			stopPlayback();
			return;
		}
		// Throttled broadcast update piggybacks on RAF for zero-lag playhead sync without blocking
		// (Disabled) Broadcast pushes are handled by a 1s interval per spec
		audioEngine.rafId = requestAnimationFrame(loop);
	};
	stopProgressLoop();
	audioEngine.rafId = requestAnimationFrame(loop);
}

function seekToPercent(pct) {
	if (!audioEngine.duration) return;
	const target = Math.max(0, Math.min(audioEngine.duration, (pct/100) * audioEngine.duration));
	if (audioEngine.playing) {
		// Rebuild graph at new offset
		buildAndStart(audioEngine.songId, target);
	} else {
		audioEngine.offset = target;
		audioEngine.lastSeekSec = target;
		audioEngine.expectedStartSec = target;
		startProgressLoop();
	}
}

function setTrackVolume(trackId, vol) {
	const g = audioEngine.gains.get(trackId);
	if (g) g.gain.value = vol;
}
// Note: setTrackPan is defined earlier (above Lyrics Manager) to update gainsL/gainsR

async function toggleMute(track, desired) {
	const val = typeof desired === 'boolean' ? desired : !track.mute;
	track.mute = val; await updateTrack(track);
	// If any solo is active, overall gain logic is handled in recomputeSoloMute
	recomputeSoloMute();
}
async function toggleSolo(track, desired) {
	const val = typeof desired === 'boolean' ? desired : !track.solo;
	track.solo = val; await updateTrack(track);
	recomputeSoloMute();
}
async function recomputeSoloMute() {
	if (!audioEngine.songId) return;
	const tracks = await getTracks(audioEngine.songId);
	const anySolo = tracks.some(t=>t.solo);
	for (const t of tracks) {
		const g = audioEngine.gains.get(t.id);
		if (!g) continue;
		const base = typeof t.volume === 'number' ? t.volume : 1;
		const active = anySolo ? t.solo : !t.mute;
		g.gain.value = active ? base : 0;
		// Update corresponding button states in DOM if present
		const row = document.querySelector(`.track-row[data-track-id="${t.id}"]`);
		if (row) {
			const muteBtn = row.querySelector('.track-mute');
			const soloBtn = row.querySelector('.track-solo');
			if (muteBtn) muteBtn.classList.toggle('active', !!t.mute);
			if (soloBtn) soloBtn.classList.toggle('active', !!t.solo);
		}
	}
}

function syncPlayButtons() {
	// Footer
	if (footerPlayBtn) footerPlayBtn.textContent = audioEngine.playing ? '⏸️ Pause' : '▶️ Play';
	// Track Manager header button, if present
	const tmBtn = document.querySelector('#trackManagerHeaderControls .track-playpause');
	if (tmBtn) tmBtn.textContent = (audioEngine.playing && audioEngine.songId === selectedSongId) ? '⏸ Pause' : '▶ Play';
	// No sidebar play button
}

// Footer controls wiring
if (footerPlayBtn) footerPlayBtn.addEventListener('click', async () => {
	if (!selectedSongId) return;
	if (audioEngine.playing && audioEngine.songId === selectedSongId) {
		pausePlayback();
	} else {
		await primeAudioOnce();
		// If there was a fresh seek set, use it once; otherwise resume from current offset
		const useSeek = audioEngine.lastSeekSec;
		const startAt = (useSeek != null) ? useSeek : (audioEngine.offset || 0);
		await playSongWithOptionalCountIn(selectedSongId, startAt);
	}
	try { Broadcast.pushSnapshot(true); } catch(_) {}
});
if (footerStopBtn) footerStopBtn.addEventListener('click', () => {
	stopPlayback();
	try { Broadcast.pushSnapshot(true); } catch(_) {}
});
// Playback range scrubber removed on Performance page; keep no-op if absent
if (playbackRange) playbackRange.addEventListener('input', (e) => {
	const pct = parseFloat(e.target.value || '0');
	seekToPercent(pct);
});

// Click-to-seek on master waveform
if (masterWaveCanvas) {
	masterWaveCanvas.addEventListener('click', (e) => {
		if (!selectedSongId) return; // ignore until user picks a song
		// Use this user gesture to warm up the audio pipeline
		primeAudioOnce();
		const rect = masterWaveCanvas.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const w = rect.width;
		const pct = Math.max(0, Math.min(1, x / w));
		const dur = audioEngine.duration || 0;
		if (dur > 0) {
			const target = Math.max(0, Math.min(dur, pct * dur));
			audioEngine.lastSeekSec = target;
			audioEngine.expectedStartSec = target;
			if (audioEngine.playing) {
				buildAndStart(audioEngine.songId || selectedSongId || songs[0]?.id, target);
			} else {
				audioEngine.offset = target;
				startProgressLoop();
			}
			try { Broadcast.pushSnapshot(true); } catch(_) {}
		} else {
			// Defer the seek until we have duration/buffers
			audioEngine.pendingSeekPct = pct;
			audioEngine.lastSeekSec = null; // will be set once duration is known
			// Redraw overlays to show the intended playhead position proportionally
			redrawMasterOverlays();
		}
	});
}

// Master volume wiring
if (masterVolume) {
	const updateMasterVol = (v) => {
		if (audioEngine.masterGain) audioEngine.masterGain.gain.value = v;
		if (masterVolPct) masterVolPct.textContent = `${Math.round(v*100)}%`;
	};
	masterVolume.addEventListener('input', (e) => {
		const v = parseFloat(e.target.value || '0.5');
		updateMasterVol(v);
	});
	// Initialize label once DOM is ready
	updateMasterVol(parseFloat(masterVolume.value || '0.5'));
}

// Sidebar player wiring
// Sidebar player removed

// --- Count-in metronome and helper ---
// Click sample support: assets/sounds/click.m4a (preferred click for count-in)
const CLICK_URLS = ['assets/sounds/click.m4a'];
const _clickSample = { buffer: null, tried: false, loading: null };
async function loadClickSampleBuffer(ctx) {
	if (_clickSample.buffer || _clickSample.loading || _clickSample.tried) return;
	_clickSample.loading = (async () => {
		for (const url of CLICK_URLS) {
			try {
				const res = await fetch(url, { cache: 'no-cache' });
				if (!res.ok) continue;
				const arr = await res.arrayBuffer();
				const buf = await ctx.decodeAudioData(arr.slice(0));
				if (buf && buf.duration > 0) { _clickSample.buffer = buf; break; }
			} catch (_) { /* try next */ }
		}
	})().finally(() => { _clickSample.tried = true; _clickSample.loading = null; });
}
// Preload the click sample early (decodeCtx doesn't resume audio, safe for prefetch)
setTimeout(() => { try { ensureDecodeCtx(); loadClickSampleBuffer(audioEngine.ctx); } catch(_) {} }, 0);

async function playSongWithOptionalCountIn(songId, startAtSec) {
	await ensureAudioCtx();
	await ensureSongLoaded(songId);
	// Resolve per-song settings (fallback to current UI state if needed)
	const s = songs.find(x => x.id === songId) || {};
	const doCount = !!(typeof s.countInEnabled === 'boolean' ? s.countInEnabled : trackMgrCountInEnabled);
	const bpmRaw = (Number.isFinite(s.countInBPM) ? s.countInBPM : trackMgrBPM);
	const bpm = Math.max(30, Math.min(300, Number(bpmRaw) || 120));
	const clickBal = Math.max(-1, Math.min(1, Number.isFinite(s.countInBalance) ? s.countInBalance : trackMgrClickBalance));
	const clickVol = Math.max(0, Math.min(4, Number.isFinite(s.countInVolume) ? s.countInVolume : trackMgrClickVolume));
	if (!doCount) {
		await buildAndStart(songId, startAtSec);
		return;
	}
	// Attempt to load sample in the background; don't delay playback
	try { loadClickSampleBuffer(audioEngine.ctx); } catch(_) {}
	// Generate 4 click sounds at the given BPM before starting
	// Prefer provided click sample if available; otherwise synth a bright click
	const ctx = audioEngine.ctx;
	const beatDur = 60 / Math.max(30, Math.min(300, bpm)); // seconds per beat
	const now = ctx.currentTime;
	const startClicksAt = now + 0.05; // small guard
	function makeNoiseBuffer(ctx, durationSec = 0.02) {
		const sr = ctx.sampleRate;
		const len = Math.max(128, Math.floor(durationSec * sr));
		const buf = ctx.createBuffer(1, len, sr);
		const ch = buf.getChannelData(0);
		for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1);
		return buf;
	}
	const noise = makeNoiseBuffer(ctx, 0.02);

	// If we have the click sample loaded, use it for clicks
	if (_clickSample.buffer) {
		for (let i = 0; i < 4; i++) {
			const t = startClicksAt + i * beatDur;
			const isAccent = (i === 0);
			const src = ctx.createBufferSource(); src.buffer = _clickSample.buffer;
			// Shorter slice for tightness via gain envelope
			const gain = ctx.createGain();
			const a = isAccent ? 0.10 : 0.08;
			// Use a stronger fixed click level plus a compressor for safety
			const gv = (isAccent ? 3.0 : 2.0) * clickVol; // accent louder
			try { gain.gain.setValueAtTime(0.0001, t); } catch(_) { gain.gain.value = 0.0001; }
			try { gain.gain.exponentialRampToValueAtTime(Math.max(0.001, gv), t + 0.003); } catch(_) {}
			try { gain.gain.exponentialRampToValueAtTime(0.0001, t + a); } catch(_) {}

			const b = clickBal;
			if (typeof ctx.createStereoPanner === 'function') {
				const p = ctx.createStereoPanner();
				try { p.pan.setValueAtTime(b, t); } catch(_) { p.pan.value = b; }
				src.connect(gain); const comp = ctx.createDynamicsCompressor();
				try {
					comp.threshold.setValueAtTime(-18, t);
					comp.knee.setValueAtTime(25, t);
					comp.ratio.setValueAtTime(8, t);
					comp.attack.setValueAtTime(0.003, t);
					comp.release.setValueAtTime(0.06, t);
				} catch(_) {}
				gain.connect(p); p.connect(comp); comp.connect(ctx.destination);
			} else {
				const gL = ctx.createGain(); const gR = ctx.createGain(); const merger = ctx.createChannelMerger(2);
				const lMul = b >= 0 ? (1 - b) : 1; const rMul = b <= 0 ? (1 + b) : 1;
				try { gL.gain.setValueAtTime(lMul, t); gR.gain.setValueAtTime(rMul, t); } catch(_) { gL.gain.value = lMul; gR.gain.value = rMul; }
				src.connect(gain); const comp = ctx.createDynamicsCompressor();
				try {
					comp.threshold.setValueAtTime(-18, t);
					comp.knee.setValueAtTime(25, t);
					comp.ratio.setValueAtTime(8, t);
					comp.attack.setValueAtTime(0.003, t);
					comp.release.setValueAtTime(0.06, t);
				} catch(_) {}
				gain.connect(gL); gain.connect(gR);
				gL.connect(merger, 0, 0); gR.connect(merger, 0, 1); merger.connect(comp); comp.connect(ctx.destination);
			}
			try { src.start(t); src.stop(t + a + 0.03); } catch(_) { /* ignore */ }
		}
	} else {
		// Synth fallback: rimshot/hi-hat style layered noise
		for (let i = 0; i < 4; i++) {
			const t = startClicksAt + i * beatDur;
			const isAccent = (i === 0);
			const src = ctx.createBufferSource();
			src.buffer = noise;
			// Rimshot/hi-hat style: mix a mid bandpass "stick" and a high sizzle layer
			const stickBP = ctx.createBiquadFilter();
			stickBP.type = 'bandpass';
			stickBP.Q.value = isAccent ? 10 : 8;
			try { stickBP.frequency.setValueAtTime(isAccent ? 2600 : 2300, t); } catch(_) { stickBP.frequency.value = isAccent ? 2600 : 2300; }
			const sizzleHP = ctx.createBiquadFilter();
			sizzleHP.type = 'highpass';
			try { sizzleHP.frequency.setValueAtTime(isAccent ? 7500 : 7000, t); } catch(_) { sizzleHP.frequency.value = isAccent ? 7500 : 7000; }
			sizzleHP.Q.value = 0.9;
			const sizzleLP = ctx.createBiquadFilter();
			sizzleLP.type = 'lowpass';
			try { sizzleLP.frequency.setValueAtTime(12000, t); } catch(_) { sizzleLP.frequency.value = 12000; }
			sizzleLP.Q.value = 0.7;
			// Individual gains for layers
			const gStick = ctx.createGain();
			const gSizzle = ctx.createGain();
			const mix = ctx.createGain();
			// Envelope
			const aStick = isAccent ? 0.10 : 0.08;
			const aSizz = isAccent ? 0.035 : 0.028;
			// Stronger fixed gains for stick/sizzle layers + compressor downstream
			const gvStick = (isAccent ? 2.5 : 1.8) * clickVol;
			const gvSizz = (isAccent ? 1.6 : 1.3) * clickVol;
			try {
				gStick.gain.setValueAtTime(0.0001, t);
				gStick.gain.exponentialRampToValueAtTime(Math.max(0.001, gvStick), t + 0.004);
				gStick.gain.exponentialRampToValueAtTime(0.0001, t + aStick);
				gSizzle.gain.setValueAtTime(0.0001, t);
				gSizzle.gain.exponentialRampToValueAtTime(Math.max(0.001, gvSizz), t + 0.003);
				gSizzle.gain.exponentialRampToValueAtTime(0.0001, t + aSizz);
			} catch(_) {
				gStick.gain.value = gvStick; gSizzle.gain.value = gvSizz;
			}
			// Wire layers to mix
			src.connect(stickBP); stickBP.connect(gStick); gStick.connect(mix);
			src.connect(sizzleHP); sizzleHP.connect(sizzleLP); sizzleLP.connect(gSizzle); gSizzle.connect(mix);
			// Pan/mix to destination
			const b = clickBal;
			if (typeof ctx.createStereoPanner === 'function') {
				const p = ctx.createStereoPanner();
				try { p.pan.setValueAtTime(b, t); } catch(_) { p.pan.value = b; }
				const comp = ctx.createDynamicsCompressor();
				try {
					comp.threshold.setValueAtTime(-18, t);
					comp.knee.setValueAtTime(25, t);
					comp.ratio.setValueAtTime(8, t);
					comp.attack.setValueAtTime(0.003, t);
					comp.release.setValueAtTime(0.06, t);
				} catch(_) {}
				mix.connect(p); p.connect(comp); comp.connect(ctx.destination);
			} else {
				const gL = ctx.createGain(); const gR = ctx.createGain(); const merger = ctx.createChannelMerger(2);
				const lMul = b >= 0 ? (1 - b) : 1; const rMul = b <= 0 ? (1 + b) : 1;
				try { gL.gain.setValueAtTime(lMul, t); gR.gain.setValueAtTime(rMul, t); } catch(_) { gL.gain.value = lMul; gR.gain.value = rMul; }
				const comp = ctx.createDynamicsCompressor();
				try {
					comp.threshold.setValueAtTime(-18, t);
					comp.knee.setValueAtTime(25, t);
					comp.ratio.setValueAtTime(8, t);
					comp.attack.setValueAtTime(0.003, t);
					comp.release.setValueAtTime(0.06, t);
				} catch(_) {}
				mix.connect(gL); mix.connect(gR);
				gL.connect(merger, 0, 0); gR.connect(merger, 0, 1); merger.connect(comp); comp.connect(ctx.destination);
			}
			try { src.start(t); src.stop(t + Math.max(aStick, aSizz) + 0.03); } catch(_) { /* ignore */ }
		}
	}
	// Schedule song to start shortly after the 4th click (tempo-aware gap)
	const afterLastClickGap = Math.min(0.18, Math.max(0.06, 0.12 * (120 / bpm)));
	const songStartAt = startClicksAt + 3 * beatDur + afterLastClickGap;
	// buildAndStart schedules relative to currentTime; emulate by slight delay
	const delayMs = Math.max(0, (songStartAt - ctx.currentTime) * 1000);
	await new Promise(r => setTimeout(r, delayMs));
	await buildAndStart(songId, startAtSec);
}

// --- Track Manager safe implementation ---
const trackManagerModal = document.getElementById('trackManagerModal');
const trackManagerBody = document.getElementById('trackManagerBody');
const closeTrackManagerBtn = document.getElementById('closeTrackManager');

// Define openTrackManager in module scope so unqualified references work.
function openTrackManager(songId) {
	if (trackManagerModal) {
		trackManagerModal.classList.remove('hidden');
		trackManagerModal.style.display = 'flex';
	}
	// Ensure UI-selected song matches the Track Manager's song for correct preview/playback
	selectedSongId = songId;
	window.selectedSongId = selectedSongId;
	const song = songs.find(s => s.id === songId);
	if (song) updateDetails(song);
	renderSongs();
	// Refresh header master waveform for this song
	try { renderMasterWaveFromDB(songId); } catch(_) {}
	trackManagerSongId = songId;
	trackManagerDirty = false;
	// render content (best-effort)
	renderTrackManager(songId).catch(err => console.error('renderTrackManager error:', err));
}
// also expose to window for any external callers
window.openTrackManager = openTrackManager;

function closeTrackManager() {
  if (trackManagerModal) {
    trackManagerModal.classList.add('hidden');
    trackManagerModal.style.display = 'none';
  }
	// If tracks changed while open, rebuild master waveform for that song
	if (trackManagerDirty && trackManagerSongId) {
		buildMasterWaveform(trackManagerSongId).catch(()=>{});
  }
  trackManagerDirty = false;
	trackManagerSongId = null;
}
if (closeTrackManagerBtn) closeTrackManagerBtn.addEventListener('click', closeTrackManager);

// --- Initial load: fetch songs from DB and render list ---
async function loadSongsOnStartup() {
	try {
		songs = await getSongs();
		window.songs = songs;
		await renderSongs();
		// No auto-selection; user picks a song. Master waveform will render on selection.
	} catch (e) {
		console.error('Failed to load songs on startup:', e);
	}
}
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', loadSongsOnStartup, { once: true });
} else {
	loadSongsOnStartup();
}

// --- UI helper: Rotary knob (drag up = louder, drag down = quieter) ---
function createRotaryKnob({ min = 0, max = 4, step = 0.05, value = 1.0, label = 'Click', onInput = () => {} }) {
	const clamp = (v) => Math.max(min, Math.min(max, v));
	const roundStep = (v) => Math.round(v / step) * step;
	const norm = (v) => (clamp(v) - min) / (max - min); // 0..1
	// Map 0..1 to -150deg (≈7 o'clock) .. +150deg (≈5 o'clock)
	const angleFor = (v) => -150 + 300 * norm(v); // degrees

	const wrap = document.createElement('div');
	wrap.className = 'knob-wrap';

	const ring = document.createElement('div');
	ring.className = 'knob-ring';
	ring.style.setProperty('--pct', String(Math.round(norm(value) * 100)));

	const knob = document.createElement('div');
	knob.className = 'knob';
	knob.tabIndex = 0;
		knob.title = `${label}`;

	const indicator = document.createElement('div');
	indicator.className = 'knob-indicator';
	const dot = document.createElement('div');
	dot.className = 'knob-indicator-dot';
	indicator.appendChild(dot);
	knob.appendChild(indicator);

	// Apply initial angle
	const setAngleFromValue = (val) => {
		const ang = angleFor(val);
		indicator.style.transform = `translate(-50%, -50%) rotate(${ang}deg)`;
		ring.style.setProperty('--pct', String(Math.round(norm(val) * 100)));
	};
	setAngleFromValue(value);

	// Interaction
	let dragging = false;
	let startY = 0;
	let startVal = value;
	const sensitivity = (max - min) / 140; // pixels to full-scale ~140px

		const applyVal = (nv, fire = true) => {
			const v = clamp(roundStep(nv));
			setAngleFromValue(v);
			if (fire) observedOnInput(v);
		};

	const onMove = (clientY) => {
		const dy = clientY - startY; // moving up => negative dy
		const nv = startVal + (-dy * sensitivity);
		applyVal(nv, true);
	};

	const handlePointerDown = (e) => {
		dragging = true;
		startY = (e.touches ? e.touches[0].clientY : e.clientY);
		startVal = value;
		e.preventDefault();
		e.stopPropagation();
	};
	const handlePointerMove = (e) => {
		if (!dragging) return;
		const y = (e.touches ? e.touches[0].clientY : e.clientY);
		onMove(y);
		e.preventDefault();
	};
	const handlePointerUp = () => { dragging = false; };

	knob.addEventListener('mousedown', handlePointerDown);
	knob.addEventListener('touchstart', handlePointerDown, { passive: false });
	window.addEventListener('mousemove', handlePointerMove);
	window.addEventListener('touchmove', handlePointerMove, { passive: false });
	window.addEventListener('mouseup', handlePointerUp);
	window.addEventListener('touchend', handlePointerUp);

	// Wheel adjust (fine)
	knob.addEventListener('wheel', (e) => {
		e.preventDefault();
		const delta = e.deltaY < 0 ? step : -step; // wheel up = louder
		const nv = clamp(roundStep((value = clamp(value + delta))));
		applyVal(nv, true);
	}, { passive: false });

	// Keyboard
	knob.addEventListener('keydown', (e) => {
		if (e.key === 'ArrowUp') { value = clamp(value + step); applyVal(value, true); e.preventDefault(); }
		else if (e.key === 'ArrowDown') { value = clamp(value - step); applyVal(value, true); e.preventDefault(); }
	});

		// Keep public value in sync when onInput fires
		const userOnInput = onInput;
		const observedOnInput = (v) => { value = v; userOnInput(v); };

	const cap = document.createElement('span');
	cap.className = 'knob-cap';
	cap.textContent = label;

	ring.appendChild(knob);
	wrap.appendChild(ring);
	wrap.appendChild(cap);

	// API to externally set value if needed
	wrap.setValue = (v) => { value = clamp(v); setAngleFromValue(value); };

	return { el: wrap, setValue: wrap.setValue };
}

async function renderTrackManager(songId) {
	if (!trackManagerBody) return;
	// Preserve scroll position to avoid jumping to top when expanding/collapsing sections
	const prevScrollTop = trackManagerBody.scrollTop || 0;
	trackManagerBody.innerHTML = '';

	const song = songs.find(s => s.id === songId);
	const tracks = await getTracks(songId);
	// Diagnostics: log regions count for each track loaded from DB
	try {
		if (Array.isArray(tracks)) {
			console.groupCollapsed('[Regions] Loaded tracks for Track Manager');
			for (const t of tracks) {
				const count = Array.isArray(t?.regions) ? t.regions.length : 0;
				console.log(`Track ${t?.id}: regions=${count}`, count ? t.regions : '');
			}
			console.groupEnd();
		}
	} catch(_) {}

	// Update modal title with count
	const titleEl = document.getElementById('trackManagerTitle');
	if (titleEl) {
		const n = tracks.length;
		titleEl.textContent = `Track Manager${n ? ` (${n} ${n===1?'track':'tracks'})` : ''}`;
	}

	// Header controls: inject into fixed header so they stay visible
	const headerControls = document.getElementById('trackManagerHeaderControls');
	if (headerControls) {
		headerControls.innerHTML = '';

		// Count-in controls (checkbox with BPM beneath to save space)
		const ciWrap = document.createElement('div');
		ciWrap.style.display = 'inline-flex';
		ciWrap.style.flexDirection = 'column';
		ciWrap.style.alignItems = 'flex-start';
		ciWrap.style.gap = '4px';
		ciWrap.style.marginRight = '8px';
		const ciLabel = document.createElement('label');
		ciLabel.style.display = 'inline-flex';
		ciLabel.style.alignItems = 'center';
		ciLabel.style.gap = '6px';
		const ciChk = document.createElement('input');
		ciChk.type = 'checkbox';
		ciChk.checked = !!(typeof song.countInEnabled === 'boolean' ? song.countInEnabled : trackMgrCountInEnabled);
		const ciText = document.createElement('span');
		ciText.textContent = 'Count-in';
		const bpmInput = document.createElement('input');
		bpmInput.type = 'number';
		bpmInput.min = '30';
		bpmInput.max = '300';
		bpmInput.step = '1';
		bpmInput.value = String(Number.isFinite(song.countInBPM) ? song.countInBPM : trackMgrBPM);
		bpmInput.title = 'BPM';
		bpmInput.style.width = '56px';
		bpmInput.style.padding = '4px 6px';
		bpmInput.style.borderRadius = '6px';
		bpmInput.style.border = '1px solid #3a3a3a';
		bpmInput.style.background = '#2a2a2a';
		bpmInput.style.color = '#fff';
		ciLabel.appendChild(ciChk);
		ciLabel.appendChild(ciText);
		// Stack BPM under the checkbox/text to tighten
		ciWrap.appendChild(ciLabel);
		const bpmRow = document.createElement('div');
		bpmRow.style.marginTop = '2px';
		bpmRow.appendChild(bpmInput);
		ciWrap.appendChild(bpmRow);

		// Knobs row: Pan + Volume (both rotary)
		const knobsRow = document.createElement('div');
		knobsRow.style.display = 'inline-flex';
		knobsRow.style.alignItems = 'center';
		knobsRow.style.gap = '10px';
		// Pan knob (-1..1)
		const initPan = Number.isFinite(song.countInBalance) ? song.countInBalance : trackMgrClickBalance;
		const panKnobObj = createRotaryKnob({ min: -1, max: 1, step: 0.01, value: initPan, label: 'pan', onInput: async (val) => {
			const clamped = Math.max(-1, Math.min(1, val));
			song.countInBalance = clamped;
			try { await updateSong(song); } catch(_) {}
			const idx = songs.findIndex(s => s.id === songId); if (idx >= 0) { songs[idx] = { ...songs[idx], countInBalance: clamped }; window.songs = songs; }
		}});
		knobsRow.appendChild(panKnobObj.el);
		// Volume knob (0..4)
		const knobInitVal = Number.isFinite(song.countInVolume) ? song.countInVolume : 1.0;
		const volKnobObj = createRotaryKnob({ min: 0, max: 4, step: 0.05, value: knobInitVal, label: 'volume', onInput: async (val) => {
			const clamped = Math.max(0, Math.min(4, val));
			song.countInVolume = clamped;
			try { await updateSong(song); } catch(_) {}
			const idx = songs.findIndex(s => s.id === songId); if (idx >= 0) { songs[idx] = { ...songs[idx], countInVolume: clamped }; window.songs = songs; }
		}});
		knobsRow.appendChild(volKnobObj.el);
		ciWrap.appendChild(knobsRow);
		headerControls.appendChild(ciWrap);

		ciChk.addEventListener('change', async () => {
			const val = !!ciChk.checked;
			song.countInEnabled = val;
			try { await updateSong(song); } catch(_) {}
			const idx = songs.findIndex(s => s.id === songId); if (idx >= 0) { songs[idx] = { ...songs[idx], countInEnabled: val }; window.songs = songs; }
		});
		bpmInput.addEventListener('change', async () => {
			let v = parseInt(bpmInput.value, 10);
			if (!Number.isFinite(v)) v = Number.isFinite(song.countInBPM) ? song.countInBPM : (trackMgrBPM || 120);
			v = Math.max(30, Math.min(300, v));
			song.countInBPM = v;
			bpmInput.value = String(v);
			try { await updateSong(song); } catch(_) {}
			const idx = songs.findIndex(s => s.id === songId); if (idx >= 0) { songs[idx] = { ...songs[idx], countInBPM: v }; window.songs = songs; }
		});

		const playBtn = document.createElement('button');
		playBtn.className = 'track-playpause';
		playBtn.textContent = (audioEngine.playing && audioEngine.songId === songId) ? '⏸ Pause' : '▶ Play';
		playBtn.addEventListener('click', async () => {
			if (audioEngine.playing && audioEngine.songId === songId) {
				pausePlayback();
			} else {
				const startAt = (audioEngine.lastSeekSec != null) ? audioEngine.lastSeekSec : (audioEngine.offset || 0);
				await playSongWithOptionalCountIn(songId, startAt);
			}
			// button label will be synced by syncPlayButtons
		});
		headerControls.appendChild(playBtn);

		// Add a dedicated Stop button (rewinds to start)
		const stopBtn = document.createElement('button');
		stopBtn.className = 'track-stop';
		stopBtn.title = 'Stop (rewind to start)';
		stopBtn.textContent = '⏹ Stop';
		stopBtn.addEventListener('click', () => {
			stopPlayback();
		});
		headerControls.appendChild(stopBtn);

		const addTrackBtn = document.createElement('button');
		addTrackBtn.className = 'track-add';
		addTrackBtn.textContent = '＋ Add Tracks';
		const addTrackInput = document.createElement('input');
		addTrackInput.type = 'file';
		addTrackInput.accept = 'audio/*';
		addTrackInput.multiple = true;
		addTrackInput.className = 'hidden';
		addTrackInput.addEventListener('change', async (e) => {
			const files = Array.from(e.target.files || []);
			const currentTracks = await getTracks(songId);
			const maxToAdd = Math.min(6 - currentTracks.length, files.length);
			// 1) Create light track records first for instant UI
			const created = [];
			for (let i = 0; i < maxToAdd; i++) {
				const f = files[i];
				try {
					const newTrackId = await addTrack({ songId, name: f.name.replace(/\.[^/.]+$/, ''), volume: 1, pan: 0, mute: false, solo: false, regions: [], waveformOpen: false, audioFileId: null });
					created.push({ file: f, trackId: newTrackId });
				} catch (err) {
					console.error('add track error', err);
				}
			}
			// Update song counts and render immediately for snappy UX
			if (song) {
				const t2 = await getTracks(songId);
				song.tracks = t2.length;
				await updateSong(song);
				songs = await getSongs();
				window.songs = songs;
			}
			trackManagerDirty = true; // master waveform should rebuild on close
			await renderTrackManager(songId);
			await renderSongs();
			// 2) In the background, attach audio blobs and persist sizes, then refresh display
			setTimeout(async () => {
				try {
					await Promise.allSettled(created.map(async ({ file, trackId }) => {
						const audioId = await addAudioFile({ trackId, name: file.name, blob: file, size: file.size });
						await updateAudioFile({ id: audioId, trackId, name: file.name, blob: file, size: file.size });
						const trks = await getTracks(songId);
						const t = trks.find(t => t.id === trackId);
						if (t) { t.audioFileId = audioId; await updateTrack(t); }
					}));
					// Light refresh to show names/sizes once blobs are linked
					await renderTrackManager(songId);
					// 3) After UI refresh, decode + compute per-track waveforms in the background
					setTimeout(async () => {
						try {
							ensureDecodeCtx();
							const trks = await getTracks(songId);
							for (const t of trks) {
								if (!t.audioFileId) continue;
								const afList = await getAudioFiles(t.id);
								const af = afList && afList[0];
								if (!af || !af.blob) continue;
								if (!audioEngine.buffers.get(t.id)) {
									const arr = await af.blob.arrayBuffer();
									const buf = await decodeBuffer(arr);
									audioEngine.buffers.set(t.id, buf);
								}
								await ensureTrackWaveform(t);
							}
							// leave master rebuild to Track Manager close for efficiency
						} catch (werr) {
							console.warn('background waveform build failed', werr);
						}
					}, 0);
				} catch (bgErr) {
					console.warn('background import failed', bgErr);
				}
			}, 0);
		});
		addTrackBtn.addEventListener('click', () => { addTrackInput.value = ''; addTrackInput.click(); });
		headerControls.appendChild(addTrackBtn);
		headerControls.appendChild(addTrackInput);

		const clearBtn = document.createElement('button');
		clearBtn.className = 'track-clearall';
		clearBtn.textContent = '🗑️ Clear All';
		clearBtn.addEventListener('click', async () => {
			const tlist = await getTracks(songId);
			for (const t of tlist) {
				await deleteTrack(t.id);
				if (t.audioFileId) await deleteAudioFile(t.audioFileId);
				await deleteWaveformByTrack(t.id);
			}
			if (song) { song.tracks = 0; await updateSong(song); songs = await getSongs(); window.songs = songs; }
			await deleteMasterWaveformBySong(songId);
			trackManagerDirty = true;
			await renderTrackManager(songId);
			await renderSongs();
		});
		headerControls.appendChild(clearBtn);
	}

	// Empty state
	if (!tracks.length) {
		const empty = document.createElement('div');
		empty.className = 'track-empty';
		empty.textContent = 'No tracks added yet. Use “＋ Add Tracks” to import stems.';
		trackManagerBody.appendChild(empty);
		return;
	}

	// Render each track row
	for (let idx = 0; idx < tracks.length; idx++) {
		const track = tracks[idx];
	const row = document.createElement('div');
	row.className = 'track-row';
	row.setAttribute('data-track-id', String(track.id));

		// Top label area: number badge, name, file details, meters, delete
		const label = document.createElement('div');
		label.className = 'track-label';
		// number bubble + name + details
		const num = document.createElement('span');
		num.textContent = String(idx + 1);
		label.appendChild(num);
		const nameWrap = document.createElement('div');
		const title = document.createElement('div');
		title.style.fontWeight = '700';
		title.textContent = track.name || '';
		const details = document.createElement('div');
		details.className = 'track-file-details';
		let fileName = '', fileSizeText = '';
		if (track.audioFileId) {
			const afList = await getAudioFiles(track.id);
			const af = afList && afList[0];
			if (af) {
				fileName = af.name || '';
				if (typeof af.size === 'number') fileSizeText = ` ${(af.size / (1024*1024)).toFixed(1)}MB`;
			}
		}
		details.textContent = track.audioFileId ? `${fileName || ''}${fileSizeText ? ' • ' + fileSizeText : ''}` : 'Pending import…';
		nameWrap.appendChild(title);
		nameWrap.appendChild(details);
		label.appendChild(nameWrap);

		// right mini meters placeholder
		const meters = document.createElement('div');
	meters.className = 'track-mini-meters';
	meters.innerHTML = `
	  <div class="mm-row">
		<span>L</span>
		<div class="mm-track">
			<div class="mm-bar mm-bar-L"></div>
			<div class="mm-peak mm-peak-L"></div>
		</div>
	  </div>
	  <div class="mm-row">
		<span>R</span>
		<div class="mm-track">
			<div class="mm-bar mm-bar-R"></div>
			<div class="mm-peak mm-peak-R"></div>
		</div>
	  </div>`;
		label.appendChild(meters);

		// remove button (top-right)
		const removeTrackBtn = document.createElement('button');
		removeTrackBtn.className = 'track-remove';
		removeTrackBtn.textContent = '🗑️';
		removeTrackBtn.title = 'Remove Track';
		removeTrackBtn.addEventListener('click', async () => {
			await deleteTrack(track.id);
			if (track.audioFileId) await deleteAudioFile(track.audioFileId);
			await deleteWaveformByTrack(track.id);
			if (song) { song.tracks = (await getTracks(songId)).length; await updateSong(song); songs = await getSongs(); window.songs = songs; }
			trackManagerDirty = true;
			await renderTrackManager(songId);
			await renderSongs();
		});
		label.appendChild(removeTrackBtn);

		row.appendChild(label);

	// Controls section: Mute / Solo + Volume + Balance
		const controlsSection = document.createElement('div');
		controlsSection.className = 'track-controls-section';

	const muteBtn = document.createElement('button');
	muteBtn.className = 'track-mute track-icon-btn';
	muteBtn.title = 'Mute';
	muteBtn.textContent = '🔇';
	muteBtn.classList.toggle('active', !!track.mute);
	muteBtn.addEventListener('click', async () => { await toggleMute(track); });
	controlsSection.appendChild(muteBtn);

	const soloBtn = document.createElement('button');
	soloBtn.className = 'track-solo track-icon-btn';
	soloBtn.title = 'Solo';
	soloBtn.textContent = 'S';
	soloBtn.classList.toggle('active', !!track.solo);
	soloBtn.addEventListener('click', async () => { await toggleSolo(track); });
	controlsSection.appendChild(soloBtn);

		// Volume label + slider
	const volLabel = document.createElement('div');
	volLabel.style.minWidth = '60px';
		volLabel.style.color = '#b0b8c0';
		volLabel.textContent = 'Volume';
		controlsSection.appendChild(volLabel);

		const vol = document.createElement('input');
		vol.type = 'range'; vol.min = 0; vol.max = 1; vol.step = 0.01; vol.value = track.volume ?? 1;
		vol.className = 'track-slider'; vol.title = 'Volume';
	vol.addEventListener('input', async () => { track.volume = parseFloat(vol.value); await updateTrack(track); pctVol.textContent = `${Math.round(track.volume*100)}%`; setTrackVolume(track.id, track.volume); });
		controlsSection.appendChild(vol);
	const pctVol = document.createElement('div'); pctVol.style.marginLeft = '6px'; pctVol.style.color = '#b0b8c0'; pctVol.textContent = `${Math.round((track.volume ?? 1)*100)}%`;
		controlsSection.appendChild(pctVol);

		// Balance label + slider
	const balLabel = document.createElement('div');
	balLabel.style.minWidth = '70px'; balLabel.style.marginLeft = '8px'; balLabel.style.color = '#b0b8c0'; balLabel.textContent = 'Balance';
		controlsSection.appendChild(balLabel);
	const pan = document.createElement('input'); pan.type = 'range'; pan.min = -1; pan.max = 1; pan.step = 0.01; pan.value = track.pan ?? 0; pan.className = 'track-slider'; pan.title = 'Balance (Pan)';
	const panText = document.createElement('div'); panText.style.marginLeft = '6px'; panText.style.color = '#b0b8c0';
		function updatePanText() {
			const p = parseFloat(pan.value);
			if (p === 0) panText.textContent = 'Center';
			else if (p < 0) panText.textContent = `L${Math.round(Math.abs(p)*100)}`;
			else panText.textContent = `R${Math.round(p*100)}`;
		}
		updatePanText();
	pan.addEventListener('input', async () => { track.pan = parseFloat(pan.value); await updateTrack(track); updatePanText(); setTrackPan(track.id, track.pan); });
		controlsSection.appendChild(pan);
		controlsSection.appendChild(panText);

		row.appendChild(controlsSection);

		// Collapsible Waveform section (collapsed by default)
			const collapseBtn = document.createElement('button');
		collapseBtn.className = 'track-collapse';
		collapseBtn.setAttribute('aria-expanded', track.waveformOpen ? 'true' : 'false');
		collapseBtn.textContent = '∿  Waveform & Mute Regions';
		collapseBtn.addEventListener('click', async () => {
				// Keep current scroll so list doesn't jump to top on re-render
				const keepScroll = trackManagerBody.scrollTop || 0;
				track.waveformOpen = !track.waveformOpen;
				await updateTrack(track);
				await renderTrackManager(songId);
				// Restore scroll after DOM rebuild
				try { trackManagerBody.scrollTop = keepScroll; } catch(_) {}
		});
		row.appendChild(collapseBtn);

		if (track.waveformOpen) {
			const wfSection = document.createElement('div'); wfSection.className = 'track-waveform-section';
			// Controls
			const wfControls = document.createElement('div');
			wfControls.className = 'track-wf-controls';
			wfControls.innerHTML = `
			  <button class="wf-zoom-out" title="Zoom Out">−</button>
			  <button class="wf-zoom-in" title="Zoom In">+</button>
			  <button class="wf-zoom-sel" title="Zoom to Selection">⤢ Zoom Sel</button>
			  <button class="wf-preview" title="Preview Selection">▶ Preview</button>
			  <button class="wf-del" title="Delete Selected Region">🗑 Delete Sel</button>
			  <button class="wf-clear" title="Clear Regions">Clear Regions</button>
			`;
			wfSection.appendChild(wfControls);
			// Canvas
			const canvas = document.createElement('canvas');
			canvas.width = 1000; canvas.height = 120; // logical, will auto-scale by DPR in draw
			canvas.className = 'track-waveform-canvas';
			wfSection.appendChild(canvas);
			// Hint
			const instructions = document.createElement('div'); instructions.className = 'track-waveform-instructions'; instructions.textContent = 'Drag to select a region. Use Clear to remove all mute regions.'; wfSection.appendChild(instructions);
			row.appendChild(wfSection);

			// Initialize state
			if (!trackWaveState.has(track.id)) trackWaveState.set(track.id, { zoom: 1, scroll: 0, selection: null });
			const state = trackWaveState.get(track.id);
			// Wire controls
			wfControls.querySelector('.wf-zoom-in').addEventListener('click', () => { state.zoom = Math.min(16, state.zoom * 1.5); drawTrackWaveform(track, canvas); });
			wfControls.querySelector('.wf-zoom-out').addEventListener('click', () => { state.zoom = Math.max(1, state.zoom / 1.5); state.scroll = 0; drawTrackWaveform(track, canvas); });
			wfControls.querySelector('.wf-clear').addEventListener('click', async () => { track.regions = []; await updateTrack(track); const st = trackWaveState.get(track.id); if (st) st.selection = null; drawTrackWaveform(track, canvas); refreshPlaybackForRegions(); });
			wfControls.querySelector('.wf-preview').addEventListener('click', () => previewSelection(track));
			wfControls.querySelector('.wf-zoom-sel').addEventListener('click', () => zoomToSelection(track, canvas));
			wfControls.querySelector('.wf-del').addEventListener('click', async () => { await deleteSelectedRegion(track); drawTrackWaveform(track, canvas); refreshPlaybackForRegions(); });
			// Mouse interactions: selection, resize handles, and hover cursor
			let isDragging = false; let dragStartX = 0; let dragEndX = 0; let dragMoved = false;
			let resizeMode = null; // 'left' | 'right' | null
			let resizingRegionIndex = -1; // index if selection matches an existing region

			// Helper: commit current selection into track.regions (used by mouseup on canvas and window)
			async function commitSelectionIfNeeded(triggerLabel = 'canvas') {
				try {
					const sel = state?.selection;
					if (!(dragMoved && sel && typeof sel.start === 'number' && typeof sel.end === 'number' && sel.end > sel.start)) {
						return false; // nothing to commit
					}
					let chosen = null;
					// Initialize regions array if missing
					if (!Array.isArray(track.regions)) {
						console.log(`Creating new regions array for track ${track.id}`);
						track.regions = [];
					}
					const newRegion = { start: Number(sel.start), end: Number(sel.end) };
					console.log(`[Regions] Commit from ${triggerLabel}:`, newRegion);
					const originalCount = track.regions.length;
					const regionsBackup = JSON.parse(JSON.stringify(track.regions));
					try {
						track.regions = mergeRegions([...track.regions, newRegion]);
						console.log(`Regions count: ${originalCount} → ${track.regions.length}`);
						console.log('Current regions:', JSON.stringify(track.regions));
					} catch (mergeErr) {
						console.error('Error merging regions:', mergeErr);
						track.regions = regionsBackup;
						track.regions.push(newRegion);
						console.log('Used fallback: appended region without merging');
					}
					console.log(`Saving ${track.regions.length} regions to database`);
					await updateTrack(track);
					chosen = findContainingRegion(track.regions, sel.start, sel.end);
					if (chosen) {
						state.selection = { start: chosen.start, end: chosen.end };
					}
					// Reset drag flags so we don't double-commit from window mouseup
					dragMoved = false;
					isDragging = false;
					// Apply edits immediately to current playback
					refreshPlaybackForRegions();
					// Redraw canvas
					drawTrackWaveform(track, canvas);
					return true;
				} catch (err) {
					console.error('Error committing selection:', err);
					return false;
				}
			}

			function handlePositions() {
				const sel = state.selection;
				if (!sel || sel.end <= sel.start) return null;
				const dur = getTrackDuration(track) || 0;
				const w = canvas.clientWidth || canvas.width;
				const xs = timeToX(sel.start, dur, w, state);
				const xe = timeToX(sel.end, dur, w, state);
				const left = Math.min(xs, xe), right = Math.max(xs, xe);
				const top = 6, bottom = (canvas.clientHeight || canvas.height) - 6;
				return { left, right, top, bottom };
			}

			function selectionRegionIndex() {
				if (!Array.isArray(track.regions) || !state.selection) return -1;
				const { start, end } = state.selection;
				for (let i=0;i<track.regions.length;i++){
					const r = track.regions[i]; if (!r) continue;
					if (Math.abs(r.start - start) < 0.01 && Math.abs(r.end - end) < 0.01) return i;
				}
				return -1;
			}

			function setCursor(e) {
				const hp = handlePositions();
				if (!hp) { canvas.style.cursor = 'crosshair'; return; }
				const x = e.offsetX; const y = e.offsetY;
				const near = 6; // px
				const nearLeft = Math.abs(x - hp.left) <= near && y >= hp.top && y <= hp.bottom;
				const nearRight = Math.abs(x - hp.right) <= near && y >= hp.top && y <= hp.bottom;
				canvas.style.cursor = (nearLeft || nearRight) ? 'ew-resize' : 'crosshair';
			}

			canvas.addEventListener('mousedown', (e) => {
				console.log(`Mousedown on track ${track.id} at x=${e.offsetX}`);
				// Prefer resize if pointer is on a handle
				const hp = handlePositions();
				if (hp) {
					const near = 6;
					if (Math.abs(e.offsetX - hp.left) <= near && e.offsetY >= hp.top && e.offsetY <= hp.bottom) {
						console.log(`Resizing region from left side, region index: ${selectionRegionIndex()}`);
						resizeMode = 'left'; resizingRegionIndex = selectionRegionIndex(); return;
					}
					if (Math.abs(e.offsetX - hp.right) <= near && e.offsetY >= hp.top && e.offsetY <= hp.bottom) {
						console.log(`Resizing region from right side, region index: ${selectionRegionIndex()}`);
						resizeMode = 'right'; resizingRegionIndex = selectionRegionIndex(); return;
					}
				}
				// Otherwise begin a new drag selection
				isDragging = true; dragMoved = false; dragStartX = e.offsetX; dragEndX = e.offsetX; 
				console.log(`Starting new selection drag at x=${dragStartX}`);
				updateSelection();
			});

			canvas.addEventListener('mousemove', (e) => {
				if (resizeMode) {
					const dur = getTrackDuration(track) || 0;
					const t = pxToTimeRange(track, canvas, e.offsetX, e.offsetX).start;
					const sel = state.selection; if (!sel) return;
					const minW = 0.02;
					if (resizeMode === 'left') {
						sel.start = Math.max(0, Math.min(sel.end - minW, t));
					} else {
						sel.end = Math.min(dur, Math.max(sel.start + minW, t));
					}
					// If selection corresponds to an existing region, update it live for visual sync
					if (resizingRegionIndex >= 0 && track.regions && track.regions[resizingRegionIndex]) {
						track.regions[resizingRegionIndex].start = sel.start;
						track.regions[resizingRegionIndex].end = sel.end;
					}
					drawTrackWaveform(track, canvas);
					return;
				}
				if (!isDragging) { setCursor(e); return; }
				dragEndX = e.offsetX; if (Math.abs(dragEndX - dragStartX) > 2) dragMoved = true; updateSelection();
			});

			canvas.addEventListener('click', (e) => {
				if (isDragging && dragMoved) return; // selection just finished; mouseup will handle
				const region = pickRegionAtX(track, canvas, e.offsetX);
				if (region) {
					state.selection = { start: region.start, end: region.end };
					drawTrackWaveform(track, canvas);
				}
			});

			// Use a specific mouseup handler for this canvas; will also mirror commit from window-level
			canvas.addEventListener('mouseup', async (e) => {
				console.log(`Mouseup on track ${track.id} at x=${e.offsetX}`);
				try {
					if (resizeMode) {
						console.log(`Finished resizing region ${resizingRegionIndex} (${resizeMode} side)`);
						// Commit any region change on resize end
						resizeMode = null;
						resizingRegionIndex = -1;
						if (Array.isArray(track.regions)) {
							track.regions = mergeRegions(track.regions.slice());
							console.log(`Saving ${track.regions.length} regions after resize`);
							await updateTrack(track);
						}
						drawTrackWaveform(track, canvas);
						// Apply edits immediately to currently playing audio
						refreshPlaybackForRegions();
						return;
					}
					
					if (!isDragging) return;
					console.log(`Finished drag selection from ${dragStartX} to ${e.offsetX}, moved: ${dragMoved}`);
					// Try to commit; helper will handle save/refresh/redraw
					await commitSelectionIfNeeded('canvas');
				} catch (err) {
					console.error('Error in mouseup handler:', err);
				}
			});
			
			// Also handle mouseup anywhere: commit selection if needed even when pointer leaves canvas
			window.addEventListener('mouseup', async () => {
				try {
					// If we were resizing, just clear state
					if (resizeMode) {
						resizeMode = null;
						resizingRegionIndex = -1;
					}
					// Attempt commit if a drag happened; helper is idempotent and checks validity
					await commitSelectionIfNeeded('window');
				} finally {
					// Always clear drag flags
					isDragging = false;
					dragMoved = false;
				}
			});

			function updateSelection(){
				if (!track || !canvas) return;
				
				// Ensure dragStartX and dragEndX are valid numbers
				if (typeof dragStartX !== 'number' || typeof dragEndX !== 'number' || 
				    isNaN(dragStartX) || isNaN(dragEndX)) {
					console.error('Invalid drag coordinates:', dragStartX, dragEndX);
					return;
				}
				
				try {
					// Get time range based on pixel coordinates
					const sel = pxToTimeRange(track, canvas, Math.min(dragStartX, dragEndX), Math.max(dragStartX, dragEndX));
					
					// Validate selection times
					if (typeof sel.start !== 'number' || typeof sel.end !== 'number' || 
					    isNaN(sel.start) || isNaN(sel.end)) {
						console.error('Invalid selection times:', sel);
						return;
					}
					
					// Update state
					if (!state) {
						state = { zoom: 1, scroll: 0, selection: sel };
						trackWaveState.set(track.id, state);
					} else {
						state.selection = sel;
					}
					
					// Redraw
					drawTrackWaveform(track, canvas);
				} catch (err) {
					console.error('Error in updateSelection:', err);
				}
			}
			// Draw now
			drawTrackWaveform(track, canvas);
		}

			trackManagerBody.appendChild(row);
	}
		// After full render, restore prior scroll to avoid jump-to-top on any refresh
		try { trackManagerBody.scrollTop = prevScrollTop; } catch(_) {}
}

async function preloadSongAudio(songId) {
	// Maintain API for any callers, but route to ensureSongLoaded to dedupe
	try { await ensureSongLoaded(songId); } catch (e) { console.warn('preloadSongAudio failed', e); }
}

// ---- Waveform utilities ----
function computeWaveformFromBuffer(buffer, bins = 1200) {
	// Returns {bins, peaks: Uint8Array} of peak values [0..255] from mono mixdown
	const chL = buffer.getChannelData(0);
	const chR = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : null;
	const total = buffer.length;
	const step = Math.max(1, Math.floor(total / bins));
	const peaks = new Uint8Array(bins);
	for (let i=0;i<bins;i++) {
		const start = i * step;
		const end = Math.min(total, start + step);
		let peak = 0;
		for (let j=start;j<end;j++) {
			const l = chL[j] || 0;
			const r = chR ? chR[j] : l;
			const m = (Math.abs(l) + Math.abs(r)) * 0.5;
			if (m > peak) peak = m;
		}
		peaks[i] = Math.max(0, Math.min(255, Math.floor(peak * 255)));
	}
	return { bins, peaks };
}

function drawWaveformToCanvas(canvas, peaks, color = '#6c849c') {
	if (!canvas) return;
	const ctx = canvas.getContext('2d');
	// HiDPI handling: scale backing store to device pixel ratio for crisp 1px bars
	const dpr = (window && window.devicePixelRatio) ? window.devicePixelRatio : 1;
	const cssW = Math.max(1, Math.floor((canvas.clientWidth || canvas.width) ));
	const cssH = Math.max(1, Math.floor((canvas.clientHeight || canvas.height) ));
	const needResize = (canvas.width !== Math.floor(cssW * dpr)) || (canvas.height !== Math.floor(cssH * dpr));
	if (needResize) {
		canvas.width = Math.floor(cssW * dpr);
		canvas.height = Math.floor(cssH * dpr);
	}
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // draw in CSS pixels
	const w = canvas.width / dpr, h = canvas.height / dpr;
	ctx.clearRect(0,0,w,h);
	// Background panel and subtle border
	ctx.fillStyle = '#1f2733';
	ctx.fillRect(0,0,w,h);
	ctx.strokeStyle = 'rgba(255,255,255,0.06)';
	ctx.lineWidth = 1;
	ctx.strokeRect(0.5, 0.5, w-1, h-1);
	if (!peaks || !peaks.length) return;
	// If drawing master canvas, cache peaks/color for overlay redraws
	if (canvas === masterWaveCanvas) { masterWaveLastPeaks = peaks; masterWaveBaseColor = color || masterWaveBaseColor; }
	const len = peaks.length;
	// Convert to normalized floats 0..1
	const vals = new Float32Array(len);
	for (let i=0;i<len;i++) vals[i] = (peaks[i] || 0) / 255;
	// Light smoothing to tame single-bin spikes (3-tap: prev + 2*cur + next)/4
	const sm = new Float32Array(len);
	for (let i=0;i<len;i++) {
		const a = i>0 ? vals[i-1] : vals[i];
		const b = vals[i];
		const c = i<len-1 ? vals[i+1] : vals[i];
		sm[i] = (a + 2*b + c) / 4;
	}
	// Soft-knee compression helper (avoids visual clipping and increases headroom)
	const k = 1.4; // knee strength
	const scale = 0.9 * (1 + k);
	const compress = (v) => Math.max(0, Math.min(0.95, (scale * v) / (1 + k * v)));

	// Downsample to dense 1px bars with 1px gaps for a finer, crisper look
	const barWPx = 1; // 1 CSS px bar
	const gapPx = 1; // 1 CSS px gap
	const colWidth = barWPx + gapPx; // CSS px
	const targetCols = Math.max(80, Math.min(600, Math.floor(w / colWidth)));
	const barW = barWPx; // CSS px
	for (let cIdx = 0; cIdx < targetCols; cIdx++) {
		const start = Math.floor((cIdx / targetCols) * len);
		const end = Math.floor(((cIdx + 1) / targetCols) * len);
		let vmax = 0;
		for (let j = start; j < end; j++) {
			const v = sm[j]; if (v > vmax) vmax = v;
		}
		const v = compress(vmax);
		const bh = Math.max(1, Math.floor(v * (h - 4))); // keep a tiny top/bottom margin
		// center bars in each column slot
		const xBase = cIdx * colWidth;
		const x = Math.round(xBase + ((colWidth - barW) / 2)); // snap to integer CSS px
		const y = Math.floor((h - bh) / 2);
		ctx.fillStyle = color; // flat color like reference
		ctx.fillRect(x, y, barW, bh);
	}

	// Time ticks every 30s with labels if duration known
	const dur = (window && window.audioEngine && window.audioEngine.duration) ? window.audioEngine.duration : (audioEngine ? audioEngine.duration : 0);
	if (dur && isFinite(dur) && dur > 30) {
		ctx.save();
		ctx.fillStyle = 'rgba(200,210,220,0.4)';
		ctx.strokeStyle = 'rgba(200,210,220,0.25)';
		ctx.lineWidth = 1;
		ctx.font = '10px Montserrat, system-ui, sans-serif';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'alphabetic';
		for (let t = 30; t < dur; t += 30) {
			const x = Math.floor((t / dur) * w);
			// small tick line near bottom
			ctx.beginPath();
			ctx.moveTo(x + 0.5, h - 12);
			ctx.lineTo(x + 0.5, h - 6);
			ctx.stroke();
			// label
			const mm = Math.floor(t / 60);
			const ss = Math.floor(t % 60).toString().padStart(2, '0');
			ctx.fillText(`${mm}:${ss}`, x, h - 2);
		}
		ctx.restore();
	}
}

async function ensureTrackWaveform(track) {
	const existing = await getWaveformByTrack(track.id);
	if (existing && existing.peaks) return existing;
	const buf = audioEngine.buffers.get(track.id);
	if (!buf) return null;
	const wf = computeWaveformFromBuffer(buf, 1200);
	await putWaveform({ type: 'track', songId: track.songId, trackId: track.id, bins: wf.bins, peaks: wf.peaks });
	return wf;
}

async function buildMasterWaveform(songId) {
	const tracks = await getTracks(songId);
	if (!tracks.length) {
		await deleteMasterWaveformBySong(songId);
		drawWaveformToCanvas(masterWaveCanvas, new Uint8Array(0));
		return null;
	}
	// Ensure all track waveforms exist (compute if needed)
	const parts = [];
	for (const t of tracks) {
		if (!audioEngine.buffers.get(t.id)) {
			try { await loadSongAudio(songId); } catch(_){}
		}
		const piece = await ensureTrackWaveform(t);
		if (piece) parts.push(piece);
	}
	if (!parts.length) return null;
	const bins = Math.max(...parts.map(p => p.bins));
	const master = new Uint8Array(bins);
	for (const p of parts) {
		for (let i=0;i<bins;i++) {
			const srcIdx = Math.floor(i * p.bins / bins);
			master[i] = Math.max(master[i] || 0, p.peaks[srcIdx] || 0);
		}
	}
	await putWaveform({ type: 'master', songId, trackId: null, bins, peaks: master });
	drawWaveformToCanvas(masterWaveCanvas, master, '#4fc3f7');
	redrawMasterOverlays();
	return { bins, peaks: master };
}

async function renderMasterWaveFromDB(songId) {
	if (!songId) { drawWaveformToCanvas(masterWaveCanvas, new Uint8Array(0)); return; }
	let rec = null;
	try { rec = await getMasterWaveformBySong(songId); } catch(_) { rec = null; }
	if (rec && rec.peaks && rec.peaks.length) {
		drawWaveformToCanvas(masterWaveCanvas, rec.peaks, '#4fc3f7');
		redrawMasterOverlays();
		return;
	}
	// If no cached master waveform, try to build it now (best-effort)
	try {
		const built = await buildMasterWaveform(songId);
		if (built && built.peaks && built.peaks.length) {
			drawWaveformToCanvas(masterWaveCanvas, built.peaks, '#4fc3f7');
			redrawMasterOverlays();
			return;
		}
	} catch(_) {}
	// Fallback: clear canvas
	drawWaveformToCanvas(masterWaveCanvas, new Uint8Array(0));
}

// ---- Track waveforms (Track Manager) ----
function formatMMSS(t){ const m=Math.floor(t/60), s=Math.floor(t%60).toString().padStart(2,'0'); return `${m}:${s}`; }
function getTrackDuration(track){ const buf = audioEngine.buffers.get(track.id); return buf ? buf.duration : 0; }
function getTrackPeaksSync(track){
	// 1) Memory cache
	if (trackPeaksCache.has(track.id)) return trackPeaksCache.get(track.id);
	// 2) If buffer is available, compute now (fast path) and cache; also persist async
	const buf = audioEngine.buffers.get(track.id);
	if (buf) {
		const wf = computeWaveformFromBuffer(buf, 2000);
		trackPeaksCache.set(track.id, wf.peaks);
		// persist in background
		(async () => { try { await putWaveform({ type:'track', songId: track.songId, trackId: track.id, bins: wf.bins, peaks: wf.peaks }); } catch(_){} })();
		return wf.peaks;
	}
	// 3) Otherwise, no sync peaks
	return null;
}
async function fetchTrackPeaks(track){
	if (trackPeaksCache.has(track.id) || trackPeaksPending.has(track.id)) return;
	trackPeaksPending.add(track.id);
	try {
		// Try DB first
		const rec = await getWaveformByTrack(track.id);
		if (rec && rec.peaks) {
			trackPeaksCache.set(track.id, rec.peaks);
			return;
		}
		// If no DB record, try to decode from audio file if buffer is absent
		if (!audioEngine.buffers.get(track.id)) {
			const afList = await getAudioFiles(track.id);
			const af = afList && afList[0];
			if (af && af.blob) {
				ensureDecodeCtx();
				const arr = await af.blob.arrayBuffer();
				const buf = await decodeBuffer(arr);
				audioEngine.buffers.set(track.id, buf);
			}
		}
		// Compute from buffer if available now
		const buf = audioEngine.buffers.get(track.id);
		if (buf) {
			const wf = computeWaveformFromBuffer(buf, 2000);
			trackPeaksCache.set(track.id, wf.peaks);
			try { await putWaveform({ type:'track', songId: track.songId, trackId: track.id, bins: wf.bins, peaks: wf.peaks }); } catch(_){}
		}
	} catch (e) {
		console.warn('fetchTrackPeaks failed', e);
	} finally {
		trackPeaksPending.delete(track.id);
	}
}
function drawTrackWaveform(track, canvas) {
	if (!canvas) return;
	const ctx = canvas.getContext('2d');
	// HiDPI scale
	const dpr = window.devicePixelRatio || 1;
	const cssW = canvas.clientWidth || canvas.width;
	const cssH = canvas.clientHeight || canvas.height;
	if (canvas.width !== Math.floor(cssW*dpr) || canvas.height !== Math.floor(cssH*dpr)) {
		canvas.width = Math.floor(cssW*dpr); canvas.height = Math.floor(cssH*dpr);
	}
	ctx.setTransform(dpr,0,0,dpr,0,0);
	const w = canvas.width/dpr, h = canvas.height/dpr;
	// bg
	ctx.fillStyle = '#151b20'; ctx.fillRect(0,0,w,h);
	ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.strokeRect(0.5,0.5,w-1,h-1);
	// peaks
		const peaks = getTrackPeaksSync(track);
		if (!peaks || !peaks.length) {
		ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.font = '12px system-ui'; ctx.fillText('Waveform pending…', 10, h/2);
			// try to fetch asynchronously, then redraw
			fetchTrackPeaks(track).then(() => {
				// Redraw if now available
				if (trackPeaksCache.has(track.id)) {
					requestAnimationFrame(() => drawTrackWaveform(track, canvas));
				}
			});
		return;
	}
	const state = trackWaveState.get(track.id) || { zoom:1, scroll:0, selection:null };
	const len = peaks.length;
	const dur = getTrackDuration(track) || 1;
	const visibleBins = Math.floor(len / state.zoom);
	const startBin = Math.floor(state.scroll * (len - visibleBins));
	const endBin = Math.min(len, startBin + visibleBins);
	// use same bar style as master, 1px/1px
	const barW = 1, gap = 1, colWidth = barW + gap;
	const cols = Math.max(20, Math.min(1000, Math.floor(w / colWidth)));
	for (let i = 0; i < cols; i++) {
		const a = startBin + Math.floor((i / cols) * (endBin - startBin));
		const b = startBin + Math.floor(((i+1) / cols) * (endBin - startBin));
		let vmax = 0;
		for (let j = a; j < b; j++) {
			const v = (peaks[j]||0)/255; if (v>vmax) vmax=v;
		}
		// soft-knee like master
		const k=1.2, scale=0.9*(1+k); let v = (scale*vmax)/(1+k*vmax); v=Math.min(0.95,Math.max(0,v));
		const bh = Math.max(1, Math.floor(v * (h-4)));
		const x = Math.round(i * colWidth + (colWidth - barW)/2);
		const y = Math.floor((h - bh) / 2);
		ctx.fillStyle = '#6c849c';
		ctx.fillRect(x,y,barW,bh);
	}
	// Simple time ticks
	// Debug output to check regions data
	const regCount = Array.isArray(track.regions) ? track.regions.length : 0;
	console.log(`Drawing waveform for track ${track.id}`, regCount ? `with ${regCount} regions` : 'without regions');
	// If no regions present, do a one-shot DB refresh to verify persistence
	if ((!Array.isArray(track.regions) || track.regions.length === 0) && !track._regionsFetchPending && track?.songId && track?.id) {
		track._regionsFetchPending = true;
		(async () => {
			try {
				const list = await getTracks(track.songId);
				const latest = list?.find(t => t.id === track.id);
				if (latest && Array.isArray(latest.regions) && latest.regions.length) {
					console.log(`[Regions] Reloaded from DB for track ${track.id}: ${latest.regions.length} regions`);
					track.regions = latest.regions.slice();
					requestAnimationFrame(() => drawTrackWaveform(track, canvas));
				}
			} catch (e) {
				console.warn('[Regions] DB reload failed', e);
			} finally {
				track._regionsFetchPending = false;
			}
		})();
	}
	
	// Draw mute regions if present
	if (Array.isArray(track.regions) && track.regions.length > 0) {
		ctx.save();
		
		// Use a semi-transparent overlay with red color for mute regions
		ctx.fillStyle = 'rgba(220, 53, 69, 0.3)';
		
		const visibleStartTime = state.scroll * dur * (1 - 1/state.zoom);
		const visibleEndTime = visibleStartTime + (dur / state.zoom);
		
		// Draw each region as a colored overlay
		for (const region of track.regions) {
			if (!region || typeof region.start !== 'number' || typeof region.end !== 'number') continue;
			
			// Skip regions outside visible area
			if (region.end < visibleStartTime || region.start > visibleEndTime) continue;
			
			// Convert region times to canvas coordinates
			const regionStartX = timeToX(region.start, dur, w, state);
			const regionEndX = timeToX(region.end, dur, w, state);
			
			// Draw region rectangle
			ctx.fillRect(regionStartX, 0, regionEndX - regionStartX, h);
			
			// Draw borders
			ctx.strokeStyle = 'rgba(220, 53, 69, 0.7)';
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.moveTo(regionStartX + 0.5, 0);
			ctx.lineTo(regionStartX + 0.5, h);
			ctx.moveTo(regionEndX + 0.5, 0);
			ctx.lineTo(regionEndX + 0.5, h);
			ctx.stroke();
		}
		ctx.restore();
	}
	
	// Draw selection if present
	if (state.selection && typeof state.selection.start === 'number' && typeof state.selection.end === 'number') {
		ctx.save();
		// Use blue highlight for current selection
		ctx.fillStyle = 'rgba(0, 123, 255, 0.25)';
		
		const selStartX = timeToX(state.selection.start, dur, w, state);
		const selEndX = timeToX(state.selection.end, dur, w, state);
		
		// Draw selection rectangle
		ctx.fillRect(selStartX, 0, selEndX - selStartX, h);
		
		// Draw borders with handles for resizing
		ctx.strokeStyle = 'rgba(0, 123, 255, 0.7)';
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(selStartX + 0.5, 0);
		ctx.lineTo(selStartX + 0.5, h);
		ctx.moveTo(selEndX + 0.5, 0);
		ctx.lineTo(selEndX + 0.5, h);
		ctx.stroke();
		
		// Draw resize handles
		ctx.fillStyle = 'rgba(0, 123, 255, 0.9)';
		const handleWidth = 5;
		const handleHeight = Math.min(30, h - 10);
		const handleY = (h - handleHeight) / 2;
		
		// Left handle
		ctx.fillRect(selStartX - handleWidth/2, handleY, handleWidth, handleHeight);
		
		// Right handle
		ctx.fillRect(selEndX - handleWidth/2, handleY, handleWidth, handleHeight);
		
		ctx.restore();
	}
	
	ctx.save();
	ctx.fillStyle='rgba(200,210,220,0.4)'; ctx.strokeStyle='rgba(200,210,220,0.25)'; ctx.lineWidth=1; ctx.font='10px system-ui'; ctx.textAlign='center'; ctx.textBaseline='alphabetic';
	const approxTick = 10; // seconds
	const pxPerSec = w / dur * state.zoom;
	const tickSec = Math.max(5, Math.round((approxTick / pxPerSec)) * 5);
	for (let t = tickSec; t < dur; t += tickSec) {
		const x = Math.floor((t / dur) * w);
		if (x < 10 || x > w-10) continue;
		ctx.beginPath(); ctx.moveTo(x+0.5,h-12); ctx.lineTo(x+0.5,h-6); ctx.stroke();
		ctx.fillText(formatMMSS(t), x, h-2);
	}
	ctx.restore();
}
function timeToX(t, dur, w, state){
	const visibleFrac = 1 / state.zoom;
	const startT = state.scroll * dur * (1 - visibleFrac);
	const endT = startT + dur * visibleFrac;
	const clamped = Math.max(startT, Math.min(endT, t));
	const rel = (clamped - startT) / (endT - startT);
	return Math.round(rel * w);
}
function pxToTimeRange(track, canvas, x1, x2){
	if (!track || !track.id || !canvas) {
		console.warn('Invalid track or canvas in pxToTimeRange');
		return { start: 0, end: 0 };
	}
	
	// Ensure we have valid numeric inputs
	x1 = Number(x1) || 0;
	x2 = Number(x2) || 0;
	
	const state = trackWaveState.get(track.id) || { zoom: 1, scroll: 0 };
	const dur = getTrackDuration(track) || 0;
	
	// If track has no duration, return empty range
	if (!dur) return { start: 0, end: 0 };
	
	const canvasWidth = canvas.clientWidth || canvas.width || 1; // Avoid division by zero
	
	// Calculate visible portion based on zoom/scroll state
	const visibleFrac = 1 / state.zoom;
	const startT = state.scroll * dur * (1 - visibleFrac);
	const visDur = dur * visibleFrac;
	
	// Clamp pixel positions to canvas boundaries
	const a = Math.max(0, Math.min(canvasWidth, x1));
	const b = Math.max(0, Math.min(canvasWidth, x2));
	
	// Convert pixels to time
	const ta = startT + (a / canvasWidth) * visDur;
	const tb = startT + (b / canvasWidth) * visDur;
	
	// Ensure start is always less than end
	const start = Math.max(0, Math.min(dur, Math.min(ta, tb)));
	const end = Math.max(0, Math.min(dur, Math.max(ta, tb)));
	
	// Add a minimum duration if start and end are too close
	if (end - start < 0.01) {
		return { 
			start: start, 
			end: Math.min(dur, start + 0.01) 
		};
	}
	
	return { start, end };
}
function mergeRegions(regs){
	if (!Array.isArray(regs) || regs.length === 0) return [];
	
	// Filter out invalid regions and ensure numeric types
	const validRegs = regs
		.filter(r => r && typeof r.start === 'number' && typeof r.end === 'number' && !isNaN(r.start) && !isNaN(r.end))
		.map(r => ({ start: Number(r.start), end: Number(r.end) }))
		.filter(r => r.end > r.start); // Only keep regions with positive duration
	
	if (validRegs.length === 0) return [];
	
	// Sort by start time
	validRegs.sort((a, b) => a.start - b.start);
	
	// Merge overlapping regions
	const out = [validRegs[0]];
	for (let i = 1; i < validRegs.length; i++) {
		const prev = out[out.length - 1];
		const cur = validRegs[i];
		
		// If current region overlaps or is very close to previous, merge them
		if (cur.start <= prev.end + 0.01) {
			prev.end = Math.max(prev.end, cur.end);
		} else {
			out.push(cur);
		}
	}
	
	return out;
}
function previewSelection(track){
	const state = trackWaveState.get(track.id);
	if (!state || !state.selection || state.selection.end <= state.selection.start) return;
	// Quick preview: ensure current UI-selected song is active, then start at selection time
	if (!selectedSongId) return;
	const start = state.selection.start;
	const stopAt = state.selection.end;
	buildAndStart(selectedSongId, start, { soloTrackId: track.id, stopAtSec: stopAt });
}
// Rebuild or resume at current position so mute region edits apply immediately during playback
function refreshPlaybackForRegions() {
	try {
		if (!audioEngine || !audioEngine.songId) return;
		const sid = audioEngine.songId;
		const wasPlaying = !!audioEngine.playing;
		const pos = wasPlaying
			? (Math.max(0, (audioEngine.ctx ? audioEngine.ctx.currentTime : 0) - audioEngine.startTime) + (audioEngine.offset || 0))
			: (audioEngine.offset || 0);
		if (wasPlaying) {
			buildAndStart(sid, pos);
		} else {
			audioEngine.offset = pos;
			startProgressLoop();
		}
	} catch(_) {}
}
function zoomToSelection(track, canvas){
	const state = trackWaveState.get(track.id);
	if (!state || !state.selection || state.selection.end <= state.selection.start) return;
	const dur = getTrackDuration(track) || 0;
	const selDur = Math.max(0.01, state.selection.end - state.selection.start);
	// Aim to make selection fill ~70% of the canvas width
	const targetZoom = Math.min(64, Math.max(1, (dur / selDur) * 0.7));
	state.zoom = targetZoom;
	// Center selection in view
	const visibleFrac = 1 / state.zoom;
	let startT = state.selection.start - (visibleFrac*dur - selDur)/2;
	startT = Math.max(0, Math.min(dur * (1 - visibleFrac), startT));
	state.scroll = dur > 0 ? startT / (dur * (1 - visibleFrac) || 1) : 0;
	drawTrackWaveform(track, canvas);
}
function pickRegionAtX(track, canvas, x){
	const dur = getTrackDuration(track) || 0;
	const state = trackWaveState.get(track.id) || { zoom:1, scroll:0 };
	const regs = Array.isArray(track.regions) ? track.regions : [];
	const t = pxToTimeRange(track, canvas, x, x).start;
	for (const r of regs) {
		if (r && typeof r.start==='number' && typeof r.end==='number' && t >= r.start && t <= r.end) return r;
	}
	return null;
}
function findContainingRegion(regions, a, b){
	for (const r of regions || []){
		if (!r) continue; const s=r.start, e=r.end; if (a>=s && b<=e) return r;
	}
	return null;
}
async function deleteSelectedRegion(track){
	const st = trackWaveState.get(track.id);
	if (!st || !st.selection) return;
	const { start, end } = st.selection;
	if (!(Array.isArray(track.regions) && track.regions.length)) return;
	const keep = [];
	let removed = false;
	for (const r of track.regions) {
		if (!r) continue;
		const matches = Math.abs(r.start - start) < 0.01 && Math.abs(r.end - end) < 0.01;
		if (matches && !removed) { removed = true; continue; }
		keep.push(r);
	}
	track.regions = keep;
	await updateTrack(track);
	// Clear selection if it no longer matches any region
	if (removed) st.selection = null;
}

// Draw overlays on the master waveform: playhead line and pulsing played area
function redrawMasterOverlays(){
	if (!masterWaveCanvas || !masterWaveCtx || !masterWaveLastPeaks) return;
	// Redraw base waveform first to keep overlays crisp each frame
	drawWaveformToCanvas(masterWaveCanvas, masterWaveLastPeaks, masterWaveBaseColor);
	const dpr = window.devicePixelRatio || 1;
	const w = masterWaveCanvas.width / dpr;
	const h = masterWaveCanvas.height / dpr;
	const dur = audioEngine.duration || 0;
	const now = audioEngine.ctx ? audioEngine.ctx.currentTime : 0;
	const pos = audioEngine.playing ? Math.max(0, now - audioEngine.startTime) + audioEngine.offset : audioEngine.offset;
	const x = dur > 0 ? Math.floor((Math.max(0, Math.min(dur, pos)) / dur) * w) : 0;
	const ctx = masterWaveCtx;
	// Pulse green hues based on master volume
	const vol = masterVolume ? parseFloat(masterVolume.value || '0.5') : 0.5;
	const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 220); // 0..1
	const hue = 140 - 20 * vol; // 140..120
	const sat = 40 + 40 * vol;  // 40..80
	const a1 = 0.10 + 0.10 * pulse * vol;
	const a2 = 0.18 + 0.18 * pulse * vol;
	if (x > 0) {
		const grad = ctx.createLinearGradient(0, 0, x, 0);
		grad.addColorStop(0, `hsla(${hue}, ${sat}%, 28%, ${a1})`);
		grad.addColorStop(1, `hsla(${hue}, ${sat}%, 35%, ${a2})`);
		ctx.fillStyle = grad;
		ctx.fillRect(1, 1, x - 1, h - 2);
	}
	// Playhead line
	ctx.save();
	ctx.strokeStyle = 'rgba(255,255,255,0.9)';
	ctx.lineWidth = 1.5;
	ctx.beginPath();
	ctx.moveTo(x + 0.5, 1);
	ctx.lineTo(x + 0.5, h - 1);
	ctx.stroke();
	ctx.restore();

	// Removed external progress line - using only the canvas-drawn playhead
}

// Ensure song is loaded; deduplicate concurrent loads and always await duration readiness
async function ensureSongLoaded(songId) {
	if (audioEngine.loadedSongId === songId && (audioEngine.duration || 0) > 0) return;
	if (audioEngine.loadingPromise && audioEngine.loadingSongId === songId) {
		await audioEngine.loadingPromise; return;
	}
	audioEngine.loadingSongId = songId;
	audioEngine.loadingPromise = (async () => {
		try {
			await loadSongAudio(songId);
			audioEngine.loadedSongId = songId;
		} finally {
			audioEngine.loadingSongId = null;
			audioEngine.loadingPromise = null;
		}
	})();
	await audioEngine.loadingPromise;
}

// Centralized scheduler for per-track mute regions.
// Regions are in song-time seconds. We schedule changes relative to audibleAt so warm-start remains muted until audible time.
function scheduleMutesForTrack({ ctx, gate, regions, playheadAtAudibleSec, trackOffsetSec = 0, bufferDuration, startAtRaw, audibleAt, trackId }) {
	try {
		if (!ctx || !gate || !gate.gain) return;
		// Compute positions at audibleAt
		const songAtAudible = Math.max(0, Number(playheadAtAudibleSec) || 0);
		const trackOffset = Math.max(0, Number(trackOffsetSec) || 0);
		const rawReadAt = (songAtAudible - trackOffset); // can be negative if track starts later
		const bufDur = Math.max(0, Number(bufferDuration) || 0);
		const now = ctx.currentTime;

		// Baseline: start closed at raw start; we'll open at the time the track actually becomes audible (audBase)
		// Caller already set 0.0 at startAtRaw.
		const regs = Array.isArray(regions) ? regions.filter(r => r && Number.isFinite(r.start) && Number.isFinite(r.end) && r.end > r.start) : [];

		// Merge/sort defensively in case of overlaps or unsorted input
		const sorted = regs.slice().sort((a,b) => a.start - b.start);

		// Determine the scheduling base: when does the track become audible and what track time is that?
		const audBase = songAtAudible < trackOffset ? (audibleAt + (trackOffset - songAtAudible)) : audibleAt;
		const readBase = Math.max(0, rawReadAt); // track-local time at audBase
		// Open baseline: if not inside a region at readBase, open at audBase; else keep closed until region end
		const inRegion = sorted.find(r => readBase >= r.start && readBase < r.end) || null;
		gate.gain.setValueAtTime(0.0, Math.max(startAtRaw, now));
		if (inRegion) {
			const relEnd = Math.max(0, Math.min(bufDur, inRegion.end) - readBase);
			gate.gain.setValueAtTime(0.0, audBase);
			gate.gain.setValueAtTime(1.0, audBase + relEnd);
			if (window && window.STP_DEBUG_MUTES) {
				console.debug('[MUTE:start-inside]', { trackId, readBase, region: inRegion, relEnd, audBase, startAtRaw });
			}
		} else {
			gate.gain.setValueAtTime(1.0, audBase);
		}

		// Intersect each region with the play window in track time [readBase, bufDur]
		const winStart = readBase;
		const winEnd = bufDur;
		for (const r of sorted) {
			const s = Math.max(r.start, winStart);
			const e = Math.min(r.end, winEnd);
			if (e <= s) continue;
			// If region begins exactly at readBase and we already handled start-inside, skip to avoid conflicting ramps
			if (inRegion && s === readBase) continue;
			const relS = s - readBase; // >= 0
			const relE = e - readBase; // >= relS
			const onT = audBase + relS;
			const offT = audBase + relE;
			// Close at relS (hard off), re-open at relE (hard on)
			gate.gain.setValueAtTime(0.0, onT);
			gate.gain.setValueAtTime(1.0, offT);
			if (window && window.STP_DEBUG_MUTES) {
				console.debug('[MUTE:interval]', { trackId, region: r, intersect: { s, e }, rel: { relS, relE }, onT, offT });
			}
		}
	} catch (e) {
		// ignore scheduling errors to avoid breaking playback
	}
}