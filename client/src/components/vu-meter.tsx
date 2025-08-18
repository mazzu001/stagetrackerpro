import { useEffect, useState } from 'react';

interface VUMeterProps {
  level: number; // 0-100
  isMuted?: boolean;
  className?: string;
}

export default function VUMeter({ level, isMuted = false, className = "" }: VUMeterProps) {
  const [animatedLevel, setAnimatedLevel] = useState(0);
  const [peakLevel, setPeakLevel] = useState(0);

  // Smooth animation for level changes
  useEffect(() => {
    if (isMuted) {
      setAnimatedLevel(0);
      setPeakLevel(0);
      return;
    }

    const targetLevel = Math.max(0, Math.min(100, level));
    
    // Smooth interpolation to target level
    const animate = () => {
      setAnimatedLevel(prev => {
        const diff = targetLevel - prev;
        const step = diff * 0.15; // Smooth interpolation factor
        return Math.abs(step) < 0.5 ? targetLevel : prev + step;
      });
    };

    const interval = setInterval(animate, 16); // ~60fps
    return () => clearInterval(interval);
  }, [level, isMuted]);

  // Peak hold functionality
  useEffect(() => {
    if (animatedLevel > peakLevel) {
      setPeakLevel(animatedLevel);
    } else {
      // Decay peak slowly
      const decay = () => {
        setPeakLevel(prev => Math.max(animatedLevel, prev - 0.5));
      };
      const interval = setInterval(decay, 50);
      return () => clearInterval(interval);
    }
  }, [animatedLevel, peakLevel]);

  // Create LED segments
  const segments = 20;
  const segmentWidth = 100 / segments;
  const activeSegments = Math.floor((animatedLevel / 100) * segments);
  const peakSegment = Math.floor((peakLevel / 100) * segments);

  const getSegmentColor = (index: number) => {
    if (isMuted) return 'bg-gray-600';
    
    const percentage = (index / segments) * 100;
    
    if (index === peakSegment - 1 && peakSegment > activeSegments) {
      // Peak indicator
      if (percentage < 70) return 'bg-green-400';
      if (percentage < 85) return 'bg-yellow-400';
      return 'bg-red-400';
    }
    
    if (index < activeSegments) {
      // Active segments
      if (percentage < 70) return 'bg-green-500';
      if (percentage < 85) return 'bg-yellow-500';
      return 'bg-red-500';
    }
    
    // Inactive segments
    if (percentage < 70) return 'bg-green-900/30';
    if (percentage < 85) return 'bg-yellow-900/30';
    return 'bg-red-900/30';
  };

  return (
    <div className={`flex items-center space-x-1 ${className}`}>
      {/* VU Meter Segments */}
      <div className="flex space-x-0.5">
        {Array.from({ length: segments }, (_, index) => (
          <div
            key={index}
            className={`w-1 h-3 rounded-sm transition-colors duration-75 ${getSegmentColor(index)}`}
            style={{
              opacity: index < activeSegments || index === peakSegment - 1 ? 1 : 0.3
            }}
          />
        ))}
      </div>
      
      {/* Level Display */}
      <span className="text-xs text-gray-400 w-8 font-mono">
        {isMuted ? 'M' : `${Math.round(animatedLevel)}`}
      </span>
    </div>
  );
}