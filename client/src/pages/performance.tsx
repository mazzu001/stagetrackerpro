import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import TransportControls from "@/components/transport-controls";
import AudioMixer from "@/components/audio-mixer";
import LyricsDisplay from "@/components/lyrics-display";
import SongSelector from "@/components/song-selector";
import StatusBar from "@/components/status-bar";
import TrackManager from "@/components/track-manager";
import { useAudioEngine } from "@/hooks/use-audio-engine";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { Settings, Music } from "lucide-react";
import type { SongWithTracks } from "@shared/schema";

export default function Performance() {
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
  const [latency, setLatency] = useState(2.1);

  const { data: selectedSong } = useQuery<SongWithTracks>({
    queryKey: ['/api/songs', selectedSongId],
    enabled: !!selectedSongId
  });

  const {
    isPlaying,
    currentTime,
    duration,
    audioLevels,
    cpuUsage,
    isAudioEngineOnline,
    isMidiConnected,
    play,
    pause,
    stop,
    seek,
    updateTrackVolume,
    updateTrackMute,
    updateTrackSolo,
    updateMasterVolume,
    masterVolume
  } = useAudioEngine(selectedSong);

  useKeyboardShortcuts({
    onPlay: play,
    onPause: pause,
    onStop: stop,
    onTogglePlayback: isPlaying ? pause : play,
    onTrackMute: updateTrackMute,
    isPlaying
  });

  // Simulate latency monitoring
  useEffect(() => {
    const interval = setInterval(() => {
      setLatency(2.0 + Math.random() * 0.5);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="bg-background text-white min-h-screen font-inter">
      {/* Header */}
      <header className="bg-surface border-b border-gray-700 p-4" data-testid="app-header">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Music className="text-primary text-2xl" />
            <h1 className="text-2xl font-bold">StageTracker Pro</h1>
            <span className="bg-primary/20 text-primary px-2 py-1 rounded text-sm">LIVE</span>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-400">
              <span>Latency: </span>
              <span className="text-secondary">{latency.toFixed(1)}ms</span>
            </div>
            <button 
              className="bg-surface hover:bg-gray-700 p-2 rounded-lg transition-colors" 
              title="Settings"
              data-testid="button-settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4 space-y-6">
        {/* Song Selector */}
        <SongSelector 
          selectedSongId={selectedSongId}
          onSongSelect={setSelectedSongId}
        />

        {/* Transport Controls */}
        <TransportControls
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          progress={progress}
          isMidiConnected={isMidiConnected}
          onPlay={play}
          onPause={pause}
          onStop={stop}
          onSeek={seek}
        />

        {/* Track Manager */}
        <TrackManager
          song={selectedSong}
          onTrackUpdate={() => {
            if (selectedSongId) {
              queryClient.invalidateQueries({ queryKey: ['/api/songs', selectedSongId] });
            }
          }}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Audio Mixer */}
          <AudioMixer
            song={selectedSong}
            audioLevels={audioLevels}
            masterVolume={masterVolume}
            onTrackVolumeChange={updateTrackVolume}
            onTrackMuteToggle={updateTrackMute}
            onTrackSoloToggle={updateTrackSolo}
            onMasterVolumeChange={updateMasterVolume}
          />

          {/* Lyrics Display */}
          <LyricsDisplay
            song={selectedSong}
            currentTime={currentTime}
          />
        </div>

        {/* Status Bar */}
        <StatusBar
          isAudioEngineOnline={isAudioEngineOnline}
          isMidiConnected={isMidiConnected}
          cpuUsage={cpuUsage}
        />

        {/* Keyboard Shortcuts */}
        <div className="bg-surface rounded-xl p-4 border border-gray-700">
          <details className="group">
            <summary className="flex items-center justify-between cursor-pointer list-none">
              <span className="text-sm font-medium flex items-center">
                <span className="mr-2 text-gray-400">⌨️</span>
                Keyboard Shortcuts
              </span>
              <span className="group-open:rotate-180 transition-transform">▼</span>
            </summary>
            
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="space-y-2">
                <div className="font-medium text-gray-300">Playback</div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>Play/Pause</span>
                    <kbd className="bg-gray-700 px-2 py-1 rounded text-xs">Space</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span>Stop</span>
                    <kbd className="bg-gray-700 px-2 py-1 rounded text-xs">S</kbd>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="font-medium text-gray-300">Navigation</div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>Previous</span>
                    <kbd className="bg-gray-700 px-2 py-1 rounded text-xs">P</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span>Next</span>
                    <kbd className="bg-gray-700 px-2 py-1 rounded text-xs">N</kbd>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="font-medium text-gray-300">Tracks</div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>Mute 1-6</span>
                    <kbd className="bg-gray-700 px-2 py-1 rounded text-xs">1-6</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span>Solo</span>
                    <kbd className="bg-gray-700 px-2 py-1 rounded text-xs">Ctrl+1-6</kbd>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="font-medium text-gray-300">System</div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>Settings</span>
                    <kbd className="bg-gray-700 px-2 py-1 rounded text-xs">Ctrl+,</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span>Help</span>
                    <kbd className="bg-gray-700 px-2 py-1 rounded text-xs">F1</kbd>
                  </div>
                </div>
              </div>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
