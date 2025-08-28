// Web MIDI API type declarations
declare global {
  interface Navigator {
    requestMIDIAccess(options?: { sysex?: boolean }): Promise<MIDIAccess>;
  }
  
  interface MIDIAccess extends EventTarget {
    inputs: Map<string, MIDIInput>;
    outputs: Map<string, MIDIOutput>;
    onstatechange: ((event: MIDIConnectionEvent) => void) | null;
  }
  
  interface MIDIPort extends EventTarget {
    id: string;
    name: string;
    manufacturer: string;
    state: 'connected' | 'disconnected';
    connection: 'open' | 'closed' | 'pending';
    type: 'input' | 'output';
    version: string;
  }
  
  interface MIDIInput extends MIDIPort {
    onmidimessage: ((event: MIDIMessageEvent) => void) | null;
  }
  
  interface MIDIOutput extends MIDIPort {
    send(data: Uint8Array, timestamp?: number): void;
  }
  
  interface MIDIConnectionEvent extends Event {
    port: MIDIPort;
  }
  
  interface MIDIMessageEvent extends Event {
    data: Uint8Array;
    timestamp: number;
    target: MIDIInput;
  }
}

export {};