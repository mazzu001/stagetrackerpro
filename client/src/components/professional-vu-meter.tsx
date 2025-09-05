import { useEffect, useState, useRef } from 'react';

interface ProfessionalVUMeterProps {
  level: number; // Expected range: 0-100
  isMuted?: boolean;
  isPlaying?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showValue?: boolean;
  label?: string;
}

export default function ProfessionalVUMeter({ 
  level, 
  isMuted = false, 
  isPlaying = true, 
  className = "", 
  size = 'md', 
  showValue = false,
  label 
}: ProfessionalVUMeterProps) {
  const [displayLevel, setDisplayLevel] = useState(0);
  const [peakLevel, setPeakLevel] = useState(0);
  const animationRef = useRef<number>();
  const lastUpdateRef = useRef<number>(0);

  // Smooth level animation with proper falloff
  useEffect(() => {
    if (!isPlaying || isMuted) {
      setDisplayLevel(0);
      setPeakLevel(0);
      return;
    }

    const targetLevel = Math.max(0, Math.min(100, level));
    
    const animate = () => {
      const now = performance.now();
      const deltaTime = now - lastUpdateRef.current;
      lastUpdateRef.current = now;

      setDisplayLevel(prev => {
        // Fast attack, slower decay for natural VU meter behavior
        if (targetLevel > prev) {
          // Attack: 95% of the way to target immediately
          return prev + (targetLevel - prev) * 0.95;
        } else {
          // Decay: slower falloff based on time
          const decayRate = Math.max(0.85, 1 - (deltaTime / 1000) * 2);
          return Math.max(targetLevel, prev * decayRate);
        }
      });

      // Peak hold logic
      setPeakLevel(prev => {
        if (targetLevel > prev) {
          return targetLevel;
        } else {
          // Peak decay over time
          const peakDecayRate = Math.max(0.98, 1 - (deltaTime / 1000) * 0.5);
          return Math.max(targetLevel, prev * peakDecayRate);
        }
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    lastUpdateRef.current = performance.now();
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [level, isPlaying, isMuted]);

  // Professional VU meter configuration
  const segments = 20; // More segments for professional look
  const activeSegments = Math.floor((displayLevel / 100) * segments);
  const peakSegment = Math.floor((peakLevel / 100) * segments);

  const getSegmentColor = (index: number) => {
    if (!isPlaying || isMuted) {
      return 'bg-gray-800 border-gray-700';
    }

    const percentage = (index / segments) * 100;
    const isActive = index < activeSegments;
    const isPeak = index === peakSegment - 1 && peakSegment > activeSegments;

    // Professional VU meter color scheme
    if (percentage < 50) {
      // Green zone (safe levels)
      if (isPeak) return 'bg-green-400 border-green-300 shadow-green-400/60';
      if (isActive) return 'bg-green-500 border-green-400 shadow-green-500/40';
      return 'bg-green-900/30 border-green-800/50';
    } else if (percentage < 75) {
      // Yellow zone (caution levels)
      if (isPeak) return 'bg-yellow-400 border-yellow-300 shadow-yellow-400/60';
      if (isActive) return 'bg-yellow-500 border-yellow-400 shadow-yellow-500/40';
      return 'bg-yellow-900/30 border-yellow-800/50';
    } else {
      // Red zone (danger levels)
      if (isPeak) return 'bg-red-400 border-red-300 shadow-red-400/60';
      if (isActive) return 'bg-red-500 border-red-400 shadow-red-500/40';
      return 'bg-red-900/30 border-red-800/50';
    }
  };

  const sizeConfig = {
    sm: { 
      container: 'w-3 h-20', 
      segment: 'h-0.5 mb-0.5',
      text: 'text-xs',
      label: 'text-xs'
    },
    md: { 
      container: 'w-4 h-28', 
      segment: 'h-1 mb-0.5',
      text: 'text-xs',
      label: 'text-sm'
    },
    lg: { 
      container: 'w-6 h-36', 
      segment: 'h-1.5 mb-1',
      text: 'text-sm',
      label: 'text-base'
    }
  };

  const config = sizeConfig[size];

  return (
    <div className={`flex flex-col items-center gap-1 ${className}`}>
      {label && (
        <div className={`text-gray-400 font-mono ${config.label} text-center`}>
          {label}
        </div>
      )}
      
      <div className={`${config.container} flex flex-col-reverse justify-start bg-black/20 rounded border border-gray-700 p-0.5`}>
        {Array.from({ length: segments }, (_, i) => (
          <div
            key={i}
            className={`w-full ${config.segment} rounded-sm border transition-all duration-75 ${getSegmentColor(i)}`}
            style={{
              boxShadow: i < activeSegments || i === peakSegment - 1 ? 
                '0 0 2px currentColor' : 'none'
            }}
          />
        ))}
      </div>

      {showValue && (
        <div className={`text-gray-400 font-mono ${config.text} text-center`}>
          {Math.round(displayLevel)}
        </div>
      )}
    </div>
  );
}