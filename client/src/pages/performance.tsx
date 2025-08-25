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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Music, Menu, Plus, Edit, Play, Pause, Clock, Minus, Trash2, FileAudio, LogOut, User, Crown, Maximize, Minimize, Bluetooth, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocalAuth, type UserType } from "@/hooks/useLocalAuth";
import { LocalSongStorage, type LocalSong } from "@/lib/local-song-storage";
import SimpleBluetoothManager from "@/components/SimpleBluetoothManager";

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
  const [allSongs, setAllSongs] = useState<LocalSong[]>([]);
  const [selectedSong, setSelectedSong] = useState<LocalSong | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isBluetoothDevicesOpen, setIsBluetoothDevicesOpen] = useState(false);

  const { toast } = useToast();
  const { user, logout } = useLocalAuth();
  
  // Use userType from authenticated user, fallback to prop
  const userType = user?.userType || propUserType;

  const {
    volume,
    setVolume,
    isPlaying,
    currentTime,
    duration,
    isLoaded,
    play,
    pause,
    stop,
    seek,
    position,
    setPosition,
    loadSong,
    trackStates,
    masterVolume,
    setMasterVolume
  } = useAudioEngine();

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onPlay: play,
    onPause: pause,
    onStop: stop
  });

  // Load all songs on mount
  useEffect(() => {
    const loadAllSongs = async () => {
      try {
        const songs = await LocalSongStorage.getAllSongs();
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
  }, [toast]);

  // Select song handler
  const handleSelectSong = useCallback(async (song: LocalSong) => {
    try {
      console.log(`🎵 Selecting song: ${song.title} by ${song.artist}`);
      
      // Set song data
      setSelectedSong(song);
      setSelectedSongId(song.id);
      setLyricsText(song.lyrics || '');
      
      // Load audio engine with tracks
      if (song.tracks && song.tracks.length > 0) {
        console.log(`🎧 Loading ${song.tracks.length} tracks...`);
        await loadSong(song.tracks);
        console.log('✅ Song loaded successfully');
      } else {
        console.log('⚠️ No tracks found for this song');
      }
      
      toast({
        title: "Song Selected",
        description: `${song.title} by ${song.artist}`,
      });
    } catch (error) {
      console.error('❌ Failed to select song:', error);
      toast({
        title: "Error",
        description: "Failed to load song",
        variant: "destructive"
      });
    }
  }, [loadSong, toast]);

  // Save song
  const handleSaveSong = useCallback(async () => {
    if (!songTitle.trim() || !songArtist.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter both title and artist",
        variant: "destructive"
      });
      return;
    }

    try {
      const newSong = await LocalSongStorage.createSong(songTitle, songArtist);
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
        description: "Failed to create song",
        variant: "destructive"
      });
    }
  }, [songTitle, songArtist, toast]);

  // Save lyrics
  const handleSaveLyrics = useCallback(async () => {
    if (!selectedSong) return;

    try {
      const updatedSong = await LocalSongStorage.updateSong(selectedSong.id, {
        lyrics: lyricsText
      });
      
      setSelectedSong(updatedSong);
      setAllSongs(prev => prev.map(song => 
        song.id === selectedSong.id ? updatedSong : song
      ));
      setIsEditLyricsOpen(false);
      
      toast({
        title: "Lyrics Saved",
        description: "Song lyrics have been updated",
      });
    } catch (error) {
      console.error('Failed to save lyrics:', error);
      toast({
        title: "Error",
        description: "Failed to save lyrics",
        variant: "destructive"
      });
    }
  }, [selectedSong, lyricsText, toast]);

  // Delete song
  const handleDeleteSong = useCallback(async () => {
    if (!selectedSong) return;

    try {
      await LocalSongStorage.deleteSong(selectedSong.id);
      setAllSongs(prev => prev.filter(song => song.id !== selectedSong.id));
      setSelectedSong(null);
      setSelectedSongId(null);
      setIsDeleteSongOpen(false);
      
      toast({
        title: "Song Deleted",
        description: `${selectedSong.title} has been removed`,
      });
    } catch (error) {
      console.error('Failed to delete song:', error);
      toast({
        title: "Error",
        description: "Failed to delete song",
        variant: "destructive"
      });
    }
  }, [selectedSong, toast]);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(!isFullscreen);
  }, [isFullscreen]);

  // Handle logout
  const handleLogout = useCallback(() => {
    logout();
    setLocation('/');
  }, [logout, setLocation]);

  return (
    <div className={`h-screen flex flex-col bg-background text-foreground ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b bg-card">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Music className="h-6 w-6 text-primary" />
            <span className="text-lg font-semibold">Live Performance</span>
          </div>
          
          {selectedSong && (
            <div className="text-sm text-muted-foreground">
              <span className="font-medium">{selectedSong.title}</span>
              <span className="mx-2">•</span>
              <span>{selectedSong.artist}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Bluetooth Manager Button - Professional Users Only */}
          {userType === 'professional' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsBluetoothDevicesOpen(true)}
              data-testid="button-bluetooth-manager"
            >
              <Bluetooth className="h-4 w-4 mr-2" />
              Bluetooth
            </Button>
          )}

          {/* Settings Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" data-testid="button-settings-menu">
                <Settings className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Settings</span>
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
              <DropdownMenuItem onClick={handleLogout} data-testid="menuitem-logout">
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Left Sidebar - Song Selection */}
        <div className="w-80 border-r bg-card">
          <SongSelector
            songs={allSongs}
            selectedSongId={selectedSongId}
            onSelectSong={handleSelectSong}
            onAddSong={() => setIsAddSongOpen(true)}
            onEditLyrics={() => setIsEditLyricsOpen(true)}
            onDeleteSong={() => setIsDeleteSongOpen(true)}
            data-testid="song-selector"
          />
        </div>

        {/* Center Content Area */}
        <div className="flex-1 flex flex-col">
          {/* Transport Controls */}
          <div className="p-4 border-b bg-card">
            <CompactTransportControls
              isPlaying={isPlaying}
              currentTime={currentTime}
              duration={duration}
              isLoaded={isLoaded}
              onPlay={play}
              onPause={pause}
              onStop={stop}
              onSeek={seek}
              position={position}
              onPositionChange={setPosition}
              data-testid="transport-controls"
            />
          </div>

          {/* Lyrics Display */}
          <div className="flex-1 p-4">
            <LyricsDisplay
              lyrics={lyricsText}
              currentTime={currentTime}
              isPlaying={isPlaying}
              data-testid="lyrics-display"
            />
          </div>

          {/* Lyrics Controls */}
          <div className="p-4 border-t bg-card">
            <LyricsControls
              currentTime={currentTime}
              duration={duration}
              onSeek={seek}
              data-testid="lyrics-controls"
            />
          </div>
        </div>

        {/* Right Sidebar - Audio Controls */}
        <div className="w-80 border-l bg-card flex flex-col">
          {/* VU Meter */}
          <div className="p-4 border-b">
            <StereoVUMeter data-testid="vu-meter" />
          </div>

          {/* Audio Mixer */}
          <div className="flex-1 p-4">
            <AudioMixer
              trackStates={trackStates}
              masterVolume={masterVolume}
              onMasterVolumeChange={setMasterVolume}
              data-testid="audio-mixer"
            />
          </div>

          {/* Waveform Visualizer */}
          <div className="p-4 border-t">
            <WaveformVisualizer
              currentTime={currentTime}
              duration={duration}
              data-testid="waveform-visualizer"
            />
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <StatusBar
        latency={latency}
        onLatencyChange={setLatency}
        data-testid="status-bar"
      />

      {/* Dialogs */}
      
      {/* Add Song Dialog */}
      <Dialog open={isAddSongOpen} onOpenChange={setIsAddSongOpen}>
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
                onClick={handleSaveSong}
                data-testid="button-save-song"
              >
                Create Song
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Lyrics Dialog */}
      <Dialog open={isEditLyricsOpen} onOpenChange={setIsEditLyricsOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]" data-testid="dialog-edit-lyrics">
          <DialogHeader>
            <DialogTitle>
              Edit Lyrics - {selectedSong?.title} by {selectedSong?.artist}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Tabs value={currentLyricsTab} onValueChange={setCurrentLyricsTab}>
              <TabsList>
                <TabsTrigger value="lyrics" data-testid="tab-lyrics">Lyrics</TabsTrigger>
              </TabsList>
              <TabsContent value="lyrics" className="space-y-4">
                <Textarea
                  value={lyricsText}
                  onChange={(e) => setLyricsText(e.target.value)}
                  placeholder="Enter song lyrics here..."
                  className="min-h-[400px] font-mono"
                  data-testid="textarea-lyrics"
                />
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsEditLyricsOpen(false)}
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
              </TabsContent>
            </Tabs>
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

      {/* Track Manager Dialog */}
      <Dialog open={isTrackManagerOpen} onOpenChange={setIsTrackManagerOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh]" data-testid="dialog-track-manager">
          <DialogHeader>
            <DialogTitle>Track Manager</DialogTitle>
          </DialogHeader>
          <TrackManager
            selectedSong={selectedSong}
            onSongUpdate={(updatedSong) => {
              setSelectedSong(updatedSong);
              setAllSongs(prev => prev.map(song => 
                song.id === updatedSong.id ? updatedSong : song
              ));
            }}
            data-testid="track-manager"
          />
        </DialogContent>
      </Dialog>

      {/* Simple Bluetooth Manager Dialog - Professional Users Only */}
      {userType === 'professional' && (
        <SimpleBluetoothManager
          isOpen={isBluetoothDevicesOpen}
          onClose={() => setIsBluetoothDevicesOpen(false)}
        />
      )}
    </div>
  );
}