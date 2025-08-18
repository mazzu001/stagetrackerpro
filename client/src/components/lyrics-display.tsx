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
  const [lastScrolledLine, setLastScrolledLine] = useState(-1);

  const parsedLyrics = song?.lyrics ? parseLyricsWithMidi(song.lyrics) : [];
  
  const currentLineIndex = parsedLyrics.findIndex((line, index) => {
    const nextLine = parsedLyrics[index + 1];
    return line.timestamp <= currentTime && (!nextLine || nextLine.timestamp > currentTime);
  });

  // Smart auto-scroll: timestamp-based when available, progress-based fallback
  useEffect(() => {
    if (song && parsedLyrics.length > 0 && lyricsContainerRef.current) {
      const container = lyricsContainerRef.current;
      
      // Check if lyrics contain actual timestamps (not just default sequential ones)
      const hasRealTimestamps = parsedLyrics.some((line, index) => {
        // Real timestamps won't follow the sequential 5-second pattern
        return line.timestamp !== (index + 1) * 5;
      });
      
      if (hasRealTimestamps) {
        // Only start scrolling when we reach the first timestamp
        const firstTimestamp = Math.min(...parsedLyrics.map(line => line.timestamp));
        
        if (currentTime >= firstTimestamp && currentLineIndex >= 0) {
          // Only scroll when line changes and with much longer throttling for readability
          const now = Date.now();
          const timeSinceLastScroll = now - lastScrollTime;
          
          if (currentLineIndex !== lastScrolledLine && timeSinceLastScroll > 1500) {
            // Use timestamp-based scrolling with very gentle movement
            const currentLineElement = container.querySelector(`[data-testid="lyrics-line-${currentLineIndex}"]`) as HTMLElement;
            if (currentLineElement) {
              const containerHeight = container.clientHeight;
              const lineOffsetTop = currentLineElement.offsetTop;
              const currentScrollTop = container.scrollTop;
              
              // Only scroll if the current line is getting close to the bottom of visible area
              const linePositionInContainer = lineOffsetTop - currentScrollTop;
              const shouldScroll = linePositionInContainer > (containerHeight * 0.7);
              
              if (shouldScroll) {
                // Very gentle scroll - just move enough to keep current line visible
                // Position current line in middle of container for optimal reading
                const targetScrollTop = lineOffsetTop - (containerHeight * 0.4);
                
                // Use CSS scroll-behavior for ultra-smooth movement
                container.style.scrollBehavior = 'smooth';
                container.scrollTop = Math.max(0, targetScrollTop);
              }
              
              setLastScrollTime(now);
              setLastScrolledLine(currentLineIndex);
            }
          }
        }
      } else {
        // For lyrics without timestamps, use very gentle progress-based scrolling
        if (currentTime >= 5) {
          const now = Date.now();
          const timeSinceLastScroll = now - lastScrollTime;
          
          // Only update scroll every 5 seconds for very smooth experience
          if (timeSinceLastScroll > 5000) {
            const songDuration = song.duration || 180; // Default to 3 minutes if no duration
            // Much slower progress calculation - only use 70% of the song duration
            const adjustedDuration = songDuration * 0.7;
            const progress = Math.min(currentTime / adjustedDuration, 1);
            
            // Very gradual scroll movement
            const maxScrollTop = container.scrollHeight - container.clientHeight;
            const targetScrollTop = progress * maxScrollTop;
            const currentScrollTop = container.scrollTop;
            
            // Move only a small amount each time for ultra-smooth experience
            const scrollDifference = targetScrollTop - currentScrollTop;
            const gentleScrollAmount = scrollDifference * 0.3; // Move only 30% of the way
            
            container.style.scrollBehavior = 'smooth';
            container.scrollTop = currentScrollTop + gentleScrollAmount;
            
            setLastScrollTime(now);
          }
        }
      }
    }
  }, [currentTime, song, parsedLyrics.length, currentLineIndex]);

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
        style={{ scrollBehavior: 'smooth' }}
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
