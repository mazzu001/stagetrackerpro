import { useState, useCallback, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { AudioFileStorage } from "@/lib/audio-file-storage";
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
  const debounceTimeouts = useRef<Record<string, NodeJS.Timeout>>({});

  const { data: tracks = [], refetch: refetchTracks } = useQuery<Track[]>({
    queryKey: ['/api/songs', song?.id, 'tracks'],
    enabled: !!song?.id,
    staleTime: 0, // Force fresh data
    gcTime: 0, // Don't cache results
    refetchOnMount: true,
    refetchOnWindowFocus: true
  });

  // Debug: Log tracks data when it changes
  console.log(`Track Manager: Found ${tracks.length} tracks for song ${song?.title} (ID: ${song?.id}):`, tracks.map(t => t.name));
  console.log('Query enabled:', !!song?.id, 'Song object:', song);

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
    
    // Debounce database update
    debounceTimeouts.current[`${trackId}-volume`] = setTimeout(async () => {
      try {
        await apiRequest('PATCH', `/api/tracks/${trackId}`, { volume });
        console.log(`Updated track ${trackId} volume to ${volume}`);
      } catch (error) {
        console.error('Failed to update track volume:', error);
      }
    }, 300);
  }, [onTrackVolumeChange]);

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
    
    // Debounce database update
    debounceTimeouts.current[`${trackId}-balance`] = setTimeout(async () => {
      try {
        await apiRequest('PATCH', `/api/tracks/${trackId}`, { balance });
        console.log(`Updated track ${trackId} balance to ${balance}`);
      } catch (error) {
        console.error('Failed to update track balance:', error);
      }
    }, 300);
  }, [onTrackBalanceChange]);

  const addTrackMutation = useMutation({
    mutationFn: async (trackData: any) => {
      const response = await apiRequest('POST', `/api/songs/${song?.id}/tracks`, trackData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/songs', song?.id, 'tracks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/songs', song?.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/songs'] });
      setIsAddDialogOpen(false);
      setTrackName("");
      setAudioFilePath("");
      setSelectedFiles([]);
      setEstimatedDuration(0);
      onTrackUpdate?.();
      
      // Clear cached waveform to force regeneration with new tracks
      if (song?.id) {
        const waveformCacheKey = `waveform_${song.id}`;
        localStorage.removeItem(waveformCacheKey);
        console.log(`Cleared waveform cache for "${song.title}" - will regenerate on next view`);
      }
      
      toast({
        title: "Track added",
        description: "Audio track has been added successfully. Waveform will regenerate with all tracks."
      });
    },
    onError: (error) => {
      toast({
        title: "Add track failed",
        description: error instanceof Error ? error.message : "Failed to add track",
        variant: "destructive"
      });
    }
  });

  const deleteTrackMutation = useMutation({
    mutationFn: async (trackId: string) => {
      const response = await apiRequest('DELETE', `/api/tracks/${trackId}`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/songs', song?.id, 'tracks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/songs', song?.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/songs'] });
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
    },
    onError: (error) => {
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Failed to delete track",
        variant: "destructive"
      });
    }
  });

  const handleClearBrokenTracks = async () => {
    if (tracks.length === 0) return;

    try {
      // Delete all tracks in parallel
      await Promise.all(
        tracks.map(track => 
          apiRequest('DELETE', `/api/tracks/${track.id}`)
        )
      );
      
      // Refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/songs', song?.id, 'tracks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/songs', song?.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/songs'] });
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
      const allowedTypes = ['audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a', 'audio/mpeg', 'audio/x-m4a'];
      
      for (const file of files) {
        // Validate file type
        const isValidType = allowedTypes.includes(file.type) || file.name.match(/\.(mp3|wav|ogg|m4a)$/i);
        
        if (!isValidType) {
          toast({
            title: "Invalid file type",
            description: `${file.name} is not a supported audio format`,
            variant: "destructive"
          });
          continue;
        }

        // Validate file size (50MB limit)
        if (file.size > 50 * 1024 * 1024) {
          toast({
            title: "File too large",
            description: `${file.name} is larger than 50MB`,
            variant: "destructive"
          });
          continue;
        }

        validFiles.push(file);
      }

      if (validFiles.length === 0) {
        toast({
          title: "No valid files",
          description: "Please select valid audio files (MP3, WAV, OGG, or M4A)",
          variant: "destructive"
        });
        return;
      }

      setSelectedFiles(validFiles);
      
      if (validFiles.length === 1) {
        // Single file - populate the form for manual editing
        const file = validFiles[0];
        setAudioFilePath(file.name);
        setTrackName(file.name.replace(/\.[^/.]+$/, ""));
        
        // Try to get duration from the audio file
        const audioUrl = URL.createObjectURL(file);
        const audio = new Audio(audioUrl);
        
        audio.onloadedmetadata = () => {
          setEstimatedDuration(Math.round(audio.duration));
          URL.revokeObjectURL(audioUrl);
        };
        
        audio.onerror = () => {
          setEstimatedDuration(180 + Math.floor(Math.random() * 120));
          URL.revokeObjectURL(audioUrl);
        };
      } else {
        // Multiple files - show summary
        setAudioFilePath(`${validFiles.length} files selected`);
        setTrackName("");
        setEstimatedDuration(0);
      }
    };
    
    input.click();
  };

  const handleAddTracks = async () => {
    console.log(`Starting track upload for ${selectedFiles.length} files`);
    
    if (selectedFiles.length === 0 || !song) {
      toast({
        title: "Validation Error",
        description: "Please select audio files",
        variant: "destructive"
      });
      return;
    }

    if (selectedFiles.length === 1 && !trackName.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a track name",
        variant: "destructive"
      });
      return;
    }

    if (tracks.length + selectedFiles.length > 6) {
      toast({
        title: "Maximum tracks reached",
        description: "You can only have up to 6 backing tracks per song",
        variant: "destructive"
      });
      return;
    }

    setIsImporting(true);

    const results = {
      successful: 0,
      failed: 0,
      errors: [] as string[]
    };

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        
        try {
          // For single file, use the provided name; for multiple files, use filename
          const name = selectedFiles.length === 1 ? trackName : file.name.replace(/\.[^/.]+$/, "");
          
          console.log(`Processing file ${i + 1}/${selectedFiles.length}: ${name}`);
          
          // Get duration from file
          let duration = estimatedDuration;
          if (selectedFiles.length > 1 || duration === 0) {
            try {
              const audioUrl = URL.createObjectURL(file);
              const audio = new Audio(audioUrl);
              duration = await new Promise<number>((resolve) => {
                audio.onloadedmetadata = () => {
                  resolve(Math.round(audio.duration));
                  URL.revokeObjectURL(audioUrl);
                };
                audio.onerror = () => {
                  resolve(180 + Math.floor(Math.random() * 120));
                  URL.revokeObjectURL(audioUrl);
                };
                // Add timeout to prevent hanging
                setTimeout(() => {
                  resolve(180 + Math.floor(Math.random() * 120));
                  URL.revokeObjectURL(audioUrl);
                }, 5000);
              });
            } catch {
              duration = 180 + Math.floor(Math.random() * 120);
            }
          }
          
          // Create track with placeholder URL (will be replaced with actual audio data)
          const trackData = {
            name,
            trackNumber: tracks.length + i + 1,
            audioUrl: `stored:${name}`, // Placeholder - will be replaced with actual blob URL
            localFileName: file.name,
            duration,
            volume: 100,
            isMuted: false,
            isSolo: false
          };

          console.log(`Creating track for: ${name}, size: ${file.size} bytes`);
          
          // Create track and upload file
          const createdTrack = await new Promise<any>((resolve, reject) => {
            addTrackMutation.mutate(trackData, {
              onSuccess: (track) => {
                console.log(`Track created successfully: ${track.id}`);
                resolve(track);
              },
              onError: (error) => {
                console.error(`Failed to create track for ${name}:`, error);
                reject(error);
              }
            });
          });

          // Store audio file in local file storage for fast access
          console.log(`Storing audio file locally for track: ${createdTrack.id}`);
          const audioStorage = AudioFileStorage.getInstance();
          await audioStorage.storeAudioFile(createdTrack.id, file);
          
          console.log(`Successfully stored audio locally for track: ${name}`);
          results.successful++;
          
          // Small delay to prevent overwhelming the server
          await new Promise(resolve => setTimeout(resolve, 200));
          
        } catch (error) {
          console.error(`Failed to process file ${file.name}:`, error);
          results.failed++;
          results.errors.push(`${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Refresh data after all uploads - force complete cache invalidation
      queryClient.removeQueries({ queryKey: ['/api/songs', song.id, 'tracks'] });
      queryClient.removeQueries({ queryKey: ['/api/songs', song.id] });
      queryClient.removeQueries({ queryKey: ['/api/songs'] });
      
      // Force immediate refetch
      await refetchTracks();
      
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ['/api/songs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/songs', song.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/songs', song.id, 'tracks'] });

      // Show appropriate toast based on results
      if (results.successful > 0 && results.failed === 0) {
        toast({
          title: "Tracks imported",
          description: `Successfully imported ${results.successful} track${results.successful > 1 ? 's' : ''}`,
        });
      } else if (results.successful > 0 && results.failed > 0) {
        toast({
          title: "Partial import",
          description: `Successfully imported ${results.successful} track${results.successful > 1 ? 's' : ''}, ${results.failed} failed`,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Import failed",
          description: "All track imports failed",
          variant: "destructive"
        });
      }

      // Show detailed errors if any
      if (results.errors.length > 0) {
        console.error('Import errors:', results.errors);
      }

    } catch (error) {
      console.error('Overall import error:', error);
      toast({
        title: "Import failed",
        description: "Failed to import tracks",
        variant: "destructive"
      });
    } finally {
      setIsImporting(false);
      
      // Reset form if successful
      if (results.successful > 0) {
        setSelectedFiles([]);
        setAudioFilePath("");
        setTrackName("");
        setEstimatedDuration(0);
      }
    }
  };



  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!song) {
    return (
      <div className="bg-surface rounded-xl p-6 border border-gray-700">
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <Music className="mr-2 text-primary w-5 h-5" />
          Track Manager
        </h2>
        <div className="text-center py-8 text-gray-400">
          Select a song to manage backing tracks
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-xl p-4 border border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <h2 className="text-lg font-semibold flex items-center">
            <Music className="mr-2 text-primary w-5 h-5" />
            Track Manager
            <span className="ml-2 text-sm text-gray-400">({tracks.length}/6)</span>
          </h2>
        </div>
        <div className="flex items-center space-x-2">
          {tracks.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleClearBrokenTracks()}
                className="h-8 px-2 text-red-400 hover:bg-red-900/20 hover:text-red-300"
                title="Clear all tracks and start fresh"
                data-testid="button-clear-all-tracks"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Clear All
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                console.log('Manual refresh clicked for song:', song.id);
                refetchTracks();
                queryClient.invalidateQueries({ queryKey: ['/api/songs', song.id, 'tracks'] });
              }}
              className="h-8 px-2 text-blue-400 hover:bg-blue-900/20 hover:text-blue-300"
              title="Refresh track list"
              data-testid="button-refresh-tracks"
            >
              <FolderOpen className="w-4 h-4 mr-1" />
              Refresh
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleFileSelect}
              className="h-8 px-2 text-green-400 hover:bg-green-900/20 hover:text-green-300"
              disabled={tracks.length >= 6}
              title="Add multiple audio tracks"
              data-testid="button-add-tracks"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Tracks
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={isPlaying ? onPause : onPlay}
              className="h-8 w-8 p-0 hover:bg-gray-700"
              disabled={!onPlay || !onPause}
              data-testid="button-track-manager-play-pause"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </Button>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              className="bg-primary hover:bg-blue-700 px-4 py-2 text-sm"
              disabled={tracks.length >= 6}
              data-testid="button-add-track"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Track
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-surface border-gray-700 max-w-md">
            <DialogHeader>
              <DialogTitle>Add Backing Track</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="audioFile">Audio File *</Label>
                <div className="mt-2 space-y-2">
                  <Button
                    variant="outline"
                    onClick={handleFileSelect}
                    className="w-full justify-start"
                    data-testid="button-select-file"
                  >
                    <FolderOpen className="w-4 h-4 mr-2" />
                    {audioFilePath ? "Change files" : "Select audio files"}
                  </Button>
                  {audioFilePath && (
                    <div className="bg-gray-800 p-3 rounded border border-gray-600">
                      <div className="flex items-center space-x-2">
                        <File className="w-4 h-4 text-primary" />
                        <span className="text-sm font-mono text-gray-300 break-all">{audioFilePath}</span>
                      </div>
                      {selectedFiles.length > 1 && (
                        <div className="mt-2 space-y-1">
                          {selectedFiles.map((file, index) => (
                            <div key={index} className="text-xs text-gray-400">
                              {index + 1}. {file.name}
                            </div>
                          ))}
                        </div>
                      )}
                      {estimatedDuration > 0 && selectedFiles.length === 1 && (
                        <div className="text-xs text-gray-400 mt-1">
                          Duration: {formatDuration(estimatedDuration)}
                        </div>
                      )}
                      <div className="text-xs text-gray-500 mt-1">
                        {selectedFiles.length === 1 ? "File will be referenced locally" : "All files will be imported as separate tracks"}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {selectedFiles.length === 1 && (
                <div>
                  <Label htmlFor="trackName">Track Name *</Label>
                  <Input
                    id="trackName"
                    value={trackName}
                    onChange={(e) => setTrackName(e.target.value)}
                    placeholder="e.g., Bass, Drums, Guitar..."
                    data-testid="input-track-name"
                  />
                </div>
              )}

              {selectedFiles.length > 1 && (
                <div className="bg-blue-900/20 border border-blue-700 rounded p-3">
                  <div className="text-sm text-blue-200">
                    <strong>Batch Import Mode</strong>
                  </div>
                  <div className="text-xs text-blue-300 mt-1">
                    Each file will be imported as a separate track using its filename
                  </div>
                </div>
              )}

              {selectedFiles.length === 1 && (
                <div>
                  <Label htmlFor="duration">Duration (seconds)</Label>
                  <Input
                    id="duration"
                    type="number"
                    value={estimatedDuration}
                    onChange={(e) => setEstimatedDuration(parseInt(e.target.value) || 0)}
                    placeholder="180"
                    data-testid="input-track-duration"
                  />
                  <div className="text-xs text-gray-400 mt-1">
                    Leave as 0 to auto-detect from file
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-2">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setIsAddDialogOpen(false);
                    setTrackName("");
                    setAudioFilePath("");
                    setSelectedFiles([]);
                    setEstimatedDuration(0);
                  }}
                  disabled={addTrackMutation.isPending || isImporting}
                  data-testid="button-cancel-track"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleAddTracks}
                  disabled={addTrackMutation.isPending || isImporting || selectedFiles.length === 0}
                  data-testid="button-add-track"
                >
                  {isImporting ? "Importing..." : selectedFiles.length > 1 ? `Import ${selectedFiles.length} Tracks` : "Add Track"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {tracks.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <Music className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No backing tracks yet. Add your first track to get started.</p>
          <p className="text-sm mt-2">Supported formats: MP3, WAV, OGG, M4A</p>
          <p className="text-xs mt-1">Files stay on your device - no uploads, completely offline</p>
        </div>
      ) : (
        <>
          {/* Show warning for tracks that need to be re-added */}
          {tracks.some(track => track.audioUrl && !(track as any).hasAudioData) && (
            <div className="bg-blue-900/20 border border-blue-500 rounded-lg p-4 mb-4">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="space-y-2">
                  <h4 className="text-blue-300 font-medium">Tracks Need File Re-selection</h4>
                  <p className="text-blue-200 text-sm">
                    Some tracks can't load their audio files and won't play. To fix this:
                  </p>
                  <ol className="text-blue-200 text-sm space-y-1 ml-4">
                    <li>1. Delete the affected tracks using the trash icon</li>
                    <li>2. Add them again by selecting your local audio files</li>
                    <li>3. Your local files are safe - only the app references need updating</li>
                  </ol>
                  <p className="text-blue-300 text-xs">
                    New tracks added now will persist properly across app restarts.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          <div className="space-y-3">
            {tracks.map((track, index) => (
            <Card
              key={track.id}
              className="bg-gray-800 border border-gray-600 hover:bg-gray-750 transition-colors"
              data-testid={`track-item-${track.trackNumber}`}
            >
              <CardContent className="p-4">
                <div className="space-y-4">
                  {/* Track Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="bg-primary/20 text-primary px-2 py-1 rounded text-sm font-medium">
                        {track.trackNumber}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <h4 className="font-medium">{track.name}</h4>
                          {/* VU Meter */}
                          <VUMeter 
                            level={audioLevels[track.id] || 0}
                            isMuted={track.isMuted || false}
                            className="flex-shrink-0"
                          />
                        </div>
                        {(track as any).localFileName && (
                          <div className="text-xs text-gray-500 font-mono mt-1 truncate">
                            {(track as any).localFileName}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Button
                        variant={track.isSolo ? "default" : "secondary"}
                        size="sm"
                        className={`w-8 h-8 rounded-full p-0 ${
                          track.isSolo 
                            ? 'bg-secondary hover:bg-green-700' 
                            : 'bg-gray-600 hover:bg-secondary'
                        }`}
                        title="Solo"
                        onClick={() => onTrackSoloToggle?.(track.id)}
                        data-testid={`button-solo-${track.trackNumber}`}
                      >
                        <Headphones className="w-3 h-3" />
                      </Button>
                      <Button
                        variant={track.isMuted ? "destructive" : "secondary"}
                        size="sm"
                        className={`w-8 h-8 rounded-full p-0 ${
                          track.isMuted 
                            ? 'bg-error hover:bg-red-700' 
                            : 'bg-gray-600 hover:bg-error'
                        }`}
                        title="Mute"
                        onClick={() => onTrackMuteToggle?.(track.id)}
                        data-testid={`button-mute-${track.trackNumber}`}
                      >
                        {track.isMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteTrackMutation.mutate(track.id)}
                        disabled={deleteTrackMutation.isPending}
                        className="bg-error hover:bg-red-700 p-2"
                        title="Delete track"
                        data-testid={`button-delete-track-${track.trackNumber}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Volume Control */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm flex items-center">
                        <Volume2 className="w-3 h-3 mr-1" />
                        Volume
                      </Label>
                      <span className={`text-sm ${track.isMuted ? 'text-error' : 'text-gray-400'}`}>
                        {track.isMuted ? 'MUTED' : `${(localTrackValues[track.id]?.volume ?? track.volume) || 100}%`}
                      </span>
                    </div>
                    <Slider
                      value={[localTrackValues[track.id]?.volume ?? (track.volume || 100)]}
                      max={100}
                      step={1}
                      disabled={!!track.isMuted}
                      onValueChange={([value]) => debouncedVolumeUpdate(track.id, value)}
                      className={`w-full ${track.isMuted ? 'opacity-50' : ''}`}
                      data-testid={`slider-volume-${track.trackNumber}`}
                    />
                  </div>

                  {/* Balance Control */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Balance</Label>
                      <span className="text-sm text-gray-400">
                        {(() => {
                          const balance = localTrackValues[track.id]?.balance ?? ((track as any).balance || 0);
                          return balance === 0 ? 'Center' : balance > 0 ? `R${balance}` : `L${Math.abs(balance)}`;
                        })()}
                      </span>
                    </div>
                    <Slider
                      value={[localTrackValues[track.id]?.balance ?? ((track as any).balance || 0)]}
                      min={-50}
                      max={50}
                      step={1}
                      disabled={!!track.isMuted}
                      onValueChange={([value]) => debouncedBalanceUpdate(track.id, value)}
                      className={`w-full ${track.isMuted ? 'opacity-50' : ''}`}
                      data-testid={`slider-balance-${track.trackNumber}`}
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>L</span>
                      <span>Center</span>
                      <span>R</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          </div>
        </>
      )}

      {tracks.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-600">
          <div className="text-sm text-gray-400">
            <div className="flex justify-between items-center">
              <span>Total tracks: {tracks.length}/6</span>
              <span>Song duration based on longest local track file</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}