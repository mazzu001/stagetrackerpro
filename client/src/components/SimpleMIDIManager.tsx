import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { 
  Music, 
  RefreshCw, 
  Send,
  Loader2,
  Plug,
  PlugZap
} from 'lucide-react';
import { useSimpleMIDI } from '@/hooks/useSimpleMIDI';

export function SimpleMIDIManager() {
  const [testCommand, setTestCommand] = useState('[[PC:1:1]]');
  const { toast } = useToast();
  
  const {
    isInitialized,
    isLoading,
    connectedDevice,
    availableDevices,
    messages,
    initialize,
    connect,
    disconnect,
    sendCommand,
    refresh
  } = useSimpleMIDI();

  // Initialize on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  const handleConnect = async (deviceId: string) => {
    const success = await connect(deviceId);
    if (success) {
      toast({
        title: "Connected",
        description: "MIDI device connected successfully",
      });
    } else {
      toast({
        title: "Connection Failed",
        description: "Failed to connect to MIDI device",
        variant: "destructive",
      });
    }
  };

  const handleDisconnect = async () => {
    const success = await disconnect();
    if (success) {
      toast({
        title: "Disconnected",
        description: "MIDI device disconnected",
      });
    }
  };

  const handleSendCommand = async () => {
    if (!testCommand.trim()) return;
    
    const success = await sendCommand(testCommand);
    if (success) {
      toast({
        title: "MIDI Sent",
        description: `Command sent: ${testCommand}`,
      });
    } else {
      toast({
        title: "Send Failed",
        description: "Failed to send MIDI command",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Music className="h-5 w-5" />
          Simple MIDI
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Basic MIDI device connection and control
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Status */}
        <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
          <div>
            <p className="font-medium">
              {connectedDevice ? (
                <>Connected: {connectedDevice.name}</>
              ) : (
                'No device connected'
              )}
            </p>
            <p className="text-sm text-muted-foreground">
              {availableDevices.length} device{availableDevices.length !== 1 ? 's' : ''} available
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Refresh
          </Button>
        </div>

        {/* Device List */}
        <div>
          <h3 className="font-medium mb-3">Available Devices</h3>
          <ScrollArea className="h-48 border rounded-lg">
            <div className="p-2 space-y-2">
              {!isInitialized ? (
                <div className="text-center py-8 text-muted-foreground">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Initializing MIDI...</span>
                  </div>
                </div>
              ) : availableDevices.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No MIDI devices found</p>
                  <p className="text-xs mt-1">Connect a device and click Refresh</p>
                </div>
              ) : (
                availableDevices.map((device) => (
                  <div
                    key={device.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                    data-testid={`device-${device.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <Music className="w-4 h-4 text-blue-500" />
                      <div>
                        <p className="font-medium text-sm">{device.name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{device.manufacturer}</span>
                          <Badge 
                            variant={device.state === 'connected' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {device.state === 'connected' ? 'Available' : 'Unavailable'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {connectedDevice?.id === device.id ? (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={handleDisconnect}
                          className="bg-red-600 hover:bg-red-700"
                          data-testid="button-disconnect"
                        >
                          <PlugZap className="w-4 h-4 mr-1" />
                          Disconnect
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleConnect(device.id)}
                          disabled={device.state !== 'connected'}
                          data-testid="button-connect"
                        >
                          <Plug className="w-4 h-4 mr-1" />
                          Connect
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Send Commands */}
        {connectedDevice && (
          <div>
            <h3 className="font-medium mb-3 flex items-center gap-2">
              <Send className="w-4 h-4" />
              Send MIDI Command
            </h3>
            <div className="flex gap-2 mb-3">
              <Input
                value={testCommand}
                onChange={(e) => setTestCommand(e.target.value)}
                placeholder="[[PC:1:1]], [[CC:7:64:1]], [[NOTE:60:127:1]]"
                onKeyPress={(e) => e.key === 'Enter' && handleSendCommand()}
                data-testid="input-midi-command"
              />
              <Button 
                onClick={handleSendCommand} 
                disabled={!testCommand.trim()}
                data-testid="button-send-midi"
              >
                <Send className="w-4 h-4 mr-2" />
                Send
              </Button>
            </div>
            
            {/* Quick Commands */}
            <div className="flex flex-wrap gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setTestCommand('[[PC:1:1]]')}
                data-testid="button-quick-pc1"
              >
                Program 1
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setTestCommand('[[CC:7:127:1]]')}
                data-testid="button-quick-volume-max"
              >
                Volume Max
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setTestCommand('[[CC:7:0:1]]')}
                data-testid="button-quick-volume-off"
              >
                Volume Off
              </Button>
            </div>
          </div>
        )}

        {/* Message Log */}
        {messages.length > 0 && (
          <div>
            <h3 className="font-medium mb-3">Recent Messages</h3>
            <ScrollArea className="h-24 border rounded-lg">
              <div className="p-2 space-y-1">
                {messages.map((msg, index) => (
                  <div key={index} className="text-xs font-mono p-1 rounded bg-muted" data-testid={`message-${index}`}>
                    <span className="text-blue-600">→ {msg.command}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
        
      </CardContent>
    </Card>
  );
}