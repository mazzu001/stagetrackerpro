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
  const [lastScrollTime, setLastScrollTime] = useState(0);

  const parsedLyrics = song?.lyrics ? parseLyricsWithMidi(song.lyrics) : [];
  
  const currentLineIndex = parsedLyrics.findIndex((line, index) => {
    const nextLine = parsedLyrics[index + 1];
    return line.timestamp <= currentTime && (!nextLine || nextLine.timestamp > currentTime);
  });

  // Adaptive smooth scrolling that keeps current line centered
  useEffect(() => {
    if (song && parsedLyrics.length > 0 && lyricsContainerRef.current && currentLineIndex >= 0) {
      const container = lyricsContainerRef.current;
      const containerHeight = container.clientHeight;
      const containerCenter = containerHeight / 2;
      const now = Date.now();
      
      // Check if lyrics contain actual timestamps (not just default sequential ones)
      const hasRealTimestamps = parsedLyrics.some((line, index) => {
        // Real timestamps won't follow the sequential 5-second pattern
        return line.timestamp !== (index + 1) * 5;
      });
      
      let shouldStartScrolling = false;
      
      if (hasRealTimestamps) {
        // For timestamped lyrics, wait until first timestamp is reached
        const firstTimestamp = Math.min(...parsedLyrics.map(line => line.timestamp));
        shouldStartScrolling = currentTime >= firstTimestamp;
      } else {
        // For non-timestamped lyrics, wait 5 seconds
        shouldStartScrolling = currentTime >= 5;
      }
      
      if (shouldStartScrolling) {
        // Throttle scrolling updates to prevent excessive movement
        const timeSinceLastScroll = now - lastScrollTime;
        if (timeSinceLastScroll < 200) return; // Wait at least 200ms between scroll updates
        
        // Get the current active line element
        const currentLineElement = container.querySelector(`[data-testid="lyrics-line-${currentLineIndex}"]`) as HTMLElement;
        
        if (currentLineElement) {
          const lineOffsetTop = currentLineElement.offsetTop;
          const lineHeight = currentLineElement.offsetHeight;
          const currentScrollTop = container.scrollTop;
          
          // Calculate where the line currently appears in the visible area
          const linePositionInContainer = lineOffsetTop - currentScrollTop;
          const lineCenterInContainer = linePositionInContainer + (lineHeight / 2);
          
          // Calculate distance from ideal center position
          const distanceFromCenter = Math.abs(lineCenterInContainer - containerCenter);
          
          // Only scroll if line is significantly off-center (more than 20% of container height)
          if (distanceFromCenter > containerHeight * 0.2) {
            // Calculate target scroll position to center the line
            const idealScrollTop = lineOffsetTop - containerCenter + (lineHeight / 2);
            
            // Use gradual movement - only move 30% of the way toward target
            const scrollDifference = idealScrollTop - currentScrollTop;
            const gentleScrollAmount = scrollDifference * 0.3;
            const targetScrollTop = currentScrollTop + gentleScrollAmount;
            
            // Apply gentle scroll movement
            container.scrollTo({
              top: Math.max(0, targetScrollTop),
              behavior: 'smooth'
            });
            
            setLastScrollTime(now);
          }
        }
      }
    }
  }, [currentTime, song, parsedLyrics.length, currentLineIndex, lastScrollTime]);

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
              const isCurrentLine = index === currentLineIndex;
              const isUpcoming = line.timestamp > currentTime;
              
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
                          : 'text-gray-500'
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
