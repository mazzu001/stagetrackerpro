// broadcast.js
// Handles broadcast host/viewer modals, status chip, and sync logic

// --- Modal HTML injection ---
function injectBroadcastModals() {
  console.log('[BCAST] Injecting broadcast modals');
  
  // First, remove any existing modals to prevent duplicates
  try {
    const existingHost = document.getElementById('broadcastHostModal');
    if (existingHost && existingHost.parentElement) {
      existingHost.parentElement.removeChild(existingHost);
      console.log('[BCAST] Removed existing host modal');
    }
    
    const existingViewer = document.getElementById('broadcastViewerModal');
    if (existingViewer && existingViewer.parentElement) {
      existingViewer.parentElement.removeChild(existingViewer);
      console.log('[BCAST] Removed existing viewer modal');
    }
  } catch(e) {
    console.warn('[BCAST] Error cleaning up existing modals:', e);
  }
  
  // Create host modal with all safety attributes set
  const hostModal = document.createElement('div');
  hostModal.id = 'broadcastHostModal';
  hostModal.className = 'modal-overlay hidden';
  hostModal.style.position = 'fixed';
  hostModal.style.top = '0';
  hostModal.style.left = '0';
  hostModal.style.width = '100vw';
  hostModal.style.height = '100vh';
  hostModal.style.background = 'rgba(20,24,32,0.85)';
  hostModal.style.zIndex = '1000';
  hostModal.style.display = 'none'; // ensure not blocking initially
  hostModal.style.alignItems = 'center';
  hostModal.style.justifyContent = 'center';
  hostModal.style.pointerEvents = 'none'; // initially prevent clicks
  hostModal.style.visibility = 'hidden'; // extra safety
  hostModal.innerHTML = `
    <div class="modal-content" style="background:#23262b;padding:32px 28px;border-radius:16px;max-width:400px;width:96vw;box-shadow:0 8px 32px #0008;">
      <h2>Start Broadcasting</h2>
      <input id="broadcastNameInput" placeholder="Broadcast Name" style="width:100%;margin-bottom:14px;">
      <button id="startBroadcastBtn" class="btn primary block">Start Broadcasting</button>
      <button class="modal-close btn alt" style="margin-top:10px;">×</button>
    </div>
  `;
  document.body.appendChild(hostModal);

  const viewerModal = document.createElement('div');
  viewerModal.id = 'broadcastViewerModal';
  viewerModal.className = 'modal-overlay hidden';
  viewerModal.style.position = 'fixed';
  viewerModal.style.top = '0';
  viewerModal.style.left = '0';
  viewerModal.style.width = '100vw';
  viewerModal.style.height = '100vh';
  viewerModal.style.background = 'rgba(20,24,32,0.92)';
  viewerModal.style.zIndex = '1001';
  viewerModal.style.display = 'none'; // ensure not blocking initially
  viewerModal.style.alignItems = 'center';
  viewerModal.style.justifyContent = 'center';
  viewerModal.style.pointerEvents = 'none';
  viewerModal.innerHTML = `
    <div class="modal-content broadcast-viewer" style="background:#23262b;padding:38px 34px;border-radius:18px;max-width:800px;width:98vw;box-shadow:0 12px 40px #000a;display:flex;flex-direction:column;align-items:center;">
      <h2 id="viewerSongTitle" style="font-size:2rem;margin-bottom:18px;text-align:center;"></h2>
      <div id="viewerLyrics" style="margin:18px 0 24px 0;width:100%;font-size:1.3rem;line-height:1.6;"></div>
      <div id="viewerPlayPosition" style="margin-bottom:18px;color:#b0b8c0;font-size:1.1rem;"></div>
      <button class="modal-close btn alt" style="margin-top:10px;align-self:center;font-size:1.5rem;">×</button>
    </div>
  `;
  document.body.appendChild(viewerModal);
  // Bind events for host modal controls
  bindHostModalButtons();
}

// --- Modal open/close logic ---
export function openBroadcastHostModal() {
  console.log('[BCAST] Using simplified broadcast approach - no modals');
  
  // Directly prompt for room name instead of using a modal
  const roomName = prompt("Enter broadcast name:", "");
  if (roomName && roomName.trim()) {
    // Start broadcast immediately with the entered name
    startBroadcast(roomName.trim());
  }
}
export function closeBroadcastHostModal() {
  const el = document.getElementById('broadcastHostModal');
  if (!el) return;
  
  console.log('[BCAST] Closing and removing host modal');
  
  // First add hidden classes and disable pointer events
  try { el.classList.add('hidden'); } catch(_) {}
  try { el.style.display = 'none'; } catch(_) {}
  try { el.style.pointerEvents = 'none'; } catch(_) {}
  try { el.style.visibility = 'hidden'; } catch(_) {}
  try { el.style.opacity = '0'; } catch(_) {}
  try { el.style.zIndex = '-100'; } catch(_) {}
  
  // Then completely remove from DOM to absolutely prevent any stray overlay from blocking UI
  try { 
    if (el.parentElement) {
      el.parentElement.removeChild(el);
      console.log('[BCAST] Successfully removed host modal from DOM');
    }
  } catch(e) {
    console.warn('[BCAST] Failed to remove host modal from DOM:', e);
  }
  
  // Force re-creation on next open to ensure clean state
  try {
    const allModals = document.querySelectorAll('#broadcastHostModal');
    if (allModals.length > 0) {
      console.log('[BCAST] Found additional host modals, removing all:', allModals.length);
      allModals.forEach(modal => {
        try { 
          if (modal.parentElement) modal.parentElement.removeChild(modal);
        } catch(_) {}
      });
    }
  } catch(_) {}
}
export function openBroadcastViewerModal() {
  // Deprecated: use dedicated viewer page
  try { window.open('/viewer', '_blank'); } catch(_) {}
}
export function closeBroadcastViewerModal() {
  const el = document.getElementById('broadcastViewerModal');
  if (!el) return;
  el.classList.add('hidden');
  el.style.display = 'none';
  el.style.pointerEvents = 'none';
}

// --- Broadcast status chip logic ---
export function setBroadcastStatus(isOn, name) {
  const chip = document.getElementById('broadcastStatus');
  if (!chip) return;
  chip.classList.toggle('on', isOn);
  chip.innerHTML = `<span class="dot"></span> Broadcast${isOn && name ? ' [' + name + ']' : ''}`;
}

// --- Event listeners for modal close buttons ---
function setupModalCloseListeners() {
  document.body.addEventListener('click', function(e) {
    if (e.target.classList.contains('modal-close')) {
      closeBroadcastHostModal();
      closeBroadcastViewerModal();
    }
  });
}

// --- Broadcast host logic ---
function forceReleaseUI() {
  console.log('[BCAST] Forcing UI release');

  // First, remove all known modal IDs
  const ids = ['dashboardModal', 'broadcastHostModal', 'broadcastViewerModal', 'addSongModal', 'deleteSongModal', 'trackManagerModal'];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    console.log('[BCAST] Hiding modal by ID:', id);
    try { el.classList.add('hidden'); } catch(_) {}
    try { el.style.display = 'none'; } catch(_) {}
    try { el.style.pointerEvents = 'none'; } catch(_) {}
    try { 
      if (el.parentElement) el.parentElement.removeChild(el); 
      console.log('[BCAST] Removed from DOM:', id);
    } catch(e) { 
      console.warn('[BCAST] Could not remove from DOM:', id, e);
    }
  });
  
  // Then, find any overlay or modal classes and remove them
  try {
    const candidates = Array.from(document.querySelectorAll('.modal, .modal-overlay, .modal-content, .modal-backdrop, [role="dialog"]'));
    console.log('[BCAST] Found', candidates.length, 'potential overlay elements by class');
    candidates.forEach((el, i) => {
      try { 
        el.classList.add('hidden'); 
        el.style.display = 'none'; 
        el.style.pointerEvents = 'none';
        el.style.zIndex = '-10';
        if (el.parentElement) {
          try { el.parentElement.removeChild(el); } catch(_) {}
        }
      } catch(_) {}
    });
  } catch(e) {
    console.warn('[BCAST] Error hiding overlay classes:', e);
  }
  
  // Finally, check for backdrop or modal-backdrop elements
  try {
    const backdrops = Array.from(document.querySelectorAll('.backdrop, .modal-backdrop, .overlay, .overlay-backdrop'));
    backdrops.forEach(el => {
      try { el.style.display = 'none'; el.style.opacity = '0'; el.style.pointerEvents = 'none'; } catch(_) {}
      try { if (el.parentElement) el.parentElement.removeChild(el); } catch(_) {}
    });
  } catch(_) {}
  
  // Clear out any body modal classes
  try {
    document.body.classList.remove('modal-open', 'has-modal', 'overlay-open');
  } catch(_) {}
}

function verifyNoBlockingOverlay() {
  try {
    console.log('[BCAST] Verifying no blocking overlays');
    
    // Check multiple points on the screen to be thorough
    const checkPoints = [
      {x: Math.floor(window.innerWidth / 2), y: Math.floor(window.innerHeight / 2)}, // center
      {x: 50, y: 50}, // top-left
      {x: window.innerWidth - 50, y: 50}, // top-right
      {x: 50, y: window.innerHeight - 50}, // bottom-left
      {x: window.innerWidth - 50, y: window.innerHeight - 50} // bottom-right
    ];
    
    for (const point of checkPoints) {
      const topEl = document.elementFromPoint(point.x, point.y);
      if (!topEl) continue;
      
      const id = topEl.id || '';
      const cls = topEl.className || '';
      
      // Check if this is a modal/overlay element by ID or class
      const isOverlay = id === 'broadcastHostModal' || 
                        id === 'broadcastViewerModal' || 
                        id === 'dashboardModal' ||
                        id === 'addSongModal' ||
                        id === 'deleteSongModal' ||
                        id === 'trackManagerModal' ||
                        (typeof cls === 'string' && (
                           cls.includes('modal') || 
                           cls.includes('overlay') || 
                           cls.includes('backdrop')
                        ));
      
      if (isOverlay) {
        console.log('[BCAST] Found blocking overlay at', point, topEl);
        
        // Find the nearest ancestor that's a modal (in case we got an inner element)
        const ancestor = topEl.closest ? 
          topEl.closest('#dashboardModal, #broadcastHostModal, #broadcastViewerModal, .modal, .modal-overlay, .modal-content, .modal-backdrop, [role="dialog"]') : 
          null;
        
        const target = ancestor || topEl;
        console.log('[BCAST] Removing blocking element:', target.id || target.className);
        
        try { target.classList.add('hidden'); } catch(_) {}
        try { target.style.display = 'none'; } catch(_) {}
        try { target.style.pointerEvents = 'none'; } catch(_) {}
        try { target.style.zIndex = '-10'; } catch(_) {}
        
        // Try to completely remove from DOM
        try {
          if (target.parentElement) {
            target.parentElement.removeChild(target);
            console.log('[BCAST] Successfully removed from DOM');
          }
        } catch(e) {
          console.warn('[BCAST] Could not remove from DOM:', e);
        }
        
        continue;
      }
      
      // Check for full-viewport fixed/absolute elements that might be overlays
      const rect = topEl.getBoundingClientRect ? topEl.getBoundingClientRect() : null;
      if (!rect) continue;
      
      const style = window.getComputedStyle ? window.getComputedStyle(topEl) : null;
      if (!style) continue;
      
      const isFull = rect.width >= window.innerWidth - 20 && rect.height >= window.innerHeight - 20;
      const isFixed = style.position === 'fixed' || style.position === 'absolute' || style.position === 'sticky';
      const isHighZIndex = parseInt(style.zIndex || '0', 10) > 10;
      
      if ((isFull && isFixed) || (isFixed && isHighZIndex)) {
        console.log('[BCAST] Found full-viewport blocking element:', topEl);
        
        const ancestor = topEl.closest ? 
          topEl.closest('#dashboardModal, #broadcastHostModal, #broadcastViewerModal, .modal, .modal-overlay, [role="dialog"]') : 
          null;
        
        const target = ancestor || topEl;
        
        try { target.classList.add('hidden'); } catch(_) {}
        try { target.style.display = 'none'; } catch(_) {}
        try { target.style.pointerEvents = 'none'; } catch(_) {}
        try { target.style.zIndex = '-10'; } catch(_) {}
        
        // Try to completely remove from DOM
        try {
          if (target.parentElement) {
            target.parentElement.removeChild(target);
            console.log('[BCAST] Removed full-viewport element from DOM');
          }
        } catch(e) {
          console.warn('[BCAST] Could not remove full-viewport element:', e);
        }
      }
    }
  } catch(e) {
    console.warn('[BCAST] Error in verifyNoBlockingOverlay:', e);
  }
}

export function startBroadcast(name) {
  // We're taking a completely different approach: no modals at all
  // Instead, we'll open a new tab/window with the dedicated viewer page
  
  const room = String(name || '').trim();
  if (!room) { alert('Enter a broadcast name'); return; }
  
  console.log('[BCAST] Starting broadcast with new approach - NO MODALS');
  
  // Hard-coded safety check to prevent duplicate start attempts
  if (window._broadcastStartInProgress) {
    console.log('[BCAST] Ignoring duplicate start attempt');
    return;
  }
  window._broadcastStartInProgress = true;
  setTimeout(() => { window._broadcastStartInProgress = false; }, 1000);
  
  // Avoid duplicate starts of the same broadcast
  if (window.STP_Broadcast && window.STP_Broadcast._room === room && window.STP_Broadcast._started) {
    console.log('[BCAST] Broadcast already active with same room name');
    setBroadcastStatus(true, room);
    try { window.updateBroadcastStatusChip?.(); } catch(_) {}
    return;
  }
  
  // BYPASS ALL MODALS - We're changing the approach completely
  // Just directly start the broadcast with no overlays
  
  // Prefer the host implemented in app.js so it can push real-time snapshots
  if (window.STP_Broadcast && typeof window.STP_Broadcast.start === 'function') {
    try {
      window.STP_Broadcast.start(room);
      // Mark internal flags for duplicate guard
      window.STP_Broadcast._room = room; 
      window.STP_Broadcast._started = true;
      console.log('[BCAST] Started successfully via STP_Broadcast');
    } catch (e) {
      console.warn('[BCAST] STP_Broadcast.start failed:', e);
    }
  } else if (window.io) {
    // Fallback: minimal host join so viewers can at least see name; no snapshots without app.js
    try { 
      const s = window.io(); 
      s.emit('host:join', { room, hostName: 'Host' }); 
      console.log('[BCAST] Started via Socket.IO fallback');
    } catch(e) {
      console.warn('[BCAST] Socket.IO fallback failed:', e);
    }
  }
  
  setBroadcastStatus(true, room);
  try { window.updateBroadcastStatusChip?.(); } catch(_) {}
  
  // Skip all modal operations entirely - no more openBroadcastHostModal or closeBroadcastHostModal

  // Show a console message instead of an alert
  console.log(`Broadcasting started: ${room}\nViewers can join at: ${window.location.origin}/viewer?room=${encodeURIComponent(room)}`);
}

// Bind Start button inside injected modal
function bindHostModalButtons() {
  const btn = document.getElementById('startBroadcastBtn');
  const input = document.getElementById('broadcastNameInput');
  if (btn && !btn._stpBound) {
    btn._stpBound = true;
    btn.addEventListener('click', () => startBroadcast(input ? input.value : ''));
  }
}

// --- Broadcast viewer logic ---
export function joinBroadcast(name) {
  // Launch the dedicated viewer page with room param
  const room = String(name||'').trim();
  if (!room) { alert('Enter a broadcast name'); return; }
  
  console.log('[BCAST] Opening dedicated viewer page for room:', room);
  
  // Always open in a new tab/window to avoid any potential UI freezing in the current page
  try { 
    const url = `/viewer?room=${encodeURIComponent(room)}`;
    const viewerWindow = window.open(url, '_blank');
    
    // Alert if popup was blocked
    if (!viewerWindow || viewerWindow.closed || typeof viewerWindow.closed === 'undefined') {
      alert(`Popup blocked! Please allow popups for this site and try again.\n\nAlternatively, you can manually navigate to:\n${window.location.origin}${url}`);
    }
  } catch(e) { 
    // Fallback - navigate current page if window.open fails
    console.error('[BCAST] Failed to open viewer in new tab:', e);
    location.href = `/viewer?room=${encodeURIComponent(room)}`; 
  }
}

function formatTime(sec){ sec = Math.max(0, sec||0); const m = Math.floor(sec/60); const s = Math.floor(sec%60); return `${m}:${s.toString().padStart(2,'0')}`; }

// --- Viewer sync update ---
export function updateViewer(songTitle, lyricsHtml, playPosition, highlightIndex) {
  document.getElementById('viewerSongTitle').textContent = songTitle || '';
  document.getElementById('viewerLyrics').innerHTML = lyricsHtml || '';
  document.getElementById('viewerPlayPosition').textContent = playPosition || '';
  // TODO: Highlight lyrics line by index
}

// --- Initialization ---
export function initBroadcastUI() {
  injectBroadcastModals();
  setupModalCloseListeners();
  
  // Set up the broadcast status chip as a clickable toggle
  const broadcastStatusChip = document.getElementById('broadcastStatus');
  if (broadcastStatusChip) {
    broadcastStatusChip.style.cursor = 'pointer';
    broadcastStatusChip.setAttribute('title', 'Click to start/stop broadcasting');
    
    broadcastStatusChip.addEventListener('click', () => {
      // Check if we're currently broadcasting
      const isActive = !!(window.STP_Broadcast && window.STP_Broadcast._started);
      
      if (isActive) {
        // If broadcasting is active, stop it
        if (window.STP_Broadcast && typeof window.STP_Broadcast.stop === 'function') {
          window.STP_Broadcast.stop();
          console.log('[BCAST] Broadcasting stopped via status chip');
        }
      } else {
        // If not broadcasting, prompt for room name and start
        const room = prompt('Enter broadcast name:');
        if (room && room.trim()) {
          startBroadcast(room.trim());
        }
      }
    });
  }
  
  // ESC should close viewer modal if open
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      try { closeBroadcastViewerModal(); } catch(_) {}
      // Also close dashboard modal defensively
      try {
        const dash = document.getElementById('dashboardModal');
        if (dash) { dash.classList.add('hidden'); dash.style.display = 'none'; dash.style.pointerEvents = 'none'; }
      } catch(_) {}
    }
  });
}

// Expose broadcast functions globally for inline scripts and event handlers
window.joinBroadcast = joinBroadcast;
window.startBroadcast = startBroadcast;
window.openBroadcastHostModal = openBroadcastHostModal;
window.openBroadcastViewerModal = openBroadcastViewerModal;
window.setBroadcastStatus = setBroadcastStatus;

// Auto-init on load
initBroadcastUI();
