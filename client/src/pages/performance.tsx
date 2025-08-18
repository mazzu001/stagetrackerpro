import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import CompactTransportControls from "@/components/compact-transport-controls";
import AudioMixer from "@/components/audio-mixer";
import LyricsDisplay from "@/components/lyrics-display";
import SongSelector from "@/components/song-selector";
import StatusBar from "@/components/status-bar";
import TrackManager from "@/components/track-manager";
import StereoVUMeter from "@/components/stereo-vu-meter";
import { useAudioEngine } from "@/hooks/use-audio-engine";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings, Music, Menu, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { SongWithTracks } from "@shared/schema";

export default function Performance() {
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
  const [latency, setLatency] = useState(2.1);
  const [isTrackManagerOpen, setIsTrackManagerOpen] = useState(false);
  const [isAddSongOpen, setIsAddSongOpen] = useState(false);
  const [songTitle, setSongTitle] = useState("");
  const [songArtist, setSongArtist] = useState("");


  const { toast } = useToast();

  const { data: selectedSong } = useQuery<SongWithTracks>({
    queryKey: ['/api/songs', selectedSongId],
    enabled: !!selectedSongId
  });

  const {
    isPlaying,
    currentTime,
    duration,
    audioLevels,
    masterStereoLevels,
    cpuUsage,
    isAudioEngineOnline,
    isMidiConnected,
    play,
    pause,
    stop,
    seek,
    updateTrackVolume,
    updateTrackBalance,
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

  // Mutation for adding new songs
  const addSongMutation = useMutation({
    mutationFn: async (songData: { title: string; artist: string; duration: number }) => {
      const response = await fetch('/api/songs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(songData)
      });
      if (!response.ok) throw new Error('Failed to create song');
      return response.json();
    },
    onSuccess: (newSong) => {
      queryClient.invalidateQueries({ queryKey: ['/api/songs'] });
      setSelectedSongId(newSong.id);
      setIsAddSongOpen(false);
      setSongTitle("");
      setSongArtist("");

      toast({
        title: "Song created",
        description: `"${newSong.title}" has been added to your library.`
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create song. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleAddSong = () => {
    if (!songTitle.trim() || !songArtist.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter both song title and artist.",
        variant: "destructive"
      });
      return;
    }

    addSongMutation.mutate({
      title: songTitle.trim(),
      artist: songArtist.trim(),
      duration: 180 // Default duration, will be updated when tracks are added
    });
  };

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
              <DialogContent className="max-w-[85vw] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Track Management</DialogTitle>
                </DialogHeader>
                <div className="mt-4 space-y-6">
                  <div className="max-w-full">
                    <TrackManager
                      song={selectedSong}
                      onTrackUpdate={() => {
                        if (selectedSongId) {
                          queryClient.invalidateQueries({ queryKey: ['/api/songs', selectedSongId] });
                          queryClient.invalidateQueries({ queryKey: ['/api/songs'] });
                        }
                      }}
                      onTrackVolumeChange={updateTrackVolume}
                      onTrackMuteToggle={updateTrackMute}
                      onTrackSoloToggle={updateTrackSolo}
                      onTrackBalanceChange={updateTrackBalance}
                      audioLevels={audioLevels}
                      isPlaying={isPlaying}
                      onPlay={play}
                      onPause={pause}
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
          <div className="p-4 border-b border-gray-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Songs</h2>
            <Dialog open={isAddSongOpen} onOpenChange={(open) => !isPlaying && setIsAddSongOpen(open)}>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-8 w-8 p-0 ${
                    isPlaying 
                      ? 'cursor-not-allowed opacity-50' 
                      : 'hover:bg-gray-700'
                  }`}
                  disabled={isPlaying}
                  data-testid="button-add-song"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Add New Song</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <Label htmlFor="songTitle">Song Title *</Label>
                    <Input
                      id="songTitle"
                      value={songTitle}
                      onChange={(e) => setSongTitle(e.target.value)}
                      placeholder="Enter song title..."
                      data-testid="input-song-title"
                    />
                  </div>
                  <div>
                    <Label htmlFor="songArtist">Artist *</Label>
                    <Input
                      id="songArtist"
                      value={songArtist}
                      onChange={(e) => setSongArtist(e.target.value)}
                      placeholder="Enter artist name..."
                      data-testid="input-song-artist"
                    />
                  </div>

                  <div className="flex justify-end space-x-2 pt-4">
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setIsAddSongOpen(false);
                        setSongTitle("");
                        setSongArtist("");

                      }}
                      disabled={addSongMutation.isPending}
                      data-testid="button-cancel-song"
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleAddSong}
                      disabled={addSongMutation.isPending || !songTitle.trim() || !songArtist.trim()}
                      data-testid="button-create-song"
                    >
                      {addSongMutation.isPending ? "Creating..." : "Create Song"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="flex-1 overflow-y-auto">
            {allSongs.map((song) => (
              <div
                key={song.id}
                className={`p-4 border-b border-gray-700 transition-colors ${
                  selectedSongId === song.id ? 'bg-primary/20 border-l-4 border-l-primary' : ''
                } ${
                  isPlaying ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-gray-700'
                }`}
                onClick={() => !isPlaying && setSelectedSongId(song.id)}
                data-testid={`song-item-${song.id}`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-medium">{song.title}</div>
                  <button
                    className={`text-xs px-2 py-1 rounded transition-colors ${
                      isPlaying 
                        ? 'bg-gray-600 cursor-not-allowed opacity-50' 
                        : 'bg-gray-700 hover:bg-gray-600'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isPlaying) {
                        setSelectedSongId(song.id);
                        setIsTrackManagerOpen(true);
                      }
                    }}
                    disabled={isPlaying}
                    data-testid={`button-tracks-${song.id}`}
                  >
                    {song.tracks ? song.tracks.length : 0} tracks
                  </button>
                </div>
                <div className="text-sm text-gray-400">{song.artist}</div>
                <div className="flex items-center justify-between">
                  <div className="text-xs text-gray-500">
                    {song.duration ? `${Math.floor(song.duration / 60)}:${(song.duration % 60).toString().padStart(2, '0')}` : 'No duration'}
                  </div>
                  {selectedSongId === song.id && isPlaying && (
                    <StereoVUMeter
                      leftLevel={masterStereoLevels.left}
                      rightLevel={masterStereoLevels.right}
                      isPlaying={isPlaying}
                      className="flex-shrink-0"
                    />
                  )}
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
