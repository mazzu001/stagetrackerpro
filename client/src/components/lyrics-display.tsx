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
  duration: number;
  onEditLyrics?: () => void;
  isPlaying: boolean;
}

export function LyricsDisplay({ song, currentTime, duration, onEditLyrics, isPlaying }: LyricsDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [previousTime, setPreviousTime] = useState<number>(0);

  const [fontSize, setFontSize] = useState(() => {
    const saved = localStorage.getItem('lyrics-font-size');
    return saved ? parseInt(saved) : 18;
  });
  const [scrollSpeed, setScrollSpeed] = useState(() => {
    const saved = localStorage.getItem('lyrics-scroll-speed');
    return saved ? parseFloat(saved) : 1.0;
  });
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(() => {
    return localStorage.getItem('lyrics-auto-scroll') !== 'false';
  });

  // Reset scroll position when song changes
  useEffect(() => {
    if (containerRef.current && song) {
      containerRef.current.scrollTop = 0;
    }
  }, [song?.id]); // Trigger when song ID changes

  // Listen for font size changes from external controls
  useEffect(() => {
    const handleFontChange = () => {
      const newSize = parseInt(localStorage.getItem('lyrics-font-size') || '18');
      setFontSize(newSize);
    };

    const handleScrollChange = () => {
      const newSpeed = parseFloat(localStorage.getItem('lyrics-scroll-speed') || '1.0');
      setScrollSpeed(newSpeed);
    };

    const handleAutoScrollChange = () => {
      const enabled = localStorage.getItem('lyrics-auto-scroll') !== 'false';
      setAutoScrollEnabled(enabled);
    };

    window.addEventListener('lyrics-font-change', handleFontChange);
    window.addEventListener('lyrics-scroll-change', handleScrollChange);
    window.addEventListener('lyrics-auto-scroll-change', handleAutoScrollChange);
    return () => {
      window.removeEventListener('lyrics-font-change', handleFontChange);
      window.removeEventListener('lyrics-scroll-change', handleScrollChange);
      window.removeEventListener('lyrics-auto-scroll-change', handleAutoScrollChange);
    };
  }, []);


  // Parse lyrics with timestamps
  const parseLyrics = (lyricsText: string): LyricsLine[] => {
    if (!lyricsText) return [];
    
    const lines = lyricsText.split('\n');
    const parsedLines: LyricsLine[] = [];
    let estimatedTime = 0; // For lines without timestamps
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      // Look for timestamp pattern [mm:ss] or [m:ss] at start of line only
      const timestampMatch = trimmed.match(/^\[(\d{1,2}):(\d{2})\]/);
      
      if (timestampMatch) {
        // Line with timestamp
        const minutes = parseInt(timestampMatch[1]);
        const seconds = parseInt(timestampMatch[2]);
        const timestamp = minutes * 60 + seconds;
        let text = trimmed.substring(timestampMatch[0].length).trim();
        
        if (text) {
          parsedLines.push({ timestamp, text });
          estimatedTime = timestamp + 4; // Update estimated time for next non-timestamped line
        }
      } else {
        // Line without timestamp - still include it with estimated timing
        let text = trimmed;
        
        if (text) {
          parsedLines.push({ timestamp: estimatedTime, text });
          estimatedTime += 4; // Increment by 4 seconds for next line
        }
      }
    }
    
    return parsedLines.sort((a, b) => a.timestamp - b.timestamp);
  };

  const lyrics = song?.lyrics ? parseLyrics(song.lyrics) : [];
  
  // Check if lyrics actually contain timestamp patterns at start of lines
  // Only matches [MM:SS] format at the very beginning of a line
  const hasTimestamps = song?.lyrics ? 
    song.lyrics.split('\n').some((line: string) => {
      const trimmed = line.trim();
      // Must start with [MM:SS] pattern (may or may not have content after)
      return /^\[\d{1,2}:\d{2}\]/.test(trimmed);
    }) : false;
  
  // Note: plainLines no longer needed - using unified lyrics array for both modes
  

  
  // Find all current lines at the current timestamp (handle multiple lines with same timestamp)
  const getCurrentLines = () => {
    if (lyrics.length === 0) return [];
    
    // Find all lines that should be active at current time
    const activeLines: LyricsLine[] = [];
    
    // Get unique timestamps in chronological order
    const timestamps = Array.from(new Set(lyrics.map(line => line.timestamp))).sort((a, b) => a - b);
    
    // Find the current timestamp range
    let currentTimestamp = -1;
    for (let i = 0; i < timestamps.length; i++) {
      const timestamp = timestamps[i];
      const nextTimestamp = timestamps[i + 1];
      
      if (timestamp <= currentTime && (!nextTimestamp || nextTimestamp > currentTime)) {
        currentTimestamp = timestamp;
        break;
      }
    }
    
    // If we found a current timestamp, get all lines with that timestamp
    if (currentTimestamp >= 0) {
      return lyrics.filter(line => line.timestamp === currentTimestamp);
    }
    
    return [];
  };
  
  const currentLines = getCurrentLines();
  const currentLineIndex = currentLines.length > 0 ? lyrics.findIndex(line => line === currentLines[0]) : -1;



  // Track previous time for seek detection  
  useEffect(() => {
    setPreviousTime(currentTime);
  }, [currentTime]);

  
  
  


  // Scroll lyrics back to top when playback stops
  useEffect(() => {
    if (!isPlaying && containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [isPlaying]);


  // Auto-scroll for timestamped lyrics
  useEffect(() => {
    if (hasTimestamps && currentLineIndex >= 0 && containerRef.current) {
      const container = containerRef.current;
      const currentElement = container.querySelector(`[data-line="${currentLineIndex}"]`);
      if (currentElement && container) {
        // Calculate the position to scroll to within the container
        const containerRect = container.getBoundingClientRect();
        const elementRect = currentElement.getBoundingClientRect();
        const relativeTop = elementRect.top - containerRect.top;
        const containerHeight = container.clientHeight;
        const targetScrollTop = container.scrollTop + relativeTop - (containerHeight / 2) + (elementRect.height / 2);
        
        // Smooth scroll within the container only
        container.scrollTo({
          top: targetScrollTop,
          behavior: 'smooth'
        });
      }
    }
  }, [currentLineIndex, hasTimestamps]);

  // Timer-based auto-scroll for non-timestamped lyrics
  useEffect(() => {
    let scrollTimer: NodeJS.Timeout | null = null;
    
    if (!hasTimestamps && lyrics.length > 0 && containerRef.current && autoScrollEnabled && currentTime > 0) {
      const container = containerRef.current;
      
      // Calculate scroll increment based on speed setting for ultra-smooth scrolling
      // scrollSpeed ranges from 0.1 to 2.0, use very short intervals for smoothness
      const baseInterval = 50; // 50ms for ultra-smooth animation
      const intervalMs = Math.max(20, baseInterval / scrollSpeed); // Min 20ms, faster speed = shorter interval
      const scrollIncrement = 0.5; // very small increments for ultra-smoothness
      
      scrollTimer = setInterval(() => {
        if (container && currentTime > 0) {
          const contentHeight = container.scrollHeight;
          const containerHeight = container.clientHeight;
          const maxScrollDistance = Math.max(0, contentHeight - containerHeight);
          
          if (container.scrollTop < maxScrollDistance) {
            container.scrollTop += scrollIncrement;
          }
        }
      }, intervalMs);
    }
    
    return () => {
      if (scrollTimer) {
        clearInterval(scrollTimer);
      }
    };
  }, [currentTime > 0, hasTimestamps, lyrics.length, scrollSpeed, autoScrollEnabled]);

  const adjustFontSize = (delta: number) => {
    const newSize = Math.max(12, Math.min(32, fontSize + delta));
    setFontSize(newSize);
    localStorage.setItem('lyrics-font-size', newSize.toString());
  };

  const adjustScrollSpeed = (delta: number) => {
    const newSpeed = Math.max(0.1, Math.min(2.0, scrollSpeed + delta));
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
    <div style={{ 
      width: '100%', 
      height: '100%',
      backgroundColor: '#111827',
      borderRadius: '8px',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      contain: 'layout style paint'
    }}>
      

      

      {/* Lyrics Container */}
      <div 
        ref={containerRef}
        className="mobile-lyrics-spacing"
        style={{ 
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '24px',
          backgroundColor: '#1f2937',
          position: 'relative',
          contain: 'layout style paint',
          scrollBehavior: 'smooth'
        }}
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
        ) : (
          // Unified rendering for both timestamped and non-timestamped lyrics
          <div className={hasTimestamps ? "space-y-6" : "space-y-4"} style={{ fontSize: `${fontSize}px` }}>
            {lyrics.map((line, index) => {
              // Skip empty lines
              if (!line.text.trim()) {
                return null;
              }
              
              const isCurrent = index === currentLineIndex;
              const isPast = line.timestamp < currentTime && !isCurrent;
              const isFuture = line.timestamp > currentTime;
              
              return (
                <div
                  key={index}
                  data-line={index}
                  className={`transition-all duration-300 leading-relaxed ${
                    hasTimestamps ? (
                      isCurrent
                        ? 'text-white bg-blue-600/20 px-4 py-2 rounded-lg border-l-4 border-blue-500 font-medium'
                        : isPast
                        ? 'text-gray-500'
                        : isFuture
                        ? 'text-gray-400'
                        : 'text-gray-300'
                    ) : (
                      isCurrent
                        ? 'text-white bg-blue-600/20 px-4 py-2 rounded-lg border-l-4 border-blue-500 font-medium'
                        : 'text-gray-300'
                    )
                  }`}
                  data-testid={`lyrics-line-${index}`}
                  id={!hasTimestamps ? `auto-scroll-line-${index}` : undefined}
                >
                  <span className="flex-1">{line.text}</span>
                </div>
              );
            })}
            {/* Spacer for scrolling in non-timestamped mode */}
            {!hasTimestamps && <div style={{ height: '50vh' }} />}
          </div>
        )}
      </div>
    </div>
  );
}