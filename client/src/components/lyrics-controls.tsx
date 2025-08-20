import { useState, useEffect } from 'react';
import { Song } from '@shared/schema';

interface LyricsControlsProps {
  onEditLyrics: () => void;
  song: Song;
}

export function LyricsControls({ onEditLyrics, song }: LyricsControlsProps) {
  const [fontSize, setFontSize] = useState(() => {
    return parseInt(localStorage.getItem('lyrics-font-size') || '18');
  });
  const [scrollSpeed, setScrollSpeed] = useState(() => {
    return parseFloat(localStorage.getItem('lyrics-scroll-speed') || '1.0');
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
    const newSpeed = Math.max(0.2, Math.min(3.0, scrollSpeed + delta));
    setScrollSpeed(newSpeed);
    localStorage.setItem('lyrics-scroll-speed', newSpeed.toString());
    window.dispatchEvent(new Event('lyrics-scroll-change'));
  };

  return (
    <div className="flex items-center space-x-2">
      {/* Scroll Speed Controls for non-timestamped lyrics */}
      {!hasTimestamps && (
        <div className="flex items-center space-x-1">
          <button
            className="bg-gray-700 hover:bg-gray-600 p-1 h-7 w-7 rounded text-white text-xs flex items-center justify-center"
            title="Decrease Scroll Speed"
            onClick={() => adjustScrollSpeed(-0.2)}
          >
            ⬇
          </button>
          <span className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-300 min-w-[40px] text-center">
            {scrollSpeed.toFixed(1)}x
          </span>
          <button
            className="bg-gray-700 hover:bg-gray-600 p-1 h-7 w-7 rounded text-white text-xs flex items-center justify-center"
            title="Increase Scroll Speed"
            onClick={() => adjustScrollSpeed(0.2)}
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