// Layout Tuner - Visual CSS editor for Dashboard layout
console.log('layout-tuner.js: loaded');

class LayoutTuner {
  constructor() {
    this.isOpen = false;
    this.settings = this.loadSettings();
    this.createOverlay();
    this.applySettings();
    this.bindKeyboard();
  }

  loadSettings() {
    const saved = localStorage.getItem('stagetracker-layout-settings');
    return saved ? JSON.parse(saved) : {
      dashGridColumns: '1fr 480px', // grid-template-columns for .dash-grid
      dashGridGap: 16, // gap in px
      profileMaxWidth: 480, // max width of profile column
      profileMinWidth: 300, // min width of profile column
      avatarSectionPercent: 50, // percentage width of avatar section
      fieldsColumnPercent: 50, // percentage width of fields column
      cardPadding: 18, // padding inside cards
      modalMaxWidth: 1100 // max width of modal
    };
  }

  saveSettings() {
    localStorage.setItem('stagetracker-layout-settings', JSON.stringify(this.settings));
  }

  createOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'layoutTunerOverlay';
    overlay.innerHTML = `
      <div class="layout-tuner-panel">
        <div class="tuner-header">
          <h3>🎨 Layout Tuner</h3>
          <div class="tuner-actions">
            <button id="tunerReset" class="tuner-btn small">Reset</button>
            <button id="tunerClose" class="tuner-btn close">×</button>
          </div>
        </div>
        <div class="tuner-body">
          <div class="tuner-section">
            <h4>Dashboard Grid</h4>
            <div class="tuner-row">
              <label>Profile Column Max Width</label>
              <input type="range" id="profileMaxWidth" min="320" max="600" step="20" value="${this.settings.profileMaxWidth}">
              <span class="tuner-value">${this.settings.profileMaxWidth}px</span>
            </div>
            <div class="tuner-row">
              <label>Grid Gap</label>
              <input type="range" id="dashGridGap" min="8" max="32" step="2" value="${this.settings.dashGridGap}">
              <span class="tuner-value">${this.settings.dashGridGap}px</span>
            </div>
            <div class="tuner-row">
              <label>Modal Max Width</label>
              <input type="range" id="modalMaxWidth" min="800" max="1400" step="50" value="${this.settings.modalMaxWidth}">
              <span class="tuner-value">${this.settings.modalMaxWidth}px</span>
            </div>
          </div>
          
          <div class="tuner-section">
            <h4>Profile Card</h4>
            <div class="tuner-row">
              <label>Avatar Section Width</label>
              <input type="range" id="avatarWidth" min="25" max="45" step="1" value="${this.settings.avatarSectionPercent || 33}">
              <span class="tuner-value">${this.settings.avatarSectionPercent || 33}%</span>
            </div>
            <div class="tuner-row">
              <label>Fields Column Width</label>
              <input type="range" id="fieldsWidth" min="55" max="75" step="1" value="${this.settings.fieldsColumnPercent || 67}">
              <span class="tuner-value">${this.settings.fieldsColumnPercent || 67}%</span>
            </div>
            <div class="tuner-row">
              <label>Card Padding</label>
              <input type="range" id="cardPadding" min="10" max="28" step="2" value="${this.settings.cardPadding}">
              <span class="tuner-value">${this.settings.cardPadding}px</span>
            </div>

          </div>

          <div class="tuner-section">
            <h4>Quick Presets</h4>
            <div class="tuner-presets">
              <button class="tuner-btn preset" data-preset="compact">Compact</button>
              <button class="tuner-btn preset" data-preset="balanced">Balanced</button>
              <button class="tuner-btn preset" data-preset="spacious">Spacious</button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      #layoutTunerOverlay {
        position: fixed;
        top: 0;
        right: -400px;
        width: 380px;
        height: 100vh;
        background: #151b22;
        border-left: 1px solid #242c36;
        box-shadow: -4px 0 20px rgba(0,0,0,0.4);
        z-index: 5000;
        transition: right 0.3s ease;
        font-family: 'Segoe UI', sans-serif;
      }
      #layoutTunerOverlay.open { right: 0; }
      
      .layout-tuner-panel {
        display: flex;
        flex-direction: column;
        height: 100vh;
      }
      
      .tuner-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px;
        background: #0f1419;
        border-bottom: 1px solid #242c36;
      }
      .tuner-header h3 {
        margin: 0;
        color: #fff;
        font-size: 1.1rem;
        font-weight: 700;
      }
      
      .tuner-actions {
        display: flex;
        gap: 8px;
      }
      
      .tuner-btn {
        background: #23262b;
        color: #cfe0f0;
        border: 1px solid #2d333a;
        padding: 6px 12px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 0.9rem;
        font-weight: 600;
      }
      .tuner-btn:hover { filter: brightness(1.1); }
      .tuner-btn.small { padding: 4px 8px; font-size: 0.85rem; }
      .tuner-btn.close { background: #c0392b; border-color: #c0392b; color: #fff; }
      .tuner-btn.preset { background: #0a66c2; border-color: #0a66c2; color: #fff; }
      
      .tuner-body {
        flex: 1;
        overflow-y: auto;
        padding: 0;
      }
      
      .tuner-section {
        padding: 16px 20px;
        border-bottom: 1px solid #1e262e;
      }
      .tuner-section h4 {
        margin: 0 0 12px 0;
        color: #9fd1ff;
        font-size: 1rem;
        font-weight: 700;
      }
      
      .tuner-row {
        display: grid;
        grid-template-columns: 1fr auto 60px;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
      }
      .tuner-row label {
        color: #b0b8c0;
        font-size: 0.9rem;
      }
      .tuner-row input[type="range"] {
        width: 100px;
        accent-color: #2196f3;
      }
      .tuner-value {
        color: #2196f3;
        font-weight: 600;
        font-size: 0.85rem;
        text-align: right;
      }
      
      .tuner-presets {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(overlay);

    this.bindEvents();
  }

  bindEvents() {
    const overlay = document.getElementById('layoutTunerOverlay');
    
    // Close button
    document.getElementById('tunerClose').addEventListener('click', () => this.close());
    
    // Reset button
    document.getElementById('tunerReset').addEventListener('click', () => this.reset());
    
    // Sliders
    const sliders = overlay.querySelectorAll('input[type="range"]');
    sliders.forEach(slider => {
      slider.addEventListener('input', (e) => this.handleSliderChange(e));
    });
    
    // Presets
    const presets = overlay.querySelectorAll('[data-preset]');
    presets.forEach(btn => {
      btn.addEventListener('click', (e) => this.applyPreset(e.target.dataset.preset));
    });
  }

  bindKeyboard() {
    document.addEventListener('keydown', (e) => {
      // Ctrl+Shift+L to toggle layout tuner
      if (e.ctrlKey && e.shiftKey && e.key === 'L') {
        e.preventDefault();
        this.toggle();
      }
      // Escape to close
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });
  }

  handleSliderChange(e) {
    const { id, value } = e.target;
    const valueSpan = e.target.nextElementSibling;
    
    switch (id) {
      case 'profileMaxWidth':
        this.settings.profileMaxWidth = parseInt(value);
        this.settings.dashGridColumns = `1fr minmax(${this.settings.profileMinWidth}px, ${value}px)`;
        valueSpan.textContent = `${value}px`;
        break;
      case 'dashGridGap':
        this.settings.dashGridGap = parseInt(value);
        valueSpan.textContent = `${value}px`;
        break;
      case 'modalMaxWidth':
        this.settings.modalMaxWidth = parseInt(value);
        valueSpan.textContent = `${value}px`;
        break;
      case 'avatarWidth':
        this.settings.avatarSectionPercent = parseInt(value);
        this.settings.fieldsColumnPercent = 100 - parseInt(value);
        valueSpan.textContent = `${value}%`;
        // Update the fields slider and display to match
        document.getElementById('fieldsWidth').value = this.settings.fieldsColumnPercent;
        document.querySelector('#fieldsWidth + .tuner-value').textContent = `${this.settings.fieldsColumnPercent}%`;
        break;
      case 'fieldsWidth':
        this.settings.fieldsColumnPercent = parseInt(value);
        this.settings.avatarSectionPercent = 100 - parseInt(value);
        valueSpan.textContent = `${value}%`;
        // Update the avatar slider and display to match
        document.getElementById('avatarWidth').value = this.settings.avatarSectionPercent;
        document.querySelector('#avatarWidth + .tuner-value').textContent = `${this.settings.avatarSectionPercent}%`;
        break;
      case 'cardPadding':
        this.settings.cardPadding = parseInt(value);
        valueSpan.textContent = `${value}px`;
        break;
    }
    
    this.applySettings();
    this.saveSettings();
  }

  applyPreset(preset) {
    switch (preset) {
      case 'compact':
        this.settings = {
          ...this.settings,
          profileMaxWidth: 400,
          dashGridColumns: '1fr minmax(300px, 400px)',
          dashGridGap: 12,
          cardPadding: 14,
          fieldPairBreakpoint: 800
        };
        break;
      case 'balanced':
        this.settings = {
          ...this.settings,
          profileMaxWidth: 480,
          dashGridColumns: '1fr minmax(300px, 480px)',
          dashGridGap: 16,
          cardPadding: 18,
          fieldPairBreakpoint: 900
        };
        break;
      case 'spacious':
        this.settings = {
          ...this.settings,
          profileMaxWidth: 560,
          dashGridColumns: '1fr minmax(320px, 560px)',
          dashGridGap: 24,
          cardPadding: 22,
          fieldPairBreakpoint: 1000
        };
        break;
    }
    
    this.updateSliders();
    this.applySettings();
    this.saveSettings();
  }

  updateSliders() {
    document.getElementById('profileMaxWidth').value = this.settings.profileMaxWidth;
    document.getElementById('dashGridGap').value = this.settings.dashGridGap;
    document.getElementById('modalMaxWidth').value = this.settings.modalMaxWidth;
    document.getElementById('avatarWidth').value = this.settings.avatarSectionPercent || 50;
    document.getElementById('fieldsWidth').value = this.settings.fieldsColumnPercent || 50;
    document.getElementById('cardPadding').value = this.settings.cardPadding;
    
    // Update value displays
    document.querySelector('#profileMaxWidth + .tuner-value').textContent = `${this.settings.profileMaxWidth}px`;
    document.querySelector('#dashGridGap + .tuner-value').textContent = `${this.settings.dashGridGap}px`;
    document.querySelector('#modalMaxWidth + .tuner-value').textContent = `${this.settings.modalMaxWidth}px`;
    document.querySelector('#avatarWidth + .tuner-value').textContent = `${this.settings.avatarSectionPercent || 50}%`;
    document.querySelector('#fieldsWidth + .tuner-value').textContent = `${this.settings.fieldsColumnPercent || 50}%`;
    document.querySelector('#cardPadding + .tuner-value').textContent = `${this.settings.cardPadding}px`;
  }

  applySettings() {
    // Remove existing tuner styles
    let existingStyle = document.getElementById('layoutTunerStyles');
    if (existingStyle) existingStyle.remove();
    
    // Create new dynamic styles
    const style = document.createElement('style');
    style.id = 'layoutTunerStyles';
    style.textContent = `
      /* Layout Tuner Dynamic Styles */
      #dashboardModal .modal-content {
        width: min(96vw, ${this.settings.modalMaxWidth}px) !important;
      }
      #dashboardModal .dash-grid {
        grid-template-columns: ${this.settings.dashGridColumns} !important;
        gap: ${this.settings.dashGridGap}px !important;
      }
      #dashboardModal .avatar-section {
        flex: 0 0 ${this.settings.avatarSectionPercent || 50}% !important;
      }
      #dashboardModal .profile-fields {
        flex: 0 0 ${this.settings.fieldsColumnPercent || 50}% !important;
      }
      #dashboardModal .dash-panel,
      #dashboardModal .dash-profile {
        padding: ${this.settings.cardPadding}px !important;
      }

    `;
    document.head.appendChild(style);
  }

  reset() {
    // Reset to defaults
    this.settings = {
      dashGridColumns: '1fr minmax(300px, 480px)',
      dashGridGap: 16,
      profileMaxWidth: 480,
      profileMinWidth: 300,
      avatarSectionPercent: 50,
      fieldsColumnPercent: 50,
      cardPadding: 18,
      modalMaxWidth: 1100
    };
    
    this.updateSliders();
    this.applySettings();
    this.saveSettings();
  }

  open() {
    this.isOpen = true;
    document.getElementById('layoutTunerOverlay').classList.add('open');
  }

  close() {
    this.isOpen = false;
    document.getElementById('layoutTunerOverlay').classList.remove('open');
  }

  toggle() {
    this.isOpen ? this.close() : this.open();
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.layoutTuner = new LayoutTuner();
  });
} else {
  window.layoutTuner = new LayoutTuner();
}

// Expose API
window.openLayoutTuner = () => window.layoutTuner?.open();