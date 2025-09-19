import { useState, useRef, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, Waveform, ChevronDown, ChevronRight } from 'lucide-react';
import type { MuteRegion } from '@shared/schema';
import { LocalSongStorage } from '@/lib/local-song-storage';

interface TrackWaveformEditorProps {
  trackId: string;
  songId: string;
  userEmail: string;
  audioUrl: string;
  duration: number; // Track duration in seconds
  isCollapsed?: boolean;
  onRegionsChange?: (regions: MuteRegion[]) => void;
}

export function TrackWaveformEditor({
  trackId,
  songId,
  userEmail,
  audioUrl,
  duration,
  isCollapsed = true,
  onRegionsChange
}: TrackWaveformEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [collapsed, setCollapsed] = useState(isCollapsed);
  const [regions, setRegions] = useState<MuteRegion[]>([]);
  const [waveformData, setWaveformData] = useState<Float32Array | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [dragState, setDragState] = useState<{
    isDragging: boolean;
    startX: number;
    startTime: number;
    endTime?: number;
  } | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);

  // Canvas dimensions
  const CANVAS_WIDTH = 600;
  const CANVAS_HEIGHT = 80;
  const MARGIN = 10;

  // Load mute regions from storage
  useEffect(() => {
    const savedRegions = LocalSongStorage.getMuteRegions(userEmail, songId, trackId);
    setRegions(savedRegions);
  }, [userEmail, songId, trackId]);

  // Generate waveform data when expanded
  useEffect(() => {
    if (!collapsed && !waveformData && audioUrl) {
      generateWaveform();
    }
  }, [collapsed, waveformData, audioUrl]);

  // Draw waveform and regions
  useEffect(() => {
    if (!collapsed && waveformData && canvasRef.current) {
      drawWaveform();
    }
  }, [collapsed, waveformData, regions, dragState, selectedRegion]);

  const generateWaveform = async () => {
    if (!audioUrl || isGenerating) return;
    
    setIsGenerating(true);
    try {
      // Create audio element to load the track
      const audio = new Audio(audioUrl);
      
      // Wait for the audio to load
      await new Promise<void>((resolve, reject) => {
        audio.addEventListener('canplaythrough', () => resolve(), { once: true });
        audio.addEventListener('error', (e) => reject(e), { once: true });
        audio.load();
      });

      // Create AudioContext and decode audio
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      // Generate peak data for visualization (reduce resolution for performance)
      const channelData = audioBuffer.getChannelData(0);
      const samples = 500; // Reduce sample count for performance
      const blockSize = Math.floor(channelData.length / samples);
      const peaks = new Float32Array(samples);
      
      for (let i = 0; i < samples; i++) {
        let peak = 0;
        for (let j = 0; j < blockSize; j++) {
          const sample = Math.abs(channelData[i * blockSize + j] || 0);
          if (sample > peak) peak = sample;
        }
        peaks[i] = peak;
      }
      
      setWaveformData(peaks);
      audioContext.close();
    } catch (error) {
      console.error('Error generating waveform:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const drawWaveform = () => {
    const canvas = canvasRef.current;
    if (!canvas || !waveformData) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Draw background
    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const waveWidth = CANVAS_WIDTH - 2 * MARGIN;
    const waveHeight = CANVAS_HEIGHT - 2 * MARGIN;
    const barWidth = waveWidth / waveformData.length;

    // Draw waveform bars
    ctx.fillStyle = '#3b82f6';
    for (let i = 0; i < waveformData.length; i++) {
      const barHeight = Math.max(1, waveformData[i] * waveHeight);
      const x = MARGIN + i * barWidth;
      const y = MARGIN + (waveHeight - barHeight) / 2;
      
      ctx.fillRect(x, y, Math.max(1, barWidth - 1), barHeight);
    }

    // Draw mute regions
    regions.forEach(region => {
      const startX = MARGIN + (region.start / duration) * waveWidth;
      const endX = MARGIN + (region.end / duration) * waveWidth;
      const width = endX - startX;

      // Draw semi-transparent overlay
      ctx.fillStyle = selectedRegion === region.id ? 'rgba(239, 68, 68, 0.6)' : 'rgba(239, 68, 68, 0.4)';
      ctx.fillRect(startX, MARGIN, width, waveHeight);

      // Draw border
      ctx.strokeStyle = selectedRegion === region.id ? '#dc2626' : '#ef4444';
      ctx.lineWidth = selectedRegion === region.id ? 2 : 1;
      ctx.strokeRect(startX, MARGIN, width, waveHeight);
    });

    // Draw drag selection
    if (dragState?.isDragging && dragState.endTime !== undefined) {
      const startX = MARGIN + (dragState.startTime / duration) * waveWidth;
      const endX = MARGIN + (dragState.endTime / duration) * waveWidth;
      const width = Math.abs(endX - startX);
      const x = Math.min(startX, endX);

      ctx.fillStyle = 'rgba(59, 130, 246, 0.3)';
      ctx.fillRect(x, MARGIN, width, waveHeight);
      
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, MARGIN, width, waveHeight);
    }
  };

  const getTimeFromX = (x: number): number => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    
    const relativeX = x - rect.left - MARGIN;
    const waveWidth = CANVAS_WIDTH - 2 * MARGIN;
    const time = (relativeX / waveWidth) * duration;
    
    return Math.max(0, Math.min(duration, time));
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    
    const startTime = getTimeFromX(e.clientX);
    
    // Check if clicking on existing region
    const clickedRegion = regions.find(region => 
      startTime >= region.start && startTime <= region.end
    );
    
    if (clickedRegion) {
      setSelectedRegion(clickedRegion.id);
    } else {
      // Start new region selection
      setSelectedRegion(null);
      setDragState({
        isDragging: true,
        startX: e.clientX,
        startTime,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragState?.isDragging) return;
    
    const endTime = getTimeFromX(e.clientX);
    setDragState({
      ...dragState,
      endTime
    });
  };

  const handleMouseUp = () => {
    if (dragState?.isDragging && dragState.endTime !== undefined) {
      const startTime = Math.min(dragState.startTime, dragState.endTime);
      const endTime = Math.max(dragState.startTime, dragState.endTime);
      
      // Only create region if it's larger than 0.1 seconds
      if (endTime - startTime >= 0.1) {
        createMuteRegion(startTime, endTime);
      }
    }
    
    setDragState(null);
  };

  const createMuteRegion = async (start: number, end: number) => {
    const newRegion = LocalSongStorage.addMuteRegion(userEmail, songId, trackId, {
      start,
      end
    });
    
    if (newRegion) {
      const updatedRegions = [...regions, newRegion];
      setRegions(updatedRegions);
      onRegionsChange?.(updatedRegions);
    }
  };

  const deleteRegion = (regionId: string) => {
    const success = LocalSongStorage.deleteMuteRegion(userEmail, songId, trackId, regionId);
    if (success) {
      const updatedRegions = regions.filter(r => r.id !== regionId);
      setRegions(updatedRegions);
      setSelectedRegion(null);
      onRegionsChange?.(updatedRegions);
    }
  };

  const clearAllRegions = () => {
    regions.forEach(region => {
      LocalSongStorage.deleteMuteRegion(userEmail, songId, trackId, region.id);
    });
    setRegions([]);
    setSelectedRegion(null);
    onRegionsChange?.([]);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="border rounded-lg bg-white dark:bg-gray-800">
      {/* Header with toggle */}
      <div 
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
        onClick={() => setCollapsed(!collapsed)}
        data-testid={`toggle-waveform-editor-${trackId}`}
      >
        <div className="flex items-center gap-2">
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          <Waveform className="h-4 w-4" />
          <span className="text-sm font-medium">Waveform & Mute Regions</span>
          {regions.length > 0 && (
            <span className="text-xs bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 px-2 py-1 rounded">
              {regions.length} muted
            </span>
          )}
        </div>
      </div>

      {/* Expanded content */}
      {!collapsed && (
        <div className="p-3 pt-0 space-y-3">
          {/* Waveform canvas */}
          <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4">
            {isGenerating ? (
              <div className="flex items-center justify-center h-20">
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
                  Generating waveform...
                </div>
              </div>
            ) : waveformData ? (
              <div>
                <canvas
                  ref={canvasRef}
                  width={CANVAS_WIDTH}
                  height={CANVAS_HEIGHT}
                  className="border rounded cursor-crosshair"
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={() => setDragState(null)}
                  data-testid={`waveform-canvas-${trackId}`}
                />
                <div className="text-xs text-gray-500 mt-2">
                  Click and drag to create mute regions. Click existing regions to select them.
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-20">
                <Button 
                  onClick={generateWaveform}
                  variant="outline"
                  size="sm"
                  data-testid={`button-generate-waveform-${trackId}`}
                >
                  <Waveform className="h-4 w-4 mr-2" />
                  Generate Waveform
                </Button>
              </div>
            )}
          </div>

          {/* Region controls */}
          {regions.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Muted Regions ({regions.length})</h4>
                <Button
                  onClick={clearAllRegions}
                  variant="outline"
                  size="sm"
                  className="text-red-600 hover:text-red-700"
                  data-testid={`button-clear-all-regions-${trackId}`}
                >
                  Clear All
                </Button>
              </div>
              
              <div className="space-y-1">
                {regions.map((region) => (
                  <div
                    key={region.id}
                    className={`flex items-center justify-between p-2 rounded text-sm ${
                      selectedRegion === region.id 
                        ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800' 
                        : 'bg-gray-50 dark:bg-gray-700'
                    }`}
                    data-testid={`mute-region-${region.id}`}
                  >
                    <span>
                      {formatTime(region.start)} - {formatTime(region.end)} 
                      <span className="text-gray-500 ml-2">
                        ({formatTime(region.end - region.start)})
                      </span>
                    </span>
                    <Button
                      onClick={() => deleteRegion(region.id)}
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                      data-testid={`button-delete-region-${region.id}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}