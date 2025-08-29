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

    // Apply amplification to make meters more reactive - increased for better visibility
    const amplifiedLevel = leftLevel * 2.0; // Increased amplification for better VU meter visibility
    const targetLevel = Math.max(0, Math.min(100, amplifiedLevel));
    
    const animate = () => {
      setAnimatedLeftLevel(prev => {
        const diff = targetLevel - prev;
        const step = diff * 0.9; // Faster response for more reactive meters
        return Math.abs(step) < 0.1 ? targetLevel : prev + step;
      });
    };

    const interval = setInterval(animate, 6); // Faster update rate
    return () => clearInterval(interval);
  }, [leftLevel, isPlaying]);

  // Smooth animation for right channel
  useEffect(() => {
    if (!isPlaying) {
      setAnimatedRightLevel(0);
      setRightPeak(0);
      return;
    }

    // Apply amplification to make meters more reactive - increased for better visibility
    const amplifiedLevel = rightLevel * 2.0; // Increased amplification for better VU meter visibility
    const targetLevel = Math.max(0, Math.min(100, amplifiedLevel));
    
    const animate = () => {
      setAnimatedRightLevel(prev => {
        const diff = targetLevel - prev;
        const step = diff * 0.9; // Faster response for more reactive meters
        return Math.abs(step) < 0.1 ? targetLevel : prev + step;
      });
    };

    const interval = setInterval(animate, 6); // Faster update rate
    return () => clearInterval(interval);
  }, [rightLevel, isPlaying]);

  // Peak hold for left channel
  useEffect(() => {
    if (animatedLeftLevel > leftPeak) {
      setLeftPeak(animatedLeftLevel);
    } else {
      const decay = () => {
        setLeftPeak(prev => Math.max(animatedLeftLevel, prev - 1.5)); // Faster decay for more dynamic peaks
      };
      const interval = setInterval(decay, 15); // More frequent updates
      return () => clearInterval(interval);
    }
  }, [animatedLeftLevel, leftPeak]);

  // Peak hold for right channel
  useEffect(() => {
    if (animatedRightLevel > rightPeak) {
      setRightPeak(animatedRightLevel);
    } else {
      const decay = () => {
        setRightPeak(prev => Math.max(animatedRightLevel, prev - 1.5)); // Faster decay for more dynamic peaks
      };
      const interval = setInterval(decay, 15); // More frequent updates
      return () => clearInterval(interval);
    }
  }, [animatedRightLevel, rightPeak]);

  const createChannelMeter = (level: number, peak: number, channelName: string) => {
    const segments = 12; // More segments for longer display
    const activeSegments = Math.floor((level / 100) * segments);
    const peakSegment = Math.floor((peak / 100) * segments);

    const getSegmentColor = (index: number) => {
      if (!isPlaying) return 'bg-gray-700';
      
      const percentage = (index / segments) * 100;
      
      if (index === peakSegment - 1 && peakSegment > activeSegments) {
        // Peak indicator - bright with strong glow
        if (percentage < 60) return 'bg-green-300 shadow-green-300/70';
        if (percentage < 80) return 'bg-yellow-300 shadow-yellow-300/70';
        return 'bg-red-300 shadow-red-300/70';
      }
      
      if (index < activeSegments) {
        // Active segments - brighter colors with glow
        if (percentage < 60) return 'bg-green-400 shadow-green-400/50';
        if (percentage < 80) return 'bg-yellow-400 shadow-yellow-400/50';
        return 'bg-red-400 shadow-red-400/50';
      }
      
      // Inactive segments
      if (percentage < 60) return 'bg-green-900/20';
      if (percentage < 80) return 'bg-yellow-900/20';
      return 'bg-red-900/20';
    };

    return (
      <div className="flex items-center space-x-1">
        <div className="text-xs text-gray-400 font-mono w-2 text-center leading-none">
          {channelName}
        </div>
        <div className="flex space-x-0.5">
          {Array.from({ length: segments }, (_, index) => (
            <div
              key={index}
              className={`w-1 h-1.5 rounded-sm ${getSegmentColor(index)} shadow-sm`}
              style={{
                opacity: index < activeSegments || index === peakSegment - 1 ? 1 : 0.3,
                boxShadow: (index < activeSegments || index === peakSegment - 1) ? 
                  '0 0 3px currentColor, 0 0 6px currentColor' : 'none'
              }}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className={`flex flex-col space-y-0.5 ${className}`}>
      {createChannelMeter(animatedLeftLevel, leftPeak, 'L')}
      {createChannelMeter(animatedRightLevel, rightPeak, 'R')}
    </div>
  );
}