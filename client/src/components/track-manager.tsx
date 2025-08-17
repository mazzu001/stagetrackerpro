import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Plus, FolderOpen, Music, Trash2, Volume2, File } from "lucide-react";
import type { Track, SongWithTracks } from "@shared/schema";

interface TrackManagerProps {
  song?: SongWithTracks;
  onTrackUpdate?: () => void;
}

export default function TrackManager({ song, onTrackUpdate }: TrackManagerProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [trackName, setTrackName] = useState("");
  const [audioFilePath, setAudioFilePath] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [estimatedDuration, setEstimatedDuration] = useState(0);
  const [isImporting, setIsImporting] = useState(false);

  const { toast } = useToast();

  const { data: tracks = [] } = useQuery<Track[]>({
    queryKey: ['/api/songs', song?.id, 'tracks'],
    enabled: !!song?.id
  });

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
      toast({
        title: "Track added",
        description: "Audio track has been added successfully."
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
      toast({
        title: "Track deleted",
        description: "Audio track has been removed."
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

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const objectUrl = URL.createObjectURL(file);
        
        // For single file, use the provided name; for multiple files, use filename
        const name = selectedFiles.length === 1 ? trackName : file.name.replace(/\.[^/.]+$/, "");
        
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
            });
          } catch {
            duration = 180 + Math.floor(Math.random() * 120);
          }
        }
        
        const trackData = {
          name,
          trackNumber: tracks.length + i + 1,
          audioUrl: objectUrl,
          localFileName: file.name,
          duration,
          volume: 100,
          isMuted: false,
          isSolo: false
        };

        await new Promise((resolve, reject) => {
          addTrackMutation.mutate(trackData, {
            onSuccess: resolve,
            onError: reject
          });
        });
      }

      toast({
        title: "Tracks imported",
        description: `Successfully imported ${selectedFiles.length} track${selectedFiles.length > 1 ? 's' : ''}`,
      });
    } catch (error) {
      toast({
        title: "Import failed",
        description: "Some tracks failed to import",
        variant: "destructive"
      });
    } finally {
      setIsImporting(false);
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
    <div className="bg-surface rounded-xl p-6 border border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold flex items-center">
          <Music className="mr-2 text-primary w-5 h-5" />
          Track Manager
          <span className="ml-2 text-sm text-gray-400">({tracks.length}/6)</span>
        </h2>
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
          <p className="text-xs mt-1">Files will be referenced from your local system</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tracks.map((track, index) => (
            <Card
              key={track.id}
              className="bg-gray-800 border border-gray-600 hover:bg-gray-750 transition-colors"
              data-testid={`track-item-${track.trackNumber}`}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="bg-primary/20 text-primary px-2 py-1 rounded text-sm font-medium">
                      {track.trackNumber}
                    </div>
                    <div>
                      <h4 className="font-medium">{track.name}</h4>
                      <div className="text-sm text-gray-400 flex items-center space-x-4">
                        <span>Volume: {track.volume}%</span>
                        {track.isMuted && <span className="text-error">MUTED</span>}
                        {track.isSolo && <span className="text-secondary">SOLO</span>}
                      </div>
                      <div className="text-xs text-gray-500 font-mono mt-1 truncate">
                        {(track as any).localFileName || track.audioUrl}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Volume2 className="w-4 h-4 text-gray-400" />
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
              </CardContent>
            </Card>
          ))}
        </div>
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