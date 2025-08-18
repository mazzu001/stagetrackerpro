import { useEffect, useState } from 'react';

interface VUMeterProps {
  level: number; // 0-100
  isMuted?: boolean;
  className?: string;
}

export default function VUMeter({ level, isMuted = false, className = "" }: VUMeterProps) {
  const [animatedLevel, setAnimatedLevel] = useState(0);
  const [peakLevel, setPeakLevel] = useState(0);

  // Real-time animation for level changes
  useEffect(() => {
    if (isMuted) {
      setAnimatedLevel(0);
      setPeakLevel(0);
      return;
    }

    const targetLevel = Math.max(0, Math.min(100, level));
    
    // Fast interpolation for real-time response
    const animate = () => {
      setAnimatedLevel(prev => {
        const diff = targetLevel - prev;
        // Much faster interpolation for real-time feel
        const step = diff * 0.8; 
        return Math.abs(step) < 0.1 ? targetLevel : prev + step;
      });
    };

    const interval = setInterval(animate, 8); // ~120fps for smoother animation
    return () => clearInterval(interval);
  }, [level, isMuted]);

  // Peak hold functionality
  useEffect(() => {
    if (animatedLevel > peakLevel) {
      setPeakLevel(animatedLevel);
    } else {
      // Faster peak decay for more responsive feel
      const decay = () => {
        setPeakLevel(prev => Math.max(animatedLevel, prev - 2.0));
      };
      const interval = setInterval(decay, 20); // Faster decay updates
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
            className={`w-1 h-3 rounded-sm ${getSegmentColor(index)}`}
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