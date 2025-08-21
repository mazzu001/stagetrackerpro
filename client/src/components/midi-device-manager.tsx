// MIDI Device Manager has been completely removed
// This component is disabled

interface MIDIDeviceManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onDevicesChange?: (devices: any[]) => void;
}

export function MIDIDeviceManager({ isOpen, onClose, onDevicesChange }: MIDIDeviceManagerProps) {
  // MIDI Device Manager functionality has been completely removed
  return null;
}