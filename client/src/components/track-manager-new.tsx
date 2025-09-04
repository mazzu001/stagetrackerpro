import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { AudioFileStorage } from "@/lib/audio-file-storage";
import { LocalSongStorage } from "@/lib/local-song-storage";
import { useLocalAuth } from "@/hooks/useLocalAuth";
import { Plus, FolderOpen, Music, Trash2, Volume2, File, VolumeX, Headphones, Play, Pause, AlertTriangle, Loader2, Clock } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import VUMeter from "@/components/vu-meter";
import { TrackRecovery } from "@/components/track-recovery";
import { ClickTrackGenerator, type ClickTrackConfig } from "@/lib/click-track-generator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

// Mobile detection utility
const isMobileDevice = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

import type { Track, SongWithTracks } from "@shared/schema";

interface TrackManagerProps {
  song?: SongWithTracks;
  onTrackUpdate?: () => void;
  onSongUpdate?: (updatedSong: SongWithTracks) => void;
  onTrackVolumeChange?: (trackId: string, volume: number) => void;
  onTrackMuteToggle?: (trackId: string) => void;
  onTrackSoloToggle?: (trackId: string) => void;
  onTrackBalanceChange?: (trackId: string, balance: number) => void;
  audioLevels?: Record<string, number>;
  isPlaying?: boolean;
  isLoadingTracks?: boolean;
  onPlay?: () => void;
  onPause?: () => void;
}

export default function TrackManager({ 
  song, 
  onTrackUpdate, 
  onSongUpdate,
  onTrackVolumeChange, 
  onTrackMuteToggle, 
  onTrackSoloToggle, 
  onTrackBalanceChange,
  audioLevels = {},
  isPlaying = false,
  isLoadingTracks = false,
  onPlay,
  onPause
}: TrackManagerProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [trackName, setTrackName] = useState("");
  const [audioFilePath, setAudioFilePath] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [estimatedDuration, setEstimatedDuration] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const [currentFileName, setCurrentFileName] = useState("");
  const [localTrackValues, setLocalTrackValues] = useState<Record<string, { volume: number; balance: number }>>({});
  
  // Click track state
  const [bpm, setBpm] = useState<number>(song?.bpm || 120);
  const [clickTrackEnabled, setClickTrackEnabled] = useState(false);
  const [countInMeasures, setCountInMeasures] = useState<1 | 2 | 3 | 4>(1);
  const [clickVolume, setClickVolume] = useState(0.5);
  const [clickTrackGenerator, setClickTrackGenerator] = useState<ClickTrackGenerator | null>(null);

  const { toast } = useToast();
  const { user } = useLocalAuth();
  const debounceTimeouts = useRef<Record<string, NodeJS.Timeout>>({});
  const [tracks, setTracks] = useState<Track[]>([]);

  // Save BPM to database with debouncing
  const saveBPMToDatabase = useCallback(async (newBpm: number) => {
    if (!song?.id || !user?.email) return;

    try {
      // Update song in local storage
      const updatedSong = { ...song, bpm: newBpm };
      LocalSongStorage.updateSong(user.email, song.id, { bpm: newBpm });
      
      // Trigger song update callback
      onSongUpdate?.(updatedSong);
      
      console.log(`🎯 BPM saved: ${newBpm} for song "${song.title}"`);
    } catch (error) {
      console.error('Failed to save BPM:', error);
      toast({
        title: "Error",
        description: "Failed to save BPM setting",
        variant: "destructive",
      });
    }
  }, [song, user?.email, onSongUpdate, toast]);

  // Debounced BPM change handler
  const handleBPMChange = useCallback((newBpm: number) => {
    setBpm(newBpm);
    
    // Clear existing timeout
    if (debounceTimeouts.current.bpm) {
      clearTimeout(debounceTimeouts.current.bpm);
    }
    
    // Set new timeout for saving
    debounceTimeouts.current.bpm = setTimeout(() => {
      saveBPMToDatabase(newBpm);
    }, 1000); // Save 1 second after user stops typing
  }, [saveBPMToDatabase]);

  // Initialize click track generator
  useEffect(() => {
    const initClickTrack = async () => {
      if (typeof window !== 'undefined' && !clickTrackGenerator) {
        try {
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          const generator = new ClickTrackGenerator(audioContext);
          setClickTrackGenerator(generator);
          console.log('🎯 Click track generator initialized in track manager');
        } catch (error) {
          console.error('Failed to initialize click track:', error);
        }
      }
    };
    
    initClickTrack();
    
    // Cleanup
    return () => {
      if (clickTrackGenerator) {
        clickTrackGenerator.destroy();
      }
    };
  }, [clickTrackGenerator]);

  // Enhanced play function with click track support
  const handlePlayWithClickTrack = useCallback(() => {
    if (!onPlay) return;

    // If click track is enabled and we have a generator
    if (clickTrackEnabled && clickTrackGenerator && bpm > 0) {
      const clickConfig: ClickTrackConfig = {
        bpm,
        countInMeasures,
        volume: clickVolume,
        enabled: true,
        accentDownbeat: true
      };

      console.log(`🎯 Starting ${countInMeasures} measure count-in at ${bpm} BPM`);
      
      // Start count-in, then start song
      clickTrackGenerator.startCountIn(clickConfig, () => {
        // Count-in complete, start the actual song
        onPlay();
        
        // Start continuous click track during playback
        if (clickTrackEnabled) {
          clickTrackGenerator.startContinuous(clickConfig);
        }
      });
    } else {
      // No click track, just start normally
      onPlay();
    }
  }, [onPlay, clickTrackEnabled, clickTrackGenerator, bpm, countInMeasures, clickVolume]);

  // Enhanced pause function with click track support
  const handlePauseWithClickTrack = useCallback(() => {
    if (!onPause) return;

    // Stop click track if active
    if (clickTrackGenerator) {
      clickTrackGenerator.stop();
    }
    
    // Pause the song
    onPause();
  }, [onPause, clickTrackGenerator]);

  // Load tracks from local storage
  useEffect(() => {
    if (song?.id && user?.email) {
      const localTracks = LocalSongStorage.getTracks(user.email, song.id);
      setTracks(localTracks);
      console.log(`Track Manager: Found ${localTracks.length} tracks for song ${song.title} (ID: ${song.id}):`, localTracks.map(t => t.name));
    }
  }, [song?.id, user?.email, song?.title]);

  const refetchTracks = useCallback(() => {
    if (song?.id && user?.email) {
      const localTracks = LocalSongStorage.getTracks(user.email, song.id);
      setTracks(localTracks);
      onTrackUpdate?.();
    }
  }, [song?.id, user?.email, onTrackUpdate]);

  // Function to detect audio duration and update song
  const detectAndUpdateSongDuration = async (audioFile: File, songId: string) => {
    if (!user?.email) return;
    
    try {
      // Create audio context for duration detection
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const arrayBuffer = await audioFile.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      const detectedDuration = Math.floor(audioBuffer.duration);
      console.log(`Detected audio duration: ${detectedDuration}s from file: ${audioFile.name}`);
      
      // Get current song to check if we need to update duration
      const currentSong = LocalSongStorage.getSong(user.email, songId);
      if (currentSong) {
        // Update song duration if this track is longer than current duration
        if (detectedDuration > (currentSong.duration || 0)) {
          console.log(`Updating song duration from ${currentSong.duration}s to ${detectedDuration}s`);
          LocalSongStorage.updateSong(user.email, songId, { duration: detectedDuration });
          
          // Trigger UI refresh
          onTrackUpdate?.();
        }
      }
      
      // Clean up audio context
      audioContext.close();
    } catch (error) {
      console.warn('Failed to detect audio duration:', error);
      // Continue without updating duration - not a critical error
    }
  };

  // Debounced volume update function
  const debouncedVolumeUpdate = useCallback((trackId: string, volume: number) => {
    // Clear existing timeout
    if (debounceTimeouts.current[`${trackId}-volume`]) {
      clearTimeout(debounceTimeouts.current[`${trackId}-volume`]);
    }
    
    // Immediately update audio engine for responsive feedback
    onTrackVolumeChange?.(trackId, volume);
    
    // Update local state immediately for UI responsiveness
    setLocalTrackValues(prev => ({
      ...prev,
      [trackId]: { ...prev[trackId], volume }
    }));
    
    // Debounce local storage update
    debounceTimeouts.current[`${trackId}-volume`] = setTimeout(async () => {
      if (song?.id && user?.email) {
        try {
          LocalSongStorage.updateTrack(user.email, song.id, trackId, { volume });
          console.log(`Updated track ${trackId} volume to ${volume}`);
        } catch (error) {
          console.error('Failed to update track volume:', error);
        }
      }
    }, 300);
  }, [onTrackVolumeChange, song?.id, user?.email]);

  // Debounced balance update function
  const debouncedBalanceUpdate = useCallback((trackId: string, balance: number) => {
    // Clear existing timeout
    if (debounceTimeouts.current[`${trackId}-balance`]) {
      clearTimeout(debounceTimeouts.current[`${trackId}-balance`]);
    }
    
    // Immediately update audio engine for responsive feedback
    onTrackBalanceChange?.(trackId, balance);
    
    // Update local state immediately for UI responsiveness
    setLocalTrackValues(prev => ({
      ...prev,
      [trackId]: { ...prev[trackId], balance }
    }));
    
    // Debounce local storage update
    debounceTimeouts.current[`${trackId}-balance`] = setTimeout(async () => {
      if (song?.id && user?.email) {
        try {
          LocalSongStorage.updateTrack(user.email, song.id, trackId, { balance });
          console.log(`Updated track ${trackId} balance to ${balance}`);
        } catch (error) {
          console.error('Failed to update track balance:', error);
        }
      }
    }, 300);
  }, [onTrackBalanceChange, song?.id, user?.email]);

  // Handle mute toggle with local storage (no refetch needed - causes loading dialog)
  const handleMuteToggle = useCallback((trackId: string) => {
    if (song?.id && user?.email) {
      const track = tracks.find(t => t.id === trackId);
      if (track) {
        const newMutedState = !track.isMuted;
        LocalSongStorage.updateTrack(user.email, song.id, trackId, { isMuted: newMutedState });
        onTrackMuteToggle?.(trackId);
        // Update local state immediately for UI responsiveness
        setTracks(prevTracks => 
          prevTracks.map(t => t.id === trackId ? { ...t, isMuted: newMutedState } : t)
        );
      }
    }
  }, [song?.id, user?.email, tracks, onTrackMuteToggle]);

  // Handle solo toggle with local storage (no refetch needed - causes loading dialog)
  const handleSoloToggle = useCallback((trackId: string) => {
    if (song?.id && user?.email) {
      const track = tracks.find(t => t.id === trackId);
      if (track) {
        const newSoloState = !track.isSolo;
        LocalSongStorage.updateTrack(user.email, song.id, trackId, { isSolo: newSoloState });
        onTrackSoloToggle?.(trackId);
        // Update local state immediately for UI responsiveness
        setTracks(prevTracks => 
          prevTracks.map(t => t.id === trackId ? { ...t, isSolo: newSoloState } : t)
        );
      }
    }
  }, [song?.id, user?.email, tracks, onTrackSoloToggle]);

  const addTrack = async (audioFileName: string, trackName: string, file: File) => {
    if (!song?.id || !user?.email) throw new Error('No song selected or user not authenticated');
    
    console.log(`Adding track "${trackName}" with file: ${audioFileName}`);
    
    try {
      const newTrack = LocalSongStorage.addTrack(user.email, song.id, {
        name: trackName,
        songId: song.id,
        trackNumber: tracks.length + 1,
        audioUrl: '', // Will be set when file is loaded
        localFileName: audioFileName,
        audioData: null,
        mimeType: file.type,
        fileSize: file.size,
        volume: 50,
        balance: 0,
        isMuted: false,
        isSolo: false
      });
      
      if (newTrack && typeof newTrack === 'object' && newTrack && 'id' in newTrack) {
        // Store the file in audio storage system
        const audioStorage = AudioFileStorage.getInstance();
        await audioStorage.storeAudioFile((newTrack as any).id, file, newTrack as any, song.title);
        
        // Detect and update song duration from the audio file
        await detectAndUpdateSongDuration(file, song.id);
        
        console.log('Track added successfully:', newTrack);
        refetchTracks();
        
        // Get updated song with new tracks and notify parent component
        const updatedSong = LocalSongStorage.getSong(user.email, song.id);
        if (updatedSong && onSongUpdate) {
          console.log('Track data updated, refreshing song with', updatedSong.tracks.length, 'tracks');
          onSongUpdate({ ...updatedSong, userId: user.email });
        }
        
        // Legacy callback for backward compatibility
        onTrackUpdate?.();
        
        // Clear cached waveform to force regeneration with new tracks
        if (song?.id) {
          const waveformCacheKey = `waveform_${song.id}`;
          localStorage.removeItem(waveformCacheKey);
          console.log(`Cleared waveform cache for "${song.title}" - will regenerate on next view`);
        }
        
        toast({
          title: "Track added successfully",
          description: "Audio track has been registered and is ready for use"
        });
        
        // Clear the form
        setTrackName("");
        setAudioFilePath("");
        setIsAddDialogOpen(false);
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
    if (!song?.id || !user?.email) return;
    
    try {
      const success = LocalSongStorage.deleteTrack(user.email, song.id, trackId);
      if (success) {
        refetchTracks();
        
        // Get updated song with removed track and notify parent component
        const updatedSong = LocalSongStorage.getSong(user.email, song.id);
        if (updatedSong && onSongUpdate) {
          console.log('Track deleted, refreshing song with', updatedSong.tracks.length, 'tracks');
          onSongUpdate({ ...updatedSong, userId: user.email });
        }
        
        // Legacy callback for backward compatibility
        onTrackUpdate?.();
        
        // Clear cached waveform to force regeneration with remaining tracks
        if (song?.id) {
          const waveformCacheKey = `waveform_${song.id}`;
          localStorage.removeItem(waveformCacheKey);
          console.log(`Cleared waveform cache for "${song.title}" - will regenerate on next view`);
        }
        
        toast({
          title: "Track deleted",
          description: "Audio track has been removed. Waveform will regenerate with remaining tracks."
        });
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
    if (tracks.length === 0 || !song?.id || !user?.email) return;

    try {
      // Delete all tracks
      for (const track of tracks) {
        LocalSongStorage.deleteTrack(user.email, song.id, track.id);
      }
      
      refetchTracks();
      
      // Notify parent component that song data has changed
      onTrackUpdate?.();
      
      // Clear cached waveform since all tracks are removed
      if (song?.id) {
        const waveformCacheKey = `waveform_${song.id}`;
        localStorage.removeItem(waveformCacheKey);
        console.log(`Cleared waveform cache for "${song.title}" - all tracks removed`);
      }
      
      toast({
        title: "Cleared all tracks",
        description: `Removed ${tracks.length} tracks. Ready to add fresh tracks.`
      });
    } catch (error) {
      toast({
        title: "Clear failed",
        description: "Failed to clear tracks",
        variant: "destructive"
      });
    }
  };

  const handleFileSelect = () => {
    // Use traditional file input for reliable file selection
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*,.mp3,.wav,.ogg,.m4a';
    input.multiple = true; // Allow multiple file selection
    
    input.onchange = (event) => {
      const files = Array.from((event.target as HTMLInputElement).files || []);
      
      if (files.length === 0) return;

      // Check track limit
      if (tracks.length + files.length > 6) {
        toast({
          title: "Too many tracks",
          description: `Can only add ${6 - tracks.length} more tracks. Maximum is 6 tracks per song.`,
          variant: "destructive"
        });
        return;
      }

      const validFiles: File[] = [];
      const invalidFiles: string[] = [];

      files.forEach(file => {
        // Check file type
        if (!file.type.startsWith('audio/') && 
            !['.mp3', '.wav', '.ogg', '.m4a'].some(ext => file.name.toLowerCase().endsWith(ext))) {
          invalidFiles.push(file.name);
          return;
        }

        // Check file size (limit to 100MB per file)
        if (file.size > 100 * 1024 * 1024) {
          invalidFiles.push(`${file.name} (too large)`);
          return;
        }

        validFiles.push(file);
      });

      if (invalidFiles.length > 0) {
        toast({
          title: "Some files skipped",
          description: `Invalid files: ${invalidFiles.join(', ')}`,
          variant: "destructive"
        });
      }

      if (validFiles.length === 0) return;

      setSelectedFiles(validFiles);
      setIsImporting(true);
      setTotalFiles(validFiles.length);
      setCurrentFileIndex(0);

      // Mobile devices: sequential processing with progress tracking
      // Desktop: parallel processing for speed
      if (isMobileDevice()) {
        console.log('📱 Mobile device detected - using sequential file processing');
        processFilesSequentiallyMobile(validFiles);
      } else {
        console.log('🖥️ Desktop device detected - using parallel file processing');
        processFilesParallel(validFiles);
      }
    };
    
    input.click();
  };

  const processFilesSequentiallyMobile = async (files: File[]) => {
    const results: { success: number; failed: string[] } = { success: 0, failed: [] };
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      try {
        console.log(`📱 Mobile processing file ${i + 1}/${files.length}: ${file.name}`);
        
        // Update progress for mobile UI
        setCurrentFileIndex(i + 1);
        setCurrentFileName(file.name);
        
        // Extract track name from filename (remove extension)
        const trackName = file.name.replace(/\.[^/.]+$/, "");
        
        // Add track to song with file object for now
        await addTrack(file.name, trackName, file);
        results.success++;
        
        console.log(`✅ Mobile processed: ${file.name}`);
        
        // Small delay to prevent mobile resource overload
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`❌ Mobile processing failed ${file.name}:`, error);
        results.failed.push(file.name);
      }
    }
    
    setIsImporting(false);
    setSelectedFiles([]);
    setCurrentFileIndex(0);
    setCurrentFileName("");
    
    // Show final results
    showProcessingResults(results);
  };

  const processFilesParallel = async (files: File[]) => {
    const results: { success: number; failed: string[] } = { success: 0, failed: [] };
    
    console.log(`🖥️ Desktop parallel processing ${files.length} files`);
    
    // Process all files in parallel for desktop speed
    const promises = files.map(async (file) => {
      try {
        // Extract track name from filename (remove extension)
        const trackName = file.name.replace(/\.[^/.]+$/, "");
        
        // Add track to song with file object for now
        await addTrack(file.name, trackName, file);
        return { success: true, fileName: file.name };
      } catch (error) {
        console.error(`❌ Desktop processing failed ${file.name}:`, error);
        return { success: false, fileName: file.name };
      }
    });
    
    const promiseResults = await Promise.all(promises);
    
    // Collect results
    promiseResults.forEach((result) => {
      if (result.success) {
        results.success++;
      } else {
        results.failed.push(result.fileName);
      }
    });
    
    setIsImporting(false);
    setSelectedFiles([]);
    
    console.log(`✅ Desktop parallel processing complete: ${results.success}/${files.length} successful`);
    
    // Show final results
    showProcessingResults(results);
  };

  const showProcessingResults = (results: { success: number; failed: string[] }) => {
    if (results.success > 0) {
      toast({
        title: `Added ${results.success} track${results.success > 1 ? 's' : ''}`,
        description: results.failed.length > 0 
          ? `${results.failed.length} files failed to process`
          : "All tracks added successfully"
      });
    }
    
    if (results.failed.length > 0 && results.success === 0) {
      toast({
        title: "Import failed",
        description: `Failed to process: ${results.failed.join(', ')}`,
        variant: "destructive"
      });
    }
  };

  // Rest of the component rendering code would go here...
  // For now, let's return a simple structure to test the core functionality

  return (
    <div className="space-y-4 relative">
      {/* Mobile Loading Files Overlay */}
      {isImporting && isMobileDevice() && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center">
          <div className="bg-surface border border-gray-700 rounded-lg p-8 text-center max-w-sm mx-4">
            <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-3 text-white">Loading Files</h3>
            <p className="text-gray-300 mb-4">
              Processing file {currentFileIndex} of {totalFiles}
            </p>
            {currentFileName && (
              <p className="text-sm text-gray-400 mb-4 truncate">
                {currentFileName}
              </p>
            )}
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-300" 
                style={{ width: `${totalFiles > 0 ? (currentFileIndex / totalFiles) * 100 : 0}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Please wait while files are copied to browser storage
            </p>
          </div>
        </div>
      )}

      {/* Desktop Loading Overlay */}
      {isImporting && !isMobileDevice() && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center rounded-lg">
          <div className="bg-surface border border-gray-700 rounded-lg p-6 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
            <h3 className="text-lg font-semibold mb-2">Processing Files...</h3>
            <p className="text-gray-300 text-sm">
              Adding {totalFiles} track{totalFiles > 1 ? 's' : ''} to song
            </p>
          </div>
        </div>
      )}

      {/* Track Loading Overlay */}
      {isLoadingTracks && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center rounded-lg">
          <div className="bg-surface border border-gray-700 rounded-lg p-6 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-3"></div>
            <h3 className="text-lg font-semibold mb-2">Loading Tracks...</h3>
            <p className="text-sm text-gray-400">Please wait while audio tracks are being loaded.</p>
            <p className="text-xs text-gray-500 mt-1">This may take longer on mobile devices.</p>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Music className="h-5 w-5" />
          Tracks ({tracks.length}/6)
        </h3>
        
        <div className="flex gap-2">
          {tracks.length > 0 && (
            <Button
              onClick={isPlaying ? handlePauseWithClickTrack : handlePlayWithClickTrack}
              variant={isPlaying ? "destructive" : "default"}
              size="sm"
              data-testid="button-play-pause"
            >
              {isPlaying ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
              {isPlaying ? 'Pause' : (clickTrackEnabled ? `Play (${countInMeasures}M Count)` : 'Play')}
            </Button>
          )}
          
          {/* Desktop buttons */}
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

          {/* Mobile buttons - more compact */}
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

      {/* BPM and Click Track Controls */}
      {/* Debug: Always show click track for now */}
      <div className="bg-red-500/20 border border-red-400 rounded-lg p-2 mb-2">
        <div className="text-xs text-red-300">
          DEBUG: Song prop = {song ? `"${song.title}" (id: ${song.id})` : 'null/undefined'}
        </div>
      </div>
      {true && (
        <div className="bg-slate-800/30 border border-slate-600 rounded-lg p-4 mt-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-orange-500" />
            <span className="text-sm font-medium">Click Track</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* BPM Input */}
            <div className="space-y-2">
              <Label htmlFor="bpm-input" className="text-xs text-gray-400">BPM (Beats Per Minute)</Label>
              <Input
                id="bpm-input"
                type="number"
                min="60"
                max="200"
                value={bpm}
                onChange={(e) => handleBPMChange(Number(e.target.value))}
                className="h-8 text-sm"
                data-testid="input-bpm"
              />
            </div>

            {/* Click Track Enable Toggle */}
            <div className="space-y-2">
              <Label className="text-xs text-gray-400">Enable Click Track</Label>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={clickTrackEnabled}
                  onCheckedChange={setClickTrackEnabled}
                  data-testid="switch-click-track"
                />
                <span className="text-xs text-gray-400">
                  {clickTrackEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>

            {/* Count-in Selector */}
            <div className="space-y-2">
              <Label className="text-xs text-gray-400">Count-in (Measures)</Label>
              <Select value={countInMeasures.toString()} onValueChange={(value) => setCountInMeasures(Number(value) as 1 | 2 | 3 | 4)}>
                <SelectTrigger className="h-8" data-testid="select-count-in">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 Measure</SelectItem>
                  <SelectItem value="2">2 Measures</SelectItem>
                  <SelectItem value="3">3 Measures</SelectItem>
                  <SelectItem value="4">4 Measures</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Click Volume Control */}
            <div className="space-y-2">
              <Label className="text-xs text-gray-400">Click Volume</Label>
              <div className="flex items-center gap-2">
                <Slider
                  value={[clickVolume * 100]}
                  onValueChange={(value) => setClickVolume(value[0] / 100)}
                  min={0}
                  max={100}
                  step={5}
                  className="flex-1"
                  data-testid="slider-click-volume"
                />
                <span className="text-xs text-gray-400 w-8 text-right">
                  {Math.round(clickVolume * 100)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      )}


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
        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
          {tracks.map((track) => {
            const currentVolume = localTrackValues[track.id]?.volume ?? track.volume ?? 50;
            const currentBalance = localTrackValues[track.id]?.balance ?? track.balance ?? 0;
            const isMuted = track.isMuted ?? false;
            const isSolo = track.isSolo ?? false;
            const rawLevel = audioLevels[track.id] || 0;
            // Apply balanced amplification for good VU meter visibility
            // Provides clear meter response without excessive sensitivity
            const level = rawLevel * 12;
            
            return (
              <Card key={track.id}>
                <CardContent className="p-4">
                  <div className="space-y-3">
                    {/* Track header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <File className="h-5 w-5 text-blue-500" />
                        <div>
                          <p className="font-medium">{track.name}</p>
                          <p className="text-xs text-gray-500">{track.localFileName || 'No file connected'}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 mobile-hidden">
                        <Button
                          onClick={() => deleteTrack(track.id)}
                          variant="ghost"
                          size="sm"
                          data-testid={`button-delete-track-${track.id}-desktop`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Track controls */}
                    {/* Desktop Layout */}
                    <div className="hidden md:block">
                      <div className="grid grid-cols-12 gap-2 items-center">
                        {/* Mute/Solo buttons */}
                        <div className="col-span-2 flex gap-1">
                          <Button
                            onClick={() => handleMuteToggle(track.id)}
                            variant={isMuted ? "destructive" : "outline"}
                            size="sm"
                            className="h-8 w-12 text-xs"
                            data-testid={`button-mute-${track.id}`}
                          >
                            {isMuted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
                          </Button>
                          <Button
                            onClick={() => handleSoloToggle(track.id)}
                            variant={isSolo ? "default" : "outline"}
                            size="sm"
                            className="h-8 w-12 text-xs"
                            data-testid={`button-solo-${track.id}`}
                          >
                            <Headphones className="h-3 w-3" />
                          </Button>
                        </div>

                        {/* Volume control */}
                        <div className="col-span-4">
                          <div className="flex items-center gap-2">
                            <Volume2 className="h-4 w-4 text-gray-500" />
                            <Slider
                              value={[currentVolume]}
                              onValueChange={(value) => debouncedVolumeUpdate(track.id, value[0])}
                              min={0}
                              max={100}
                              step={1}
                              className="flex-1"
                              data-testid={`slider-volume-${track.id}`}
                            />
                            <span className="text-xs text-gray-500 w-8">{Math.round(currentVolume)}</span>
                          </div>
                        </div>

                        {/* Balance control */}
                        <div className="col-span-4">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">L</span>
                            <Slider
                              value={[currentBalance]}
                              onValueChange={(value) => debouncedBalanceUpdate(track.id, value[0])}
                              min={-100}
                              max={100}
                              step={1}
                              className="flex-1"
                              data-testid={`slider-balance-${track.id}`}
                            />
                            <span className="text-xs text-gray-500">R</span>
                          </div>
                        </div>

                        {/* VU Meter */}
                        <div className="col-span-2">
                          <VUMeter
                            level={level}
                            isMuted={isMuted}
                            isPlaying={isPlaying}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Mobile Layout - Compact Vertical */}
                    <div className="block md:hidden">
                      <div className="space-y-1">
                        {/* Top row: Mute/Solo buttons and sliders */}
                        <div className="flex items-start gap-2">
                          {/* Left: Mute/Solo buttons */}
                          <div className="flex flex-col gap-1 flex-shrink-0">
                            <Button
                              onClick={() => handleMuteToggle(track.id)}
                              variant={isMuted ? "destructive" : "outline"}
                              size="sm"
                              className="h-8 w-8 p-0"
                              data-testid={`button-mute-${track.id}`}
                            >
                              {isMuted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
                            </Button>
                            <Button
                              onClick={() => handleSoloToggle(track.id)}
                              variant={isSolo ? "default" : "outline"}
                              size="sm"
                              className="h-8 w-8 p-0"
                              data-testid={`button-solo-${track.id}`}
                            >
                              <Headphones className="h-3 w-3" />
                            </Button>
                          </div>

                          {/* Center: Stacked Volume/Balance - fill available space */}
                          <div className="flex-1 space-y-2 min-w-0">
                            {/* Volume control */}
                            <div className="flex items-center gap-1">
                              <Volume2 className="h-3 w-3 text-gray-500 flex-shrink-0" />
                              <Slider
                                value={[currentVolume]}
                                onValueChange={(value) => debouncedVolumeUpdate(track.id, value[0])}
                                min={0}
                                max={100}
                                step={1}
                                className="flex-1"
                                data-testid={`slider-volume-${track.id}`}
                              />
                              <span className="text-xs text-gray-500 w-6 text-right">{Math.round(currentVolume)}</span>
                            </div>
                            
                            {/* Balance control */}
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-gray-500 flex-shrink-0">L</span>
                              <Slider
                                value={[currentBalance]}
                                onValueChange={(value) => debouncedBalanceUpdate(track.id, value[0])}
                                min={-100}
                                max={100}
                                step={1}
                                className="flex-1"
                                data-testid={`slider-balance-${track.id}`}
                              />
                              <span className="text-xs text-gray-500 flex-shrink-0">R</span>
                            </div>
                          </div>
                        </div>

                        {/* Bottom row: VU Meter and Delete button - closer to balance slider */}
                        <div className="flex items-center gap-2 pt-0.5">
                          <div className="flex-1 min-w-0">
                            <VUMeter
                              level={level}
                              isMuted={isMuted}
                              isPlaying={isPlaying}
                              className="w-full"
                            />
                          </div>
                          <Button
                            onClick={() => deleteTrack(track.id)}
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 flex-shrink-0"
                            data-testid={`button-delete-track-${track.id}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
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