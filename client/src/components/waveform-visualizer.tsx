import React, { useEffect, useRef, useMemo } from 'react';
import type { SongWithTracks } from '@shared/schema';

interface WaveformVisualizerProps {
  song: SongWithTracks | null;
  currentTime: number;
  isPlaying: boolean;
  audioLevels?: Record<string, number>;
  className?: string;
}

export function WaveformVisualizer({ 
  song, 
  currentTime, 
  isPlaying, 
  audioLevels = {},
  className = ""
}: WaveformVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();

  // Generate a static waveform pattern based on song data
  const waveformData = useMemo(() => {
    if (!song || song.tracks.length === 0) return [];

    const duration = song.duration || 240; // Default 4 minutes
    const sampleCount = 800; // Number of waveform samples
    const data: number[] = [];

    // Create a realistic waveform pattern
    for (let i = 0; i < sampleCount; i++) {
      const position = i / sampleCount;
      const time = position * duration;
      
      // Create a base waveform with varying intensity
      let amplitude = 0.3 + Math.sin(position * Math.PI * 8) * 0.2; // Base pattern
      amplitude += Math.sin(position * Math.PI * 32) * 0.15; // Higher frequency detail
      amplitude += Math.sin(position * Math.PI * 64) * 0.1; // Even higher frequency
      
      // Add some randomness for realism
      amplitude += (Math.random() - 0.5) * 0.1;
      
      // Create sections with different intensities (verse, chorus, bridge)
      const sectionPhase = (position * 4) % 1;
      if (sectionPhase < 0.25 || sectionPhase > 0.75) {
        amplitude *= 0.7; // Quieter sections (verses)
      } else {
        amplitude *= 1.2; // Louder sections (chorus)
      }
      
      // Fade in/out at beginning and end
      if (position < 0.05) amplitude *= position * 20;
      if (position > 0.95) amplitude *= (1 - position) * 20;
      
      // Clamp amplitude
      amplitude = Math.max(0, Math.min(1, amplitude));
      data.push(amplitude);
    }

    return data;
  }, [song]);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas || !song) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    const duration = song.duration || 240;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw background
    ctx.fillStyle = 'rgba(15, 23, 42, 0.8)'; // slate-900 with opacity
    ctx.fillRect(0, 0, width, height);

    if (waveformData.length === 0) return;

    const barWidth = width / waveformData.length;
    const centerY = height / 2;
    const maxHeight = height * 0.8;

    // Draw waveform bars
    waveformData.forEach((amplitude, index) => {
      const x = index * barWidth;
      const barHeight = amplitude * maxHeight;
      
      // Calculate position in song
      const position = index / waveformData.length;
      const timeAtPosition = position * duration;
      
      // Determine color based on playback position and activity
      let color;
      if (timeAtPosition <= currentTime && isPlaying) {
        // Played portion - use dynamic color based on current audio levels
        const avgLevel = Object.values(audioLevels).reduce((sum, level) => sum + level, 0) / Object.keys(audioLevels).length || 0;
        const intensity = Math.min(1, avgLevel / 50 + 0.3);
        color = `rgba(34, 197, 94, ${intensity})`; // Green with variable intensity
      } else if (timeAtPosition <= currentTime + 5 && isPlaying) {
        // Upcoming section (next 5 seconds) - blue hint
        const proximity = 1 - (timeAtPosition - currentTime) / 5;
        color = `rgba(59, 130, 246, ${proximity * 0.4})`; // Blue with fade
      } else {
        // Unplayed portion - gray
        color = 'rgba(71, 85, 105, 0.6)'; // slate-600
      }

      ctx.fillStyle = color;
      ctx.fillRect(x, centerY - barHeight / 2, Math.max(1, barWidth - 0.5), barHeight);
    });

    // Draw progress line
    if (isPlaying && duration > 0) {
      const progressX = (currentTime / duration) * width;
      
      // Progress line with glow effect
      ctx.shadowColor = 'rgba(34, 197, 94, 0.8)';
      ctx.shadowBlur = 4;
      ctx.strokeStyle = 'rgba(34, 197, 94, 0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(progressX, 0);
      ctx.lineTo(progressX, height);
      ctx.stroke();
      
      // Reset shadow
      ctx.shadowBlur = 0;
    }

    // Draw time indicators
    if (duration > 0) {
      ctx.fillStyle = 'rgba(148, 163, 184, 0.7)'; // slate-400
      ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      
      // Draw time markers every 30 seconds
      const interval = 30;
      for (let time = 0; time <= duration; time += interval) {
        const x = (time / duration) * width;
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        const timeLabel = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        if (x > 20 && x < width - 20) { // Don't draw too close to edges
          ctx.fillText(timeLabel, x, height - 4);
        }
      }
    }
  };

  useEffect(() => {
    const animate = () => {
      draw();
      if (isPlaying) {
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };

    animate();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [song, currentTime, isPlaying, audioLevels, waveformData]);

  // Redraw when not playing but data changes
  useEffect(() => {
    if (!isPlaying) {
      draw();
    }
  }, [song, currentTime, waveformData]);

  if (!song || song.tracks.length === 0) {
    return (
      <div className={`bg-slate-900/80 rounded-lg border border-slate-700 ${className}`}>
        <div className="flex items-center justify-center h-full text-slate-400 text-sm">
          Load a song to see waveform
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-slate-900/80 rounded-lg border border-slate-700 overflow-hidden ${className}`}>
      <canvas
        ref={canvasRef}
        width={600}
        height={40}
        className="w-full h-full"
        style={{ display: 'block', height: '40px' }}
      />
    </div>
  );
}