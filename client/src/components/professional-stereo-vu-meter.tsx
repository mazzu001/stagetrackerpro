import { useEffect, useState, useRef } from 'react';

interface ProfessionalStereoVUMeterProps {
  leftLevel: number; // Expected range: 0-100
  rightLevel: number; // Expected range: 0-100
  isPlaying?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showLabels?: boolean;
  horizontal?: boolean;
}

export default function ProfessionalStereoVUMeter({ 
  leftLevel, 
  rightLevel, 
  isPlaying = true, 
  className = "",
  size = 'md',
  showLabels = true,
  horizontal = false
}: ProfessionalStereoVUMeterProps) {
  const [leftDisplay, setLeftDisplay] = useState(0);
  const [rightDisplay, setRightDisplay] = useState(0);
  const [leftPeak, setLeftPeak] = useState(0);
  const [rightPeak, setRightPeak] = useState(0);
  
  const animationRef = useRef<number>();
  const lastUpdateRef = useRef<number>(0);

  // Smooth animation for both channels
  useEffect(() => {
    if (!isPlaying) {
      setLeftDisplay(0);
      setRightDisplay(0);
      setLeftPeak(0);
      setRightPeak(0);
      return;
    }

    const targetLeft = Math.max(0, Math.min(100, leftLevel));
    const targetRight = Math.max(0, Math.min(100, rightLevel));

    const animate = () => {
      const now = performance.now();
      const deltaTime = now - lastUpdateRef.current;
      lastUpdateRef.current = now;

      // Animate left channel
      setLeftDisplay(prev => {
        if (targetLeft > prev) {
          return prev + (targetLeft - prev) * 0.9; // Fast attack
        } else {
          const decayRate = Math.max(0.88, 1 - (deltaTime / 1000) * 1.5);
          return Math.max(targetLeft, prev * decayRate);
        }
      });

      // Animate right channel  
      setRightDisplay(prev => {
        if (targetRight > prev) {
          return prev + (targetRight - prev) * 0.9; // Fast attack
        } else {
          const decayRate = Math.max(0.88, 1 - (deltaTime / 1000) * 1.5);
          return Math.max(targetRight, prev * decayRate);
        }
      });

      // Peak hold for left
      setLeftPeak(prev => {
        if (targetLeft > prev) {
          return targetLeft;
        } else {
          const peakDecayRate = Math.max(0.985, 1 - (deltaTime / 1000) * 0.3);
          return Math.max(targetLeft, prev * peakDecayRate);
        }
      });

      // Peak hold for right
      setRightPeak(prev => {
        if (targetRight > prev) {
          return targetRight;
        } else {
          const peakDecayRate = Math.max(0.985, 1 - (deltaTime / 1000) * 0.3);
          return Math.max(targetRight, prev * peakDecayRate);
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
  }, [leftLevel, rightLevel, isPlaying]);

  const createChannel = (level: number, peak: number, label: string) => {
    const segments = horizontal ? 16 : 12;
    const activeSegments = Math.floor((level / 100) * segments);
    const peakSegment = Math.floor((peak / 100) * segments);

    const getSegmentColor = (index: number) => {
      if (!isPlaying) {
        return 'bg-gray-800';
      }

      const percentage = (index / segments) * 100;
      const isActive = index < activeSegments;
      const isPeak = index === peakSegment - 1 && peakSegment > activeSegments;

      if (percentage < 60) {
        if (isPeak) return 'bg-green-300 shadow-green-300/80';
        if (isActive) return 'bg-green-400 shadow-green-400/60';
        return 'bg-green-900/25';
      } else if (percentage < 85) {
        if (isPeak) return 'bg-yellow-300 shadow-yellow-300/80';
        if (isActive) return 'bg-yellow-400 shadow-yellow-400/60';
        return 'bg-yellow-900/25';
      } else {
        if (isPeak) return 'bg-red-300 shadow-red-300/80';
        if (isActive) return 'bg-red-400 shadow-red-400/60';
        return 'bg-red-900/25';
      }
    };

    const sizeConfig = {
      sm: horizontal ? 'w-0.5 h-1.5' : 'w-1 h-0.5',
      md: horizontal ? 'w-1 h-2' : 'w-1.5 h-0.5', 
      lg: horizontal ? 'w-1.5 h-3' : 'w-2 h-1'
    };

    const segmentClass = sizeConfig[size];
    const containerClass = horizontal ? 'flex space-x-0.5' : 'flex flex-col-reverse space-y-reverse space-y-0.5';

    return (
      <div className="flex items-center space-x-1">
        {showLabels && (
          <div className="text-xs font-mono text-gray-400 w-3 text-center">
            {label}
          </div>
        )}
        <div className={`${containerClass} bg-black/30 p-1 rounded border border-gray-700`}>
          {Array.from({ length: segments }, (_, index) => (
            <div
              key={index}
              className={`${segmentClass} rounded-sm transition-all duration-100 ${getSegmentColor(index)}`}
              style={{
                boxShadow: (index < activeSegments || index === peakSegment - 1) ? 
                  '0 0 2px currentColor' : 'none'
              }}
            />
          ))}
        </div>
      </div>
    );
  };

  const containerClass = horizontal ? 
    'flex items-center space-x-3' : 
    'flex flex-col space-y-0.5';

  return (
    <div className={`${containerClass} ${className}`}>
      {createChannel(leftDisplay, leftPeak, 'L')}
      {createChannel(rightDisplay, rightPeak, 'R')}
    </div>
  );
}