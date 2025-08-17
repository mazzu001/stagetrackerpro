import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Plus, Upload, Music, Trash2, Volume2 } from "lucide-react";
import type { Track, SongWithTracks } from "@shared/schema";

interface TrackManagerProps {
  song?: SongWithTracks;
  onTrackUpdate?: () => void;
}

export default function TrackManager({ song, onTrackUpdate }: TrackManagerProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [trackName, setTrackName] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);

  const { toast } = useToast();

  const { data: tracks = [] } = useQuery<Track[]>({
    queryKey: ['/api/songs', song?.id, 'tracks'],
    enabled: !!song?.id
  });

  const uploadTrackMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const progress = (event.loaded / event.total) * 100;
            setUploadProgress(progress);
          }
        };

        xhr.onload = () => {
          if (xhr.status === 201) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            reject(new Error('Upload failed'));
          }
        };

        xhr.onerror = () => reject(new Error('Upload failed'));
        
        xhr.open('POST', `/api/songs/${song?.id}/tracks`);
        xhr.send(formData);
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/songs', song?.id, 'tracks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/songs', song?.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/songs'] });
      setIsAddDialogOpen(false);
      setSelectedFile(null);
      setTrackName("");
      setUploadProgress(0);
      onTrackUpdate?.();
      toast({
        title: "Track uploaded",
        description: "Audio track has been added successfully."
      });
    },
    onError: (error) => {
      setUploadProgress(0);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload track",
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

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a', 'audio/mpeg'];
      if (!allowedTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|ogg|m4a)$/i)) {
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

      setSelectedFile(file);
      setTrackName(file.name.replace(/\.[^/.]+$/, "")); // Remove file extension
    }
  };

  const handleUpload = () => {
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

    const formData = new FormData();
    formData.append('audioFile', selectedFile);
    formData.append('name', trackName);
    formData.append('trackNumber', (tracks.length + 1).toString());

    uploadTrackMutation.mutate(formData);
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
                <div className="mt-2">
                  <input
                    id="audioFile"
                    type="file"
                    accept="audio/*,.mp3,.wav,.ogg,.m4a"
                    onChange={handleFileSelect}
                    className="hidden"
                    data-testid="input-audio-file"
                  />
                  <Button
                    variant="outline"
                    onClick={() => document.getElementById('audioFile')?.click()}
                    className="w-full justify-start"
                    data-testid="button-select-file"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {selectedFile ? selectedFile.name : "Select audio file"}
                  </Button>
                  {selectedFile && (
                    <div className="mt-2 text-sm text-gray-400">
                      Size: {formatFileSize(selectedFile.size)}
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

              {uploadProgress > 0 && uploadProgress < 100 && (
                <div>
                  <Label>Upload Progress</Label>
                  <Progress value={uploadProgress} className="mt-2" />
                  <div className="text-sm text-gray-400 mt-1">{Math.round(uploadProgress)}%</div>
                </div>
              )}

              <div className="flex justify-end space-x-2">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setIsAddDialogOpen(false);
                    setSelectedFile(null);
                    setTrackName("");
                    setUploadProgress(0);
                  }}
                  disabled={uploadTrackMutation.isPending}
                  data-testid="button-cancel-track"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleUpload}
                  disabled={uploadTrackMutation.isPending || !selectedFile}
                  data-testid="button-upload-track"
                >
                  {uploadTrackMutation.isPending ? "Uploading..." : "Upload Track"}
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
              <span>Song duration will be auto-detected from longest track</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}