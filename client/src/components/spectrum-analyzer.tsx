import { useEffect, useRef, useState } from "react";
import AudioMotionAnalyzer from "audiomotion-analyzer";

interface SpectrumAnalyzerProps {
  audioEngine?: any;
  isPlaying?: boolean;
  className?: string;
  height?: number;
}

export default function SpectrumAnalyzer({ 
  audioEngine, 
  isPlaying = false, 
  className = "",
  height = 120 
}: SpectrumAnalyzerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const analyzerRef = useRef<AudioMotionAnalyzer | null>(null);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Only create analyzer once when we have audio engine
    if (isPlaying && audioEngine?.audioEngine && !analyzerRef.current) {
      const actualEngine = audioEngine.audioEngine;
      
      if (typeof actualEngine.getState === 'function' && typeof actualEngine.getAudioContext === 'function') {
        try {
          const engineState = actualEngine.getState();
          const audioContext = actualEngine.getAudioContext();
          
          if (engineState?.masterGainNode && audioContext && audioContext.state === 'running') {
            setIsActive(true);
            
            // Create analyzer only once
            const analyzer = new AudioMotionAnalyzer(container, {
              // Basic connection
              audioCtx: audioContext,
              connectSpeakers: false, // Don't interfere with audio
              
              // Simple, working settings
              height: height,
              fftSize: 2048, // Lighter processing
              
              // Professional appearance
              mode: 10, // Line graph - smooth and responsive
              showPeaks: true,
              peakFadeTime: 2000, // 2 second peak fade
              peakHoldTime: 1000, // 1 second hold
              
              // Frequency range - reduce bass emphasis further
              minFreq: 150,  // Cut out more bass frequencies
              maxFreq: 16000, // Standard high-freq range
              
              // Audio-safe settings - won't affect music quality
              minDecibels: -90,
              maxDecibels: -60,
              smoothing: 0.8,
              
              // Line graph visual settings
              gradient: 'prism',
              lineWidth: 2,
              fillAlpha: 0.3,
              showScaleX: false,
              showScaleY: false,
              
              start: true
            });
            
            // Connect to master gain after creation
            analyzer.connectInput(engineState.masterGainNode);
            
            analyzerRef.current = analyzer;
            console.log('🎛️ Spectrum analyzer created (one-time)');
            
          }
        } catch (error) {
          console.error('❌ Spectrum analyzer setup failed:', error);
        }
      }
    }

    // Update active state based on playing status
    if (analyzerRef.current) {
      setIsActive(isPlaying);
    }

    return () => {
      // Only cleanup on unmount, not on every state change
      if (analyzerRef.current && !isPlaying) {
        try {
          analyzerRef.current.destroy();
        } catch (error) {
          // Ignore cleanup errors
        }
        analyzerRef.current = null;
        setIsActive(false);
      }
    };
  }, [isPlaying, height]); // Removed audioEngine from dependencies

  return (
    <div className={`bg-black rounded-lg border-2 border-gray-700 overflow-hidden ${className}`}>
      <div className="p-2 bg-gray-900 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-300">SPECTRUM ANALYZER</span>
          <div className={`w-2 h-2 rounded-full ${isActive && isPlaying ? 'bg-green-400' : 'bg-gray-600'}`} />
        </div>
      </div>
      <div 
        ref={containerRef}
        className="w-full"
        style={{ height: `${height}px` }}
      />
    </div>
  );
}