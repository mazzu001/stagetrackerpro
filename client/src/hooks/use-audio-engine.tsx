import { useState, useEffect, useCallback, useRef } from "react";
import { AudioEngine } from "@/lib/audio-engine";
import type { SongWithTracks } from "@shared/schema";

interface UseAudioEngineProps {
  song?: SongWithTracks;
  onDurationUpdated?: (songId: string, duration: number) => void;
}

export function useAudioEngine(songOrProps?: SongWithTracks | UseAudioEngineProps) {
  // Handle both old and new calling patterns for backwards compatibility
  let song: SongWithTracks | undefined;
  let onDurationUpdated: ((songId: string, duration: number) => void) | undefined;
  
  if (songOrProps && 'song' in songOrProps) {
    // New calling pattern: useAudioEngine({ song, onDurationUpdated })
    song = songOrProps.song;
    onDurationUpdated = songOrProps.onDurationUpdated;
  } else {
    // Old calling pattern: useAudioEngine(song)
    song = songOrProps as SongWithTracks | undefined;
  }
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioLevels, setAudioLevels] = useState<Record<string, number>>({});
  const [masterStereoLevels, setMasterStereoLevels] = useState<{ left: number; right: number }>({ left: 0, right: 0 });
  const [cpuUsage, setCpuUsage] = useState(23);
  const [isAudioEngineOnline, setIsAudioEngineOnline] = useState(true);
  const [isMidiConnected, setIsMidiConnected] = useState(true);
  const [masterVolume, setMasterVolume] = useState(85);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);

  const audioEngineRef = useRef<AudioEngine | null>(null);
  const animationFrameRef = useRef<number>();

  // Initialize audio engine
  useEffect(() => {
    const initAudioEngine = async () => {
      try {
        audioEngineRef.current = new AudioEngine();
        
        // Set up duration update callback
        audioEngineRef.current.onDurationUpdated = (newDuration: number) => {
          console.log(`Duration updated from audio buffers: ${newDuration}s`);
          setDuration(newDuration);
          
          // Save duration to database if callback provided and song is loaded
          if (song && onDurationUpdated) {
            console.log(`Saving updated duration ${newDuration}s to database for song: ${song.title}`);
            onDurationUpdated(song.id, Math.round(newDuration));
          }
        };
        
        await audioEngineRef.current.initialize();
        setIsAudioEngineOnline(true);
      } catch (error) {
        console.error('Failed to initialize audio engine:', error);
        setIsAudioEngineOnline(false);
      }
    };

    initAudioEngine();

    return () => {
      if (audioEngineRef.current) {
        audioEngineRef.current.dispose();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Load song when selected (but not when just mute/solo properties change)
  useEffect(() => {
    if (song && audioEngineRef.current) {
      console.log(`Loading song: "${song.title}" with ${song.tracks.length} tracks`);
      
      audioEngineRef.current.loadSong(song).then(() => {
        console.log(`Finished loading song: "${song.title}"`);
      }).catch((error) => {
        console.error(`Failed to load song: "${song.title}"`, error);
      });
      
      // Don't set duration here - let the audio engine callback handle it
      // setDuration(song.duration); // This overwrites the callback-updated duration
      setCurrentTime(0);
      setIsPlaying(false);
    }
  }, [song?.id, song?.tracks?.length]); // Reload when song ID changes OR when tracks are added/removed

  // Animation loop for real-time updates

  useEffect(() => {
    const animate = () => {
      if (audioEngineRef.current && song) {
        const levels = audioEngineRef.current.getAudioLevels();
        setAudioLevels(levels);
        
        const masterLevels = audioEngineRef.current.getMasterStereoLevels();
        setMasterStereoLevels(masterLevels);
        
        // Update loading state from audio engine
        const engineIsLoading = audioEngineRef.current.getIsLoading();
        if (isLoadingTracks !== engineIsLoading) {
          setIsLoadingTracks(engineIsLoading);
        }
        
        // Use audio engine's state to determine if we should update time
        const engineIsPlaying = audioEngineRef.current.getIsPlaying();
        if (engineIsPlaying) {
          const time = audioEngineRef.current.getCurrentTime();
          setCurrentTime(time);
          
          // Simulate CPU usage fluctuation
          setCpuUsage(20 + Math.random() * 10);
          
          // Auto-stop at end - add debug logging
          if (time >= duration) {
            console.log(`Auto-stopping playback - time: ${time.toFixed(2)}s, duration: ${duration}s`);
            setIsPlaying(false);
            setCurrentTime(duration);
          }
        }
        
        // Sync React state with audio engine state
        if (isPlaying !== engineIsPlaying) {
          setIsPlaying(engineIsPlaying);
        }
      }
      
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, duration, song]);

  const play = useCallback(async () => {
    if (audioEngineRef.current && song) {
      // Check if already playing to prevent multiple calls
      if (audioEngineRef.current.getIsPlaying()) {
        console.log('Already playing, ignoring duplicate play request');
        return;
      }
      
      // Check if song is still loading to prevent race conditions
      if (audioEngineRef.current.getIsLoading()) {
        console.log('Song is still loading, cannot start playback yet');
        return;
      }
      
      await audioEngineRef.current.play();
      setIsPlaying(true);
    }
  }, [song]);

  const pause = useCallback(() => {
    if (audioEngineRef.current) {
      audioEngineRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const stop = useCallback(() => {
    if (audioEngineRef.current) {
      audioEngineRef.current.stop();
      setIsPlaying(false);
      setCurrentTime(0);
    }
  }, []);

  const seek = useCallback(async (time: number) => {
    if (audioEngineRef.current) {
      await audioEngineRef.current.seek(time);
      setCurrentTime(time);
    }
  }, []);

  const updateTrackVolume = useCallback(async (trackId: string, volume: number) => {
    if (audioEngineRef.current) {
      audioEngineRef.current.setTrackVolume(trackId, volume);
    }
    // Note: Volume updates are handled by TrackManager component via LocalSongStorage
  }, []);

  const updateTrackBalance = useCallback(async (trackId: string, balance: number) => {
    if (audioEngineRef.current) {
      audioEngineRef.current.setTrackBalance(trackId, balance);
    }
    // Note: Balance updates are handled by TrackManager component via LocalSongStorage
  }, []);

  const updateTrackMute = useCallback(async (trackId: string) => {
    if (audioEngineRef.current) {
      audioEngineRef.current.toggleTrackMute(trackId);
    }
    // Note: Mute state updates are handled by TrackManager component via LocalSongStorage
  }, []);

  const updateTrackSolo = useCallback(async (trackId: string) => {
    if (audioEngineRef.current) {
      audioEngineRef.current.toggleTrackSolo(trackId);
    }
    // Note: Solo state updates are handled by TrackManager component via LocalSongStorage
  }, []);

  const updateMasterVolume = useCallback((volume: number) => {
    if (audioEngineRef.current) {
      audioEngineRef.current.setMasterVolume(volume);
      setMasterVolume(volume);
    }
  }, []);

  return {
    isPlaying,
    currentTime,
    duration,
    audioLevels,
    masterStereoLevels,
    cpuUsage,
    isAudioEngineOnline,
    isMidiConnected,
    masterVolume,
    isLoadingTracks,
    play,
    pause,
    stop,
    seek,
    updateTrackVolume,
    updateTrackBalance,
    updateTrackMute,
    updateTrackSolo,
    updateMasterVolume
  };
}
