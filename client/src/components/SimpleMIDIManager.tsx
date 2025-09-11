// Ultra-Simple MIDI Manager Component - No React Hook Issues
import { useState } from 'react';
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, RefreshCw, Plug, Unplug, AlertCircle, Settings, Zap } from 'lucide-react';
import { useSimpleMIDI } from '@/hooks/useSimpleMIDI';

interface SimpleMIDIManagerProps {
  onSendCommandReady?: (sendCommand: (command: string) => Promise<boolean>) => void;
}

export function SimpleMIDIManager({ onSendCommandReady }: SimpleMIDIManagerProps = {}) {
  const { toast } = useToast();
  const midi = useSimpleMIDI();
  const [showSettings, setShowSettings] = useState(false);

  // Expose sendCommand function to parent component
  React.useEffect(() => {
    if (onSendCommandReady) {
      onSendCommandReady(midi.sendCommand);
    }
  }, [midi.sendCommand, onSendCommandReady]);

  const handleRefresh = async () => {
    if (midi.safeMode) return;
    
    await midi.refreshDevices();
    
    if (midi.errorMessage) {
      toast({
        title: "MIDI Status",
        description: midi.errorMessage,
        variant: "destructive",
      });
    } else if (midi.devices.length > 0) {
      toast({
        title: "MIDI Devices Found",
        description: `Found ${midi.devices.length} MIDI device(s)`,
      });
    }
  };

  const handleConnect = (deviceId: string) => {
    midi.connectDevice(deviceId);
    const device = midi.devices.find(d => d.id === deviceId) || 
                  midi.cachedDevices.find(d => d.id === deviceId);
    toast({
      title: "Device Connected",
      description: `Connected to ${device?.name || 'Unknown Device'}`,
    });
  };

  const handleDisconnect = (deviceId: string) => {
    midi.disconnectDevice(deviceId);
    const device = midi.devices.find(d => d.id === deviceId) ||
                  midi.cachedDevices.find(d => d.id === deviceId);
    toast({
      title: "Device Disconnected", 
      description: `Disconnected from ${device?.name || 'Unknown Device'}`,
    });
  };

  // Use live devices if available, otherwise show cached devices
  const displayDevices = midi.devices.length > 0 ? midi.devices : midi.cachedDevices;
  const hasDevices = displayDevices.length > 0;

  return (
    <div className="space-y-4 w-full max-w-4xl">
      {/* Safe Mode Banner */}
      {midi.safeMode && (
        <Alert className="border-orange-500 bg-orange-50 dark:bg-orange-950">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-orange-700 dark:text-orange-300">
            <strong>Safe Mode:</strong> MIDI is disabled for reliable live performance.
            <Button 
              variant="link" 
              size="sm" 
              className="ml-2 h-auto p-0 text-orange-700 dark:text-orange-300"
              onClick={() => setShowSettings(true)}
            >
              Settings
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              MIDI Devices
              {!midi.safeMode && hasDevices && (
                <Badge variant="secondary">{displayDevices.length}</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSettings(true)}
              >
                <Settings className="h-4 w-4" />
              </Button>
              {!midi.safeMode && (
                <Button 
                  onClick={handleRefresh}
                  disabled={midi.isLoading}
                  size="sm"
                  data-testid="button-refresh-midi"
                >
                  {midi.isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-2" />
                  )}
                  Refresh
                </Button>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        
        <CardContent>
          {midi.safeMode ? (
            <div className="text-center py-8 text-muted-foreground">
              MIDI disabled for safe live performance mode
            </div>
          ) : midi.errorMessage ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{midi.errorMessage}</AlertDescription>
            </Alert>
          ) : midi.isLoading ? (
            <div className="text-center py-4 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
              Scanning MIDI devices...
            </div>
          ) : !hasDevices ? (
            <div className="text-center py-8 text-muted-foreground">
              No MIDI devices found. Connect a device and refresh.
            </div>
          ) : (
            <div className="space-y-2">
              {displayDevices.map((device) => {
                const isConnected = midi.connectedDevices.includes(device.id);
                const isCached = midi.devices.length === 0 && midi.cachedDevices.some(d => d.id === device.id);
                return (
                  <div 
                    key={device.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                    data-testid={`device-${device.id}`}
                  >
                    <div>
                      <div className="font-medium">{device.name}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2">
                        {isConnected ? 'Connected' : 'Disconnected'}
                        {isCached && (
                          <Badge variant="outline" className="text-xs">cached</Badge>
                        )}
                      </div>
                    </div>
                    
                    <Button
                      onClick={() => isConnected ? handleDisconnect(device.id) : handleConnect(device.id)}
                      variant={isConnected ? "destructive" : "default"}
                      size="sm"
                      data-testid={`button-${isConnected ? 'disconnect' : 'connect'}-${device.id}`}
                    >
                      {isConnected ? (
                        <>
                          <Unplug className="w-4 h-4 mr-2" />
                          Disconnect
                        </>
                      ) : (
                        <>
                          <Plug className="w-4 h-4 mr-2" />
                          Connect
                        </>
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
          
          {midi.connectedDevices.length > 0 && (
            <div className="mt-6 p-3 bg-green-50 dark:bg-green-900/20 rounded">
              <div className="text-green-800 dark:text-green-200 font-medium">
                {midi.connectedDevices.length} device(s) connected
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Settings Modal - Using Checkbox instead of Switch */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>MIDI Settings</DialogTitle>
            <DialogDescription>
              Configure MIDI behavior for live performance.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="safe-mode"
                checked={midi.safeMode}
                onCheckedChange={(checked) => midi.setSafeMode(!!checked)}
              />
              <div className="grid gap-1.5 leading-none">
                <Label htmlFor="safe-mode" className="text-sm font-medium">
                  Enable Safe Mode
                </Label>
                <p className="text-xs text-muted-foreground">
                  Disable MIDI to prevent any delays during live performance
                </p>
              </div>
            </div>
            
            {!midi.safeMode && (
              <div className="text-sm text-muted-foreground">
                <p><strong>Tips for live performance:</strong></p>
                <ul className="mt-2 space-y-1 list-disc list-inside">
                  <li>Test MIDI connections before your show</li>
                  <li>Enable Safe Mode if you experience any delays</li>
                  <li>Cached devices will appear instantly on app restart</li>
                </ul>
              </div>
            )}

            {midi.cachedDevices.length > 0 && (
              <div className="text-sm text-muted-foreground">
                <p><strong>Cached devices:</strong></p>
                <ul className="mt-1 space-y-1">
                  {midi.cachedDevices.map(device => (
                    <li key={device.id}>• {device.name}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div className="flex justify-end">
            <Button onClick={() => setShowSettings(false)}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}