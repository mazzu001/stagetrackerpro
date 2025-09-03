import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Play, Pause, CheckCircle, AlertCircle, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { BrowserFileSystem } from '@/lib/browser-file-system';
import type { SongWithTracks } from '@shared/schema';

interface PitchProcessorProps {
  song: SongWithTracks | null;
  onProcessingComplete?: () => void;
}

interface ProcessingStatus {
  trackId: string;
  trackName: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress?: number;
  errorMessage?: string;
}

export function PitchProcessor({ song, onProcessingComplete }: PitchProcessorProps) {
  const [pitchSemitones, setPitchSemitones] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus[]>([]);
  const [overallProgress, setOverallProgress] = useState(0);
  const { toast } = useToast();

  // Initialize processing status for all tracks
  const initializeProcessingStatus = useCallback(() => {
    if (!song?.tracks) return [];
    
    return song.tracks.map(track => ({
      trackId: track.id,
      trackName: track.name,
      status: 'pending' as const,
      progress: 0
    }));
  }, [song?.tracks]);

  // Handle pitch slider change
  const handlePitchChange = useCallback((value: number[]) => {
    setPitchSemitones(value[0]);
  }, []);

  // Process a single track with pitch shifting
  const processTrack = async (track: any, semitones: number): Promise<boolean> => {
    try {
      console.log(`🎵 Starting pitch processing for track: ${track.name} (${semitones > 0 ? '+' : ''}${semitones} semitones)`);
      
      // Update status to processing
      setProcessingStatus(prev => prev.map(status => 
        status.trackId === track.id 
          ? { ...status, status: 'processing', progress: 0 }
          : status
      ));

      // Get audio file from browser file system
      const browserFS = BrowserFileSystem.getInstance();
      if (!browserFS) {
        throw new Error('Browser file system not available');
      }
      
      // Ensure the database is initialized
      await browserFS.initialize();

      const audioFile = await browserFS.getAudioFile(track.id);
      if (!audioFile) {
        throw new Error(`Audio file not found for track ${track.name}`);
      }

      // Update progress: file loaded
      setProcessingStatus(prev => prev.map(status => 
        status.trackId === track.id 
          ? { ...status, progress: 25 }
          : status
      ));

      // Create audio context for offline processing
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Convert file to array buffer
      const arrayBuffer = await audioFile.arrayBuffer();
      
      // Update progress: converting audio
      setProcessingStatus(prev => prev.map(status => 
        status.trackId === track.id 
          ? { ...status, progress: 50 }
          : status
      ));

      // Decode audio data
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      // Calculate pitch shift ratio
      const pitchRatio = Math.pow(2, semitones / 12);
      
      // Create offline audio context for processing
      const offlineContext = new OfflineAudioContext(
        audioBuffer.numberOfChannels,
        Math.floor(audioBuffer.length / pitchRatio),
        audioBuffer.sampleRate
      );

      // Create buffer source
      const source = offlineContext.createBufferSource();
      source.buffer = audioBuffer;
      source.playbackRate.value = pitchRatio;
      
      // Connect to destination
      source.connect(offlineContext.destination);
      source.start(0);

      // Update progress: processing audio
      setProcessingStatus(prev => prev.map(status => 
        status.trackId === track.id 
          ? { ...status, progress: 75 }
          : status
      ));

      // Render the processed audio
      const processedBuffer = await offlineContext.startRendering();

      // Convert processed buffer back to audio file
      const processedArrayBuffer = await audioBufferToWav(processedBuffer);
      const processedFile = new File([processedArrayBuffer], `${track.name}_${semitones > 0 ? '+' : ''}${semitones}ST.wav`, {
        type: 'audio/wav'
      });

      // Generate processed track ID
      const processedTrackId = `${track.id}_${semitones > 0 ? '+' : ''}${semitones}ST`;
      
      // Store processed track in browser file system
      await browserFS.addAudioFile(track.songId, processedTrackId, processedFile.name, processedFile);
      
      // Update progress: completed
      setProcessingStatus(prev => prev.map(status => 
        status.trackId === track.id 
          ? { ...status, status: 'completed', progress: 100 }
          : status
      ));

      console.log(`✅ Pitch processing completed for track: ${track.name}`);
      return true;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Pitch processing failed for track ${track.name}:`, error);
      console.error(`❌ Error details for ${track.name}:`, {
        trackId: track.id,
        trackName: track.name,
        errorMessage,
        errorStack: error instanceof Error ? error.stack : undefined
      });
      
      setProcessingStatus(prev => prev.map(status => 
        status.trackId === track.id 
          ? { ...status, status: 'error', errorMessage }
          : status
      ));
      
      return false;
    }
  };

  // Convert AudioBuffer to WAV format
  const audioBufferToWav = async (buffer: AudioBuffer): Promise<ArrayBuffer> => {
    const length = buffer.length * buffer.numberOfChannels * 2 + 44;
    const arrayBuffer = new ArrayBuffer(length);
    const view = new DataView(arrayBuffer);
    
    // Write WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, length - 8, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, buffer.numberOfChannels, true);
    view.setUint32(24, buffer.sampleRate, true);
    view.setUint32(28, buffer.sampleRate * buffer.numberOfChannels * 2, true);
    view.setUint16(32, buffer.numberOfChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, buffer.length * buffer.numberOfChannels * 2, true);
    
    // Write audio data
    let offset = 44;
    for (let i = 0; i < buffer.length; i++) {
      for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
        view.setInt16(offset, sample * 0x7FFF, true);
        offset += 2;
      }
    }
    
    return arrayBuffer;
  };

  // Start processing all tracks
  const handleApplyPitchShift = async () => {
    if (!song?.tracks || pitchSemitones === 0) {
      toast({
        title: "No Processing Needed",
        description: "Select a pitch shift amount (±1-4 semitones) to apply processing.",
        variant: "default"
      });
      return;
    }

    setIsProcessing(true);
    setOverallProgress(0);
    setProcessingStatus(initializeProcessingStatus());

    try {
      let completedTracks = 0;
      let errorTracks = 0;
      const totalTracks = song.tracks.length;

      console.log(`🎵 Starting pitch processing for ${totalTracks} tracks with ${pitchSemitones > 0 ? '+' : ''}${pitchSemitones} semitones`);

      // Process each track sequentially
      for (const track of song.tracks) {
        console.log(`🎵 Processing track: ${track.name} (${track.id})`);
        const success = await processTrack(track, pitchSemitones);
        
        if (success) {
          completedTracks++;
          console.log(`✅ Successfully processed: ${track.name}`);
        } else {
          errorTracks++;
          console.log(`❌ Failed to process: ${track.name}`);
        }
        
        // Update overall progress
        setOverallProgress((completedTracks + errorTracks) / totalTracks * 100);
      }

      console.log(`🎵 Processing complete: ${completedTracks}/${totalTracks} successful, ${errorTracks} errors`);

      toast({
        title: "Processing Complete",
        description: `Successfully processed ${completedTracks} of ${totalTracks} tracks.${errorTracks > 0 ? ` ${errorTracks} failed.` : ''}`,
        variant: completedTracks === totalTracks ? "default" : "destructive"
      });

      if (onProcessingComplete) {
        onProcessingComplete();
      }

    } catch (error) {
      console.error('❌ Batch processing failed:', error);
      toast({
        title: "Processing Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Reset processing status
  const handleReset = () => {
    setProcessingStatus([]);
    setOverallProgress(0);
    setPitchSemitones(0);
  };

  if (!song) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🎵 Pitch Processor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            Select a song to enable pitch processing
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🎵 Pitch Processor
          <Badge variant="outline">
            {song.tracks.length} track{song.tracks.length !== 1 ? 's' : ''}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Pitch Control */}
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium whitespace-nowrap">Pitch Shift:</span>
            <div className="flex-1 max-w-48">
              <Slider
                value={[pitchSemitones]}
                onValueChange={handlePitchChange}
                min={-4}
                max={4}
                step={1}
                className="w-full"
                disabled={isProcessing}
                data-testid="slider-pitch-processor"
              />
            </div>
            <span className="text-sm text-muted-foreground w-16 text-center">
              {pitchSemitones > 0 ? `+${pitchSemitones}` : pitchSemitones} ST
            </span>
          </div>
          
          <div className="flex gap-2">
            <Button 
              onClick={handleApplyPitchShift}
              disabled={isProcessing || pitchSemitones === 0}
              className="flex-1"
              data-testid="button-apply-pitch"
            >
              {isProcessing ? (
                <>
                  <Pause className="w-4 h-4 mr-2" />
                  Processing...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Apply Pitch Shift
                </>
              )}
            </Button>
            
            <Button 
              variant="outline"
              onClick={handleReset}
              disabled={isProcessing}
              data-testid="button-reset-pitch"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Overall Progress */}
        {isProcessing && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Overall Progress</span>
              <span>{Math.round(overallProgress)}%</span>
            </div>
            <Progress value={overallProgress} className="w-full" />
          </div>
        )}

        {/* Track Processing Status */}
        {processingStatus.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Track Status</h4>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {processingStatus.map((status) => (
                <div key={status.trackId} className="flex items-center gap-3 p-2 border rounded">
                  <div className="w-6 h-6 flex items-center justify-center">
                    {status.status === 'completed' && <CheckCircle className="w-5 h-5 text-green-500" />}
                    {status.status === 'error' && <AlertCircle className="w-5 h-5 text-red-500" />}
                    {status.status === 'processing' && <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" />}
                    {status.status === 'pending' && <div className="w-3 h-3 rounded-full bg-gray-300" />}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{status.trackName}</p>
                    {status.status === 'processing' && status.progress !== undefined && (
                      <Progress value={status.progress} className="w-full mt-1" />
                    )}
                    {status.status === 'error' && status.errorMessage && (
                      <p className="text-xs text-red-500 mt-1">{status.errorMessage}</p>
                    )}
                  </div>
                  
                  <Badge 
                    variant={
                      status.status === 'completed' ? 'default' :
                      status.status === 'error' ? 'destructive' :
                      status.status === 'processing' ? 'secondary' : 'outline'
                    }
                  >
                    {status.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}