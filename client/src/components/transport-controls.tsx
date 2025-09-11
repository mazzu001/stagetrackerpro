import { Button } from "@/components/ui/button";
import { 
  SkipBack, 
  FastForward, 
  Play, 
  Pause, 
  Square, 
  Rewind, 
  SkipForward 
} from "lucide-react";

interface TransportControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  progress: number;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSeek: (time: number) => void;
}

export default function TransportControls({
  isPlaying,
  currentTime,
  duration,
  progress,
  onPlay,
  onPause,
  onStop,
  onSeek
}: TransportControlsProps) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * duration;
    onSeek(newTime);
  };

  return (
    <div className="bg-surface rounded-xl p-6 border border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold flex items-center">
          <Play className="mr-2 text-secondary w-5 h-5" />
          Transport Controls
        </h2>
        <div className="flex items-center space-x-4">
          <div className="text-sm text-gray-400">
            Position: <span className="text-white font-mono">{formatTime(currentTime)} / {formatTime(duration)}</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="text-xs text-gray-400">Audio</span>
            <div className="w-2 h-2 rounded-full bg-secondary" />
          </div>
        </div>
      </div>
      
      <div className="flex items-center justify-center space-x-6">
        <Button
          variant="secondary"
          size="icon"
          className="w-14 h-14 rounded-full bg-gray-700 hover:bg-gray-600"
          title="Previous (P)"
          data-testid="button-previous"
        >
          <SkipBack className="w-5 h-5" />
        </Button>
        
        <Button
          variant="secondary"
          size="icon"
          className="w-14 h-14 rounded-full bg-gray-700 hover:bg-gray-600"
          title="Rewind (R)"
          data-testid="button-rewind"
        >
          <Rewind className="w-5 h-5" />
        </Button>
        
        <Button
          variant={isPlaying ? "default" : "default"}
          size="icon"
          className={`w-20 h-20 rounded-full shadow-lg ${
            isPlaying 
              ? 'bg-secondary hover:bg-green-700' 
              : 'bg-secondary hover:bg-green-700'
          }`}
          title="Play/Pause (Space)"
          onClick={isPlaying ? onPause : onPlay}
          data-testid="button-play-pause"
        >
          {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
        </Button>
        
        <Button
          variant="destructive"
          size="icon"
          className="w-14 h-14 rounded-full bg-error hover:bg-red-700"
          title="Stop (S)"
          onClick={onStop}
          data-testid="button-stop"
        >
          <Square className="w-5 h-5" />
        </Button>
        
        <Button
          variant="secondary"
          size="icon"
          className="w-14 h-14 rounded-full bg-gray-700 hover:bg-gray-600"
          title="Forward (F)"
          data-testid="button-forward"
        >
          <FastForward className="w-5 h-5" />
        </Button>
        
        <Button
          variant="secondary"
          size="icon"
          className="w-14 h-14 rounded-full bg-gray-700 hover:bg-gray-600"
          title="Next (N)"
          data-testid="button-next"
        >
          <SkipForward className="w-5 h-5" />
        </Button>
      </div>
      
      {/* Progress Bar */}
      <div className="mt-6">
        <div 
          className="bg-gray-700 h-2 rounded-full overflow-hidden cursor-pointer"
          onClick={handleProgressClick}
          data-testid="progress-bar"
        >
          <div 
            className="bg-primary h-full transition-all duration-300" 
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
}
