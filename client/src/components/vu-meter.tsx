import { useEffect, useState } from 'react';

interface VUMeterProps {
  level: number; // 0-100
  isMuted?: boolean;
  isPlaying?: boolean; // Add isPlaying prop like stereo VU meters
  className?: string;
}

export default function VUMeter({ level, isMuted = false, isPlaying = true, className = "" }: VUMeterProps) {
  const [animatedLevel, setAnimatedLevel] = useState(0);
  const [peakLevel, setPeakLevel] = useState(0);

  // Use EXACT same logic as the perfectly working stereo VU meters
  useEffect(() => {
    if (isMuted || !isPlaying) {
      setAnimatedLevel(0);
      setPeakLevel(0);
      return;
    }

    // Apply amplification to make meters more reactive - SAME AS STEREO VU METERS
    const amplifiedLevel = level * 1.8; // Exact same amplification as stereo meters
    const targetLevel = Math.max(0, Math.min(100, amplifiedLevel));
    
    const animate = () => {
      setAnimatedLevel(prev => {
        const diff = targetLevel - prev;
        const step = diff * 0.9; // Exact same response speed as stereo meters
        return Math.abs(step) < 0.1 ? targetLevel : prev + step;
      });
    };

    const interval = setInterval(animate, 6); // Exact same update rate as stereo meters
    return () => clearInterval(interval);
  }, [level, isMuted, isPlaying]);

  // Peak hold - SAME AS STEREO VU METERS
  useEffect(() => {
    if (animatedLevel > peakLevel) {
      setPeakLevel(animatedLevel);
    } else {
      const decay = () => {
        setPeakLevel(prev => Math.max(animatedLevel, prev - 1.5)); // Exact same decay as stereo meters
      };
      const interval = setInterval(decay, 15); // Exact same frequency as stereo meters
      return () => clearInterval(interval);
    }
  }, [animatedLevel, peakLevel]);

  // Create LED segments - SAME AS STEREO VU METERS
  const segments = 12; // Same segment count as stereo meters
  const activeSegments = Math.floor((animatedLevel / 100) * segments);
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

  return (
    <div className={`flex items-center justify-center ${className}`}>
      {/* VU Meter Segments - SAME LAYOUT AS STEREO METERS */}
      <div className="flex space-x-0.5 px-1">
        {Array.from({ length: segments }, (_, index) => (
          <div
            key={index}
            className={`w-1 h-4 rounded-sm transition-all duration-75 ${getSegmentColor(index)}`}
            style={{
              boxShadow: (index < activeSegments || index === peakSegment - 1) && !isMuted && isPlaying
                ? getSegmentColor(index).includes('shadow-') 
                  ? '0 0 4px currentColor' 
                  : 'none'
                : 'none'
            }}
          />
        ))}
      </div>
    </div>
  );
}