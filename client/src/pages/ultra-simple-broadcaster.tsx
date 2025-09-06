import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, Pause, Volume2, Users } from 'lucide-react';
import { LocalSongStorage, type LocalSong } from '@/lib/local-song-storage';

// ULTRA SIMPLE BROADCASTER - NO APIs, NO calls, NO hooks!
// Just localStorage and direct JavaScript - THAT'S IT!
export default function UltraSimpleBroadcaster() {
  const [userEmail] = useState<string>('professional@demo.com');
  const [broadcastName] = useState<string>('Matt');
  const [songs, setSongs] = useState<LocalSong[]>([]);
  const [isActive, setIsActive] = useState<boolean>(false);
  const [selectedSong, setSelectedSong] = useState<LocalSong | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [position, setPosition] = useState<number>(0);
  const [audio] = useState(() => new Audio());

  // Load songs on mount
  useEffect(() => {
    const songsList = LocalSongStorage.getAllSongs(userEmail);
    setSongs(songsList);
    console.log('🎵 Loaded songs:', songsList.length);

    // Check if broadcast is already active
    const existingBroadcast = localStorage.getItem(`broadcast_${broadcastName}`);
    if (existingBroadcast) {
      setIsActive(true);
      console.log('🎯 Broadcast already active');
    }
  }, [userEmail, broadcastName]);

  // Audio position tracking
  useEffect(() => {
    const handleTimeUpdate = () => {
      const currentPos = Math.floor(audio.currentTime);
      setPosition(currentPos);
      
      // Update broadcast state in localStorage every second
      if (selectedSong && isActive) {
        updateBroadcastState(selectedSong, currentPos, !audio.paused);
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    return () => audio.removeEventListener('timeupdate', handleTimeUpdate);
  }, [audio, selectedSong, isActive]);

  // ===========================
  // ULTRA SIMPLE FUNCTIONS - NO API CALLS!
  // ===========================

  // 1. Start broadcast - PURE localStorage
  const startBroadcast = () => {
    const broadcastData = {
      broadcastName,
      hostEmail: userEmail,
      isActive: true,
      currentSong: null,
      startedAt: new Date().toISOString()
    };
    
    // SIMPLE: Just save to localStorage - NO API CALL!
    localStorage.setItem(`broadcast_${broadcastName}`, JSON.stringify(broadcastData));
    setIsActive(true);
    console.log('🎯 Broadcast started - PURE localStorage!');
  };

  // 2. Select song - PURE localStorage 
  const selectSong = (song: LocalSong) => {
    if (!isActive) return;
    
    setSelectedSong(song);
    
    // Load audio
    if (song.tracks.length > 0) {
      audio.src = song.tracks[0].audioUrl;
      audio.load();
    }
    
    // SIMPLE: Update broadcast state in localStorage - NO API CALL!
    updateBroadcastState(song, 0, false);
    console.log('🎵 Song selected - PURE localStorage!', song.title);
  };

  // 3. Update broadcast state - PURE localStorage
  const updateBroadcastState = (song: LocalSong, pos: number, playing: boolean) => {
    const broadcastData = {
      broadcastName,
      hostEmail: userEmail,
      isActive: true,
      currentSong: {
        id: crypto.randomUUID(), // Simple unique ID
        songTitle: song.title,
        artistName: song.artist,
        lyrics: song.lyrics || '',
        position: pos,
        isPlaying: playing,
        updatedAt: new Date().toISOString()
      }
    };
    
    // SIMPLE: Just save to localStorage - NO API CALL!
    localStorage.setItem(`broadcast_${broadcastName}`, JSON.stringify(broadcastData));
  };

  // 4. Play/Pause - LOCAL only
  const togglePlayback = () => {
    if (!selectedSong) return;
    
    if (audio.paused) {
      audio.play();
      setIsPlaying(true);
    } else {
      audio.pause();
      setIsPlaying(false);
    }
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
              Ultra Simple Broadcaster - ZERO APIs!
            </CardTitle>
            <CardDescription>
              No API calls, no hooks, no services - just localStorage and JavaScript!
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                <p><strong>Email:</strong> {userEmail}</p>
                <p><strong>Broadcast Name:</strong> {broadcastName}</p>
                <p><strong>Method:</strong> Pure localStorage polling</p>
              </div>
              
              {!isActive ? (
                <Button onClick={startBroadcast} size="lg" className="w-full">
                  🎯 Start Ultra Simple Broadcast
                </Button>
              ) : (
                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <p className="text-green-400 font-semibold">✅ Broadcast Active: {broadcastName}</p>
                  <p className="text-sm text-muted-foreground">
                    Listeners can view at: <code>/ultra-simple-listener?broadcast={broadcastName}</code>
                  </p>
                  <p className="text-xs text-blue-400 mt-1">
                    Data stored in: localStorage['broadcast_{broadcastName}']
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
              <CardDescription>
                Click any song to broadcast - NO API calls needed!
              </CardDescription>
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
                    <p className="text-xs text-green-400">
                      Tracks: {song.tracks.length} • Duration: {song.duration || 0}s
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Playback Controls */}
          <Card>
            <CardHeader>
              <CardTitle>Ultra Simple Playback</CardTitle>
              <CardDescription>
                No complex services - just HTML5 audio + localStorage
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedSong ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-lg">{selectedSong.title}</h3>
                    <p className="text-muted-foreground">{selectedSong.artist}</p>
                  </div>

                  <div className="text-sm text-muted-foreground">
                    <p>Position: {formatTime(position)}</p>
                    <p>Playing: {isPlaying ? '▶️ Yes' : '⏸️ No'}</p>
                  </div>

                  {/* Simple Play/Pause */}
                  <div className="flex items-center justify-center">
                    <Button 
                      onClick={togglePlayback} 
                      size="lg"
                      className="h-16 w-16 rounded-full"
                    >
                      {isPlaying ? (
                        <Pause className="h-8 w-8" />
                      ) : (
                        <Play className="h-8 w-8 ml-1" />
                      )}
                    </Button>
                  </div>

                  <div className="text-center text-sm text-blue-400">
                    Updates localStorage every second - listeners poll every 2 seconds
                  </div>
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  {isActive ? (
                    'Select a song to start broadcasting'
                  ) : (
                    'Start your broadcast first, then select a song'
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Debug Info */}
        {isActive && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Debug - localStorage Data</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs bg-black/20 p-2 rounded overflow-auto">
                {JSON.stringify(JSON.parse(localStorage.getItem(`broadcast_${broadcastName}`) || '{}'), null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}