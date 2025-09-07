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
import ProfessionalStereoVUMeter from "@/components/professional-stereo-vu-meter";
import { ClickTrackGenerator, type ClickTrackConfig, type MetronomeSound } from "@/lib/click-track-generator";


import type { Track, SongWithTracks } from "@shared/schema";

interface TrackManagerProps {
  song?: SongWithTracks;
  onSongUpdate?: (updatedSong: SongWithTracks) => void;
  onTrackVolumeChange?: (trackId: string, volume: number) => void;
  onTrackMuteToggle?: (trackId: string) => void;
  onTrackSoloToggle?: (trackId: string) => void;
  onTrackBalanceChange?: (trackId: string, balance: number) => void;
  // Pitch and speed control removed
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
  // onSpeedChange removed
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
  // Metronome controls from song data
  const [bpm, setBpm] = useState<string>(song?.metronomeBpm || "120.0000");
  const [countIn, setCountIn] = useState(song?.metronomeCountIn || false);
  const [metronomeOn, setMetronomeOn] = useState(song?.metronomeOn || false);
  const [wholeSong, setWholeSong] = useState(song?.metronomeWholeSong || false);
  const [soundType, setSoundType] = useState<MetronomeSound>('woodblock'); // Default to woodblock (nicer sound)
  
  // Metronome audio setup
  const audioContextRef = useRef<AudioContext | null>(null);
  const clickTrackRef = useRef<ClickTrackGenerator | null>(null);
  const isMetronomePlayingRef = useRef<boolean>(false);
  
  // Pitch and speed control removed

  // Recording state
  // Recording features removed for simplicity

  const { toast } = useToast();
  const { user } = useLocalAuth();
  const debounceTimeouts = useRef<Record<string, NodeJS.Timeout>>({});

  // Get tracks for the current song
  const tracks = song?.tracks || [];

  // Update song when metronome settings change
  const updateSongMetronome = useCallback((updates: Partial<{ metronomeBpm: string; metronomeCountIn: boolean; metronomeOn: boolean; metronomeWholeSong: boolean }>) => {
    if (song?.id && user?.email) {
      LocalSongStorage.updateSong(user.email, song.id, updates);
      onSongUpdate?.({ ...song, ...updates });
    }
  }, [song, user?.email, onSongUpdate]);

  useEffect(() => {
    updateSongMetronome({ metronomeBpm: bpm });
  }, [bpm, updateSongMetronome]);

  useEffect(() => {
    updateSongMetronome({ metronomeCountIn: countIn });
  }, [countIn, updateSongMetronome]);

  useEffect(() => {
    updateSongMetronome({ metronomeOn: metronomeOn });
  }, [metronomeOn, updateSongMetronome]);

  useEffect(() => {
    updateSongMetronome({ metronomeWholeSong: wholeSong });
  }, [wholeSong, updateSongMetronome]);

  // Sync metronome state when song changes
  useEffect(() => {
    if (song) {
      setBpm(song.metronomeBpm || "120.0000");
      setCountIn(song.metronomeCountIn || false);
      setMetronomeOn(song.metronomeOn || false);
      setWholeSong(song.metronomeWholeSong || false);
    }
  }, [song?.id]);

  // Initialize metronome audio system
  useEffect(() => {
    const initializeAudio = () => {
      try {
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContext();
          console.log('🎯 AudioContext initialized for metronome');
        }
        
        if (!clickTrackRef.current && audioContextRef.current) {
          clickTrackRef.current = new ClickTrackGenerator(audioContextRef.current);
          console.log('🎯 ClickTrackGenerator initialized');
        }
      } catch (error) {
        console.error('Failed to initialize metronome audio:', error);
      }
    };

    initializeAudio();

    return () => {
      // Cleanup when component unmounts
      if (clickTrackRef.current) {
        clickTrackRef.current.destroy();
        clickTrackRef.current = null;
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, []);

  // Handle metronome control based on playback state and settings
  const handleMetronome = useCallback(() => {
    if (!clickTrackRef.current || !audioContextRef.current) {
      console.warn('Metronome audio not initialized');
      return;
    }

    const bpmNumber = parseFloat(bpm) || 120;
    
    const config: ClickTrackConfig = {
      bpm: bpmNumber,
      countInMeasures: 1, // 1 measure count-in
      volume: 0.6,
      enabled: metronomeOn,
      accentDownbeat: true,
      soundType: soundType
    };

    // If metronome is off, stop any playing metronome
    if (!metronomeOn) {
      clickTrackRef.current.stop();
      isMetronomePlayingRef.current = false;
      return;
    }

    // Handle different metronome modes
    if (isPlaying && wholeSong) {
      // Continuous metronome during song playback
      if (!isMetronomePlayingRef.current) {
        clickTrackRef.current.startContinuous(config);
        isMetronomePlayingRef.current = true;
        console.log('🎯 Started continuous metronome for whole song');
      }
    } else if (isPlaying && countIn) {
      // Count-in only when starting playback
      if (!isMetronomePlayingRef.current) {
        clickTrackRef.current.startCountIn(config, () => {
          // Count-in complete, stop metronome if not whole song mode
          if (!wholeSong) {
            isMetronomePlayingRef.current = false;
          }
        });
        isMetronomePlayingRef.current = true;
        console.log('🎯 Started count-in metronome');
      }
    } else if (!isPlaying) {
      // Stop metronome when playback stops
      clickTrackRef.current.stop();
      isMetronomePlayingRef.current = false;
    }
  }, [metronomeOn, bpm, countIn, wholeSong, isPlaying, soundType]);

  // Update metronome when relevant settings change
  useEffect(() => {
    handleMetronome();
  }, [handleMetronome]);

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
    <div className="w-full space-y-4 max-h-[70vh] overflow-y-auto pr-2">
      {/* Header with controls */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">Track Manager</h3>
            {tracks.length > 0 && (
              <span className="text-sm text-gray-500">({tracks.length} track{tracks.length !== 1 ? 's' : ''})</span>
            )}
          </div>

          {/* Metronome Controls */}
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium text-xs text-gray-700 dark:text-gray-300">🎵</span>
            <select
              value={soundType}
              onChange={(e) => setSoundType(e.target.value as MetronomeSound)}
              className="h-7 px-2 text-xs border rounded dark:bg-gray-700 dark:border-gray-600 bg-[#0d1216]"
              title="Metronome sound type"
            >
              <option value="woodblock">Wood</option>
              <option value="hihat">Hi-Hat</option>
              <option value="square">Beep</option>
              <option value="sine">Pure</option>
              <option value="triangle">Warm</option>
              <option value="kick">Kick</option>
            </select>
            <Input 
              type="number" 
              placeholder="BPM" 
              step="0.0001"
              min="1"
              value={bpm}
              onChange={(e) => setBpm(e.target.value)}
              className="w-24 h-7 text-xs px-2"
            />
            <Button
              onClick={() => setCountIn(!countIn)}
              variant="ghost"
              size="sm"
              className={`h-7 w-10 p-0 transition-all text-xs font-bold ${
                countIn 
                  ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/50' 
                  : 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-400 dark:hover:bg-gray-500'
              }`}
              title={countIn ? "Turn count-in off" : "Turn count-in on"}
            >
              CI
            </Button>
            <Button
              onClick={() => setWholeSong(!wholeSong)}
              variant="ghost"
              size="sm"
              className={`h-7 w-10 p-0 transition-all text-xs font-bold ${
                wholeSong 
                  ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/50' 
                  : 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-400 dark:hover:bg-gray-500'
              }`}
              title={wholeSong ? "Turn whole song off" : "Turn whole song on"}
            >
              WS
            </Button>
            <Button
              onClick={() => setMetronomeOn(!metronomeOn)}
              variant="ghost"
              size="sm"
              className={`h-7 w-12 p-0 transition-all text-xs font-bold ${
                metronomeOn 
                  ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/50' 
                  : 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-400 dark:hover:bg-gray-500'
              }`}
              title={metronomeOn ? "Turn metronome off" : "Turn metronome on"}
            >
              {metronomeOn ? 'ON' : 'OFF'}
            </Button>
          </div>
          
          {/* Main action buttons */}
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
                      <ProfessionalStereoVUMeter 
                        leftLevel={level} 
                        rightLevel={level}
                        isPlaying={isPlaying}
                        size="sm"
                        horizontal={true}
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