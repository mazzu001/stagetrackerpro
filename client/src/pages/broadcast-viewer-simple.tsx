import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { LogOut, Play, Pause, Volume2 } from "lucide-react";
import { LyricsDisplay } from "@/components/lyrics-display";

// FORCE mobile API fallbacks to work with broadcast endpoints
// This will make the broadcast viewer work even without a server
localStorage.setItem('mobile_mode', 'true');
localStorage.setItem('force_mobile_mode', 'true');
// Remove any flags that might bypass our fallbacks
localStorage.removeItem('use_real_broadcast_api');
console.log('🔧 Mobile mode FORCED for broadcasts - using fallbacks');

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
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdateTimeRef = useRef<number>(Date.now());
  const positionRef = useRef<number>(0);

  // Get broadcast ID from URL
  const broadcastId = new URLSearchParams(window.location.search).get('id') || 'Matt';


  useEffect(() => {
    // Database-only approach - Poll for broadcast updates
    console.log(`🎵 Simple viewer connecting to broadcast: ${broadcastId}`);
    
    // First get broadcast info
    const fetchBroadcastInfo = async () => {
      try {
        console.log(`🔍 Fetching broadcast info for: ${broadcastId}`);
        const response = await fetch(`/api/broadcast/${encodeURIComponent(broadcastId)}`, {
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });
        
        // Log the raw response for debugging
        const responseText = await response.text();
        console.log(`📊 Raw broadcast info response: ${responseText.substring(0, 200)}${responseText.length > 200 ? '...' : ''}`);
        
        // Parse the JSON response
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (parseError) {
          console.error('❌ Failed to parse JSON response for broadcast info:', parseError);
          throw new Error(`Invalid JSON response: ${responseText.substring(0, 100)}`);
        }
        
        if (data && data.isActive) {
          setRoomInfo({
            id: broadcastId,
            name: data.name || data.broadcastName || broadcastId,
            hostName: data.hostName || 'Host',
            participantCount: data.viewerCount || 1
          });
          setIsConnected(true);
          console.log('✅ Simple viewer connected via database:', data);
        } else {
          console.log('❌ Broadcast not found or inactive:', data);
          setIsConnected(false);
        }
      } catch (error) {
        console.error('❌ Error fetching broadcast info:', error);
        setIsConnected(false);
      }
    };
    
    fetchBroadcastInfo();
    
    // Set up polling interval to check for updates every second
    intervalRef.current = setInterval(async () => {
      try {
        // Get the latest broadcast state
        console.log(`🔄 Fetching broadcast state for: ${broadcastId} at ${new Date().toISOString()}`);
        const response = await fetch(`/api/broadcast/${encodeURIComponent(broadcastId)}/state`, {
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });
        
        // Log the raw response for debugging
        const responseText = await response.text();
        console.log(`📊 Raw response: ${responseText.substring(0, 200)}${responseText.length > 200 ? '...' : ''}`);
        
        // Parse the JSON response
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (parseError) {
          console.error('❌ Failed to parse JSON response:', parseError);
          throw new Error(`Invalid JSON response: ${responseText.substring(0, 100)}`);
        }
        
        if (data && data.isActive) {
          console.log('📺 Broadcast state update:', data);
          
          // Calculate the time since last update and advance position accordingly
          const now = Date.now();
          const timeSinceLastUpdate = (now - lastUpdateTimeRef.current) / 1000; // in seconds
          lastUpdateTimeRef.current = now;
          
          // Only advance time if we're playing
          let currentPosition = data.curTime || 0;
          if (data.isPlaying && broadcastState?.isPlaying) {
            // Advance the position based on elapsed time since last update
            currentPosition += timeSinceLastUpdate;
          }
          positionRef.current = currentPosition;
          
          // Update the state with new data and calculated position
          setBroadcastState({
            position: currentPosition,
            isPlaying: data.isPlaying || false,
            waveformProgress: currentPosition && data.duration ? currentPosition / data.duration : 0,
            songEntryId: data.curSong,
            currentLyricLine: data.curLyrics
          });
          
          // If there's a new song, fetch it from database
          if (data.curSong && data.curSong !== currentSong?.id) {
            console.log(`🎵 Fetching new song: ${data.curSong}`);
            try {
              const songResponse = await fetch(`/api/broadcast/song/${data.curSong}`, {
                headers: {
                  'Cache-Control': 'no-cache',
                  'Pragma': 'no-cache',
                  'Accept': 'application/json',
                  'Content-Type': 'application/json'
                }
              });
              if (songResponse.ok) {
                const songData = await songResponse.json();
                setCurrentSong(songData.song);
                console.log(`✅ Loaded song: ${songData.song.songTitle}`);
              } else {
                console.error('❌ Failed to fetch song:', await songResponse.text());
              }
            } catch (error) {
              console.error('❌ Failed to fetch song:', error);
            }
          }
        } else {
          console.log('❌ Broadcast no longer active or invalid data:', data);
          if (isConnected) {
            setIsConnected(false);
          }
        }
      } catch (error) {
        console.error('❌ Error polling broadcast state:', error);
        setIsConnected(false);
      }
    }, 1000); // Poll every second
    
    // Create a more frequent timer to update the playback position locally for smoother UI
    const playbackUpdateInterval = setInterval(() => {
      if (broadcastState?.isPlaying) {
        // If playing, increment the position by a small amount (0.1s)
        positionRef.current += 0.1;
        
        // Update state to reflect current position
        setBroadcastState(prev => {
          if (!prev) return prev;
          
          // Calculate waveform progress
          const duration = currentSong?.duration || 0;
          const waveformProgress = duration > 0 ? positionRef.current / duration : 0;
          
          return {
            ...prev,
            position: positionRef.current,
            waveformProgress: waveformProgress
          };
        });
      }
    }, 100); // Update UI every 100ms for smooth playback
    
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      clearInterval(playbackUpdateInterval);
    };
  }, [broadcastId, currentSong?.id, currentSong?.duration, isConnected, broadcastState?.isPlaying]);

  const leaveBroadcast = () => {
    // Clean up interval when leaving
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
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
                    allowMidi={false}
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