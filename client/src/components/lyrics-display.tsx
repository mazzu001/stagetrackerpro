import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Minus, Edit } from "lucide-react";

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
  
  // Find current line based on timestamp
  const currentLineIndex = lyrics.findIndex((line, index) => {
    const nextLine = lyrics[index + 1];
    return line.timestamp <= currentTime && (!nextLine || nextLine.timestamp > currentTime);
  });

  // Auto-scroll to current line
  useEffect(() => {
    if (currentLineIndex >= 0 && containerRef.current) {
      const currentElement = containerRef.current.querySelector(`[data-line="${currentLineIndex}"]`);
      if (currentElement) {
        currentElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }
    }
  }, [currentLineIndex]);

  const adjustFontSize = (delta: number) => {
    const newSize = Math.max(12, Math.min(32, fontSize + delta));
    setFontSize(newSize);
    localStorage.setItem('lyrics-font-size', newSize.toString());
  };

  if (!song) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-800 rounded-lg">
        <p className="text-gray-400">No song selected</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-900 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gray-800 px-4 py-2 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-white">{song.title} - Lyrics</h3>
          
          <div className="flex items-center space-x-2">
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
        className="flex-1 overflow-y-auto p-6 bg-gray-800"
        data-testid="lyrics-container"
      >
        {lyrics.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p>No timestamped lyrics available</p>
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
        ) : (
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
                  <div className="flex items-start space-x-3">
                    <span className="text-xs text-gray-500 font-mono mt-1 min-w-[40px]">
                      {Math.floor(line.timestamp / 60)}:{(line.timestamp % 60).toString().padStart(2, '0')}
                    </span>
                    <span className="flex-1">{line.text}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}