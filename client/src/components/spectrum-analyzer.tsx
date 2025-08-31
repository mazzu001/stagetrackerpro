import { useEffect, useRef, useState } from "react";

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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const [isActive, setIsActive] = useState(false);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const peakLevelsRef = useRef<number[]>([]);
  const peakDecayRate = 0.95; // How fast peaks fall (0.95 = slow decay)

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isPlaying) {
      setIsActive(false);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (analyzerRef.current) {
        analyzerRef.current = null;
      }
      
      // Clear canvas when not playing
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
      return;
    }

    setIsActive(true);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Setup canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * devicePixelRatio;
    canvas.height = rect.height * devicePixelRatio;
    ctx.scale(devicePixelRatio, devicePixelRatio);

    // Non-interfering connection to audio engine
    let analyzer: AnalyserNode | null = null;
    
    // Access the actual audio engine from the hook object
    const actualEngine = audioEngine?.audioEngine;
    
    // Only try to connect if we have the actual StreamingAudioEngine instance
    if (actualEngine && typeof actualEngine.getState === 'function' && typeof actualEngine.getAudioContext === 'function') {
      try {
        const engineState = actualEngine.getState();
        const audioContext = actualEngine.getAudioContext();
        
        if (engineState?.masterGainNode && audioContext && audioContext.state === 'running') {
          analyzer = audioContext.createAnalyser();
          if (analyzer) {
            analyzer.fftSize = 1024;
            analyzer.smoothingTimeConstant = 0.6; // More responsive
            analyzer.minDecibels = -70; // Higher sensitivity
            analyzer.maxDecibels = -5; // Better range
            
            // Create a splitter to tap audio without disrupting flow
            const splitter = audioContext.createChannelSplitter(2);
            const merger = audioContext.createChannelMerger(2);
            
            // Insert the splitter/merger between master gain and destination
            engineState.masterGainNode.disconnect();
            engineState.masterGainNode.connect(splitter);
            
            // Connect both left and right channels through the merger
            splitter.connect(merger, 0, 0); // Left channel: splitter output 0 → merger input 0
            splitter.connect(merger, 1, 1); // Right channel: splitter output 1 → merger input 1
            
            merger.connect(audioContext.destination);
            
            // Connect analyzer to the splitter for monitoring
            splitter.connect(analyzer);
            
            analyzerRef.current = analyzer;
            console.log('🎛️ Spectrum analyzer connected to master mix');
          }
        } else {
          console.log('🔍 Audio engine not ready for spectrum analyzer');
          return;
        }
      } catch (error) {
        console.error('❌ Spectrum analyzer connection failed:', error);
        return;
      }
    } else {
      console.log('🔍 No audio engine available for spectrum analyzer');
      return;
    }

    if (!analyzer) return;

    const bufferLength = analyzer.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const displayBands = Math.floor(bufferLength * 0.4); // Show audible frequency range
    
    // Initialize peak levels array
    if (peakLevelsRef.current.length === 0) {
      peakLevelsRef.current = new Array(displayBands).fill(0);
    }

    const draw = () => {
      if (!isPlaying || !analyzer) return;

      analyzer.getByteFrequencyData(dataArray);

      // Clear canvas with dark background
      ctx.fillStyle = 'rgba(16, 24, 32, 0.3)';
      ctx.fillRect(0, 0, rect.width, rect.height);

      // Draw frequency bars with peak lines
      const barWidth = rect.width / displayBands;
      let x = 0;

      for (let i = 0; i < displayBands; i++) {
        // Enhanced bar height calculation with frequency balancing
        const rawValue = dataArray[i];
        const normalizedValue = rawValue / 255;
        const freqRatio = i / displayBands;
        
        // Frequency-dependent scaling to balance bass vs mids/highs
        let frequencyMultiplier;
        if (freqRatio < 0.2) {
          // Bass frequencies - reduce by 20%
          frequencyMultiplier = 0.8;
        } else if (freqRatio < 0.6) {
          // Mid frequencies - boost by 30%
          frequencyMultiplier = 1.3;
        } else {
          // High frequencies - boost by 40%
          frequencyMultiplier = 1.4;
        }
        
        const amplifiedValue = Math.pow(normalizedValue, 0.5) * frequencyMultiplier; // More sensitive power curve
        const barHeight = amplifiedValue * rect.height * 1.2; // Much higher overall sensitivity
        
        // Update peak levels
        const currentPeak = peakLevelsRef.current[i];
        if (barHeight > currentPeak) {
          peakLevelsRef.current[i] = barHeight;
        } else {
          // Peak decay - slowly fall down
          peakLevelsRef.current[i] = currentPeak * peakDecayRate;
        }
        
        // Color based on frequency range with balanced response
        let color;
        if (freqRatio < 0.2) {
          // Bass frequencies - blue/cyan (toned down since reduced)
          color = `hsl(${200 + (freqRatio * 40)}, 80%, ${40 + (amplifiedValue * 40)}%)`;
        } else if (freqRatio < 0.6) {
          // Mid frequencies - green/yellow (brighter since boosted)
          color = `hsl(${120 - (freqRatio * 80)}, 85%, ${45 + (amplifiedValue * 35)}%)`;
        } else {
          // High frequencies - orange/red (brightest since most boosted)
          color = `hsl(${35 - (freqRatio * 25)}, 95%, ${50 + (amplifiedValue * 25)}%)`;
        }

        // Draw main frequency bar
        ctx.fillStyle = color;
        ctx.fillRect(x, rect.height - barHeight, barWidth - 1, barHeight);
        
        // Draw falling peak line
        const peakHeight = peakLevelsRef.current[i];
        if (peakHeight > 2) {
          ctx.fillStyle = `hsl(${freqRatio < 0.2 ? 220 : freqRatio < 0.6 ? 60 : 15}, 100%, 85%)`;
          ctx.fillRect(x, rect.height - peakHeight - 2, barWidth - 1, 2);
        }
        
        x += barWidth;
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      // Clean disconnect without interfering with audio
      if (analyzerRef.current) {
        try {
          analyzerRef.current.disconnect();
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
      <canvas
        ref={canvasRef}
        className="w-full"
        style={{ height: `${height}px` }}
      />
    </div>
  );
}