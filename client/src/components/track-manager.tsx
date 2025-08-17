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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [estimatedDuration, setEstimatedDuration] = useState(0);

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
      setSelectedFile(null);
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
    
    input.onchange = (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (file) {
        // Validate file type
        const allowedTypes = ['audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a', 'audio/mpeg', 'audio/x-m4a'];
        const isValidType = allowedTypes.includes(file.type) || file.name.match(/\.(mp3|wav|ogg|m4a)$/i);
        
        if (!isValidType) {
          toast({
            title: "Invalid file type",
            description: "Please select an audio file (MP3, WAV, OGG, or M4A)",
            variant: "destructive"
          });
          return;
        }

        // Validate file size (50MB limit)
        if (file.size > 50 * 1024 * 1024) {
          toast({
            title: "File too large",
            description: "Please select a file smaller than 50MB",
            variant: "destructive"
          });
          return;
        }

        // Store the actual file object and display name
        setSelectedFile(file);
        setAudioFilePath(file.name); // Use file name for display
        setTrackName(file.name.replace(/\.[^/.]+$/, "")); // Remove file extension
        
        // Try to get duration from the audio file
        const audioUrl = URL.createObjectURL(file);
        const audio = new Audio(audioUrl);
        
        audio.onloadedmetadata = () => {
          setEstimatedDuration(Math.round(audio.duration));
          URL.revokeObjectURL(audioUrl);
        };
        
        audio.onerror = () => {
          // Fallback to estimated duration
          setEstimatedDuration(180 + Math.floor(Math.random() * 120));
          URL.revokeObjectURL(audioUrl);
          toast({
            title: "Duration detection failed",
            description: "Using estimated duration. You can adjust it manually.",
            variant: "default"
          });
        };
      }
    };
    
    input.click();
  };

  const handleAddTrack = () => {
    if (!selectedFile || !song) {
      toast({
        title: "Validation Error",
        description: "Please select an audio file",
        variant: "destructive"
      });
      return;
    }

    if (!trackName.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a track name",
        variant: "destructive"
      });
      return;
    }

    if (tracks.length >= 6) {
      toast({
        title: "Maximum tracks reached",
        description: "You can only have up to 6 backing tracks per song",
        variant: "destructive"
      });
      return;
    }

    // Create object URL for the file that can be used by the audio engine
    const objectUrl = URL.createObjectURL(selectedFile);
    
    const trackData = {
      name: trackName,
      trackNumber: tracks.length + 1,
      audioUrl: objectUrl, // Use object URL instead of file path
      localFileName: selectedFile.name, // Store original filename for display
      duration: estimatedDuration,
      volume: 100,
      isMuted: false,
      isSolo: false
    };

    addTrackMutation.mutate(trackData);
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
                    {audioFilePath ? "Change file" : "Select audio file"}
                  </Button>
                  {audioFilePath && (
                    <div className="bg-gray-800 p-3 rounded border border-gray-600">
                      <div className="flex items-center space-x-2">
                        <File className="w-4 h-4 text-primary" />
                        <span className="text-sm font-mono text-gray-300 break-all">{audioFilePath}</span>
                      </div>
                      {estimatedDuration > 0 && (
                        <div className="text-xs text-gray-400 mt-1">
                          Duration: {formatDuration(estimatedDuration)}
                        </div>
                      )}
                      <div className="text-xs text-gray-500 mt-1">
                        File will be referenced locally on your system
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
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

              <div className="flex justify-end space-x-2">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setIsAddDialogOpen(false);
                    setTrackName("");
                    setAudioFilePath("");
                    setSelectedFile(null);
                    setEstimatedDuration(0);
                  }}
                  disabled={addTrackMutation.isPending}
                  data-testid="button-cancel-track"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleAddTrack}
                  disabled={addTrackMutation.isPending || !selectedFile}
                  data-testid="button-add-track"
                >
                  {addTrackMutation.isPending ? "Adding..." : "Add Track"}
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