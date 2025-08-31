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
    if (!container || !isPlaying) {
      setIsActive(false);
      
      // Clean up existing analyzer
      if (analyzerRef.current) {
        try {
          analyzerRef.current.destroy();
        } catch (error) {
          // Ignore cleanup errors
        }
        analyzerRef.current = null;
      }
      return;
    }

    setIsActive(true);

    // Access the actual audio engine from the hook object
    const actualEngine = audioEngine?.audioEngine;
    
    // Only try to connect if we have the actual StreamingAudioEngine instance
    if (actualEngine && typeof actualEngine.getState === 'function' && typeof actualEngine.getAudioContext === 'function') {
      try {
        const engineState = actualEngine.getState();
        const audioContext = actualEngine.getAudioContext();
        
        if (engineState?.masterGainNode && audioContext && audioContext.state === 'running') {
          // Create professional spectrum analyzer with correct source connection
          const analyzer = new AudioMotionAnalyzer(container, {
            // Use existing audio context
            audioCtx: audioContext,
            source: engineState.masterGainNode, // Connect directly to master gain
            connectSpeakers: false, // Don't interfere with existing audio flow
            
            // Professional settings for better visibility
            mode: 4, // 1/6 octave bands (more detailed)
            fftSize: 8192, // High resolution
            smoothing: 0.7, // Balanced smoothing
            
            // Visual settings
            height: height,
            showBgColor: true,
            bgAlpha: 0.2,
            showPeaks: true, // Enable falling peak lines
            peakFadeTime: 1500, // Slower peak fade (1.5 seconds)
            peakHoldTime: 800, // Hold peaks longer
            showScaleX: false,
            showScaleY: false,
            
            // Frequency response
            minFreq: 30, // Focus on musical content
            maxFreq: 16000, // Good range for music
            
            // Color gradient - professional look
            gradient: 'prism',
            
            // Enhanced sensitivity for better levels
            minDecibels: -75, // Higher sensitivity
            maxDecibels: -15, // Better dynamic range
            
            // Professional mixing console appearance
            barSpace: 0.15,
            ledBars: false, // Smooth bars
            lumiBars: false, // Standard bars
            reflexRatio: 0, // Clean look
            
            // Performance
            useCanvas: true,
            start: true // Auto-start
          });
          
          analyzerRef.current = analyzer;
          console.log('🎛️ Professional spectrum analyzer connected with enhanced levels');
          
        } else {
          console.log('🔍 Audio engine not ready for spectrum analyzer');
          return;
        }
      } catch (error) {
        console.error('❌ Professional spectrum analyzer connection failed:', error);
        return;
      }
    } else {
      console.log('🔍 No audio engine available for spectrum analyzer');
      return;
    }

    return () => {
      // Clean up analyzer
      if (analyzerRef.current) {
        try {
          analyzerRef.current.destroy();
        } catch (error) {
          // Ignore cleanup errors
        }
        analyzerRef.current = null;
      }
    };
  }, [audioEngine, isPlaying, height]);

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