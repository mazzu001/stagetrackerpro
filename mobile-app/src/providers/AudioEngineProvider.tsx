import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { useDatabase } from './DatabaseProvider';
import { useLocalAuth } from '../hooks/useLocalAuth';

interface AudioLevels {
  [trackId: string]: {
    left: number;
    right: number;
  };
}

interface AudioEngineContextType {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  masterVolume: number;
  audioLevels: AudioLevels;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  stop: () => Promise<void>;
  seek: (position: number) => Promise<void>;
  setMasterVolume: (volume: number) => void;
  loadSong: (songId: string) => Promise<void>;
  updateTrackVolume: (trackId: string, volume: number) => void;
  updateTrackMute: (trackId: string, muted: boolean) => void;
  updateTrackSolo: (trackId: string, solo: boolean) => void;
  updateTrackBalance: (trackId: string, balance: number) => void;
  currentSongId: string | null;
}

const AudioEngineContext = createContext<AudioEngineContextType | null>(null);

export const useAudioEngine = () => {
  const context = useContext(AudioEngineContext);
  if (!context) {
    throw new Error('useAudioEngine must be used within an AudioEngineProvider');
  }
  return context;
};

interface AudioPlayer {
  sound: Audio.Sound;
  trackId: string;
  volume: number;
  muted: boolean;
  solo: boolean;
  balance: number;
}

export default function AudioEngineProvider({ children }: { children: React.ReactNode }) {
  const { getTracksBySong, updateTrack } = useDatabase();
  const { user } = useLocalAuth();
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [masterVolume, setMasterVolume] = useState(0.8);
  const [audioLevels, setAudioLevels] = useState<AudioLevels>({});
  const [currentSongId, setCurrentSongId] = useState<string | null>(null);
  
  const audioPlayers = useRef<AudioPlayer[]>([]);
  const positionUpdateInterval = useRef<NodeJS.Timeout | null>(null);
  const levelUpdateInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setupAudioMode();
    return () => {
      cleanup();
    };
  }, []);

  const setupAudioMode = async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: true,
        interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
        playThroughEarpieceAndroid: false,
      });
    } catch (error) {
      console.warn('Failed to set audio mode:', error);
    }
  };

  const cleanup = async () => {
    if (positionUpdateInterval.current) {
      clearInterval(positionUpdateInterval.current);
    }
    if (levelUpdateInterval.current) {
      clearInterval(levelUpdateInterval.current);
    }

    for (const player of audioPlayers.current) {
      try {
        await player.sound.unloadAsync();
      } catch (error) {
        console.warn('Failed to unload sound:', error);
      }
    }
    audioPlayers.current = [];
  };

  const loadSong = async (songId: string): Promise<void> => {
    try {
      await cleanup();
      
      const tracks = getTracksBySong(songId);
      const players: AudioPlayer[] = [];
      
      for (const track of tracks) {
        try {
          // Check if file exists
          const fileInfo = await FileSystem.getInfoAsync(track.filePath);
          if (!fileInfo.exists) {
            console.warn(`Audio file not found: ${track.filePath}`);
            continue;
          }

          const { sound } = await Audio.Sound.createAsync(
            { uri: track.filePath },
            { 
              shouldPlay: false,
              volume: track.volume * masterVolume,
              isMuted: track.muted,
              positionMillis: 0,
            }
          );

          players.push({
            sound,
            trackId: track.id,
            volume: track.volume,
            muted: track.muted,
            solo: track.solo,
            balance: track.balance,
          });

          // Get duration from first track
          if (players.length === 1) {
            const status = await sound.getStatusAsync();
            if (status.isLoaded && status.durationMillis) {
              setDuration(status.durationMillis / 1000);
            }
          }
        } catch (error) {
          console.error(`Failed to load track ${track.name}:`, error);
        }
      }

      audioPlayers.current = players;
      setCurrentSongId(songId);
      setCurrentTime(0);
      
      console.log(`Loaded ${players.length} tracks for song ${songId}`);
    } catch (error) {
      console.error('Failed to load song:', error);
      throw error;
    }
  };

  const play = async (): Promise<void> => {
    try {
      if (audioPlayers.current.length === 0) {
        throw new Error('No tracks loaded');
      }

      // Start all tracks simultaneously for better sync
      const playPromises = audioPlayers.current.map(player => player.sound.playAsync());
      await Promise.all(playPromises);
      
      setIsPlaying(true);
      startPositionUpdates();
      startLevelUpdates();
    } catch (error) {
      console.error('Failed to play:', error);
      throw error;
    }
  };

  const pause = async (): Promise<void> => {
    try {
      const pausePromises = audioPlayers.current.map(player => player.sound.pauseAsync());
      await Promise.all(pausePromises);
      
      setIsPlaying(false);
      stopPositionUpdates();
      stopLevelUpdates();
    } catch (error) {
      console.error('Failed to pause:', error);
      throw error;
    }
  };

  const stop = async (): Promise<void> => {
    try {
      const stopPromises = audioPlayers.current.map(player => player.sound.stopAsync());
      await Promise.all(stopPromises);
      
      setIsPlaying(false);
      setCurrentTime(0);
      stopPositionUpdates();
      stopLevelUpdates();
    } catch (error) {
      console.error('Failed to stop:', error);
      throw error;
    }
  };

  const seek = async (position: number): Promise<void> => {
    try {
      const positionMillis = position * 1000;
      const seekPromises = audioPlayers.current.map(player => 
        player.sound.setPositionAsync(positionMillis)
      );
      await Promise.all(seekPromises);
      
      setCurrentTime(position);
    } catch (error) {
      console.error('Failed to seek:', error);
      throw error;
    }
  };

  const updateTrackVolume = (trackId: string, volume: number) => {
    const player = audioPlayers.current.find(p => p.trackId === trackId);
    if (player) {
      player.volume = volume;
      const effectiveVolume = calculateEffectiveVolume(player);
      player.sound.setVolumeAsync(effectiveVolume);
      
      // Update database
      updateTrack(trackId, { volume });
    }
  };

  const updateTrackMute = (trackId: string, muted: boolean) => {
    const player = audioPlayers.current.find(p => p.trackId === trackId);
    if (player) {
      player.muted = muted;
      const effectiveVolume = calculateEffectiveVolume(player);
      player.sound.setVolumeAsync(effectiveVolume);
      
      // Update database
      updateTrack(trackId, { muted });
    }
  };

  const updateTrackSolo = (trackId: string, solo: boolean) => {
    const player = audioPlayers.current.find(p => p.trackId === trackId);
    if (player) {
      player.solo = solo;
      
      // Update all track volumes based on solo state
      updateAllTrackVolumes();
      
      // Update database
      updateTrack(trackId, { solo });
    }
  };

  const updateTrackBalance = (trackId: string, balance: number) => {
    const player = audioPlayers.current.find(p => p.trackId === trackId);
    if (player) {
      player.balance = balance;
      // Note: Expo AV doesn't support pan/balance directly
      // This would require a more advanced audio library
      
      // Update database
      updateTrack(trackId, { balance });
    }
  };

  const calculateEffectiveVolume = (player: AudioPlayer): number => {
    if (player.muted) return 0;
    
    // Check if any track is soloed
    const hasSoloedTracks = audioPlayers.current.some(p => p.solo);
    if (hasSoloedTracks && !player.solo) return 0;
    
    return player.volume * masterVolume;
  };

  const updateAllTrackVolumes = () => {
    audioPlayers.current.forEach(player => {
      const effectiveVolume = calculateEffectiveVolume(player);
      player.sound.setVolumeAsync(effectiveVolume);
    });
  };

  const startPositionUpdates = () => {
    positionUpdateInterval.current = setInterval(async () => {
      if (audioPlayers.current.length > 0) {
        try {
          const status = await audioPlayers.current[0].sound.getStatusAsync();
          if (status.isLoaded && status.positionMillis !== undefined) {
            setCurrentTime(status.positionMillis / 1000);
          }
        } catch (error) {
          console.warn('Failed to get position:', error);
        }
      }
    }, 100);
  };

  const stopPositionUpdates = () => {
    if (positionUpdateInterval.current) {
      clearInterval(positionUpdateInterval.current);
      positionUpdateInterval.current = null;
    }
  };

  const startLevelUpdates = () => {
    // Simplified level simulation since Expo AV doesn't provide real-time levels
    levelUpdateInterval.current = setInterval(() => {
      const levels: AudioLevels = {};
      audioPlayers.current.forEach(player => {
        const effectiveVolume = calculateEffectiveVolume(player);
        const simulatedLevel = isPlaying ? effectiveVolume * (0.3 + Math.random() * 0.7) : 0;
        levels[player.trackId] = {
          left: simulatedLevel,
          right: simulatedLevel
        };
      });
      setAudioLevels(levels);
    }, 50);
  };

  const stopLevelUpdates = () => {
    if (levelUpdateInterval.current) {
      clearInterval(levelUpdateInterval.current);
      levelUpdateInterval.current = null;
    }
    setAudioLevels({});
  };

  const value: AudioEngineContextType = {
    isPlaying,
    currentTime,
    duration,
    masterVolume,
    audioLevels,
    play,
    pause,
    stop,
    seek,
    setMasterVolume: (volume: number) => {
      setMasterVolume(volume);
      updateAllTrackVolumes();
    },
    loadSong,
    updateTrackVolume,
    updateTrackMute,
    updateTrackSolo,
    updateTrackBalance,
    currentSongId,
  };

  return (
    <AudioEngineContext.Provider value={value}>
      {children}
    </AudioEngineContext.Provider>
  );
}