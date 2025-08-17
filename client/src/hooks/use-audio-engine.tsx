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

  // Update audio levels and current time
  const updateAudioData = useCallback(() => {
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
    
    animationFrameRef.current = requestAnimationFrame(updateAudioData);
  }, [isPlaying, duration, song]);

  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(updateAudioData);
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [updateAudioData]);

  const play = useCallback(() => {
    if (audioEngineRef.current && song) {
      audioEngineRef.current.play();
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

  const seek = useCallback((time: number) => {
    if (audioEngineRef.current) {
      audioEngineRef.current.seek(time);
      setCurrentTime(time);
    }
  }, []);

  const updateTrackVolume = useCallback((trackId: string, volume: number) => {
    if (audioEngineRef.current) {
      audioEngineRef.current.setTrackVolume(trackId, volume);
    }
  }, []);

  const updateTrackMute = useCallback((trackId: string) => {
    if (audioEngineRef.current) {
      audioEngineRef.current.toggleTrackMute(trackId);
    }
  }, []);

  const updateTrackSolo = useCallback((trackId: string) => {
    if (audioEngineRef.current) {
      audioEngineRef.current.toggleTrackSolo(trackId);
    }
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
    cpuUsage,
    isAudioEngineOnline,
    isMidiConnected,
    masterVolume,
    play,
    pause,
    stop,
    seek,
    updateTrackVolume,
    updateTrackMute,
    updateTrackSolo,
    updateMasterVolume
  };
}
