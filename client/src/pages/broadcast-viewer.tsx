import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useBroadcast } from "@/hooks/useBroadcast";
import { LogOut, Clock, Music, Mic, Waves } from "lucide-react";

interface SongData {
  id: string;
  songTitle: string;
  artistName?: string;
  duration?: number;
  lyrics?: string;
  waveformData?: any;
  trackCount: number;
}

export default function BroadcastViewer() {
  const [, setLocation] = useLocation();
  const { isViewer, broadcastState, currentRoom, leaveBroadcast, isConnected } = useBroadcast();
  const [currentSongData, setCurrentSongData] = useState<SongData | null>(null);
  const [isLoadingSong, setIsLoadingSong] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(0);
  
  // Extract song data directly from broadcast state
  useEffect(() => {
    if (broadcastState && broadcastState.curSong) {
      // Create song data directly from broadcast state
      setCurrentSongData({
        id: broadcastState.broadcastName,
        songTitle: broadcastState.curSong,
        artistName: broadcastState.artistName,
        duration: broadcastState.duration || 300, // Default to 5 minutes if no duration provided
        lyrics: broadcastState.curLyrics,
        waveformData: broadcastState.curWaveform,
        trackCount: 1
      });
      
      // Update current position
      if (broadcastState.curTime !== undefined) {
        setCurrentPosition(broadcastState.curTime);
      }
    } else {
      setCurrentSongData(null);
    }
  }, [broadcastState]);

  // Create a timer to advance the position if playing
  useEffect(() => {
    if (!broadcastState) return;
    
    const timer = setInterval(() => {
      if (broadcastState.isPlaying) {
        setCurrentPosition(prev => prev + 1);
      }
    }, 1000);
    
    return () => clearInterval(timer);
  }, [broadcastState]);

  // Redirect if not viewing a broadcast - give more time for connection to establish
  useEffect(() => {
    let redirectTimer: NodeJS.Timeout;
    
    // Only redirect if we're definitely not in a broadcast after enough time
    redirectTimer = setTimeout(() => {
      console.log('📺 Redirect check:', { isViewer, currentRoom: !!currentRoom });
      // Only redirect if we have no room AND no viewer status after sufficient time
      if (!isViewer && !currentRoom) {
        console.log('📺 No broadcast connection found, redirecting to dashboard');
        setLocation('/dashboard');
      }
    }, 5000); // Wait 5 seconds before redirecting

    return () => {
      if (redirectTimer) clearTimeout(redirectTimer);
    };
  }, [isViewer, currentRoom, setLocation]); // Re-run when broadcast state changes

  // Format time from seconds to MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleLeaveBroadcast = () => {
    leaveBroadcast();
    setLocation('/dashboard');
  };

  // Show loading when connecting
  if ((!isViewer && !currentRoom)) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-lg">Connecting to broadcast...</p>
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mt-4"></div>
          <p className="text-sm text-muted-foreground mt-4">
            Establishing secure connection...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-slate-900 text-white flex flex-col">
      {/* Header with Leave Button */}
      <div className="flex justify-between items-center p-6 bg-black/20">
        <div className="flex items-center space-x-4">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></div>
          <span className="text-lg font-medium">
            📺 Viewing "{currentRoom || 'Live Performance'}"
          </span>
        </div>
        <Button 
          onClick={handleLeaveBroadcast}
          variant="outline"
          className="bg-red-600/20 border-red-400 text-red-200 hover:bg-red-600/40"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Leave Broadcast
        </Button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        {/* Song Info */}
        <div className="mb-8">
          <h1 className="text-4xl md:text-6xl font-bold mb-4 text-white">
            {currentSongData?.songTitle || 'No Song Selected'}
          </h1>
          {currentSongData?.artistName && (
            <p className="text-xl md:text-2xl text-blue-200 mb-6">
              by {currentSongData.artistName}
            </p>
          )}
          {isLoadingSong && (
            <p className="text-sm text-blue-300">Loading song data...</p>
          )}
          
          {/* Playback Status */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-lg text-blue-300 mb-4">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${broadcastState?.isPlaying ? 'bg-green-400' : 'bg-red-400'}`}></div>
              <span>{broadcastState?.isPlaying ? '▶️ Playing' : '⏸️ Paused'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              {formatTime(currentPosition)}
              {currentSongData?.duration && ` / ${formatTime(currentSongData.duration)}`}
            </div>
          </div>
          
          {/* Progress Bar */}
          {currentSongData?.duration && (
            <div className="w-full max-w-lg mx-auto bg-gray-700 rounded-full h-2 mb-6">
              <div 
                className="bg-blue-400 h-2 rounded-full transition-all"
                style={{ 
                  width: `${(currentPosition / currentSongData.duration) * 100}%` 
                }}
              ></div>
            </div>
          )}
        </div>

        {/* Visual Waveform Display */}
        <div className="max-w-5xl w-full mb-8">
          <div className="bg-black/30 backdrop-blur-sm rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Waves className="h-5 w-5 text-blue-400" />
              <h3 className="text-lg font-semibold text-blue-200">Audio Waveform</h3>
            </div>
            
            {/* Waveform Visualization */}
            <div className="relative h-20 bg-gray-900/50 rounded-lg overflow-hidden">
              {/* Fake waveform bars */}
              <div className="absolute inset-0 flex items-end justify-around px-1">
                {Array.from({ length: 200 }, (_, i) => {
                  const height = Math.random() * 60 + 10;
                  const isActive = currentSongData?.duration 
                    ? (i / 200) <= (currentPosition / currentSongData.duration)
                    : false;
                  return (
                    <div
                      key={i}
                      className={`w-0.5 transition-colors duration-300 ${
                        isActive ? 'bg-blue-400' : 'bg-gray-600'
                      }`}
                      style={{ height: `${height}%` }}
                    />
                  );
                })}
              </div>
              
              {/* Position Indicator */}
              {currentSongData?.duration && (
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg transition-all"
                  style={{
                    left: `${(currentPosition / currentSongData.duration) * 100}%`
                  }}
                >
                  <div className="absolute -top-1 -left-2 w-4 h-4 bg-white rounded-full shadow-lg"></div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Lyrics Display */}
        <div className="max-w-4xl w-full">
          <div className="flex items-center gap-2 mb-4">
            <Mic className="h-5 w-5 text-blue-400" />
            <h2 className="text-2xl font-semibold text-blue-200">Lyrics</h2>
          </div>
          
          <div className="bg-black/30 backdrop-blur-sm rounded-2xl p-6 max-h-96 overflow-y-auto">
            {currentSongData?.lyrics ? (
              <pre className="whitespace-pre-wrap text-lg leading-relaxed text-gray-100 font-sans">
                {currentSongData.lyrics}
              </pre>
            ) : (
              <div className="text-center py-12">
                <Music className="h-16 w-16 mx-auto text-blue-500/30 mb-4" />
                <p className="text-xl text-gray-300">
                  {broadcastState ? 'No lyrics available for this song' : 'Waiting for broadcast data...'}
                </p>
                {!isConnected && (
                  <p className="text-sm text-blue-400 mt-4">
                    Waiting for host to reconnect...
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 text-center text-blue-300 text-sm bg-black/20">
        <p>
          {isConnected 
            ? 'Real-time synchronized with broadcaster • StageTracker Pro' 
            : 'Connection lost - attempting to reconnect...'}
        </p>
      </div>
    </div>
  );
}