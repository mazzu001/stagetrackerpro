import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Minus, Edit, ChevronUp, ChevronDown, Headphones, Square, Activity } from "lucide-react";

interface LyricsLine {
  timestamp: number; // in seconds
  text: string;
}

interface LyricsDisplayProps {
  song: any | null;
  currentTime: number;
  duration: number;
  onEditLyrics?: () => void;
}

export function LyricsDisplay({ song, currentTime, duration, onEditLyrics }: LyricsDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
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
  
  // MIDI listening state
  const [isListening, setIsListening] = useState(false);
  const [capturedMessages, setCapturedMessages] = useState<{ message: string; timestamp: number; device: string }[]>([]);
  const [midiAccess, setMidiAccess] = useState<any>(null);

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

  // Initialize MIDI access
  useEffect(() => {
    const initMIDI = async () => {
      try {
        if ((navigator as any).requestMIDIAccess) {
          const access = await (navigator as any).requestMIDIAccess({ sysex: false });
          setMidiAccess(access);
        }
      } catch (error) {
        console.error('Failed to initialize MIDI:', error);
      }
    };
    
    initMIDI();
  }, []);

  // MIDI message listener
  useEffect(() => {
    if (!midiAccess || !isListening) return;

    const handleMIDIMessage = (event: any) => {
      const data = Array.from(event.data as Uint8Array) as number[];
      const device = event.target?.name || 'Unknown Device';
      const message = formatMIDIMessage(data);
      
      setCapturedMessages(prev => [
        { message, timestamp: Date.now(), device },
        ...prev.slice(0, 19) // Keep last 20 messages
      ]);
      
      console.log(`MIDI captured in lyrics: ${device} - ${message}`, data);
    };

    // Set up listeners on all input devices
    midiAccess.inputs.forEach((input: any) => {
      if (input.state === 'connected') {
        input.onmidimessage = handleMIDIMessage;
      }
    });

    return () => {
      // Clean up listeners
      midiAccess.inputs.forEach((input: any) => {
        if (input.onmidimessage === handleMIDIMessage) {
          input.onmidimessage = null;
        }
      });
    };
  }, [midiAccess, isListening]);

  // Format MIDI message for display
  const formatMIDIMessage = (data: number[]): string => {
    if (data.length === 0) return 'Empty message';
    
    const [status, ...payload] = data;
    const command = status & 0xF0;
    const channel = (status & 0x0F) + 1;
    
    switch (command) {
      case 0x90:
        return `Note ON: Ch${channel} Note${payload[0]} Vel${payload[1]}`;
      case 0x80:
        return `Note OFF: Ch${channel} Note${payload[0]}`;
      case 0xB0:
        return `CC: Ch${channel} CC${payload[0]} Val${payload[1]}`;
      case 0xC0:
        return `PC: Ch${channel} Program${payload[0]}`;
      case 0xE0:
        return `Pitch: Ch${channel} Val${(payload[1] << 7) | payload[0]}`;
      default:
        return `Unknown: ${data.map(b => b.toString(16).padStart(2, '0')).join(' ')}`;
    }
  };

  const toggleListening = () => {
    setIsListening(!isListening);
    if (!isListening) {
      setCapturedMessages([]); // Clear previous messages when starting to listen
    }
  };

  const clearCapturedMessages = () => {
    setCapturedMessages([]);
  };

  // Parse lyrics with timestamps and filter out anything in brackets for display
  const parseLyrics = (lyricsText: string): LyricsLine[] => {
    if (!lyricsText) return [];
    
    const lines = lyricsText.split('\n');
    const parsedLines: LyricsLine[] = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      // Look for timestamp pattern [mm:ss] or [m:ss] at start of line only
      const timestampMatch = trimmed.match(/^\[(\d{1,2}):(\d{2})\]/);
      
      if (timestampMatch) {
        const minutes = parseInt(timestampMatch[1]);
        const seconds = parseInt(timestampMatch[2]);
        const timestamp = minutes * 60 + seconds;
        let text = trimmed.substring(timestampMatch[0].length).trim();
        
        // Remove everything enclosed in square brackets (including nested ones)
        while (text.includes('[')) {
          text = text.replace(/\[([^\[\]]*)\]/g, '');
        }
        text = text.trim();
        
        if (text) {
          parsedLines.push({ timestamp, text });
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
  
  // Split lyrics by lines for non-timestamped lyrics, filtering out anything in brackets
  const plainLines = song?.lyrics && !hasTimestamps ? 
    song.lyrics.split('\n')
      .map((line: string) => {
        // Remove everything enclosed in square brackets (including nested ones)
        let cleanLine = line;
        while (cleanLine.includes('[')) {
          cleanLine = cleanLine.replace(/\[([^\[\]]*)\]/g, '');
        }
        return cleanLine.trim();
      })
      .filter((line: string) => line.trim()) : [];
  

  
  // Find current line based on timestamp (for timestamped lyrics)
  const currentLineIndex = hasTimestamps ? lyrics.findIndex((line, index) => {
    const nextLine = lyrics[index + 1];
    return line.timestamp <= currentTime && (!nextLine || nextLine.timestamp > currentTime);
  }) : -1;

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
    
    if (!hasTimestamps && plainLines.length > 0 && containerRef.current && autoScrollEnabled && currentTime > 0) {
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
  }, [currentTime > 0, hasTimestamps, plainLines.length, scrollSpeed, autoScrollEnabled]);

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
      {/* Header */}
      <div style={{ 
        height: '60px',
        backgroundColor: '#1f2937',
        borderBottom: '1px solid #374151',
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <h3 style={{ fontSize: '18px', fontWeight: '500', color: 'white' }}>{song.title} - Lyrics</h3>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* MIDI Listen Button */}
          <Button
            variant={isListening ? "default" : "outline"}
            size="sm"
            onClick={toggleListening}
            className={isListening ? "bg-red-600 hover:bg-red-700 text-white" : ""}
            data-testid="button-midi-listen"
          >
            {isListening ? (
              <>
                <Square className="w-4 h-4 mr-2" />
                Stop
              </>
            ) : (
              <>
                <Headphones className="w-4 h-4 mr-2" />
                Listen
              </>
            )}
          </Button>
          
          {/* Message Counter */}
          {capturedMessages.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              <Activity className="w-3 h-3 mr-1" />
              {capturedMessages.length}
            </Badge>
          )}
        </div>
      </div>

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

      {/* MIDI Activity Panel */}
      {isListening && (
        <div style={{
          height: capturedMessages.length > 0 ? '200px' : '60px',
          backgroundColor: '#1f2937',
          borderTop: '1px solid #374151',
          transition: 'height 0.3s ease'
        }}>
          <div style={{
            padding: '12px 16px',
            borderBottom: capturedMessages.length > 0 ? '1px solid #374151' : 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity className="w-4 h-4 text-green-500 animate-pulse" />
              <span style={{ fontSize: '14px', color: 'white', fontWeight: '500' }}>
                MIDI Listening Active
              </span>
              <Badge variant="outline" className="text-xs">
                {capturedMessages.length} captured
              </Badge>
            </div>
            
            {capturedMessages.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearCapturedMessages}
                data-testid="button-clear-midi-messages"
              >
                Clear
              </Button>
            )}
          </div>
          
          {capturedMessages.length > 0 && (
            <div style={{
              height: '140px',
              overflowY: 'auto',
              padding: '8px 16px'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {capturedMessages.map((msg, index) => (
                  <div
                    key={index}
                    style={{
                      fontSize: '12px',
                      padding: '6px 8px',
                      backgroundColor: '#111827',
                      borderRadius: '4px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <span style={{ fontFamily: 'monospace', color: '#e5e7eb' }}>
                      {msg.message}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: '#9ca3af', fontSize: '11px' }}>
                        {msg.device}
                      </span>
                      <span style={{ color: '#6b7280', fontSize: '10px' }}>
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}