import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface ExportTask {
  progress: number;
  status: string;
  onCancel?: () => void;
}

interface StatusBarProps {
  isAudioEngineOnline: boolean;
  latency: number;
  // Broadcast status
  isHost?: boolean;
  isViewer?: boolean;
  currentRoom?: string | null;
  // MIDI status
  midiConnected?: boolean;
  // Audio output device settings (NOT song-specific - these are AudioContext constants)
  audioInfo?: {
    sampleRate: number;
    bufferSize: number;
    bitDepth: number;
    latency: number;
  };
  // Export task
  exportTask?: ExportTask;
}

export default function StatusBar({ 
  isAudioEngineOnline, 
  latency,
  isHost = false,
  isViewer = false,
  currentRoom = null,
  midiConnected = false,
  audioInfo,
  exportTask
}: StatusBarProps) {
  // Use audio info from audio engine if available, otherwise use defaults
  const sampleRate = audioInfo?.sampleRate || 48000;
  const bufferSize = audioInfo?.bufferSize || 256;
  const bitDepth = audioInfo?.bitDepth || 32;
  
  // Format sample rate for display (e.g., 48000 -> 48kHz)
  const formatSampleRate = (rate: number) => {
    return rate >= 1000 ? `${rate / 1000}kHz` : `${rate}Hz`;
  };
  return (
    <div className="w-full" data-testid="status-bar">
      {/* Export Progress Bar */}
      {exportTask && (
        <div className="mb-3 p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg" data-testid="status-export">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-3">
              <span className="text-sm font-medium text-blue-300">Exporting Library</span>
              <span className="text-sm text-blue-200" data-testid="text-export-percentage">{exportTask.progress}%</span>
            </div>
            {exportTask.onCancel && (
              <Button
                variant="ghost" 
                size="sm" 
                onClick={exportTask.onCancel}
                className="h-6 w-6 p-0 hover:bg-red-500/20 text-gray-400 hover:text-red-300"
                data-testid="button-cancel-export"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
          <Progress value={exportTask.progress} className="w-full h-2 mb-1" data-testid="progress-export" />
          <div className="text-xs text-blue-300/70">{exportTask.status}</div>
        </div>
      )}
      
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${isAudioEngineOnline ? 'bg-secondary' : 'bg-error'}`} />
            <span className="text-sm">
              Audio Engine: <span className={isAudioEngineOnline ? 'text-secondary' : 'text-error'}>
                {isAudioEngineOnline ? 'Online' : 'Offline'}
              </span>
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${midiConnected ? 'bg-green-500' : 'bg-gray-600'}`} />
            <span className="text-sm">
              MIDI: <span className={midiConnected ? 'text-green-400' : 'text-gray-500'}>
                {midiConnected ? 'Connected' : 'Disconnected'}
              </span>
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-400">
              Latency: <span className="text-secondary">{latency.toFixed(1)}ms</span>
            </span>
          </div>
          {/* Broadcast Status Indicator */}
          {(isHost || isViewer) && (
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${isHost ? 'bg-purple-500' : 'bg-blue-500'}`} />
              <span className="text-sm">
                Broadcast: <span className={isHost ? 'text-purple-400' : 'text-blue-400'}>
                  {isHost ? '🎭 Broadcasting' : '📺 Viewing'}
                </span>
                {currentRoom && (
                  <span className="text-gray-400 ml-1">("{currentRoom}")</span>
                )}
              </span>
            </div>
          )}

        </div>
        
        <div className="flex items-center space-x-4 text-sm text-gray-500">
          <span className="text-xs uppercase tracking-wider">Audio Output:</span>
          <span>{formatSampleRate(sampleRate)}</span>
          <span>{bufferSize} samples</span>
          <span>{bitDepth}-bit</span>
        </div>
      </div>
    </div>
  );
}
