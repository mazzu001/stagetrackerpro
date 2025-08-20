import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import CompactTransportControls from "@/components/compact-transport-controls";
import AudioMixer from "@/components/audio-mixer";
import { LyricsDisplay } from "@/components/lyrics-display";
import { LyricsControls } from "@/components/lyrics-controls";
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
      // Sort songs alphabetically by title
      const sortedSongs = songs.sort((a, b) => a.title.localeCompare(b.title));
      setAllSongs(sortedSongs);
      
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
    isLoadingTracks,
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
      // Sort songs alphabetically by title
      const sortedSongs = songs.sort((a, b) => a.title.localeCompare(b.title));
      setAllSongs(sortedSongs);
      
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

  // Download sample ZIP files
  const downloadSampleZip = (sampleType: '3AM' | 'ComfortablyNumb') => {
    const downloadUrls = {
      '3AM': '/api/download/3am-sample',
      'ComfortablyNumb': '/api/download/comfortably-numb-sample'
    };
    
    const fileName = sampleType === '3AM' ? '3AM_Matchbox20_Sample.zip' : 'ComfortablyNumb_PinkFloyd_Sample.zip';
    const downloadUrl = downloadUrls[sampleType];
    
    // Create download link that uses the server endpoint
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = fileName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "Download Started",
      description: `Downloading ${fileName} for beta testing`,
      variant: "default"
    });
  };



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
    console.log(`Insert timestamp - currentTime: ${currentTime}, duration: ${duration}, isPlaying: ${isPlaying}`);
    const timestamp = `[${Math.floor(currentTime / 60)}:${Math.floor(currentTime % 60).toString().padStart(2, '0')}]`;
    const textarea = document.getElementById('lyrics') as HTMLTextAreaElement;
    if (textarea) {
      // Get current cursor position and selected text
      const startPos = textarea.selectionStart;
      const endPos = textarea.selectionEnd;
      
      // Get current textarea value directly
      const currentValue = textarea.value;
      
      // Insert timestamp, replacing any selected text
      const newValue = currentValue.substring(0, startPos) + timestamp + currentValue.substring(endPos);
      
      // Update both DOM and React state
      textarea.value = newValue;
      setLyricsText(newValue);
      
      // Calculate new cursor position after timestamp
      const newCursorPos = startPos + timestamp.length;
      
      // Find the next newline starting from the new cursor position
      const nextNewlineIdx = newValue.indexOf('\n', newCursorPos);
      
      if (nextNewlineIdx !== -1) {
        // Move cursor to beginning of next line
        textarea.setSelectionRange(nextNewlineIdx + 1, nextNewlineIdx + 1);
      } else {
        // No next line found, position after timestamp
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }
      
      textarea.focus();
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
    <div className="bg-background text-white min-h-screen h-screen mobile-vh-fix font-inter flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-surface border-b border-gray-700 p-2 md:p-4 flex-shrink-0" data-testid="app-header">
        <div className="max-w-full flex items-center">
          <div className="flex items-center space-x-2 md:space-x-3 flex-shrink-0">
            <Music className="text-primary text-xl md:text-2xl" />
            <h1 className="text-lg md:text-2xl font-bold mobile-hidden">StageTracker Pro</h1>
            <span className="bg-primary/20 text-primary px-1 md:px-2 py-1 rounded text-xs md:text-sm">LIVE</span>
          </div>
          
          {/* Waveform Visualizer - centered and responsive */}
          <div className="flex-1 flex items-center justify-center mx-2 md:mx-4 py-1">
            <div className="w-full max-w-[500px] min-w-[150px] md:min-w-[200px]">
              <WaveformVisualizer
                song={selectedSong as any || null}
                currentTime={currentTime}
                isPlaying={isPlaying}
                audioLevels={audioLevels}
                className="border border-gray-600 rounded w-full h-[48px] md:h-[68px]"
              />
            </div>
          </div>
          
          <div className="flex items-center space-x-2 md:space-x-4 flex-shrink-0">
            {/* Subscription Status - Desktop only */}
            {userType === 'free' && (
              <div className="flex items-center space-x-1 md:space-x-2 bg-gray-800 px-2 md:px-3 py-1 rounded-lg mobile-hidden">
                <Crown className="w-3 h-3 md:w-4 md:h-4 text-yellow-500" />
                <span className="text-xs md:text-sm text-gray-300">
                  Free: {allSongs.length}/2 songs
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs px-1 md:px-2 py-1 h-6 btn-touch"
                  onClick={handleUpgrade}
                >
                  Upgrade
                </Button>
              </div>
            )}
            {userType === 'paid' && (
              <div className="flex items-center space-x-1 md:space-x-2 bg-green-900/30 px-2 md:px-3 py-1 rounded-lg mobile-hidden">
                <Crown className="w-3 h-3 md:w-4 md:h-4 text-yellow-500" />
                <span className="text-xs md:text-sm text-green-300">Premium</span>
              </div>
            )}
            <Dialog open={isTrackManagerOpen} onOpenChange={setIsTrackManagerOpen}>
              <DialogContent className="max-w-[98vw] w-full md:max-w-[85vw] max-h-[90vh] overflow-y-auto p-3 md:p-6">
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
                      isLoadingTracks={isLoadingTracks}
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
                  className="bg-surface hover:bg-gray-700 p-2 rounded-lg transition-colors touch-target" 
                  title="Settings"
                  data-testid="button-settings"
                >
                  <Settings className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                {/* Mobile subscription status */}
                <div className="mobile-flex md:hidden">
                  {userType === 'free' && (
                    <>
                      <DropdownMenuItem className="flex items-center justify-between">
                        <div className="flex items-center">
                          <Crown className="w-4 h-4 mr-2 text-yellow-500" />
                          <span>Free Plan</span>
                        </div>
                        <span className="text-xs text-gray-400">{allSongs.length}/2 songs</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => setLocation('/subscribe')}
                        className="flex items-center cursor-pointer text-yellow-500"
                        data-testid="menu-upgrade-mobile"
                      >
                        <Crown className="w-4 h-4 mr-2" />
                        <span>Upgrade to Premium</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  {userType === 'paid' && (
                    <>
                      <DropdownMenuItem className="flex items-center">
                        <Crown className="w-4 h-4 mr-2 text-yellow-500" />
                        <span className="text-green-400">Premium Active</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                </div>
                
                {/* Desktop subscription link */}
                <DropdownMenuItem 
                  onClick={() => setLocation('/subscribe')}
                  className="flex items-center cursor-pointer mobile-hidden"
                  data-testid="menu-subscribe"
                >
                  <Crown className="w-4 h-4 mr-2" />
                  <span>Subscribe Now</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="mobile-hidden" />
                <DropdownMenuItem 
                  onClick={() => downloadSampleZip('3AM')}
                  className="flex items-center cursor-pointer"
                  data-testid="menu-download-3am"
                >
                  <FileAudio className="w-4 h-4 mr-2" />
                  <span>Download 3AM - Matchbox 20</span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => downloadSampleZip('ComfortablyNumb')}
                  className="flex items-center cursor-pointer"
                  data-testid="menu-download-comfortably-numb"
                >
                  <FileAudio className="w-4 h-4 mr-2" />
                  <span>Download Comfortably Numb - Pink Floyd</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
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
      <div className="flex flex-1 min-h-0 overflow-hidden flex-col md:flex-row">
        {/* Mobile: Song List at top */}
        <div className="w-full md:w-[30%] bg-surface border-b md:border-b-0 md:border-r border-gray-700 flex flex-col max-h-[30vh] md:max-h-none">
          <div className="p-2 md:p-4 border-b border-gray-700 flex items-center justify-between">
            <h2 className="text-base md:text-lg font-semibold">Songs</h2>

            <div className="flex items-center space-x-2">
              <Dialog open={isAddSongOpen} onOpenChange={(open) => !isPlaying && setIsAddSongOpen(open)}>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`h-8 w-8 p-0 touch-target ${
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
              <DialogContent className="sm:max-w-md mobile-padding">
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
                className={`p-2 md:p-4 border-b border-gray-700 transition-colors touch-target cursor-pointer hover:bg-gray-700 pt-[8px] pb-[8px] ${
                  selectedSongId === song.id
                    ? 'bg-primary/20 border-l-4 border-l-primary'
                    : 'bg-transparent border-l-4 border-l-transparent hover:border-l-gray-600'
                }`}
                onClick={() => !isPlaying && setSelectedSongId(song.id)}
                data-testid={`song-item-${song.id}`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-medium text-sm md:text-base truncate mr-2">{song.title}</div>
                  <button
                    className={`text-xs px-2 py-1 rounded transition-colors touch-target flex-shrink-0 ${
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
                <div className="text-xs md:text-sm text-gray-400 truncate">{song.artist}</div>
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
          
          {/* Desktop only: Compact Transport Controls */}
          <div className="p-2 md:p-4 border-t border-gray-700 flex-shrink-0 mobile-hidden">
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

        {/* Right Content Area - Lyrics */}
        <div className="flex-1 flex flex-col min-h-0 md:flex-row">
          {/* Mobile: Lyrics above transport controls */}
          <div className="flex-1 flex flex-col">
            <div className="p-2 md:p-4 border-b border-gray-700 bg-surface flex items-center justify-between mobile-hidden">
              <h2 className="text-sm md:text-lg font-semibold truncate mr-2">
                {selectedSong ? `${selectedSong.title} - ${selectedSong.artist}` : 'Select a song'}
              </h2>
              
              {/* Lyrics Controls */}
              {selectedSong && <LyricsControls onEditLyrics={handleEditLyrics} song={selectedSong} />}
            </div>
            <div className="p-2 md:p-4" style={{ contain: 'layout style', overflow: 'hidden' }}>
              <LyricsDisplay
                song={selectedSong}
                currentTime={currentTime}
                onEditLyrics={selectedSong ? handleEditLyrics : undefined}
              />
            </div>
            
            {/* Mobile only: Transport controls at bottom - full width */}
            <div className="p-3 border-t border-gray-700 flex-shrink-0 mobile-flex md:hidden w-full">
              <div className="w-full">
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
          </div>
        </div>
      </div>
      {/* Status Bar - Desktop only */}
      <div className="bg-surface border-t border-gray-700 p-2 flex-shrink-0 mobile-hidden">
        <StatusBar
          isAudioEngineOnline={isAudioEngineOnline}
          isMidiConnected={isMidiConnected}
          latency={latency}
        />
      </div>
      {/* Edit Lyrics Dialog - Improved Original Layout */}
      <Dialog open={isEditLyricsOpen} onOpenChange={setIsEditLyricsOpen}>
        <DialogContent className="sm:max-w-3xl max-w-[95vw] max-h-[85vh] overflow-y-auto">
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-xl font-bold">
              Edit Lyrics - {selectedSong?.title} by {selectedSong?.artist}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 mt-6">
            {/* Control Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 dark:bg-gray-800/50 rounded-lg bg-[#2a2c37]">
              <div className="flex items-center space-x-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={isPlaying ? pause : play}
                  disabled={!selectedSong || !selectedSong.tracks || selectedSong.tracks.length === 0}
                  data-testid="button-preview-playback"
                  className="h-9"
                >
                  {isPlaying ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                  {isPlaying ? 'Pause' : 'Preview'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleInsertTimestamp}
                  data-testid="button-insert-timestamp"
                  className="h-9"
                >
                  <Clock className="w-4 h-4 mr-2" />
                  Insert Timestamp
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSearchLyrics}
                  disabled={!selectedSong}
                  data-testid="button-search-lyrics"
                  className="h-9"
                >
                  <Music className="w-4 h-4 mr-2" />
                  Search Lyrics
                </Button>
              </div>
              <div className="text-sm text-gray-500 font-mono">
                {Math.floor(currentTime / 60)}:{Math.floor(currentTime % 60).toString().padStart(2, '0')} / {selectedSong?.duration ? `${Math.floor(selectedSong.duration / 60)}:${Math.floor(selectedSong.duration % 60).toString().padStart(2, '0')}` : '--:--'}
              </div>
            </div>
            
            {/* Position Slider */}
            {selectedSong && selectedSong.duration && (
              <div className="space-y-2 pt-[0px] pb-[0px] mt-[7px] mb-[7px]">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>0:00</span>
                  <span className="font-medium">Playback Position</span>
                  <span>{Math.floor(selectedSong.duration / 60)}:{Math.floor(selectedSong.duration % 60).toString().padStart(2, '0')}</span>
                </div>
                <div className="relative">
                  <input
                    type="range"
                    min="0"
                    max={selectedSong.duration || 100}
                    step="0.1"
                    value={currentTime}
                    onChange={(e) => {
                      const newTime = parseFloat(e.target.value);
                      seek(newTime);
                    }}
                    className="w-full h-2 bg-gray-300 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                    data-testid="slider-song-position"
                  />
                  <div 
                    className="absolute top-0 h-2 bg-primary rounded-lg pointer-events-none"
                    style={{ width: `${(currentTime / (selectedSong.duration || 1)) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Lyrics Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pt-[0px] pb-[0px] mt-[-7px] mb-[-7px]">
                <Label htmlFor="lyrics" className="text-base font-semibold">Lyrics</Label>
                <span className="text-xs text-gray-500 px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded">
                  {lyricsText.length} characters
                </span>
              </div>
              
              <Textarea
                id="lyrics"
                value={lyricsText}
                onChange={(e) => setLyricsText(e.target.value)}
                onPaste={handleLyricsPaste}
                placeholder="Enter song lyrics with timestamps and MIDI commands...

Examples:
[00:15] First verse line
[00:30] Second verse line
[[CC:1:64]] MIDI lighting command"
                className="min-h-[400px] font-mono text-sm leading-relaxed resize-none"
                style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}
                spellCheck={false}
                data-testid="textarea-lyrics"
              />
              
              <div className="text-xs dark:bg-gray-800/50 p-3 rounded-lg bg-[#2a2c37] text-[#96bbd4]">
                <div className="font-medium mb-1">Formatting Guide:</div>
                <div className="space-y-1">
                  <div>• Use <code className="dark:bg-gray-700 px-1 rounded bg-[#2a2c37]">[MM:SS]</code> for timestamps (e.g., [01:23])</div>
                  <div>• Use <code className="dark:bg-gray-700 px-1 rounded bg-[#23252f]">[[CC:channel:value]]</code> for MIDI commands</div>
                  <div>• Click "Insert Timestamp" to add current playback time</div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsEditLyricsOpen(false);
                  setLyricsText("");
                }}
                data-testid="button-cancel-lyrics"
                className="mt-[-89px] mb-[-89px]"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSaveLyrics}
                data-testid="button-save-lyrics"
                className="bg-primary hover:bg-primary/90 mt-[-90px] mb-[-90px]"
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
