import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import CompactTransportControls from "@/components/compact-transport-controls";
import AudioMixer from "@/components/audio-mixer";
import { LyricsDisplay } from "@/components/lyrics-display";
import { LyricsControls } from "@/components/lyrics-controls";
import SongSelector from "@/components/song-selector";
import StatusBar from "@/components/status-bar";
import TrackManager from "@/components/track-manager-clean";
import StemSplitter from "@/components/stem-splitter";
import ProfessionalStereoVUMeter from "@/components/professional-stereo-vu-meter";
import { WaveformVisualizer } from "@/components/waveform-visualizer";
import { SimpleMidiDevices } from "@/components/simple-midi-devices";
import { useSimpleMidi } from "@/hooks/useSimpleMidi";

import { useAudioEngine } from "@/hooks/use-audio-engine";

import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Music, Menu, Plus, Edit, Play, Pause, Clock, Minus, Trash2, FileAudio, LogOut, User, Crown, Maximize, Minimize, Activity, Zap, X, Target, Send, Search, ExternalLink, Loader2, Volume2, Download, Upload, FolderOpen, Cast, Headphones } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { type UserType } from "@/hooks/useLocalAuth";
import { LocalSongStorage, type LocalSong } from "@/lib/local-song-storage";
import type { SongWithTracks } from "@shared/schema";
import { useRef } from "react";
import { BackupManager } from "@/lib/backup-manager";
import { useBroadcast } from "@/hooks/useBroadcast";

interface PerformanceProps {
  userType: UserType;
  userEmail?: string;
  logout?: () => void;
}

export default function Performance({ userType, userEmail, logout }: PerformanceProps) {
  
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
  const [isSearchingLyrics, setIsSearchingLyrics] = useState(false);
  const [searchResult, setSearchResult] = useState<any>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStatus, setExportStatus] = useState("");
  const [exportController, setExportController] = useState<AbortController | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStatus, setImportStatus] = useState("");
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [exportFilename, setExportFilename] = useState("");
  const lyricsTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [isDeviceDialogOpen, setIsDeviceDialogOpen] = useState(false);

  // MIDI integration - simple and non-blocking
  const midi = useSimpleMidi();

  // Optional broadcast integration - completely isolated
  const { isHost, isViewer, broadcastState, sendPerformanceState, currentRoom } = useBroadcast();
  
  // Check if viewer has broadcast data but no local song
  const showBroadcastViewerMode = isViewer && broadcastState && broadcastState.lyrics && !selectedSong;
  
  // Debug broadcast state changes
  const [debugMessage, setDebugMessage] = useState('');
  useEffect(() => {
    if (broadcastState) {
      console.log('📺 Performance page received broadcast state:', broadcastState);
      setDebugMessage(`📺 Received: ${broadcastState.songTitle || 'Unknown'} - Playing: ${broadcastState.isPlaying ? 'Yes' : 'No'} - Position: ${Math.round(broadcastState.position)}s`);
      
      // Clear debug message after 3 seconds
      setTimeout(() => setDebugMessage(''), 3000);
    }
  }, [broadcastState]);
  const fileInputRef = useRef<HTMLInputElement>(null);


  const { toast } = useToast();

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);








  // Show export dialog with filename input
  const handleExportData = () => {
    if (!userEmail) {
      toast({
        title: "Export Failed",
        description: "Please log in to export your data",
        variant: "destructive",
      });
      return;
    }

    // Generate default filename suggestion
    const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const userPrefix = userEmail.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
    const defaultName = `stagetracker-backup-${userPrefix}-${timestamp}`;
    setExportFilename(defaultName);
    setIsExportDialogOpen(true);
  };

  // Actually perform the export with custom filename
  const performExport = async () => {
    if (!userEmail || !exportFilename.trim()) return;

    try {
      setIsExporting(true);
      setExportProgress(0);
      setExportStatus("Starting export...");
      setIsExportDialogOpen(false);
      
      // Create AbortController for cancellation
      const controller = new AbortController();
      setExportController(controller);
      
      const backupManager = BackupManager.getInstance();
      
      // Create progress callback
      const onProgress = (progress: number, status: string) => {
        setExportProgress(progress);
        setExportStatus(status);
      };
      
      const zipBlob = await backupManager.exportAllData(userEmail, onProgress, { signal: controller.signal });
      
      // Create download with explicit MIME type for Android compatibility
      const zipBlobWithMime = new Blob([zipBlob], { type: 'application/zip' });
      const url = URL.createObjectURL(zipBlobWithMime);
      const link = document.createElement('a');
      link.href = url;
      
      // Use custom filename, ensure .zip extension
      let filename = exportFilename.trim();
      if (!filename.toLowerCase().endsWith('.zip')) {
        filename += '.zip';
      }
      link.download = filename;
      
      // Better mobile download handling
      link.style.display = 'none';
      link.setAttribute('rel', 'noopener');
      link.setAttribute('target', '_blank');
      
      document.body.appendChild(link);
      
      // Use setTimeout for better mobile compatibility
      setTimeout(() => {
        link.click();
        setTimeout(() => {
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }, 100);
      }, 10);
      
      toast({
        title: "Export Complete",
        description: `Your music library has been exported as "${filename}"`,
      });
    } catch (error) {
      console.error('Export failed:', error);
      
      // Handle cancellation vs real errors differently
      if (error instanceof DOMException && error.name === 'AbortError') {
        toast({
          title: "Export Cancelled",
          description: "Library export was cancelled by user",
        });
      } else {
        toast({
          title: "Export Failed",
          description: error instanceof Error ? error.message : "Failed to export data",
          variant: "destructive",
        });
      }
    } finally {
      setIsExporting(false);
      setExportProgress(0);
      setExportStatus("");
      setExportController(null);
    }
  };





  // Cancel export operation
  const handleCancelExport = () => {
    if (exportController) {
      exportController.abort();
    }
  };

  // Import data from zip file
  const handleImportData = () => {
    if (!userEmail) {
      toast({
        title: "Import Failed",
        description: "Please log in to import data",
        variant: "destructive",
      });
      return;
    }

    // Trigger file picker
    fileInputRef.current?.click();
  };

  // Handle file selection for import
  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !userEmail) return;

    try {
      setIsImporting(true);
      setImportProgress(0);
      setImportStatus("Reading backup file...");
      
      const backupManager = BackupManager.getInstance();
      
      // Create progress callback
      const onProgress = (progress: number, status: string) => {
        setImportProgress(progress);
        setImportStatus(status);
      };
      
      await backupManager.importAllData(file, userEmail, onProgress);
      
      // Refresh the song list
      const updatedSongs = LocalSongStorage.getAllSongs(userEmail);
      setAllSongs(updatedSongs.sort((a, b) => a.title.localeCompare(b.title)));
      
      toast({
        title: "Import Complete",
        description: "Your music library has been imported successfully",
      });
    } catch (error) {
      console.error('Import failed:', error);
      toast({
        title: "Import Failed",
        description: error instanceof Error ? error.message : "Failed to import data",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
      setImportProgress(0);
      setImportStatus("");
      // Clear the input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };


  // Instant audio engine (now with zero decode delays)
  const audioEngine = useAudioEngine({ 
    song: selectedSong ? { ...selectedSong, userId: userEmail || '' } as SongWithTracks : undefined,
    userEmail: userEmail,
    onDurationUpdated: (songId: string, newDuration: number) => {
      if (selectedSong && selectedSong.id === songId && userEmail) {
        LocalSongStorage.updateSong(userEmail, songId, { duration: newDuration });
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
    isLoadingTracks,
    masterVolume,
    updateMasterVolume,
    updateTrackVolume,
    updateTrackBalance,
    updateTrackMute,
    updateTrackSolo,
    // Pitch and speed control removed
    isAudioEngineOnline,
    masterStereoLevels,
    audioLevels
  } = audioEngine;

  // Create toggle functions for track manager compatibility
  const toggleTrackMute = useCallback((trackId: string) => {
    updateTrackMute(trackId);
  }, [updateTrackMute]);

  const toggleTrackSolo = useCallback((trackId: string) => {
    updateTrackSolo(trackId);
  }, [updateTrackSolo]);


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
      if (!userEmail) return;
      
      try {
        const songs = LocalSongStorage.getAllSongs(userEmail);
        // Sort songs alphabetically by title
        const sortedSongs = songs.sort((a, b) => a.title.localeCompare(b.title));
        setAllSongs(sortedSongs);
        console.log(`📋 Loaded ${sortedSongs.length} songs from local storage (alphabetically sorted)`);
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
  }, [userEmail, toast]);

  const refreshSongs = useCallback(() => {
    if (!userEmail) return;
    
    try {
      const songs = LocalSongStorage.getAllSongs(userEmail);
      // Sort songs alphabetically by title
      const sortedSongs = songs.sort((a, b) => a.title.localeCompare(b.title));
      setAllSongs(sortedSongs);
    } catch (error) {
      console.error('Failed to refresh songs:', error);
    }
  }, [userEmail]);

  // Track database entry ID for broadcasting
  const [songEntryId, setSongEntryId] = useState<string | null>(null);

  // Select song and load its tracks
  useEffect(() => {
    if (!selectedSongId || !userEmail) return;

    // Get fresh song data from storage to avoid circular dependencies
    const allSongsFromStorage = LocalSongStorage.getAllSongs(userEmail);
    const song = allSongsFromStorage.find(s => s.id === selectedSongId);
    if (!song) return;

    console.log(`🎵 Loading song: ${song.title}`);
    setSelectedSong(song);

    // If we're hosting a broadcast, upload song to database immediately on selection
    if (isHost && currentRoom?.id) {
      console.log(`📡 Host selected song - uploading to database for broadcast: ${song.title}`);
      console.log(`📡 Upload function will be called with roomId: ${currentRoom.id}`);
      uploadSongToDatabase(song, currentRoom.id);
    } else {
      console.log('📡 Not uploading to database:', { isHost, hasCurrentRoom: !!currentRoom?.id, roomId: currentRoom?.id });
    }
  }, [selectedSongId, userEmail, isHost, currentRoom?.id]);

  // Debug current values to see why upload isn't triggering
  useEffect(() => {
    console.log('🔍 Debug values:', { 
      selectedSongId, 
      userEmail: userEmail, 
      isHost, 
      currentRoomId: currentRoom?.id,
      hasSelectedSongId: !!selectedSongId,
      hasUserEmail: !!userEmail,
      hasCurrentRoom: !!currentRoom?.id
    });
  }, [selectedSongId, userEmail, isHost, currentRoom?.id]);

  // Upload song to database and get entry ID for broadcasting
  const uploadSongToDatabase = async (song: any, broadcastId: string) => {
    console.log('🚀 uploadSongToDatabase function called!', { song: song.title, broadcastId });
    try {
      const response = await fetch(`/api/broadcast/${broadcastId}/songs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ songs: [song] })
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('🔍 Full API response:', result);
        console.log('🔍 Songs array:', result.songs);
        if (result.songs && result.songs[0]) {
          console.log('🔍 First song object:', result.songs[0]);
        }
        
        const entryId = result.songs?.[0]?.id;
        if (entryId) {
          setSongEntryId(entryId);
          console.log(`✅ Song uploaded to database with entry ID: ${entryId}`);
        } else {
          console.log('⚠️ Song uploaded but no entry ID returned. Full result:', JSON.stringify(result, null, 2));
        }
      }
    } catch (error) {
      console.error('❌ Failed to upload song to database:', error);
    }
  };

  // Broadcast viewer mode: Sync with broadcaster's performance state
  useEffect(() => {
    if (!isViewer || !broadcastState) return;
    
    console.log('📺 Broadcast viewer mode: Syncing with broadcaster state', broadcastState);
    
    // Sync current song if broadcaster changed it (only if logged in)
    if (broadcastState.currentSong && broadcastState.currentSong !== selectedSongId && userEmail) {
      console.log(`📺 Broadcaster changed song to: ${broadcastState.songTitle || broadcastState.currentSong}`);
      setSelectedSongId(broadcastState.currentSong);
    }
    
    // Sync playback position if significant difference (only if we have local song)
    if (selectedSong && Math.abs(broadcastState.position - currentTime) > 1) {
      console.log(`📺 Syncing playback position: ${broadcastState.position}s`);
      seek(broadcastState.position);
    }
    
    // Sync play/pause state (only if we have local song)
    if (selectedSong && broadcastState.isPlaying !== isPlaying) {
      console.log(`📺 Syncing playback state: ${broadcastState.isPlaying ? 'playing' : 'paused'}`);
      if (broadcastState.isPlaying) {
        play();
      } else {
        pause();
      }
    }
    
  }, [isViewer, broadcastState, selectedSongId, selectedSong, currentTime, isPlaying, userEmail, seek, play, pause]);

  // Broadcast host mode: Send performance state to viewers
  useEffect(() => {
    console.log('🎭 Broadcast host effect:', { 
      isHost, 
      selectedSong: !!selectedSong, 
      selectedSongId, 
      songTitle: selectedSong?.title,
      songEntryId: songEntryId,
      hasLyrics: !!selectedSong?.lyrics 
    });
    
    if (!isHost) {
      console.log('🎭 Not broadcasting - not host');
      return;
    }
    
    if (!selectedSong) {
      console.log('🎭 Not broadcasting - no song selected');
      return;
    }
    
    // CRITICAL FIX: Only broadcast when songEntryId exists and matches current song
    // This prevents race conditions where songEntryId and songTitle are mismatched
    if (!songEntryId) {
      console.log('🎭 Not broadcasting - waiting for songEntryId');
      return;
    }
    
    // Send current performance state to all viewers
    const performanceState = {
      currentSong: selectedSongId, // Keep for backward compatibility
      songEntryId: songEntryId, // Database entry ID for viewers to fetch
      songTitle: selectedSong.title,
      position: currentTime,
      isPlaying: isPlaying,
      currentLyricLine: '', // TODO: Add current lyric line if available
      waveformProgress: duration > 0 ? currentTime / duration : 0,
      // Send lyrics and metadata to viewers
      lyrics: selectedSong.lyrics,
      artist: selectedSong.artist,
      duration: duration
    };
    
    console.log('🎭 Broadcasting performance state:', performanceState);
    sendPerformanceState(performanceState);
  }, [isHost, selectedSong, selectedSongId, songEntryId, currentTime, isPlaying, duration, sendPerformanceState]);

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
    if (!userEmail) {
      toast({
        title: "Authentication Required",
        description: "Please log in to add songs",
        variant: "destructive"
      });
      return;
    }

    try {
      const newSong = LocalSongStorage.addSong(userEmail, {
        title: songTitle,
        artist: songArtist,
        duration: 0,
        bpm: null,
        key: null,
        lyrics: '',
        waveformData: null
      });
      setAllSongs(prev => [...prev, newSong].sort((a, b) => a.title.localeCompare(b.title)));
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
  }, [userEmail, songTitle, songArtist, toast]);

  const handleUpdateLyrics = useCallback(() => {
    if (!selectedSong || !userEmail) return;

    try {
      const updatedSong = LocalSongStorage.updateSong(userEmail, selectedSong.id, {
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
  }, [selectedSong, lyricsText, userEmail, toast]);

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




  // Cancel editing
  const handleCancelEdit = () => {
  };


  // Format timestamp for display
  const formatTimestamp = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Delete song function
  const handleDeleteSongLocal = () => {
    if (!userEmail || !selectedSong) return;
    
    try {
      const success = LocalSongStorage.deleteSong(userEmail, selectedSong.id);
      
      if (success) {
        refreshSongs();
        
        // If we're deleting the currently selected song, clear the selection
        if (selectedSongId === selectedSong.id) {
          setSelectedSongId(null);
          setSongEntryId(null); // Also clear songEntryId to prevent race condition
        }
        
        setIsDeleteSongOpen(false);
        
        // Stop any playing audio if the deleted song is currently playing
        if (isPlaying && selectedSongId === selectedSong.id) {
          pause();
        }
        
        toast({
          title: "Song deleted",
          description: `"${selectedSong.title}" by ${selectedSong.artist} removed successfully.`
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





  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        // Enter fullscreen
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        // Exit fullscreen
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (error) {
      console.error('Fullscreen toggle failed:', error);
      toast({
        title: "Fullscreen Error",
        description: "Unable to toggle fullscreen mode",
        variant: "destructive",
      });
    }
  }, [toast]);

  return (
    <div className={`h-screen flex flex-col bg-background text-foreground overflow-hidden ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      
      
      {/* Header */}
      <div className="bg-surface border-b border-gray-700 p-2 md:p-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-4">
            <div className="flex items-center gap-2">
              <Music className="h-5 w-5 md:h-6 md:w-6 text-primary" />
              <div className="flex flex-col">
                <span className="text-base md:text-lg font-semibold">StageTracker Pro</span>
                {userEmail && (
                  <span className="text-xs text-gray-400" data-testid="text-username">
                    {userEmail}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Waveform Visualizer - Stretch across available space */}
          <div className="flex-1 mx-4 max-h-12">
            <WaveformVisualizer
              song={selectedSong ? { ...selectedSong, userId: userEmail || '' } as SongWithTracks : null}
              currentTime={currentTime}
              isPlaying={isPlaying}
              audioLevels={audioLevels}
              onSeek={seek}
              data-testid="header-waveform-visualizer"
            />
          </div>

          <div className="flex items-center gap-1 md:gap-2">
            {/* MIDI Devices Button - Professional Users Only */}
            {userType === 'professional' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsDeviceDialogOpen(true)}
                data-testid="button-device-manager"
                className="h-8 px-2 md:px-3"
              >
                <Activity className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                <span className="hidden sm:inline text-xs md:text-sm">Devices</span>
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
                <DropdownMenuItem onClick={() => setLocation('/dashboard')} data-testid="menuitem-dashboard">
                  <Cast className="h-4 w-4 mr-2" />
                  Dashboard
                </DropdownMenuItem>
                
                <DropdownMenuSeparator />
                
                <DropdownMenuItem onClick={() => window.open('https://www.youtube.com/channel/UCV6QdegSAG-YgxvXoFTsRVw', '_blank')} data-testid="menuitem-youtube-tutorials">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  YouTube Tutorials
                </DropdownMenuItem>


                <DropdownMenuSeparator />
                
                {/* Import/Export Section */}
                <DropdownMenuItem onClick={handleExportData} disabled={isExporting || allSongs.length === 0} data-testid="menuitem-export-data">
                  {isExporting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  {isExporting ? `Exporting... ${exportProgress}%` : 'Export Library'}
                </DropdownMenuItem>
                
                <DropdownMenuItem onClick={handleImportData} disabled={isImporting} data-testid="menuitem-import-data">
                  {isImporting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  {isImporting ? 'Importing...' : 'Import Library'}
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
                <DropdownMenuItem onClick={logout} data-testid="menuitem-logout">
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Upgrade Subscription Button */}
            {userType !== 'professional' && (
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  console.log('🔄 Current user type before upgrade:', userType, 'User email:', userEmail);
                  setLocation('/subscribe');
                }}
                data-testid="button-upgrade-subscription"
                className="h-8 px-2 md:px-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white border-0"
              >
                <Crown className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                <span className="hidden sm:inline text-xs md:text-sm">
                  {userType === 'free' ? 'Upgrade' : 'Upgrade to Pro'}
                </span>
                <span className="sm:hidden text-xs">
                  {userType === 'free' ? 'Up' : 'Pro'}
                </span>
              </Button>
            )}
            
          </div>
        </div>
      </div>
      
      {/* Broadcast Viewer Mode - Show lyrics from broadcast data */}
      {showBroadcastViewerMode && (
        <div className="bg-blue-50 dark:bg-blue-950 border-b border-blue-200 dark:border-blue-800 p-4 flex-shrink-0">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-lg font-bold text-blue-900 dark:text-blue-100 mb-2">
              📺 Viewing Live Performance
            </h2>
            <h3 className="text-xl text-blue-800 dark:text-blue-200 mb-1">
              {broadcastState?.songTitle}
            </h3>
            {broadcastState?.artist && (
              <p className="text-blue-700 dark:text-blue-300 mb-2">
                by {broadcastState.artist}
              </p>
            )}
            <div className="text-sm text-blue-600 dark:text-blue-400 mb-4">
              Position: {Math.floor(broadcastState?.position || 0)}s
              {broadcastState?.duration && ` / ${Math.floor(broadcastState.duration)}s`}
              {' • '}
              Status: {broadcastState?.isPlaying ? '▶️ Playing' : '⏸️ Paused'}
            </div>
            <div className="bg-white dark:bg-slate-800 p-4 rounded-lg text-left max-h-96 overflow-y-auto">
              <pre className="whitespace-pre-wrap text-sm font-mono">
                {broadcastState?.lyrics}
              </pre>
            </div>
          </div>
        </div>
      )}
      
      {/* Main Content */}
      <div className="flex-1 flex min-h-0">
        {/* Left Sidebar - Song Selection */}
        <div className="w-72 md:w-80 border-r border-gray-700 bg-surface flex flex-col min-h-0">
          <div className="p-2 md:p-4 border-b border-gray-700 flex-shrink-0">
            <div className="flex items-center justify-between mb-2 md:mb-4">
              <h2 className="text-sm md:text-lg font-semibold">Songs ({allSongs.length})</h2>
              <div className="flex items-center gap-2">
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
                    <DialogDescription>
                      Create a new song to add tracks and practice with.
                    </DialogDescription>
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
              
              <Button 
                size="sm" 
                variant="outline"
                className="h-7 md:h-8 px-2 md:px-3"
                onClick={() => {
                  if (selectedSong) {
                    setIsDeleteSongOpen(true);
                  } else {
                    toast({
                      title: "No Song Selected",
                      description: "Please select a song to delete",
                      variant: "destructive"
                    });
                  }
                }}
                disabled={!selectedSong || isPlaying}
                data-testid="button-delete-song"
              >
                <Trash2 className="h-3 w-3 md:h-4 md:w-4 mr-1" />
                <span className="text-xs md:text-sm">Delete</span>
              </Button>
              </div>

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
            {(() => {
              // Group songs by first letter
              const groupedSongs = allSongs.reduce((groups, song) => {
                const firstLetter = song.title.charAt(0).toUpperCase();
                if (!groups[firstLetter]) {
                  groups[firstLetter] = [];
                }
                groups[firstLetter].push(song);
                return groups;
              }, {} as Record<string, typeof allSongs>);

              // Create sorted array of letters
              const sortedLetters = Object.keys(groupedSongs).sort();

              return sortedLetters.map(letter => (
                <div key={letter}>
                  {/* Letter separator */}
                  <div className="px-2 md:px-4 py-1 bg-gray-800/50 border-b border-gray-600">
                    <div className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                      {letter}
                    </div>
                  </div>
                  
                  {/* Songs for this letter */}
                  {groupedSongs[letter].map((song) => (
                    <div
                      key={song.id}
                      className={`p-2 md:p-4 border-b border-gray-700 transition-colors touch-target cursor-pointer hover:bg-gray-700 pt-[8px] pb-[8px] ${
                        selectedSongId === song.id
                          ? 'bg-primary/20 border-l-4 border-l-primary'
                          : 'bg-transparent border-l-4 border-l-transparent hover:border-l-gray-600'
                      }`}
                      onClick={() => {
                        if (!isPlaying) {
                          setSelectedSongId(song.id);
                          setSongEntryId(null); // Reset songEntryId to prevent race condition
                        }
                      }}
                      data-testid={`song-item-${song.id}`}
                    >
                      <div className="flex items-center justify-between mt-[-8px] mb-[-8px]">
                        <div className="font-medium text-sm md:text-base truncate mr-2">{song.title}</div>
                        <div className="flex gap-1">
                          <button
                            className="text-xs px-2 py-1 rounded transition-colors touch-target flex-shrink-0 bg-gray-700 hover:bg-gray-600 mt-[4px] mb-[4px] ml-[1px] mr-[1px] pl-[14px] pr-[14px] pt-[4px] pb-[4px]"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!isPlaying) {
                                setSelectedSongId(song.id);
                                setSongEntryId(null); // Reset songEntryId to prevent race condition
                                setIsTrackManagerOpen(true);
                              }
                            }}
                            disabled={isPlaying}
                            data-testid={`button-tracks-${song.id}`}
                          >
                            {song.tracks ? song.tracks.length : 0} tracks
                          </button>
                        </div>
                      </div>
                      <div className="text-xs md:text-sm text-gray-400 truncate mt-[-6px] mb-[-6px]">{song.artist}</div>
                      <div className="flex items-center justify-between pt-[0px] pb-[0px] mt-[-8px] mb-[-8px]">
                        <div className="text-xs text-gray-500 mt-[8px] mb-[8px] ml-[0px] mr-[0px] pl-[0px] pr-[0px] pt-[-2px] pb-[-2px]">
                          {song.duration > 0 ? `${Math.floor(song.duration / 60)}:${Math.floor(song.duration % 60).toString().padStart(2, '0')}` : '0:00'}
                        </div>
                        {selectedSongId === song.id && (
                          <ProfessionalStereoVUMeter
                            leftLevel={masterStereoLevels.left}
                            rightLevel={masterStereoLevels.right}
                            isPlaying={isPlaying}
                            size="sm"
                            horizontal={true}
                            className="flex-shrink-0"
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ));
            })()}
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
  
              onPlay={play}
              onPause={pause}
              onStop={stop}
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
            <div className="p-2 border-b border-gray-700 bg-surface md:hidden flex-shrink-0">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold truncate mr-2 flex-1">
                  {selectedSong ? `${selectedSong.title} - ${selectedSong.artist}` : 'Select a song'}
                </h2>
                
                {/* Mobile Lyrics Controls */}
                {selectedSong && <LyricsControls onEditLyrics={handleEditLyrics} song={selectedSong} />}
              </div>
              
            </div>
            
            {/* Lyrics Area - Takes remaining space but leaves room for transport */}
            <div className="flex-1 min-h-0 overflow-hidden" style={{ contain: 'layout style' }}>
              <LyricsDisplay
                song={selectedSong}
                currentTime={currentTime}
                duration={duration}
                onEditLyrics={selectedSong ? handleEditLyrics : undefined}
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
      
                  onPlay={handlePlay}
                  onPause={handlePause}
                  onStop={handleStop}
                />
                
              </div>
            </div>
          </div>

        </div>
      </div>
      {/* Status Bar - Desktop only */}
      <div className="bg-surface border-t border-gray-700 p-2 flex-shrink-0 mobile-hidden">
        <div className="flex items-center justify-between gap-4">
          <StatusBar
            isAudioEngineOnline={isAudioEngineOnline}
            latency={latency}
            isHost={isHost}
            isViewer={isViewer}
            currentRoom={currentRoom?.name || null}
            exportTask={isExporting ? {
              progress: exportProgress,
              status: exportStatus,
              onCancel: handleCancelExport
            } : undefined}
          />
          
          
          
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
            </div>
          </div>

          {/* Lyrics Editor Content */}
          <div className="flex-1 overflow-hidden">
            <Textarea
              ref={lyricsTextareaRef}
              id="lyrics"
              value={lyricsText}
              onChange={(e) => setLyricsText(e.target.value)}
              placeholder="Enter song lyrics here...&#10;&#10;Tip: Use timestamps like [01:30] for synchronized playback"
              className="w-full h-full resize-none font-mono text-sm border border-gray-600 bg-background"
              data-testid="textarea-lyrics"
            />
          </div>

          {/* Compact Action Buttons */}
          <div className="flex justify-end gap-2 pt-2 mt-2 border-t border-gray-700 flex-shrink-0">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                setIsEditLyricsOpen(false);
                setLyricsText("");
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
              Save Lyrics
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Track Manager Dialog */}
      <Dialog open={isTrackManagerOpen} onOpenChange={setIsTrackManagerOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh]" data-testid="dialog-track-manager">
          <DialogHeader>
          </DialogHeader>
          {selectedSong && (
            <div className="space-y-4">
              {/* Track Manager */}
              <TrackManager
                song={selectedSong as any}
                isOpen={isTrackManagerOpen}
                userEmail={userEmail}
                audioEngine={audioEngine.audioEngine} // Pass audio engine for mute region sync
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
              // Pitch and speed control removed
              onPlay={play}
              onPause={pause}
              isPlaying={isPlaying}
              isLoadingTracks={isLoadingTracks}
              audioLevels={audioLevels}
              data-testid="track-manager"
            />
            
            {/* Stem Splitter - TEMPORARILY HIDDEN - Add stem separation functionality */}
            {false && (
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Advanced Tools</h3>
                </div>
                <StemSplitter
                  song={selectedSong as any}
                  userEmail={userEmail} // Pass userEmail to StemSplitter
                  onStemGenerated={(stems) => {
                    console.log('Performance: Generated stems:', stems);
                  }}
                  onSongUpdate={(updatedSong: any) => {
                    console.log('Performance: Stem splitter updated song with', updatedSong.tracks?.length || 0, 'tracks');
                    setSelectedSong(updatedSong);
                    setAllSongs(prev => prev.map(song => 
                      song.id === updatedSong.id ? updatedSong : song
                    ));
                  }}
                />
              </div>
            )}
            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* Export Filename Dialog */}
      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Export Music Library</DialogTitle>
            <DialogDescription>
              Choose a name for your backup file
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="export-filename">Filename</Label>
              <Input
                id="export-filename"
                value={exportFilename}
                onChange={(e) => setExportFilename(e.target.value)}
                placeholder="Enter filename..."
                className="mt-1"
                data-testid="input-export-filename"
              />
              <p className="text-xs text-muted-foreground mt-1">
                .zip extension will be added automatically
              </p>
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setIsExportDialogOpen(false)}
                data-testid="button-cancel-export"
              >
                Cancel
              </Button>
              <Button
                onClick={performExport}
                disabled={!exportFilename.trim() || isExporting}
                data-testid="button-confirm-export"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Progress Dialog */}
      <Dialog open={isImporting} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-import-progress">
          <DialogHeader>
            <DialogTitle>Importing Music Library</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Please wait while your backup is being imported
            </p>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>{importProgress}%</span>
              </div>
              <Progress value={importProgress} className="w-full" data-testid="progress-import" />
            </div>
            {importStatus && (
              <div className="text-sm text-muted-foreground">
                <p data-testid="text-import-status">{importStatus}</p>
              </div>
            )}
            <div className="flex justify-center">
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Do not close this window</span>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* MIDI Device Dialog */}
      <SimpleMidiDevices 
        isOpen={isDeviceDialogOpen}
        onClose={() => setIsDeviceDialogOpen(false)}
      />
      
      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".zip"
        style={{ display: 'none' }}
        onChange={handleFileSelected}
        data-testid="hidden-import-file-input"
      />
    </div>
  );
}