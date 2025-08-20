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
import { Plus, FolderOpen, Music, Trash2, Volume2, File, VolumeX, Headphones, Play, Pause, AlertTriangle } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import VUMeter from "@/components/vu-meter";
import { TrackRecovery } from "@/components/track-recovery";

import type { Track, SongWithTracks } from "@shared/schema";

interface TrackManagerProps {
  song?: SongWithTracks;
  onTrackUpdate?: () => void;
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
  const [localTrackValues, setLocalTrackValues] = useState<Record<string, { volume: number; balance: number }>>({});

  const { toast } = useToast();
  const { user } = useLocalAuth();
  const debounceTimeouts = useRef<Record<string, NodeJS.Timeout>>({});
  const [tracks, setTracks] = useState<Track[]>([]);

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
      
      if (newTrack) {
        // Store the file in audio storage system
        const audioStorage = AudioFileStorage.getInstance();
        await audioStorage.storeAudioFile(newTrack.id, file, newTrack, song.title);
        
        console.log('Track added successfully:', newTrack);
        refetchTracks();
        
        // Notify parent component that song data has changed
        onTrackUpdate?.();
        
        // Add small delay then notify again to ensure audio engine reloads
        setTimeout(() => {
          console.log('Track data updated, refreshing song...');
          onTrackUpdate?.();
        }, 100);
        
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
        
        // Notify parent component that song data has changed
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

      // Process files sequentially to avoid overwhelming the system
      processFilesSequentially(validFiles);
    };
    
    input.click();
  };

  const processFilesSequentially = async (files: File[]) => {
    const results: { success: number; failed: string[] } = { success: 0, failed: [] };
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      try {
        console.log(`Processing file ${i + 1}/${files.length}: ${file.name}`);
        
        // Extract track name from filename (remove extension)
        const trackName = file.name.replace(/\.[^/.]+$/, "");
        
        // Add track to song with file object for now
        await addTrack(file.name, trackName, file);
        results.success++;
        
        console.log(`Successfully processed: ${file.name}`);
        
      } catch (error) {
        console.error(`Failed to process ${file.name}:`, error);
        results.failed.push(file.name);
      }
    }
    
    setIsImporting(false);
    setSelectedFiles([]);
    
    // Show final results
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
      {/* Loading Overlay */}
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
              onClick={isPlaying ? onPause : onPlay}
              variant={isPlaying ? "destructive" : "default"}
              size="sm"
              data-testid="button-play-pause"
            >
              {isPlaying ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
              {isPlaying ? 'Pause' : 'Play'}
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
        <div className="space-y-2">
          {tracks.map((track) => {
            const currentVolume = localTrackValues[track.id]?.volume ?? track.volume ?? 50;
            const currentBalance = localTrackValues[track.id]?.balance ?? track.balance ?? 0;
            const isMuted = track.isMuted ?? false;
            const isSolo = track.isSolo ?? false;
            const rawLevel = audioLevels[track.id] || 0;
            // Apply minimal amplification for natural VU meter response
            // Provides realistic meter behavior with subtle movement
            const level = rawLevel * 10;
            
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