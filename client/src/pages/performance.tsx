import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import CompactTransportControls from "@/components/compact-transport-controls";
import AudioMixer from "@/components/audio-mixer";
import LyricsDisplay from "@/components/lyrics-display";
import SongSelector from "@/components/song-selector";
import StatusBar from "@/components/status-bar";
import TrackManager from "@/components/track-manager";
import { useAudioEngine } from "@/hooks/use-audio-engine";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Settings, Music, Menu } from "lucide-react";
import type { SongWithTracks } from "@shared/schema";

export default function Performance() {
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
  const [latency, setLatency] = useState(2.1);
  const [isTrackManagerOpen, setIsTrackManagerOpen] = useState(false);

  const { data: selectedSong } = useQuery<SongWithTracks>({
    queryKey: ['/api/songs', selectedSongId],
    enabled: !!selectedSongId
  });

  const {
    isPlaying,
    currentTime,
    duration,
    audioLevels,
    cpuUsage,
    isAudioEngineOnline,
    isMidiConnected,
    play,
    pause,
    stop,
    seek,
    updateTrackVolume,
    updateTrackMute,
    updateTrackSolo,
    updateMasterVolume,
    masterVolume
  } = useAudioEngine(selectedSong);

  useKeyboardShortcuts({
    onPlay: play,
    onPause: pause,
    onStop: stop,
    onTogglePlayback: isPlaying ? pause : play,
    onTrackMute: updateTrackMute,
    isPlaying
  });

  // Simulate latency monitoring
  useEffect(() => {
    const interval = setInterval(() => {
      setLatency(2.0 + Math.random() * 0.5);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Get all songs for the sidebar
  const { data: allSongs = [] } = useQuery<SongWithTracks[]>({
    queryKey: ['/api/songs']
  });

  return (
    <div className="bg-background text-white min-h-screen font-inter flex flex-col">
      {/* Header */}
      <header className="bg-surface border-b border-gray-700 p-4 flex-shrink-0" data-testid="app-header">
        <div className="max-w-full flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Music className="text-primary text-2xl" />
            <h1 className="text-2xl font-bold">StageTracker Pro</h1>
            <span className="bg-primary/20 text-primary px-2 py-1 rounded text-sm">LIVE</span>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-400">
              <span>Latency: </span>
              <span className="text-secondary">{latency.toFixed(1)}ms</span>
            </div>
            <Dialog open={isTrackManagerOpen} onOpenChange={setIsTrackManagerOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-surface hover:bg-gray-700 border-gray-600"
                  data-testid="button-track-manager"
                >
                  <Menu className="w-4 h-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Track Management</DialogTitle>
                </DialogHeader>
                <div className="mt-4">
                  <TrackManager
                    song={selectedSong}
                    onTrackUpdate={() => {
                      if (selectedSongId) {
                        queryClient.invalidateQueries({ queryKey: ['/api/songs', selectedSongId] });
                      }
                    }}
                  />
                  <div className="mt-6">
                    <AudioMixer
                      song={selectedSong}
                      audioLevels={audioLevels}
                      masterVolume={masterVolume}
                      onTrackVolumeChange={updateTrackVolume}
                      onTrackMuteToggle={updateTrackMute}
                      onTrackSoloToggle={updateTrackSolo}
                      onMasterVolumeChange={updateMasterVolume}
                    />
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <button 
              className="bg-surface hover:bg-gray-700 p-2 rounded-lg transition-colors" 
              title="Settings"
              data-testid="button-settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>



      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Song List (30%) */}
        <div className="w-[30%] bg-surface border-r border-gray-700 flex flex-col">
          <div className="p-4 border-b border-gray-700">
            <h2 className="text-lg font-semibold">Songs</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            {allSongs.map((song) => (
              <div
                key={song.id}
                className={`p-4 border-b border-gray-700 cursor-pointer transition-colors hover:bg-gray-700 ${
                  selectedSongId === song.id ? 'bg-primary/20 border-l-4 border-l-primary' : ''
                }`}
                onClick={() => setSelectedSongId(song.id)}
                data-testid={`song-item-${song.id}`}
              >
                <div className="font-medium">{song.title}</div>
                <div className="text-sm text-gray-400">{song.artist}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {song.duration ? `${Math.floor(song.duration / 60)}:${(song.duration % 60).toString().padStart(2, '0')}` : 'No duration'}
                  {song.tracks && ` • ${song.tracks.length} tracks`}
                </div>
              </div>
            ))}
            {allSongs.length === 0 && (
              <div className="p-4 text-center text-gray-400">
                <Music className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No songs found</p>
                <p className="text-xs mt-1">Create a song to get started</p>
              </div>
            )}
          </div>
          
          {/* Compact Transport Controls */}
          <div className="p-4 border-t border-gray-700">
            <CompactTransportControls
              isPlaying={isPlaying}
              currentTime={currentTime}
              duration={duration}
              progress={progress}
              isMidiConnected={isMidiConnected}
              onPlay={play}
              onPause={pause}
              onStop={stop}
              onSeek={seek}
            />
          </div>
        </div>

        {/* Right Content Area - Lyrics (70%) */}
        <div className="flex-1 flex flex-col">
          <div className="p-4 border-b border-gray-700 bg-surface">
            <h2 className="text-lg font-semibold">
              {selectedSong ? `${selectedSong.title} - ${selectedSong.artist}` : 'Select a song'}
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <LyricsDisplay
              song={selectedSong}
              currentTime={currentTime}
            />
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="bg-surface border-t border-gray-700 p-2 flex-shrink-0">
        <StatusBar
          isAudioEngineOnline={isAudioEngineOnline}
          isMidiConnected={isMidiConnected}
          cpuUsage={cpuUsage}
        />
      </div>
    </div>
  );
}
