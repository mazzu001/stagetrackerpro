import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { AudioFileStorage } from "@/lib/audio-file-storage";
import { LocalSongStorageDB as LocalSongStorage } from "@/lib/local-song-storage-db";
// useLocalAuth removed - receive userEmail as prop instead
import { Plus, FolderOpen, Music, Trash2, Volume2, File, VolumeX, Headphones, Play, Pause, AlertTriangle } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import ProfessionalStereoVUMeter from "@/components/professional-stereo-vu-meter";
import { TrackWaveformEditor } from "./track-waveform-editor";


import type { Track, SongWithTracks } from "@shared/schema";
import type { StreamingAudioEngine } from "@/lib/streaming-audio-engine";

interface TrackManagerProps {
  song?: SongWithTracks;
  audioEngine?: StreamingAudioEngine; // Audio engine for mute region sync
  userEmail?: string;
  onTrackVolumeChange?: (trackId: string, volume: number) => void;
  onTrackMuteToggle?: (trackId: string) => void;
  onTrackSoloToggle?: (trackId: string) => void;
  onTrackBalanceChange?: (trackId: string, balance: number) => void;
  // Pitch and speed control removed
  audioLevels?: Record<string, number>;
  isPlaying?: boolean;
  isLoadingTracks?: boolean;
  onPlay?: () => void;
  onPause?: () => void;
  isOpen?: boolean; // Track if dialog is open to trigger refresh
}

export default function TrackManager({ 
  song, 
  audioEngine,
  userEmail,
  onTrackVolumeChange, 
  onTrackMuteToggle, 
  onTrackSoloToggle, 
  onTrackBalanceChange,
  // onSpeedChange removed
  audioLevels = {},
  isPlaying = false,
  isLoadingTracks = false,
  onPlay,
  onPause,
  isOpen = false
}: TrackManagerProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [trackName, setTrackName] = useState("");
  const [audioFilePath, setAudioFilePath] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [estimatedDuration, setEstimatedDuration] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [localTrackValues, setLocalTrackValues] = useState<Record<string, { volume: number; balance: number }>>({});
  const [tracks, setTracks] = useState<Track[]>([]); // Local tracks state for incremental updates
  const [isLoadingLocalTracks, setIsLoadingLocalTracks] = useState(false);
  // Pitch and speed control removed

  // Recording state
  // Recording features removed for simplicity

  const { toast } = useToast();
  const debounceTimeouts = useRef<Record<string, NodeJS.Timeout>>({});

  // Load tracks sequentially when song changes
  useEffect(() => {
    const loadTracksSequentially = async () => {
      if (!song?.id || !userEmail) {
        setTracks([]);
        setLocalTrackValues({});
        return;
      }

      console.log(`=== Loading tracks for song: ${song.title} (${song.id}) ===`);
      setIsLoadingLocalTracks(true);
      
      // Clear existing tracks when switching songs
      setTracks([]);
      setLocalTrackValues({});

      try {
        // Get fresh song data from database
        const currentSong = await LocalSongStorage.getSong(userEmail, song.id);
        if (!currentSong) {
          console.log('Song not found in database');
          return;
        }

        const songTracks = currentSong.tracks || [];
        console.log(`Found ${songTracks.length} tracks in database`);

        // Load tracks one by one sequentially
        const loadedTracks: Track[] = [];
        const trackValues: Record<string, { volume: number; balance: number }> = {};

        for (let i = 0; i < songTracks.length; i++) {
          const track = songTracks[i];
          console.log(`Loading track ${i + 1}/${songTracks.length}: ${track.name}`);

          // Get audio URL if needed
          if (!track.audioUrl && track.id) {
            const audioStorage = AudioFileStorage.getInstance(userEmail);
            const audioUrl = await audioStorage.getAudioUrl(track.id);
            if (audioUrl) {
              track.audioUrl = audioUrl;
            }
          }

          // Load mute regions for this track
          if (track.id && song.id) {
            try {
              const muteRegions = await LocalSongStorage.getMuteRegions(userEmail, song.id, track.id);
              if (muteRegions && muteRegions.length > 0) {
                console.log(`  Loaded ${muteRegions.length} mute regions for track ${track.name}`);
              }
            } catch (error) {
              console.warn(`  Could not load mute regions for track ${track.id}:`, error);
            }
          }

          // Add track to local state (updates UI incrementally)
          loadedTracks.push(track);
          trackValues[track.id] = {
            volume: track.volume || 50,  // Default to 50 as per track schema
            balance: track.balance || 0
          };

          // Update state incrementally so UI shows progress
          setTracks([...loadedTracks]);
          setLocalTrackValues({ ...trackValues });
        }

        // Waveform data is already in the song object if it exists
        if (currentSong.waveformData) {
          console.log(`  Song has waveform data`);
        } else {
          console.log(`  No waveform data found (will regenerate on demand)`);
        }

        console.log(`✅ Loaded all ${loadedTracks.length} tracks`);
      } catch (error) {
        console.error('Error loading tracks:', error);
        toast({
          title: "Failed to load tracks",
          description: "Could not load tracks from database",
          variant: "destructive"
        });
      } finally {
        setIsLoadingLocalTracks(false);
      }
    };

    loadTracksSequentially();
  }, [song?.id, userEmail]);

  // Initialize audio inputs on component mount
  // Recording features removed

  // Recording features removed

  // Get available audio input devices and start monitoring
  // Recording features removed

  // Recording features removed

  // Recording features removed

  // Recording features removed

  // Recording features removed

  // Removed refetchTracks - no longer needed with sequential approach

  const detectAndUpdateSongDuration = async (audioFile: File, songId: string) => {
    try {
      const audio = new Audio();
      const url = URL.createObjectURL(audioFile);
      
      return new Promise<void>((resolve) => {
        audio.addEventListener('loadedmetadata', async () => {
          const duration = Math.round(audio.duration);
          console.log(`Detected audio duration: ${duration}s from file: ${audioFile.name}`);
          URL.revokeObjectURL(url);
          
          if (userEmail && duration > 0) {
            await LocalSongStorage.updateSong(userEmail, songId, { duration });
          }
          resolve();
        });
        
        audio.addEventListener('error', () => {
          console.warn(`Could not detect duration for: ${audioFile.name}`);
          URL.revokeObjectURL(url);
          resolve();
        });
        
        audio.src = url;
      });
    } catch (error) {
      console.error('Error detecting song duration:', error);
    }
  };

  const handleFileSelect = () => {
    console.log('=== Web Track Manager: Starting file selection ===');
    
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      input.accept = 'audio/*';
      input.setAttribute('data-testid', 'track-audio-file-input');
      
      input.onchange = async (e) => {
        console.log('=== Web Track Manager: File change event triggered ===');
        
        try {
          const target = e.target as HTMLInputElement;
          if (!target || !target.files) {
            console.error('No target or files in change event');
            return;
          }
          
          const files = Array.from(target.files);
          console.log('Files selected:', files.length);
          
          if (files.length === 0) {
            console.log('No files selected, returning');
            return;
          }

          // Check track limit before processing
          if (tracks.length + files.length > 6) {
            console.warn(`Track limit would be exceeded: ${tracks.length} + ${files.length} > 6`);
            toast({
              title: "Too many tracks",
              description: `You can only have 6 tracks per song. You currently have ${tracks.length} tracks.`,
              variant: "destructive"
            });
            return;
          }

          // Mobile detection with strict limits
          const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
          
          // On mobile, enforce maximum 3 files to prevent crashes
          if (isMobileDevice && files.length > 3) {
            console.log(`📱 Mobile device detected - limiting to 3 files max to prevent crashes`);
            toast({
              title: "Mobile Device Limit",
              description: `On mobile devices, you can only add 3 audio files at once to prevent crashes. Please select 3 files or fewer.`,
              variant: "destructive"
            });
            return;
          }
          
          if (isMobileDevice && files.length > 1) {
            console.log(`📱 Mobile device: processing ${files.length} files with extra safety measures`);
          }
          
          setSelectedFiles(files);
          setIsImporting(true);
          
          let totalDuration = 0;
          let processedCount = 0;
          
          // Process files one at a time - wait for each to completely finish
          const isMobile = isMobileDevice;
          
          for (let i = 0; i < files.length; i++) {
            const file = files[i];
            
            try {
              console.log(`📁 Processing file ${i + 1}/${files.length}: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
              
              if (isMobile) {
                console.log(`📱 Mobile device: waiting for complete file processing before next`);
              }
              
              // Update UI to show current file being processed
              setSelectedFiles([file]);
              
              // Wait for the file to be completely processed (stored in IndexedDB, metadata updated, etc.)
              console.log(`⏳ Starting processing of ${file.name}...`);
              await processFile(file);
              console.log(`✅ File ${i + 1} completely processed and stored`);
              
              processedCount++;
              
              // Mobile memory cleanup: force garbage collection hints
              if (isMobile) {
                console.log(`📱 Mobile cleanup after file ${i + 1}`);
                
                // Clear any temporary references
                if ('gc' in window && typeof window.gc === 'function') {
                  window.gc();
                }
                
                // Force a short delay to let memory settle
                await new Promise(resolve => setTimeout(resolve, 100));
              }
              
              // Get duration safely after processing
              try {
                const audio = new Audio();
                const url = URL.createObjectURL(file);
                
                const duration = await new Promise<number>((resolve) => {
                  const cleanup = () => {
                    URL.revokeObjectURL(url);
                    audio.src = '';
                    audio.load();
                  };
                  
                  const timeoutId = setTimeout(() => {
                    console.warn(`⏰ Duration detection timeout for ${file.name}`);
                    cleanup();
                    resolve(0);
                  }, 5000);
                  
                  audio.addEventListener('loadedmetadata', () => {
                    clearTimeout(timeoutId);
                    const fileDuration = audio.duration || 0;
                    cleanup();
                    resolve(fileDuration);
                  });
                  
                  audio.addEventListener('error', () => {
                    clearTimeout(timeoutId);
                    cleanup();
                    resolve(0);
                  });
                  
                  audio.src = url;
                });
                
                totalDuration += duration;
                console.log(`📊 Duration added: ${duration.toFixed(1)}s (total: ${totalDuration.toFixed(1)}s)`);
                
              } catch (durationError) {
                console.warn(`Could not get duration for ${file.name}:`, durationError);
              }
              
              // Give mobile devices a moment to breathe between files
              if (isMobile && i < files.length - 1) {
                console.log(`📱 Mobile safety pause...`);
                await new Promise(resolve => setTimeout(resolve, 500));
              }
              
            } catch (fileError) {
              console.error(`❌ Failed to process file ${file.name}:`, fileError);
              toast({
                title: "File processing failed",
                description: `Failed to process ${file.name}: ${fileError instanceof Error ? fileError.message : 'Unknown error'}`,
                variant: "destructive"
              });
              
              // On mobile, stop on first error to prevent cascade
              if (isMobile) {
                console.log(`📱 Mobile: stopping batch processing after error to prevent crash`);
                break;
              }
            }
          }
          
          setEstimatedDuration(totalDuration);
          
          if (processedCount > 0) {
            toast({
              title: "Files imported successfully",
              description: `Successfully imported ${processedCount} out of ${files.length} files`
            });
          }
        } catch (changeError) {
          console.error('=== Web Track Manager: Error in file change handler ===');
          console.error('Error:', changeError);
          toast({
            title: "File selection failed",
            description: changeError instanceof Error ? changeError.message : "Failed to process selected files",
            variant: "destructive"
          });
        } finally {
          console.log('=== Web Track Manager: Cleaning up file selection ===');
          setIsImporting(false);
          setSelectedFiles([]);
          setEstimatedDuration(0);
        }
      };
      
      input.click();
    } catch (error) {
      console.error('=== Web Track Manager: Error creating file input ===');
      console.error('Error:', error);
      toast({
        title: "File selection error",
        description: error instanceof Error ? error.message : "Failed to open file selector",
        variant: "destructive"
      });
    }
  };

  const processFile = async (file: File) => {
    if (!song?.id || !userEmail) return;
    
    try {
      console.log(`Processing file: ${file.name}`);
      
      const audioFileName = file.name;
      const trackName = audioFileName.replace(/\.[^/.]+$/, ""); // Remove extension
      
      console.log(`Step 1: Adding track "${trackName}" to database`);
      
      // Step 1: Add track to database
      const trackAdded = await LocalSongStorage.addTrackToSong(userEmail, song.id, {
        name: trackName,
        songId: song.id,
        trackNumber: tracks.length + 1,
        audioUrl: '', // Will be set when file is loaded
        localFileName: audioFileName,
        mimeType: file.type,
        fileSize: file.size,
        volume: 50,
        balance: 0,
        isMuted: false,
        isSolo: false
      });
      
      if (trackAdded) {
        // Get the track ID that was just created
        const updatedSong = await LocalSongStorage.getSong(userEmail, song.id);
        const newTrack = updatedSong?.tracks.find(t => t.name === trackName && t.localFileName === audioFileName);
        
        if (newTrack) {
          console.log(`Step 2: Storing audio file for track ${newTrack.id}`);
          
          // Step 2: Store the audio file
          const audioStorage = AudioFileStorage.getInstance(userEmail);
          await audioStorage.storeAudioFile(newTrack.id, file, newTrack, song.title);
          console.log('Audio file stored successfully');
          
          // Get the audio URL
          const audioUrl = await audioStorage.getAudioUrl(newTrack.id);
          if (audioUrl) {
            await LocalSongStorage.updateTrack(userEmail, song.id, newTrack.id, { audioUrl });
            newTrack.audioUrl = audioUrl; // Update local object
            console.log('Track updated with audio URL');
          }
          
          console.log(`Step 3: Adding track to UI`);
          
          // Step 3: Add track to local state immediately (incremental UI update)
          setTracks(prevTracks => [...prevTracks, newTrack]);
          setLocalTrackValues(prev => ({
            ...prev,
            [newTrack.id]: {
              volume: newTrack.volume || 1.0,
              balance: newTrack.balance || 0.0
            }
          }));
          
          // Detect and update song duration
          await detectAndUpdateSongDuration(file, song.id);
          
          // Clear cached waveform to force regeneration
          if (song?.id) {
            const waveformCacheKey = `waveform_${song.id}`;
            localStorage.removeItem(waveformCacheKey);
          }
          
          console.log(`✅ Successfully processed: ${file.name}`);
        }
      }
    } catch (error) {
      console.error('Error adding track:', error);
      toast({
        title: "Add track failed",
        description: error instanceof Error ? error.message : "Failed to add track",
        variant: "destructive"
      });
    }
  };

  const deleteTrack = async (trackId: string) => {
    if (!song?.id || !userEmail) return;
    
    try {
      const success = await LocalSongStorage.deleteTrack(userEmail, song.id, trackId);
      if (success) {
        // Remove track from local state immediately (incremental UI update)
        setTracks(prevTracks => prevTracks.filter(t => t.id !== trackId));
        setLocalTrackValues(prev => {
          const updated = { ...prev };
          delete updated[trackId];
          return updated;
        });
        
        // Clear cached waveform to force regeneration with remaining tracks
        if (song?.id) {
          const waveformCacheKey = `waveform_${song.id}`;
          localStorage.removeItem(waveformCacheKey);
        }
        
        toast({
          title: "Track deleted",
          description: "Audio track has been removed."
        });
        
        console.log(`✅ Track ${trackId} deleted successfully`);
      }
    } catch (error) {
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Failed to delete track",
        variant: "destructive"
      });
    }
  };

  const handleClearBrokenTracks = async () => {
    if (tracks.length === 0 || !song?.id || !userEmail) return;

    try {
      // Delete all tracks sequentially
      for (const track of tracks) {
        await LocalSongStorage.deleteTrack(userEmail, song.id, track.id);
      }
      
      // Clear local state immediately
      setTracks([]);
      setLocalTrackValues({});
      
      // Clear cached waveform since all tracks are removed
      if (song?.id) {
        const waveformCacheKey = `waveform_${song.id}`;
        localStorage.removeItem(waveformCacheKey);
        console.log(`Cleared waveform cache for "${song.title}" - all tracks removed`);
      }
      
      toast({
        title: "All tracks cleared",
        description: "All audio tracks have been removed from this song."
      });
    } catch (error) {
      toast({
        title: "Clear failed",
        description: error instanceof Error ? error.message : "Failed to clear tracks",
        variant: "destructive"
      });
    }
  };

  // Debounced volume change handler
  const handleVolumeChange = useCallback((trackId: string, volume: number) => {
    // Update local state immediately for responsive UI
    setLocalTrackValues(prev => ({
      ...prev,
      [trackId]: { ...prev[trackId], volume }
    }));

    // Clear any existing timeout for this track
    if (debounceTimeouts.current[trackId]) {
      clearTimeout(debounceTimeouts.current[trackId]);
    }

    // Set new timeout to update audio engine and database
    debounceTimeouts.current[trackId] = setTimeout(async () => {
      onTrackVolumeChange?.(trackId, volume);
      
      // Update database AND Performance page's song state
      if (song?.id && userEmail) {
        const track = tracks.find(t => t.id === trackId);
        if (track) {
          // Update storage
          await LocalSongStorage.updateTrack(userEmail, song.id, trackId, { volume });
          
          // Track values are already updated in local state
        }
      }
      
      delete debounceTimeouts.current[trackId];
    }, 150);
  }, [tracks, song?.id, userEmail, onTrackVolumeChange]);

  // Debounced balance change handler
  const handleBalanceChange = useCallback((trackId: string, balance: number) => {
    // Update local state immediately for responsive UI
    setLocalTrackValues(prev => ({
      ...prev,
      [trackId]: { ...prev[trackId], balance }
    }));

    // Clear any existing timeout for this track
    const balanceTimeoutKey = `${trackId}_balance`;
    if (debounceTimeouts.current[balanceTimeoutKey]) {
      clearTimeout(debounceTimeouts.current[balanceTimeoutKey]);
    }

    // Set new timeout to update audio engine and database
    debounceTimeouts.current[balanceTimeoutKey] = setTimeout(async () => {
      onTrackBalanceChange?.(trackId, balance);
      
      // Update database AND Performance page's song state
      if (song?.id && userEmail) {
        const track = tracks.find(t => t.id === trackId);
        if (track) {
          // Update storage
          await LocalSongStorage.updateTrack(userEmail, song.id, trackId, { balance });
          
          // Track values are already updated in local state
        }
      }
      
      delete debounceTimeouts.current[balanceTimeoutKey];
    }, 150);
  }, [tracks, song?.id, userEmail, onTrackBalanceChange]);

  // Mute toggle handler
  const handleMuteToggle = useCallback(async (trackId: string) => {
    onTrackMuteToggle?.(trackId);
    
    // Update database
    if (song?.id && userEmail) {
      // Get the current state from IndexedDB, not from in-memory track
      const storedSong = await LocalSongStorage.getSong(userEmail, song.id);
      const storedTrack = storedSong?.tracks.find(t => t.id === trackId);
      const currentMuteState = storedTrack?.isMuted === true;
      
      // Toggle the state properly
      await LocalSongStorage.updateTrack(userEmail, song.id, trackId, { isMuted: !currentMuteState });
      console.log(`🔊 Track ${trackId} mute toggled: ${currentMuteState} -> ${!currentMuteState}`);
      
      // Update local state immediately
      setTracks(prevTracks => 
        prevTracks.map(t => t.id === trackId ? { ...t, isMuted: !currentMuteState } : t)
      );
    }
  }, [song?.id, userEmail, onTrackMuteToggle]);

  // Solo toggle handler
  const handleSoloToggle = useCallback(async (trackId: string) => {
    onTrackSoloToggle?.(trackId);
    
    // Update database
    if (song?.id && userEmail) {
      // Get the current state from IndexedDB, not from in-memory track
      const storedSong = await LocalSongStorage.getSong(userEmail, song.id);
      const storedTrack = storedSong?.tracks.find(t => t.id === trackId);
      const currentSoloState = storedTrack?.isSolo === true;
      
      // Toggle the state properly
      await LocalSongStorage.updateTrack(userEmail, song.id, trackId, { isSolo: !currentSoloState });
      console.log(`🎧 Track ${trackId} solo toggled: ${currentSoloState} -> ${!currentSoloState}`);
      
      // Update local state immediately
      setTracks(prevTracks => 
        prevTracks.map(t => t.id === trackId ? { ...t, isSolo: !currentSoloState } : t)
      );
    }
  }, [song?.id, userEmail, onTrackSoloToggle]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      Object.values(debounceTimeouts.current).forEach(timeout => {
        if (timeout) clearTimeout(timeout);
      });
    };
  }, []);

  return (
    <div className="w-full space-y-4 max-h-[70vh] overflow-y-auto pr-2">
      {/* Header with controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">Track Manager</h3>
            {tracks.length > 0 && (
              <span className="text-sm text-gray-500">({tracks.length} track{tracks.length !== 1 ? 's' : ''})</span>
            )}
          </div>
          
        </div>
        
        
        <div className="flex items-center gap-2">
          {/* Play/Pause button - only show if callbacks provided */}
          {(onPlay || onPause) && (
            <Button
              onClick={isPlaying ? onPause : onPlay}
              variant={isPlaying ? "destructive" : "default"}
              size="sm"
              data-testid="button-play-pause"
            >
              {isPlaying ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
              {isPlaying ? 'Pause' : 'Play'}
            </Button>
          )}
          
          {/* Recording features removed */}

          <Button
            onClick={handleFileSelect}
            disabled={tracks.length >= 6 || isImporting}
            size="sm"
            className="hidden md:flex"
            data-testid="button-add-tracks-desktop"
          >
            <Plus className="h-4 w-4 mr-2" />
            {isImporting ? 'Adding...' : 'Add Tracks'}
          </Button>
          
          {tracks.length > 0 && (
            <Button
              onClick={handleClearBrokenTracks}
              variant="outline"
              size="sm"
              className="hidden md:flex"
              data-testid="button-clear-tracks-desktop"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear All
            </Button>
          )}

          {/* Recording features removed */}

          <Button
            onClick={handleFileSelect}
            disabled={tracks.length >= 6 || isImporting}
            size="sm"
            className="flex md:hidden"
            data-testid="button-add-tracks-mobile"
          >
            <Plus className="h-4 w-4 mr-1" />
            {isImporting ? 'Adding...' : 'Add'}
          </Button>
          
          {tracks.length > 0 && (
            <Button
              onClick={handleClearBrokenTracks}
              variant="outline"
              size="sm"
              className="flex md:hidden h-8 w-8 p-0"
              title="Clear All Tracks"
              data-testid="button-clear-tracks-mobile"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {tracks.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-gray-500">
              <Music className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="mb-2">No tracks added yet</p>
              <p className="text-sm">Add audio files to start building your performance</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tracks.map((track, index) => {
            const localValues = localTrackValues[track.id] || { volume: track.volume, balance: track.balance };
            const level = audioLevels[track.id] || 0;
            
            return (
              <Card key={track.id} className="transition-all hover:shadow-md">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center text-sm font-medium">
                        {index + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-medium truncate" title={track.name}>{track.name}</h4>
                        <p className="text-xs text-gray-500">
                          {track.localFileName} • {((track.fileSize || 0) / 1024 / 1024).toFixed(1)}MB
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <ProfessionalStereoVUMeter 
                        leftLevel={level} 
                        rightLevel={level}
                        isPlaying={isPlaying}
                        size="sm"
                        horizontal={true}
                        className="flex-shrink-0"
                      />
                      <Button
                        onClick={() => deleteTrack(track.id)}
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                        title="Delete track"
                        data-testid={`button-delete-track-${index}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {/* Volume and Balance Controls */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Volume Control */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-medium">Volume</Label>
                        <span className="text-xs text-gray-500">{localValues.volume}%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => handleMuteToggle(track.id)}
                          variant="ghost"
                          size="sm"
                          className={`h-8 w-8 p-0 ${track.isMuted ? 'text-red-500 bg-red-50' : 'text-gray-500'}`}
                          title={track.isMuted ? "Unmute" : "Mute"}
                          data-testid={`button-mute-track-${index}`}
                        >
                          {track.isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                        </Button>
                        <Slider
                          value={[localValues.volume]}
                          onValueChange={(value) => handleVolumeChange(track.id, value[0])}
                          max={100}
                          step={1}
                          className="flex-1"
                          data-testid={`slider-volume-track-${index}`}
                        />
                      </div>
                    </div>
                    
                    {/* Balance Control */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-medium">Balance</Label>
                        <span className="text-xs text-gray-500">
                          {localValues.balance === 0 ? 'Center' : 
                           localValues.balance < 0 ? `L${Math.abs(localValues.balance)}` : 
                           `R${localValues.balance}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => handleSoloToggle(track.id)}
                          variant="ghost"
                          size="sm"
                          className={`h-8 w-8 p-0 ${track.isSolo ? 'text-yellow-500 bg-yellow-50' : 'text-gray-500'}`}
                          title={track.isSolo ? "Unsolo" : "Solo"}
                          data-testid={`button-solo-track-${index}`}
                        >
                          <Headphones className="h-4 w-4" />
                        </Button>
                        <Slider
                          value={[localValues.balance]}
                          onValueChange={(value) => handleBalanceChange(track.id, value[0])}
                          min={-100}
                          max={100}
                          step={1}
                          className="flex-1"
                          data-testid={`slider-balance-track-${index}`}
                        />
                      </div>
                    </div>
                  </div>
                  
                  {/* Waveform Editor */}
                  <div className="mt-4">
                    <TrackWaveformEditor
                      trackId={track.id}
                      songId={song?.id || ''}
                      userEmail={userEmail || ''}
                      audioUrl={track.audioUrl}
                      duration={song?.duration || 240}
                      isCollapsed={true}
                      audioEngine={audioEngine} // Pass audio engine for real-time mute sync
                      onRegionsChange={(regions) => {
                        console.log(`Track ${track.name}: Updated mute regions:`, regions);
                        // Regions are automatically saved by TrackWaveformEditor
                      }}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}


    </div>
  );
}