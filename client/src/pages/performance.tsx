import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import CompactTransportControls from "@/components/compact-transport-controls";
import AudioMixer from "@/components/audio-mixer";
import { LyricsDisplay } from "@/components/lyrics-display";
import { LyricsControls } from "@/components/lyrics-controls";
import SongSelector from "@/components/song-selector";
import StatusBar from "@/components/status-bar";
import TrackManager from "@/components/track-manager-clean";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Music, Menu, Plus, Edit, Play, Pause, Clock, Minus, Trash2, FileAudio, LogOut, User, Crown, Maximize, Minimize, Bluetooth, Zap, X, Target, Send, Search, ExternalLink, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocalAuth, type UserType } from "@/hooks/useLocalAuth";
import { LocalSongStorage, type LocalSong } from "@/lib/local-song-storage";
import { PersistentWebMIDIManager } from "@/components/PersistentWebMIDIManager";
import { useGlobalWebMIDI, setupGlobalMIDIEventListener } from "@/hooks/useGlobalWebMIDI";

interface PerformanceProps {
  userType: UserType;
}

export default function Performance({ userType: propUserType }: PerformanceProps) {
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
  const [currentLyricsTab, setCurrentLyricsTab] = useState("lyrics");
  const [editingCommandIndex, setEditingCommandIndex] = useState<number | null>(null);
  const [editingCommandText, setEditingCommandText] = useState("");
  const [allSongs, setAllSongs] = useState<LocalSong[]>([]);
  const [selectedSong, setSelectedSong] = useState<LocalSong | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isBluetoothDevicesOpen, setIsBluetoothDevicesOpen] = useState(false);
  const [footerMidiCommand, setFooterMidiCommand] = useState('');
  const [midiCommandSent, setMidiCommandSent] = useState(false);
  const [isMidiConnected, setIsMidiConnected] = useState(false);
  const [selectedMidiDeviceName, setSelectedMidiDeviceName] = useState<string>('');
  const [isSearchingLyrics, setIsSearchingLyrics] = useState(false);
  const [searchResult, setSearchResult] = useState<any>(null);


  const { toast } = useToast();
  const { user, logout } = useLocalAuth();

  // Global Web MIDI integration - persistent across dialog closures
  const globalMidi = useGlobalWebMIDI();

  // Initialize global MIDI event listener for external commands
  useEffect(() => {
    console.log('🎵 Setting up persistent Web MIDI event listener...');
    const cleanup = setupGlobalMIDIEventListener();
    return cleanup;
  }, []);

  // Update local state when global MIDI connection changes
  useEffect(() => {
    setIsMidiConnected(globalMidi.isConnected);
    setSelectedMidiDeviceName(globalMidi.deviceName);
    console.log(`🔄 Global Web MIDI status: ${globalMidi.isConnected ? 'Connected' : 'Disconnected'} - ${globalMidi.deviceName}`);
  }, [globalMidi.isConnected, globalMidi.deviceName]);

  // Listen for legacy Bluetooth MIDI connection status changes (fallback)
  useEffect(() => {
    const handleStatusChange = (event: any) => {
      const { connected, deviceName, midiReady } = event.detail;
      // Only use if global MIDI is not connected
      if (!globalMidi.isConnected) {
        setIsMidiConnected(connected && midiReady);
        setSelectedMidiDeviceName(deviceName);
        console.log(`🔄 Legacy Bluetooth MIDI status: ${connected ? 'Connected' : 'Disconnected'} ${midiReady ? '(MIDI Ready)' : '(No MIDI)'}`);
      }
    };

    window.addEventListener('bluetoothMidiStatusChanged', handleStatusChange);
    return () => {
      window.removeEventListener('bluetoothMidiStatusChanged', handleStatusChange);
    };
  }, [globalMidi.isConnected]);
  
  // Use userType from authenticated user, fallback to prop
  const userType = user?.userType || propUserType;

  // Trigger blue blink effect for MIDI status light
  const triggerMidiBlink = useCallback(() => {
    setMidiCommandSent(true);
    setTimeout(() => {
      setMidiCommandSent(false);
    }, 300); // Blink for 300ms
  }, []);

  // Manual MIDI send function - restricted to professional subscribers only
  const handleFooterSendMessage = async () => {
    if (!footerMidiCommand.trim()) return;
    
    if (userType !== 'professional') {
      toast({
        title: "Professional Subscription Required",
        description: "MIDI commands are only available for Professional subscribers",
        variant: "destructive",
      });
      return;
    }

    try {
      // Try global Web MIDI first, fallback to legacy Bluetooth
      const success = await globalMidi.sendCommand(footerMidiCommand.trim());
      if (success) {
        console.log('✅ Manual MIDI command sent via global Web MIDI');
        triggerMidiBlink();
        toast({
          title: "MIDI Command Sent",
          description: `Sent via Web MIDI: ${footerMidiCommand.trim()}`,
        });
      } else {
        console.log('⚠️ Global Web MIDI failed, falling back to legacy Bluetooth MIDI');
        // Send via custom event to Bluetooth MIDI manager as fallback
        const event = new CustomEvent('sendBluetoothMIDI', {
          detail: { command: footerMidiCommand.trim() }
        });
        window.dispatchEvent(event);
        triggerMidiBlink();
        toast({
          title: "MIDI Command Sent",
          description: `Sent via Bluetooth: ${footerMidiCommand.trim()}`,
        });
      }
      
      setFooterMidiCommand('');
    } catch (error) {
      toast({
        title: "MIDI Send Failed",
        description: "Failed to send MIDI command",
        variant: "destructive",
      });
    }
  };

  // Auto-send MIDI command from timestamped lyrics
  const handleLyricsMidiCommand = useCallback(async (command: string) => {
    if (userType !== 'professional') {
      console.log('🎼 MIDI command ignored - professional subscription required');
      return;
    }

    try {
      console.log(`🎼 Sending MIDI command from lyrics: ${command}`);
      
      // Try global Web MIDI first, fallback to legacy Bluetooth
      const success = await globalMidi.sendCommand(command.trim());
      if (success) {
        console.log('✅ MIDI command sent via global Web MIDI');
        triggerMidiBlink();
      } else {
        console.log('⚠️ Global Web MIDI failed, falling back to legacy Bluetooth MIDI');
        // Send via custom event to Bluetooth MIDI manager as fallback
        const event = new CustomEvent('sendBluetoothMIDI', {
          detail: { command: command.trim() }
        });
        window.dispatchEvent(event);
        triggerMidiBlink();
      }
    } catch (error) {
      console.error('❌ Failed to send lyrics MIDI command:', error);
    }
  }, [userType, triggerMidiBlink, globalMidi]);

  // Instant audio engine (now with zero decode delays)
  const audioEngine = useAudioEngine({ 
    song: selectedSong,
    onDurationUpdated: (songId: string, newDuration: number) => {
      if (selectedSong && selectedSong.id === songId && user?.email) {
        LocalSongStorage.updateSong(user.email, songId, { duration: newDuration });
      }
    }
  });
  
  const {
    isPlaying,
    currentTime,
    duration,
    play,
    pause,
    stop,
    seek,
    isLoading: isLoadingTracks,
    masterVolume,
    updateMasterVolume,
    updateTrackVolume,
    updateTrackBalance,
    updateTrackMute,
    updateTrackSolo,
    isAudioEngineOnline,
    masterStereoLevels,
    audioLevels
  } = audioEngine;



  // Keyboard shortcuts
  useKeyboardShortcuts({
    onPlay: play,
    onPause: pause,
    onStop: stop,
    onTogglePlayback: isPlaying ? pause : play,
    onTrackMute: (trackId: string) => updateTrackMute(trackId),
    isPlaying
  });

  // Load all songs on mount
  useEffect(() => {
    const loadAllSongs = () => {
      if (!user?.email) return;
      
      try {
        const songs = LocalSongStorage.getAllSongs(user.email);
        setAllSongs(songs);
        console.log(`📋 Loaded ${songs.length} songs from local storage`);
      } catch (error) {
        console.error('❌ Failed to load songs:', error);
        toast({
          title: "Error Loading Songs",
          description: "Failed to load songs from local storage",
          variant: "destructive"
        });
      }
    };

    loadAllSongs();
  }, [user?.email, toast]);

  const refreshSongs = useCallback(() => {
    if (!user?.email) return;
    
    try {
      const songs = LocalSongStorage.getAllSongs(user.email);
      setAllSongs(songs);
    } catch (error) {
      console.error('Failed to refresh songs:', error);
    }
  }, [user?.email]);

  // Select song and load its tracks
  useEffect(() => {
    if (!selectedSongId) return;

    const song = allSongs.find(s => s.id === selectedSongId);
    if (!song) return;

    console.log(`🎵 Loading song: ${song.title}`);
    setSelectedSong(song);
  }, [selectedSongId, allSongs]);

  const handleSeek = useCallback((time: number) => {
    seek(time);
  }, [seek]);

  const handlePlay = useCallback(() => {
    if (selectedSong && selectedSong.tracks && selectedSong.tracks.length > 0) {
      play();
    } else {
      toast({
        title: "No Tracks Available", 
        description: "Please add tracks to this song first",
        variant: "destructive"
      });
    }
  }, [selectedSong, play, toast]);

  const handlePause = useCallback(() => {
    pause();
  }, [pause]);

  const handleStop = useCallback(() => {
    stop();
  }, [stop]);

  const handleAddSongLocal = useCallback(() => {
    if (!user?.email) {
      toast({
        title: "Authentication Required",
        description: "Please log in to add songs",
        variant: "destructive"
      });
      return;
    }

    try {
      const newSong = LocalSongStorage.addSong(user.email, {
        title: songTitle,
        artist: songArtist,
        duration: 0,
        lyrics: ''
      });
      setAllSongs(prev => [newSong, ...prev]);
      setSongTitle("");
      setSongArtist("");
      setIsAddSongOpen(false);
      
      toast({
        title: "Song Created",
        description: `${songTitle} by ${songArtist} has been created`,
      });
    } catch (error) {
      console.error('Failed to create song:', error);
      toast({
        title: "Error",
        description: "Failed to create song. Please try again.",
        variant: "destructive"
      });
    }
  }, [user?.email, songTitle, songArtist, toast]);

  const handleUpdateLyrics = useCallback(() => {
    if (!selectedSong || !user?.email) return;

    try {
      const updatedSong = LocalSongStorage.updateSong(user.email, selectedSong.id, {
        lyrics: lyricsText
      });
      
      if (updatedSong) {
        setSelectedSong(updatedSong);
        setAllSongs(prev => prev.map(song => 
          song.id === selectedSong.id ? updatedSong : song
        ));
        setIsEditLyricsOpen(false);
        
        toast({
          title: "Lyrics updated",
          description: "Song lyrics have been saved."
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update lyrics. Please try again.",
        variant: "destructive"
      });
    }
  }, [selectedSong, lyricsText, user?.email, toast]);

  const handleSearchLyrics = async () => {
    if (!selectedSong) {
      toast({
        title: "No Song Selected",
        description: "Please select a song to search for lyrics",
        variant: "destructive"
      });
      return;
    }

    setIsSearchingLyrics(true);
    setSearchResult(null);

    try {
      const response = await fetch('/api/lyrics/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: selectedSong.title,
          artist: selectedSong.artist
        })
      });

      const data = await response.json();
      
      if (data.success) {
        // Direct lyrics found - unlikely with current server implementation
        setLyricsText(data.lyrics);
        toast({
          title: "Lyrics Found",
          description: "Lyrics have been automatically loaded"
        });
      } else if (data.openBrowser && data.searchResult) {
        // Found a lyrics page to open
        setSearchResult(data.searchResult);
        toast({
          title: "Lyrics Page Found",
          description: "Opening lyrics page for manual copy-paste"
        });
        
        // Open the URL in a new tab
        window.open(data.searchResult.url, '_blank');
      } else {
        toast({
          title: "No Lyrics Found",
          description: data.message || "Could not find lyrics for this song",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Lyrics search error:', error);
      toast({
        title: "Search Error",
        description: "Failed to search for lyrics. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSearchingLyrics(false);
    }
  };

  // Add generic MIDI command at current timestamp (functionality removed)
  const handleAddMidiCommand = () => {
    toast({
      title: "MIDI Functionality Removed",
      description: "MIDI commands are no longer supported",
      variant: "destructive",
    });
  };

  // Start editing a MIDI command
  const handleEditCommand = (index: number) => {
    if (userType !== 'professional') {
      toast({
        title: "Professional Subscription Required",
        description: "MIDI editing is only available for Professional subscribers",
        variant: "destructive",
      });
      return;
    }

    if (selectedSong?.midiEvents && selectedSong.midiEvents[index]) {
      setEditingCommandIndex(index);
      setEditingCommandText(selectedSong.midiEvents[index].command);
      setCurrentLyricsTab("midi");
      setIsEditLyricsOpen(true);
    }
  };

  // Save edited MIDI command (functionality removed)
  const handleSaveEditedCommand = () => {
    toast({
      title: "MIDI Functionality Removed",
      description: "MIDI commands are no longer supported",
      variant: "destructive",
    });
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingCommandIndex(null);
    setEditingCommandText("");
  };

  // Remove MIDI command (functionality removed)
  const handleRemoveMidiCommand = (index: number) => {
    toast({
      title: "MIDI Functionality Removed",
      description: "MIDI commands are no longer supported",
      variant: "destructive",
    });
  };

  // Format timestamp for display
  const formatTimestamp = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
      setCurrentLyricsTab("lyrics"); // Always default to lyrics tab
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



  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  return (
    <div className={`h-screen flex flex-col bg-background text-foreground overflow-hidden ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      {/* Header */}
      <div className="bg-surface border-b border-gray-700 p-2 md:p-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-4">
            <div className="flex items-center gap-2">
              <Music className="h-5 w-5 md:h-6 md:w-6 text-primary" />
              <span className="text-base md:text-lg font-semibold">Live Performance</span>
            </div>
          </div>

          {/* Waveform Visualizer - Stretch across available space */}
          <div className="flex-1 mx-4 max-h-12">
            <WaveformVisualizer
              song={selectedSong}
              currentTime={currentTime}
              duration={duration}
              isPlaying={isPlaying}
              audioLevels={audioLevels}
              data-testid="header-waveform-visualizer"
            />
          </div>

          <div className="flex items-center gap-1 md:gap-2">
            {/* Bluetooth Manager Button - Professional Users Only */}
            {userType === 'professional' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsBluetoothDevicesOpen(true)}
                data-testid="button-bluetooth-manager"
                className="h-8 px-2 md:px-3"
              >
                <Bluetooth className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                <span className="hidden sm:inline text-xs md:text-sm">Bluetooth</span>
              </Button>
            )}

            {/* Settings Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" data-testid="button-settings-menu" className="h-8 px-2 md:px-3">
                  <Settings className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                  <span className="hidden sm:inline text-xs md:text-sm">Settings</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setIsTrackManagerOpen(true)} data-testid="menuitem-track-manager">
                  <FileAudio className="h-4 w-4 mr-2" />
                  Track Manager
                </DropdownMenuItem>

                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={toggleFullscreen} data-testid="menuitem-fullscreen">
                  {isFullscreen ? (
                    <>
                      <Minimize className="h-4 w-4 mr-2" />
                      Exit Fullscreen
                    </>
                  ) : (
                    <>
                      <Maximize className="h-4 w-4 mr-2" />
                      Fullscreen
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="flex items-center gap-2" data-testid="menuitem-user-info">
                  {userType === 'professional' ? (
                    <>
                      <Crown className="h-4 w-4 text-yellow-500" />
                      <span>Professional User</span>
                    </>
                  ) : (
                    <>
                      <User className="h-4 w-4" />
                      <span>{userType || 'Free'} User</span>
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { logout(); setLocation('/'); }} data-testid="menuitem-logout">
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex min-h-0">
        {/* Left Sidebar - Song Selection */}
        <div className="w-72 md:w-80 border-r border-gray-700 bg-surface flex flex-col min-h-0">
          <div className="p-2 md:p-4 border-b border-gray-700 flex-shrink-0">
            <div className="flex items-center justify-between mb-2 md:mb-4">
              <h2 className="text-sm md:text-lg font-semibold">Songs</h2>
              <Dialog open={isAddSongOpen} onOpenChange={setIsAddSongOpen}>
                <DialogTrigger asChild>
                  <Button 
                    size="sm" 
                    className="h-7 md:h-8 px-2 md:px-3"
                    data-testid="button-add-song"
                  >
                    <Plus className="h-3 w-3 md:h-4 md:w-4 mr-1" />
                    <span className="text-xs md:text-sm">Add</span>
                  </Button>
                </DialogTrigger>
                <DialogContent data-testid="dialog-add-song">
                  <DialogHeader>
                    <DialogTitle>Add New Song</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="song-title">Title</Label>
                      <Input
                        id="song-title"
                        value={songTitle}
                        onChange={(e) => setSongTitle(e.target.value)}
                        placeholder="Enter song title"
                        data-testid="input-song-title"
                      />
                    </div>
                    <div>
                      <Label htmlFor="song-artist">Artist</Label>
                      <Input
                        id="song-artist"
                        value={songArtist}
                        onChange={(e) => setSongArtist(e.target.value)}
                        placeholder="Enter artist name"
                        data-testid="input-song-artist"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setIsAddSongOpen(false)}
                        data-testid="button-cancel-add-song"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleAddSong}
                        data-testid="button-save-song"
                      >
                        Create Song
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Delete Song Dialog */}
              <Dialog open={isDeleteSongOpen} onOpenChange={setIsDeleteSongOpen}>
                <DialogContent data-testid="dialog-delete-song">
                  <DialogHeader>
                    <DialogTitle>Delete Song</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <p>
                      Are you sure you want to delete "{selectedSong?.title}" by {selectedSong?.artist}?
                      This action cannot be undone.
                    </p>
                    <div className="flex justify-end gap-2">
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
                    {song.duration > 0 ? `${Math.floor(song.duration / 60)}:${Math.floor(song.duration % 60).toString().padStart(2, '0')}` : '0:00'}
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
              progress={currentTime / duration * 100}
              isMidiConnected={isMidiConnected}
              onPlay={play}
              onPause={pause}
              onStop={stop}
              onSeek={handleSeek}
            />
          </div>
        </div>

        {/* Right Content Area - Lyrics */}
        <div className="flex-1 flex flex-col min-h-0 md:flex-row">
          {/* Mobile: Lyrics above transport controls */}
          <div className="flex-1 flex flex-col min-h-0">
            {/* Desktop Header */}
            <div className="p-2 md:p-4 border-b border-gray-700 bg-surface flex items-center justify-between mobile-hidden">
              <h2 className="text-sm md:text-lg font-semibold truncate mr-2">
                {selectedSong ? `${selectedSong.title} - ${selectedSong.artist}` : 'Select a song'}
              </h2>
              
              {/* Lyrics Controls */}
              {selectedSong && <LyricsControls onEditLyrics={handleEditLyrics} song={selectedSong} />}
            </div>
            
            {/* Mobile Header with Controls */}
            <div className="p-2 border-b border-gray-700 bg-surface flex items-center justify-between md:hidden flex-shrink-0">
              <h2 className="text-sm font-semibold truncate mr-2 flex-1">
                {selectedSong ? `${selectedSong.title} - ${selectedSong.artist}` : 'Select a song'}
              </h2>
              
              {/* Mobile Lyrics Controls */}
              {selectedSong && <LyricsControls onEditLyrics={handleEditLyrics} song={selectedSong} />}
            </div>
            
            {/* Lyrics Area - Takes remaining space but leaves room for transport */}
            <div className="flex-1 min-h-0 overflow-hidden" style={{ contain: 'layout style' }}>
              <LyricsDisplay
                song={selectedSong}
                currentTime={currentTime}
                duration={duration}
                onEditLyrics={selectedSong ? handleEditLyrics : undefined}
                onMidiCommand={handleLyricsMidiCommand}
                isPlaying={isPlaying}
              />
            </div>
            
            {/* Mobile only: Transport controls at bottom - ALWAYS VISIBLE */}
            <div className="p-3 border-t border-gray-700 bg-surface flex-shrink-0 md:hidden">
              <div className="w-full space-y-2">
                <CompactTransportControls
                  isPlaying={isPlaying}
                  currentTime={currentTime}
                  duration={duration}
                  progress={currentTime / duration * 100}
                  isMidiConnected={isMidiConnected}
                  onPlay={handlePlay}
                  onPause={handlePause}
                  onStop={handleStop}
                  onSeek={handleSeek}
                />
                
                {/* Mobile Manual MIDI Send */}
                <div className="flex items-center gap-2 pt-2 border-t border-gray-700">
                  <Input
                    value={footerMidiCommand}
                    onChange={(e) => setFooterMidiCommand(e.target.value)}
                    placeholder="[[PC:12:1]], [[CC:7:64:1]]"
                    className="font-mono text-sm flex-1"
                    data-testid="input-mobile-midi-command"
                  />
                  <Button 
                    onClick={handleFooterSendMessage}
                    disabled={!isMidiConnected || !footerMidiCommand.trim()}
                    data-testid="button-send-mobile-midi"
                    size="sm"
                  >
                    <Send className="h-4 w-4 mr-1" />
                    Send
                  </Button>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
      {/* Audio Mode Indicator */}
      <div className="px-4 py-2 bg-gray-800 border-t border-gray-700 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Zap className="h-4 w-4 text-green-400" />
            <span className="text-green-400">Instant Playback</span>
            <span className="text-gray-400">- Zero delay audio</span>
          </div>
          {isLoadingTracks && (
            <div className="flex items-center gap-2 text-sm text-yellow-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading tracks...
            </div>
          )}
        </div>
      </div>

      {/* Status Bar & Manual MIDI Send - Desktop only */}
      <div className="bg-surface border-t border-gray-700 p-2 flex-shrink-0 mobile-hidden">
        <div className="flex items-center justify-between gap-4">
          <StatusBar
            isAudioEngineOnline={isAudioEngineOnline}
            isMidiConnected={isMidiConnected}
            midiDeviceName={selectedMidiDeviceName}
            latency={latency}
            midiCommandSent={midiCommandSent}
          />
          
          {/* Manual MIDI Send - Exact copy from USB MIDI devices page */}
          <div className="flex items-center gap-2 border-l border-gray-700 pl-4">
            <Input
              value={footerMidiCommand}
              onChange={(e) => setFooterMidiCommand(e.target.value)}
              placeholder="e.g., [[PC:12:1]], [[CC:7:64:1]]"
              className="font-mono text-sm w-64"
              data-testid="input-footer-midi-command"
            />
            <Button 
              onClick={handleFooterSendMessage}
              disabled={!isMidiConnected || !footerMidiCommand.trim()}
              data-testid="button-send-footer-midi"
              size="sm"
            >
              <Send className="h-4 w-4 mr-1" />
              Send
            </Button>
          </div>
        </div>
      </div>
      {/* Edit Lyrics Dialog - Tabbed Layout */}
      <Dialog open={isEditLyricsOpen} onOpenChange={setIsEditLyricsOpen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full flex flex-col p-3">
          {/* Compact Header with Controls */}
          <div className="flex-shrink-0 border-b border-gray-700 pb-2 mb-2">
            <div className="flex items-center justify-between mb-2">
              <DialogTitle className="text-lg font-bold truncate flex-1 mr-4">
                {selectedSong?.title} - {selectedSong?.artist}
              </DialogTitle>
              <div className="text-xs text-gray-500 font-mono">
                {Math.floor(currentTime / 60)}:{Math.floor(currentTime % 60).toString().padStart(2, '0')} / {selectedSong?.duration ? `${Math.floor(selectedSong.duration / 60)}:${Math.floor(selectedSong.duration % 60).toString().padStart(2, '0')}` : '--:--'}
              </div>
            </div>
            
            {/* Compact Control Row */}
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={isPlaying ? pause : play}
                disabled={!selectedSong || !selectedSong.tracks || selectedSong.tracks.length === 0}
                data-testid="button-preview-playback"
                className="h-8 px-3"
              >
                {isPlaying ? <Pause className="w-3 h-3 mr-1" /> : <Play className="w-3 h-3 mr-1" />}
                {isPlaying ? 'Pause' : 'Play'}
              </Button>
              {currentLyricsTab === "lyrics" && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleInsertTimestamp}
                    data-testid="button-insert-timestamp"
                    className="h-8 px-3"
                  >
                    <Clock className="w-3 h-3 mr-1" />
                    Timestamp
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSearchLyrics}
                    disabled={!selectedSong || isSearchingLyrics}
                    data-testid="button-search-lyrics"
                    className="h-8 px-3"
                  >
                    {isSearchingLyrics ? (
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    ) : (
                      <Search className="w-3 h-3 mr-1" />
                    )}
                    {isSearchingLyrics ? 'Searching...' : 'Search Online'}
                  </Button>
                </>
              )}
              {currentLyricsTab === "midi" && userType === 'professional' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddMidiCommand}
                  data-testid="button-add-midi-command"
                  className="h-8 px-3"
                >
                  <Target className="w-3 h-3 mr-1" />
                  Add Command
                </Button>
              )}
            </div>
          </div>

          {/* Tabbed Content */}
          <div className="flex-1 min-h-0 flex flex-col">
            <Tabs value={currentLyricsTab} onValueChange={setCurrentLyricsTab} className="flex-1 flex flex-col">
              <TabsList className="flex-shrink-0 mb-2">
                <TabsTrigger value="lyrics" data-testid="tab-lyrics">Lyrics</TabsTrigger>
                {userType === 'professional' && (
                  <TabsTrigger value="midi" data-testid="tab-midi">MIDI Commands</TabsTrigger>
                )}
              </TabsList>
              <TabsContent value="lyrics" className="flex-1 min-h-0 flex flex-col">
                {searchResult && (
                  <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex-shrink-0">
                    <div className="flex items-center gap-2 mb-2">
                      <ExternalLink className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                        Lyrics page opened in new tab
                      </span>
                    </div>
                    <p className="text-xs text-blue-700 dark:text-blue-300 mb-2">
                      {searchResult.title}
                    </p>
                    <p className="text-xs text-blue-600 dark:text-blue-400">
                      Copy and paste the lyrics from the opened page into the text area below
                    </p>
                  </div>
                )}
                <Textarea
                  id="lyrics"
                  value={lyricsText}
                  onChange={(e) => setLyricsText(e.target.value)}
                  placeholder="Enter song lyrics here...&#10;&#10;Tip: Use timestamps like [01:30] and add MIDI commands with <!-- MIDI: Program Change 1 -->"
                  className="w-full flex-1 resize-none font-mono text-sm border border-gray-600 bg-background"
                  data-testid="textarea-lyrics"
                />
              </TabsContent>
              {userType === 'professional' && (
                <TabsContent value="midi" className="flex-1 min-h-0 flex flex-col">
                  <div className="flex-1">
                    <div className="space-y-3 max-h-48 overflow-y-auto">
                      {selectedSong?.midiEvents && selectedSong.midiEvents.length > 0 ? (
                        selectedSong.midiEvents.map((event: any, index: number) => (
                          <div key={index} className="p-2 bg-gray-800/50 rounded-md border border-gray-600">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-gray-400">
                                {Math.floor(event.timestamp / 60)}:
                                {(event.timestamp % 60).toFixed(1).padStart(4, '0')}s
                              </span>
                              <div className="flex items-center gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleEditCommand(index)}
                                  className="h-6 px-2"
                                  data-testid={`button-edit-midi-${index}`}
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    if (selectedSong?.midiEvents) {
                                      const updated = { 
                                        ...selectedSong, 
                                        midiEvents: selectedSong.midiEvents.filter((_, i) => i !== index) 
                                      };
                                      setSelectedSong(updated);
                                      if (user?.email) {
                                        LocalSongStorage.updateSong(user.email, selectedSong.id, updated);
                                      }
                                    }
                                  }}
                                  className="h-6 px-2 text-red-400 hover:text-red-300"
                                  data-testid={`button-delete-midi-${index}`}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                            <div className="mt-1 font-mono text-xs text-green-400">
                              {event.command}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center text-gray-400 py-4">
                          <Zap className="w-6 h-6 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No MIDI commands yet</p>
                          <p className="text-xs">Add timestamped MIDI commands in your lyrics</p>
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>
              )}
            </Tabs>
          </div>

          {/* Compact Action Buttons */}
          <div className="flex justify-end gap-2 pt-2 mt-2 border-t border-gray-700 flex-shrink-0">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                setIsEditLyricsOpen(false);
                setLyricsText("");
                setEditingCommandIndex(null);
                setEditingCommandText("");
              }}
              data-testid="button-cancel-lyrics"
            >
              Cancel
            </Button>
            <Button 
              size="sm"
              onClick={handleSaveLyrics}
              data-testid="button-save-lyrics"
              className="bg-primary hover:bg-primary/90"
            >
              Save {currentLyricsTab === "midi" && userType === 'professional' ? "Lyrics & MIDI" : "Lyrics"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Track Manager Dialog */}
      <Dialog open={isTrackManagerOpen} onOpenChange={setIsTrackManagerOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh]" data-testid="dialog-track-manager">
          <DialogHeader>
            <DialogTitle>Track Manager</DialogTitle>
          </DialogHeader>
          {selectedSong && (
            <TrackManager
              song={selectedSong as any}
              onSongUpdate={(updatedSong: any) => {
                console.log('Performance: Received song update with', updatedSong.tracks.length, 'tracks');
                setSelectedSong(updatedSong);
                setAllSongs(prev => prev.map(song => 
                  song.id === updatedSong.id ? updatedSong : song
                ));
              }}
              onTrackVolumeChange={updateTrackVolume}
              onTrackMuteToggle={toggleTrackMute}
              onTrackSoloToggle={toggleTrackSolo}
              onTrackBalanceChange={updateTrackBalance}
              onPlay={play}
              onPause={pause}
              isPlaying={isPlaying}
              isLoadingTracks={isLoadingTracks}
              audioLevels={audioLevels}
              data-testid="track-manager"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Persistent Web MIDI Manager Dialog - Professional Users Only */}
      {userType === 'professional' && isBluetoothDevicesOpen && (
        <Dialog open={isBluetoothDevicesOpen} onOpenChange={setIsBluetoothDevicesOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Persistent Web MIDI Devices</DialogTitle>
              <p className="text-sm text-muted-foreground">
                Connections persist even when this dialog is closed - perfect for live performance automation
              </p>
            </DialogHeader>
            <PersistentWebMIDIManager />
          </DialogContent>
        </Dialog>
      )}

    </div>
  );
}