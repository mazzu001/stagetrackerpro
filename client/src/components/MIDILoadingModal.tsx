import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

interface MIDILoadingModalProps {
  isVisible: boolean;
  message: string;
  progress?: string;
  onRetry?: () => void;
}

export const MIDILoadingModal = ({ isVisible, message, progress, onRetry }: MIDILoadingModalProps) => {
  // Preserve original document title
  const [originalTitle] = useState(() => document.title);
  
  useEffect(() => {
    if (isVisible) {
      // Browser-level indicators that work during thread blocking
      document.title = "🎵 Initializing MIDI...";
      document.body.style.cursor = "wait";
    } else {
      // Restore original title, not hardcoded value
      document.title = originalTitle;
      document.body.style.cursor = "default";
    }

    return () => {
      document.title = originalTitle;
      document.body.style.cursor = "default";
    };
  }, [isVisible, originalTitle]);

  if (!isVisible) return null;

  // Check if this is a failure state (has retry option)
  const isFailureState = progress && (progress.includes('failed') || progress.includes('retry') || progress.includes('denied'));
  
  return (
    <div className="midi-loading-overlay">
      <div className="midi-loading-modal">
        {!isFailureState && <div className="midi-spinner" />}
        {isFailureState && (
          <div className="flex items-center justify-center w-16 h-16 mb-4 mx-auto">
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
              <span className="text-2xl">⚠️</span>
            </div>
          </div>
        )}
        <h2 className="midi-loading-title">🎵 {message}</h2>
        {progress && (
          <p className="midi-loading-progress mb-4 text-center">{progress}</p>
        )}
        
        {!isFailureState && (
          <div className="midi-loading-dots">
            <span className="dot dot1">.</span>
            <span className="dot dot2">.</span>
            <span className="dot dot3">.</span>
          </div>
        )}
        
        {/* Show retry button when initialization fails */}
        {isFailureState && onRetry && (
          <div className="flex flex-col items-center gap-3 mt-4">
            <Button 
              onClick={onRetry}
              className="flex items-center gap-2"
              data-testid="button-retry-midi"
            >
              <RefreshCw className="w-4 h-4" />
              Retry MIDI Initialization
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              MIDI initialization can take time on some systems.
              <br />Grant permission when prompted and wait for completion.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};