import { useEffect, useState } from 'react';

interface VUMeterProps {
  level: number; // 0-100
  isMuted?: boolean;
  isPlaying?: boolean; // Add isPlaying prop like stereo VU meters
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showValue?: boolean;
}

export default function VUMeter({ level, isMuted = false, isPlaying = true, className = "", size = 'md', showValue = true }: VUMeterProps) {
  const [peakLevel, setPeakLevel] = useState(0);

  // Use direct level - no smoothing since audio engine already provides smooth responsive data
  const currentLevel = isMuted || !isPlaying ? 0 : Math.max(0, Math.min(100, level));

  // Simple responsive updates - use the level directly from the responsive audio engine

  // Peak hold with responsive updates
  useEffect(() => {
    if (currentLevel > peakLevel) {
      setPeakLevel(currentLevel);
    } else {
      const decay = () => {
        setPeakLevel(prev => Math.max(currentLevel, prev - 2.0)); // Faster peak decay for responsiveness
      };
      const interval = setInterval(decay, 8); // Faster decay updates
      return () => clearInterval(interval);
    }
  }, [currentLevel, peakLevel]);

  // Create LED segments with direct responsive level
  const segments = 12;
  const activeSegments = Math.floor((currentLevel / 100) * segments);
  const peakSegment = Math.floor((peakLevel / 100) * segments);

  const getSegmentColor = (index: number) => {
    if (isMuted || !isPlaying) return 'bg-gray-700'; // Same inactive color as stereo meters
    
    const percentage = (index / segments) * 100;
    
    if (index === peakSegment - 1 && peakSegment > activeSegments) {
      // Peak indicator - bright with strong glow (SAME AS STEREO)
      if (percentage < 60) return 'bg-green-300 shadow-green-300/70';
      if (percentage < 80) return 'bg-yellow-300 shadow-yellow-300/70';
      return 'bg-red-300 shadow-red-300/70';
    }
    
    if (index < activeSegments) {
      // Active segments - brighter colors with glow (SAME AS STEREO)
      if (percentage < 60) return 'bg-green-400 shadow-green-400/50';
      if (percentage < 80) return 'bg-yellow-400 shadow-yellow-400/50';
      return 'bg-red-400 shadow-red-400/50';
    }
    
    // Inactive segments (SAME AS STEREO)
    if (percentage < 60) return 'bg-green-900/20';
    if (percentage < 80) return 'bg-yellow-900/20';
    return 'bg-red-900/20';
  };

  const sizeClasses = {
    sm: { meter: 'h-12', segment: 'w-3 h-1', text: 'text-xs' },
    md: { meter: 'h-16', segment: 'w-4 h-1', text: 'text-xs' },
    lg: { meter: 'h-20', segment: 'w-5 h-1.5', text: 'text-sm' }
  };

  const classes = sizeClasses[size];

  return (
    <div className={`flex flex-col items-center gap-1 ${className}`}>
      <div className={`flex flex-col-reverse gap-0.5 ${classes.meter}`}>
        {Array.from({ length: segments }, (_, i) => (
          <div
            key={i}
            className={`${classes.segment} rounded-sm transition-all duration-150 ${getSegmentColor(i)}`}
          />
        ))}
      </div>
      {showValue && (
        <div className={`text-gray-500 text-center ${classes.text}`}>
          {Math.round(currentLevel)}%
        </div>
      )}
    </div>
  );
}