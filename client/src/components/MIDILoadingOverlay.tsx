import { useState, useEffect } from 'react';

interface MIDILoadingOverlayProps {
  isLoading: boolean;
  error?: string | null;
  onCancel?: () => void;
  onRetry?: () => void;
}

export function MIDILoadingOverlay({ isLoading, error, onCancel, onRetry }: MIDILoadingOverlayProps) {
  const [showCancel, setShowCancel] = useState(false);

  // Show cancel button after 2 seconds
  useEffect(() => {
    if (isLoading) {
      const timer = setTimeout(() => setShowCancel(true), 2000);
      return () => clearTimeout(timer);
    } else {
      setShowCancel(false);
    }
  }, [isLoading]);

  if (!isLoading && !error) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-lg p-8 shadow-2xl max-w-md w-full mx-4 animate-in fade-in-0 zoom-in-95">
        {isLoading ? (
          <>
            {/* Spinner animation - runs on GPU, won't freeze */}
            <div className="flex flex-col items-center">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-gray-200 dark:border-gray-700 rounded-full animate-spin border-t-blue-500"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg className="w-8 h-8 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                </div>
              </div>
              
              <h3 className="mt-6 text-xl font-semibold text-gray-900 dark:text-white">
                Scanning for MIDI Devices
              </h3>
              
              <p className="mt-2 text-gray-600 dark:text-gray-400 text-center">
                Detecting your MIDI controllers and interfaces...
              </p>
              
              {/* Animated dots */}
              <div className="mt-4 flex space-x-1">
                <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></span>
                <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></span>
              </div>
              
              <p className="mt-4 text-sm text-gray-500 dark:text-gray-500">
                This may take a few seconds
              </p>
              
              {showCancel && onCancel && (
                <button
                  onClick={onCancel}
                  className="mt-6 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                  data-testid="button-cancel-midi-scan"
                >
                  Cancel
                </button>
              )}
            </div>
          </>
        ) : error ? (
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-red-600 dark:text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            
            <h3 className="mt-6 text-xl font-semibold text-gray-900 dark:text-white">
              MIDI Initialization Failed
            </h3>
            
            <p className="mt-2 text-gray-600 dark:text-gray-400 text-center">
              {error === 'MIDI_TIMEOUT' ? (
                <>
                  The MIDI device scan timed out.
                  <br />
                  <span className="text-sm">
                    This sometimes happens when Windows/Edge takes too long to scan devices.
                  </span>
                </>
              ) : error === 'MIDI_DENIED' ? (
                'MIDI access was denied. Please allow MIDI permissions and try again.'
              ) : (
                error || 'Unable to initialize MIDI devices.'
              )}
            </p>
            
            <div className="mt-6 flex space-x-3">
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  data-testid="button-retry-midi"
                >
                  Retry
                </button>
              )}
              {onCancel && (
                <button
                  onClick={onCancel}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  data-testid="button-continue-without-midi"
                >
                  Continue without MIDI
                </button>
              )}
            </div>
            
            {error === 'MIDI_TIMEOUT' && (
              <p className="mt-4 text-xs text-gray-500 dark:text-gray-500 text-center">
                Try disconnecting some MIDI devices and retry
              </p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}