// Dashboard/MIDI Manager module: owns Web MIDI lifecycle, UI, and persistence
import { openBroadcastHostModal, startBroadcast, joinBroadcast } from './broadcast.js';

const MIDI_PREFS_KEY = 'stpro.midi.prefs.v1';

const midiState = {
  access: null,
  initPromise: null,
  inputs: new Map(),
  outputs: new Map(),
  connectedInputs: new Set(),
  connectedOutputs: new Set(),
  logLimit: 400,
};

function byId(id) { return document.getElementById(id); }

function appendMidiLog(msg) {
  const body = byId('midiManagerBody');
  if (!body) return;
  const log = body.querySelector('.midi-log');
  if (!log) return;
  const line = document.createElement('div');
  line.textContent = msg;
  log.appendChild(line);
  while (log.children.length > midiState.logLimit) {
    log.removeChild(log.firstChild);
  }
  log.scrollTop = log.scrollHeight;
}

async function getMidiPermissionStatus() {
  try {
    if (!navigator.permissions || !navigator.permissions.query) return 'unknown';
    const perm = await navigator.permissions.query({ name: 'midi', sysex: false });
    return perm?.state || 'unknown';
  } catch (_) {
    return 'unknown';
  }
}

function loadMidiPrefs() {
  try {
    const store = window.sessionStorage || window.localStorage;
    const raw = store.getItem(MIDI_PREFS_KEY);
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
    const store = window.sessionStorage || window.localStorage;
    store.setItem(MIDI_PREFS_KEY, JSON.stringify({ inputs, outputs }));
  } catch (_) { /* ignore */ }
}

function autoReconnectFromPrefs() {
  const prefs = loadMidiPrefs();
  let autoIn = 0, autoOut = 0;
  for (const pref of prefs.inputs || []) {
    let id = pref?.id;
    if (id && midiState.inputs.has(id)) {
      if (!midiState.connectedInputs.has(id)) { toggleInputConnection(id); autoIn++; }
      continue;
    }
    const byName = pref?.name ? Array.from(midiState.inputs.values()).find(d => (d?.name||'') === pref.name) : null;
    if (byName && !midiState.connectedInputs.has(byName.id)) { toggleInputConnection(byName.id); autoIn++; }
  }
  for (const pref of prefs.outputs || []) {
    let id = pref?.id;
    if (id && midiState.outputs.has(id)) {
      if (!midiState.connectedOutputs.has(id)) { toggleOutputArmed(id); autoOut++; }
      continue;
    }
    const byName = pref?.name ? Array.from(midiState.outputs.values()).find(d => (d?.name||'') === pref.name) : null;
    if (byName && !midiState.connectedOutputs.has(byName.id)) { toggleOutputArmed(byName.id); autoOut++; }
  }
  if (autoIn || autoOut) appendMidiLog(`Auto-reconnected ${autoIn} input(s) and ${autoOut} output(s)`);
}

// MIDI tag helpers (for log/send)
function midiMessageToTag([status, d1, d2]) {
  const type = status & 0xF0;
  const ch = (status & 0x0F) + 1;
  switch (type) {
    case 0xC0: return `[[PC:${(d1 ?? 0)+1}:${ch}]]`;
    case 0xB0: return `[[CC:${ch}:${d1 ?? 0}:${d2 ?? 0}]]`;
    case 0x90: return `[[NOTE_ON:${ch}:${d1 ?? 0}:${d2 ?? 0}]]`;
    case 0x80: return `[[NOTE_OFF:${ch}:${d1 ?? 0}:${d2 ?? 0}]]`;
    case 0xE0: { const value = (((d2 ?? 0) << 7) | (d1 ?? 0)) - 8192; return `[[PB:${ch}:${value}]]`; }
    case 0xD0: return `[[CP:${ch}:${d1 ?? 0}]]`;
    case 0xA0: return `[[POLY_PRESS:${ch}:${d1 ?? 0}:${d2 ?? 0}]]`;
    default: return `[[SYS:${status}:${d1 ?? ''}:${d2 ?? ''}]]`;
  }
}
function tagToMidiMessage(tag) {
  const m = String(tag || '').trim().match(/^\[\[(.+?)\]\]$/);
  if (!m) return null;
  const parts = m[1].split(':');
  const kind = (parts[0]||'').toUpperCase();
  const num = (i, def=0) => Math.max(0, parseInt(parts[i] ?? def, 10) || def);
  const ch = Math.max(1, Math.min(16, num(1,1)));
  const ch0 = ch - 1;
  switch (kind) {
    case 'PC': { const prog1 = num(1,1); const pcCh = Math.max(1, Math.min(16, num(2,1))); const pcCh0 = pcCh - 1; const prog0 = Math.max(0, Math.min(127, prog1 - 1)); return [0xC0 | pcCh0, prog0]; }
    case 'CC': { const cc = num(2,0); const val = num(3,0); return [0xB0 | ch0, Math.min(127, cc), Math.min(127, val)]; }
    case 'NOTE_ON': { const note = num(2,60); const vel = num(3,100); return [0x90 | ch0, Math.min(127,note), Math.min(127,vel)]; }
    case 'NOTE_OFF': { const note = num(2,60); const vel = num(3,0); return [0x80 | ch0, Math.min(127,note), Math.min(127,vel)]; }
    case 'PB': { let value = parseInt(parts[2] ?? '0', 10); if (!Number.isFinite(value)) value = 0; value = Math.max(-8192, Math.min(8191, value)); const v14 = value + 8192; const lsb = v14 & 0x7F; const msb = (v14 >> 7) & 0x7F; return [0xE0 | ch0, lsb, msb]; }
    case 'CP': { const pres = num(2,0); return [0xD0 | ch0, Math.min(127,pres)]; }
    case 'POLY_PRESS': { const note = num(2,60); const pres = num(3,0); return [0xA0 | ch0, Math.min(127,note), Math.min(127,pres)]; }
    default: return null;
  }
}

async function ensureMidiAccess({ force } = {}) {
  if (force) { midiState.access = null; midiState.initPromise = null; }
  if (midiState.access) return midiState.access;
  if (midiState.initPromise) return midiState.initPromise;
  if (!navigator.requestMIDIAccess) { appendMidiLog('Web MIDI not supported in this browser.'); return null; }
  try {
    const req = navigator.requestMIDIAccess({ sysex: false });
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('MIDI access timed out')), 3000));
    midiState.initPromise = Promise.race([req, timeout])
      .then((acc) => { midiState.access = acc; return acc; })
      .finally(() => { midiState.initPromise = null; });
    const access = await midiState.initPromise;
    const rebuild = () => { rebuildMidiLists(); try { autoReconnectFromPrefs(); } catch(_){} try { window.updateMidiStatusChip?.(); } catch(_){} };
    access.onstatechange = rebuild;
    rebuildMidiLists();
    setTimeout(() => { try { autoReconnectFromPrefs(); } catch(_){} }, 0);
    setTimeout(() => { try { window.updateMidiStatusChip?.(); } catch(_){} }, 0);
    return access;
  } catch (e) { appendMidiLog('Failed to get MIDI access: ' + e.message); midiState.initPromise = null; return null; }
}

function rebuildMidiLists() {
  if (!midiState.access) return;
  midiState.inputs.clear();
  midiState.outputs.clear();
  for (const inp of midiState.access.inputs.values()) midiState.inputs.set(inp.id, inp);
  for (const out of midiState.access.outputs.values()) midiState.outputs.set(out.id, out);
  for (const id of Array.from(midiState.connectedInputs)) { if (!midiState.inputs.has(id)) midiState.connectedInputs.delete(id); }
  for (const id of Array.from(midiState.connectedOutputs)) { if (!midiState.outputs.has(id)) midiState.connectedOutputs.delete(id); }
  renderMidiManagerBody();
  try { window.updateMidiStatusChip?.(); } catch(_) {}
}

function renderMidiHeader() {
  const hdr = byId('midiManagerHeader'); if (!hdr) return;
  hdr.innerHTML = '';
  const scanBtn = document.createElement('button');
  scanBtn.className = 'btn small';
  scanBtn.textContent = 'Scan (2s)';
  scanBtn.title = 'Initialize MIDI and refresh devices (runs for 2 seconds)';
  scanBtn.addEventListener('click', () => { scanMidiDevices(); });
  hdr.appendChild(scanBtn);
}

async function scanMidiDevices({ durationMs } = {}) {
  const hadAccess = !!midiState.access;
  const beforeIn = midiState.inputs.size;
  const beforeOut = midiState.outputs.size;
  const hdr = byId('midiManagerHeader');
  let stopTimer = 0, pollTimer = 0;
  const btn = hdr ? hdr.querySelector('button.btn.small') : null;
  if (btn) { btn.disabled = true; btn.textContent = 'Scanning…'; }
  const perm = await getMidiPermissionStatus();
  appendMidiLog(`Starting 2s scan… (permission: ${perm})`);
  const access = await ensureMidiAccess({ force: true });
  if (!access) {
    appendMidiLog('Scan aborted: MIDI access unavailable.');
    if (btn) { btn.disabled = false; btn.textContent = 'Scan (2s)'; }
    renderMidiManagerBody();
    return;
  }
  rebuildMidiLists();
  try {
    const ins = Array.from(access.inputs?.values?.() || []);
    const outs = Array.from(access.outputs?.values?.() || []);
    if (ins.length || outs.length) {
      appendMidiLog(`Native inputs: ${ins.map(p=>p.name||p.id).join(', ') || '—'}`);
      appendMidiLog(`Native outputs: ${outs.map(p=>p.name||p.id).join(', ') || '—'}`);
    }
  } catch (_) {}
  const onState = () => { rebuildMidiLists(); };
  access.addEventListener('statechange', onState);
  let lastIn = midiState.inputs.size;
  let lastOut = midiState.outputs.size;
  const dur = Math.max(1000, Math.min(10000, Number(durationMs) || 2000));
  pollTimer = setInterval(() => {
    rebuildMidiLists();
    const curIn = midiState.inputs.size;
    const curOut = midiState.outputs.size;
    if (curIn !== lastIn || curOut !== lastOut) {
      appendMidiLog(`Detected change: Inputs ${curIn}, Outputs ${curOut}`);
      lastIn = curIn; lastOut = curOut;
    }
  }, 400);
  stopTimer = setTimeout(() => {
    try { access.removeEventListener('statechange', onState); } catch(_) {}
    if (pollTimer) { clearInterval(pollTimer); pollTimer = 0; }
    const afterIn = midiState.inputs.size;
    const afterOut = midiState.outputs.size;
    const deltaIn = afterIn - beforeIn;
    const deltaOut = afterOut - beforeOut;
    const deltaStr = `Δ Inputs ${deltaIn >= 0 ? '+'+deltaIn : deltaIn}, Outputs ${deltaOut >= 0 ? '+'+deltaOut : deltaOut}`;
    appendMidiLog(`Scan complete${hadAccess ? '' : ' (initialized)'}: Inputs ${afterIn}, Outputs ${afterOut} (${deltaStr})`);
    if (btn) { btn.disabled = false; btn.textContent = 'Scan (2s)'; }
    if (afterIn === 0 && afterOut === 0) {
      setTimeout(() => { appendMidiLog('Retrying enumeration (quick)…'); rebuildMidiLists(); }, 350);
    }
  }, dur);
}

function renderMidiManagerBody() {
  const body = byId('midiManagerBody'); if (!body) return;
  body.innerHTML = '';

  const left = document.createElement('div'); left.className = 'midi-col-left';
  const inPanel = document.createElement('div'); inPanel.className = 'midi-panel'; inPanel.innerHTML = '<h3>MIDI Inputs</h3>';
  const inList = document.createElement('div'); inList.className = 'midi-list';
  if (midiState.inputs.size === 0) {
    const none = document.createElement('div'); none.textContent = 'No input devices found.'; none.style.color = '#9aa7b3'; inList.appendChild(none);
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
  inPanel.appendChild(inList); left.appendChild(inPanel);

  const outPanel = document.createElement('div'); outPanel.className = 'midi-panel'; outPanel.innerHTML = '<h3>MIDI Outputs</h3>';
  const outList = document.createElement('div'); outList.className = 'midi-list';
  if (midiState.outputs.size === 0) {
    const none = document.createElement('div'); none.textContent = 'No output devices found.'; none.style.color = '#9aa7b3'; outList.appendChild(none);
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
  outPanel.appendChild(outList); left.appendChild(outPanel);

  const right = document.createElement('div'); right.className = 'midi-col-right';
  const sendPanel = document.createElement('div'); sendPanel.className = 'midi-panel'; sendPanel.innerHTML = '<h3>Send Test Command</h3>';
  const row = document.createElement('div'); row.className = 'midi-row';
  const input = document.createElement('input'); input.type = 'text'; input.placeholder = 'e.g. [[PC:10:1]] (value:channel) or [[CC:1:7:100]] or [[NOTE_ON:1:60:100]]';
  const sendBtn = document.createElement('button'); sendBtn.className = 'btn'; sendBtn.textContent = 'Send';
  sendBtn.addEventListener('click', () => {
    const tag = input.value.trim(); if (!tag) return; const msg = tagToMidiMessage(tag);
    if (!msg) { appendMidiLog('Invalid tag: ' + tag); return; }
    let sent = 0; for (const [id, out] of midiState.outputs) { if (!midiState.connectedOutputs.has(id)) continue; try { out.send(msg); sent++; } catch (e) { appendMidiLog('Send failed to ' + (out.name||id) + ': ' + e.message); } }
    appendMidiLog('SEND ' + tag + (sent ? ` -> ${sent} output(s)` : ' (no armed outputs)'));
  });
  row.appendChild(input); row.appendChild(sendBtn); sendPanel.appendChild(row);
  sendPanel.appendChild((() => { const h = document.createElement('div'); h.className = 'midi-help'; h.innerHTML = 'All MIDI is normalized to [[...]] form; PC values are 1–128. Sending goes to armed Web MIDI outputs.'; return h; })());
  right.appendChild(sendPanel);

  const logPanel = document.createElement('div'); logPanel.className = 'midi-panel'; logPanel.innerHTML = '<h3>Activity Log</h3>';
  const log = document.createElement('div'); log.className = 'midi-log'; logPanel.appendChild(log); right.appendChild(logPanel);

  try { body.appendChild(left); body.appendChild(right); } catch (e) {
    console.error('Failed to append MIDI panels:', e);
    const err = document.createElement('div'); err.className = 'midi-panel'; err.textContent = 'Failed to render MIDI panels: ' + (e && e.message ? e.message : String(e)); body.appendChild(err);
  }

  if (midiState.inputs.size === 0 && midiState.outputs.size === 0) {
    (async () => {
      const tip = document.createElement('div'); tip.className = 'midi-panel'; tip.style.marginTop = '12px';
      const perm = await getMidiPermissionStatus(); const permLine = `Permission: ${perm}`;
      tip.innerHTML = `
        <h3>No MIDI devices detected</h3>
        <div style="color:#9aa7b3;line-height:1.4">
          • This scan lists OS MIDI devices exposed to the browser (USB, Bluetooth, and virtual).<br>
          • For Bluetooth (e.g., CME WIDI): pair the device in Windows Settings first (Bluetooth & devices → Add device → Bluetooth), ensure it's connected and not in use by another app, then click Scan (2s).<br>
          • Make sure the browser allows MIDI access for this site. ${permLine}. You can adjust it in Site settings if needed.<br>
          • If the device just connected, wait a moment and Scan again.
        </div>`;
      body.appendChild(tip);
    })();
  }
}

function toggleInputConnection(id) {
  const inp = midiState.inputs.get(id);
  if (!inp) return;
  if (midiState.connectedInputs.has(id)) {
    if (inp.onmidimessage) inp.onmidimessage = null;
    midiState.connectedInputs.delete(id);
    appendMidiLog('Input disconnected: ' + (inp.name || id));
  } else {
    inp.onmidimessage = (ev) => { 
      const data = Array.from(ev.data || []); 
      appendMidiLog('IN ' + midiMessageToTag(data)); 
      // Flash MIDI indicator when receiving messages
      if (typeof window.flashMidiIndicator === 'function') {
        window.flashMidiIndicator();
      }
    };
    midiState.connectedInputs.add(id);
    appendMidiLog('Input connected: ' + (inp.name || id));
  }
  renderMidiManagerBody(); saveMidiPrefs(); try { window.updateMidiStatusChip?.(); } catch(_) {}
}

function toggleOutputArmed(id) {
  if (midiState.connectedOutputs.has(id)) midiState.connectedOutputs.delete(id); else midiState.connectedOutputs.add(id);
  const out = midiState.outputs.get(id);
  appendMidiLog('Output ' + (midiState.connectedOutputs.has(id) ? 'enabled' : 'disabled') + ': ' + (out?.name || id));
  renderMidiManagerBody(); saveMidiPrefs(); try { window.updateMidiStatusChip?.(); } catch(_) {}
}

function openMidiManager() {
  const modal = byId('midiManagerModal'); if (!modal) return;
  modal.classList.remove('hidden'); modal.style.display = 'flex';
  renderMidiHeader(); renderMidiManagerBody();
}
function closeMidiManager() { const modal = byId('midiManagerModal'); if (!modal) return; modal.classList.add('hidden'); modal.style.display = 'none'; }

function attachMidiManager() {
  window.openMidiManager = openMidiManager;
  const closeMidiBtn = byId('closeMidiManager'); if (closeMidiBtn) closeMidiBtn.addEventListener('click', closeMidiManager);
  window.STP_MIDI = {
    getConnectedCounts: () => ({ inputs: midiState.connectedInputs.size, outputs: midiState.connectedOutputs.size }),
    openManager: openMidiManager,
    ensureAccess: (opts) => ensureMidiAccess(opts),
    scan: (opts) => scanMidiDevices(opts),
    sendMessage: (msg, tag) => {
      if (!msg || !Array.isArray(msg)) return 0;
      let sent = 0;
      for (const [id, out] of midiState.outputs) {
        if (!midiState.connectedOutputs.has(id)) continue;
        try {
          out.send(msg);
          sent++;
        } catch (e) {
          console.warn('Send failed to ' + (out.name||id) + ': ' + e.message);
        }
      }
      // Flash the MIDI indicator when sending a message
      if (sent > 0 && typeof window.flashMidiIndicator === 'function') {
        window.flashMidiIndicator();
      }
      // Log the sent message (if tag provided)
      if (sent > 0 && tag) {
        appendMidiLog(`SEND ${tag} -> ${sent} output(s)`);
      }
      return sent;
    },
    // Helper to parse tag and send
    sendTag: (tag) => {
      if (!tag) return 0;
      const msg = tagToMidiMessage(tag);
      if (!msg) {
        appendMidiLog('Invalid MIDI tag format: ' + tag);
        return 0;
      }
      return window.STP_MIDI.sendMessage(msg, tag);
    }
  };
}

// Dashboard modal wiring (auth + broadcast + profile inline logic)
(function setupDashboardModal(){
  const modal = byId('dashboardModal');
  if (!modal) return;

  const closeBtn = modal.querySelector('.close');
  if (closeBtn) closeBtn.addEventListener('click', closeDashboard);

  const startBtn = byId('broadcastStartBtn');
  const joinBtn = byId('broadcastJoinBtn');
  const startName = byId('broadcastStartName');
  const joinName = byId('broadcastJoinName');

  // Broadcast: start as Host (reuses STP_Broadcast in app.js)
  if (startBtn) startBtn.addEventListener('click', () => {
    const room = startName.value.trim(); if (!room) { alert('Enter a broadcast name'); return; }
    startBroadcast(room);
    // Update chip and close modal
    try { window.updateBroadcastStatusChip?.(); } catch(_) {}
    closeDashboard();
  });

  // Join as viewer in a modal overlay
  if (joinBtn) joinBtn.addEventListener('click', () => {
    const room = joinName.value.trim(); if (!room) { alert('Enter a broadcast name'); return; }
    joinBroadcast(room);
    // Optionally: update chip or UI as needed
    closeDashboard();
  });
})();

// auto-attach
attachMidiManager();
