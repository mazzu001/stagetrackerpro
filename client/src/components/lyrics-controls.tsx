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
    <div className="flex items-center space-x-2">
      {/* Auto-Scroll Toggle for non-timestamped lyrics */}
      {!hasTimestamps && (
        <button
          className={`p-1 h-7 w-8 rounded text-white text-xs flex items-center justify-center ${
            autoScrollEnabled ? 'bg-blue-600 hover:bg-blue-500' : 'bg-gray-700 hover:bg-gray-600'
          }`}
          title="Toggle Auto-Scroll"
          onClick={toggleAutoScroll}
        >
          {autoScrollEnabled ? '⏸' : '▶'}
        </button>
      )}

      {/* Scroll Speed Controls for non-timestamped lyrics when auto-scroll is enabled */}
      {!hasTimestamps && autoScrollEnabled && (
        <div className="flex items-center space-x-1">
          <button
            className="bg-gray-700 hover:bg-gray-600 p-1 h-7 w-7 rounded text-white text-xs flex items-center justify-center"
            title="Slower Auto-Scroll (Longer Timer Intervals)"
            onClick={() => adjustScrollSpeed(-0.1)}
          >
            ⬇
          </button>
          <span className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-300 min-w-[40px] text-center">
            {scrollSpeed.toFixed(1)}x
          </span>
          <button
            className="bg-gray-700 hover:bg-gray-600 p-1 h-7 w-7 rounded text-white text-xs flex items-center justify-center"
            title="Faster Auto-Scroll (Shorter Timer Intervals)"
            onClick={() => adjustScrollSpeed(0.1)}
          >
            ⬆
          </button>
        </div>
      )}

      {/* Font Size Controls */}
      <div className="flex items-center space-x-1">
        <button
          className="bg-gray-700 hover:bg-gray-600 p-1 h-7 w-7 rounded text-white text-xs flex items-center justify-center"
          title="Decrease Font Size"
          onClick={() => adjustFontSize(-2)}
        >
          A-
        </button>
        <span className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-300 min-w-[32px] text-center">
          {fontSize}
        </span>
        <button
          className="bg-gray-700 hover:bg-gray-600 p-1 h-7 w-7 rounded text-white text-xs flex items-center justify-center"
          title="Increase Font Size"
          onClick={() => adjustFontSize(2)}
        >
          A+
        </button>
      </div>
      
      <button
        className="bg-gray-700 hover:bg-gray-600 p-1 h-7 w-7 rounded text-white text-xs flex items-center justify-center"
        title="Edit Lyrics"
        onClick={onEditLyrics}
      >
        ✎
      </button>
    </div>
  );
}