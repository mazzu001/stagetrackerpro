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
import { WaveformVisualizer } from "@/components/waveform-visualizer";
import { useAudioEngine } from "@/hooks/use-audio-engine";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Settings, Music, Menu, Plus, Edit, Play, Pause, Clock, Minus, Trash2 } from "lucide-react";
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
  const [isEditLyricsOpen, setIsEditLyricsOpen] = useState(false);
  const [lyricsText, setLyricsText] = useState("");
  const [isImportingLyrics, setIsImportingLyrics] = useState(false);
  const [isDeleteSongOpen, setIsDeleteSongOpen] = useState(false);


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

  // Mutation for updating lyrics
  const updateLyricsMutation = useMutation({
    mutationFn: async (lyrics: string) => {
      if (!selectedSongId) throw new Error('No song selected');
      const response = await fetch(`/api/songs/${selectedSongId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lyrics })
      });
      if (!response.ok) throw new Error('Failed to update lyrics');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/songs', selectedSongId] });
      queryClient.invalidateQueries({ queryKey: ['/api/songs'] });
      setIsEditLyricsOpen(false);
      toast({
        title: "Lyrics updated",
        description: "Song lyrics have been saved successfully."
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update lyrics. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Mutation for deleting song
  const deleteSongMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSongId) throw new Error('No song selected');
      const response = await apiRequest('DELETE', `/api/songs/${selectedSongId}`);
      if (!response.ok) throw new Error('Failed to delete song');
      // DELETE returns 204 No Content, so no JSON to parse
      return;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/songs'] });
      setSelectedSongId(null);
      setIsDeleteSongOpen(false);
      toast({
        title: "Song deleted",
        description: "Song removed from app. Your local audio files are safe."
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete song. Please try again.",
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

  const handleEditLyrics = () => {
    if (selectedSong) {
      setLyricsText(selectedSong.lyrics || "");
      setIsEditLyricsOpen(true);
    }
  };

  const handleSaveLyrics = () => {
    updateLyricsMutation.mutate(lyricsText);
  };

  const handleDeleteSong = () => {
    deleteSongMutation.mutate();
  };

  const handleInsertTimestamp = () => {
    const timestamp = `[${Math.floor(currentTime / 60)}:${Math.floor(currentTime % 60).toString().padStart(2, '0')}]`;
    const textarea = document.getElementById('lyrics') as HTMLTextAreaElement;
    if (textarea) {
      const cursorPosition = textarea.selectionStart;
      const beforeCursor = lyricsText.substring(0, cursorPosition);
      const afterCursor = lyricsText.substring(cursorPosition);
      
      // Insert timestamp and move to next line
      const newText = beforeCursor + timestamp + ' ' + afterCursor;
      setLyricsText(newText);
      
      // Set cursor position after the timestamp and space, then move to next line
      setTimeout(() => {
        const newCursorPosition = cursorPosition + timestamp.length + 1;
        textarea.selectionStart = newCursorPosition;
        textarea.selectionEnd = newCursorPosition;
        textarea.focus();
        
        // Find the next newline and position cursor there
        const nextNewlineIndex = newText.indexOf('\n', newCursorPosition);
        if (nextNewlineIndex !== -1) {
          textarea.selectionStart = nextNewlineIndex + 1;
          textarea.selectionEnd = nextNewlineIndex + 1;
        }
      }, 0);
    }
  };

  const handleImportLyrics = async () => {
    if (!selectedSong) return;
    
    setIsImportingLyrics(true);
    try {
      // Call search API to get lyrics
      const response = await apiRequest('POST', '/api/lyrics/search', {
        title: selectedSong.title,
        artist: selectedSong.artist
      });
      
      const result = await response.json();
      
      if (result.success && result.lyrics) {
        setLyricsText(result.lyrics);
        toast({
          title: "Lyrics imported!",
          description: `Found lyrics for "${selectedSong.title}" by ${selectedSong.artist}`
        });
      } else {
        toast({
          title: "No lyrics found",
          description: result.message || "Unable to find lyrics for this song. You can enter them manually.",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Import failed",
        description: "Failed to search for lyrics. Please check your internet connection.",
        variant: "destructive"
      });
    } finally {
      setIsImportingLyrics(false);
    }
  };

  return (
    <div className="bg-background text-white h-screen font-inter flex flex-col overflow-hidden">
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
            <div className="flex items-center space-x-2">
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
                    title="Add new song"
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
              
              <Dialog open={isDeleteSongOpen} onOpenChange={(open) => !isPlaying && setIsDeleteSongOpen(open)}>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`h-8 w-8 p-0 ${
                      isPlaying || !selectedSongId
                        ? 'cursor-not-allowed opacity-50' 
                        : 'hover:bg-red-700/20 text-red-400 hover:text-red-300'
                    }`}
                    disabled={isPlaying || !selectedSongId}
                    title="Delete selected song"
                    data-testid="button-delete-song"
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Delete Song</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div className="text-sm text-gray-300">
                      Are you sure you want to delete <strong>"{selectedSong?.title}"</strong> by <strong>{selectedSong?.artist}</strong>?
                    </div>
                    <div className="text-sm text-red-400 bg-red-900/20 border border-red-700 rounded-lg p-3">
                      <div className="flex items-center space-x-2">
                        <Trash2 className="w-4 h-4" />
                        <span>This will remove the song from the app only. Your local audio files will remain safe and untouched.</span>
                      </div>
                    </div>
                    <div className="flex justify-end space-x-2 pt-4">
                      <Button 
                        variant="outline" 
                        onClick={() => setIsDeleteSongOpen(false)}
                        disabled={deleteSongMutation.isPending}
                        data-testid="button-cancel-delete"
                      >
                        Cancel
                      </Button>
                      <Button 
                        variant="destructive"
                        onClick={handleDeleteSong}
                        disabled={deleteSongMutation.isPending}
                        data-testid="button-confirm-delete"
                      >
                        {deleteSongMutation.isPending ? "Deleting..." : "Delete Song"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
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
          <div className="p-4 border-t border-gray-700 flex-shrink-0">
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
          <div className="p-4 border-b border-gray-700 bg-surface flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {selectedSong ? `${selectedSong.title} - ${selectedSong.artist}` : 'Select a song'}
            </h2>
            {selectedSong && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleEditLyrics}
                data-testid="button-edit-lyrics"
              >
                <Edit className="w-4 h-4 mr-1" />
                Edit Lyrics
              </Button>
            )}
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

      {/* Edit Lyrics Dialog */}
      <Dialog open={isEditLyricsOpen} onOpenChange={setIsEditLyricsOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Edit Lyrics - {selectedSong?.title} by {selectedSong?.artist}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={isPlaying ? pause : play}
                  disabled={!selectedSong || !selectedSong.tracks || selectedSong.tracks.length === 0}
                  data-testid="button-preview-playback"
                >
                  {isPlaying ? <Pause className="w-4 h-4 mr-1" /> : <Play className="w-4 h-4 mr-1" />}
                  {isPlaying ? 'Pause' : 'Preview'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleInsertTimestamp}
                  data-testid="button-insert-timestamp"
                >
                  <Clock className="w-4 h-4 mr-1" />
                  Insert Time Stamp
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleImportLyrics}
                  disabled={isImportingLyrics || !selectedSong}
                  data-testid="button-import-lyrics"
                >
                  <Music className="w-4 h-4 mr-1" />
                  {isImportingLyrics ? 'Searching...' : 'Import Lyrics'}
                </Button>
              </div>
              <div className="text-sm text-gray-400">
                Current Time: {Math.floor(currentTime / 60)}:{Math.floor(currentTime % 60).toString().padStart(2, '0')}
              </div>
            </div>
            <div>
              <Label htmlFor="lyrics">Lyrics</Label>
              <Textarea
                id="lyrics"
                value={lyricsText}
                onChange={(e) => setLyricsText(e.target.value)}
                placeholder="Enter song lyrics with timestamps and MIDI commands..."
                className="min-h-[400px] font-mono text-sm"
                data-testid="textarea-lyrics"
              />
              <p className="text-xs text-gray-500 mt-2">
                Tip: Use [00:15] for timestamps and [[CC:1:64]] for MIDI commands. Use the "Insert Time Stamp" button to add current playback time.
              </p>
            </div>
            <div className="flex justify-end space-x-2 pt-4">
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsEditLyricsOpen(false);
                  setLyricsText("");
                }}
                disabled={updateLyricsMutation.isPending}
                data-testid="button-cancel-lyrics"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSaveLyrics}
                disabled={updateLyricsMutation.isPending}
                data-testid="button-save-lyrics"
              >
                {updateLyricsMutation.isPending ? "Saving..." : "Save Lyrics"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
