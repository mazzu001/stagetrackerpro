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

    // Access the actual audio engine from the hook object
    const actualEngine = audioEngine?.audioEngine;
    
    if (actualEngine && typeof actualEngine.getState === 'function' && typeof actualEngine.getAudioContext === 'function') {
      try {
        const engineState = actualEngine.getState();
        const audioContext = actualEngine.getAudioContext();
        
        if (engineState?.masterGainNode && audioContext && audioContext.state === 'running') {
          setIsActive(true);
          
          // Create professional analyzer with minimal, working configuration
          const analyzer = new AudioMotionAnalyzer(container, {
            // Basic connection
            audioCtx: audioContext,
            connectSpeakers: false, // Don't interfere with audio
            
            // Simple, working settings
            height: height,
            fftSize: 4096,
            
            // Professional appearance
            mode: 6, // Octave bands
            showPeaks: true,
            peakFadeTime: 2000, // 2 second peak fade
            peakHoldTime: 1000, // 1 second hold
            
            // Maximum sensitivity settings
            minDecibels: -100,
            maxDecibels: 0,
            linearBoost: 4, // 4x amplitude boost
            volume: 3, // 3x volume boost
            smoothing: 0.4, // Less smoothing for more responsiveness
            
            // Visual settings
            gradient: 'rainbow',
            barSpace: 0.15,
            showScaleX: false,
            showScaleY: false,
            
            start: true
          });
          
          // Connect to master gain after creation
          analyzer.connectInput(engineState.masterGainNode);
          
          analyzerRef.current = analyzer;
          console.log('🎛️ Professional audioMotion analyzer connected and running');
          
        } else {
          console.log('🔍 Audio engine not ready for analyzer');
        }
      } catch (error) {
        console.error('❌ Professional analyzer setup failed:', error);
      }
    } else {
      console.log('🔍 No audio engine available');
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