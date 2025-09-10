import { useEffect } from 'react';

interface MIDILoadingModalProps {
  isVisible: boolean;
  message: string;
  progress?: string;
}

export const MIDILoadingModal = ({ isVisible, message, progress }: MIDILoadingModalProps) => {
  useEffect(() => {
    if (isVisible) {
      // Browser-level indicators that work during thread blocking
      document.title = "🎵 Initializing MIDI...";
      document.body.style.cursor = "wait";
    } else {
      // Restore normal state
      document.title = "Live Music Performance App";
      document.body.style.cursor = "default";
    }

    return () => {
      document.title = "Live Music Performance App";
      document.body.style.cursor = "default";
    };
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div className="midi-loading-overlay">
      <div className="midi-loading-modal">
        <div className="midi-spinner" />
        <h2 className="midi-loading-title">🎵 {message}</h2>
        {progress && <p className="midi-loading-progress">{progress}</p>}
        <div className="midi-loading-dots">
          <span className="dot dot1">.</span>
          <span className="dot dot2">.</span>
          <span className="dot dot3">.</span>
        </div>
      </div>
    </div>
  );
};