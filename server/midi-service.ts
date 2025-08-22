// Use try-catch for optional MIDI dependency
let easymidi: any = null;
try {
  easymidi = require('easymidi');
} catch (error) {
  console.log('⚠️ MIDI library not available, using mock mode');
}

export interface MIDIDevice {
  id: string;
  name: string;
  type: 'input' | 'output';
  isConnected: boolean;
  channel?: number;
  portIndex: number;
}

export interface MIDIMessage {
  timestamp: number;
  deviceId: string;
  deviceName: string;
  channel: number;
  command: string;
  data: number[];
  rawData: number[];
}

export class MIDIService {
  private static instance: MIDIService;
  private inputDevices: Map<string, any> = new Map();
  private outputDevices: Map<string, any> = new Map();
  private connectedInputs: Map<string, MIDIDevice> = new Map();
  private connectedOutputs: Map<string, MIDIDevice> = new Map();
  private messageListeners: Set<(message: MIDIMessage) => void> = new Set();

  private constructor() {
    this.scanDevices();
  }

  public static getInstance(): MIDIService {
    if (!MIDIService.instance) {
      MIDIService.instance = new MIDIService();
    }
    return MIDIService.instance;
  }

  public scanDevices(): { inputs: MIDIDevice[], outputs: MIDIDevice[] } {
    console.log('🎹 Scanning MIDI devices...');
    
    if (easymidi) {
      try {
        // Scan input devices
        const inputNames = easymidi.getInputs();
        const inputDevices: MIDIDevice[] = inputNames.map((name: string, i: number) => ({
          id: `input_${i}`,
          name,
          type: 'input' as const,
          isConnected: this.connectedInputs.has(`input_${i}`),
          portIndex: i
        }));

        // Scan output devices  
        const outputNames = easymidi.getOutputs();
        const outputDevices: MIDIDevice[] = outputNames.map((name: string, i: number) => ({
          id: `output_${i}`,
          name,
          type: 'output' as const,
          isConnected: this.connectedOutputs.has(`output_${i}`),
          portIndex: i
        }));

        console.log(`📥 Found ${inputDevices.length} MIDI input devices`);
        console.log(`📤 Found ${outputDevices.length} MIDI output devices`);

        return { inputs: inputDevices, outputs: outputDevices };
      } catch (error) {
        console.log('⚠️ MIDI scan failed, using mock devices for development');
        return this.getMockDevices();
      }
    } else {
      console.log('⚠️ MIDI not available in this environment, using mock devices for development');
      return this.getMockDevices();
    }
  }

  private getMockDevices(): { inputs: MIDIDevice[], outputs: MIDIDevice[] } {
    const inputs: MIDIDevice[] = [
      { id: 'input_0', name: 'Mock MIDI Controller', type: 'input', isConnected: false, portIndex: 0 },
      { id: 'input_1', name: 'Mock MIDI Keyboard', type: 'input', isConnected: false, portIndex: 1 }
    ];
    
    const outputs: MIDIDevice[] = [
      { id: 'output_0', name: 'Mock MIDI Synth', type: 'output', isConnected: false, portIndex: 0 },
      { id: 'output_1', name: 'Mock MIDI Interface', type: 'output', isConnected: false, portIndex: 1 }
    ];

    return { inputs, outputs };
  }

  public connectInputDevice(deviceId: string, channel?: number): boolean {
    try {
      const { inputs } = this.scanDevices();
      const device = inputs.find(d => d.id === deviceId);
      
      if (!device) {
        console.error(`❌ Input device ${deviceId} not found`);
        return false;
      }

      // Disconnect if already connected
      if (this.inputDevices.has(deviceId)) {
        this.disconnectInputDevice(deviceId);
      }

      if (easymidi) {
        try {
          const input = new easymidi.Input(device.name);
          input.on('noteon', (msg: any) => {
            const midiData = this.easymidiToStandardFormat({ type: 'noteon', ...msg });
            this.handleMIDIMessage(deviceId, device.name, midiData);
          });
          input.on('noteoff', (msg: any) => {
            const midiData = this.easymidiToStandardFormat({ type: 'noteoff', ...msg });
            this.handleMIDIMessage(deviceId, device.name, midiData);
          });
          input.on('cc', (msg: any) => {
            const midiData = this.easymidiToStandardFormat({ type: 'cc', ...msg });
            this.handleMIDIMessage(deviceId, device.name, midiData);
          });

          this.inputDevices.set(deviceId, input);
        } catch (error) {
          // Fallback for mock mode
          console.log(`🎭 Using mock input device: ${device.name}`);
          this.inputDevices.set(deviceId, { name: device.name, close: () => {} });
        }
      } else {
        // Mock mode
        console.log(`🎭 Using mock input device: ${device.name}`);
        this.inputDevices.set(deviceId, { name: device.name, close: () => {} });
      }
      
      const connectedDevice: MIDIDevice = {
        ...device,
        isConnected: true,
        channel
      };
      this.connectedInputs.set(deviceId, connectedDevice);

      console.log(`✅ Connected MIDI input: ${device.name}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to connect input device ${deviceId}:`, error);
      return false;
    }
  }

  public connectOutputDevice(deviceId: string, channel?: number): boolean {
    try {
      const { outputs } = this.scanDevices();
      const device = outputs.find(d => d.id === deviceId);
      
      if (!device) {
        console.error(`❌ Output device ${deviceId} not found`);
        return false;
      }

      // Disconnect if already connected
      if (this.outputDevices.has(deviceId)) {
        this.disconnectOutputDevice(deviceId);
      }

      if (easymidi) {
        try {
          const output = new easymidi.Output(device.name);
          this.outputDevices.set(deviceId, output);
        } catch (error) {
          // Fallback for mock mode
          console.log(`🎭 Using mock output device: ${device.name}`);
          this.outputDevices.set(deviceId, { 
            name: device.name, 
            send: () => {},
            close: () => {} 
          });
        }
      } else {
        // Mock mode
        console.log(`🎭 Using mock output device: ${device.name}`);
        this.outputDevices.set(deviceId, { 
          name: device.name, 
          send: () => {},
          close: () => {} 
        });
      }
      
      const connectedDevice: MIDIDevice = {
        ...device,
        isConnected: true,
        channel
      };
      this.connectedOutputs.set(deviceId, connectedDevice);

      console.log(`✅ Connected MIDI output: ${device.name}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to connect output device ${deviceId}:`, error);
      return false;
    }
  }

  public disconnectInputDevice(deviceId: string): boolean {
    try {
      const input = this.inputDevices.get(deviceId);
      if (input) {
        if (input.close) input.close();
        this.inputDevices.delete(deviceId);
        this.connectedInputs.delete(deviceId);
        console.log(`🔌 Disconnected MIDI input: ${deviceId}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`❌ Failed to disconnect input device ${deviceId}:`, error);
      return false;
    }
  }

  public disconnectOutputDevice(deviceId: string): boolean {
    try {
      const output = this.outputDevices.get(deviceId);
      if (output) {
        if (output.close) output.close();
        this.outputDevices.delete(deviceId);
        this.connectedOutputs.delete(deviceId);
        console.log(`🔌 Disconnected MIDI output: ${deviceId}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`❌ Failed to disconnect output device ${deviceId}:`, error);
      return false;
    }
  }

  public sendMIDIMessage(deviceId: string, message: number[]): boolean {
    try {
      const output = this.outputDevices.get(deviceId);
      if (!output) {
        console.error(`❌ Output device ${deviceId} not connected`);
        return false;
      }

      // Convert raw MIDI data to easymidi message format
      const easymidiMessage = this.standardToEasymidiFormat(message);
      if (easymidiMessage && output.send) {
        output.send(easymidiMessage.type, easymidiMessage.data);
        console.log(`📤 Sent MIDI message to ${deviceId}:`, message);
        return true;
      } else {
        console.log(`🎭 Mock sent MIDI message to ${deviceId}:`, message);
        return true;
      }
    } catch (error) {
      console.error(`❌ Failed to send MIDI message to ${deviceId}:`, error);
      return false;
    }
  }

  public parseMIDICommand(command: string): number[] | null {
    try {
      // Handle hex format: "90 40 7F" or "0x90 0x40 0x7F"
      if (command.includes(' ')) {
        return command.split(' ')
          .map(byte => byte.startsWith('0x') ? parseInt(byte, 16) : parseInt(byte, 16))
          .filter(num => !isNaN(num) && num >= 0 && num <= 255);
      }

      // Handle simple commands: "note on C4 127"
      const simpleParse = this.parseSimpleMIDICommand(command);
      if (simpleParse) return simpleParse;

      // Handle single hex string: "90407F"
      if (command.length >= 6 && command.length % 2 === 0) {
        const bytes: number[] = [];
        for (let i = 0; i < command.length; i += 2) {
          const byte = parseInt(command.substr(i, 2), 16);
          if (!isNaN(byte)) bytes.push(byte);
        }
        return bytes.length > 0 ? bytes : null;
      }

      return null;
    } catch (error) {
      console.error('❌ Failed to parse MIDI command:', error);
      return null;
    }
  }

  private parseSimpleMIDICommand(command: string): number[] | null {
    const lower = command.toLowerCase().trim();
    
    // Note on: "note on c4 127" or "noteon c4 127"
    const noteOnMatch = lower.match(/note\s*on\s+([a-g][#b]?\d+)\s+(\d+)/);
    if (noteOnMatch) {
      const note = this.noteToMIDI(noteOnMatch[1]);
      const velocity = parseInt(noteOnMatch[2]);
      if (note !== null && velocity >= 0 && velocity <= 127) {
        return [0x90, note, velocity]; // Note on, channel 1
      }
    }

    // Note off: "note off c4 64" or "noteoff c4"
    const noteOffMatch = lower.match(/note\s*off\s+([a-g][#b]?\d+)(?:\s+(\d+))?/);
    if (noteOffMatch) {
      const note = this.noteToMIDI(noteOffMatch[1]);
      const velocity = noteOffMatch[2] ? parseInt(noteOffMatch[2]) : 64;
      if (note !== null && velocity >= 0 && velocity <= 127) {
        return [0x80, note, velocity]; // Note off, channel 1
      }
    }

    // Control change: "cc 1 127" or "control 1 127"
    const ccMatch = lower.match(/(?:cc|control)\s+(\d+)\s+(\d+)/);
    if (ccMatch) {
      const controller = parseInt(ccMatch[1]);
      const value = parseInt(ccMatch[2]);
      if (controller >= 0 && controller <= 127 && value >= 0 && value <= 127) {
        return [0xB0, controller, value]; // Control change, channel 1
      }
    }

    return null;
  }

  private noteToMIDI(note: string): number | null {
    const noteMap: { [key: string]: number } = {
      'c': 0, 'c#': 1, 'db': 1, 'd': 2, 'd#': 3, 'eb': 3, 'e': 4,
      'f': 5, 'f#': 6, 'gb': 6, 'g': 7, 'g#': 8, 'ab': 8, 'a': 9,
      'a#': 10, 'bb': 10, 'b': 11
    };

    const match = note.toLowerCase().match(/([a-g][#b]?)(\d+)/);
    if (!match) return null;

    const noteName = match[1];
    const octave = parseInt(match[2]);
    
    if (noteMap[noteName] === undefined || octave < 0 || octave > 10) {
      return null;
    }

    return (octave + 1) * 12 + noteMap[noteName];
  }

  private handleMIDIMessage(deviceId: string, deviceName: string, rawData: number[]): void {
    const message: MIDIMessage = {
      timestamp: Date.now(),
      deviceId,
      deviceName,
      channel: (rawData[0] & 0x0F) + 1,
      command: this.getCommandName(rawData[0]),
      data: rawData.slice(1),
      rawData
    };

    // Notify all listeners
    this.messageListeners.forEach(listener => {
      try {
        listener(message);
      } catch (error) {
        console.error('❌ Error in MIDI message listener:', error);
      }
    });
  }

  private getCommandName(statusByte: number): string {
    const command = statusByte & 0xF0;
    switch (command) {
      case 0x80: return 'Note Off';
      case 0x90: return 'Note On';
      case 0xA0: return 'Aftertouch';
      case 0xB0: return 'Control Change';
      case 0xC0: return 'Program Change';
      case 0xD0: return 'Channel Pressure';
      case 0xE0: return 'Pitch Bend';
      case 0xF0: return 'System';
      default: return 'Unknown';
    }
  }

  private easymidiToStandardFormat(message: any): number[] {
    // Convert easymidi message to standard MIDI byte format
    switch (message.type) {
      case 'noteon':
        return [0x90 | (message.channel - 1), message.note, message.velocity];
      case 'noteoff':
        return [0x80 | (message.channel - 1), message.note, message.velocity];
      case 'cc':
        return [0xB0 | (message.channel - 1), message.controller, message.value];
      case 'program':
        return [0xC0 | (message.channel - 1), message.number];
      case 'pitch':
        const pitchValue = message.value + 8192; // Convert to 14-bit value
        return [0xE0 | (message.channel - 1), pitchValue & 0x7F, (pitchValue >> 7) & 0x7F];
      default:
        console.warn('Unknown MIDI message type:', message.type);
        return [0x90, 60, 127]; // Default note on C4
    }
  }

  private standardToEasymidiFormat(message: number[]): { type: string, data: any } | null {
    if (message.length < 1) return null;

    const status = message[0];
    const command = status & 0xF0;
    const channel = (status & 0x0F) + 1;

    switch (command) {
      case 0x90: // Note on
        return {
          type: 'noteon',
          data: { channel, note: message[1], velocity: message[2] }
        };
      case 0x80: // Note off
        return {
          type: 'noteoff', 
          data: { channel, note: message[1], velocity: message[2] }
        };
      case 0xB0: // Control change
        return {
          type: 'cc',
          data: { channel, controller: message[1], value: message[2] }
        };
      case 0xC0: // Program change
        return {
          type: 'program',
          data: { channel, number: message[1] }
        };
      case 0xE0: // Pitch bend
        const pitchValue = (message[2] << 7) | message[1];
        return {
          type: 'pitch',
          data: { channel, value: pitchValue - 8192 }
        };
      default:
        return null;
    }
  }

  public addMessageListener(listener: (message: MIDIMessage) => void): void {
    this.messageListeners.add(listener);
  }

  public removeMessageListener(listener: (message: MIDIMessage) => void): void {
    this.messageListeners.delete(listener);
  }

  public getConnectedDevices(): { inputs: MIDIDevice[], outputs: MIDIDevice[] } {
    return {
      inputs: Array.from(this.connectedInputs.values()),
      outputs: Array.from(this.connectedOutputs.values())
    };
  }

  public disconnect(): void {
    // Disconnect all devices
    Array.from(this.inputDevices.keys()).forEach(deviceId => {
      this.disconnectInputDevice(deviceId);
    });
    Array.from(this.outputDevices.keys()).forEach(deviceId => {
      this.disconnectOutputDevice(deviceId);
    });
    
    // Clear listeners
    this.messageListeners.clear();
    
    console.log('🔌 All MIDI devices disconnected');
  }
}

// Export singleton instance
export const midiService = MIDIService.getInstance();