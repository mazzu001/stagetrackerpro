import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { AlignLeft, Type, Plus, Minus, ChevronUp, ChevronDown, Edit } from "lucide-react";
import { parseLyricsWithMidi } from "@/lib/midi-parser";
import type { SongWithTracks } from "@shared/schema";

interface LyricsDisplayProps {
  song?: SongWithTracks;
  currentTime: number;
  onEditLyrics?: () => void;
}

export default function LyricsDisplay({ song, currentTime, onEditLyrics }: LyricsDisplayProps) {
  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const [lastScrolledLine, setLastScrolledLine] = useState(-1);
  const [scrollSpeed, setScrollSpeed] = useState(() => {
    // Load scroll speed from localStorage, default to 1.0
    const saved = localStorage.getItem('lyrics-scroll-speed');
    return saved ? parseFloat(saved) : 1.0;
  });
  
  const [fontSize, setFontSize] = useState(() => {
    // Load font size from localStorage, default to 18px
    const saved = localStorage.getItem('lyrics-font-size');
    return saved ? parseInt(saved) : 18;
  });

  const parsedLyrics = song?.lyrics ? parseLyricsWithMidi(song.lyrics) : [];

  // Save scroll speed to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('lyrics-scroll-speed', scrollSpeed.toString());
  }, [scrollSpeed]);

  // Save font size to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('lyrics-font-size', fontSize.toString());
  }, [fontSize]);

  const adjustScrollSpeed = (delta: number) => {
    setScrollSpeed(prev => {
      const newSpeed = Math.max(0.1, Math.min(3.0, prev + delta));
      return Math.round(newSpeed * 10) / 10; // Round to 1 decimal place
    });
  };

  const adjustFontSize = (delta: number) => {
    setFontSize(prev => {
      const newSize = Math.max(12, Math.min(36, prev + delta));
      return newSize;
    });
  };
  
  // Check if lyrics contain actual timestamps (not just default sequential ones)
  const hasRealTimestamps = parsedLyrics.some((line, index) => {
    // Real timestamps won't follow the sequential 5-second pattern
    return line.timestamp !== (index + 1) * 5;
  });

  const currentLineIndex = hasRealTimestamps ? parsedLyrics.findIndex((line, index) => {
    const nextLine = parsedLyrics[index + 1];
    return line.timestamp <= currentTime && (!nextLine || nextLine.timestamp > currentTime);
  }) : -1; // Don't highlight lines when no real timestamps

  // Scrolling logic based on whether lyrics have timestamps
  useEffect(() => {
    if (!song || parsedLyrics.length === 0 || !lyricsContainerRef.current) return;
    
    const container = lyricsContainerRef.current;

    if (hasRealTimestamps && currentLineIndex >= 0 && currentLineIndex !== lastScrolledLine) {
      const currentLineElement = container.querySelector(`[data-testid="lyrics-line-${currentLineIndex}"]`) as HTMLElement;
      
      if (currentLineElement) {
        const containerHeight = container.clientHeight;
        const currentScrollTop = container.scrollTop;
        const lineTop = currentLineElement.offsetTop;
        const lineCenter = lineTop + (currentLineElement.offsetHeight / 2);
        
        // Calculate the center point of the visible area
        const visibleCenter = currentScrollTop + (containerHeight / 2);
        
        // Only scroll when the highlighted line is below the center mark
        // This keeps the highlighted line centered throughout the song
        if (lineCenter > visibleCenter) {
          // Scroll down by one line height to keep the highlighted line centered
          const nextScrollTop = currentScrollTop + (currentLineElement.offsetHeight + 16); // 16px for space-y-4
          const maxScrollTop = container.scrollHeight - containerHeight;
          
          container.scrollTo({
            top: Math.min(nextScrollTop, maxScrollTop),
            behavior: 'smooth'
          });
        }
        
        setLastScrolledLine(currentLineIndex);
      }
    } else if (!hasRealTimestamps && currentTime >= 5) {
      // Non-timestamped lyrics: smooth auto-scroll based on song progress with adjustable speed
      const songDuration = song.duration || 300; // Default to 5 minutes if no duration
      const adjustedDuration = (songDuration - 5) / scrollSpeed; // Apply scroll speed multiplier
      const scrollProgress = Math.min((currentTime - 5) / adjustedDuration, 1); // Start scrolling after 5 seconds
      
      const maxScrollTop = container.scrollHeight - container.clientHeight;
      const targetScrollTop = scrollProgress * maxScrollTop;
      
      container.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior: 'smooth'
      });
    }
  }, [currentTime, song, parsedLyrics.length, currentLineIndex, lastScrolledLine, hasRealTimestamps, scrollSpeed]);

  if (!song) {
    return (
      <div className="bg-surface rounded-xl p-6 border border-gray-700 flex flex-col h-full min-h-0">
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <h2 className="text-xl font-semibold flex items-center">
            <AlignLeft className="mr-2 text-accent w-5 h-5" />
            Lyrics
          </h2>
        </div>
        <div className="flex-1 flex items-center justify-center text-gray-400">
          Select a song to view lyrics
        </div>
      </div>
    );
  }

  const midiEventCount = song.midiEvents?.length || 0;
  const totalLines = parsedLyrics.length;

  return (
    <div className="bg-surface rounded-xl p-6 border border-gray-700 flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <h2 className="text-xl font-semibold flex items-center">
          <AlignLeft className="mr-2 text-accent w-5 h-5" />
          Lyrics
        </h2>
        <div className="flex items-center space-x-2">
          {onEditLyrics && (
            <Button
              variant="outline"
              size="sm"
              onClick={onEditLyrics}
              className="h-7 px-2 text-xs"
              data-testid="button-edit-lyrics-inline"
            >
              <Edit className="w-3 h-3 mr-1" />
              Edit
            </Button>
          )}
          
          <span className={`text-xs px-2 py-1 rounded ${
            parsedLyrics.some((line, index) => line.timestamp !== (index + 1) * 5)
              ? 'bg-primary/20 text-primary'
              : 'bg-accent/20 text-accent'
          }`}>
            {parsedLyrics.some((line, index) => line.timestamp !== (index + 1) * 5)
              ? 'TIMESTAMP-SYNC'
              : `${scrollSpeed}x`
            }
          </span>
          
          {!hasRealTimestamps && (
            <div className="flex items-center space-x-1">
              <Button
                variant="secondary"
                size="sm"
                className="bg-gray-700 hover:bg-gray-600 p-1 h-7 w-7"
                title="Decrease Scroll Speed"
                onClick={() => adjustScrollSpeed(-0.1)}
                data-testid="button-decrease-speed"
              >
                <ChevronDown className="w-3 h-3" />
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="bg-gray-700 hover:bg-gray-600 p-1 h-7 w-7"
                title="Increase Scroll Speed"
                onClick={() => adjustScrollSpeed(0.1)}
                data-testid="button-increase-speed"
              >
                <ChevronUp className="w-3 h-3" />
              </Button>
            </div>
          )}
          
          <div className="flex items-center space-x-1">
            <Button
              variant="secondary"
              size="sm"
              className="bg-gray-700 hover:bg-gray-600 p-1 h-7 w-7"
              title="Decrease Font Size"
              onClick={() => adjustFontSize(-1)}
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
              onClick={() => adjustFontSize(1)}
              data-testid="button-increase-font"
            >
              <Plus className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </div>
      
      <div 
        ref={lyricsContainerRef}
        className="lyrics-container bg-gray-800 rounded-lg p-4 flex-1 min-h-0 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800"
        data-testid="lyrics-container"
      >
        {parsedLyrics.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            No lyrics available for this song
          </div>
        ) : (
          <div className="space-y-4 leading-relaxed" style={{ fontSize: `${fontSize}px` }}>
            {parsedLyrics.map((line, index) => {
              const isCurrentLine = hasRealTimestamps && index === currentLineIndex;
              const isUpcoming = hasRealTimestamps && line.timestamp > currentTime;
              
              return (
                <div 
                  key={index}
                  className={`transition-all duration-300 ${
                    line.type === 'midi' 
                      ? 'text-gray-500 text-sm'
                      : isCurrentLine
                        ? 'text-white bg-primary/20 px-2 py-1 rounded border-l-4 border-primary'
                        : isUpcoming
                          ? 'text-gray-400'
                          : hasRealTimestamps 
                            ? 'text-gray-500'
                            : 'text-gray-300' // All lines same color for auto-scroll
                  }`}
                  data-testid={`lyrics-line-${index}`}
                >
                  {line.type === 'midi' ? (
                    <div className="flex items-center">
                      <span>[{Math.floor(line.timestamp / 60)}:{Math.floor(line.timestamp % 60).toString().padStart(2, '0')}] {line.content}</span>
                      <span className="bg-accent/20 text-accent px-1 rounded text-xs ml-2">MIDI</span>
                    </div>
                  ) : (
                    <div>
                      {line.content}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      <div className="mt-4 pt-4 border-t border-gray-600 flex-shrink-0">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-4">
            <span className="text-gray-400">
              Line: <span className="text-white">{Math.max(0, currentLineIndex + 1)}/{totalLines}</span>
            </span>
            <span className="text-gray-400">
              MIDI Events: <span className="text-accent">{midiEventCount}</span>
            </span>
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="bg-primary/20 text-primary hover:bg-primary/30"
            data-testid="button-midi-timeline"
          >
            View MIDI Timeline
          </Button>
        </div>
      </div>
    </div>
  );
}
