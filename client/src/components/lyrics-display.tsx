import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Minus, Edit, ChevronUp, ChevronDown, Music } from "lucide-react";
import { useMidi } from "@/contexts/SimpleMidiContext";

interface LyricsLine {
  timestamp: number; // in seconds
  text: string;
  displayText: string; // Text without MIDI commands
  midiCommands: string[]; // Extracted MIDI commands like [[PC:2:1]]
}

interface LyricsDisplayProps {
  song: any | null;
  currentTime: number;
  duration: number;
  onEditLyrics?: () => void;
  isPlaying: boolean;
  allowMidi?: boolean; // Optional prop to disable MIDI (e.g. for viewers)
}

export function LyricsDisplay({ song, currentTime, duration, onEditLyrics, isPlaying, allowMidi = true }: LyricsDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [previousTime, setPreviousTime] = useState<number>(0);
  const [executedCommands, setExecutedCommands] = useState<Set<string>>(new Set());
  
  // MIDI integration - only if allowed and initialized
  const midi = useMidi();

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
      setExecutedCommands(new Set()); // Reset executed commands for new song
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

  // Extract MIDI commands from text
  const extractMidiCommands = (text: string): { displayText: string; midiCommands: string[] } => {
    const midiCommandRegex = /\[\[([A-Za-z_]+:[0-9]+(?::[0-9]+)?(?::[0-9]+)?)\]\]/g;
    const midiCommands: string[] = [];
    let displayText = text;
    
    // Find all MIDI commands
    let match;
    while ((match = midiCommandRegex.exec(text)) !== null) {
      midiCommands.push(match[0]); // Include the full [[...]] format
      displayText = displayText.replace(match[0], '').trim();
    }
    
    return { displayText, midiCommands };
  };

  // Parse lyrics with timestamps and extract MIDI commands
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
          const { displayText, midiCommands } = extractMidiCommands(text);
          parsedLines.push({ timestamp, text, displayText, midiCommands });
          estimatedTime = timestamp + 4; // Update estimated time for next non-timestamped line
        }
      } else {
        // Line without timestamp - still include it with estimated timing
        let text = trimmed;
        
        if (text) {
          const { displayText, midiCommands } = extractMidiCommands(text);
          parsedLines.push({ timestamp: estimatedTime, text, displayText, midiCommands });
          estimatedTime += 4; // Increment by 4 seconds for next line
        }
      }
    }
    
    return parsedLines.sort((a, b) => a.timestamp - b.timestamp);
  };

  const lyrics = song?.lyrics ? parseLyrics(song.lyrics) : [];
  
  // Check if lyrics actually contain timestamp patterns at start of lines
  const hasTimestamps = song?.lyrics ? 
    song.lyrics.split('\n').some((line: string) => {
      const trimmed = line.trim();
      return /^\[\d{1,2}:\d{2}\]/.test(trimmed);
    }) : false;
  
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

  // Execute MIDI commands from current lines
  useEffect(() => {
    if (!allowMidi || !isPlaying || !midi.isInitialized || currentLines.length === 0) return;
    
    currentLines.forEach((line, lineIndex) => {
      if (line.midiCommands.length === 0) return;
      
      // Create unique key for this line's commands
      const lineKey = `${line.timestamp}_${lyrics.indexOf(line)}`;
      
      // Check if we've already executed commands for this line
      if (executedCommands.has(lineKey)) return;
      
      // Execute all MIDI commands for this line
      line.midiCommands.forEach((commandString) => {
        const command = midi.parseCommand(commandString);
        if (command) {
          const success = midi.sendCommand(command);
          if (success) {
            console.log(`🎹 Executed MIDI command from lyrics: ${commandString} at ${line.timestamp}s`);
          }
        }
      });
      
      // Mark this line's commands as executed
      setExecutedCommands(prev => new Set(prev).add(lineKey));
    });
  }, [currentLines, isPlaying, allowMidi, midi, lyrics, executedCommands]);

  // Reset executed commands on seek
  useEffect(() => {
    const timeDifference = currentTime - previousTime;
    const isBackwardSeek = timeDifference < -1; // More than 1 second backward
    const isLargeJump = Math.abs(timeDifference) > 5 && previousTime > 0; // Jump more than 5 seconds
    
    if (isBackwardSeek || isLargeJump) {
      setExecutedCommands(new Set());
    }
    
    setPreviousTime(currentTime);
  }, [currentTime, previousTime]);

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

  // Auto-scroll for non-timestamped lyrics (continuous scrolling)
  useEffect(() => {
    if (!hasTimestamps && autoScrollEnabled && isPlaying && lyrics.length > 0 && containerRef.current) {
      const scrollInterval = setInterval(() => {
        if (containerRef.current) {
          containerRef.current.scrollTop += scrollSpeed * 2;
        }
      }, 100);

      return () => clearInterval(scrollInterval);
    }
  }, [hasTimestamps, autoScrollEnabled, isPlaying, lyrics.length, scrollSpeed]);

  const handleIncreaseFontSize = () => {
    const newSize = Math.min(fontSize + 2, 36);
    setFontSize(newSize);
    localStorage.setItem('lyrics-font-size', String(newSize));
  };

  const handleDecreaseFontSize = () => {
    const newSize = Math.max(fontSize - 2, 12);
    setFontSize(newSize);
    localStorage.setItem('lyrics-font-size', String(newSize));
  };

  const handleIncreaseScrollSpeed = () => {
    const newSpeed = Math.min(scrollSpeed + 0.2, 3.0);
    setScrollSpeed(newSpeed);
    localStorage.setItem('lyrics-scroll-speed', String(newSpeed));
  };

  const handleDecreaseScrollSpeed = () => {
    const newSpeed = Math.max(scrollSpeed - 0.2, 0.2);
    setScrollSpeed(newSpeed);
    localStorage.setItem('lyrics-scroll-speed', String(newSpeed));
  };

  const toggleAutoScroll = () => {
    const newState = !autoScrollEnabled;
    setAutoScrollEnabled(newState);
    localStorage.setItem('lyrics-auto-scroll', String(newState));
  };

  return (
    <div className="h-full flex flex-col bg-gray-900 rounded-lg overflow-hidden">
      {/* Controls */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Lyrics</span>
          {onEditLyrics && (
            <Button size="sm" variant="ghost" onClick={onEditLyrics} data-testid="button-edit-lyrics">
              <Edit className="h-3 w-3" />
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Font size controls */}
          <Button size="sm" variant="ghost" onClick={handleDecreaseFontSize} data-testid="button-decrease-font">
            <Minus className="h-3 w-3" />
          </Button>
          <span className="text-xs min-w-[40px] text-center">{fontSize}px</span>
          <Button size="sm" variant="ghost" onClick={handleIncreaseFontSize} data-testid="button-increase-font">
            <Plus className="h-3 w-3" />
          </Button>
          
          {/* Scroll speed controls for non-timestamped lyrics */}
          {!hasTimestamps && (
            <>
              <div className="w-px h-4 bg-gray-600 mx-1" />
              <Button size="sm" variant="ghost" onClick={handleDecreaseScrollSpeed} data-testid="button-decrease-scroll">
                <ChevronDown className="h-3 w-3" />
              </Button>
              <span className="text-xs min-w-[40px] text-center">{scrollSpeed.toFixed(1)}x</span>
              <Button size="sm" variant="ghost" onClick={handleIncreaseScrollSpeed} data-testid="button-increase-scroll">
                <ChevronUp className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant={autoScrollEnabled ? "default" : "ghost"}
                onClick={toggleAutoScroll}
                className="ml-2"
                data-testid="button-toggle-autoscroll"
              >
                Auto
              </Button>
            </>
          )}
        </div>
      </div>
      
      {/* Lyrics content */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden p-6"
        style={{
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
              // Skip empty display text lines
              if (!line.displayText.trim()) {
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
                >
                  <div className="flex items-start gap-2">
                    <span className="flex-1">{line.displayText}</span>
                    {line.midiCommands.length > 0 && (
                      <div className="flex items-center gap-1 ml-2">
                        <Music className={`h-3 w-3 ${
                          hasTimestamps ? (
                            isCurrent 
                              ? 'text-blue-300' 
                              : isPast 
                              ? 'text-gray-600' 
                              : 'text-gray-500'
                          ) : (
                            isCurrent
                              ? 'text-blue-300'
                              : 'text-gray-500'
                          )
                        }`} />
                        <span className={`text-xs font-mono ${
                          hasTimestamps ? (
                            isCurrent 
                              ? 'text-blue-300' 
                              : isPast 
                              ? 'text-gray-600' 
                              : 'text-gray-500'
                          ) : (
                            isCurrent
                              ? 'text-blue-300'
                              : 'text-gray-500'
                          )
                        }`}>
                          {line.midiCommands.length}
                        </span>
                      </div>
                    )}
                  </div>
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