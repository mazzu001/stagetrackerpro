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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !audioEngine || !isPlaying) {
      setIsActive(false);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
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

    // Get analyzer from master mix if available
    let analyzer: AnalyserNode | null = null;
    
    try {
      // Check if audioEngine has the required methods
      if (audioEngine && typeof audioEngine.getState === 'function' && typeof audioEngine.getAudioContext === 'function') {
        const engineState = audioEngine.getState();
        const audioContext = audioEngine.getAudioContext();
        
        if (engineState?.masterGainNode && audioContext) {
          analyzer = audioContext.createAnalyser();
          if (analyzer) {
            analyzer.fftSize = 1024; // Increased for better frequency resolution
            analyzer.smoothingTimeConstant = 0.8;
            analyzer.minDecibels = -90;
            analyzer.maxDecibels = -10;
            
            // Connect to master output for full spectrum
            engineState.masterGainNode.connect(analyzer);
            console.log('🎛️ Spectrum analyzer connected to master output');
          }
        }
      }
    } catch (error) {
      console.error('❌ Could not create spectrum analyzer:', error);
      return;
    }

    if (!analyzer) return;

    const bufferLength = analyzer.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!isPlaying || !analyzer) return;

      analyzer.getByteFrequencyData(dataArray);

      // Clear canvas
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.fillRect(0, 0, rect.width, rect.height);

      // Draw frequency bars
      const barWidth = rect.width / (bufferLength * 0.3); // Only show first 30% for audible range
      let x = 0;

      for (let i = 0; i < bufferLength * 0.3; i++) {
        const barHeight = (dataArray[i] / 255) * rect.height * 0.9;
        
        // Color based on frequency range (like the professional console)
        let color;
        const freqRatio = i / (bufferLength * 0.3);
        
        if (freqRatio < 0.15) {
          // Bass frequencies - blue/cyan
          color = `hsl(${190 + (freqRatio * 30)}, 80%, ${50 + (barHeight / rect.height) * 30}%)`;
        } else if (freqRatio < 0.5) {
          // Mid frequencies - green/yellow
          color = `hsl(${120 - (freqRatio * 60)}, 70%, ${45 + (barHeight / rect.height) * 35}%)`;
        } else {
          // High frequencies - orange/red
          color = `hsl(${40 - (freqRatio * 30)}, 75%, ${45 + (barHeight / rect.height) * 30}%)`;
        }

        ctx.fillStyle = color;
        ctx.fillRect(x, rect.height - barHeight, barWidth - 1, barHeight);
        
        x += barWidth;
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      // Disconnect analyzer to prevent memory leaks
      try {
        if (analyzer && audioEngine && typeof audioEngine.getState === 'function') {
          const engineState = audioEngine.getState();
          if (engineState?.masterGainNode) {
            engineState.masterGainNode.disconnect(analyzer);
          }
        }
      } catch (error) {
        // Ignore cleanup errors
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