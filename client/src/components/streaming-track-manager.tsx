import React, { useState, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Volume2, VolumeX, Play, Pause, RotateCcw } from "lucide-react";
import { StreamingAudioEngine } from "@/lib/streaming-audio-engine";

interface StreamingTrackManagerProps {
  song: any;
  trackFiles: any[];
  onClose: () => void;
}

export default function StreamingTrackManager({ song, trackFiles, onClose }: StreamingTrackManagerProps) {
  const [streamingEngine] = useState(() => new StreamingAudioEngine());
  const [isLoading, setIsLoading] = useState(false);
  const [isStreamingReady, setIsStreamingReady] = useState(false);
  const [engineState, setEngineState] = useState(streamingEngine.getState());

  // Subscribe to streaming engine updates
  React.useEffect(() => {
    const unsubscribe = streamingEngine.subscribe(() => {
      setEngineState(streamingEngine.getState());
    });
    
    return () => {
      unsubscribe();
      streamingEngine.dispose();
    };
  }, [streamingEngine]);

  const handleStreamingLoad = useCallback(async () => {
    if (trackFiles.length === 0) return;
    
    setIsLoading(true);
    console.log(`🚀 Loading ${trackFiles.length} tracks for streaming (instant)`);
    
    try {
      // Convert track files to streaming format
      const trackData = trackFiles.map(file => ({
        id: file.id,
        name: file.name,
        url: file.url || '#', // Use actual URLs in production
      }));
      
      await streamingEngine.loadTracks(trackData);
      setIsStreamingReady(true);
      console.log(`✅ Streaming ready: ${trackFiles.length} tracks loaded instantly`);
    } catch (error) {
      console.error('Streaming load failed:', error);
    } finally {
      setIsLoading(false);
    }
  }, [trackFiles, streamingEngine]);

  const handleStreamingPlay = useCallback(async () => {
    if (!isStreamingReady) return;
    
    console.log(`▶️ Starting streaming playback`);
    await streamingEngine.play();
  }, [streamingEngine, isStreamingReady]);

  const handleStreamingPause = useCallback(() => {
    console.log(`⏸️ Pausing streaming playback`);
    streamingEngine.pause();
  }, [streamingEngine]);

  const handleStreamingStop = useCallback(() => {
    console.log(`⏹️ Stopping streaming playback`);
    streamingEngine.stop();
  }, [streamingEngine]);

  const handleTrackVolumeChange = useCallback((trackId: string, volume: number) => {
    streamingEngine.setTrackVolume(trackId, volume / 100);
  }, [streamingEngine]);

  const handleTrackMute = useCallback((trackId: string) => {
    streamingEngine.toggleTrackMute(trackId);
  }, [streamingEngine]);

  const handleMasterVolumeChange = useCallback((volume: number) => {
    streamingEngine.setMasterVolume(volume / 100);
  }, [streamingEngine]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">{song?.title || 'Unknown Song'}</h2>
          <p className="text-gray-400">{song?.artist || 'Unknown Artist'}</p>
          <Badge variant="secondary" className="mt-2">
            🚀 Streaming Mode - Zero Load Time
          </Badge>
        </div>
        <Button 
          onClick={onClose} 
          variant="outline"
          className="border-gray-600 text-gray-300 hover:bg-gray-700"
        >
          Close
        </Button>
      </div>

      {/* Streaming Load Section */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            🎵 Streaming Audio Engine
            <Badge variant="outline" className="ml-2">
              {trackFiles.length} tracks available
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-gray-400">
            Streaming mode loads tracks instantly without preloading into memory.
            Perfect for live performance with zero delay.
          </div>
          
          {!isStreamingReady ? (
            <Button 
              onClick={handleStreamingLoad}
              disabled={isLoading || trackFiles.length === 0}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              {isLoading ? 'Loading Streams...' : `🚀 Load ${trackFiles.length} Tracks for Streaming`}
            </Button>
          ) : (
            <div className="space-y-4">
              {/* Transport Controls */}
              <div className="flex items-center gap-4">
                <Button
                  onClick={engineState.isPlaying ? handleStreamingPause : handleStreamingPlay}
                  className={engineState.isPlaying ? "bg-yellow-600 hover:bg-yellow-700" : "bg-green-600 hover:bg-green-700"}
                >
                  {engineState.isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  {engineState.isPlaying ? 'Pause' : 'Play'}
                </Button>
                
                <Button
                  onClick={handleStreamingStop}
                  variant="outline"
                  className="border-gray-600 text-gray-300 hover:bg-gray-700"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Stop
                </Button>
                
                <div className="text-white">
                  {formatTime(engineState.currentTime)} / {formatTime(engineState.duration)}
                </div>
              </div>

              {/* Master Volume */}
              <div className="space-y-2">
                <label className="text-white text-sm font-medium">Master Volume</label>
                <div className="flex items-center gap-4">
                  <Volume2 className="w-4 h-4 text-gray-400" />
                  <Slider
                    value={[engineState.masterVolume * 100]}
                    onValueChange={([value]) => handleMasterVolumeChange(value)}
                    max={100}
                    step={1}
                    className="flex-1"
                  />
                  <span className="text-gray-400 text-sm w-8">
                    {Math.round(engineState.masterVolume * 100)}
                  </span>
                </div>
              </div>

              {/* Track Controls */}
              <div className="space-y-3">
                <h3 className="text-white font-medium">Streaming Tracks</h3>
                {engineState.tracks.map((track) => (
                  <Card key={track.id} className="bg-gray-700 border-gray-600">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className="text-white font-medium">{track.name}</span>
                          <Badge variant={track.muted ? "destructive" : "secondary"}>
                            {track.muted ? "Muted" : "Live"}
                          </Badge>
                        </div>
                        <Button
                          onClick={() => handleTrackMute(track.id)}
                          variant={track.muted ? "destructive" : "outline"}
                          size="sm"
                        >
                          {track.muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                        </Button>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <Volume2 className="w-4 h-4 text-gray-400" />
                        <Slider
                          value={[track.volume * 100]}
                          onValueChange={([value]) => handleTrackVolumeChange(track.id, value)}
                          max={100}
                          step={1}
                          className="flex-1"
                          disabled={track.muted}
                        />
                        <span className="text-gray-400 text-sm w-8">
                          {Math.round(track.volume * 100)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Performance Benefits */}
      <Card className="bg-blue-900/20 border-blue-700">
        <CardHeader>
          <CardTitle className="text-blue-400">🚀 Streaming Benefits</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-blue-300">
          <ul className="space-y-1">
            <li>• Zero load time - tracks stream on demand</li>
            <li>• Minimal memory usage - no preloading required</li>
            <li>• Instant playback start</li>
            <li>• Perfect for live performance setups</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}