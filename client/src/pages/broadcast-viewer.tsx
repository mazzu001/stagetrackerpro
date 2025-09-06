import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useBroadcast } from "@/hooks/useBroadcast";
import { LogOut } from "lucide-react";

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
  const { isViewer, broadcastState, currentRoom, leaveBroadcast } = useBroadcast();
  const [currentSongData, setCurrentSongData] = useState<SongData | null>(null);
  const [isLoadingSong, setIsLoadingSong] = useState(false);

  // Fetch song data when songEntryId changes
  useEffect(() => {
    const fetchSongData = async (songEntryId: string) => {
      try {
        setIsLoadingSong(true);
        console.log(`🎵 Fetching song data for entry ID: ${songEntryId}`);
        
        const response = await fetch(`/api/broadcast/song/${songEntryId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch song data');
        }
        
        const data = await response.json();
        setCurrentSongData(data.song);
        console.log(`✅ Loaded song: ${data.song.songTitle} by ${data.song.artistName}`);
      } catch (error) {
        console.error('❌ Failed to fetch song data:', error);
        setCurrentSongData(null);
      } finally {
        setIsLoadingSong(false);
      }
    };

    if (broadcastState?.songEntryId) {
      fetchSongData(broadcastState.songEntryId);
    } else {
      setCurrentSongData(null);
    }
  }, [broadcastState?.songEntryId]);

  // Redirect if not viewing a broadcast - give more time for connection to establish
  useEffect(() => {
    let redirectTimer: NodeJS.Timeout;
    
    // Only start redirect timer if we have no room info at all after 5 seconds
    const startRedirectCheck = () => {
      redirectTimer = setTimeout(() => {
        console.log('📺 Redirect check:', { isViewer, currentRoom: !!currentRoom });
        // Only redirect if we have no room AND no viewer status after sufficient time
        if (!isViewer && !currentRoom) {
          console.log('📺 No broadcast connection found, redirecting to dashboard');
          setLocation('/dashboard');
        }
      }, 5000); // Wait 5 seconds before redirecting
    };
    
    // Start the timer
    startRedirectCheck();

    return () => {
      if (redirectTimer) clearTimeout(redirectTimer);
    };
  }, []); // Only run once on mount

  // Debug what we're receiving
  useEffect(() => {
    console.log('🖥️ BroadcastViewer state:', {
      isViewer,
      currentRoom: !!currentRoom,
      roomId: currentRoom?.id,
      broadcastState: !!broadcastState,
      songEntryId: broadcastState?.songEntryId,
      hasCurrentSongData: !!currentSongData,
      songTitle: currentSongData?.songTitle,
      shouldShow: isViewer || !!currentRoom
    });
  }, [isViewer, currentRoom, broadcastState, currentSongData]);

  const handleLeaveBroadcast = async () => {
    await leaveBroadcast();
    setLocation('/dashboard');
  };

  // Show loading for first 5 seconds OR if we have a room (connection in progress)
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
          <div className="w-3 h-3 rounded-full bg-blue-400 animate-pulse"></div>
          <span className="text-lg font-medium">
            📺 Viewing "{currentRoom?.name || 'Live Performance'}"
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
          <div className="flex items-center justify-center space-x-6 text-lg text-blue-300">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${broadcastState?.isPlaying ? 'bg-green-400' : 'bg-red-400'}`}></div>
              <span>{broadcastState?.isPlaying ? '▶️ Playing' : '⏸️ Paused'}</span>
            </div>
            <div>
              {Math.floor(broadcastState?.position || 0)}s
              {currentSongData?.duration && ` / ${Math.floor(currentSongData.duration)}s`}
            </div>
            {currentSongData?.duration && (
              <div className="w-32 bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-blue-400 h-2 rounded-full transition-all duration-300"
                  style={{ 
                    width: `${((broadcastState?.position || 0) / currentSongData.duration) * 100}%` 
                  }}
                ></div>
              </div>
            )}
          </div>
        </div>

        {/* Visual Waveform Display */}
        <div className="max-w-5xl w-full mb-8">
          <div className="bg-black/30 backdrop-blur-sm rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-blue-200">Audio Waveform</h3>
              <div className="text-sm text-blue-300">
                {Math.floor(broadcastState?.position || 0)}s / {Math.floor(currentSongData?.duration || 0)}s
              </div>
            </div>
            
            {/* Waveform Visualization */}
            <div className="relative h-20 bg-gray-900/50 rounded-lg overflow-hidden">
              {/* Fake waveform bars */}
              <div className="absolute inset-0 flex items-end justify-around px-1">
                {Array.from({ length: 200 }, (_, i) => {
                  const height = Math.random() * 60 + 10;
                  const isActive = currentSongData?.duration && broadcastState?.position 
                    ? (i / 200) <= (broadcastState.position / currentSongData.duration)
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
                  className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg transition-all duration-300"
                  style={{
                    left: `${((broadcastState?.position || 0) / currentSongData.duration) * 100}%`
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
          {currentSongData?.lyrics || currentRoom ? (
            <>
              <h2 className="text-2xl font-semibold mb-4 text-blue-200">Lyrics</h2>
              <div className="bg-black/30 backdrop-blur-sm rounded-2xl p-6 max-h-96 overflow-y-auto">
                <pre className="whitespace-pre-wrap text-lg leading-relaxed text-gray-100 font-mono">
                  {currentSongData?.lyrics || 'Waiting for lyrics from broadcaster...'}
                </pre>
              </div>
            </>
          ) : (
            <div className="bg-black/30 backdrop-blur-sm rounded-2xl p-12 text-center">
              <p className="text-xl text-gray-300">
                {currentSongData?.songTitle ? 'No lyrics available for this song' : 'Waiting for broadcast data...'}
              </p>
              {!broadcastState && (
                <p className="text-sm text-blue-400 mt-2">Connecting to broadcast...</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 text-center text-blue-300 text-sm bg-black/20">
        <p>Real-time synchronized with broadcaster • StageTracker Pro</p>
      </div>
    </div>
  );
}