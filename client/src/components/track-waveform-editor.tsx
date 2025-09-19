import { useState, useRef, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, Activity, ChevronDown, ChevronRight, ZoomIn, ZoomOut, VolumeX, Focus, Play } from 'lucide-react';
import type { MuteRegion } from '@shared/schema';
import { LocalSongStorage } from '@/lib/local-song-storage';
import { BrowserFileSystem } from '@/lib/browser-file-system';
import { waveformGenerator } from '@/lib/waveform-generator';
import type { StreamingAudioEngine } from '@/lib/streaming-audio-engine';

interface TrackWaveformEditorProps {
  trackId: string;
  songId: string;
  userEmail: string;
  audioUrl: string;
  duration: number; // Track duration in seconds
  isCollapsed?: boolean;
  onRegionsChange?: (regions: MuteRegion[]) => void;
  audioEngine?: StreamingAudioEngine; // Audio engine to sync mute regions
}

export function TrackWaveformEditor({
  trackId,
  songId,
  userEmail,
  audioUrl,
  duration,
  isCollapsed = true,
  onRegionsChange,
  audioEngine
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
  const [pendingSelection, setPendingSelection] = useState<{start: number, end: number} | null>(null); // For dual-function buttons
  const [isPlayingSelection, setIsPlayingSelection] = useState(false); // Track if selection is playing
  const [zoomLevel, setZoomLevel] = useState(1); // Zoom level for precision editing
  const [zoomOffset, setZoomOffset] = useState(0); // Offset for zoomed view

  // Canvas dimensions - full width of container
  const CANVAS_WIDTH = 850; // Wider for full container width
  const CANVAS_HEIGHT = 80;
  const MARGIN = 10;

  // Load mute regions from storage and sync with audio engine
  useEffect(() => {
    const savedRegions = LocalSongStorage.getMuteRegions(userEmail, songId, trackId);
    setRegions(savedRegions);
    // Sync regions with audio engine
    if (audioEngine && savedRegions.length > 0) {
      audioEngine.setTrackMuteRegions(trackId, savedRegions);
      console.log(`🔇 Loaded ${savedRegions.length} mute regions for track ${trackId}`);
    }
  }, [userEmail, songId, trackId, audioEngine]);

  // Cleanup document listeners on unmount
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleDocumentMouseMove);
      document.removeEventListener('mouseup', handleDocumentMouseUp);
    };
  }, []);

  // Generate waveform data when expanded
  useEffect(() => {
    if (!collapsed && !waveformData && audioUrl) {
      // Check cache first before generating
      const cachedWaveform = waveformGenerator.getCachedTrackWaveform(trackId);
      if (cachedWaveform) {
        console.log(`✅ Using cached waveform for track ${trackId}`);
        setWaveformData(cachedWaveform);
      } else {
        generateWaveform();
      }
    }
  }, [collapsed, waveformData, audioUrl]);

  // Draw waveform and regions
  useEffect(() => {
    if (!collapsed && waveformData && canvasRef.current) {
      drawWaveform();
    }
  }, [collapsed, waveformData, regions, dragState, selectedRegion, zoomLevel, zoomOffset, pendingSelection]);

  const generateWaveform = async () => {
    if (!audioUrl || isGenerating) return;
    
    setIsGenerating(true);
    
    let workingAudioUrl = audioUrl;
    
    try {
      // Try the current audioUrl first, but if it fails, get a fresh one
      let audio = new Audio(workingAudioUrl);
      
      // Test if the current blob URL is valid
      const testLoad = new Promise<boolean>((resolve) => {
        const testAudio = new Audio(workingAudioUrl);
        testAudio.addEventListener('canplaythrough', () => resolve(true), { once: true });
        testAudio.addEventListener('error', () => resolve(false), { once: true });
        testAudio.load();
      });
      
      const isValidUrl = await testLoad;
      
      if (!isValidUrl) {
        const browserFS = BrowserFileSystem.getInstance();
        const freshUrl = await browserFS.getAudioUrl(trackId);
        
        if (freshUrl) {
          workingAudioUrl = freshUrl;
          audio = new Audio(workingAudioUrl);
        } else {
          throw new Error('Unable to get valid audio URL from storage');
        }
      }
      
      // Wait for the audio to load
      await new Promise<void>((resolve, reject) => {
        audio.addEventListener('canplaythrough', () => resolve(), { once: true });
        audio.addEventListener('error', (e) => reject(e), { once: true });
        audio.load();
      });

      // Create AudioContext and decode audio
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const response = await fetch(workingAudioUrl);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      // Generate peak data for visualization (reduce resolution for performance)
      const channelData = audioBuffer.getChannelData(0);
      const samples = 2000; // Higher resolution for detailed waveform
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
      
      // Save to cache for future use
      waveformGenerator.saveTrackWaveformToCache(trackId, peaks);
      
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
    
    // Draw background (dark gray to match performance page)
    ctx.fillStyle = '#374151';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const waveWidth = CANVAS_WIDTH - 2 * MARGIN;
    const waveHeight = CANVAS_HEIGHT - 2 * MARGIN;
    
    // Apply zoom to waveform display
    const visibleDuration = duration / zoomLevel;
    const visibleStart = zoomOffset;
    const visibleEnd = Math.min(visibleStart + visibleDuration, duration);
    
    // Calculate which samples to display based on zoom
    const totalSamples = waveformData.length;
    const startSample = Math.floor((visibleStart / duration) * totalSamples);
    const endSample = Math.ceil((visibleEnd / duration) * totalSamples);
    const visibleSamples = endSample - startSample;
    
    const barWidth = waveWidth / visibleSamples;

    // Draw waveform bars (only visible portion when zoomed)
    ctx.fillStyle = '#ffffff'; // White waveform on dark background
    for (let i = 0; i < visibleSamples; i++) {
      const sampleIndex = startSample + i;
      if (sampleIndex >= 0 && sampleIndex < waveformData.length) {
        const barHeight = Math.max(1, waveformData[sampleIndex] * waveHeight);
        const x = MARGIN + i * barWidth;
        const y = MARGIN + (waveHeight - barHeight) / 2;
        
        ctx.fillRect(x, y, Math.max(1, barWidth - 1), barHeight);
      }
    }

    // Draw mute regions (only if visible in current zoom)
    regions.forEach(region => {
      // Check if region is visible in current zoom level
      if (region.end >= visibleStart && region.start <= visibleEnd) {
        const regionStart = Math.max(region.start, visibleStart);
        const regionEnd = Math.min(region.end, visibleEnd);
        const startX = MARGIN + ((regionStart - visibleStart) / (visibleEnd - visibleStart)) * waveWidth;
        const endX = MARGIN + ((regionEnd - visibleStart) / (visibleEnd - visibleStart)) * waveWidth;
        const width = endX - startX;

        // Draw semi-transparent overlay
        ctx.fillStyle = selectedRegion === region.id ? 'rgba(239, 68, 68, 0.6)' : 'rgba(239, 68, 68, 0.4)';
        ctx.fillRect(startX, MARGIN, width, waveHeight);

        // Draw border
        ctx.strokeStyle = selectedRegion === region.id ? '#dc2626' : '#ef4444';
        ctx.lineWidth = selectedRegion === region.id ? 2 : 1;
        ctx.strokeRect(startX, MARGIN, width, waveHeight);
      }
    });

    // Draw drag selection (with proper zoom coordinate transformation)
    if (dragState?.isDragging && dragState.endTime !== undefined) {
      // Transform drag times to canvas coordinates using zoom view
      const startX = MARGIN + ((dragState.startTime - visibleStart) / (visibleEnd - visibleStart)) * waveWidth;
      const endX = MARGIN + ((dragState.endTime - visibleStart) / (visibleEnd - visibleStart)) * waveWidth;
      const width = Math.abs(endX - startX);
      const x = Math.min(startX, endX);

      ctx.fillStyle = 'rgba(59, 130, 246, 0.3)';
      ctx.fillRect(x, MARGIN, width, waveHeight);
      
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, MARGIN, width, waveHeight);
    }

    // Draw pending selection (same as drag but persistent)
    if (pendingSelection) {
      const startX = MARGIN + ((pendingSelection.start - visibleStart) / (visibleEnd - visibleStart)) * waveWidth;
      const endX = MARGIN + ((pendingSelection.end - visibleStart) / (visibleEnd - visibleStart)) * waveWidth;
      const width = Math.abs(endX - startX);
      const x = Math.min(startX, endX);

      ctx.fillStyle = 'rgba(34, 197, 94, 0.3)';
      ctx.fillRect(x, MARGIN, width, waveHeight);
      
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, MARGIN, width, waveHeight);
    }
  };

  // Zoom control functions
  const zoomIn = () => {
    setZoomLevel(prev => Math.min(prev * 2, 20)); // Max 20x zoom
  };

  const zoomOut = () => {
    setZoomLevel(prev => {
      const newZoom = Math.max(prev / 2, 1); // Min 1x zoom
      if (newZoom === 1) {
        setZoomOffset(0); // Reset offset when fully zoomed out
      }
      return newZoom;
    });
  };

  const resetZoom = () => {
    setZoomLevel(1);
    setZoomOffset(0);
  };

  // Dual-function actions for pending selection
  const muteSelection = async () => {
    if (!pendingSelection) return;
    await createMuteRegion(pendingSelection.start, pendingSelection.end);
    setPendingSelection(null); // Clear selection after use
  };

  const zoomToSelection = () => {
    if (!pendingSelection) return;
    
    const selectionDuration = pendingSelection.end - pendingSelection.start;
    const padding = selectionDuration * 0.1; // 10% padding on each side
    const paddedDuration = selectionDuration + 2 * padding; // Total duration with symmetric padding
    
    const newZoomLevel = Math.min(duration / paddedDuration, 20); // Max 20x zoom
    const visibleDuration = duration / newZoomLevel;
    const desiredOffset = pendingSelection.start - padding; // Center selection with padding
    
    // Clamp offset to valid range to prevent truncation
    const newZoomOffset = Math.min(
      Math.max(0, desiredOffset), 
      Math.max(0, duration - visibleDuration)
    );
    
    setZoomLevel(newZoomLevel);
    setZoomOffset(newZoomOffset);
    setPendingSelection(null); // Clear selection after use
  };

  // Simple play selection function
  const playSelection = async () => {
    console.log('🎵 Step 1: Function called');
    if (!pendingSelection || !audioUrl || isPlayingSelection) {
      console.log('🎵 Step 1 FAIL: Missing requirements', { pendingSelection: !!pendingSelection, audioUrl: !!audioUrl, isPlayingSelection });
      return;
    }
    
    console.log(`🎵 Step 2: Playing selection: ${pendingSelection.start.toFixed(2)}s to ${pendingSelection.end.toFixed(2)}s (duration: ${(pendingSelection.end - pendingSelection.start).toFixed(2)}s)`);
    
    console.log('🎵 Step 3: Setting isPlayingSelection to true');
    setIsPlayingSelection(true);
    
    console.log('🎵 Step 4: Entering try block');
    try {
      console.log('🎵 Step 5: Getting fresh audio URL');
      // Get a fresh audio URL to ensure it's valid
      let workingUrl = audioUrl;
      const browserFS = BrowserFileSystem.getInstance();
      console.log('🎵 Step 6: BrowserFS instance created');
      const freshUrl = await browserFS.getAudioUrl(trackId);
      console.log('🎵 Step 7: Fresh URL obtained:', !!freshUrl);
      if (freshUrl) {
        workingUrl = freshUrl;
      }
      
      console.log(`🎵 Step 8: Creating audio element with URL: ${workingUrl.substring(0, 50)}...`);
      const audio = new Audio(workingUrl);
      console.log('🎵 Step 9: Audio element created');
      
      // Simple approach - set currentTime directly and play
      console.log(`🎵 Step 10: Setting currentTime to ${pendingSelection.start.toFixed(2)}s`);
      audio.currentTime = pendingSelection.start;
      console.log(`🎵 Step 11: currentTime was set to: ${audio.currentTime.toFixed(2)}s`);
      
      // Calculate exact duration to play
      const selectionDuration = pendingSelection.end - pendingSelection.start;
      console.log(`🎵 Step 12: Calculated duration: ${selectionDuration.toFixed(2)}s`);
      let timeoutId: ReturnType<typeof setTimeout>;
      
      const stopPlayback = () => {
        console.log(`🎵 Stopping playback at: ${audio.currentTime.toFixed(2)}s`);
        audio.pause();
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        setIsPlayingSelection(false);
      };
      
      console.log('🎵 Step 13: Setting up timeout');
      // Use setTimeout for precise duration control
      timeoutId = setTimeout(stopPlayback, selectionDuration * 1000);
      
      console.log('🎵 Step 14: Adding event listener');
      audio.addEventListener('ended', stopPlayback);
      
      console.log(`🎵 Step 15: Starting playback...`);
      await audio.play();
      console.log(`🎵 Step 16: Playback actually started at: ${audio.currentTime.toFixed(2)}s`);
    } catch (error) {
      console.error('🎵 Error playing selection:', error);
      setIsPlayingSelection(false);
    }
  };

  const getTimeFromX = (x: number): number => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    
    const relativeX = x - rect.left - MARGIN;
    // Scale from display coordinates to internal canvas coordinates
    const scaledX = relativeX * (CANVAS_WIDTH / rect.width);
    const waveWidth = CANVAS_WIDTH - 2 * MARGIN;
    const normalizedX = Math.max(0, Math.min(1, scaledX / waveWidth));
    
    // Apply zoom calculations
    const visibleDuration = duration / zoomLevel;
    const visibleStart = zoomOffset;
    const visibleEnd = Math.min(visibleStart + visibleDuration, duration);
    
    return visibleStart + normalizedX * (visibleEnd - visibleStart);
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
      setPendingSelection(null);
    } else {
      // Start new selection
      setSelectedRegion(null);
      setPendingSelection(null);
      setDragState({
        isDragging: true,
        startX: e.clientX,
        startTime,
      });
      
      // Add document listeners for dragging outside canvas
      document.addEventListener('mousemove', handleDocumentMouseMove);
      document.addEventListener('mouseup', handleDocumentMouseUp);
    }
  };

  const handleDocumentMouseMove = (e: MouseEvent) => {
    if (!dragState?.isDragging) return;
    
    const endTime = getTimeFromX(e.clientX);
    setDragState({
      ...dragState,
      endTime
    });
  };

  const handleDocumentMouseUp = () => {
    // Remove document listeners
    document.removeEventListener('mousemove', handleDocumentMouseMove);
    document.removeEventListener('mouseup', handleDocumentMouseUp);
    
    if (dragState?.isDragging && dragState.endTime !== undefined) {
      const startTime = Math.min(dragState.startTime, dragState.endTime);
      const endTime = Math.max(dragState.startTime, dragState.endTime);
      
      // Create selection if larger than 0.1 seconds
      if (endTime - startTime >= 0.1) {
        setPendingSelection({ start: startTime, end: endTime });
        setSelectedRegion(null);
      }
    }
    
    setDragState(null);
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
    // Canvas mouse up - just remove document listeners if they exist
    document.removeEventListener('mousemove', handleDocumentMouseMove);
    document.removeEventListener('mouseup', handleDocumentMouseUp);
    
    if (dragState?.isDragging && dragState.endTime !== undefined) {
      const startTime = Math.min(dragState.startTime, dragState.endTime);
      const endTime = Math.max(dragState.startTime, dragState.endTime);
      
      // Create selection if larger than 0.1 seconds
      if (endTime - startTime >= 0.1) {
        setPendingSelection({ start: startTime, end: endTime });
        setSelectedRegion(null);
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
      
      // Sync with audio engine for real-time muting
      if (audioEngine) {
        audioEngine.setTrackMuteRegions(trackId, updatedRegions);
        console.log(`🔇 Added mute region ${start.toFixed(1)}s-${end.toFixed(1)}s to track ${trackId}`);
      }
    }
  };

  const deleteRegion = (regionId: string) => {
    const success = LocalSongStorage.deleteMuteRegion(userEmail, songId, trackId, regionId);
    if (success) {
      const updatedRegions = regions.filter(r => r.id !== regionId);
      setRegions(updatedRegions);
      setSelectedRegion(null);
      onRegionsChange?.(updatedRegions);
      
      // Sync with audio engine
      if (audioEngine) {
        audioEngine.setTrackMuteRegions(trackId, updatedRegions);
        console.log(`🔇 Removed mute region from track ${trackId}`);
      }
    }
  };

  const clearAllRegions = () => {
    regions.forEach(region => {
      LocalSongStorage.deleteMuteRegion(userEmail, songId, trackId, region.id);
    });
    setRegions([]);
    setSelectedRegion(null);
    onRegionsChange?.([]);
    
    // Clear from audio engine
    if (audioEngine) {
      audioEngine.setTrackMuteRegions(trackId, []);
      console.log(`🔇 Cleared all mute regions from track ${trackId}`);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="border rounded-lg bg-gray-700 border-gray-600">
      {/* Header with toggle */}
      <div 
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-600"
        onClick={() => setCollapsed(!collapsed)}
        data-testid={`toggle-waveform-editor-${trackId}`}
      >
        <div className="flex items-center gap-2">
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          <Activity className="h-4 w-4" />
          <span className="text-sm font-medium text-white">Waveform & Mute Regions</span>
          {regions.length > 0 && (
            <span className="text-xs bg-red-900 text-red-200 px-2 py-1 rounded">
              {regions.length} muted
            </span>
          )}
        </div>
      </div>

      {/* Expanded content */}
      {!collapsed && (
        <div className="p-3 pt-0 space-y-3">
          {/* Waveform canvas */}
          <div className="bg-gray-800 rounded-lg p-4">
            {isGenerating ? (
              <div className="flex items-center justify-center h-20">
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
                  Generating waveform...
                </div>
              </div>
            ) : waveformData ? (
              <div>
                {/* Zoom controls */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-300">Zoom:</span>
                    <Button
                      onClick={zoomOut}
                      variant="outline"
                      size="sm"
                      disabled={zoomLevel <= 1}
                      data-testid={`button-zoom-out-${trackId}`}
                    >
                      <ZoomOut className="h-3 w-3" />
                    </Button>
                    <span className="text-xs text-gray-300 min-w-[30px] text-center">
                      {zoomLevel.toFixed(1)}x
                    </span>
                    <Button
                      onClick={zoomIn}
                      variant="outline"
                      size="sm"
                      disabled={zoomLevel >= 20}
                      data-testid={`button-zoom-in-${trackId}`}
                    >
                      <ZoomIn className="h-3 w-3" />
                    </Button>
                    {zoomLevel > 1 && (
                      <Button
                        onClick={resetZoom}
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        data-testid={`button-reset-zoom-${trackId}`}
                      >
                        Reset
                      </Button>
                    )}
                    {/* Dual-function selection buttons */}
                    {pendingSelection && (
                      <>
                        <Button
                          onClick={playSelection}
                          variant="outline"
                          size="sm"
                          className="text-xs bg-green-700 hover:bg-green-600 text-white border-green-600"
                          disabled={isPlayingSelection}
                          data-testid={`button-play-selection-${trackId}`}
                        >
                          <Play className="h-3 w-3 mr-1" />
                          {isPlayingSelection ? 'Playing...' : 'Play'}
                        </Button>
                        <Button
                          onClick={async () => {
                            console.log('🧪 TEST: Direct audio test starting...');
                            try {
                              const audio = new Audio(audioUrl);
                              console.log('🧪 TEST: Setting currentTime to 10 seconds');
                              audio.currentTime = 10;
                              console.log('🧪 TEST: Audio currentTime is now:', audio.currentTime);
                              await audio.play();
                              console.log('🧪 TEST: Playback started at:', audio.currentTime);
                              setTimeout(() => {
                                console.log('🧪 TEST: Stopping at:', audio.currentTime);
                                audio.pause();
                              }, 3000);
                            } catch (error) {
                              console.error('🧪 TEST: Error:', error);
                            }
                          }}
                          variant="outline"
                          size="sm"
                          className="text-xs bg-yellow-700 hover:bg-yellow-600 text-white border-yellow-600"
                        >
                          Test 10s
                        </Button>
                        <Button
                          onClick={muteSelection}
                          variant="outline"
                          size="sm"
                          className="text-xs bg-red-700 hover:bg-red-600 text-white border-red-600"
                          data-testid={`button-mute-selection-${trackId}`}
                        >
                          <VolumeX className="h-3 w-3 mr-1" />
                          Mute
                        </Button>
                        <Button
                          onClick={zoomToSelection}
                          variant="outline"
                          size="sm"
                          className="text-xs bg-blue-700 hover:bg-blue-600 text-white border-blue-600"
                          data-testid={`button-zoom-to-selection-${trackId}`}
                        >
                          <Focus className="h-3 w-3 mr-1" />
                          Zoom
                        </Button>
                      </>
                    )}
                  </div>
                  {zoomLevel > 1 && (
                    <div className="text-xs text-gray-300">
                      Viewing: {formatTime(zoomOffset)} - {formatTime(Math.min(zoomOffset + duration / zoomLevel, duration))}
                    </div>
                  )}
                </div>
                <canvas
                  ref={canvasRef}
                  width={CANVAS_WIDTH}
                  height={CANVAS_HEIGHT}
                  className="border border-gray-500 rounded cursor-crosshair w-full"
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={() => setDragState(null)}
                  data-testid={`waveform-canvas-${trackId}`}
                />
                <div className="text-xs text-gray-300 mt-2">
                  {pendingSelection 
                    ? `Selection: ${formatTime(pendingSelection.start)} - ${formatTime(pendingSelection.end)} (${formatTime(pendingSelection.end - pendingSelection.start)}). Choose action above.`
                    : "Click and drag to select. Click existing regions to select them."
                  }
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
                  <Activity className="h-4 w-4 mr-2" />
                  Generate Waveform
                </Button>
              </div>
            )}
          </div>

          {/* Region controls */}
          {regions.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-white">Muted Regions ({regions.length})</h4>
                <Button
                  onClick={clearAllRegions}
                  variant="outline"
                  size="sm"
                  className="text-red-400 hover:text-red-300 border-red-600"
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
                        ? 'bg-red-900/20 border border-red-800 text-white' 
                        : 'bg-gray-600 text-white'
                    }`}
                    data-testid={`mute-region-${region.id}`}
                  >
                    <span>
                      {formatTime(region.start)} - {formatTime(region.end)} 
                      <span className="text-gray-400 ml-2">
                        ({formatTime(region.end - region.start)})
                      </span>
                    </span>
                    <Button
                      onClick={() => deleteRegion(region.id)}
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-red-400 hover:text-red-300"
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