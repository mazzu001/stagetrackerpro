import { useEffect, useState, useMemo } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { LogOut, Play, Pause, Volume2 } from "lucide-react";
import { LyricsDisplay } from "@/components/lyrics-display";

interface SongData {
  id: string;
  songTitle: string;
  artistName?: string;
  duration?: number;
  lyrics?: string;
  waveformData?: any;
  trackCount: number;
}

interface BroadcastState {
  songEntryId?: string;
  position: number;
  isPlaying: boolean;
  currentLyricLine?: string;
  waveformProgress: number;
}


export default function SimpleBroadcastViewer() {
  const [, setLocation] = useLocation();
  const [isConnected, setIsConnected] = useState(false);
  const [currentSong, setCurrentSong] = useState<SongData | null>(null);
  const [broadcastState, setBroadcastState] = useState<BroadcastState | null>(null);
  const [roomInfo, setRoomInfo] = useState<any>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);

  // Get broadcast ID from URL
  const broadcastId = new URLSearchParams(window.location.search).get('id') || 'Matt';


  useEffect(() => {
    // Simple WebSocket connection - no complex service layer
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/broadcast/${broadcastId}`;
    
    console.log(`🎵 Simple viewer connecting to: ${wsUrl}`);
    const socket = new WebSocket(wsUrl);
    
    socket.onopen = () => {
      console.log('✅ Simple viewer connected');
      setIsConnected(true);
      
      // Send simple viewer connect message
      socket.send(JSON.stringify({
        type: 'viewer_connect',
        userId: 'mnbtransport2024@gmail.com',
        userName: 'Premium User'
      }));
    };

    socket.onmessage = async (event) => {
      const message = JSON.parse(event.data);
      console.log('📺 Simple viewer received:', message);
      console.log('📺 Message type:', message.type);
      if (message.state) {
        console.log('📺 State details:', message.state);
        console.log('📺 songEntryId in state:', message.state.songEntryId);
      }

      if (message.type === 'room_info') {
        setRoomInfo(message.room);
        console.log('📺 Room info:', message.room);
      } 
      else if (message.type === 'state_update') {
        const state = message.state;
        setBroadcastState(state);
        console.log('📺 State update:', state);
        
        // If there's a new song, fetch it from database
        if (state.songEntryId && state.songEntryId !== currentSong?.id) {
          console.log(`🎵 Fetching new song: ${state.songEntryId}`);
          try {
            const response = await fetch(`/api/broadcast/song/${state.songEntryId}`);
            if (response.ok) {
              const data = await response.json();
              setCurrentSong(data.song);
              console.log(`✅ Loaded song: ${data.song.songTitle}`);
            }
          } catch (error) {
            console.error('❌ Failed to fetch song:', error);
          }
        }
      }
    };

    socket.onclose = () => {
      console.log('❌ Simple viewer disconnected');
      setIsConnected(false);
    };

    socket.onerror = (error) => {
      console.error('❌ Simple viewer WebSocket error:', error);
    };

    setWs(socket);

    return () => {
      socket.close();
    };
  }, [broadcastId]);

  const leaveBroadcast = () => {
    if (ws) ws.close();
    setLocation('/dashboard');
  };

  // Show loading until connected
  if (!isConnected || !roomInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white text-lg">Connecting to broadcast...</p>
          <p className="text-gray-300 text-sm mt-2">Establishing secure connection</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 text-white">
      {/* Header */}
      <div className="border-b border-white/20 p-4 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Viewing: {roomInfo.name}</h1>
          <p className="text-gray-300">Host: {roomInfo.hostName} • {roomInfo.participantCount} viewers</p>
        </div>
        <Button 
          onClick={leaveBroadcast}
          variant="outline" 
          className="border-white/30 hover:bg-white/10"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Leave Broadcast
        </Button>
      </div>

      <div className="p-6">
        {currentSong ? (
          <div className="space-y-6">
            {/* Now Playing */}
            <div className="bg-black/30 rounded-lg p-6">
              <div className="flex items-center space-x-4 mb-4">
                {broadcastState?.isPlaying ? (
                  <Play className="h-8 w-8 text-green-400" />
                ) : (
                  <Pause className="h-8 w-8 text-gray-400" />
                )}
                <div>
                  <h2 className="text-xl font-bold">{currentSong.songTitle}</h2>
                  <p className="text-gray-300">{currentSong.artistName}</p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-white/20 rounded-full h-2 mb-2">
                <div 
                  className="bg-blue-400 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(broadcastState?.waveformProgress || 0) * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-sm text-gray-400">
                <span>{Math.floor(broadcastState?.position || 0)}s</span>
                <span>{currentSong.duration ? Math.floor(currentSong.duration) + 's' : '--'}</span>
              </div>
            </div>

            {/* Karaoke-Style Lyrics Display */}
            {currentSong.lyrics && (
              <div className="bg-black/20 rounded-lg p-6 flex-grow">
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <Volume2 className="mr-2 h-5 w-5" />
                  Lyrics
                </h3>
                <div className="h-96">
                  <LyricsDisplay
                    song={{
                      id: currentSong.id,
                      title: currentSong.songTitle,
                      lyrics: currentSong.lyrics
                    }}
                    currentTime={broadcastState?.position || 0}
                    duration={currentSong.duration || 0}
                    isPlaying={broadcastState?.isPlaying || false}
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-xl text-gray-300">Waiting for host to start playing...</p>
          </div>
        )}
      </div>
    </div>
  );
}