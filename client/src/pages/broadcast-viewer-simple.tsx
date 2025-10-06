import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { LogOut, Play, Pause, Volume2 } from "lucide-react";
import { LyricsDisplay } from "@/components/lyrics-display";
import { SimpleBroadcastViewer } from "@/lib/broadcast";

interface SongData {
  id: string;
  title: string;
  artist: string;
  duration: number;
  lyrics: string;
  waveformData?: any;
}

interface BroadcastState {
  isActive: boolean;
  currentSong: string | null;
  position: number;
  isPlaying: boolean;
  lastUpdate?: number;
}

export default function SimpleBroadcastViewerPage() {
  const [, setLocation] = useLocation();
  const [isConnected, setIsConnected] = useState(false);
  const [currentSong, setCurrentSong] = useState<SongData | null>(null);
  const [broadcastState, setBroadcastState] = useState<BroadcastState | null>(null);
  const [roomInfo, setRoomInfo] = useState<any>(null);
  const viewerRef = useRef<SimpleBroadcastViewer | null>(null);

  // Get broadcast ID from URL
  const broadcastId = new URLSearchParams(window.location.search).get('id') || 'Matt';

  useEffect(() => {
    console.log(`🎵 Simple viewer connecting to Firebase broadcast: ${broadcastId}`);
    
    setRoomInfo({
      id: broadcastId,
      name: `${broadcastId}'s Broadcast`,
      hostName: broadcastId,
      participantCount: 1
    });
    
    // Create Firebase viewer instance
    const viewer = new SimpleBroadcastViewer();
    viewerRef.current = viewer;
    
    // Connect to Firebase broadcast with real-time callbacks
    viewer.connect(
      broadcastId,
      // onUpdate callback - receives real-time Firestore updates
      (data) => {
        console.log('� Firebase broadcast update:', data);
        
        // Update broadcast state
        setBroadcastState({
          isActive: true,
          currentSong: data.currentSong?.songName || null,
          position: data.position || 0,
          isPlaying: data.isPlaying || false,
          lastUpdate: data.lastUpdate
        });
        
        // If there's a new song, set it
        if (data.currentSong && data.currentSong.songName !== currentSong?.title) {
          console.log(`🎵 New song from Firebase: ${data.currentSong.songName}`);
          setCurrentSong({
            id: data.currentSong.songName,
            title: data.currentSong.songName,
            artist: data.currentSong.artist,
            duration: 0,
            lyrics: data.currentSong.lyrics || '',
            waveformData: data.currentSong.waveform
          });
        }
        
        setIsConnected(true);
      },
      // onEnd callback - broadcast ended or connection lost
      () => {
        console.log('❌ Firebase broadcast ended or connection lost');
        setIsConnected(false);
        setBroadcastState(null);
      }
    ).catch((error) => {
      console.error('❌ Error connecting to Firebase broadcast:', error);
      setIsConnected(false);
    });
    
    return () => {
      // Cleanup: disconnect from Firebase when component unmounts
      if (viewerRef.current) {
        viewerRef.current.disconnect();
        viewerRef.current = null;
      }
    };
  }, [broadcastId]);

  const leaveBroadcast = () => {
    // Clean up Firebase viewer when leaving
    if (viewerRef.current) {
      viewerRef.current.disconnect();
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
          <p className="text-gray-300 text-sm mt-2">Connecting to: {broadcastId}</p>
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
                  <h2 className="text-xl font-bold">{currentSong.title}</h2>
                  <p className="text-gray-300">{currentSong.artist}</p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-white/20 rounded-full h-2 mb-2">
                <div 
                  className="bg-blue-400 h-2 rounded-full transition-all duration-300"
                  style={{ 
                    width: `${currentSong.duration > 0 ? ((broadcastState?.position || 0) / currentSong.duration) * 100 : 0}%` 
                  }}
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
                      title: currentSong.title,
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
            <p className="text-sm text-gray-500 mt-2">Connected to broadcast: {broadcastId}</p>
          </div>
        )}
      </div>
    </div>
  );
}