import { useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useBroadcast } from "@/hooks/useBroadcast";
import { LogOut } from "lucide-react";

export default function BroadcastViewer() {
  const [, setLocation] = useLocation();
  const { isViewer, broadcastState, currentRoom, leaveBroadcast } = useBroadcast();

  // Redirect if not viewing a broadcast - give time for connection to establish
  useEffect(() => {
    const redirectTimer = setTimeout(() => {
      if (!isViewer && !currentRoom) {
        setLocation('/dashboard');
      }
    }, 2000); // Wait 2 seconds before redirecting

    return () => clearTimeout(redirectTimer);
  }, [isViewer, currentRoom, setLocation]);

  // Debug what we're receiving
  useEffect(() => {
    console.log('🖥️ BroadcastViewer state:', {
      isViewer,
      currentRoom: !!currentRoom,
      roomId: currentRoom?.id,
      broadcastState: !!broadcastState,
      hasLyrics: !!broadcastState?.lyrics,
      lyricsLength: broadcastState?.lyrics?.length || 0,
      songTitle: broadcastState?.songTitle,
      shouldShow: isViewer || !!currentRoom
    });
  }, [isViewer, currentRoom, broadcastState]);

  const handleLeaveBroadcast = async () => {
    await leaveBroadcast();
    setLocation('/dashboard');
  };

  if (!isViewer && !currentRoom) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-lg">Connecting to broadcast...</p>
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mt-4"></div>
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
            {broadcastState?.songTitle || 'No Song Selected'}
          </h1>
          {broadcastState?.artist && (
            <p className="text-xl md:text-2xl text-blue-200 mb-6">
              by {broadcastState.artist}
            </p>
          )}
          
          {/* Playback Status */}
          <div className="flex items-center justify-center space-x-6 text-lg text-blue-300">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${broadcastState?.isPlaying ? 'bg-green-400' : 'bg-red-400'}`}></div>
              <span>{broadcastState?.isPlaying ? '▶️ Playing' : '⏸️ Paused'}</span>
            </div>
            <div>
              {Math.floor(broadcastState?.position || 0)}s
              {broadcastState?.duration && ` / ${Math.floor(broadcastState.duration)}s`}
            </div>
            {broadcastState?.duration && (
              <div className="w-32 bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-blue-400 h-2 rounded-full transition-all duration-300"
                  style={{ 
                    width: `${((broadcastState?.position || 0) / broadcastState.duration) * 100}%` 
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
                {Math.floor(broadcastState?.position || 0)}s / {Math.floor(broadcastState?.duration || 0)}s
              </div>
            </div>
            
            {/* Waveform Visualization */}
            <div className="relative h-20 bg-gray-900/50 rounded-lg overflow-hidden">
              {/* Fake waveform bars */}
              <div className="absolute inset-0 flex items-end justify-around px-1">
                {Array.from({ length: 200 }, (_, i) => {
                  const height = Math.random() * 60 + 10;
                  const isActive = broadcastState?.duration && broadcastState?.position 
                    ? (i / 200) <= (broadcastState.position / broadcastState.duration)
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
              {broadcastState?.duration && (
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg transition-all duration-300"
                  style={{
                    left: `${((broadcastState?.position || 0) / broadcastState.duration) * 100}%`
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
          {broadcastState?.lyrics || currentRoom ? (
            <>
              <h2 className="text-2xl font-semibold mb-4 text-blue-200">Lyrics</h2>
              <div className="bg-black/30 backdrop-blur-sm rounded-2xl p-6 max-h-96 overflow-y-auto">
                <pre className="whitespace-pre-wrap text-lg leading-relaxed text-gray-100 font-mono">
                  {broadcastState?.lyrics || 'Waiting for lyrics from broadcaster...'}
                </pre>
              </div>
            </>
          ) : (
            <div className="bg-black/30 backdrop-blur-sm rounded-2xl p-12 text-center">
              <p className="text-xl text-gray-300">
                {broadcastState?.songTitle ? 'No lyrics available for this song' : 'Waiting for broadcast data...'}
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