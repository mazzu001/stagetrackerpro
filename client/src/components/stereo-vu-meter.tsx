import { useEffect, useState } from 'react';

interface StereoVUMeterProps {
  leftLevel: number; // 0-100
  rightLevel: number; // 0-100
  isPlaying?: boolean;
  className?: string;
}

export default function StereoVUMeter({ 
  leftLevel, 
  rightLevel, 
  isPlaying = false, 
  className = "" 
}: StereoVUMeterProps) {
  const [animatedLeftLevel, setAnimatedLeftLevel] = useState(0);
  const [animatedRightLevel, setAnimatedRightLevel] = useState(0);
  const [leftPeak, setLeftPeak] = useState(0);
  const [rightPeak, setRightPeak] = useState(0);

  // Smooth animation for left channel
  useEffect(() => {
    if (!isPlaying) {
      setAnimatedLeftLevel(0);
      setLeftPeak(0);
      return;
    }

    const targetLevel = Math.max(0, Math.min(100, leftLevel));
    
    const animate = () => {
      setAnimatedLeftLevel(prev => {
        const diff = targetLevel - prev;
        const step = diff * 0.8;
        return Math.abs(step) < 0.1 ? targetLevel : prev + step;
      });
    };

    const interval = setInterval(animate, 8);
    return () => clearInterval(interval);
  }, [leftLevel, isPlaying]);

  // Smooth animation for right channel
  useEffect(() => {
    if (!isPlaying) {
      setAnimatedRightLevel(0);
      setRightPeak(0);
      return;
    }

    const targetLevel = Math.max(0, Math.min(100, rightLevel));
    
    const animate = () => {
      setAnimatedRightLevel(prev => {
        const diff = targetLevel - prev;
        const step = diff * 0.8;
        return Math.abs(step) < 0.1 ? targetLevel : prev + step;
      });
    };

    const interval = setInterval(animate, 8);
    return () => clearInterval(interval);
  }, [rightLevel, isPlaying]);

  // Peak hold for left channel
  useEffect(() => {
    if (animatedLeftLevel > leftPeak) {
      setLeftPeak(animatedLeftLevel);
    } else {
      const decay = () => {
        setLeftPeak(prev => Math.max(animatedLeftLevel, prev - 2.0));
      };
      const interval = setInterval(decay, 20);
      return () => clearInterval(interval);
    }
  }, [animatedLeftLevel, leftPeak]);

  // Peak hold for right channel
  useEffect(() => {
    if (animatedRightLevel > rightPeak) {
      setRightPeak(animatedRightLevel);
    } else {
      const decay = () => {
        setRightPeak(prev => Math.max(animatedRightLevel, prev - 2.0));
      };
      const interval = setInterval(decay, 20);
      return () => clearInterval(interval);
    }
  }, [animatedRightLevel, rightPeak]);

  const createChannelMeter = (level: number, peak: number, channelName: string) => {
    const segments = 12; // Smaller for compact display
    const activeSegments = Math.floor((level / 100) * segments);
    const peakSegment = Math.floor((peak / 100) * segments);

    const getSegmentColor = (index: number) => {
      if (!isPlaying) return 'bg-gray-700';
      
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
      if (percentage < 70) return 'bg-green-900/20';
      if (percentage < 85) return 'bg-yellow-900/20';
      return 'bg-red-900/20';
    };

    return (
      <div className="flex flex-col items-center space-y-1">
        <div className="text-xs text-gray-400 font-mono w-4 text-center">
          {channelName}
        </div>
        <div className="flex flex-col space-y-0.5">
          {Array.from({ length: segments }, (_, index) => (
            <div
              key={index}
              className={`w-3 h-1 rounded-sm ${getSegmentColor(segments - 1 - index)}`}
              style={{
                opacity: (segments - 1 - index) < activeSegments || (segments - 1 - index) === peakSegment - 1 ? 1 : 0.3
              }}
            />
          ))}
        </div>
        <div className="text-xs text-gray-400 font-mono w-4 text-center">
          {isPlaying ? Math.round(level) : '-'}
        </div>
      </div>
    );
  };

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      {createChannelMeter(animatedLeftLevel, leftPeak, 'L')}
      {createChannelMeter(animatedRightLevel, rightPeak, 'R')}
    </div>
  );
}