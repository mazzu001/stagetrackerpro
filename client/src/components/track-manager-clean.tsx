import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { AudioFileStorage } from "@/lib/audio-file-storage";
import { LocalSongStorage } from "@/lib/local-song-storage";
import { useLocalAuth } from "@/hooks/useLocalAuth";
import { Plus, FolderOpen, Music, Trash2, Volume2, File, VolumeX, Headphones, Play, Pause, AlertTriangle } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import StereoVUMeter from "@/components/stereo-vu-meter";
import SpectrumAnalyzer from "@/components/spectrum-analyzer";
import ScrollingText from "@/components/scrolling-text";


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
  audioEngine?: any;
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
  onPause,
  audioEngine
}: TrackManagerProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [trackName, setTrackName] = useState("");
  const [audioFilePath, setAudioFilePath] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [estimatedDuration, setEstimatedDuration] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [localTrackValues, setLocalTrackValues] = useState<Record<string, { volume: number; balance: number }>>({});

  // Recording state
  // Recording features removed for simplicity

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
          volume: track.volume || 1.0,
          balance: track.balance || 0.0
        };
      });
      setLocalTrackValues(initialValues);
    }
  }, [tracks]);

  // Initialize audio inputs on component mount
  // Recording features removed

  // Recording features removed

  // Get available audio input devices and start monitoring
  // Recording features removed

  // Recording features removed

  // Recording features removed

  // Recording features removed

  // Recording features removed

  const refetchTracks = useCallback(() => {
    if (!song?.id || !user?.email) return;
    
    try {
      const updatedSong = LocalSongStorage.getSong(user.email, song.id);
      if (updatedSong && onSongUpdate) {
        console.log('Track Manager: Found', updatedSong.tracks.length, 'tracks for song', updatedSong.title, `(ID: ${updatedSong.id}):`, updatedSong.tracks.map(t => t.name));
        onSongUpdate(updatedSong as SongWithTracks);
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

          // Mobile detection with strict limits
          const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
          
          // On mobile, enforce maximum 3 files to prevent crashes
          if (isMobileDevice && files.length > 3) {
            console.log(`📱 Mobile device detected - limiting to 3 files max to prevent crashes`);
            toast({
              title: "Mobile Device Limit",
              description: `On mobile devices, you can only add 3 audio files at once to prevent crashes. Please select 3 files or fewer.`,
              variant: "destructive"
            });
            return;
          }
          
          if (isMobileDevice && files.length > 1) {
            console.log(`📱 Mobile device: processing ${files.length} files with extra safety measures`);
          }
          
          setSelectedFiles(files);
          setIsImporting(true);
          
          let totalDuration = 0;
          let processedCount = 0;
          
          // Process files one at a time - wait for each to completely finish
          const isMobile = isMobileDevice;
          
          for (let i = 0; i < files.length; i++) {
            const file = files[i];
            
            try {
              console.log(`📁 Processing file ${i + 1}/${files.length}: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
              
              if (isMobile) {
                console.log(`📱 Mobile device: waiting for complete file processing before next`);
              }
              
              // Update UI to show current file being processed
              setSelectedFiles([file]);
              
              // Wait for the file to be completely processed (stored in IndexedDB, metadata updated, etc.)
              console.log(`⏳ Starting processing of ${file.name}...`);
              await processFile(file);
              console.log(`✅ File ${i + 1} completely processed and stored`);
              
              processedCount++;
              
              // Mobile memory cleanup: force garbage collection hints
              if (isMobile) {
                console.log(`📱 Mobile cleanup after file ${i + 1}`);
                
                // Clear any temporary references
                if ('gc' in window && typeof window.gc === 'function') {
                  window.gc();
                }
                
                // Force a short delay to let memory settle
                await new Promise(resolve => setTimeout(resolve, 100));
              }
              
              // Get duration safely after processing
              try {
                const audio = new Audio();
                const url = URL.createObjectURL(file);
                
                const duration = await new Promise<number>((resolve) => {
                  const cleanup = () => {
                    URL.revokeObjectURL(url);
                    audio.src = '';
                    audio.load();
                  };
                  
                  const timeoutId = setTimeout(() => {
                    console.warn(`⏰ Duration detection timeout for ${file.name}`);
                    cleanup();
                    resolve(0);
                  }, 5000);
                  
                  audio.addEventListener('loadedmetadata', () => {
                    clearTimeout(timeoutId);
                    const fileDuration = audio.duration || 0;
                    cleanup();
                    resolve(fileDuration);
                  });
                  
                  audio.addEventListener('error', () => {
                    clearTimeout(timeoutId);
                    cleanup();
                    resolve(0);
                  });
                  
                  audio.src = url;
                });
                
                totalDuration += duration;
                console.log(`📊 Duration added: ${duration.toFixed(1)}s (total: ${totalDuration.toFixed(1)}s)`);
                
              } catch (durationError) {
                console.warn(`Could not get duration for ${file.name}:`, durationError);
              }
              
              // Give mobile devices a moment to breathe between files
              if (isMobile && i < files.length - 1) {
                console.log(`📱 Mobile safety pause...`);
                await new Promise(resolve => setTimeout(resolve, 500));
              }
              
            } catch (fileError) {
              console.error(`❌ Failed to process file ${file.name}:`, fileError);
              toast({
                title: "File processing failed",
                description: `Failed to process ${file.name}: ${fileError instanceof Error ? fileError.message : 'Unknown error'}`,
                variant: "destructive"
              });
              
              // On mobile, stop on first error to prevent cascade
              if (isMobile) {
                console.log(`📱 Mobile: stopping batch processing after error to prevent crash`);
                break;
              }
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
      
      const trackAdded = LocalSongStorage.addTrack(user.email, song.id, {
        name: trackName,
        songId: song.id,
        trackNumber: tracks.length + 1,
        audioUrl: '', // Will be set when file is loaded
        localFileName: audioFileName,
        // Don't set audioData - files are stored in browser storage
        mimeType: file.type,
        fileSize: file.size,
        volume: 50,
        balance: 0,
        isMuted: false,
        isSolo: false
      });
      
      if (trackAdded) {
        // Get the track ID that was just created
        const updatedSong = LocalSongStorage.getSong(user.email, song.id);
        const newTrack = updatedSong?.tracks.find(t => t.name === trackName && t.localFileName === audioFileName);
        
        if (newTrack) {
          // Store the audio file in browser storage with the track ID
          const audioStorage = AudioFileStorage.getInstance();
          await audioStorage.storeAudioFile(newTrack.id, file, newTrack, song.title);
          console.log('Audio file stored successfully for track:', newTrack.id);
          
          // Update the track with the audio URL
          const audioUrl = await audioStorage.getAudioUrl(newTrack.id);
          if (audioUrl) {
            LocalSongStorage.updateTrack(user.email, song.id, newTrack.id, { audioUrl });
            console.log('Track updated with audio URL:', audioUrl.substring(0, 50) + '...');
          }
        }
        
        // Detect and update song duration from the audio file
        await detectAndUpdateSongDuration(file, song.id);
        
        console.log('Track added successfully');
        
        // Get updated song with new tracks and notify parent component
        const finalUpdatedSong = LocalSongStorage.getSong(user.email, song.id);
        if (finalUpdatedSong && onSongUpdate) {
          console.log('Track data updated, refreshing song with', finalUpdatedSong.tracks.length, 'tracks');
          onSongUpdate(finalUpdatedSong as any);
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
    <div className="w-full h-full bg-gradient-to-b from-gray-900 to-black text-white overflow-hidden">
      {/* Professional Mixing Console Header */}
      <div className="bg-gray-800 border-b-2 border-gray-600 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-bold text-green-400">MIXING CONSOLE</h3>
            {tracks.length > 0 && (
              <span className="text-xs text-gray-400 bg-gray-700 px-2 py-1 rounded">
                {tracks.length}/6 TRACKS
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {/* Transport Controls */}
            {(onPlay || onPause) && (
              <Button
                onClick={isPlaying ? onPause : onPlay}
                variant={isPlaying ? "destructive" : "default"}
                size="sm"
                className="bg-green-600 hover:bg-green-700"
                data-testid="button-play-pause"
              >
                {isPlaying ? <Pause className="h-4 w-4 mr-1" /> : <Play className="h-4 w-4 mr-1" />}
                {isPlaying ? 'STOP' : 'PLAY'}
              </Button>
            )}
            
            <Button
              onClick={handleFileSelect}
              disabled={tracks.length >= 6 || isImporting}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
              data-testid="button-add-tracks"
            >
              <Plus className="h-4 w-4 mr-1" />
              {isImporting ? 'LOADING...' : 'ADD'}
            </Button>
            
            {tracks.length > 0 && (
              <Button
                onClick={handleClearBrokenTracks}
                variant="outline"
                size="sm"
                className="border-red-600 text-red-400 hover:bg-red-900"
                data-testid="button-clear-tracks"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                CLEAR
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Master Spectrum Analyzer */}
      <div className="p-2 border-b-2 border-gray-600">
        <SpectrumAnalyzer 
          audioEngine={audioEngine}
          isPlaying={isPlaying}
          height={80}
          className="w-full"
        />
      </div>

      {tracks.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-500">
            <Music className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <p className="text-xl mb-2">NO TRACKS LOADED</p>
            <p className="text-sm opacity-70">Add audio files to start mixing</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto p-4">
          {/* Professional Mixing Console Layout */}
          <div className="flex gap-4 min-w-max">
            {tracks.map((track, index) => {
              const localValues = localTrackValues[track.id] || { volume: track.volume, balance: track.balance };
              const level = audioLevels[track.id] || 0;
              
              return (
                <div key={track.id} className="flex flex-col bg-gray-800 rounded-lg border-2 border-gray-600 w-32 h-80 overflow-hidden">
                  {/* Channel Header */}
                  <div className="bg-gray-700 p-2 border-b border-gray-600">
                    <div className="text-center">
                      <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-xs font-bold mx-auto mb-1">
                        {index + 1}
                      </div>
                      <div className="w-24 h-4">
                        <ScrollingText 
                          text={track.name}
                          className="text-xs font-medium text-center"
                          speed={3}
                        />
                      </div>
                    </div>
                  </div>
                  
                  {/* Balance Control (Pan) */}
                  <div className="px-2 py-1">
                    <div className="text-center text-xs text-gray-400 mb-1">PAN</div>
                    <div className="flex justify-center">
                      <div className="w-20 relative">
                        <Slider
                          value={[localValues.balance]}
                          onValueChange={(value) => handleBalanceChange(track.id, value[0])}
                          min={-100}
                          max={100}
                          step={1}
                          className="w-full"
                          data-testid={`slider-balance-track-${index}`}
                        />
                        <div className="text-xs text-center text-gray-500 mt-1">
                          {localValues.balance === 0 ? 'C' : 
                           localValues.balance < 0 ? `L${Math.abs(localValues.balance)}` : 
                           `R${localValues.balance}`}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Volume Fader and VU Meter Side by Side */}
                  <div className="flex-1 px-2 py-2 flex flex-col items-center">
                    <div className="text-center text-xs text-gray-400 mb-2">LEVEL</div>
                    <div className="flex-1 flex items-center justify-center gap-2">
                      {/* Vertical Volume Fader */}
                      <div className="h-32 relative flex items-center">
                        <Slider
                          value={[localValues.volume]}
                          onValueChange={(value) => handleVolumeChange(track.id, value[0])}
                          max={100}
                          step={1}
                          orientation="vertical"
                          className="h-full"
                          data-testid={`slider-volume-track-${index}`}
                        />
                      </div>
                      
                      {/* VU Meter beside fader */}
                      <StereoVUMeter 
                        leftLevel={level * 8} 
                        rightLevel={level * 8}
                        isPlaying={isPlaying}
                        className="scale-75"
                      />
                    </div>
                    <div className="text-xs text-center text-gray-400 mt-1">
                      {localValues.volume}%
                    </div>
                  </div>
                  
                  {/* Control Buttons */}
                  <div className="p-2 space-y-1 border-t border-gray-600">
                    <Button
                      onClick={() => handleMuteToggle(track.id)}
                      variant="ghost"
                      size="sm"
                      className={`w-full h-8 text-xs font-bold ${
                        track.isMuted 
                          ? 'bg-red-600 text-white hover:bg-red-700' 
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                      data-testid={`button-mute-track-${index}`}
                    >
                      MUTE
                    </Button>
                    
                    <Button
                      onClick={() => handleSoloToggle(track.id)}
                      variant="ghost"
                      size="sm"
                      className={`w-full h-8 text-xs font-bold ${
                        track.isSolo 
                          ? 'bg-yellow-600 text-black hover:bg-yellow-500' 
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                      data-testid={`button-solo-track-${index}`}
                    >
                      SOLO
                    </Button>
                    
                    <Button
                      onClick={() => deleteTrack(track.id)}
                      variant="ghost"
                      size="sm"
                      className="w-full h-6 text-xs text-red-400 hover:text-red-300 hover:bg-red-900/20"
                      title="Delete track"
                      data-testid={`button-delete-track-${index}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
            
            {/* Add Track Channel - Empty Slot */}
            {tracks.length < 6 && (
              <div className="flex flex-col bg-gray-900 rounded-lg border-2 border-dashed border-gray-600 w-32 h-80 items-center justify-center opacity-60 hover:opacity-80 transition-opacity">
                <Button
                  onClick={handleFileSelect}
                  disabled={isImporting}
                  variant="ghost"
                  className="h-full w-full flex flex-col items-center justify-center text-gray-400 hover:text-white"
                  data-testid="button-add-track-slot"
                >
                  <Plus className="h-8 w-8 mb-2" />
                  <span className="text-xs">ADD<br/>TRACK</span>
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}