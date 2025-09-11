// MIDI Broker - Non-blocking MIDI operations via helper window
export interface MIDIDevice {
  id: string;
  name: string;
  state?: string;
}

export interface MidiBrokerState {
  isLoading: boolean;
  devices: MIDIDevice[];
  connectedDevices: string[];
  errorMessage: string;
  isHelperReady: boolean;
}

type StateListener = (state: MidiBrokerState) => void;

class MidiBroker {
  private helperWindow: Window | null = null;
  private state: MidiBrokerState = {
    isLoading: false,
    devices: [],
    connectedDevices: [],
    errorMessage: '',
    isHelperReady: false
  };
  private listeners: Set<StateListener> = new Set();
  private isInitializing = false;
  private refreshTimeout: NodeJS.Timeout | null = null;

  constructor() {
    // Listen for messages from helper window
    window.addEventListener('message', (event) => {
      this.handleHelperMessage(event);
    });
  }

  // Subscribe to state changes
  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    // Send current state immediately
    listener(this.state);
    
    return () => {
      this.listeners.delete(listener);
    };
  }

  // Update state and notify listeners
  private updateState(updates: Partial<MidiBrokerState>) {
    this.state = { ...this.state, ...updates };
    this.listeners.forEach(listener => listener(this.state));
  }

  // Open helper window if needed
  private async ensureHelper(): Promise<boolean> {
    if (this.helperWindow && !this.helperWindow.closed) {
      return true;
    }

    try {
      console.log('🎵 MidiBroker: Opening MIDI helper window...');
      this.helperWindow = window.open(
        '/midi-helper.html',
        'midi-helper',
        'width=1,height=1,left=-1000,top=-1000,toolbar=no,menubar=no,scrollbars=no,resizable=no'
      );

      if (!this.helperWindow) {
        throw new Error('Failed to open helper window - popup blocked?');
      }

      // Wait for helper to be ready
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          console.log('🎵 MidiBroker: Helper window timeout');
          resolve(false);
        }, 5000);

        const checkReady = () => {
          if (this.state.isHelperReady) {
            clearTimeout(timeout);
            resolve(true);
          } else {
            setTimeout(checkReady, 100);
          }
        };
        checkReady();
      });

    } catch (error) {
      console.error('🎵 MidiBroker: Failed to create helper window:', error);
      this.updateState({ 
        errorMessage: 'Failed to open MIDI helper - check popup settings',
        isHelperReady: false 
      });
      return false;
    }
  }

  // Handle messages from helper window
  private handleHelperMessage(event: MessageEvent) {
    if (!this.helperWindow || event.source !== this.helperWindow) {
      return;
    }

    const { type, ...payload } = event.data || {};
    console.log('🎵 MidiBroker: Received from helper:', type, payload);

    switch (type) {
      case 'midi:helper_ready':
        this.updateState({ isHelperReady: true });
        break;

      case 'midi:ready':
        this.updateState({ 
          isLoading: false,
          errorMessage: '',
          isHelperReady: true 
        });
        break;

      case 'midi:devices':
        this.updateState({ 
          devices: payload.devices || [],
          isLoading: false,
          errorMessage: payload.devices?.length === 0 ? 'No MIDI devices found' : ''
        });
        break;

      case 'midi:error':
        this.updateState({ 
          isLoading: false,
          errorMessage: payload.error || 'MIDI error',
          devices: []
        });
        break;

      case 'midi:send_result':
        if (payload.success) {
          console.log(`🎵 MidiBroker: Command sent successfully to ${payload.device}`);
        } else {
          console.error(`🎵 MidiBroker: Command failed: ${payload.error}`);
        }
        break;
    }
  }

  // Send message to helper window
  private sendToHelper(message: any) {
    if (this.helperWindow && !this.helperWindow.closed) {
      try {
        this.helperWindow.postMessage(message, '*');
      } catch (error) {
        console.error('🎵 MidiBroker: Failed to send to helper:', error);
      }
    }
  }

  // Refresh devices with 3-second UI timeout
  async refreshDevices(): Promise<void> {
    if (this.isInitializing) {
      console.log('🎵 MidiBroker: Refresh already in progress, ignoring');
      return;
    }

    this.isInitializing = true;
    this.updateState({ isLoading: true, errorMessage: '' });

    // Clear any existing timeout
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
    }

    // Set 3-second UI timeout - after this, UI shows timeout but helper keeps working
    this.refreshTimeout = setTimeout(() => {
      console.log('🎵 MidiBroker: 3-second UI timeout reached');
      this.updateState({ 
        isLoading: false,
        errorMessage: 'MIDI scan taking longer than expected - will update when ready'
      });
      this.isInitializing = false;
    }, 3000);

    try {
      // Ensure helper window exists
      const helperReady = await this.ensureHelper();
      if (!helperReady) {
        throw new Error('Helper window not available');
      }

      // Request refresh from helper (this won't block main UI)
      this.sendToHelper({ type: 'midi:refresh' });

    } catch (error) {
      console.error('🎵 MidiBroker: Refresh failed:', error);
      this.updateState({ 
        isLoading: false,
        errorMessage: error instanceof Error ? error.message : 'MIDI refresh failed'
      });
      this.isInitializing = false;
      
      if (this.refreshTimeout) {
        clearTimeout(this.refreshTimeout);
        this.refreshTimeout = null;
      }
    }
  }

  // Connect to device
  connectDevice(deviceId: string) {
    if (!this.state.connectedDevices.includes(deviceId)) {
      this.updateState({
        connectedDevices: [...this.state.connectedDevices, deviceId]
      });
    }
  }

  // Disconnect from device
  disconnectDevice(deviceId: string) {
    this.updateState({
      connectedDevices: this.state.connectedDevices.filter(id => id !== deviceId)
    });
  }

  // Send MIDI command
  async sendCommand(command: string): Promise<boolean> {
    if (this.state.connectedDevices.length === 0) {
      console.log(`🎵 MidiBroker: No connected devices for command: ${command}`);
      return false;
    }

    if (!this.helperWindow || this.helperWindow.closed) {
      console.log(`🎵 MidiBroker: Helper not available for command: ${command}`);
      return false;
    }

    // Send to first connected device
    const deviceId = this.state.connectedDevices[0];
    this.sendToHelper({ 
      type: 'midi:send', 
      deviceId, 
      command 
    });

    return true; // Optimistic - actual result comes via message
  }

  // Clean up
  destroy() {
    if (this.helperWindow && !this.helperWindow.closed) {
      this.helperWindow.close();
    }
    this.listeners.clear();
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
    }
  }
}

// Singleton instance
export const midiBroker = new MidiBroker();