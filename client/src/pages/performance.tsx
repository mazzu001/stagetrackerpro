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
import { useMIDISequencer, type MIDICommand } from '@/hooks/useMIDISequencer';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Music, Menu, Plus, Edit, Play, Pause, Clock, Minus, Trash2, FileAudio, LogOut, User, Crown, Maximize, Minimize, Usb, Bluetooth, Zap, X, Target, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocalAuth, type UserType } from "@/hooks/useLocalAuth";
import { LocalSongStorage, type LocalSong } from "@/lib/local-song-storage";
import { USBMIDIDevicesManager } from "@/components/USBMIDIDevicesManager";
import BluetoothDevicesManager from "@/components/BluetoothDevicesManager";
import { parseMIDICommand } from '@/utils/midiFormatter';





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
  const [midiCommands, setMidiCommands] = useState<MIDICommand[]>([]);
  const [editingCommandIndex, setEditingCommandIndex] = useState<number | null>(null);
  const [editingCommandText, setEditingCommandText] = useState("");
  const [allSongs, setAllSongs] = useState<LocalSong[]>([]);
  const [selectedSong, setSelectedSong] = useState<LocalSong | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isUSBMIDIOpen, setIsUSBMIDIOpen] = useState(false);
  const [isBluetoothDevicesOpen, setIsBluetoothDevicesOpen] = useState(false);
  const [connectedUSBMIDIDevices, setConnectedUSBMIDIDevices] = useState<any[]>([]);
  const [isMidiConnected, setIsMidiConnected] = useState(false);
  const [selectedMidiDeviceName, setSelectedMidiDeviceName] = useState<string>('');
  const [footerMidiCommand, setFooterMidiCommand] = useState('');
  
  // Check initial MIDI connection status on startup
  useEffect(() => {
    const selectedDeviceId = localStorage.getItem('usb_midi_selected_output_device');
    if (selectedDeviceId && connectedUSBMIDIDevices.length > 0) {
      const selectedDevice = connectedUSBMIDIDevices.find(device => 
        device.id === selectedDeviceId && device.type === 'output'
      );
      
      if (selectedDevice) {
        const isConnected = selectedDevice.state === 'connected';
        setIsMidiConnected(isConnected);
        setSelectedMidiDeviceName(selectedDevice.name);
        
        if (isConnected) {
          console.log(`✅ Initial MIDI connection status: Connected to ${selectedDevice.name}`);
        }
      }
    }
  }, [connectedUSBMIDIDevices]);

  const { toast } = useToast();
  const { user, logout } = useLocalAuth();
  
  // Use userType from authenticated user, fallback to prop
  const userType = user?.userType || propUserType;

  // MIDI command execution function for the sequencer
  const executeMIDICommand = useCallback(async (commandText: string): Promise<boolean> => {
    try {
      // Get the selected output device from localStorage (same as manual send)
      const selectedDeviceId = localStorage.getItem('usb_midi_selected_output_device');
      let outputDevice = null;
      
      if (selectedDeviceId) {
        // Use the specifically selected device
        outputDevice = connectedUSBMIDIDevices.find(device => 
          device.type === 'output' && device.id === selectedDeviceId
        );
      }
      
      // If no selected device or device not found, fall back to first available
      if (!outputDevice) {
        outputDevice = connectedUSBMIDIDevices.find(device => device.type === 'output');
      }
      
      if (!outputDevice) {
        console.warn('⚠️ No USB MIDI output device available for sequencer. Please connect and select a device in USB MIDI Settings.');
        return false;
      }

      // Get Web MIDI access
      if (!navigator.requestMIDIAccess) {
        console.warn('⚠️ Web MIDI API not available');
        return false;
      }

      const midiAccess = await navigator.requestMIDIAccess({ sysex: false });
      const output = midiAccess.outputs.get(outputDevice.id);
      
      if (!output) {
        console.warn(`⚠️ USB MIDI output device ${outputDevice.id} not found`);
        return false;
      }

      // Parse and send the MIDI command
      const parseResult = parseMIDICommand(commandText);
      if (parseResult && parseResult.bytes.length > 0) {
        console.log(`🎹 Sequencer sending to ${outputDevice.name}: ${commandText} → [${parseResult.bytes.map(b => b.toString(16).padStart(2, '0')).join(' ')}]`);
        output.send(parseResult.bytes);
        return true;
      } else {
        console.warn(`⚠️ Failed to parse MIDI command: ${commandText}`);
        return false;
      }
    } catch (error) {
      console.error('❌ Error executing MIDI command from sequencer:', error);
      return false;
    }
  }, [connectedUSBMIDIDevices]);

  // Manual MIDI send function (exact copy from USB MIDI devices page)
  const handleFooterSendMessage = async () => {
    const selectedOutputDevice = localStorage.getItem('usb_midi_selected_output_device');
    if (!selectedOutputDevice || !footerMidiCommand.trim()) return;

    try {
      if (navigator.requestMIDIAccess) {
        const midiAccess = await navigator.requestMIDIAccess({ sysex: false });
        const output = midiAccess.outputs.get(selectedOutputDevice);
        
        if (output) {
          // Parse MIDI command using proper parser (supports [[PC:12:1]], hex, and text formats)
          const parseResult = parseMIDICommand(footerMidiCommand);
          
          if (parseResult && parseResult.bytes.length > 0) {
            console.log(`📤 Footer MIDI Sending: ${footerMidiCommand} → [${parseResult.bytes.map(b => b.toString(16).padStart(2, '0')).join(' ')}]`);
            output.send(parseResult.bytes);
            
            toast({
              title: "Message Sent",
              description: `${parseResult.formatted} sent to ${selectedMidiDeviceName}`,
            });
          } else {
            toast({
              title: "Invalid MIDI Command",
              description: "Please use format: [[PC:12:1]], [[CC:7:64:1]], or hex bytes",
              variant: "destructive",
            });
            return;
          }
        } else {
          toast({
            title: "Device Not Found",
            description: "Selected output device is not available",
            variant: "destructive",
          });
          return;
        }
      }
      
      setFooterMidiCommand('');
    } catch (error) {
      console.error('Footer MIDI Send Error:', error);
      toast({
        title: "Send Failed",
        description: `Unable to send MIDI message: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    }
  };

  // Auto-send MIDI command from timestamped lyrics - uses EXACT same code as footer send button
  const handleLyricsMidiCommand = useCallback(async (command: string) => {
    console.log(`🎼 Processing MIDI command from timestamped lyrics: ${command}`);
    setFooterMidiCommand(command);
    
    // EXACT SAME CODE AS FOOTER SEND BUTTON - handleFooterSendMessage
    const selectedOutputDevice = localStorage.getItem('usb_midi_selected_output_device');
    if (!selectedOutputDevice || !command.trim()) return;

    try {
      if (navigator.requestMIDIAccess) {
        const midiAccess = await navigator.requestMIDIAccess({ sysex: false });
        const output = midiAccess.outputs.get(selectedOutputDevice);
        
        if (output) {
          // Parse MIDI command using proper parser (supports [[PC:12:1]], hex, and text formats)
          const parseResult = parseMIDICommand(command);
          
          if (parseResult && parseResult.bytes.length > 0) {
            console.log(`📤 Lyrics Auto MIDI Sending: ${command} → [${parseResult.bytes.map(b => b.toString(16).padStart(2, '0')).join(' ')}]`);
            output.send(parseResult.bytes);
            
            toast({
              title: "Lyrics MIDI Sent",
              description: `${parseResult.formatted} sent to ${selectedMidiDeviceName}`,
            });
          } else {
            toast({
              title: "Invalid MIDI Command",
              description: "Please use format: [[PC:12:1]], [[CC:7:64:1]], or hex bytes",
              variant: "destructive",
            });
            return;
          }
        } else {
          toast({
            title: "Device Not Found",
            description: "Selected output device is not available",
            variant: "destructive",
          });
          return;
        }
      }
      
      // Clear the input after successful send
      setTimeout(() => setFooterMidiCommand(''), 100);
    } catch (error) {
      console.error('Lyrics MIDI Send Error:', error);
      toast({
        title: "Send Failed",
        description: `Unable to send MIDI message: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    }
  }, [selectedMidiDeviceName, toast]);

  // Initialize MIDI sequencer
  const midiSequencer = useMIDISequencer({
    onExecuteCommand: executeMIDICommand
  });

  // Debug: Log connected USB MIDI devices for sequencer
  useEffect(() => {
    console.log(`🔍 Connected USB MIDI devices for sequencer:`, connectedUSBMIDIDevices);
    const outputDevices = connectedUSBMIDIDevices.filter(d => d.type === 'output');
    console.log(`📤 Available output devices for sequencer:`, outputDevices);
  }, [connectedUSBMIDIDevices]);

  // Check for payment success on page load
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('payment') === 'success') {
      // Update user status to paid
      const storedUser = localStorage.getItem('lpp_local_user');
      if (storedUser) {
        const userData = JSON.parse(storedUser);
        userData.userType = 'paid';
        userData.hasActiveSubscription = true;
        userData.subscriptionTier = 'premium';
        localStorage.setItem('lpp_local_user', JSON.stringify(userData));
        window.dispatchEvent(new Event('auth-change'));
        
        toast({
          title: "🎉 Welcome to Premium!",
          description: "Your subscription is now active. Enjoy unlimited songs!",
        });

        // Clean up URL
        window.history.replaceState({}, '', '/');
      }
    }
  }, [toast]);



  // Fullscreen functionality
  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error('Error attempting to toggle fullscreen:', err);
      toast({
        title: "Fullscreen Error",
        description: "Unable to toggle fullscreen mode. Your browser may not support this feature.",
        variant: "destructive"
      });
    }
  }, [toast]);

  // Listen for fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Load songs from localStorage when component mounts or user changes
  const loadSongs = useCallback(() => {
    console.log(`🔍 Loading songs for user: ${user?.email}`);
    if (user?.email) {
      const songs = LocalSongStorage.getAllSongs(user.email);
      console.log(`🎵 Found ${songs.length} songs in storage:`, songs);
      // Sort songs alphabetically by title
      const sortedSongs = songs.sort((a, b) => a.title.localeCompare(b.title));
      setAllSongs(sortedSongs);
      console.log(`✅ Set ${sortedSongs.length} songs in state`);
      
      // If we had a selected song, try to restore it
      if (selectedSongId) {
        const song = LocalSongStorage.getSong(user.email, selectedSongId);
        setSelectedSong(song || null);
        console.log(`🔍 Restored selected song: ${song?.title || 'not found'}`);
      }
    } else {
      console.log(`⚠️ No user email, cannot load songs`);
    }
  }, [user?.email, selectedSongId]);

  useEffect(() => {
    console.log(`🔄 loadSongs useEffect triggered`);
    loadSongs();
  }, [loadSongs]);



  // Debug: Monitor song selection state
  useEffect(() => {
    console.log(`🔍 Song selection state changed - selectedSongId: ${selectedSongId}, user?.email: ${user?.email}`);
  }, [selectedSongId, user?.email]);

  // Update selected song when selectedSongId changes
  useEffect(() => {
    console.log(`🔍 Song loading useEffect triggered - selectedSongId: ${selectedSongId}, user?.email: ${user?.email}`);
    if (selectedSongId && user?.email) {
      const song = LocalSongStorage.getSong(user.email, selectedSongId);
      setSelectedSong(song || null);
      
      // Load MIDI commands into sequencer when song changes
      console.log(`🔍 Checking song for MIDI commands:`, song);
      console.log(`🔍 Song lyrics field:`, song?.lyrics);
      console.log(`🔍 Song lyrics type:`, typeof song?.lyrics);
      console.log(`🔍 Song lyrics length:`, song?.lyrics?.length);
      
      if (song && song.lyrics) {
        console.log(`🎹 Loading MIDI commands for song: ${song.title}`);
        console.log(`🎼 Lyrics content:`, song.lyrics);
        midiSequencer.setMIDICommands(song.lyrics);
      } else {
        console.log(`⚠️ No lyrics found - song: ${!!song}, lyrics: ${!!song?.lyrics}`);
        midiSequencer.setMIDICommands(''); // Clear commands if no song or lyrics
      }
    } else {
      setSelectedSong(null);
      midiSequencer.setMIDICommands(''); // Clear commands when no song selected
    }
  }, [selectedSongId, user?.email, midiSequencer.setMIDICommands]);

  // Refresh songs helper function
  const refreshSongs = useCallback(() => {
    if (user?.email) {
      const songs = LocalSongStorage.getAllSongs(user.email);
      // Sort songs alphabetically by title
      const sortedSongs = songs.sort((a, b) => a.title.localeCompare(b.title));
      setAllSongs(sortedSongs);
      
      // Also refresh the currently selected song to pick up changes
      if (selectedSongId) {
        const updatedSong = LocalSongStorage.getSong(user.email, selectedSongId);
        setSelectedSong(updatedSong || null);
      }
    }
  }, [user?.email, selectedSongId]);

  // Duration update callback to save to database when calculated from audio
  const handleDurationUpdate = useCallback((songId: string, duration: number) => {
    if (user?.email) {
      console.log(`Updating song database with calculated duration: ${duration}s for song ID: ${songId}`);
      LocalSongStorage.updateSong(user.email, songId, { duration });
      // Refresh the songs list to show updated duration
      refreshSongs();
    }
  }, [user?.email, refreshSongs]);

  const {
    isPlaying,
    currentTime,
    duration,
    audioLevels,
    masterStereoLevels,
    cpuUsage,
    isAudioEngineOnline,

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
  } = useAudioEngine({ 
    song: selectedSong as any, 
    onDurationUpdated: handleDurationUpdate 
  });

  // Enhanced seek handler that also updates MIDI sequencer
  const handleSeek = useCallback((time: number) => {
    seek(time);
    if (isPlaying) {
      console.log(`🎯 Seeking MIDI sequencer to ${time * 1000}ms`);
      midiSequencer.updateSequencer(time * 1000);
    }
  }, [seek, isPlaying, midiSequencer.updateSequencer]);

  // Enhanced play function that starts sequencer
  const handlePlay = useCallback(() => {
    play();
  }, [play]);

  // Enhanced pause function that stops sequencer
  const handlePause = useCallback(() => {
    pause();
  }, [pause]);

  // Enhanced stop function that resets sequencer
  const handleStop = useCallback(() => {
    stop();
    midiSequencer.resetSequencer();
  }, [stop, midiSequencer.resetSequencer]);

  useKeyboardShortcuts({
    onPlay: handlePlay,
    onPause: handlePause,
    onStop: handleStop,
    onTogglePlayback: isPlaying ? handlePause : handlePlay,
    onTrackMute: updateTrackMute,
    isPlaying
  });

  // Connect MIDI sequencer to audio playback
  useEffect(() => {
    if (isPlaying) {
      console.log(`🎵 Starting MIDI sequencer with audio at ${currentTime * 1000}ms`);
      midiSequencer.startSequencer(currentTime * 1000);
    } else {
      console.log('🛑 Stopping MIDI sequencer with audio');
      midiSequencer.stopSequencer();
    }
  }, [isPlaying, midiSequencer.startSequencer, midiSequencer.stopSequencer]);

  // Update MIDI sequencer with current playback time
  useEffect(() => {
    if (isPlaying) {
      midiSequencer.updateSequencer(currentTime * 1000);
    }
  }, [currentTime, isPlaying, midiSequencer.updateSequencer]);

  // Reset MIDI sequencer when song changes
  useEffect(() => {
    midiSequencer.resetSequencer();
  }, [selectedSongId, midiSequencer.resetSequencer]);

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
        duration: 0, // No duration until tracks are added
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
      LocalSongStorage.updateSong(user.email, selectedSongId, { 
        lyrics: lyricsText
      });
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

  // Add generic MIDI command at current timestamp
  const handleAddMidiCommand = () => {
    const newCommand: MIDICommand = {
      timestamp: currentTime,
      type: 'program_change',
      description: '[[PC:1:1]]',
      program: 1,
      channel: 0
    };

    setMidiCommands(prev => [...prev, newCommand].sort((a, b) => a.timestamp - b.timestamp));
    
    toast({
      title: "MIDI Command Added",
      description: `Command added at ${formatTimestamp(currentTime)} - click to edit`,
    });
  };

  // Start editing a MIDI command
  const handleEditCommand = (index: number) => {
    const command = midiCommands[index];
    setEditingCommandIndex(index);
    setEditingCommandText(command.description || '[[PC:1:1]]');
  };

  // Save edited MIDI command
  const handleSaveEditedCommand = () => {
    if (editingCommandIndex === null) return;

    const parseResult = parseMIDICommand(editingCommandText);
    if (!parseResult || !parseResult.bytes || parseResult.bytes.length === 0) {
      toast({
        title: "Invalid MIDI Command",
        description: "Please use format: [[PC:12:1]], [[CC:7:64:1]], or [[NOTE:60:127:1]]",
        variant: "destructive",
      });
      return;
    }

    // Determine command type based on first byte
    const firstByte = parseResult.bytes[0];
    const command = firstByte & 0xF0;
    let type: MIDICommand['type'];
    let commandData: Partial<MIDICommand> = {};

    switch (command) {
      case 0x90: // Note On
        type = 'note_on';
        commandData = {
          note: parseResult.bytes[1],
          velocity: parseResult.bytes[2],
          channel: (firstByte & 0x0F)
        };
        break;
      case 0x80: // Note Off
        type = 'note_off';
        commandData = {
          note: parseResult.bytes[1],
          velocity: parseResult.bytes[2],
          channel: (firstByte & 0x0F)
        };
        break;
      case 0xB0: // Control Change
        type = 'control_change';
        commandData = {
          controller: parseResult.bytes[1],
          value: parseResult.bytes[2],
          channel: (firstByte & 0x0F)
        };
        break;
      case 0xC0: // Program Change
        type = 'program_change';
        commandData = {
          program: parseResult.bytes[1],
          channel: (firstByte & 0x0F)
        };
        break;
      default:
        toast({
          title: "Unsupported Command",
          description: "Only PC, CC, NOTE, and NOTEOFF commands are supported",
          variant: "destructive",
        });
        return;
    }

    const updatedCommand: MIDICommand = {
      ...midiCommands[editingCommandIndex],
      type,
      description: editingCommandText,
      ...commandData
    };

    setMidiCommands(prev => {
      const updated = [...prev];
      updated[editingCommandIndex] = updatedCommand;
      return updated.sort((a, b) => a.timestamp - b.timestamp);
    });

    setEditingCommandIndex(null);
    setEditingCommandText("");
    
    toast({
      title: "Command Updated",
      description: `${parseResult.formatted} saved`,
    });
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingCommandIndex(null);
    setEditingCommandText("");
  };

  // Remove MIDI command
  const handleRemoveMidiCommand = (index: number) => {
    setMidiCommands(prev => prev.filter((_, i) => i !== index));
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
      setMidiCommands((selectedSong as any).midiCommands || []);
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
                  {(userType === 'paid' || userType === 'premium') && (
                    <>
                      <DropdownMenuItem className="flex items-center">
                        <Crown className="w-4 h-4 mr-2 text-yellow-500" />
                        <span className="text-green-400">Premium Active</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  {userType === 'professional' && (
                    <>
                      <DropdownMenuItem className="flex items-center">
                        <Crown className="w-4 h-4 mr-2 text-purple-500" />
                        <span className="text-purple-400">Professional Active</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                </div>
                
                {/* Desktop subscription link - Always show upgrade for levels 1 & 2 */}
                <DropdownMenuItem 
                  onClick={() => setLocation('/plans')}
                  className="flex items-center mobile-hidden cursor-pointer"
                  data-testid="menu-subscribe"
                >
                  <Crown className="w-4 h-4 mr-2 text-yellow-500" />
                  <span>
                    {userType === 'free' && 'View Plans'}
                    {(userType === 'paid' || userType === 'premium') && 'Upgrade to Professional'}
                    {userType === 'professional' && 'Manage Subscription'}
                  </span>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="mobile-hidden" />

                {userType === 'professional' && (
                  <>
                    <DropdownMenuItem 
                      onClick={() => setIsUSBMIDIOpen(true)}
                      className="flex items-center cursor-pointer"
                      data-testid="menu-usb-midi"
                    >
                      <Usb className="w-4 h-4 mr-2" />
                      <span>USB MIDI Devices</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => setIsBluetoothDevicesOpen(true)}
                      className="flex items-center cursor-pointer"
                      data-testid="menu-bluetooth-devices"
                    >
                      <Bluetooth className="w-4 h-4 mr-2" />
                      <span>Bluetooth Devices</span>
                    </DropdownMenuItem>
                  </>
                )}

                <DropdownMenuItem 
                  onClick={toggleFullscreen}
                  className="flex items-center cursor-pointer"
                  data-testid="menu-fullscreen"
                >
                  {isFullscreen ? (
                    <Minimize className="w-4 h-4 mr-2" />
                  ) : (
                    <Maximize className="w-4 h-4 mr-2" />
                  )}
                  <span>{isFullscreen ? 'Exit Full Screen' : 'Full Screen'}</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator />
                <DropdownMenuItem disabled className="flex items-center">
                  <User className="w-4 h-4 mr-2" />
                  <div className="flex flex-col">
                    <span className="text-sm">{user?.email || 'Test User'}</span>
                    <span className="text-xs text-gray-500">
                      {userType === 'free' && 'Free User'}
                      {(userType === 'paid' || userType === 'premium') && 'Premium User'}
                      {userType === 'professional' && 'Professional User'}
                    </span>
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
                    {song.duration > 0 ? `${Math.floor(song.duration / 60)}:${(song.duration % 60).toString().padStart(2, '0')}` : '0:00'}
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
                  progress={progress}
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
      {/* Status Bar & Manual MIDI Send - Desktop only */}
      <div className="bg-surface border-t border-gray-700 p-2 flex-shrink-0 mobile-hidden">
        <div className="flex items-center justify-between gap-4">
          <StatusBar
            isAudioEngineOnline={isAudioEngineOnline}
            isMidiConnected={isMidiConnected}
            midiDeviceName={selectedMidiDeviceName}
            latency={latency}
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
                    disabled={!selectedSong}
                    data-testid="button-search-lyrics"
                    className="h-8 px-3"
                  >
                    <Music className="w-3 h-3 mr-1" />
                    Search
                  </Button>
                </>
              )}
              {currentLyricsTab === "midi" && userType === 'professional' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddMidiCommand}
                  data-testid="button-add-midi-command"
                  className="h-8 px-3 bg-primary/10 hover:bg-primary/20 border-primary/30"
                >
                  <Target className="w-3 h-3 mr-1" />
                  Add Command at {formatTimestamp(currentTime)}
                </Button>
              )}
              
              {/* Compact Position Slider */}
              {selectedSong && selectedSong.duration && (
                <div className="flex-1 min-w-[200px] ml-4">
                  <input
                    type="range"
                    min="0"
                    max={selectedSong.duration || 100}
                    step="0.1"
                    value={currentTime}
                    onChange={(e) => {
                      const newTime = parseFloat(e.target.value);
                      handleSeek(newTime);
                    }}
                    className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                    data-testid="slider-song-position"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Tabbed Content */}
          <div className="flex-1 flex flex-col min-h-0">
            <Tabs value={currentLyricsTab} onValueChange={setCurrentLyricsTab} className="flex-1 flex flex-col">
              <TabsList className="grid w-full grid-cols-2 bg-gray-800 mb-3">
                <TabsTrigger value="lyrics" className="data-[state=active]:bg-primary">
                  <Music className="w-4 h-4 mr-2" />
                  Lyrics
                </TabsTrigger>
                {userType === 'professional' && (
                  <TabsTrigger value="midi" className="data-[state=active]:bg-primary">
                    <Zap className="w-4 h-4 mr-2" />
                    MIDI Commands
                  </TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="lyrics" className="flex-1 flex flex-col min-h-0 mt-0">
                <div className="flex items-center justify-between mb-2 flex-shrink-0">
                  <Label htmlFor="lyrics" className="text-sm font-semibold">Lyrics</Label>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500">
                      {lyricsText.length} chars
                    </span>
                    <div className="text-xs text-gray-400">
                      <code className="text-xs">[MM:SS]</code> timestamps
                    </div>
                  </div>
                </div>
                
                <Textarea
                  id="lyrics"
                  value={lyricsText}
                  onChange={(e) => setLyricsText(e.target.value)}
                  onPaste={handleLyricsPaste}
                  placeholder={`Enter lyrics with timestamps:

[00:15] First verse line
[00:30] Second verse line  

Click "Timestamp" to insert current time`}
                  className="flex-1 font-mono text-sm leading-relaxed resize-none border-gray-600"
                  style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}
                  spellCheck={false}
                  data-testid="textarea-lyrics"
                />
              </TabsContent>

              {userType === 'professional' && (
                <TabsContent value="midi" className="flex-1 flex flex-col min-h-0 mt-0">
                  <div className="flex items-center justify-between mb-2 flex-shrink-0">
                    <Label className="text-sm font-semibold">MIDI Commands</Label>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500">
                        {midiCommands.length} commands
                      </span>
                      <div className="text-xs text-gray-400">
                        Professional feature
                      </div>
                    </div>
                  </div>
                  
                  {midiCommands.length > 0 ? (
                    <div className="flex-1 border border-gray-600 rounded-md overflow-hidden">
                      <div className="bg-gray-800 px-3 py-2 border-b border-gray-600">
                        <div className="grid grid-cols-4 gap-4 text-xs font-semibold text-gray-300">
                          <span>Time</span>
                          <span>Command</span>
                          <span>Details</span>
                          <span>Actions</span>
                        </div>
                      </div>
                      <div className="flex-1 overflow-y-auto max-h-[300px]">
                        {midiCommands.map((cmd, index) => (
                          <div key={index} className="px-3 py-2 border-b border-gray-700 last:border-b-0 hover:bg-gray-700/50">
                            {editingCommandIndex === index ? (
                              <div className="grid grid-cols-4 gap-4 items-center text-sm">
                                <span className="font-mono text-primary">
                                  {formatTimestamp(cmd.timestamp)}
                                </span>
                                <Input
                                  value={editingCommandText}
                                  onChange={(e) => setEditingCommandText(e.target.value)}
                                  className="h-6 text-xs font-mono"
                                  placeholder="[[PC:12:1]]"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleSaveEditedCommand();
                                    } else if (e.key === 'Escape') {
                                      e.preventDefault();
                                      handleCancelEdit();
                                    }
                                  }}
                                />
                                <span className="text-gray-400 text-xs">
                                  Press Enter to save, Esc to cancel
                                </span>
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleSaveEditedCommand}
                                    className="h-6 w-6 p-0 hover:bg-green-600/20 hover:text-green-400"
                                  >
                                    ✓
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleCancelEdit}
                                    className="h-6 w-6 p-0 hover:bg-gray-600/20"
                                  >
                                    ✕
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="grid grid-cols-4 gap-4 items-center text-sm">
                                <span className="font-mono text-primary">
                                  {formatTimestamp(cmd.timestamp)}
                                </span>
                                <span 
                                  className="font-mono text-blue-400 cursor-pointer hover:text-blue-300" 
                                  onClick={() => handleEditCommand(index)}
                                  title="Click to edit"
                                >
                                  {cmd.description}
                                </span>
                                <span className="text-gray-400 text-xs">
                                  {cmd.type === 'program_change' && `Program ${cmd.program} Ch${(cmd.channel || 0) + 1}`}
                                  {cmd.type === 'control_change' && `CC${cmd.controller} = ${cmd.value} Ch${(cmd.channel || 0) + 1}`}
                                  {cmd.type === 'note_on' && `Note ${cmd.note} Vel ${cmd.velocity} Ch${(cmd.channel || 0) + 1}`}
                                  {cmd.type === 'note_off' && `Note ${cmd.note} Ch${(cmd.channel || 0) + 1}`}
                                </span>
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditCommand(index)}
                                    className="h-6 w-6 p-0 hover:bg-blue-600/20 hover:text-blue-400"
                                    title="Edit command"
                                  >
                                    <Edit className="w-3 h-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemoveMidiCommand(index)}
                                    className="h-6 w-6 p-0 hover:bg-red-600/20 hover:text-red-400"
                                    title="Delete command"
                                  >
                                    <X className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 border border-gray-600 rounded-md flex items-center justify-center">
                      <div className="text-center text-gray-400">
                        <Zap className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No MIDI commands yet</p>
                        <p className="text-xs mt-1">
                          Click "Add Command" to create a timestamped MIDI command
                        </p>
                        <p className="text-xs mt-2 font-mono text-blue-400">
                          Commands are added at current playback time and can be edited afterwards
                        </p>
                      </div>
                    </div>
                  )}
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
                setMidiCommands([]);
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

      {/* USB MIDI Devices Manager Modal */}
      <USBMIDIDevicesManager 
        isOpen={isUSBMIDIOpen} 
        onClose={() => setIsUSBMIDIOpen(false)}
        onConnectedDevicesChange={(devices) => {
          setConnectedUSBMIDIDevices(devices);
          
          // Check if we have a selected output device that's connected
          const selectedDeviceId = localStorage.getItem('usb_midi_selected_output_device');
          const selectedDevice = selectedDeviceId && 
            devices.find(device => device.id === selectedDeviceId && device.type === 'output');
          
          if (selectedDevice) {
            const isConnected = selectedDevice.state === 'connected';
            setIsMidiConnected(isConnected);
            setSelectedMidiDeviceName(selectedDevice.name);
            
            if (isConnected) {
              console.log(`✅ MIDI connection established - updating status to Connected (${selectedDevice.name})`);
            }
          } else {
            setIsMidiConnected(false);
            setSelectedMidiDeviceName('');
          }
        }}
      />

      {/* Bluetooth Devices Manager Modal */}
      <BluetoothDevicesManager 
        isOpen={isBluetoothDevicesOpen} 
        onClose={() => setIsBluetoothDevicesOpen(false)} 
      />

    </div>
  );
}
