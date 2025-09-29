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
