import { useState, useEffect } from 'react';

interface LyricsControlsProps {
  onEditLyrics: () => void;
  song: {
    lyrics?: string | null;
  };
}

export function LyricsControls({ onEditLyrics, song }: LyricsControlsProps) {
  const [fontSize, setFontSize] = useState(() => {
    return parseInt(localStorage.getItem('lyrics-font-size') || '18');
  });
  const [scrollSpeed, setScrollSpeed] = useState(() => {
    return parseFloat(localStorage.getItem('lyrics-scroll-speed') || '1.0');
  });
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(() => {
    return localStorage.getItem('lyrics-auto-scroll') !== 'false';
  });

  // Check if lyrics have timestamps
  const hasTimestamps = song?.lyrics ? 
    /\[(\d{1,2}):(\d{2})\]/.test(song.lyrics) : false;

  const adjustFontSize = (delta: number) => {
    const newSize = Math.max(12, Math.min(32, fontSize + delta));
    setFontSize(newSize);
    localStorage.setItem('lyrics-font-size', newSize.toString());
    window.dispatchEvent(new Event('lyrics-font-change'));
  };

  const adjustScrollSpeed = (delta: number) => {
    const newSpeed = Math.max(0.1, Math.min(2.0, scrollSpeed + delta));
    setScrollSpeed(newSpeed);
    localStorage.setItem('lyrics-scroll-speed', newSpeed.toString());
    window.dispatchEvent(new Event('lyrics-scroll-change'));
  };

  const toggleAutoScroll = () => {
    const newEnabled = !autoScrollEnabled;
    setAutoScrollEnabled(newEnabled);
    localStorage.setItem('lyrics-auto-scroll', newEnabled.toString());
    window.dispatchEvent(new Event('lyrics-auto-scroll-change'));
  };

  return (
    <div className="flex items-center space-x-4">
      {/* Group 1: Text Size Controls */}
      <div className="flex items-center space-x-1">
        <button
          className="bg-gray-700 hover:bg-gray-600 p-2 h-9 w-9 rounded text-white text-sm flex items-center justify-center font-medium"
          title="Decrease Font Size"
          onClick={() => adjustFontSize(-2)}
        >
          A-
        </button>
        <span className="text-sm px-3 py-2 rounded bg-gray-700 text-gray-300 min-w-[36px] text-center font-medium">
          {fontSize}
        </span>
        <button
          className="bg-gray-700 hover:bg-gray-600 p-2 h-9 w-9 rounded text-white text-sm flex items-center justify-center font-medium"
          title="Increase Font Size"
          onClick={() => adjustFontSize(2)}
        >
          A+
        </button>
      </div>

      {/* Group 2: Scroll Speed Controls (for non-timestamped lyrics) */}
      {!hasTimestamps && (
        <div className="flex items-center space-x-1">
          <button
            className={`p-2 h-9 w-10 rounded text-white text-sm flex items-center justify-center font-medium ${
              autoScrollEnabled ? 'bg-blue-600 hover:bg-blue-500' : 'bg-gray-700 hover:bg-gray-600'
            }`}
            title="Toggle Auto-Scroll"
            onClick={toggleAutoScroll}
          >
            {autoScrollEnabled ? '⏸' : '▶'}
          </button>
          
          {autoScrollEnabled && (
            <>
              <button
                className="bg-gray-700 hover:bg-gray-600 p-2 h-9 w-9 rounded text-white text-sm flex items-center justify-center font-medium"
                title="Slower Auto-Scroll"
                onClick={() => adjustScrollSpeed(-0.1)}
              >
                ⬇
              </button>
              <span className="text-sm px-3 py-2 rounded bg-gray-700 text-gray-300 min-w-[44px] text-center font-medium">
                {scrollSpeed.toFixed(1)}x
              </span>
              <button
                className="bg-gray-700 hover:bg-gray-600 p-2 h-9 w-9 rounded text-white text-sm flex items-center justify-center font-medium"
                title="Faster Auto-Scroll"
                onClick={() => adjustScrollSpeed(0.1)}
              >
                ⬆
              </button>
            </>
          )}
        </div>
      )}
      
      {/* Group 3: Edit Controls */}
      <div className="flex items-center">
        <button
          className="bg-gray-700 hover:bg-gray-600 p-2 h-9 w-9 rounded text-white text-sm flex items-center justify-center font-medium"
          title="Edit Lyrics"
          onClick={onEditLyrics}
        >
          ✎
        </button>
      </div>
    </div>
  );
}