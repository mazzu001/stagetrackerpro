import { useEffect, useRef, useState } from "react";
import AudioMotionAnalyzer from "audiomotion-analyzer";
import { SpectrumSettings } from "./spectrum-controls";

interface SpectrumAnalyzerProps {
  audioEngine?: any;
  isPlaying?: boolean;
  className?: string;
  height?: number;
  settings?: SpectrumSettings;
}

// Default settings for the spectrum analyzer
export const defaultSettings: SpectrumSettings = {
  minDecibels: -100,
  maxDecibels: -80,
  minFreq: 300,
  maxFreq: 16000,
  mode: 10,
  smoothing: 0.6,
  gradient: 'prism',
  showPeaks: true,
  peakFadeTime: 2000,
  lineWidth: 2,
  fillAlpha: 0.3,
  fftSize: 2048
};

export default function SpectrumAnalyzer({ 
  audioEngine, 
  isPlaying = false, 
  className = "",
  height = 120,
  settings = defaultSettings
}: SpectrumAnalyzerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const analyzerRef = useRef<AudioMotionAnalyzer | null>(null);
  const [isActive, setIsActive] = useState(false);

  // Update analyzer settings when props change
  useEffect(() => {
    if (analyzerRef.current && isActive) {
      const analyzer = analyzerRef.current;
      try {
        // Update all configurable settings
        analyzer.minDecibels = settings.minDecibels;
        analyzer.maxDecibels = settings.maxDecibels;
        analyzer.minFreq = settings.minFreq;
        analyzer.maxFreq = settings.maxFreq;
        analyzer.mode = settings.mode;
        analyzer.smoothing = settings.smoothing;
        analyzer.gradient = settings.gradient;
        analyzer.showPeaks = settings.showPeaks;
        analyzer.peakFadeTime = settings.peakFadeTime;
        analyzer.lineWidth = settings.lineWidth;
        analyzer.fillAlpha = settings.fillAlpha;
        
        console.log(`🎛️ Updated spectrum analyzer: ${settings.minDecibels}dB to ${settings.maxDecibels}dB, ${settings.minFreq}Hz-${settings.maxFreq}Hz, mode ${settings.mode}`);
      } catch (error) {
        console.warn('⚠️ Could not update spectrum settings:', error);
      }
    }
  }, [settings, isActive]);

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
              
              // Dynamic settings from props
              height: height,
              fftSize: settings.fftSize,
              
              // Visualization settings
              mode: settings.mode,
              showPeaks: settings.showPeaks,
              peakFadeTime: settings.peakFadeTime,
              peakHoldTime: 1000, // Keep stable
              
              // Frequency range
              minFreq: settings.minFreq,
              maxFreq: settings.maxFreq,
              
              // Sensitivity range
              minDecibels: settings.minDecibels,
              maxDecibels: settings.maxDecibels,
              smoothing: settings.smoothing,
              
              // Visual appearance
              gradient: settings.gradient,
              lineWidth: settings.lineWidth,
              fillAlpha: settings.fillAlpha,
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