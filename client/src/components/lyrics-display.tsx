import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Minus, Edit, ChevronUp, ChevronDown } from "lucide-react";

interface LyricsLine {
  timestamp: number; // in seconds
  text: string;
}

interface LyricsDisplayProps {
  song: any | null;
  currentTime: number;
  onEditLyrics?: () => void;
}

export function LyricsDisplay({ song, currentTime, onEditLyrics }: LyricsDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [fontSize, setFontSize] = useState(() => {
    const saved = localStorage.getItem('lyrics-font-size');
    return saved ? parseInt(saved) : 18;
  });
  const [scrollSpeed, setScrollSpeed] = useState(() => {
    const saved = localStorage.getItem('lyrics-scroll-speed');
    return saved ? parseFloat(saved) : 1.0;
  });

  // Parse lyrics with timestamps
  const parseLyrics = (lyricsText: string): LyricsLine[] => {
    if (!lyricsText) return [];
    
    const lines = lyricsText.split('\n');
    const parsedLines: LyricsLine[] = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      // Look for timestamp pattern [mm:ss] or [m:ss]
      const timestampMatch = trimmed.match(/^\[(\d{1,2}):(\d{2})\]/);
      
      if (timestampMatch) {
        const minutes = parseInt(timestampMatch[1]);
        const seconds = parseInt(timestampMatch[2]);
        const timestamp = minutes * 60 + seconds;
        const text = trimmed.substring(timestampMatch[0].length).trim();
        
        if (text) {
          parsedLines.push({ timestamp, text });
        }
      }
    }
    
    return parsedLines.sort((a, b) => a.timestamp - b.timestamp);
  };

  const lyrics = song?.lyrics ? parseLyrics(song.lyrics) : [];
  
  // Check if lyrics actually contain timestamp patterns anywhere in the text
  const hasTimestamps = song?.lyrics ? 
    /\[(\d{1,2}):(\d{2})\]/.test(song.lyrics) : false;
  
  // Split lyrics by lines for non-timestamped lyrics
  const plainLines = song?.lyrics && !hasTimestamps ? 
    song.lyrics.split('\n').filter((line: string) => line.trim()) : [];
  
  // Find current line based on timestamp (for timestamped lyrics)
  const currentLineIndex = hasTimestamps ? lyrics.findIndex((line, index) => {
    const nextLine = lyrics[index + 1];
    return line.timestamp <= currentTime && (!nextLine || nextLine.timestamp > currentTime);
  }) : -1;

  // Auto-scroll for timestamped lyrics
  useEffect(() => {
    if (hasTimestamps && currentLineIndex >= 0 && containerRef.current) {
      const currentElement = containerRef.current.querySelector(`[data-line="${currentLineIndex}"]`);
      if (currentElement) {
        currentElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }
    }
  }, [currentLineIndex, hasTimestamps]);

  // Auto-scroll for non-timestamped lyrics
  useEffect(() => {
    if (!hasTimestamps && plainLines.length > 0 && containerRef.current && song?.duration && currentTime > 1) {
      const container = containerRef.current;
      const scrollPixelsPerSecond = (100 * scrollSpeed);
      const totalScrollDistance = (currentTime - 1) * scrollPixelsPerSecond;
      container.scrollTop = totalScrollDistance;
    }
  }, [currentTime, hasTimestamps, plainLines.length, scrollSpeed, song?.duration]);

  const adjustFontSize = (delta: number) => {
    const newSize = Math.max(12, Math.min(32, fontSize + delta));
    setFontSize(newSize);
    localStorage.setItem('lyrics-font-size', newSize.toString());
  };

  const adjustScrollSpeed = (delta: number) => {
    const newSpeed = Math.max(0.2, Math.min(3.0, scrollSpeed + delta));
    setScrollSpeed(newSpeed);
    localStorage.setItem('lyrics-scroll-speed', newSpeed.toString());
  };

  if (!song) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-800 rounded-lg">
        <p className="text-gray-400">No song selected</p>
      </div>
    );
  }

  return (
    <div className="w-full bg-gray-900 rounded-lg overflow-hidden" style={{ height: '400px' }}>
      {/* Header */}
      <div className="bg-gray-800 px-4 py-2 border-b border-gray-700" style={{ height: '60px' }}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-white">{song.title} - Lyrics</h3>
          
          <div className="flex items-center space-x-2">
            {/* Scroll Speed Controls for non-timestamped lyrics */}
            {!hasTimestamps && plainLines.length > 0 && (
              <div className="flex items-center space-x-1">
                <Button
                  variant="secondary"
                  size="sm"
                  className="bg-gray-700 hover:bg-gray-600 p-1 h-7 w-7"
                  title="Decrease Scroll Speed"
                  onClick={() => adjustScrollSpeed(-0.2)}
                  data-testid="button-decrease-scroll-speed"
                >
                  <ChevronDown className="w-3 h-3" />
                </Button>
                <span className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-300 min-w-[32px] text-center">
                  {scrollSpeed.toFixed(1)}x
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  className="bg-gray-700 hover:bg-gray-600 p-1 h-7 w-7"
                  title="Increase Scroll Speed"
                  onClick={() => adjustScrollSpeed(0.2)}
                  data-testid="button-increase-scroll-speed"
                >
                  <ChevronUp className="w-3 h-3" />
                </Button>
              </div>
            )}

            {/* Font Size Controls */}
            <div className="flex items-center space-x-1">
              <Button
                variant="secondary"
                size="sm"
                className="bg-gray-700 hover:bg-gray-600 p-1 h-7 w-7"
                title="Decrease Font Size"
                onClick={() => adjustFontSize(-2)}
                data-testid="button-decrease-font"
              >
                <Minus className="w-3 h-3" />
              </Button>
              <span className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-300 min-w-[32px] text-center">
                {fontSize}
              </span>
              <Button
                variant="secondary"
                size="sm"
                className="bg-gray-700 hover:bg-gray-600 p-1 h-7 w-7"
                title="Increase Font Size"
                onClick={() => adjustFontSize(2)}
                data-testid="button-increase-font"
              >
                <Plus className="w-3 h-3" />
              </Button>
            </div>

            {/* Edit Button */}
            {onEditLyrics && (
              <Button
                variant="secondary"
                size="sm"
                className="bg-gray-700 hover:bg-gray-600 p-1 h-7 w-7"
                title="Edit Lyrics"
                onClick={onEditLyrics}
                data-testid="button-edit-lyrics"
              >
                <Edit className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Lyrics Container */}
      <div 
        ref={containerRef}
        className="overflow-y-auto p-6 bg-gray-800"
        style={{ height: '340px' }}
        data-testid="lyrics-container"
      >
        {!song?.lyrics ? (
          <div className="text-center py-8 text-gray-400">
            <p>No lyrics available</p>
            {onEditLyrics && (
              <Button
                variant="outline"
                className="mt-4"
                onClick={onEditLyrics}
                data-testid="button-add-lyrics"
              >
                Add Lyrics
              </Button>
            )}
          </div>
        ) : hasTimestamps ? (
          <div className="space-y-6" style={{ fontSize: `${fontSize}px` }}>
            {lyrics.map((line, index) => {
              const isCurrent = index === currentLineIndex;
              const isPast = line.timestamp < currentTime && !isCurrent;
              const isFuture = line.timestamp > currentTime;
              
              return (
                <div
                  key={index}
                  data-line={index}
                  className={`transition-all duration-300 leading-relaxed ${
                    isCurrent
                      ? 'text-white bg-blue-600/20 px-4 py-2 rounded-lg border-l-4 border-blue-500 font-medium'
                      : isPast
                      ? 'text-gray-500'
                      : isFuture
                      ? 'text-gray-400'
                      : 'text-gray-300'
                  }`}
                  data-testid={`lyrics-line-${index}`}
                >
                  <div className="flex items-start">
                    <span className="flex-1">{line.text}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ fontSize: `${fontSize}px` }}>
            {plainLines.map((line: string, index: number) => (
              <div
                key={index}
                className="text-gray-300 leading-relaxed mb-4"
                data-testid={`lyrics-line-${index}`}
                id={`auto-scroll-line-${index}`}
              >
                {line}
              </div>
            ))}
            {/* Spacer for scrolling */}
            <div style={{ height: '50vh' }} />
          </div>
        )}
      </div>
    </div>
  );
}