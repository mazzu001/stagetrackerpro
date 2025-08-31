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
          // Create professional spectrum analyzer
          const analyzer = new AudioMotionAnalyzer(container, {
            // Connect to master gain node
            audioCtx: audioContext,
            connectSpeakers: false, // Don't interfere with existing audio flow
            
            // Professional settings
            mode: 2, // 1/3 octave bands (professional mixing console style)
            fftSize: 8192, // High resolution
            smoothing: 0.7, // Balanced smoothing
            
            // Visual settings
            height: height,
            showBgColor: true,
            bgAlpha: 0.1,
            showPeaks: true, // Enable falling peak lines
            showScaleX: false,
            showScaleY: false,
            
            // Frequency response
            minFreq: 20, // Audible bass
            maxFreq: 20000, // Audible high
            
            // Color gradient - professional look
            gradient: 'steelblue',
            
            // Enhanced sensitivity 
            minDecibels: -70, // Higher sensitivity
            maxDecibels: -10, // Better range
            
            // Professional features
            barSpace: 0.1,
            ledBars: false, // Smooth bars, not LED
            lumiBars: false, // Standard bars
            reflexRatio: 0, // No reflection for clean look
            
            // Responsive design
            useCanvas: true // Better performance
          });
          
          // Connect to our audio engine
          analyzer.connectInput(engineState.masterGainNode);
          
          analyzerRef.current = analyzer;
          console.log('🎛️ Professional spectrum analyzer connected');
          
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