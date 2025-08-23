interface StatusBarProps {
  isAudioEngineOnline: boolean;
  isMidiConnected: boolean;
  midiDeviceName?: string;
  latency: number;
}

export default function StatusBar({ 
  isAudioEngineOnline, 
  isMidiConnected, 
  midiDeviceName,
  latency 
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
            <div className={`w-3 h-3 rounded-full ${isMidiConnected ? 'bg-green-500' : 'bg-gray-500'}`} />
            <span className="text-sm">
              MIDI: <span className={isMidiConnected ? 'text-green-500' : 'text-gray-400'}>
                {isMidiConnected ? 'Connected' : 'Disconnected'}
                {midiDeviceName && (
                  <span className="text-gray-400 ml-1">({midiDeviceName})</span>
                )}
              </span>
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-400">
              Latency: <span className="text-secondary">{latency.toFixed(1)}ms</span>
            </span>
          </div>

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
