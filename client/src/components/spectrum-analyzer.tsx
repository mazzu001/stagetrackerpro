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
            analyzer.smoothingTimeConstant = 0.7;
            analyzer.minDecibels = -90;
            analyzer.maxDecibels = -10;
            
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

    const draw = () => {
      if (!isPlaying || !analyzer) return;

      analyzer.getByteFrequencyData(dataArray);

      // Clear canvas with dark background
      ctx.fillStyle = 'rgba(16, 24, 32, 0.2)';
      ctx.fillRect(0, 0, rect.width, rect.height);

      // Calculate total energy to see if we're getting audio data
      let totalEnergy = 0;
      for (let i = 0; i < bufferLength; i++) {
        totalEnergy += dataArray[i];
      }
      
      // Debug audio data every few frames
      if (Math.random() < 0.01) { // Log ~1% of frames to avoid spam
        console.log('🎵 Audio data:', {
          totalEnergy,
          maxValue: Math.max(...Array.from(dataArray)),
          avgValue: totalEnergy / bufferLength,
          sampleValues: [dataArray[0], dataArray[10], dataArray[50], dataArray[100]]
        });
      }

      // Draw frequency bars
      const barWidth = rect.width / (bufferLength * 0.4); // Show more frequency range
      let x = 0;

      for (let i = 0; i < bufferLength * 0.4; i++) {
        const barHeight = (dataArray[i] / 255) * rect.height * 0.8;
        
        // Add minimum bar height for visual feedback
        const minBarHeight = 2;
        const finalBarHeight = Math.max(barHeight, dataArray[i] > 0 ? minBarHeight : 0);
        
        // Color based on frequency range
        let color;
        const freqRatio = i / (bufferLength * 0.4);
        
        if (freqRatio < 0.2) {
          // Bass frequencies - blue/cyan
          color = `hsl(${200 + (freqRatio * 40)}, 80%, ${40 + (finalBarHeight / rect.height) * 40}%)`;
        } else if (freqRatio < 0.6) {
          // Mid frequencies - green/yellow
          color = `hsl(${120 - (freqRatio * 80)}, 70%, ${35 + (finalBarHeight / rect.height) * 45}%)`;
        } else {
          // High frequencies - orange/red
          color = `hsl(${35 - (freqRatio * 25)}, 85%, ${40 + (finalBarHeight / rect.height) * 35}%)`;
        }

        ctx.fillStyle = color;
        ctx.fillRect(x, rect.height - finalBarHeight, barWidth - 1, finalBarHeight);
        
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