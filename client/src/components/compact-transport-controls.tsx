import { Button } from "@/components/ui/button";
import { 
  SkipBack, 
  Play, 
  Pause, 
  Square, 
  SkipForward 
} from "lucide-react";

interface CompactTransportControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isMidiConnected: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
}

export default function CompactTransportControls({
  isPlaying,
  currentTime,
  duration,
  isMidiConnected,
  onPlay,
  onPause,
  onStop
}: CompactTransportControlsProps) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };


  return (
    <div className="bg-surface border border-gray-700 rounded-lg p-3 w-full">
      {/* Transport Controls Row */}
      <div className="flex items-center justify-center space-x-4 md:space-x-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-10 h-10 md:w-8 md:h-8 p-0 hover:bg-gray-700 touch-target"
          title="Previous (P)"
          data-testid="button-previous"
        >
          <SkipBack className="w-5 h-5 md:w-4 md:h-4" />
        </Button>
        
        <Button
          variant={isPlaying ? "default" : "default"}
          size="sm"
          className={`w-14 h-14 md:w-10 md:h-10 rounded-full touch-target ${
            isPlaying 
              ? 'bg-secondary hover:bg-green-700' 
              : 'bg-secondary hover:bg-green-700'
          }`}
          title="Play/Pause (Space)"
          onClick={isPlaying ? onPause : onPlay}
          data-testid="button-play-pause"
        >
          {isPlaying ? <Pause className="w-6 h-6 md:w-4 md:h-4" /> : <Play className="w-6 h-6 md:w-4 md:h-4 ml-0.5" />}
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          className="w-10 h-10 md:w-8 md:h-8 p-0 hover:bg-red-700 touch-target"
          title="Stop (S)"
          onClick={onStop}
          data-testid="button-stop"
        >
          <Square className="w-5 h-5 md:w-4 md:h-4" />
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          className="w-10 h-10 md:w-8 md:h-8 p-0 hover:bg-gray-700 touch-target"
          title="Next (N)"
          data-testid="button-next"
        >
          <SkipForward className="w-5 h-5 md:w-4 md:h-4" />
        </Button>
      </div>

      {/* Time Display */}
      <div className="flex justify-between items-center text-xs text-gray-400 mt-3">
        <span className="font-mono">{formatTime(currentTime)}</span>
        <span className="font-mono">{formatTime(duration)}</span>
      </div>
    </div>
  );
}