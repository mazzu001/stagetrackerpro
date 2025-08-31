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

    // Connect to the real audio engine
    let analyzer: AnalyserNode | null = null;
    
    try {
      // Try to connect to the actual audio engine
      if (audioEngine && audioEngine.getState && audioEngine.getAudioContext) {
        const engineState = audioEngine.getState();
        const audioContext = audioEngine.getAudioContext();
        
        if (engineState?.masterGainNode && audioContext) {
          analyzer = audioContext.createAnalyser();
          analyzer.fftSize = 512;
          analyzer.smoothingTimeConstant = 0.8;
          analyzer.minDecibels = -90;
          analyzer.maxDecibels = -10;
          
          // Connect to master output to analyze real music
          engineState.masterGainNode.connect(analyzer);
          analyzerRef.current = analyzer;
          console.log('🎛️ Spectrum analyzer connected to real audio');
        } else {
          console.log('🔍 No audio tracks loaded yet');
          return; // No audio to analyze
        }
      } else {
        console.log('🔍 Audio engine not ready for spectrum analysis');
        return; // No audio engine available
      }
    } catch (error) {
      console.error('❌ Could not connect spectrum analyzer:', error);
      return;
    }

    if (!analyzer) return;

    const bufferLength = analyzer.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!isPlaying || !analyzer) return;

      analyzer.getByteFrequencyData(dataArray);

      // Clear canvas with dark background
      ctx.fillStyle = 'rgba(16, 24, 32, 0.2)';
      ctx.fillRect(0, 0, rect.width, rect.height);

      // Draw frequency bars
      const barWidth = rect.width / (bufferLength * 0.4); // Show more frequency range
      let x = 0;

      for (let i = 0; i < bufferLength * 0.4; i++) {
        const barHeight = (dataArray[i] / 255) * rect.height * 0.8;
        
        // Color based on frequency range
        let color;
        const freqRatio = i / (bufferLength * 0.4);
        
        if (freqRatio < 0.2) {
          // Bass frequencies - blue/cyan
          color = `hsl(${200 + (freqRatio * 40)}, 80%, ${40 + (barHeight / rect.height) * 40}%)`;
        } else if (freqRatio < 0.6) {
          // Mid frequencies - green/yellow
          color = `hsl(${120 - (freqRatio * 80)}, 70%, ${35 + (barHeight / rect.height) * 45}%)`;
        } else {
          // High frequencies - orange/red
          color = `hsl(${35 - (freqRatio * 25)}, 85%, ${40 + (barHeight / rect.height) * 35}%)`;
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
      // Disconnect from master gain node
      try {
        if (analyzer && audioEngine && audioEngine.getState) {
          const engineState = audioEngine.getState();
          if (engineState?.masterGainNode) {
            engineState.masterGainNode.disconnect(analyzer);
          }
        }
      } catch (error) {
        // Ignore cleanup errors
      }
      analyzerRef.current = null;
    };
  }, [isPlaying, height]);

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