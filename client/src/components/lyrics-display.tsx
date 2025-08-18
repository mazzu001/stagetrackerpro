import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { AlignLeft, Type } from "lucide-react";
import { parseLyricsWithMidi } from "@/lib/midi-parser";
import type { SongWithTracks } from "@shared/schema";

interface LyricsDisplayProps {
  song?: SongWithTracks;
  currentTime: number;
}

export default function LyricsDisplay({ song, currentTime }: LyricsDisplayProps) {
  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const [lastScrolledLine, setLastScrolledLine] = useState(-1);

  const parsedLyrics = song?.lyrics ? parseLyricsWithMidi(song.lyrics) : [];
  
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

    if (hasRealTimestamps && currentLineIndex >= 0) {
      // Timestamped lyrics: line-based scrolling with highlighting
      const firstTimestamp = Math.min(...parsedLyrics.map(line => line.timestamp));
      const shouldStartScrolling = currentTime >= firstTimestamp;
      
      if (shouldStartScrolling && currentLineIndex !== lastScrolledLine) {
        const currentLineElement = container.querySelector(`[data-testid="lyrics-line-${currentLineIndex}"]`) as HTMLElement;
        
        if (currentLineElement) {
          const containerHeight = container.clientHeight;
          const currentScrollTop = container.scrollTop;
          const lineTop = currentLineElement.offsetTop;
          const lineBottom = lineTop + currentLineElement.offsetHeight;
          
          const visibleTop = currentScrollTop;
          const visibleBottom = currentScrollTop + containerHeight;
          
          const lineCompletelyAbove = lineBottom < visibleTop;
          const lineCompletelyBelow = lineTop > visibleBottom;
          const needsScroll = lineCompletelyAbove || lineCompletelyBelow;
          
          if (needsScroll) {
            let targetScrollTop;
            
            if (lineCompletelyBelow) {
              targetScrollTop = lineBottom - containerHeight + 20;
            } else if (lineCompletelyAbove) {
              targetScrollTop = lineTop - 20;
            } else {
              targetScrollTop = currentScrollTop;
            }
            
            container.scrollTo({
              top: Math.max(0, targetScrollTop),
              behavior: 'smooth'
            });
          }
          
          setLastScrolledLine(currentLineIndex);
        }
      }
    } else if (!hasRealTimestamps && currentTime >= 5) {
      // Non-timestamped lyrics: smooth auto-scroll based on song progress
      const songDuration = song.duration || 300; // Default to 5 minutes if no duration
      const scrollProgress = Math.min((currentTime - 5) / (songDuration - 5), 1); // Start scrolling after 5 seconds
      
      const maxScrollTop = container.scrollHeight - container.clientHeight;
      const targetScrollTop = scrollProgress * maxScrollTop;
      
      container.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior: 'smooth'
      });
    }
  }, [currentTime, song, parsedLyrics.length, currentLineIndex, lastScrolledLine, hasRealTimestamps]);

  if (!song) {
    return (
      <div className="bg-surface rounded-xl p-6 border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center">
            <AlignLeft className="mr-2 text-accent w-5 h-5" />
            Lyrics
          </h2>
        </div>
        <div className="text-center py-8 text-gray-400">
          Select a song to view lyrics
        </div>
      </div>
    );
  }

  const midiEventCount = song.midiEvents?.length || 0;
  const totalLines = parsedLyrics.length;

  return (
    <div className="bg-surface rounded-xl p-6 border border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold flex items-center">
          <AlignLeft className="mr-2 text-accent w-5 h-5" />
          Lyrics
        </h2>
        <div className="flex items-center space-x-2">
          <span className={`text-xs px-2 py-1 rounded ${
            parsedLyrics.some((line, index) => line.timestamp !== (index + 1) * 5)
              ? 'bg-primary/20 text-primary'
              : 'bg-accent/20 text-accent'
          }`}>
            {parsedLyrics.some((line, index) => line.timestamp !== (index + 1) * 5)
              ? 'TIMESTAMP-SYNC'
              : 'AUTO-SCROLL'
            }
          </span>
          <Button
            variant="secondary"
            size="sm"
            className="bg-gray-700 hover:bg-gray-600 p-2"
            title="Font Size"
            data-testid="button-font-size"
          >
            <Type className="w-4 h-4" />
          </Button>
        </div>
      </div>
      
      <div 
        ref={lyricsContainerRef}
        className="lyrics-container bg-gray-800 rounded-lg p-4 h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800"
        data-testid="lyrics-container"
      >
        {parsedLyrics.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            No lyrics available for this song
          </div>
        ) : (
          <div className="space-y-4 text-lg leading-relaxed">
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
      
      <div className="mt-4 pt-4 border-t border-gray-600">
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
