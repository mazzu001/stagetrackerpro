import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAudioEngine } from '@/hooks/use-audio-engine';
import { useStreamingAudio } from '@/hooks/useStreamingAudio';
import { LocalSongStorage, type LocalSong } from '@/lib/local-song-storage';
import { useLocalAuth } from '@/hooks/useLocalAuth';
import { Play, Pause, RotateCcw, Zap, FileAudio, Clock, Loader2 } from 'lucide-react';

export default function StreamingDemo() {
  const { user } = useLocalAuth();
  const [allSongs, setAllSongs] = useState<LocalSong[]>([]);
  const [selectedSong, setSelectedSong] = useState<LocalSong | null>(null);
  const [preloadStartTime, setPreloadStartTime] = useState<number | null>(null);
  const [streamingStartTime, setStreamingStartTime] = useState<number | null>(null);
  const [preloadDuration, setPreloadDuration] = useState<number | null>(null);
  const [streamingDuration, setStreamingDuration] = useState<number | null>(null);

  // Preload audio engine - convert LocalSong to SongWithTracks format
  const preloadAudio = useAudioEngine({ 
    song: selectedSong ? {
      ...selectedSong,
      userId: 'demo-user',
      tracks: selectedSong.tracks || []
    } as SongWithTracks : undefined,
    onDurationUpdated: () => {}
  });

  // Streaming audio engine
  const streamingAudio = useStreamingAudio();

  // Load songs on mount
  useEffect(() => {
    if (!user?.email) return;
    const songs = LocalSongStorage.getAllSongs(user.email);
    setAllSongs(songs);
    if (songs.length > 0) {
      setSelectedSong(songs[0]);
    }
  }, [user?.email]);

  // Track load completion for preload mode
  useEffect(() => {
    if (preloadStartTime && preloadAudio.duration > 0) {
      const loadTime = Date.now() - preloadStartTime;
      setPreloadDuration(loadTime);
      setPreloadStartTime(null);
    }
  }, [preloadAudio.duration, preloadStartTime]);

  // Track load completion for streaming mode  
  useEffect(() => {
    if (streamingStartTime && streamingAudio.isReady) {
      const loadTime = Date.now() - streamingStartTime;
      setStreamingDuration(loadTime);
      setStreamingStartTime(null);
    }
  }, [streamingAudio.isReady, streamingStartTime]);

  const handlePreloadSong = async () => {
    if (!selectedSong) return;
    
    setPreloadStartTime(Date.now());
    setPreloadDuration(null);
    
    // The useAudioEngine hook automatically loads when selectedSong changes
    // We just need to trigger a re-selection to force a fresh load
    setSelectedSong(null);
    setTimeout(() => setSelectedSong(allSongs.find(s => s.id === selectedSong.id) || null), 100);
  };

  const handleStreamingSong = async () => {
    if (!selectedSong) return;
    
    setStreamingStartTime(Date.now());
    setStreamingDuration(null);
    
    await streamingAudio.loadSong({
      ...selectedSong,
      userId: 'demo-user',
      tracks: selectedSong.tracks || []
    } as SongWithTracks);
  };

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const getLoadStatus = (duration: number | null, isReady: boolean = true) => {
    if (duration !== null) return { text: `Loaded in ${formatTime(duration)}`, color: 'green' };
    if (isReady) return { text: 'Ready', color: 'green' };
    return { text: 'Not loaded', color: 'gray' };
  };

  const preloadStatus = getLoadStatus(preloadDuration, preloadAudio.duration > 0);
  const streamingStatus = getLoadStatus(streamingDuration, streamingAudio.isReady);

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Audio Streaming vs Preload Demo</h1>
        <p className="text-muted-foreground">
          Compare loading times and performance between traditional preload and modern streaming approaches
        </p>
      </div>

      {/* Song Selection */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Select Song for Testing</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {allSongs.map((song) => (
              <Button
                key={song.id}
                variant={selectedSong?.id === song.id ? "default" : "outline"}
                onClick={() => setSelectedSong(song)}
                className="justify-start h-auto p-4"
              >
                <div className="text-left">
                  <div className="font-medium">{song.title}</div>
                  <div className="text-sm text-muted-foreground">{song.artist}</div>
                  <div className="text-xs text-muted-foreground">
                    {song.tracks?.length || 0} tracks
                  </div>
                </div>
              </Button>
            ))}
          </div>
          {allSongs.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              No songs found. Add some songs in the Track Manager first.
            </p>
          )}
        </CardContent>
      </Card>

      {selectedSong && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Preload Mode */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileAudio className="h-5 w-5 text-blue-500" />
                Preload Mode
                <Badge variant="secondary">Traditional</Badge>
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Downloads and decodes entire audio files before playback can begin
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Status */}
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${
                    preloadStatus.color === 'green' ? 'bg-green-500' :
                    preloadStatus.color === 'yellow' ? 'bg-yellow-500' : 'bg-gray-500'
                  }`} />
                  <span className="text-sm font-medium">{preloadStatus.text}</span>
                </div>

              </div>

              {/* Controls */}
              <div className="space-y-2">
                <Button
                  onClick={handlePreloadSong}
                  className="w-full"
                  variant="outline"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Test Preload Speed
                </Button>

                <Button
                  onClick={preloadAudio.isPlaying ? preloadAudio.pause : preloadAudio.play}
                  disabled={!preloadAudio.duration}
                  className="w-full"
                >
                  {preloadAudio.isPlaying ? (
                    <><Pause className="h-4 w-4 mr-2" /> Pause</>
                  ) : (
                    <><Play className="h-4 w-4 mr-2" /> Play</>
                  )}
                </Button>
              </div>

              {/* Stats */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Duration:</span>
                  <span>{preloadAudio.duration ? `${Math.floor(preloadAudio.duration / 60)}:${Math.floor(preloadAudio.duration % 60).toString().padStart(2, '0')}` : '--:--'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Current Time:</span>
                  <span>{preloadAudio.currentTime ? `${Math.floor(preloadAudio.currentTime / 60)}:${Math.floor(preloadAudio.currentTime % 60).toString().padStart(2, '0')}` : '0:00'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Load Time:</span>
                  <span className={preloadDuration !== null ? 'font-bold text-red-500' : ''}>
                    {preloadDuration !== null ? formatTime(preloadDuration) : 'Not tested'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Streaming Mode */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-green-500" />
                Streaming Mode
                <Badge variant="default">Modern</Badge>
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Sets up audio streams instantly and begins playback immediately
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Status */}
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${
                    streamingStatus.color === 'green' ? 'bg-green-500' :
                    streamingStatus.color === 'yellow' ? 'bg-yellow-500' : 'bg-gray-500'
                  }`} />
                  <span className="text-sm font-medium">{streamingStatus.text}</span>
                </div>

              </div>

              {/* Controls */}
              <div className="space-y-2">
                <Button
                  onClick={handleStreamingSong}
                  className="w-full"
                  variant="outline"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Test Streaming Speed
                </Button>

                <Button
                  onClick={streamingAudio.isPlaying ? streamingAudio.pause : streamingAudio.play}
                  disabled={!streamingAudio.isReady}
                  className="w-full"
                >
                  {streamingAudio.isPlaying ? (
                    <><Pause className="h-4 w-4 mr-2" /> Pause</>
                  ) : (
                    <><Play className="h-4 w-4 mr-2" /> Play</>
                  )}
                </Button>
              </div>

              {/* Stats */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Duration:</span>
                  <span>{streamingAudio.duration ? `${Math.floor(streamingAudio.duration / 60)}:${Math.floor(streamingAudio.duration % 60).toString().padStart(2, '0')}` : '--:--'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Current Time:</span>
                  <span>{streamingAudio.currentTime ? `${Math.floor(streamingAudio.currentTime / 60)}:${Math.floor(streamingAudio.currentTime % 60).toString().padStart(2, '0')}` : '0:00'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Load Time:</span>
                  <span className={streamingDuration !== null ? 'font-bold text-green-500' : ''}>
                    {streamingDuration !== null ? formatTime(streamingDuration) : 'Not tested'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Comparison Results */}
      {preloadDuration !== null && streamingDuration !== null && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Performance Comparison
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
              <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{formatTime(preloadDuration)}</div>
                <div className="text-sm text-muted-foreground">Preload Time</div>
              </div>
              <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{formatTime(streamingDuration)}</div>
                <div className="text-sm text-muted-foreground">Streaming Time</div>
              </div>
              <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {Math.round((preloadDuration / streamingDuration) * 10) / 10}x
                </div>
                <div className="text-sm text-muted-foreground">Speed Improvement</div>
              </div>
            </div>
            <div className="mt-4 text-center text-sm text-muted-foreground">
              Streaming mode eliminates load delays completely, making it perfect for live performance where instant response is critical.
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}