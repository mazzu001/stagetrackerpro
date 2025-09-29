// MIDI Device Manager: fast 2-second scan and simple UI

let midiAccess = null;
let scanning = false;
let scanTimeout = 0;

function byId(id) { return document.getElementById(id); }

function ensureModalEls() {
  return {
    modal: byId('midiManagerModal'),
    header: byId('midiManagerHeader'),
    body: byId('midiManagerBody'),
    closeBtn: byId('closeMidiManager'),
  };
}

async function getMIDIAccess() {
  if (midiAccess) return midiAccess;
  if (!('requestMIDIAccess' in navigator)) throw new Error('Web MIDI is not supported in this browser.');
  // Race a timeout so the UI never freezes indefinitely
  const req = navigator.requestMIDIAccess({ sysex: false });
  const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('MIDI access timed out')), 3000));
  midiAccess = await Promise.race([req, timeout]);
  return midiAccess;
}

function renderHeader() {
  const { header } = ensureModalEls();
  if (!header) return;
  header.innerHTML = '';
  const status = document.createElement('div');
  status.id = 'midiScanStatus';
  status.className = 'midi-status';
  status.textContent = scanning ? 'Scanning… (2s)' : 'Idle';

  const scanBtn = document.createElement('button');
  scanBtn.id = 'midiScanBtn';
  scanBtn.className = 'btn';
  scanBtn.textContent = 'Scan (2s)';
  scanBtn.disabled = scanning;
  scanBtn.addEventListener('click', () => startQuickScan());

  const stopBtn = document.createElement('button');
  stopBtn.id = 'midiStopScanBtn';
  stopBtn.className = 'btn danger';
  stopBtn.textContent = 'Stop';
  stopBtn.disabled = !scanning;
  stopBtn.addEventListener('click', () => stopScan());

  header.appendChild(scanBtn);
  header.appendChild(stopBtn);
  header.appendChild(status);
}

function listToArray(iter) {
  const arr = [];
  try { for (const v of iter.values()) arr.push(v); } catch(_) {}
  return arr;
}

function renderBody() {
  const { body } = ensureModalEls();
  if (!body) return;
  body.innerHTML = '';
  // Place content inside a single panel that spans both grid columns
  const panel = document.createElement('div');
  panel.className = 'midi-panel';
  panel.style.gridColumn = '1 / -1';
  body.appendChild(panel);

  const makeSection = (titleText) => {
    const wrap = document.createElement('div');
    wrap.className = 'midi-section';
    const h = document.createElement('h3');
    h.textContent = titleText;
    wrap.appendChild(h);
    return wrap;
  };

  const errorBox = document.createElement('div');
  errorBox.id = 'midiErrorBox';
  errorBox.className = 'midi-error hidden';
  panel.appendChild(errorBox);

  const inputsSec = makeSection('Inputs');
  const inputsList = document.createElement('div');
  inputsList.id = 'midiInputsList';
  inputsList.className = 'midi-list';
  inputsSec.appendChild(inputsList);
  panel.appendChild(inputsSec);

  const outputsSec = makeSection('Outputs');
  const outputsList = document.createElement('div');
  outputsList.id = 'midiOutputsList';
  outputsList.className = 'midi-list';
  outputsSec.appendChild(outputsList);
  panel.appendChild(outputsSec);

  const info = document.createElement('div');
  info.id = 'midiFooterInfo';
  info.className = 'midi-info';
  info.textContent = 'Click Scan (2s) to refresh devices.';
  panel.appendChild(info);

  // initial population
  refreshLists();
}

function setStatus(text) {
  const el = byId('midiScanStatus');
  if (el) el.textContent = text;
}

function stopScan() {
  if (!scanning) return;
  scanning = false;
  if (scanTimeout) { clearTimeout(scanTimeout); scanTimeout = 0; }
  setStatus('Idle');
  renderHeader();
}

async function startQuickScan() {
  try {
    // Attempt access but do not let it hang scan
    await getMIDIAccess();
  } catch (e) {
    showError(e && e.message ? e.message : String(e));
    return;
  }
  scanning = true;
  renderHeader();
  setStatus('Scanning… (2s)');

  // Immediate refresh lists, then watch for state changes during the 2-second window
  refreshLists();

  const onStateChange = () => {
    if (!scanning) return;
    refreshLists();
  };
  midiAccess.addEventListener('statechange', onStateChange);

  scanTimeout = setTimeout(() => {
    midiAccess.removeEventListener('statechange', onStateChange);
    stopScan();
    // Final refresh
    refreshLists();
  }, 2000);
}

function showError(msg) {
  const box = byId('midiErrorBox');
  if (!box) return;
  box.textContent = msg;
  box.classList.remove('hidden');
}

function clearError() {
  const box = byId('midiErrorBox');
  if (!box) return;
  box.textContent = '';
  box.classList.add('hidden');
}

function formatPort(p) {
  const parts = [];
  if (p.name) parts.push(p.name);
  if (p.manufacturer) parts.push(p.manufacturer);
  const meta = [];
  if (p.state) meta.push(`state=${p.state}`);
  if (p.connection) meta.push(`conn=${p.connection}`);
  if (typeof p.version !== 'undefined') meta.push(`v=${p.version}`);
  const head = parts.join(' • ') || '(unknown)';
  const metaStr = meta.length ? ` (${meta.join(', ')})` : '';
  return head + metaStr;
}

function renderPorts(listEl, ports) {
  listEl.innerHTML = '';
  if (!ports.length) {
    const none = document.createElement('div');
    none.className = 'midi-list-empty';
    none.textContent = 'No devices';
    listEl.appendChild(none);
    return;
  }
  for (const p of ports) {
    const row = document.createElement('div');
    row.className = 'midi-row';
    const label = document.createElement('div');
    label.className = 'midi-row-label';
    label.textContent = formatPort(p);
    row.appendChild(label);
    listEl.appendChild(row);
  }
}

function refreshLists() {
  clearError();
  const inEl = byId('midiInputsList');
  const outEl = byId('midiOutputsList');
  if (!inEl || !outEl) return;
  if (!midiAccess) {
    renderPorts(inEl, []);
    renderPorts(outEl, []);
    return;
  }
  const inputs = listToArray(midiAccess.inputs || new Map());
  const outputs = listToArray(midiAccess.outputs || new Map());
  renderPorts(inEl, inputs);
  renderPorts(outEl, outputs);

  const footer = byId('midiFooterInfo');
  if (footer) footer.textContent = `Found ${inputs.length} input(s), ${outputs.length} output(s).`;
}

export async function openMidiManager() {
  const { modal, closeBtn } = ensureModalEls();
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.style.display = 'block';

  if (closeBtn) closeBtn.onclick = () => closeMidiManager();

  renderHeader();
  renderBody();

  // Try to get access but do not block UI; update lists when ready
  try {
    await getMIDIAccess();
    refreshLists();
  } catch (e) {
    showError(e && e.message ? e.message : String(e));
  }
}

export function closeMidiManager() {
  const { modal } = ensureModalEls();
  if (!modal) return;
  stopScan();
  modal.classList.add('hidden');
  modal.style.display = 'none';
}

// Expose to window for inline script usage
if (typeof window !== 'undefined') {
  window.openMidiManager = openMidiManager;
  window.closeMidiManager = closeMidiManager;
}
