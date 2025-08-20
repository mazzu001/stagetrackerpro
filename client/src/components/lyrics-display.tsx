import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Minus, Plus, Edit3, Save, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import type { Song } from '@shared/schema';

interface LyricsDisplayProps {
  song: Song | null;
  currentTime: number;
  isPlaying: boolean;
  onSeek: (time: number) => void;
}

interface ParsedLyricsLine {
  text: string;
  timestamp: number;
}

export function LyricsDisplay({ song, currentTime, isPlaying, onSeek }: LyricsDisplayProps) {
  const [fontSize, setFontSize] = useState(() => {
    const saved = localStorage.getItem('stagetracker-lyrics-font-size');
    return saved ? parseInt(saved, 10) : 20;
  });
  
  const [isEditing, setIsEditing] = useState(false);
  const [editedLyrics, setEditedLyrics] = useState('');
  
  const lyricsContainerRef = useRef<HTMLDivElement>(null);

  // Save font size to localStorage
  useEffect(() => {
    localStorage.setItem('stagetracker-lyrics-font-size', fontSize.toString());
  }, [fontSize]);

  const increaseFontSize = () => {
    if (fontSize < 36) {
      setFontSize(prev => prev + 2);
    }
  };

  const decreaseFontSize = () => {
    if (fontSize > 12) {
      setFontSize(prev => prev - 2);
    }
  };

  const handleEditClick = () => {
    setEditedLyrics(song?.lyrics || '');
    setIsEditing(true);
  };

  const handleSaveLyrics = async () => {
    if (!song) return;
    
    try {
      const response = await fetch(`/api/songs/${song.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ lyrics: editedLyrics }),
      });

      if (response.ok) {
        setIsEditing(false);
        window.location.reload();
      }
    } catch (error) {
      console.error('Failed to save lyrics:', error);
    }
  };

  // Parse lyrics to extract timestamps
  const parsedLyrics: ParsedLyricsLine[] = song?.lyrics 
    ? song.lyrics.split('\n').map(line => {
        const timestampMatch = line.match(/^\[(\d+(?:\.\d+)?)\]/);
        if (timestampMatch) {
          const timestamp = parseFloat(timestampMatch[1]);
          const text = line.replace(/^\[(\d+(?:\.\d+)?)\]\s*/, '');
          return { text, timestamp };
        }
        return { text: line, timestamp: -1 };
      }).filter(line => line.text.trim() !== '')
    : [];

  // Check if we have real timestamps
  const hasRealTimestamps = parsedLyrics.some(line => line.timestamp >= 0);

  // Find current highlighted line
  const currentLineIndex = hasRealTimestamps ? parsedLyrics.findIndex((line, index) => {
    if (line.timestamp === -1) return false;
    const nextLine = parsedLyrics[index + 1];
    return line.timestamp <= currentTime && (!nextLine || nextLine.timestamp > currentTime);
  }) : -1;

  // Karaoke-style scrolling: keep current line centered
  useEffect(() => {
    if (!song || !hasRealTimestamps || currentLineIndex < 0 || !lyricsContainerRef.current) return;
    
    const container = lyricsContainerRef.current;
    const currentLineElement = container.querySelector(`[data-testid="lyrics-line-${currentLineIndex}"]`) as HTMLElement;
    
    if (!currentLineElement) return;
    
    const containerHeight = container.clientHeight;
    const lineTop = currentLineElement.offsetTop;
    const lineHeight = currentLineElement.offsetHeight;
    
    // Calculate scroll position to center the current line
    const targetScrollTop = lineTop - (containerHeight / 2) + (lineHeight / 2);
    const maxScrollTop = container.scrollHeight - containerHeight;
    const finalScrollTop = Math.max(0, Math.min(targetScrollTop, maxScrollTop));
    
    container.scrollTo({
      top: finalScrollTop,
      behavior: 'smooth'
    });
  }, [currentLineIndex, hasRealTimestamps, song]);

  // Reset scroll on song change
  useEffect(() => {
    if (lyricsContainerRef.current) {
      lyricsContainerRef.current.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [song?.id]);

  const handleLineClick = (timestamp: number) => {
    if (timestamp >= 0) {
      onSeek(timestamp);
    }
  };

  if (!song) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Select a song to view lyrics
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with controls */}
      <div className="flex items-center justify-between mb-4 px-2">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={decreaseFontSize}
            disabled={fontSize <= 12}
            data-testid="button-decrease-font"
          >
            <Minus className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[60px] text-center">
            {fontSize}px
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={increaseFontSize}
            disabled={fontSize >= 36}
            data-testid="button-increase-font"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={handleEditClick}
          data-testid="button-edit-lyrics"
        >
          <Edit3 className="h-4 w-4 mr-2" />
          Edit
        </Button>
      </div>

      {/* Lyrics container */}
      <div 
        ref={lyricsContainerRef}
        className="flex-1 overflow-y-auto p-4 border rounded-lg bg-background"
        style={{ fontSize: `${fontSize}px` }}
        data-testid="lyrics-container"
      >
        {parsedLyrics.length > 0 ? (
          <div className="space-y-6 py-8">
            {parsedLyrics.map((line, index) => {
              const isCurrent = hasRealTimestamps && currentLineIndex === index;
              const isPast = hasRealTimestamps && line.timestamp <= currentTime && !isCurrent;
              const isFuture = hasRealTimestamps && line.timestamp > currentTime;
              const isNext = hasRealTimestamps && currentLineIndex >= 0 && index === currentLineIndex + 1;
              
              return (
                <div
                  key={index}
                  data-testid={`lyrics-line-${index}`}
                  className={`cursor-pointer transition-all duration-500 text-center leading-relaxed ${
                    isCurrent
                      ? 'text-yellow-400 font-bold text-2xl scale-110 bg-yellow-400/10 px-4 py-2 rounded-lg border-l-4 border-yellow-400'
                      : isNext
                      ? 'text-blue-300 font-semibold text-xl'
                      : isPast
                      ? 'text-gray-500 text-lg'
                      : isFuture
                      ? 'text-gray-400 text-lg'
                      : 'text-foreground text-lg'
                  } ${isCurrent || isNext ? 'transform' : ''}`}
                  style={{
                    transform: isCurrent ? 'scale(1.1)' : isNext ? 'scale(1.05)' : 'scale(1)'
                  }}
                  onClick={() => handleLineClick(line.timestamp)}
                >
                  {line.text}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-8">
            No lyrics available for this song
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="max-w-4xl w-full h-[600px] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Edit Lyrics - {song.title}</DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 flex flex-col min-h-0">
            <Textarea
              value={editedLyrics}
              onChange={(e) => setEditedLyrics(e.target.value)}
              className="flex-1 resize-none font-mono text-sm min-h-0"
              placeholder="Enter lyrics here..."
              data-testid="textarea-lyrics"
            />
          </div>
          
          <div className="flex justify-end gap-2 pt-4 flex-shrink-0">
            <Button
              variant="outline"
              onClick={() => setIsEditing(false)}
              data-testid="button-cancel-edit"
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={handleSaveLyrics}
              data-testid="button-save-lyrics"
            >
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}