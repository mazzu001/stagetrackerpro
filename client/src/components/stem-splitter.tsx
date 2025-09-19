import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { AudioFileStorage } from "@/lib/audio-file-storage";
import { LocalSongStorage } from "@/lib/local-song-storage";
import { useLocalAuth } from "@/hooks/useLocalAuth";
import { 
  Music, 
  Upload, 
  Download, 
  Plus, 
  Loader2, 
  CheckCircle, 
  AlertCircle,
  Mic,
  Guitar,
  Drum,
  Piano
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

import type { Track, SongWithTracks } from "@shared/schema";

interface StemSplitterProps {
  song?: SongWithTracks;
  onStemGenerated?: (stems: GeneratedStem[]) => void;
  onSongUpdate?: (updatedSong: SongWithTracks) => void;
}

interface GeneratedStem {
  id: string;
  name: string;
  blob: Blob;
  size: number;
}

interface JobStatus {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  resultUrls?: string[];
  error?: string;
}

export default function StemSplitter({ 
  song, 
  onStemGenerated,
  onSongUpdate
}: StemSplitterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [removeStems, setRemoveStems] = useState<string[]>(['vocals']);
  const [outputMode, setOutputMode] = useState<'add-to-song' | 'download' | 'both'>('both');
  
  // Processing states
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentJob, setCurrentJob] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [generatedStems, setGeneratedStems] = useState<GeneratedStem[]>([]);
  
  const { toast } = useToast();
  const { user } = useLocalAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollIntervalRef = useRef<number | null>(null);

  const stemOptions = [
    { id: 'vocals', label: 'Lead Vocals', icon: Mic },
    { id: 'background-vocals', label: 'Background Vocals', icon: Mic },
    { id: 'guitar', label: 'Guitar', icon: Guitar },
    { id: 'bass', label: 'Bass', icon: Guitar },
    { id: 'drums', label: 'Drums', icon: Drum },
    { id: 'piano', label: 'Piano/Keys', icon: Piano },
  ];

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a'];
      const fileType = file.type;
      
      if (!allowedTypes.includes(fileType) && !allowedTypes.some(type => file.name.toLowerCase().endsWith(type.split('/')[1]))) {
        toast({
          title: "Invalid file type",
          description: "Please select an MP3, WAV, OGG, or M4A audio file.",
          variant: "destructive",
        });
        return;
      }

      // Check file size (50MB limit)
      if (file.size > 50 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "File size must be under 50MB.",
          variant: "destructive",
        });
        return;
      }

      setSelectedFile(file);
    }
  }, [toast]);

  const toggleStem = useCallback((stemId: string) => {
    setRemoveStems(prev => 
      prev.includes(stemId) 
        ? prev.filter(id => id !== stemId)
        : [...prev, stemId]
    );
  }, []);

  const pollJobStatus = useCallback(async (jobId: string) => {
    try {
      const response = await fetch(`/api/stem-splitter/status/${jobId}`);
      const status: JobStatus = await response.json();
      
      setJobStatus(status);
      
      if (status.status === 'completed') {
        // Job completed, download stems
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        
        await downloadStems(jobId, status.resultUrls || []);
        setIsProcessing(false);
        
        toast({
          title: "Stems generated successfully!",
          description: `Generated ${status.resultUrls?.length || 0} stem files.`,
        });
        
      } else if (status.status === 'failed') {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        setIsProcessing(false);
        
        toast({
          title: "Processing failed",
          description: status.error || "Unknown error occurred.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error polling job status:', error);
    }
  }, [toast]);

  const downloadStems = async (jobId: string, resultUrls: string[]) => {
    const stems: GeneratedStem[] = [];
    
    for (const url of resultUrls) {
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        const stemName = url.split('/').pop() || 'stem.wav';
        
        stems.push({
          id: `stem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: stemName.replace('.wav', ''),
          blob: blob,
          size: blob.size
        });
      } catch (error) {
        console.error('Error downloading stem:', error);
      }
    }
    
    setGeneratedStems(stems);
    
    // Handle output mode
    if (outputMode === 'download' || outputMode === 'both') {
      downloadStemsToComputer(stems);
    }
    
    if (outputMode === 'add-to-song' || outputMode === 'both') {
      await addStemsToSong(stems);
    }
  };

  const downloadStemsToComputer = (stems: GeneratedStem[]) => {
    stems.forEach(stem => {
      const url = URL.createObjectURL(stem.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedFile?.name.replace(/\.[^/.]+$/, '')}_${stem.name}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  };

  const addStemsToSong = async (stems: GeneratedStem[]) => {
    console.log('🎵 addStemsToSong called with:', { stemsCount: stems.length, song: song?.id, userEmail: user?.email });
    
    if (!song || !user?.email) {
      console.error('❌ Missing song or user email:', { song: !!song, userEmail: user?.email });
      toast({
        title: "Cannot add to song",
        description: "No active song or user session.",
        variant: "destructive",
      });
      return;
    }

    try {
      for (const stem of stems) {
        console.log(`🎵 Processing stem: ${stem.name} (${stem.size} bytes)`);
        
        // Convert blob to File
        const file = new File([stem.blob], `${stem.name}.wav`, { type: 'audio/wav' });
        console.log(`📁 Created file object: ${file.name}, size: ${file.size}`);
        
        // Create new track - DON'T use stem.id, let LocalSongStorage generate the ID
        const newTrack: Track = {
          id: crypto.randomUUID(), // Generate unique ID here
          songId: song.id,
          name: stem.name,
          trackNumber: (song.tracks?.length || 0) + 1,
          audioUrl: '', // Will be set by AudioFileStorage
          localFileName: null,
          audioData: null,
          mimeType: 'audio/wav',
          fileSize: stem.size,
          volume: 0.8,
          balance: 0,
          isMuted: false,
          isSolo: false,
        };
        console.log(`🎧 Created track object: ${newTrack.id} - ${newTrack.name}`);
        
        // Store audio file
        console.log(`💾 Storing audio file for track: ${newTrack.id}`);
        await AudioFileStorage.getInstance().storeAudioFile(newTrack.id, file, newTrack);
        console.log(`✅ Audio file stored successfully`);
        
        // Add track to song
        console.log(`📝 Adding track to song: ${song.id}`);
        const result = LocalSongStorage.addTrack(user.email, song.id, newTrack);
        console.log(`📝 LocalSongStorage.addTrack result:`, result);
      }
      
      // Trigger song update
      console.log(`🔄 Getting updated song from storage`);
      const updatedSong = LocalSongStorage.getSong(user.email, song.id);
      console.log(`🔄 Updated song:`, { id: updatedSong?.id, tracksCount: updatedSong?.tracks?.length });
      
      if (updatedSong && onSongUpdate) {
        // Convert LocalSong to SongWithTracks format
        const songWithTracks: SongWithTracks = {
          ...updatedSong,
          userId: user.email || '',
        };
        console.log(`🔄 Calling onSongUpdate with:`, { id: songWithTracks.id, tracksCount: songWithTracks.tracks?.length });
        onSongUpdate(songWithTracks);
      } else {
        console.warn(`⚠️ No song update: updatedSong=${!!updatedSong}, onSongUpdate=${!!onSongUpdate}`);
      }
      
      toast({
        title: "Stems added to song",
        description: `${stems.length} stems added to ${song.title}.`,
      });
      
    } catch (error) {
      console.error('❌ Error adding stems to song:', error);
      toast({
        title: "Failed to add stems",
        description: "Could not add stems to the current song.",
        variant: "destructive",
      });
    }
  };

  const startProcessing = async () => {
    if (!selectedFile) {
      toast({
        title: "No file selected",
        description: "Please select an audio file first.",
        variant: "destructive",
      });
      return;
    }

    if (removeStems.length === 0) {
      toast({
        title: "No stems selected",
        description: "Please select at least one stem to remove.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    setJobStatus(null);
    setGeneratedStems([]);

    try {
      const formData = new FormData();
      formData.append('audio', selectedFile);
      formData.append('removeStems', JSON.stringify(removeStems));

      const response = await fetch('/api/stem-splitter/create', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok && result.jobId) {
        setCurrentJob(result.jobId);
        
        // Start polling for status
        pollIntervalRef.current = window.setInterval(() => {
          pollJobStatus(result.jobId);
        }, 2000);
        
      } else {
        throw new Error(result.error || 'Failed to start processing');
      }
      
    } catch (error) {
      console.error('Error starting stem separation:', error);
      setIsProcessing(false);
      
      toast({
        title: "Processing failed",
        description: error instanceof Error ? error.message : "Failed to start stem separation.",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setSelectedFile(null);
    setRemoveStems(['vocals']);
    setOutputMode('both');
    setIsProcessing(false);
    setCurrentJob(null);
    setJobStatus(null);
    setGeneratedStems([]);
    
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    if (!isProcessing) {
      resetForm();
      setIsOpen(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => open ? setIsOpen(true) : handleClose()}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          className="gap-2"
          data-testid="button-open-stem-splitter"
        >
          <Music className="h-4 w-4" />
          Split Stems
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-stem-splitter">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Music className="h-5 w-5" />
            Stem Splitter
          </DialogTitle>
          <DialogDescription>
            Separate instruments from your audio files. Remove vocals, drums, or other stems to create backing tracks or isolated parts.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {!isProcessing && !generatedStems.length && (
            <>
              {/* File Upload */}
              <div className="space-y-3">
                <Label htmlFor="audio-file">Upload Audio File</Label>
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center">
                  <input
                    ref={fileInputRef}
                    id="audio-file"
                    type="file"
                    accept="audio/*"
                    onChange={handleFileSelect}
                    className="hidden"
                    data-testid="input-audio-file"
                  />
                  <div className="space-y-3">
                    <Upload className="h-8 w-8 mx-auto text-gray-400" />
                    <div>
                      <Button 
                        variant="outline" 
                        onClick={() => fileInputRef.current?.click()}
                        data-testid="button-browse-file"
                      >
                        Browse Files
                      </Button>
                    </div>
                    <p className="text-sm text-gray-500">
                      MP3, WAV, OGG, M4A (Max 50MB)
                    </p>
                  </div>
                </div>
                
                {selectedFile && (
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3" data-testid="selected-file-info">
                        <Music className="h-5 w-5 text-blue-500" />
                        <div>
                          <p className="font-medium">{selectedFile.name}</p>
                          <p className="text-sm text-gray-500">
                            {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Stem Selection */}
              <div className="space-y-3">
                <Label>Select stems to remove:</Label>
                <div className="grid grid-cols-2 gap-3">
                  {stemOptions.map(stem => {
                    const Icon = stem.icon;
                    return (
                      <div 
                        key={stem.id} 
                        className="flex items-center space-x-2 p-3 border rounded-lg"
                      >
                        <Checkbox
                          id={stem.id}
                          checked={removeStems.includes(stem.id)}
                          onCheckedChange={() => toggleStem(stem.id)}
                          data-testid={`checkbox-stem-${stem.id}`}
                        />
                        <Icon className="h-4 w-4" />
                        <Label htmlFor={stem.id} className="flex-1 cursor-pointer">
                          {stem.label}
                        </Label>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Output Options */}
              <div className="space-y-3">
                <Label>Output options:</Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="add-to-song"
                      name="output"
                      value="add-to-song"
                      checked={outputMode === 'add-to-song'}
                      onChange={(e) => setOutputMode(e.target.value as any)}
                      data-testid="radio-add-to-song"
                    />
                    <Label htmlFor="add-to-song" className="flex items-center gap-2 cursor-pointer">
                      <Plus className="h-4 w-4" />
                      Add to current song
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="download"
                      name="output"
                      value="download"
                      checked={outputMode === 'download'}
                      onChange={(e) => setOutputMode(e.target.value as any)}
                      data-testid="radio-download"
                    />
                    <Label htmlFor="download" className="flex items-center gap-2 cursor-pointer">
                      <Download className="h-4 w-4" />
                      Download to computer
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="both"
                      name="output"
                      value="both"
                      checked={outputMode === 'both'}
                      onChange={(e) => setOutputMode(e.target.value as any)}
                      data-testid="radio-both"
                    />
                    <Label htmlFor="both" className="flex items-center gap-2 cursor-pointer">
                      <Plus className="h-4 w-4" />
                      <Download className="h-4 w-4" />
                      Both - Add & Download
                    </Label>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <Button 
                  variant="outline" 
                  onClick={handleClose}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={startProcessing}
                  disabled={!selectedFile || removeStems.length === 0}
                  className="flex-1"
                  data-testid="button-start-processing"
                >
                  <Music className="h-4 w-4 mr-2" />
                  Split Stems
                </Button>
              </div>
            </>
          )}

          {/* Processing State */}
          {isProcessing && (
            <div className="space-y-4 text-center py-8" data-testid="processing-state">
              <Loader2 className="h-12 w-12 animate-spin mx-auto text-blue-500" />
              <div>
                <h3 className="text-lg font-medium">Processing your audio...</h3>
                <p className="text-gray-500">This may take a few minutes</p>
              </div>
              
              {jobStatus && (
                <div className="space-y-2">
                  <Progress value={jobStatus.progress} className="w-full" />
                  <p className="text-sm text-gray-600">
                    {jobStatus.progress}% complete • Status: {jobStatus.status}
                  </p>
                </div>
              )}
              
              <p className="text-xs text-gray-400">
                Job ID: {currentJob}
              </p>
            </div>
          )}

          {/* Completed State */}
          {generatedStems.length > 0 && !isProcessing && (
            <div className="space-y-4 text-center py-4" data-testid="completed-state">
              <CheckCircle className="h-12 w-12 mx-auto text-green-500" />
              <div>
                <h3 className="text-lg font-medium">Stems generated successfully!</h3>
                <p className="text-gray-500">
                  Generated {generatedStems.length} stem files
                </p>
              </div>
              
              <div className="grid grid-cols-1 gap-2 text-left">
                {generatedStems.map(stem => (
                  <div key={stem.id} className="flex items-center justify-between p-3 border rounded">
                    <div className="flex items-center gap-2">
                      <Music className="h-4 w-4 text-blue-500" />
                      <span className="font-medium">{stem.name}</span>
                    </div>
                    <span className="text-sm text-gray-500">
                      {(stem.size / (1024 * 1024)).toFixed(1)} MB
                    </span>
                  </div>
                ))}
              </div>
              
              <div className="flex gap-3 pt-4">
                <Button 
                  variant="outline" 
                  onClick={resetForm}
                  data-testid="button-process-another"
                >
                  Process Another
                </Button>
                <Button 
                  onClick={handleClose}
                  className="flex-1"
                  data-testid="button-done"
                >
                  Done
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}