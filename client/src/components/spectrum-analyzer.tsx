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

    // Smart audio detection and connection
    let analyzer: AnalyserNode | null = null;
    let audioContext: AudioContext | null = null;
    
    try {
      // First try: Connect to audio engine if available
      if (audioEngine && typeof audioEngine.getState === 'function' && typeof audioEngine.getAudioContext === 'function') {
        const engineState = audioEngine.getState();
        audioContext = audioEngine.getAudioContext();
        
        if (engineState?.masterGainNode && audioContext) {
          analyzer = audioContext.createAnalyser();
          analyzer.fftSize = 1024;
          analyzer.smoothingTimeConstant = 0.7;
          analyzer.minDecibels = -90;
          analyzer.maxDecibels = -10;
          
          engineState.masterGainNode.connect(analyzer);
          analyzerRef.current = analyzer;
          console.log('🎛️ Spectrum analyzer connected to audio engine');
        }
      }
      
      // Second try: Find and connect to playing HTML audio elements
      if (!analyzer) {
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        analyzer = audioContext.createAnalyser();
        analyzer.fftSize = 1024;
        analyzer.smoothingTimeConstant = 0.7;
        analyzer.minDecibels = -90;
        analyzer.maxDecibels = -10;
        
        // Look for any playing audio elements
        const audioElements = document.querySelectorAll('audio');
        let connectedToAudio = false;
        
        audioElements.forEach((audio, index) => {
          if (!audio.paused && !audio.muted && audio.currentTime > 0) {
            try {
              const source = audioContext!.createMediaElementSource(audio);
              source.connect(analyzer!);
              analyzer!.connect(audioContext!.destination);
              connectedToAudio = true;
              console.log(`🎛️ Spectrum analyzer connected to audio element ${index + 1}`);
            } catch (e) {
              // Audio element might already have a source
              console.log(`⚠️ Could not connect to audio element ${index + 1}:`, e);
            }
          }
        });
        
        console.log(`🔍 Found ${audioElements.length} audio elements, ${connectedToAudio ? 'connected to one' : 'none playing'}`);
        
        if (!connectedToAudio) {
          console.log('🔍 No playing audio detected - spectrum analyzer ready but no data source');
        }
        
        analyzerRef.current = analyzer;
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