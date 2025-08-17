import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Headphones, Volume2, VolumeX, Sliders } from "lucide-react";
import type { SongWithTracks } from "@shared/schema";

interface AudioMixerProps {
  song?: SongWithTracks;
  audioLevels: Record<string, number>;
  masterVolume: number;
  onTrackVolumeChange: (trackId: string, volume: number) => void;
  onTrackMuteToggle: (trackId: string) => void;
  onTrackSoloToggle: (trackId: string) => void;
  onMasterVolumeChange: (volume: number) => void;
}

export default function AudioMixer({
  song,
  audioLevels,
  masterVolume,
  onTrackVolumeChange,
  onTrackMuteToggle,
  onTrackSoloToggle,
  onMasterVolumeChange
}: AudioMixerProps) {
  const formatDbLevel = (level: number) => {
    if (level === 0) return "-∞dB";
    const db = 20 * Math.log10(level / 100);
    return `${db > 0 ? '+' : ''}${db.toFixed(0)}dB`;
  };

  const getLevelColor = (level: number) => {
    if (level < 70) return 'bg-secondary';
    if (level < 85) return 'bg-accent';
    return 'bg-error';
  };

  if (!song) {
    return (
      <div className="bg-surface rounded-xl p-6 border border-gray-700">
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <Sliders className="mr-2 text-accent w-5 h-5" />
          Audio Mixer
        </h2>
        <div className="text-center py-8 text-gray-400">
          Select a song to see audio mixer controls
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-xl p-4 border border-gray-700">
      <h2 className="text-lg font-semibold mb-4 flex items-center">
        <Sliders className="mr-2 text-accent w-5 h-5" />
        Audio Mixer
      </h2>
      
      <div className="space-y-3">
        {song.tracks.map((track, index) => {
          const level = audioLevels[track.id] || 0;
          const dbLevel = track.isMuted ? 0 : level;
          
          return (
            <div 
              key={track.id} 
              className="track-card bg-gray-800 p-3 rounded-lg border border-gray-600 hover:shadow-lg transition-all duration-200"
              data-testid={`track-${track.trackNumber}`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <span className="text-sm font-medium text-gray-400">
                    Track {track.trackNumber}
                  </span>
                  <h4 className="font-medium">{track.name}</h4>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant={track.isSolo ? "default" : "secondary"}
                    size="sm"
                    className={`w-8 h-8 rounded-full p-0 ${
                      track.isSolo 
                        ? 'bg-secondary hover:bg-green-700' 
                        : 'bg-gray-600 hover:bg-secondary'
                    }`}
                    title="Solo"
                    onClick={() => onTrackSoloToggle(track.id)}
                    data-testid={`button-solo-${track.trackNumber}`}
                  >
                    <Headphones className="w-3 h-3" />
                  </Button>
                  <Button
                    variant={track.isMuted ? "destructive" : "secondary"}
                    size="sm"
                    className={`w-8 h-8 rounded-full p-0 ${
                      track.isMuted 
                        ? 'bg-error hover:bg-red-700' 
                        : 'bg-gray-600 hover:bg-error'
                    }`}
                    title={`Mute (${track.trackNumber})`}
                    onClick={() => onTrackMuteToggle(track.id)}
                    data-testid={`button-mute-${track.trackNumber}`}
                  >
                    {track.isMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                  </Button>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="flex-1">
                  <Slider
                    value={[track.volume || 100]}
                    max={100}
                    step={1}
                    disabled={track.isMuted || false}
                    onValueChange={([value]) => onTrackVolumeChange(track.id, value)}
                    className={`w-full ${track.isMuted ? 'opacity-50' : ''}`}
                    data-testid={`slider-volume-${track.trackNumber}`}
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>0</span>
                    <span className={track.isMuted ? 'text-error' : ''}>
                      {track.isMuted ? 'MUTED' : `${track.volume}%`}
                    </span>
                    <span>100</span>
                  </div>
                </div>
                <div className="w-16">
                  <div className="h-2 rounded-full overflow-hidden bg-gray-700">
                    <div 
                      className={`h-full transition-all duration-100 ${getLevelColor(level)}`}
                      style={{ width: `${track.isMuted ? 0 : level}%` }}
                      data-testid={`level-meter-${track.trackNumber}`}
                    />
                  </div>
                  <div className="text-xs text-gray-400 text-center mt-1">
                    {formatDbLevel(dbLevel)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 pt-4 border-t border-gray-600">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Master Volume</span>
          <span className="text-sm text-gray-400">{masterVolume}%</span>
        </div>
        <div className="mt-2">
          <Slider
            value={[masterVolume]}
            max={100}
            step={1}
            onValueChange={([value]) => onMasterVolumeChange(value)}
            className="w-full"
            data-testid="slider-master-volume"
          />
        </div>
      </div>
    </div>
  );
}
