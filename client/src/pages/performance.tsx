import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import CompactTransportControls from "@/components/compact-transport-controls";
import AudioMixer from "@/components/audio-mixer";
import LyricsDisplay from "@/components/lyrics-display";
import SongSelector from "@/components/song-selector";
import StatusBar from "@/components/status-bar";
import TrackManager from "@/components/track-manager-new";
import StereoVUMeter from "@/components/stereo-vu-meter";
import { WaveformVisualizer } from "@/components/waveform-visualizer";

import { useAudioEngine } from "@/hooks/use-audio-engine";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Settings, Music, Menu, Plus, Edit, Play, Pause, Clock, Minus, Trash2, FileAudio, LogOut, User, Crown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocalAuth, type UserType } from "@/hooks/useLocalAuth";
import { LocalSongStorage, type LocalSong } from "@/lib/local-song-storage";

interface PerformanceProps {
  userType: UserType;
}

export default function Performance({ userType }: PerformanceProps) {
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
  const [, setLocation] = useLocation();
  const [latency, setLatency] = useState(2.1);
  const [isTrackManagerOpen, setIsTrackManagerOpen] = useState(false);
  const [isAddSongOpen, setIsAddSongOpen] = useState(false);
  const [songTitle, setSongTitle] = useState("");
  const [songArtist, setSongArtist] = useState("");
  const [isEditLyricsOpen, setIsEditLyricsOpen] = useState(false);
  const [lyricsText, setLyricsText] = useState("");
  const [isDeleteSongOpen, setIsDeleteSongOpen] = useState(false);
  const [allSongs, setAllSongs] = useState<LocalSong[]>([]);
  const [selectedSong, setSelectedSong] = useState<LocalSong | null>(null);

  const { toast } = useToast();
  const { user, logout } = useLocalAuth();

  // Load songs from localStorage when component mounts or user changes
  useEffect(() => {
    if (user?.email) {
      const songs = LocalSongStorage.getAllSongs(user.email);
      setAllSongs(songs);
      
      // If we had a selected song, try to restore it
      if (selectedSongId) {
        const song = LocalSongStorage.getSong(user.email, selectedSongId);
        setSelectedSong(song || null);
      }
    }
  }, [user?.email, selectedSongId]);

  // Update selected song when selectedSongId changes
  useEffect(() => {
    if (selectedSongId && user?.email) {
      const song = LocalSongStorage.getSong(user.email, selectedSongId);
      setSelectedSong(song || null);
    } else {
      setSelectedSong(null);
    }
  }, [selectedSongId, user?.email]);

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
  } = useAudioEngine(selectedSong as any);

  useKeyboardShortcuts({
    onPlay: play,
    onPause: pause,
    onStop: stop,
    onTogglePlayback: isPlaying ? pause : play,
    onTrackMute: updateTrackMute,
    isPlaying
  });

  // Log tracks that need audio files when song changes
  useEffect(() => {
    if (selectedSong) {
      // Check if any tracks need audio files (don't have blob:stored or data)
      const tracksNeedingFiles = selectedSong.tracks.filter(track => 
        track.audioUrl !== 'blob:stored' && !track.audioData
      );
      
      // Just log for debugging purposes
      if (tracksNeedingFiles.length > 0) {
        console.log(`${tracksNeedingFiles.length} tracks need audio files in song: ${selectedSong.title}`);
      }
    }
  }, [selectedSong]);

  // Simulate latency monitoring
  useEffect(() => {
    const interval = setInterval(() => {
      setLatency(2.0 + Math.random() * 0.5);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Refresh songs helper function
  const refreshSongs = () => {
    if (user?.email) {
      const songs = LocalSongStorage.getAllSongs(user.email);
      setAllSongs(songs);
      
      // Also refresh the currently selected song to pick up track changes
      if (selectedSongId) {
        const updatedSong = LocalSongStorage.getSong(user.email, selectedSongId);
        setSelectedSong(updatedSong || null);
      }
    }
  };

  // Track update handler for when tracks are added/removed/modified
  const handleTrackUpdate = useCallback(() => {
    console.log('Track data updated, refreshing song...');
    refreshSongs();
  }, [user?.email, selectedSongId]);

  // Add new song function
  const handleAddSongLocal = () => {
    if (!user?.email) return;
    
    try {
      const newSong = LocalSongStorage.addSong(user.email, {
        title: songTitle.trim(),
        artist: songArtist.trim(),
        duration: 180, // Default duration
        bpm: null,
        key: null,
        lyrics: null,
        waveformData: null
      });

      refreshSongs();
      setSelectedSongId(newSong.id);
      setIsAddSongOpen(false);
      setSongTitle("");
      setSongArtist("");

      toast({
        title: "Song created",
        description: `"${newSong.title}" has been added to your library.`
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create song. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Update lyrics function
  const handleUpdateLyrics = () => {
    if (!user?.email || !selectedSongId) return;
    
    try {
      LocalSongStorage.updateSong(user.email, selectedSongId, { lyrics: lyricsText });
      refreshSongs();
      setIsEditLyricsOpen(false);
      
      toast({
        title: "Lyrics updated",
        description: "Song lyrics have been saved."
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update lyrics. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Delete song function
  const handleDeleteSongLocal = () => {
    if (!user?.email || !selectedSongId) return;
    
    try {
      const success = LocalSongStorage.deleteSong(user.email, selectedSongId);
      
      if (success) {
        refreshSongs();
        setSelectedSongId(null);
        setIsDeleteSongOpen(false);
        
        // Stop any playing audio if something is playing
        if (isPlaying) {
          pause();
        }
        
        toast({
          title: "Song deleted",
          description: "Song removed successfully."
        });
      } else {
        throw new Error("Song not found");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete song. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleAddSong = () => {
    if (!songTitle.trim() || !songArtist.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter both song title and artist.",
        variant: "destructive"
      });
      return;
    }

    // Check subscription limits - prevent adding more than 2 songs for free users
    const MAX_FREE_SONGS = 2;
    if (allSongs.length >= MAX_FREE_SONGS && userType === 'free') {
      toast({
        title: "Upgrade Required",
        description: `Free users limited to ${MAX_FREE_SONGS} songs. Click the crown icon to upgrade for unlimited songs.`,
        variant: "destructive"
      });
      return;
    }

    handleAddSongLocal();
  };

  const handleEditLyrics = () => {
    if (selectedSong) {
      setLyricsText(selectedSong.lyrics || "");
      setIsEditLyricsOpen(true);
    }
  };

  const handleSaveLyrics = () => {
    handleUpdateLyrics();
  };

  const handleDeleteSong = () => {
    handleDeleteSongLocal();
  };

  const handleInsertTimestamp = () => {
    const timestamp = `[${Math.floor(currentTime / 60)}:${Math.floor(currentTime % 60).toString().padStart(2, '0')}]`;
    const textarea = document.getElementById('lyrics') as HTMLTextAreaElement;
    if (textarea) {
      const cursorPosition = textarea.selectionStart;
      const beforeCursor = lyricsText.substring(0, cursorPosition);
      const afterCursor = lyricsText.substring(cursorPosition);
      
      // Insert timestamp without adding a newline
      const newText = beforeCursor + timestamp + afterCursor;
      setLyricsText(newText);
      
      // Find the next line and position cursor at its beginning
      setTimeout(() => {
        const afterTimestamp = cursorPosition + timestamp.length;
        const nextNewlineIndex = newText.indexOf('\n', afterTimestamp);
        
        if (nextNewlineIndex !== -1) {
          // Move to exactly the beginning of the next line (right after the newline)
          const newCursorPosition = nextNewlineIndex + 1;
          
          textarea.selectionStart = newCursorPosition;
          textarea.selectionEnd = newCursorPosition;
        } else {
          // No next line exists, position cursor after the timestamp
          textarea.selectionStart = afterTimestamp;
          textarea.selectionEnd = afterTimestamp;
        }
        
        textarea.focus();
      }, 0);
    }
  };

  const handleSearchLyrics = () => {
    if (!selectedSong) return;
    
    // Open Google search with song name, artist name, and "lyrics"
    const searchQuery = `${selectedSong.title} ${selectedSong.artist} lyrics`;
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;
    
    console.log(`Opening Google search for: ${searchQuery}`);
    window.open(searchUrl, '_blank');
    
    toast({
      title: "Search opened in browser",
      description: "Copy lyrics from the search results and paste them into the text area below. Formatting will be preserved."
    });
  };

  const handleLyricsPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text/plain');
    
    // Get cursor position
    const textarea = e.target as HTMLTextAreaElement;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    
    // Insert pasted text at cursor position while preserving formatting
    const newText = lyricsText.substring(0, start) + pastedText + lyricsText.substring(end);
    setLyricsText(newText);
    
    // Restore cursor position after the pasted text
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + pastedText.length;
      textarea.focus();
    }, 0);
  };

  const handleUpgrade = () => {
    setLocation('/subscribe');
  };

  return (
    <div className="bg-background text-white h-screen font-inter flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-surface border-b border-gray-700 p-4 flex-shrink-0" data-testid="app-header">
        <div className="max-w-full flex items-center">
          <div className="flex items-center space-x-3 flex-shrink-0">
            <Music className="text-primary text-2xl" />
            <h1 className="text-2xl font-bold">StageTracker Pro</h1>
            <span className="bg-primary/20 text-primary px-2 py-1 rounded text-sm">LIVE</span>
          </div>
          
          {/* Waveform Visualizer - positioned 10px from LIVE badge and auto-fits remaining space */}
          <div className="flex-1 flex items-center ml-[10px] mr-4 py-1">
            <div className="flex-1 max-w-[600px]">
              <WaveformVisualizer
                song={selectedSong as any || null}
                currentTime={currentTime}
                isPlaying={isPlaying}
                audioLevels={audioLevels}
                className="border border-gray-600 rounded w-full"
              />
            </div>
          </div>
          
          <div className="flex items-center space-x-4 flex-shrink-0">
            <div className="text-sm text-gray-400">
              <span>Latency: </span>
              <span className="text-secondary">{latency.toFixed(1)}ms</span>
            </div>
            
            {/* Subscription Status */}
            {userType === 'free' && (
              <div className="flex items-center space-x-2 bg-gray-800 px-3 py-1 rounded-lg">
                <Crown className="w-4 h-4 text-yellow-500" />
                <span className="text-sm text-gray-300">
                  Free: {allSongs.length}/2 songs
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs px-2 py-1 h-6"
                  onClick={handleUpgrade}
                >
                  Upgrade
                </Button>
              </div>
            )}
            {userType === 'paid' && (
              <div className="flex items-center space-x-2 bg-green-900/30 px-3 py-1 rounded-lg">
                <Crown className="w-4 h-4 text-yellow-500" />
                <span className="text-sm text-green-300">Premium</span>
              </div>
            )}
            <Dialog open={isTrackManagerOpen} onOpenChange={setIsTrackManagerOpen}>
              <DialogContent className="max-w-[85vw] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Track Management</DialogTitle>
                </DialogHeader>
                <div className="mt-4 space-y-6">
                  <div className="max-w-full">
                    <TrackManager
                      song={selectedSong as any}
                      onTrackUpdate={handleTrackUpdate}
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
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button 
                  className="bg-surface hover:bg-gray-700 p-2 rounded-lg transition-colors" 
                  title="Settings"
                  data-testid="button-settings"
                >
                  <Settings className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem 
                  onClick={() => setLocation('/subscribe')}
                  className="flex items-center cursor-pointer"
                  data-testid="menu-subscribe"
                >
                  <Crown className="w-4 h-4 mr-2" />
                  <span>Subscribe Now</span>
                </DropdownMenuItem>
                <DropdownMenuItem disabled className="flex items-center">
                  <User className="w-4 h-4 mr-2" />
                  <div className="flex flex-col">
                    <span className="text-sm">{user?.email || 'Test User'}</span>
                    <span className="text-xs text-gray-500">{userType === 'paid' ? 'Premium User' : 'Free User'}</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={logout}
                  className="flex items-center text-red-600 focus:text-red-600 cursor-pointer"
                  data-testid="menu-item-logout"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
                      data-testid="button-cancel-song"
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleAddSong}
                      disabled={!songTitle.trim() || !songArtist.trim()}
                      data-testid="button-create-song"
                    >
                      Create Song
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
                        data-testid="button-cancel-delete"
                      >
                        Cancel
                      </Button>
                      <Button 
                        variant="destructive"
                        onClick={handleDeleteSong}
                        data-testid="button-confirm-delete"
                      >
                        Delete Song
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
              song={selectedSong as any}
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
                  onClick={handleSearchLyrics}
                  disabled={!selectedSong}
                  data-testid="button-search-lyrics"
                >
                  <Music className="w-4 h-4 mr-1" />
                  Search for Lyrics
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
                onPaste={handleLyricsPaste}
                placeholder="Enter song lyrics with timestamps and MIDI commands..."
                className="min-h-[400px] font-mono text-sm whitespace-pre-wrap"
                style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}
                spellCheck={false}
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
                data-testid="button-cancel-lyrics"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSaveLyrics}
                data-testid="button-save-lyrics"
              >
                Save Lyrics
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>


    </div>
  );
}
