import { useEffect } from "react";

interface KeyboardShortcutsConfig {
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onTogglePlayback: () => void;
  onTrackMute: (trackId: string) => void;
  isPlaying: boolean;
}

export function useKeyboardShortcuts({
  onPlay,
  onPause,
  onStop,
  onTogglePlayback,
  onTrackMute,
  isPlaying
}: KeyboardShortcutsConfig) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent shortcuts when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          onTogglePlayback();
          break;
        
        case 'KeyS':
          e.preventDefault();
          onStop();
          break;
        
        case 'KeyP':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            // Previous song - could be implemented later
            console.log('Previous song shortcut');
          }
          break;
        
        case 'KeyN':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            // Next song - could be implemented later
            console.log('Next song shortcut');
          }
          break;
        
        case 'KeyR':
          e.preventDefault();
          // Rewind - could be implemented later
          console.log('Rewind shortcut');
          break;
        
        case 'KeyF':
          e.preventDefault();
          // Fast forward - could be implemented later
          console.log('Fast forward shortcut');
          break;
        
        // Track mute shortcuts (1-6)
        case 'Digit1':
        case 'Digit2':
        case 'Digit3':
        case 'Digit4':
        case 'Digit5':
        case 'Digit6':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            const trackNumber = parseInt(e.code.slice(-1));
            // This would need track ID mapping in a real implementation
            console.log(`Mute track ${trackNumber} shortcut`);
          } else {
            // Solo track with Ctrl+number
            e.preventDefault();
            const trackNumber = parseInt(e.code.slice(-1));
            console.log(`Solo track ${trackNumber} shortcut`);
          }
          break;
        
        case 'F1':
          e.preventDefault();
          // Help - could open help dialog
          console.log('Help shortcut');
          break;
        
        case 'Comma':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            // Settings - could open settings dialog
            console.log('Settings shortcut');
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onPlay, onPause, onStop, onTogglePlayback, onTrackMute, isPlaying]);
}
