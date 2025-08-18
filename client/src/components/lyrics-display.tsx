import { useEffect, useRef } from "react";
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
          // Use timestamp-based scrolling: scroll to current line
          const currentLineElement = container.querySelector(`[data-testid="lyrics-line-${currentLineIndex}"]`) as HTMLElement;
          if (currentLineElement) {
            const containerHeight = container.clientHeight;
            const lineOffsetTop = currentLineElement.offsetTop;
            const lineHeight = currentLineElement.offsetHeight;
            
            // Center the current line in the container
            const targetScrollTop = lineOffsetTop - (containerHeight / 2) + (lineHeight / 2);
            
            container.scrollTo({
              top: Math.max(0, targetScrollTop),
              behavior: 'smooth'
            });
          }
        }
      } else {
        // For lyrics without timestamps, only start scrolling after the first 5-second mark
        if (currentTime >= 5) {
          const songDuration = song.duration || 180; // Default to 3 minutes if no duration
          const progress = Math.min(currentTime / songDuration, 1); // Cap at 100%
          
          // Calculate smooth scroll position based on progress
          const maxScrollTop = container.scrollHeight - container.clientHeight;
          const targetScrollTop = progress * maxScrollTop;
          
          // Use smooth scrolling
          container.scrollTo({
            top: targetScrollTop,
            behavior: 'smooth'
          });
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
