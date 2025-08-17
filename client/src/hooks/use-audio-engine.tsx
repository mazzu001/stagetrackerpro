import { useState, useEffect, useCallback, useRef } from "react";
import { AudioEngine } from "@/lib/audio-engine";
import type { SongWithTracks } from "@shared/schema";

export function useAudioEngine(song?: SongWithTracks) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioLevels, setAudioLevels] = useState<Record<string, number>>({});
  const [cpuUsage, setCpuUsage] = useState(23);
  const [isAudioEngineOnline, setIsAudioEngineOnline] = useState(true);
  const [isMidiConnected, setIsMidiConnected] = useState(true);
  const [masterVolume, setMasterVolume] = useState(85);

  const audioEngineRef = useRef<AudioEngine | null>(null);
  const animationFrameRef = useRef<number>();

  // Initialize audio engine
  useEffect(() => {
    const initAudioEngine = async () => {
      try {
        audioEngineRef.current = new AudioEngine();
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

  // Load song when selected
  useEffect(() => {
    if (song && audioEngineRef.current) {
      audioEngineRef.current.loadSong(song);
      setDuration(song.duration);
      setCurrentTime(0);
      setIsPlaying(false);
    }
  }, [song]);

  // Animation loop for real-time updates

  useEffect(() => {
    const animate = () => {
      if (audioEngineRef.current && song) {
        const levels = audioEngineRef.current.getAudioLevels();
        setAudioLevels(levels);
        
        if (isPlaying) {
          const time = audioEngineRef.current.getCurrentTime();
          setCurrentTime(time);
          
          // Simulate CPU usage fluctuation
          setCpuUsage(20 + Math.random() * 10);
          
          // Auto-stop at end
          if (time >= duration) {
            setIsPlaying(false);
            setCurrentTime(duration);
          }
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
      // Wait for all tracks to be ready if song was just loaded
      let loadedCount = audioEngineRef.current.getLoadedTrackCount();
      let attempts = 0;
      const maxAttempts = 20; // Max 10 seconds (20 * 500ms)
      
      while (loadedCount < song.tracks.length && attempts < maxAttempts) {
        console.log(`Waiting for all tracks to load (${loadedCount}/${song.tracks.length})...`);
        await new Promise(resolve => setTimeout(resolve, 500));
        loadedCount = audioEngineRef.current.getLoadedTrackCount();
        attempts++;
      }
      
      if (loadedCount < song.tracks.length) {
        console.warn(`Timeout waiting for tracks to load. Playing with ${loadedCount}/${song.tracks.length} tracks.`);
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
    
    // Update volume in database
    if (song) {
      try {
        await fetch(`/api/tracks/${trackId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ volume })
        });
      } catch (error) {
        console.error('Failed to update track volume in database:', error);
      }
    }
  }, [song]);

  const updateTrackBalance = useCallback(async (trackId: string, balance: number) => {
    if (audioEngineRef.current) {
      audioEngineRef.current.setTrackBalance(trackId, balance);
    }
    
    // Update balance in database
    if (song) {
      try {
        await fetch(`/api/tracks/${trackId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ balance })
        });
      } catch (error) {
        console.error('Failed to update track balance in database:', error);
      }
    }
  }, [song]);

  const updateTrackMute = useCallback(async (trackId: string) => {
    if (audioEngineRef.current) {
      audioEngineRef.current.toggleTrackMute(trackId);
    }
    
    // Update mute state in database
    if (song) {
      const track = song.tracks.find(t => t.id === trackId);
      if (track) {
        try {
          await fetch(`/api/tracks/${trackId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isMuted: !track.isMuted })
          });
        } catch (error) {
          console.error('Failed to update track mute state in database:', error);
        }
      }
    }
  }, [song]);

  const updateTrackSolo = useCallback(async (trackId: string) => {
    if (audioEngineRef.current) {
      audioEngineRef.current.toggleTrackSolo(trackId);
    }
    
    // Update solo state in database
    if (song) {
      const track = song.tracks.find(t => t.id === trackId);
      if (track) {
        try {
          await fetch(`/api/tracks/${trackId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isSolo: !track.isSolo })
          });
        } catch (error) {
          console.error('Failed to update track solo state in database:', error);
        }
      }
    }
  }, [song]);

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
    cpuUsage,
    isAudioEngineOnline,
    isMidiConnected,
    masterVolume,
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
