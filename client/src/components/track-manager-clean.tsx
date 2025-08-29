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
import { Plus, FolderOpen, Music, Trash2, Volume2, File, VolumeX, Headphones, Play, Pause, AlertTriangle, Mic, Square, Circle } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import StereoVUMeter from "@/components/stereo-vu-meter";


import type { Track, SongWithTracks } from "@shared/schema";

interface TrackManagerProps {
  song?: SongWithTracks;
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
  const [localTrackValues, setLocalTrackValues] = useState<Record<string, { volume: number; balance: number }>>({});

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordDialogOpen, setIsRecordDialogOpen] = useState(false);
  const [recordingName, setRecordingName] = useState("");
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordingStream, setRecordingStream] = useState<MediaStream | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingLevel, setRecordingLevel] = useState(0);
  const [availableAudioInputs, setAvailableAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioInput, setSelectedAudioInput] = useState<string>("");
  const recordingChunks = useRef<Blob[]>([]);
  const recordingStartTime = useRef<number>(0);
  const recordingTimer = useRef<NodeJS.Timeout | null>(null);
  const recordingAnalyser = useRef<AnalyserNode | null>(null);
  const recordingAudioContext = useRef<AudioContext | null>(null);

  const { toast } = useToast();
  const { user } = useLocalAuth();
  const debounceTimeouts = useRef<Record<string, NodeJS.Timeout>>({});

  // Get tracks for the current song
  const tracks = song?.tracks || [];

  // Initialize local track values from song data
  useEffect(() => {
    if (tracks.length > 0) {
      const initialValues: Record<string, { volume: number; balance: number }> = {};
      tracks.forEach(track => {
        initialValues[track.id] = {
          volume: track.volume,
          balance: track.balance
        };
      });
      setLocalTrackValues(initialValues);
    }
  }, [tracks]);

  // Initialize audio inputs on component mount
  useEffect(() => {
    getAudioInputs();
  }, []);

  // Cleanup recording resources on unmount
  useEffect(() => {
    return () => {
      stopRecording();
      if (recordingStream) {
        recordingStream.getTracks().forEach(track => track.stop());
      }
      if (recordingAudioContext.current) {
        recordingAudioContext.current.close();
      }
    };
  }, []);

  // Get available audio input devices
  const getAudioInputs = async () => {
    try {
      // Request microphone permission first
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(device => device.kind === 'audioinput');
      setAvailableAudioInputs(audioInputs);
      
      // Set default input
      if (audioInputs.length > 0 && !selectedAudioInput) {
        setSelectedAudioInput(audioInputs[0].deviceId);
      }
    } catch (error) {
      console.error('Error getting audio inputs:', error);
      toast({
        title: "Microphone Access",
        description: "Please allow microphone access to record audio tracks.",
        variant: "destructive",
      });
    }
  };

  // Start recording
  const startRecording = async () => {
    try {
      const constraints = {
        audio: {
          deviceId: selectedAudioInput ? { exact: selectedAudioInput } : undefined,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 44100
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setRecordingStream(stream);

      // Set up audio analysis for level monitoring
      recordingAudioContext.current = new AudioContext({ sampleRate: 44100 });
      const source = recordingAudioContext.current.createMediaStreamSource(stream);
      recordingAnalyser.current = recordingAudioContext.current.createAnalyser();
      recordingAnalyser.current.fftSize = 256;
      source.connect(recordingAnalyser.current);

      // Start level monitoring
      const monitorLevels = () => {
        if (!recordingAnalyser.current || !isRecording) return;
        
        const dataArray = new Uint8Array(recordingAnalyser.current.frequencyBinCount);
        recordingAnalyser.current.getByteFrequencyData(dataArray);
        
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        const normalizedLevel = average / 255;
        setRecordingLevel(normalizedLevel);
        
        if (isRecording) {
          requestAnimationFrame(monitorLevels);
        }
      };

      // Set up MediaRecorder
      const recorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      recordingChunks.current = [];
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordingChunks.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        handleRecordingComplete();
      };

      setMediaRecorder(recorder);
      recorder.start(1000); // Collect data every second
      setIsRecording(true);
      recordingStartTime.current = Date.now();

      // Start duration timer
      recordingTimer.current = setInterval(() => {
        const elapsed = (Date.now() - recordingStartTime.current) / 1000;
        setRecordingDuration(elapsed);
      }, 100);

      // Start level monitoring
      monitorLevels();

      console.log('🎤 Recording started');
      toast({
        title: "Recording Started",
        description: "Recording audio track...",
      });

    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        title: "Recording Error",
        description: "Failed to start recording. Please check microphone permissions.",
        variant: "destructive",
      });
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      
      if (recordingTimer.current) {
        clearInterval(recordingTimer.current);
        recordingTimer.current = null;
      }

      if (recordingStream) {
        recordingStream.getTracks().forEach(track => track.stop());
      }

      if (recordingAudioContext.current) {
        recordingAudioContext.current.close();
        recordingAudioContext.current = null;
      }

      console.log('🎤 Recording stopped');
    }
  };

  // Handle recording completion
  const handleRecordingComplete = async () => {
    if (recordingChunks.current.length === 0) {
      toast({
        title: "Recording Error",
        description: "No audio data recorded.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Create blob from recorded chunks
      const audioBlob = new Blob(recordingChunks.current, { type: 'audio/webm;codecs=opus' });
      
      // Convert to a more compatible format if needed
      const audioFile = new File([audioBlob], `${recordingName || 'recorded-track'}.webm`, {
        type: 'audio/webm'
      });

      console.log('🎤 Recording completed, duration:', recordingDuration.toFixed(1), 'seconds');
      
      // Add the recorded track to the song
      await addRecordedTrack(audioFile);
      
      // Reset recording state
      setRecordingName("");
      setRecordingDuration(0);
      setRecordingLevel(0);
      recordingChunks.current = [];
      setIsRecordDialogOpen(false);

      toast({
        title: "Recording Complete",
        description: `Track "${recordingName || 'recorded-track'}" added successfully!`,
      });

    } catch (error) {
      console.error('Error processing recording:', error);
      toast({
        title: "Processing Error",
        description: "Failed to process recorded audio.",
        variant: "destructive",
      });
    }
  };

  // Add recorded track to song
  const addRecordedTrack = async (audioFile: File) => {
    if (!song?.id || !user?.email) {
      toast({
        title: "Error",
        description: "Please select a song first.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsImporting(true);

      // Store the audio file
      const filePath = await AudioFileStorage.storeAudioFile(audioFile, user.email);
      
      // Create track data
      const trackName = recordingName || `Recorded Track ${tracks.length + 1}`;
      const trackData = {
        songId: song.id,
        name: trackName,
        filePath: filePath,
        volume: 1.0,
        balance: 0.0,
        isMuted: false,
        isSolo: false
      };

      // Save track to database
      const response = await fetch(`/api/songs/${song.id}/tracks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(trackData)
      });

      if (!response.ok) {
        throw new Error('Failed to save track');
      }

      const newTrack = await response.json();
      
      // Update the song with the new track
      const updatedSong = {
        ...song,
        tracks: [...tracks, newTrack]
      };

      if (onSongUpdate) {
        onSongUpdate(updatedSong);
      }

      console.log('🎤 Recorded track added to song:', trackName);

    } catch (error) {
      console.error('Error adding recorded track:', error);
      toast({
        title: "Error",
        description: "Failed to add recorded track to song.",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  // Format recording duration for display
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const refetchTracks = useCallback(() => {
    if (!song?.id || !user?.email) return;
    
    try {
      const updatedSong = LocalSongStorage.getSong(user.email, song.id);
      if (updatedSong && onSongUpdate) {
        console.log('Track Manager: Found', updatedSong.tracks.length, 'tracks for song', updatedSong.title, `(ID: ${updatedSong.id}):`, updatedSong.tracks.map(t => t.name));
        onSongUpdate(updatedSong);
      }
    } catch (error) {
      console.error('Failed to refetch tracks:', error);
    }
  }, [song?.id, user?.email, onSongUpdate]);

  const detectAndUpdateSongDuration = async (audioFile: File, songId: string) => {
    try {
      const audio = new Audio();
      const url = URL.createObjectURL(audioFile);
      
      return new Promise<void>((resolve) => {
        audio.addEventListener('loadedmetadata', () => {
          const duration = Math.round(audio.duration);
          console.log(`Detected audio duration: ${duration}s from file: ${audioFile.name}`);
          URL.revokeObjectURL(url);
          
          if (user?.email && duration > 0) {
            LocalSongStorage.updateSong(user.email, songId, { duration });
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
          
          setSelectedFiles(files);
          setIsImporting(true);
          
          let totalDuration = 0;
          let processedCount = 0;
          
          for (const file of files) {
            try {
              console.log(`Processing file ${processedCount + 1}/${files.length}: ${file.name}`);
              await processFile(file);
              processedCount++;
              
              // Estimate duration for progress
              try {
                const audio = new Audio();
                const url = URL.createObjectURL(file);
                await new Promise<void>((resolve) => {
                  const cleanup = () => {
                    URL.revokeObjectURL(url);
                    resolve();
                  };
                  
                  audio.addEventListener('loadedmetadata', () => {
                    totalDuration += audio.duration || 0;
                    cleanup();
                  });
                  
                  audio.addEventListener('error', cleanup);
                  audio.src = url;
                });
              } catch (durationError) {
                console.warn(`Could not get duration for ${file.name}:`, durationError);
              }
            } catch (fileError) {
              console.error(`Failed to process file ${file.name}:`, fileError);
              toast({
                title: "File processing failed",
                description: `Failed to process ${file.name}: ${fileError instanceof Error ? fileError.message : 'Unknown error'}`,
                variant: "destructive"
              });
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
    if (!song?.id || !user?.email) return;
    
    try {
      console.log(`Processing file ${selectedFiles.indexOf(file) + 1}/${selectedFiles.length}: ${file.name}`);
      
      const audioFileName = file.name;
      const trackName = audioFileName.replace(/\.[^/.]+$/, ""); // Remove extension
      
      console.log(`Adding track "${trackName}" with file: ${audioFileName}`);
      
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
        
        // Detect and update song duration from the audio file
        await detectAndUpdateSongDuration(file, song.id);
        
        console.log('Track added successfully:', newTrack);
        
        // Get updated song with new tracks and notify parent component
        const updatedSong = LocalSongStorage.getSong(user.email, song.id);
        if (updatedSong && onSongUpdate) {
          console.log('Track data updated, refreshing song with', updatedSong.tracks.length, 'tracks');
          onSongUpdate(updatedSong as any);
        }
        
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
        
        console.log(`Successfully processed: ${file.name}`);
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
        // Get updated song with removed track and notify parent component
        const updatedSong = LocalSongStorage.getSong(user.email, song.id);
        if (updatedSong && onSongUpdate) {
          console.log('Track deleted, refreshing song with', updatedSong.tracks.length, 'tracks');
          onSongUpdate(updatedSong as any);
        }
        
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
      
      // Get updated song and notify parent component
      const updatedSong = LocalSongStorage.getSong(user.email, song.id);
      if (updatedSong && onSongUpdate) {
        console.log('All tracks cleared, refreshing song with', updatedSong.tracks.length, 'tracks');
        onSongUpdate(updatedSong as any);
      }
      
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
    debounceTimeouts.current[trackId] = setTimeout(() => {
      console.log(`Updated track ${trackId} volume to ${volume}`);
      onTrackVolumeChange?.(trackId, volume);
      
      // Update database
      if (song?.id && user?.email) {
        const track = tracks.find(t => t.id === trackId);
        if (track) {
          LocalSongStorage.updateTrack(user.email, song.id, trackId, { volume });
        }
      }
      
      delete debounceTimeouts.current[trackId];
    }, 150);
  }, [tracks, song?.id, user?.email, onTrackVolumeChange]);

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
    debounceTimeouts.current[balanceTimeoutKey] = setTimeout(() => {
      console.log(`Updated track ${trackId} balance to ${balance}`);
      onTrackBalanceChange?.(trackId, balance);
      
      // Update database
      if (song?.id && user?.email) {
        const track = tracks.find(t => t.id === trackId);
        if (track) {
          LocalSongStorage.updateTrack(user.email, song.id, trackId, { balance });
        }
      }
      
      delete debounceTimeouts.current[balanceTimeoutKey];
    }, 150);
  }, [tracks, song?.id, user?.email, onTrackBalanceChange]);

  // Mute toggle handler
  const handleMuteToggle = useCallback((trackId: string) => {
    onTrackMuteToggle?.(trackId);
    
    // Update database
    if (song?.id && user?.email) {
      const track = tracks.find(t => t.id === trackId);
      if (track) {
        LocalSongStorage.updateTrack(user.email, song.id, trackId, { isMuted: !track.isMuted });
        // Refresh the song to reflect changes
        setTimeout(() => refetchTracks(), 50);
      }
    }
  }, [tracks, song?.id, user?.email, onTrackMuteToggle, refetchTracks]);

  // Solo toggle handler
  const handleSoloToggle = useCallback((trackId: string) => {
    onTrackSoloToggle?.(trackId);
    
    // Update database
    if (song?.id && user?.email) {
      const track = tracks.find(t => t.id === trackId);
      if (track) {
        LocalSongStorage.updateTrack(user.email, song.id, trackId, { isSolo: !track.isSolo });
        // Refresh the song to reflect changes
        setTimeout(() => refetchTracks(), 50);
      }
    }
  }, [tracks, song?.id, user?.email, onTrackSoloToggle, refetchTracks]);

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
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">Track Manager</h3>
          {tracks.length > 0 && (
            <span className="text-sm text-gray-500">({tracks.length} track{tracks.length !== 1 ? 's' : ''})</span>
          )}
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
          
          {/* Desktop buttons */}
          <Dialog open={isRecordDialogOpen} onOpenChange={setIsRecordDialogOpen}>
            <DialogTrigger asChild>
              <Button
                disabled={tracks.length >= 6 || isImporting}
                size="sm"
                variant="outline"
                className="hidden md:flex"
                data-testid="button-record-track"
              >
                <Mic className="h-4 w-4 mr-2" />
                Record
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Record Audio Track</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {/* Track name input */}
                <div>
                  <Label htmlFor="recording-name">Track Name</Label>
                  <Input
                    id="recording-name"
                    value={recordingName}
                    onChange={(e) => setRecordingName(e.target.value)}
                    placeholder={`Recorded Track ${tracks.length + 1}`}
                  />
                </div>

                {/* Audio input selection */}
                {availableAudioInputs.length > 0 && (
                  <div>
                    <Label htmlFor="audio-input">Audio Input</Label>
                    <select
                      id="audio-input"
                      value={selectedAudioInput}
                      onChange={(e) => setSelectedAudioInput(e.target.value)}
                      className="w-full p-2 border rounded-md"
                    >
                      {availableAudioInputs.map((input) => (
                        <option key={input.deviceId} value={input.deviceId}>
                          {input.label || `Microphone ${input.deviceId.slice(0, 8)}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Recording controls */}
                <div className="flex flex-col space-y-3">
                  {/* Recording level meter */}
                  {isRecording && (
                    <div className="space-y-2">
                      <Label>Recording Level</Label>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-600 h-2 rounded-full transition-all duration-75"
                          style={{ width: `${Math.min(recordingLevel * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Recording duration */}
                  {isRecording && (
                    <div className="text-center">
                      <div className="text-2xl font-mono text-red-600">
                        {formatDuration(recordingDuration)}
                      </div>
                      <div className="text-sm text-gray-600">Recording...</div>
                    </div>
                  )}

                  {/* Recording button */}
                  <Button
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`w-full ${isRecording ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
                    size="lg"
                  >
                    {isRecording ? (
                      <>
                        <Square className="h-5 w-5 mr-2" />
                        Stop Recording
                      </>
                    ) : (
                      <>
                        <Circle className="h-5 w-5 mr-2" />
                        Start Recording
                      </>
                    )}
                  </Button>
                </div>

                {/* Tips */}
                <div className="text-xs text-gray-600 space-y-1">
                  <p>• Make sure your microphone is connected and working</p>
                  <p>• For best quality, record in a quiet environment</p>
                  <p>• The recording will be added as a new track to your song</p>
                </div>
              </div>
            </DialogContent>
          </Dialog>

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
          <Dialog open={isRecordDialogOpen} onOpenChange={setIsRecordDialogOpen}>
            <DialogTrigger asChild>
              <Button
                disabled={tracks.length >= 6 || isImporting}
                size="sm"
                variant="outline"
                className="flex md:hidden h-8 w-8 p-0"
                title="Record Track"
                data-testid="button-record-track-mobile"
              >
                <Mic className="h-4 w-4" />
              </Button>
            </DialogTrigger>
          </Dialog>

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
                      <StereoVUMeter 
                        leftLevel={level * 8} 
                        rightLevel={level * 8}
                        isPlaying={isPlaying}
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
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}


    </div>
  );
}