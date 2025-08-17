import { Cpu } from "lucide-react";

interface StatusBarProps {
  isAudioEngineOnline: boolean;
  isMidiConnected: boolean;
  cpuUsage: number;
}

export default function StatusBar({ 
  isAudioEngineOnline, 
  isMidiConnected, 
  cpuUsage 
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
            <div className={`w-3 h-3 rounded-full ${isMidiConnected ? 'bg-secondary' : 'bg-gray-500'}`} />
            <span className="text-sm">
              MIDI: <span className={isMidiConnected ? 'text-secondary' : 'text-gray-400'}>
                {isMidiConnected ? 'Connected' : 'Disconnected'}
              </span>
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <Cpu className="text-primary w-4 h-4" />
            <span className="text-sm">
              CPU: <span className="text-primary">{cpuUsage}%</span>
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
