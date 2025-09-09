import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, CheckCircle, AlertCircle, FileAudio, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Track } from "@shared/schema";

interface TrackFileUploaderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tracks: Track[];
  onUploadComplete: () => void;
}

export function TrackFileUploader({ open, onOpenChange, tracks, onUploadComplete }: TrackFileUploaderProps) {
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [uploadedTracks, setUploadedTracks] = useState<Set<string>>(new Set());
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  // Get tracks that need audio files (don't have blob:stored or database data)
  const tracksNeedingFiles = tracks.filter(track => 
    track.audioUrl !== 'blob:stored' && !track.audioUrl.startsWith('blob:') && !track.audioData
  );

  const handleFileUpload = async (trackId: string, file: File) => {
    const formData = new FormData();
    formData.append('audio', file);

    try {
      setUploadProgress(prev => ({ ...prev, [trackId]: 0 }));
      
      const response = await fetch(`/api/tracks/${trackId}/audio`, {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        setUploadProgress(prev => ({ ...prev, [trackId]: 100 }));
        setUploadedTracks(prev => new Set([...Array.from(prev), trackId]));
        
        toast({
          title: "File Uploaded",
          description: `Successfully uploaded ${file.name}`,
        });
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Upload failed');
      }
    } catch (error) {
      console.error(`Failed to upload file for track ${trackId}:`, error);
      toast({
        title: "Upload Failed",
        description: `Failed to upload ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
      setUploadProgress(prev => ({ ...prev, [trackId]: -1 })); // -1 indicates error
    }
  };

  const handleBulkFileUpload = async (files: FileList) => {
    setIsUploading(true);
    
    const fileArray = Array.from(files);
    
    for (const file of fileArray) {
      // Try to match file to track by name
      const matchingTrack = tracksNeedingFiles.find(track => {
        const trackNameClean = track.name.replace(/\.(mp3|wav|ogg|m4a)$/i, '').toLowerCase();
        const fileNameClean = file.name.replace(/\.(mp3|wav|ogg|m4a)$/i, '').toLowerCase();
        return trackNameClean === fileNameClean || track.name.toLowerCase().includes(fileNameClean);
      });

      if (matchingTrack && !uploadedTracks.has(matchingTrack.id)) {
        await handleFileUpload(matchingTrack.id, file);
        // Small delay to prevent overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    setIsUploading(false);
    
    // If all tracks have files, close dialog and refresh
    if (uploadedTracks.size >= tracksNeedingFiles.length) {
      setTimeout(() => {
        onUploadComplete();
        onOpenChange(false);
      }, 1000);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleBulkFileUpload(files);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleBulkFileUpload(files);
    }
  };

  if (tracksNeedingFiles.length === 0) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <FileAudio className="w-5 h-5" />
            <span>Upload Audio Files</span>
          </DialogTitle>
          <DialogDescription>
            Upload audio files for tracks that are missing audio data
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Drop Zone */}
          <Card 
            className="border-2 border-dashed border-gray-600 bg-gray-800/50 hover:border-primary/50 transition-colors"
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onDragEnter={(e) => e.preventDefault()}
          >
            <CardContent className="p-8 text-center">
              <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <div className="space-y-2">
                <p className="text-lg font-medium">Drop audio files here</p>
                <p className="text-sm text-gray-400">or click to browse</p>
              </div>
              <input
                type="file"
                multiple
                accept="audio/*"
                onChange={handleFileSelect}
                className="absolute inset-0 opacity-0 cursor-pointer"
                disabled={isUploading}
              />
            </CardContent>
          </Card>

          {/* Track List */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Tracks needing audio files:</h3>
            {tracksNeedingFiles.map((track) => {
              const progress = uploadProgress[track.id] ?? null;
              const isUploaded = uploadedTracks.has(track.id);
              const hasError = progress === -1;

              return (
                <Card key={track.id} className="bg-surface">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <FileAudio className="w-5 h-5 text-gray-400" />
                        <div>
                          <div className="font-medium">{track.name}</div>
                          <div className="text-sm text-gray-400">Track {track.trackNumber}</div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {isUploaded && (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        )}
                        {hasError && (
                          <AlertCircle className="w-5 h-5 text-red-500" />
                        )}
                      </div>
                    </div>
                    
                    {progress !== null && progress >= 0 && (
                      <div className="mt-3">
                        <Progress value={progress} className="h-2" />
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Progress Summary */}
          {Object.keys(uploadProgress).length > 0 && (
            <Card className="bg-gray-800/30">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">
                    Uploaded: {uploadedTracks.size} / {tracksNeedingFiles.length}
                  </span>
                  {isUploading && (
                    <span className="text-sm text-blue-400">Uploading...</span>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-2">
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={isUploading}
            >
              {uploadedTracks.size > 0 ? 'Continue Later' : 'Cancel'}
            </Button>
            {uploadedTracks.size > 0 && (
              <Button 
                onClick={() => {
                  onUploadComplete();
                  onOpenChange(false);
                }}
                disabled={isUploading}
              >
                Continue with {uploadedTracks.size} files
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}