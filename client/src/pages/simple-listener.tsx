import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Music, Clock, Users, Loader2 } from 'lucide-react';

// Types for the simple system
interface SimpleBroadcastSong {
  id: string;
  broadcastId: string;
  songTitle: string;
  artistName?: string;
  lyrics?: string;
  waveformData?: any;
  position: number;
  isPlaying: boolean;
  createdAt: string;
}

interface ParsedLyricLine {
  text: string;
  timestamp: number;
  isCurrent: boolean;
  isPast: boolean;
}

// Simple listener using pure SQL polling - no complex WebSocket services!
export default function SimpleListener() {
  const [broadcastName, setBroadcastName] = useState<string>('');
  const [currentSong, setCurrentSong] = useState<SimpleBroadcastSong | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>('');

  // Get broadcast name from URL params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const broadcast = urlParams.get('broadcast') || 'Matt';
    setBroadcastName(broadcast);
    console.log('🎯 Simple listener connecting to broadcast:', broadcast);
  }, []);

  // Simple polling - check for current song every 2 seconds
  useEffect(() => {
    if (!broadcastName) return;

    const pollCurrentSong = async () => {
      try {
        const response = await fetch(`/api/simple-broadcast/${broadcastName}/current`);
        
        if (response.ok) {
          const data = await response.json();
          setCurrentSong(data.song);
          setError(null);
          setLastUpdate(new Date().toLocaleTimeString());
          console.log('📺 Polling result:', data.song?.songTitle || 'no song');
        } else {
          setError(`Failed to fetch current song (${response.status})`);
        }
      } catch (err) {
        setError('Connection error');
        console.error('Polling error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    // Poll immediately, then every 2 seconds
    pollCurrentSong();
    const interval = setInterval(pollCurrentSong, 2000);
    
    return () => clearInterval(interval);
  }, [broadcastName]);

  // Parse lyrics with timestamps for karaoke highlighting
  const parseLyricsWithTimestamps = (lyricsText: string, currentPosition: number): ParsedLyricLine[] => {
    if (!lyricsText) return [];
    
    const lines = lyricsText.split('\n');
    const parsedLines: ParsedLyricLine[] = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      // Parse timestamp [MM:SS] or [M:SS]
      const timestampMatch = trimmed.match(/^\[(\d{1,2}):(\d{2})\]/);
      if (timestampMatch) {
        const minutes = parseInt(timestampMatch[1]);
        const seconds = parseInt(timestampMatch[2]);
        const timestamp = minutes * 60 + seconds;
        
        // Remove timestamp and MIDI commands from display text
        let text = trimmed
          .replace(/^\[\d{1,2}:\d{2}\]/, '')      // Remove timestamp [0:02]
          .replace(/\[\[.*?\]\]/g, '')            // Remove MIDI commands [[PC:12:1]]
          .trim();
        
        if (text) {
          parsedLines.push({
            text,
            timestamp,
            isCurrent: false, // Will set below
            isPast: false     // Will set below
          });
        }
      } else {
        // Lines without timestamps
        const text = trimmed.replace(/\[\[.*?\]\]/g, '').trim();
        if (text) {
          parsedLines.push({
            text,
            timestamp: -1, // No timestamp
            isCurrent: false,
            isPast: false
          });
        }
      }
    }
    
    // Determine current line based on position
    let currentLineIndex = -1;
    for (let i = 0; i < parsedLines.length; i++) {
      if (parsedLines[i].timestamp !== -1 && currentPosition >= parsedLines[i].timestamp) {
        currentLineIndex = i;
      }
    }
    
    // Update highlighting flags
    parsedLines.forEach((line, index) => {
      if (line.timestamp === -1) {
        // Non-timestamped lines stay normal
        line.isCurrent = false;
        line.isPast = false;
      } else {
        line.isCurrent = index === currentLineIndex;
        line.isPast = index < currentLineIndex;
      }
    });
    
    return parsedLines;
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p className="text-muted-foreground">Connecting to broadcast: {broadcastName}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl flex items-center">
              <Users className="mr-2 h-6 w-6" />
              Simple Listener - Pure SQL Polling
            </CardTitle>
            <CardDescription>
              Broadcasting: <strong>{broadcastName}</strong> • Last update: {lastUpdate}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Badge variant={currentSong ? 'default' : 'secondary'}>
                  {currentSong ? '🎵 Song Active' : '⏸️ No Song'}
                </Badge>
                {currentSong?.isPlaying && (
                  <Badge variant="outline" className="text-green-400 border-green-400">
                    ▶️ Playing
                  </Badge>
                )}
              </div>
              <div className="text-sm text-muted-foreground">
                Polling every 2 seconds - No WebSocket needed!
              </div>
            </div>
            {error && (
              <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
                ⚠️ {error}
              </div>
            )}
          </CardContent>
        </Card>

        {currentSong ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Song Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Music className="mr-2 h-5 w-5" />
                  Now Playing
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xl font-bold">{currentSong.songTitle}</h3>
                    {currentSong.artistName && (
                      <p className="text-lg text-muted-foreground">{currentSong.artistName}</p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Clock className="mr-1 h-4 w-4" />
                      Position: {formatTime(currentSong.position)}
                    </div>
                    <div className="text-xs text-blue-400">
                      Song ID: {currentSong.id}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Broadcast: {currentSong.broadcastId}
                    </div>
                  </div>

                  {/* Playback State */}
                  <div className="flex items-center space-x-2">
                    {currentSong.isPlaying ? (
                      <div className="flex items-center text-green-400">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse mr-2"></div>
                        Playing
                      </div>
                    ) : (
                      <div className="flex items-center text-yellow-400">
                        <div className="w-2 h-2 bg-yellow-400 rounded-full mr-2"></div>
                        Paused
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Karaoke Lyrics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Music className="mr-2 h-5 w-5" />
                  Lyrics (Karaoke Style)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {currentSong.lyrics ? (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {parseLyricsWithTimestamps(currentSong.lyrics, currentSong.position).map((line, index) => (
                      <div
                        key={index}
                        className={`transition-all duration-500 p-3 rounded-lg ${
                          line.isCurrent 
                            ? 'bg-gradient-to-r from-blue-500/40 to-purple-500/40 text-white text-xl font-bold scale-105 shadow-lg border-l-4 border-blue-400' 
                            : line.isPast 
                            ? 'text-gray-500 opacity-60' 
                            : 'text-gray-200 hover:text-white'
                        }`}
                      >
                        {line.text}
                        {line.isCurrent && <span className="ml-2 text-blue-300">♪</span>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    No lyrics available for this song
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardContent className="text-center py-12">
              <Music className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">Waiting for host to select a song</h3>
              <p className="text-muted-foreground">
                The broadcaster hasn't selected a song yet. 
                <br />
                This page will automatically update when they do!
              </p>
              <div className="mt-4 text-sm text-muted-foreground">
                Checking for updates every 2 seconds...
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}