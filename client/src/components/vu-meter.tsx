import { useEffect, useState, useRef } from 'react';

interface VUMeterProps {
  level: number; // 0-100
  isMuted?: boolean;
  className?: string;
}

export default function VUMeter({ level, isMuted = false, className = "" }: VUMeterProps) {
  const [animatedLevel, setAnimatedLevel] = useState(0);
  const [peakLevel, setPeakLevel] = useState(0);
  const animationFrameRef = useRef<number>();
  const lastUpdateRef = useRef<number>(0);
  const targetLevelRef = useRef<number>(0);
  const currentLevelRef = useRef<number>(0);
  const peakLevelRef = useRef<number>(0);
  const peakHoldTimeRef = useRef<number>(0);

  // Single requestAnimationFrame loop for smooth 60fps animation
  useEffect(() => {
    if (isMuted) {
      setAnimatedLevel(0);
      setPeakLevel(0);
      currentLevelRef.current = 0;
      peakLevelRef.current = 0;
      targetLevelRef.current = 0;
      return;
    }

    // Conservative level scaling for professional VU meter behavior
    const amplifiedLevel = Math.min(Math.pow(level * 0.8, 0.9), 1) * 100;
    targetLevelRef.current = Math.max(0, Math.min(100, amplifiedLevel));

    const animate = (timestamp: number) => {
      const deltaTime = timestamp - lastUpdateRef.current;
      
      // Only update if enough time has passed (60fps = ~16.67ms)
      if (deltaTime >= 16) {
        // Smooth level interpolation
        const diff = targetLevelRef.current - currentLevelRef.current;
        const smoothingFactor = Math.min(1, deltaTime / 50); // Adaptive smoothing based on frame time
        currentLevelRef.current += diff * smoothingFactor * 0.9; // Fast response
        
        // Peak detection and hold
        const currentTime = timestamp;
        if (currentLevelRef.current > peakLevelRef.current) {
          peakLevelRef.current = currentLevelRef.current;
          peakHoldTimeRef.current = currentTime;
        } else if (currentTime - peakHoldTimeRef.current > 500) { // Hold peak for 500ms
          // Smooth peak decay
          peakLevelRef.current = Math.max(currentLevelRef.current, peakLevelRef.current - (deltaTime * 0.1));
        }

        // Update state only when values change significantly (reduces React re-renders)
        const newLevel = Math.round(currentLevelRef.current * 10) / 10;
        const newPeak = Math.round(peakLevelRef.current * 10) / 10;
        
        setAnimatedLevel(prev => Math.abs(prev - newLevel) > 0.1 ? newLevel : prev);
        setPeakLevel(prev => Math.abs(prev - newPeak) > 0.1 ? newPeak : prev);
        
        lastUpdateRef.current = timestamp;
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [level, isMuted]);

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
      if (percentage < 88) return 'bg-yellow-400';
      return 'bg-red-400';
    }
    
    if (index < activeSegments) {
      // Active segments
      if (percentage < 70) return 'bg-green-500';
      if (percentage < 88) return 'bg-yellow-500';
      return 'bg-red-500';
    }
    
    // Inactive segments
    if (percentage < 70) return 'bg-green-900/30';
    if (percentage < 88) return 'bg-yellow-900/30';
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