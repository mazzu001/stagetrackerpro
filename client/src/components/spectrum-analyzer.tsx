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
  const mainLevelsRef = useRef<number[]>([]);

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

    // Access the actual audio engine from the hook object
    const actualEngine = audioEngine?.audioEngine;
    let analyzer: AnalyserNode | null = null;
    
    if (actualEngine && typeof actualEngine.getState === 'function' && typeof actualEngine.getAudioContext === 'function') {
      try {
        const engineState = actualEngine.getState();
        const audioContext = actualEngine.getAudioContext();
        
        if (engineState?.masterGainNode && audioContext && audioContext.state === 'running') {
          analyzer = audioContext.createAnalyser();
          if (analyzer) {
            analyzer.fftSize = 2048; // Good resolution
            analyzer.smoothingTimeConstant = 0.75; // Balanced smoothing
            analyzer.minDecibels = -75; // High sensitivity
            analyzer.maxDecibels = -10; // Good range
            
            // Create a splitter to tap audio without disrupting flow
            const splitter = audioContext.createChannelSplitter(2);
            const merger = audioContext.createChannelMerger(2);
            
            // Insert the splitter/merger between master gain and destination
            engineState.masterGainNode.disconnect();
            engineState.masterGainNode.connect(splitter);
            
            // Connect both left and right channels through the merger
            splitter.connect(merger, 0, 0); // Left channel
            splitter.connect(merger, 1, 1); // Right channel
            
            merger.connect(audioContext.destination);
            
            // Connect analyzer to the splitter for monitoring
            splitter.connect(analyzer);
            
            analyzerRef.current = analyzer;
            console.log('🎛️ Custom spectrum analyzer connected');
          }
        } else {
          console.log('🔍 Audio engine not ready');
          return;
        }
      } catch (error) {
        console.error('❌ Spectrum analyzer connection failed:', error);
        return;
      }
    } else {
      console.log('🔍 No audio engine available');
      return;
    }

    if (!analyzer) return;

    const bufferLength = analyzer.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const displayBands = Math.floor(bufferLength * 0.5); // Show more frequency range
    
    // Initialize arrays
    if (peakLevelsRef.current.length === 0) {
      peakLevelsRef.current = new Array(displayBands).fill(0);
      mainLevelsRef.current = new Array(displayBands).fill(0);
    }

    const draw = () => {
      if (!isPlaying || !analyzer) return;

      analyzer.getByteFrequencyData(dataArray);

      // Clear canvas with dark background
      ctx.fillStyle = 'rgba(16, 24, 32, 0.4)';
      ctx.fillRect(0, 0, rect.width, rect.height);

      const barWidth = rect.width / displayBands;
      let x = 0;

      for (let i = 0; i < displayBands; i++) {
        const rawValue = dataArray[i];
        const freqRatio = i / displayBands;
        
        // Frequency-dependent boost for balanced response
        let frequencyMultiplier;
        if (freqRatio < 0.15) {
          // Bass - keep moderate
          frequencyMultiplier = 1.2;
        } else if (freqRatio < 0.6) {
          // Mids - boost significantly  
          frequencyMultiplier = 2.8;
        } else {
          // Highs - boost most
          frequencyMultiplier = 3.5;
        }
        
        // Enhanced sensitivity calculation
        const normalizedValue = rawValue / 255;
        const amplifiedValue = Math.pow(normalizedValue, 0.4) * frequencyMultiplier;
        const instantBarHeight = amplifiedValue * rect.height * 1.5;
        
        // Main bar decay - much slower fall
        const currentMain = mainLevelsRef.current[i];
        let barHeight;
        if (instantBarHeight > currentMain) {
          barHeight = instantBarHeight;
          mainLevelsRef.current[i] = instantBarHeight;
        } else {
          // Very slow decay for main bars
          barHeight = currentMain * 0.97; // 97% retention (very slow fall)
          mainLevelsRef.current[i] = barHeight;
        }
        
        // Peak levels - even slower decay
        const currentPeak = peakLevelsRef.current[i];
        if (barHeight > currentPeak) {
          peakLevelsRef.current[i] = barHeight;
        } else {
          peakLevelsRef.current[i] = currentPeak * 0.995; // 99.5% retention (very slow)
        }
        
        // Enhanced colors for better visibility
        let color;
        if (freqRatio < 0.15) {
          // Bass - bright blue/cyan
          color = `hsl(${190 + (freqRatio * 50)}, 90%, ${50 + (amplifiedValue * 30)}%)`;
        } else if (freqRatio < 0.6) {
          // Mids - bright green/yellow
          color = `hsl(${110 - (freqRatio * 70)}, 85%, ${55 + (amplifiedValue * 25)}%)`;
        } else {
          // Highs - bright orange/red
          color = `hsl(${40 - (freqRatio * 25)}, 95%, ${60 + (amplifiedValue * 20)}%)`;
        }

        // Draw main frequency bar
        ctx.fillStyle = color;
        ctx.fillRect(x, rect.height - barHeight, barWidth - 1, barHeight);
        
        // Draw falling peak line (brighter)
        const peakHeight = peakLevelsRef.current[i];
        if (peakHeight > 3) {
          ctx.fillStyle = `hsl(${freqRatio < 0.15 ? 200 : freqRatio < 0.6 ? 50 : 10}, 100%, 90%)`;
          ctx.fillRect(x, rect.height - peakHeight - 2, barWidth - 1, 3);
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