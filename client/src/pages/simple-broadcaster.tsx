import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, Pause, SkipBack, SkipForward, Volume2, Users } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { storage } from '@/lib/storage';
import type { Song } from '@shared/schema';

// Simple broadcaster using pure SQL APIs - no complex hooks or services!
export default function SimpleBroadcaster() {
  const [userEmail, setUserEmail] = useState<string>('');
  const [broadcastName, setBroadcastName] = useState<string>('');
  const [broadcastStarted, setBroadcastStarted] = useState<boolean>(false);
  const [songs, setSongs] = useState<Song[]>([]);
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [currentSongId, setCurrentSongId] = useState<string | null>(null);
  
  // Audio playback state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [position, setPosition] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [audio] = useState(() => new Audio());

  // Load user info and songs on mount
  useEffect(() => {
    const loadUserAndSongs = async () => {
      try {
        // Get user email from localStorage or auth
        const email = localStorage.getItem('userEmail') || 'professional@demo.com';
        setUserEmail(email);
        setBroadcastName(email.split('@')[0]); // Use first part of email as broadcast name
        
        // Load songs from local storage
        const songsList = await storage.getSongs();
        setSongs(songsList);
        console.log('🎵 Loaded songs:', songsList.length);
      } catch (error) {
        console.error('Error loading user data:', error);
      }
    };
    
    loadUserAndSongs();
  }, []);

  // Audio event handlers
  useEffect(() => {
    const handleTimeUpdate = () => {
      setPosition(audio.currentTime);
      
      // Send position updates to database every 2 seconds while playing
      if (isPlaying && broadcastStarted && Date.now() % 2000 < 100) {
        updatePosition(audio.currentTime, true);
      }
    };
    
    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };
    
    const handleEnded = () => {
      setIsPlaying(false);
      updatePosition(0, false);
    };
    
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audio, isPlaying, broadcastStarted]);

  // 1. Start broadcast - Simple SQL call
  const startBroadcast = async () => {
    try {
      const response = await fetch(`/api/simple-broadcast/${broadcastName}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostEmail: userEmail }),
      });
      
      if (response.ok) {
        setBroadcastStarted(true);
        console.log('🎯 Simple broadcast started:', broadcastName);
      } else {
        console.error('Failed to start broadcast');
      }
    } catch (error) {
      console.error('Error starting broadcast:', error);
    }
  };

  // 2. Select song - Simple SQL call
  const selectSong = async (song: Song) => {
    if (!broadcastStarted) return;
    
    try {
      // Get audio file for this song
      const tracks = await storage.getTracks(song.id);
      if (tracks.length === 0) {
        console.error('No tracks found for song');
        return;
      }
      
      // Use first track's audio
      const audioUrl = tracks[0].audioUrl;
      
      const response = await fetch(`/api/simple-broadcast/${broadcastName}/song`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          songTitle: song.title,
          artistName: song.artist,
          lyrics: song.lyrics || '',
          waveformData: song.waveformData ? JSON.parse(song.waveformData) : null,
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setSelectedSong(song);
        setCurrentSongId(data.songId);
        
        // Load audio
        audio.src = audioUrl;
        audio.load();
        
        console.log('🎵 Song selected:', song.title, 'ID:', data.songId);
      } else {
        console.error('Failed to select song');
      }
    } catch (error) {
      console.error('Error selecting song:', error);
    }
  };

  // 3. Update position - Simple SQL call
  const updatePosition = async (newPosition: number, playing: boolean) => {
    if (!broadcastStarted || !currentSongId) return;
    
    try {
      await fetch(`/api/simple-broadcast/${broadcastName}/position`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          position: Math.floor(newPosition),
          isPlaying: playing,
        }),
      });
    } catch (error) {
      console.error('Error updating position:', error);
    }
  };

  // Playback controls
  const togglePlayback = () => {
    if (!selectedSong) return;
    
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      updatePosition(audio.currentTime, false);
    } else {
      audio.play();
      setIsPlaying(true);
      updatePosition(audio.currentTime, true);
    }
  };

  const seekTo = (newPosition: number) => {
    audio.currentTime = newPosition;
    setPosition(newPosition);
    updatePosition(newPosition, isPlaying);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl flex items-center">
              <Users className="mr-2 h-6 w-6" />
              Simple Broadcaster - Pure SQL
            </CardTitle>
            <CardDescription>
              No complex hooks, modules, or WebSocket services - just simple database operations!
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                <p><strong>Email:</strong> {userEmail}</p>
                <p><strong>Broadcast Name:</strong> {broadcastName}</p>
              </div>
              
              {!broadcastStarted ? (
                <Button onClick={startBroadcast} size="lg" className="w-full">
                  🎯 Start Simple Broadcast
                </Button>
              ) : (
                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <p className="text-green-400 font-semibold">✅ Broadcast Active: {broadcastName}</p>
                  <p className="text-sm text-muted-foreground">
                    Listeners can view at: <code>/simple-viewer?broadcast={broadcastName}</code>
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Song Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Volume2 className="mr-2 h-5 w-5" />
                Song Library ({songs.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {songs.map((song) => (
                  <div
                    key={song.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedSong?.id === song.id
                        ? 'bg-blue-500/20 border-blue-500'
                        : 'hover:bg-accent'
                    }`}
                    onClick={() => selectSong(song)}
                  >
                    <h4 className="font-semibold">{song.title}</h4>
                    <p className="text-sm text-muted-foreground">{song.artist}</p>
                    {broadcastStarted && (
                      <p className="text-xs text-green-400 mt-1">
                        Click to broadcast this song
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Playback Controls */}
          <Card>
            <CardHeader>
              <CardTitle>Playback Controls</CardTitle>
            </CardHeader>
            <CardContent>
              {selectedSong ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-lg">{selectedSong.title}</h3>
                    <p className="text-muted-foreground">{selectedSong.artist}</p>
                    <p className="text-xs text-blue-400 mt-1">Song ID: {currentSongId}</p>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-2">
                    <Slider
                      value={[position]}
                      max={duration || 100}
                      step={0.1}
                      onValueChange={([value]) => seekTo(value)}
                      className="w-full"
                    />
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>{formatTime(position)}</span>
                      <span>{formatTime(duration)}</span>
                    </div>
                  </div>

                  {/* Transport Controls */}
                  <div className="flex items-center justify-center space-x-4">
                    <Button variant="outline" size="icon">
                      <SkipBack className="h-4 w-4" />
                    </Button>
                    <Button 
                      onClick={togglePlayback} 
                      size="lg"
                      className="h-12 w-12 rounded-full"
                    >
                      {isPlaying ? (
                        <Pause className="h-6 w-6" />
                      ) : (
                        <Play className="h-6 w-6 ml-1" />
                      )}
                    </Button>
                    <Button variant="outline" size="icon">
                      <SkipForward className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="text-center text-sm text-muted-foreground">
                    Position updates sent to database every 2 seconds while playing
                  </div>
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  {broadcastStarted ? (
                    'Select a song from your library to start broadcasting'
                  ) : (
                    'Start your broadcast first, then select a song'
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}