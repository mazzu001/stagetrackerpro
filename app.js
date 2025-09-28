import { getSongs, addSong, updateSong, deleteSong, getTracks, addTrack, updateTrack, deleteTrack, getAudioFiles, addAudioFile, updateAudioFile, deleteAudioFile, putWaveform, getWaveformByTrack, getMasterWaveformBySong, deleteWaveformByTrack, deleteMasterWaveformBySong, wipeDatabase } from './db.js?v=3';
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
const importFilesBtn = document.getElementById('importFilesBtn');
const importArchiveBtn = document.getElementById('importArchiveBtn');
const exportArchiveBtn = document.getElementById('exportArchiveBtn');
const resetStorageBtn = document.getElementById('resetStorageBtn');
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
let trackManagerSongId = null; // the song currently open in Track Manager
let trackManagerDirty = false; // track add/remove changes while Track Manager is open

// Simple in-memory file storage for prototype: {fileId: {name, blob, size}}
let files = {};
let nextFileId = 1;

// ------------------ Broadcast (host) wiring ------------------
// Lightweight helper to sync song info, playhead, and lyrics to viewers via Socket.IO
// Requires server.js running and /socket.io available. Non-blocking: uses rAF to piggyback updates.
const Broadcast = {
	socket: null,
	room: null,
	started: false,
	lastSentMs: 0,
	minIntervalMs: 250, // throttle updates
	ensureSocket() {
		if (this.socket) return this.socket;
		// Guard: only attempt if socket.io client is present (served by server)
		if (!window.io) return null;
		this.socket = window.io();
		return this.socket;
	},
	start(room) {
		const io = this.ensureSocket();
		if (!io) { console.warn('Broadcast socket not available. Start server to enable broadcasting.'); return; }
		this.room = room;
		this.started = true;
		io.emit('host:join', { room, hostName: 'Host' });
		this.pushSnapshot(true);
	},
	stop() {
		this.started = false;
		this.room = null;
		// Keep socket connected; viewers simply stop receiving updates
	},
	getLyricsForSong(songId) {
		// Parse timestamps like [01:30] at the start (or anywhere) of lines.
		const ta = document.getElementById('lyricsTextarea');
		if (!ta) return [];
		const lines = String(ta.value || '').split(/\r?\n/);
		const out = [];
		const tsRe = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g; // [mm:ss] or [mm:ss.mmm]
		for (const raw of lines) {
			if (!raw || !raw.trim()) continue;
			let text = raw;
			let match;
			let hasAny = false;
			tsRe.lastIndex = 0;
			while ((match = tsRe.exec(raw)) !== null) {
				hasAny = true;
				const mm = parseInt(match[1], 10) || 0;
				const ss = parseInt(match[2], 10) || 0;
				const ms = parseInt(match[3] || '0', 10) || 0;
				const t = mm * 60 + ss + (ms/1000);
				// Strip token from text once (after we processed matches, we will strip globally)
				out.push({ t, text: raw.replace(tsRe, '').trim() });
			}
			if (!hasAny) {
				// No timestamp -> leave t as NaN for now; we'll align such lines after the previous timestamp
				out.push({ t: NaN, text: raw.replace(tsRe, '').trim() });
			}
		}
		// Normalize untimed lines: place them slightly after the preceding timed line
		out.sort((a,b) => (isNaN(a.t)? Infinity : a.t) - (isNaN(b.t)? Infinity : b.t));
		let lastT = 0;
		for (let i=0;i<out.length;i++) {
			if (isNaN(out[i].t)) {
				lastT = lastT + 2; // 2s after previous as a fallback spacing
				out[i].t = lastT;
			} else {
				lastT = out[i].t;
			}
		}
		// Ensure ascending and dedupe accidental duplicates by nudging
		out.sort((a,b)=>a.t-b.t);
		for (let i=1;i<out.length;i++) {
			if (out[i].t <= out[i-1].t) out[i].t = out[i-1].t + 0.01;
		}
		return out;
	},
	currentSongMeta() {
		const song = songs.find(s => s.id === selectedSongId) || {};
		return { title: song.title || '', artist: song.artist || '' };
	},
	snapshot() {
		return {
			song: this.currentSongMeta(),
			duration: audioEngine.duration || 0,
			position: (function(){
				if (!audioEngine.ctx) return audioEngine.offset || 0;
				const now = audioEngine.ctx.currentTime;
				return audioEngine.playing ? Math.max(0, now - audioEngine.startTime) + audioEngine.offset : audioEngine.offset || 0;
			})(),
			playing: !!audioEngine.playing,
			lyrics: this.getLyricsForSong(selectedSongId)
		};
	},
	pushSnapshot(force=false) {
		if (!this.started || !this.room) return;
		const now = performance.now();
		if (!force && now - this.lastSentMs < this.minIntervalMs) return;
		const io = this.ensureSocket();
		if (!io) return;
		const state = this.snapshot();
		this.lastSentMs = now;
		io.emit('state:push', { room: this.room, state });
	}
};
// Expose a minimal API to the page for UI wiring
window.STP_Broadcast = {
	start: (room) => Broadcast.start(room),
	stop: () => Broadcast.stop()
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
		let trackCount = song.tracks || 0;
		const trackBtn = document.createElement('button');
		trackBtn.className = 'track-btn';
		trackBtn.textContent = `${trackCount} tracks`;
		trackBtn.title = 'Open Track Manager';
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
		songDetailsPara.textContent = song.artist ? (song.artist + ' — ' + song.tracks + ' tracks') : 'No artist information.';
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
	const song = { title, artist, tracks: 0 };
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
function exportArchive() {
	// Placeholder: archive export is out of scope for current IndexedDB flow.
}
if (audioFileInput) audioFileInput.addEventListener('change', handleAudioFiles);
if (exportArchiveBtn) exportArchiveBtn.addEventListener('click', () => { exportArchive(); closeSettingsMenu(); });
if (resetStorageBtn) resetStorageBtn.addEventListener('click', async () => {
	closeSettingsMenu();
	try {
		await wipeDatabase();
	} catch (e) {
		console.warn('wipeDatabase error', e);
	}
	// Hard reload to re-open DB and clear in-memory state
	location.reload();
});


if (deleteSongBtn) deleteSongBtn.addEventListener('click', openDeleteSongModal);
if (closeDeleteSongBtn) closeDeleteSongBtn.addEventListener('click', closeDeleteSongModal);
if (cancelDeleteSongBtn) cancelDeleteSongBtn.addEventListener('click', closeDeleteSongModal);
if (confirmDeleteSongBtn) confirmDeleteSongBtn.addEventListener('click', handleConfirmDeleteSong);
window.addEventListener('keydown', (e) => {
	if (e.key === 'Escape' && deleteSongModal && !deleteSongModal.classList.contains('hidden')) {
		closeDeleteSongModal();
	}
});

// initial render — run after window load to ensure the DOM and resources are ready
window.addEventListener('load', async () => {
	console.log('app.js: window load — initializing UI');
	try {
			// Load songs from IndexedDB
			songs = await getSongs();
			window.songs = songs;
			await renderSongs();
			// Do not auto-select or preload any song on launch; wait for user selection
			if (!songs.length) {
				// No songs, show empty details
				if (songDetailsTitle) songDetailsTitle.textContent = '';
				if (songDetailsPara) songDetailsPara.textContent = 'No song selected.';
				// Ensure master waveform is cleared on first launch with no selection
				try { await renderMasterWaveFromDB(null); } catch(_) {}
			}
	} catch (err) {
		console.error('app.js init error:', err);
	}
	// Try to attach socket.io client if served; ignore if unavailable
	(function attachSocketClient(){
		if (window.io) return; // already present
		const s = document.createElement('script');
		s.src = '/socket.io/socket.io.js';
		s.async = true;
		s.onload = () => { /* ready for broadcasting if user starts it */ };
		s.onerror = () => { /* server not running; silently ignore */ };
		document.head.appendChild(s);
	})();

	// Auto-start broadcast if dashboard passed ?broadcast=<room>
	try {
		const params = new URLSearchParams(location.search);
		const room = params.get('broadcast');
		if (room && window.STP_Broadcast) {
			// If socket client not yet loaded, give it a moment
			const kick = () => { try { window.STP_Broadcast.start(room); } catch(_) {} };
			if (window.io) kick(); else setTimeout(kick, 200);
		}
	} catch(_) {}
});

// Stop broadcasting when leaving the page (best-effort)
window.addEventListener('beforeunload', () => {
	try { if (window.STP_Broadcast) window.STP_Broadcast.stop(); } catch(_) {}
});

// ------------------ MIDI Device Manager ------------------
const midiState = {
	access: null,
	inputs: new Map(),
	outputs: new Map(),
	connectedInputs: new Set(), // by id
	connectedOutputs: new Set(),
	logLimit: 400,
};

function appendMidiLog(msg) {
	const body = document.getElementById('midiManagerBody');
	if (!body) return;
	const log = body.querySelector('.midi-log');
	if (!log) return;
	const line = document.createElement('div');
	line.textContent = msg;
	log.appendChild(line);
	// trim
	while (log.children.length > midiState.logLimit) {
		log.removeChild(log.firstChild);
	}
	log.scrollTop = log.scrollHeight;
}

// Persist last-connected MIDI device preferences (by id with name fallback)
const MIDI_PREFS_KEY = 'stpro.midi.prefs.v1';

function loadMidiPrefs() {
	try {
		const raw = localStorage.getItem(MIDI_PREFS_KEY);
		if (!raw) return { inputs: [], outputs: [] };
		const obj = JSON.parse(raw);
		return {
			inputs: Array.isArray(obj?.inputs) ? obj.inputs : [],
			outputs: Array.isArray(obj?.outputs) ? obj.outputs : []
		};
	} catch (_) {
		return { inputs: [], outputs: [] };
	}
}

function saveMidiPrefs() {
	try {
		const inputs = Array.from(midiState.connectedInputs).map((id) => {
			const d = midiState.inputs.get(id);
			return { id, name: d?.name || '' };
		});
		const outputs = Array.from(midiState.connectedOutputs).map((id) => {
			const d = midiState.outputs.get(id);
			return { id, name: d?.name || '' };
		});
		localStorage.setItem(MIDI_PREFS_KEY, JSON.stringify({ inputs, outputs }));
	} catch (_) { /* ignore */ }
}

function autoReconnectFromPrefs() {
	const prefs = loadMidiPrefs();
	let autoIn = 0, autoOut = 0;
	// Inputs: connect saved ones if present; fallback by name if id changed
	for (const pref of prefs.inputs || []) {
		let id = pref?.id;
		if (id && midiState.inputs.has(id)) {
			if (!midiState.connectedInputs.has(id)) { toggleInputConnection(id); autoIn++; }
			continue;
		}
		// Fallback: try by name (best-effort)
		const byName = pref?.name ? Array.from(midiState.inputs.values()).find(d => (d?.name||'') === pref.name) : null;
		if (byName && !midiState.connectedInputs.has(byName.id)) { toggleInputConnection(byName.id); autoIn++; }
	}
	// Outputs: enable saved ones if present; fallback by name if id changed
	for (const pref of prefs.outputs || []) {
		let id = pref?.id;
		if (id && midiState.outputs.has(id)) {
			if (!midiState.connectedOutputs.has(id)) { toggleOutputArmed(id); autoOut++; }
			continue;
		}
		const byName = pref?.name ? Array.from(midiState.outputs.values()).find(d => (d?.name||'') === pref.name) : null;
		if (byName && !midiState.connectedOutputs.has(byName.id)) { toggleOutputArmed(byName.id); autoOut++; }
	}
	if (autoIn || autoOut) {
		appendMidiLog(`Auto-reconnected ${autoIn} input(s) and ${autoOut} output(s)`);
	}
}

// Load cached MIDI device snapshot for faster perceived display
//

// Translation helpers
// Normalize any MIDI to [[PC:value:channel]] and, more generally, [[TYPE:ch:data...]] for other types
function midiMessageToTag([status, d1, d2]) {
	const type = status & 0xF0;
	const ch = (status & 0x0F) + 1; // 1..16
	switch (type) {
		case 0xC0: // Program Change
			// New format: [[PC:value:channel]] where value is 1..128
			return `[[PC:${(d1 ?? 0)+1}:${ch}]]`;
		case 0xB0: // CC
			return `[[CC:${ch}:${d1 ?? 0}:${d2 ?? 0}]]`;
		case 0x90: // Note On
			return `[[NOTE_ON:${ch}:${d1 ?? 0}:${d2 ?? 0}]]`;
		case 0x80: // Note Off
			return `[[NOTE_OFF:${ch}:${d1 ?? 0}:${d2 ?? 0}]]`;
		case 0xE0: { // Pitch Bend (14-bit)
			const value = (((d2 ?? 0) << 7) | (d1 ?? 0)) - 8192; // -8192..8191
			return `[[PB:${ch}:${value}]]`;
		}
		case 0xD0: // Channel Pressure
			return `[[CP:${ch}:${d1 ?? 0}]]`;
		case 0xA0: // Poly Pressure
			return `[[POLY_PRESS:${ch}:${d1 ?? 0}:${d2 ?? 0}]]`;
		default:
			// System messages (0xF0..), realtime, etc.
			return `[[SYS:${status}:${d1 ?? ''}:${d2 ?? ''}]]`;
	}
}

function tagToMidiMessage(tag) {
	// Expect forms like [[PC:value:channel]], [[CC:ch:cc:val]], [[NOTE_ON:ch:n:vel]], [[PB:ch:value]] etc.
	const m = String(tag || '').trim().match(/^\[\[(.+?)\]\]$/);
	if (!m) return null;
	const parts = m[1].split(':');
	const kind = (parts[0]||'').toUpperCase();
	const num = (i, def=0) => Math.max(0, parseInt(parts[i] ?? def, 10) || def);
	const ch = Math.max(1, Math.min(16, num(1,1)));
	const ch0 = ch - 1;
	switch (kind) {
		case 'PC': {
			// New format: [[PC:value:channel]]
			const prog1 = num(1,1); // 1..128 typical UI
			const pcCh = Math.max(1, Math.min(16, num(2,1)));
			const pcCh0 = pcCh - 1;
			const prog0 = Math.max(0, Math.min(127, prog1 - 1));
			return [0xC0 | pcCh0, prog0];
		}
		case 'CC': {
			const cc = num(2,0);
			const val = num(3,0);
			return [0xB0 | ch0, Math.min(127, cc), Math.min(127, val)];
		}
		case 'NOTE_ON': {
			const note = num(2,60);
			const vel = num(3,100);
			return [0x90 | ch0, Math.min(127,note), Math.min(127,vel)];
		}
		case 'NOTE_OFF': {
			const note = num(2,60);
			const vel = num(3,0);
			return [0x80 | ch0, Math.min(127,note), Math.min(127,vel)];
		}
		case 'PB': {
			// value -8192..8191
			let value = parseInt(parts[2] ?? '0', 10);
			if (!Number.isFinite(value)) value = 0;
			value = Math.max(-8192, Math.min(8191, value));
			const v14 = value + 8192;
			const lsb = v14 & 0x7F; const msb = (v14 >> 7) & 0x7F;
			return [0xE0 | ch0, lsb, msb];
		}
		case 'CP': {
			const pres = num(2,0);
			return [0xD0 | ch0, Math.min(127,pres)];
		}
		case 'POLY_PRESS': {
			const note = num(2,60);
			const pres = num(3,0);
			return [0xA0 | ch0, Math.min(127,note), Math.min(127,pres)];
		}
			// (no SYSEX support in this simplified version)
		default:
			return null;
	}
}

async function ensureMidiAccess() {
	if (midiState.access) return midiState.access;
	if (!navigator.requestMIDIAccess) {
		appendMidiLog('Web MIDI not supported in this browser.');
		return null;
	}
	try {
		const access = await navigator.requestMIDIAccess({ sysex: true });
		midiState.access = access;
		const rebuild = () => { rebuildMidiLists(); try { autoReconnectFromPrefs(); } catch(_){} };
		access.onstatechange = rebuild;
		rebuildMidiLists();
		// Attempt auto-reconnect after initial enumeration (non-blocking)
		setTimeout(() => { try { autoReconnectFromPrefs(); } catch(_){} }, 0);
		return access;
	} catch (e) {
		appendMidiLog('Failed to get MIDI access: ' + e.message);
		return null;
	}
}

function rebuildMidiLists() {
	if (!midiState.access) return;
	midiState.inputs.clear();
	midiState.outputs.clear();
	for (const inp of midiState.access.inputs.values()) midiState.inputs.set(inp.id, inp);
	for (const out of midiState.access.outputs.values()) midiState.outputs.set(out.id, out);
	renderMidiManagerBody();
}

function openMidiManager() {
	const modal = document.getElementById('midiManagerModal');
	if (!modal) return;
	modal.classList.remove('hidden');
	modal.style.display = 'flex';
	// Kick off MIDI access, but don't wait—render UI immediately
	try { ensureMidiAccess(); } catch(_) {}
	renderMidiHeader();
	renderMidiManagerBody();
}
function closeMidiManager() {
	const modal = document.getElementById('midiManagerModal');
	if (modal) { modal.classList.add('hidden'); modal.style.display = 'none'; }
}
window.openMidiManager = openMidiManager;
const closeMidiBtn = document.getElementById('closeMidiManager');
if (closeMidiBtn) closeMidiBtn.addEventListener('click', closeMidiManager);

function renderMidiHeader() {
	const hdr = document.getElementById('midiManagerHeader');
	if (!hdr) return;
	hdr.innerHTML = '';
	// Add a simple Scan button to refresh Web MIDI device lists
	const scanBtn = document.createElement('button');
	scanBtn.className = 'btn small';
	scanBtn.textContent = 'Scan';
	scanBtn.title = 'Refresh MIDI inputs/outputs';
	scanBtn.addEventListener('click', () => { scanMidiDevices(); });
	hdr.appendChild(scanBtn);
}

// Simple scan: ensure Web MIDI access and rebuild device lists
async function scanMidiDevices() {
	const hadAccess = !!midiState.access;
	const beforeIn = midiState.inputs.size;
	const beforeOut = midiState.outputs.size;
	await ensureMidiAccess();
	rebuildMidiLists();
	const afterIn = midiState.inputs.size;
	const afterOut = midiState.outputs.size;
	const deltaIn = afterIn - beforeIn;
	const deltaOut = afterOut - beforeOut;
	const deltaStr = `Δ Inputs ${deltaIn >= 0 ? '+'+deltaIn : deltaIn}, Outputs ${deltaOut >= 0 ? '+'+deltaOut : deltaOut}`;
	appendMidiLog(`Scan complete${hadAccess ? '' : ' (initialized)'}: Inputs ${afterIn}, Outputs ${afterOut} (${deltaStr})`);
}

function renderMidiManagerBody() {
	const body = document.getElementById('midiManagerBody');
	if (!body) return;
	body.innerHTML = '';

	// Left: Inputs and Outputs
	const left = document.createElement('div');
	left.className = 'midi-col-left';

	const inPanel = document.createElement('div');
	inPanel.className = 'midi-panel';
	inPanel.innerHTML = '<h3>MIDI Inputs</h3>';
	const inList = document.createElement('div'); inList.className = 'midi-list';
	if (midiState.inputs.size === 0) {
		const none = document.createElement('div'); none.textContent = 'No input devices found.'; none.style.color = '#9aa7b3';
		inList.appendChild(none);
	} else {
		for (const [id, inp] of midiState.inputs) {
			const item = document.createElement('div'); item.className = 'midi-item';
			const name = document.createElement('div'); name.textContent = inp.name || 'Input';
			const badge = document.createElement('span'); badge.className = 'midi-badge'; badge.textContent = midiState.connectedInputs.has(id) ? 'Connected' : 'Disconnected';
			const actions = document.createElement('div'); actions.className = 'midi-actions';
			const btn = document.createElement('button'); btn.className = 'btn small'; btn.textContent = midiState.connectedInputs.has(id) ? 'Disconnect' : 'Connect';
			btn.addEventListener('click', () => toggleInputConnection(id));
			actions.appendChild(btn);
			item.appendChild(name); item.appendChild(badge); item.appendChild(actions);
			inList.appendChild(item);
		}
	}
	inPanel.appendChild(inList);
	left.appendChild(inPanel);

	const outPanel = document.createElement('div');
	outPanel.className = 'midi-panel';
	outPanel.innerHTML = '<h3>MIDI Outputs</h3>';
	const outList = document.createElement('div'); outList.className = 'midi-list';
	if (midiState.outputs.size === 0) {
		const none = document.createElement('div'); none.textContent = 'No output devices found.'; none.style.color = '#9aa7b3';
		outList.appendChild(none);
	} else {
		for (const [id, out] of midiState.outputs) {
			const item = document.createElement('div'); item.className = 'midi-item';
			const name = document.createElement('div'); name.textContent = out.name || 'Output';
			const badge = document.createElement('span'); badge.className = 'midi-badge'; badge.textContent = midiState.connectedOutputs.has(id) ? 'Armed' : 'Idle';
			const actions = document.createElement('div'); actions.className = 'midi-actions';
			const btn = document.createElement('button'); btn.className = 'btn small'; btn.textContent = midiState.connectedOutputs.has(id) ? 'Disable' : 'Enable';
			btn.addEventListener('click', () => toggleOutputArmed(id));
			actions.appendChild(btn);
			item.appendChild(name); item.appendChild(badge); item.appendChild(actions);
			outList.appendChild(item);
		}
	}
	outPanel.appendChild(outList);
	left.appendChild(outPanel);


	// Right: Send Test and Log
	const right = document.createElement('div');
	right.className = 'midi-col-right';
	const sendPanel = document.createElement('div'); sendPanel.className = 'midi-panel';
	sendPanel.innerHTML = '<h3>Send Test Command</h3>';
	const row = document.createElement('div'); row.className = 'midi-row';
	const input = document.createElement('input'); input.type = 'text'; input.placeholder = 'e.g. [[PC:10:1]] (value:channel) or [[CC:1:7:100]] or [[NOTE_ON:1:60:100]]';
		const sendBtn = document.createElement('button'); sendBtn.className = 'btn'; sendBtn.textContent = 'Send';
	sendBtn.addEventListener('click', () => {
		const tag = input.value.trim();
		if (!tag) return;
		const msg = tagToMidiMessage(tag);
		if (!msg) { appendMidiLog('Invalid tag: ' + tag); return; }
		let sent = 0;
		for (const [id, out] of midiState.outputs) {
			if (!midiState.connectedOutputs.has(id)) continue;
			try { out.send(msg); sent++; } catch (e) { appendMidiLog('Send failed to ' + (out.name||id) + ': ' + e.message); }
		}
		appendMidiLog('SEND ' + tag + (sent ? ` -> ${sent} output(s)` : ' (no armed outputs)'));
	});
	row.appendChild(input); row.appendChild(sendBtn);
	sendPanel.appendChild(row);
	sendPanel.appendChild((() => { const h = document.createElement('div'); h.className = 'midi-help'; h.innerHTML = 'All MIDI is normalized to [[...]] form; PC values are 1–128. Sending goes to armed Web MIDI outputs.'; return h; })());
	right.appendChild(sendPanel);

	const logPanel = document.createElement('div'); logPanel.className = 'midi-panel';
	logPanel.innerHTML = '<h3>Activity Log</h3>';
	const log = document.createElement('div'); log.className = 'midi-log';
	logPanel.appendChild(log);
	right.appendChild(logPanel);

	try {
		body.appendChild(left);
		body.appendChild(right);
	} catch (e) {
		console.error('Failed to append MIDI panels:', e);
		const err = document.createElement('div');
		err.className = 'midi-panel';
		err.textContent = 'Failed to render MIDI panels: ' + (e && e.message ? e.message : String(e));
		body.appendChild(err);
	}
}

function toggleInputConnection(id) {
	const inp = midiState.inputs.get(id);
	if (!inp) return;
	if (midiState.connectedInputs.has(id)) {
		// disconnect
		if (inp.onmidimessage) inp.onmidimessage = null;
		midiState.connectedInputs.delete(id);
		appendMidiLog('Input disconnected: ' + (inp.name || id));
	} else {
		inp.onmidimessage = (ev) => {
			const data = Array.from(ev.data || []);
			appendMidiLog('IN ' + midiMessageToTag(data));
		};
		midiState.connectedInputs.add(id);
		appendMidiLog('Input connected: ' + (inp.name || id));
	}
	renderMidiManagerBody();
	// Persist preference after any change
	saveMidiPrefs();
}

function toggleOutputArmed(id) {
	if (midiState.connectedOutputs.has(id)) {
		midiState.connectedOutputs.delete(id);
	} else {
		midiState.connectedOutputs.add(id);
	}
	const out = midiState.outputs.get(id);
	appendMidiLog('Output ' + (midiState.connectedOutputs.has(id) ? 'enabled' : 'disabled') + ': ' + (out?.name || id));
	renderMidiManagerBody();
	// Persist preference after any change
	saveMidiPrefs();
}
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
		// Skip tracks whose buffer is shorter than the requested offset
		if (offsetSec >= buf.duration) continue;
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
		const off = Math.max(0, Math.min(offsetSec - lead, Math.max(0, buf.duration - 0.005)));
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
				trackOffsetSec: Number(t.offsetSec) || 0,
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
		try { Broadcast.pushSnapshot(false); } catch(_) {}
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
		await ensureSongLoaded(selectedSongId);
		// If there was a fresh seek set, use it once; otherwise resume from current offset
		const useSeek = audioEngine.lastSeekSec;
		const startAt = (useSeek != null) ? useSeek : (audioEngine.offset || 0);
		await buildAndStart(selectedSongId, startAt);
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

async function renderTrackManager(songId) {
	if (!trackManagerBody) return;
	// Preserve scroll position to avoid jumping to top when expanding/collapsing sections
	const prevScrollTop = trackManagerBody.scrollTop || 0;
	trackManagerBody.innerHTML = '';

	const song = songs.find(s => s.id === songId);
	const tracks = await getTracks(songId);

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

		const playBtn = document.createElement('button');
		playBtn.className = 'track-playpause';
		playBtn.textContent = (audioEngine.playing && audioEngine.songId === songId) ? '⏸ Pause' : '▶ Play';
		playBtn.addEventListener('click', async () => {
			if (audioEngine.playing && audioEngine.songId === songId) {
				pausePlayback();
			} else {
				await ensureSongLoaded(songId);
				const startAt = (audioEngine.lastSeekSec != null) ? audioEngine.lastSeekSec : (audioEngine.offset || 0);
				await buildAndStart(songId, startAt);
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
				// Prefer resize if pointer is on a handle
				const hp = handlePositions();
				if (hp) {
					const near = 6;
					if (Math.abs(e.offsetX - hp.left) <= near && e.offsetY >= hp.top && e.offsetY <= hp.bottom) {
						resizeMode = 'left'; resizingRegionIndex = selectionRegionIndex(); return;
					}
					if (Math.abs(e.offsetX - hp.right) <= near && e.offsetY >= hp.top && e.offsetY <= hp.bottom) {
						resizeMode = 'right'; resizingRegionIndex = selectionRegionIndex(); return;
					}
				}
				// Otherwise begin a new drag selection
				isDragging = true; dragMoved = false; dragStartX = e.offsetX; dragEndX = e.offsetX; updateSelection();
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

			window.addEventListener('mouseup', async () => {
				if (resizeMode) {
					// Commit any region change on resize end
					resizeMode = null;
					resizingRegionIndex = -1;
					if (Array.isArray(track.regions)) {
						track.regions = mergeRegions(track.regions.slice());
						await updateTrack(track);
					}
					drawTrackWaveform(track, canvas);
					// Apply edits immediately to currently playing audio
					refreshPlaybackForRegions();
					return;
				}
				if (!isDragging) return;
				const sel = state.selection;
				isDragging = false;
				if (dragMoved && sel && sel.end > sel.start) {
					track.regions = mergeRegions([...(track.regions||[]), sel]);
					await updateTrack(track);
					const chosen = findContainingRegion(track.regions, sel.start, sel.end);
					state.selection = chosen ? { start: chosen.start, end: chosen.end } : sel; // default select
				}
				drawTrackWaveform(track, canvas);
				// Apply new region immediately during playback
				if (dragMoved && sel && sel.end > sel.start) refreshPlaybackForRegions();
			});

			function updateSelection(){
				const sel = pxToTimeRange(track, canvas, Math.min(dragStartX, dragEndX), Math.max(dragStartX, dragEndX));
				state.selection = sel; drawTrackWaveform(track, canvas);
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
	ctx.fillStyle = '#1f2833';
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
		for (let j = a; j < b; j++) { const v = (peaks[j]||0)/255; if (v>vmax) vmax=v; }
		// soft-knee like master
		const k=1.2, scale=0.9*(1+k); let v = (scale*vmax)/(1+k*vmax); v=Math.min(0.95,Math.max(0,v));
		const bh = Math.max(1, Math.floor(v * (h-4)));
		const x = Math.round(i * colWidth + (colWidth - barW)/2);
		const y = Math.floor((h - bh) / 2);
		ctx.fillStyle = '#6c849c';
		ctx.fillRect(x,y,barW,bh);
	}
	// Existing mute regions overlay
	const regions = Array.isArray(track.regions) ? track.regions : [];
	for (const r of regions) {
		if (!r || typeof r.start!=='number' || typeof r.end!=='number' || r.end<=r.start) continue;
		const xs = timeToX(r.start, dur, w, state);
		const xe = timeToX(r.end, dur, w, state);
		const x1 = Math.max(0, Math.min(w, xs)), x2 = Math.max(0, Math.min(w, xe));
		const left = Math.min(x1,x2), right = Math.max(x1,x2);
		ctx.fillStyle = 'rgba(244,67,54,0.18)';
		ctx.fillRect(left, 2, Math.max(1,right-left), h-4);
		ctx.strokeStyle = 'rgba(244,67,54,0.6)';
		ctx.strokeRect(left+0.5, 1.5, Math.max(1,right-left)-1, h-3);
	}
	// Current selection overlay
	const stateSel = state.selection;
	if (stateSel && stateSel.end > stateSel.start) {
		const xs = timeToX(stateSel.start, dur, w, state);
		const xe = timeToX(stateSel.end, dur, w, state);
		const left = Math.min(xs, xe), right = Math.max(xs, xe);
		ctx.fillStyle = 'rgba(76,175,80,0.18)';
		ctx.fillRect(left, 4, Math.max(1,right-left), h-8);
		ctx.strokeStyle = 'rgba(76,175,80,0.6)';
		ctx.strokeRect(left+0.5, 3.5, Math.max(1,right-left)-1, h-7);
		// Draw resize handles
		ctx.fillStyle = 'rgba(76,175,80,0.9)';
		const handleW = 6, handleH = 14;
		const hy = Math.round((h - handleH) / 2);
		ctx.fillRect(Math.round(left - handleW/2), hy, handleW, handleH);
		ctx.fillRect(Math.round(right - handleW/2), hy, handleW, handleH);
	}
	// Simple time ticks
	ctx.save();
	ctx.fillStyle='rgba(200,210,220,0.4)'; ctx.strokeStyle='rgba(200,210,220,0.25)'; ctx.lineWidth=1; ctx.font='10px system-ui'; ctx.textAlign='center'; ctx.textBaseline='alphabetic';
	const approxTick = 10; // seconds
	const pxPerSec = w / dur * state.zoom;
	const tickSec = Math.max(5, Math.round((approxTick / pxPerSec)) * 5);
	for (let t = tickSec; t < dur; t += tickSec) {
		const x = timeToX(t, dur, w, state);
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
	const state = trackWaveState.get(track.id) || { zoom:1, scroll:0 };
	const dur = getTrackDuration(track) || 0;
	const startT = state.scroll * dur * (1 - 1/state.zoom);
	const visDur = dur / state.zoom;
	const a = Math.max(0, Math.min(canvas.clientWidth || canvas.width, x1));
	const b = Math.max(0, Math.min(canvas.clientWidth || canvas.width, x2));
	const ta = startT + (a / (canvas.clientWidth || canvas.width)) * visDur;
	const tb = startT + (b / (canvas.clientWidth || canvas.width)) * visDur;
	return { start: Math.max(0, Math.min(dur, Math.min(ta,tb))), end: Math.max(0, Math.min(dur, Math.max(ta,tb))) };
}
function mergeRegions(regs){
	if (!regs.length) return regs;
	regs.sort((a,b)=>a.start-b.start);
	const out=[regs[0]];
	for (let i=1;i<regs.length;i++){
		const prev = out[out.length-1], cur = regs[i];
		if (cur.start <= prev.end + 0.01) prev.end = Math.max(prev.end, cur.end);
		else out.push(cur);
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
				refreshPlaybackForRegions();
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
		const p0 = Math.max(0, (Number(playheadAtAudibleSec) || 0) + (Number(trackOffsetSec) || 0));
		const bufDur = Math.max(0, Number(bufferDuration) || 0);
		const now = ctx.currentTime;

		// Baseline: start closed at raw start; open at audibleAt unless inside a region.
		// Caller already set 0.0 at startAtRaw.
		const regs = Array.isArray(regions) ? regions.filter(r => r && Number.isFinite(r.start) && Number.isFinite(r.end) && r.end > r.start) : [];

		// Merge/sort defensively in case of overlaps or unsorted input
		const sorted = regs.slice().sort((a,b) => a.start - b.start);

		const inRegion = sorted.find(r => p0 >= r.start && p0 < r.end) || null;
	    if (inRegion) {
		    const relEnd = Math.max(0, Math.min(bufDur, inRegion.end) - p0); // seconds after audibleAt
		    gate.gain.setValueAtTime(0.0, Math.max(startAtRaw, now));
		    gate.gain.setValueAtTime(0.0, audibleAt);
		    gate.gain.setValueAtTime(1.0, audibleAt + relEnd);
			if (window && window.STP_DEBUG_MUTES) {
				console.debug('[MUTE:start-inside]', { trackId, p0, region: inRegion, relEnd, audibleAt, startAtRaw });
			}
		} else {
			// Open exactly at audibleAt if not in a region (hard on)
			gate.gain.setValueAtTime(1.0, audibleAt);
		}

		// Intersect each region with the play window [p0, p0 + bufDur]
		const winStart = p0;
		const winEnd = p0 + bufDur;
		for (const r of sorted) {
			const s = Math.max(r.start, winStart);
			const e = Math.min(r.end, winEnd);
			if (e <= s) continue;
			// If region begins exactly at p0 and we already handled start-inside, skip to avoid conflicting ramps
			if (inRegion && s === p0) continue;
			const relS = s - p0; // >= 0
			const relE = e - p0; // >= relS
			const onT = audibleAt + relS;
			const offT = audibleAt + relE;
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