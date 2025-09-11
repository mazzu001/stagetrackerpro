interface StatusBarProps {
  isAudioEngineOnline: boolean;
  latency: number;
  // Broadcast status
  isHost?: boolean;
  isViewer?: boolean;
  currentRoom?: string | null;
}

export default function StatusBar({ 
  isAudioEngineOnline, 
  latency,
  isHost = false,
  isViewer = false,
  currentRoom = null
}: StatusBarProps) {
  return (
    <div className="bg-surface rounded-xl p-4 border border-gray-700" data-testid="status-bar">
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
        
        <div className="flex items-center space-x-4 text-sm text-gray-400">
          <span>Buffer: 256 samples</span>
          <span>Sample Rate: 48kHz</span>
          <span>Bit Depth: 24-bit</span>
        </div>
      </div>
    </div>
  );
}
