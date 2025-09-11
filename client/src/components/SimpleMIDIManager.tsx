// MIDI Manager with freeze warning and real connection status
import { useState } from 'react';
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, RefreshCw, Plug, Unplug, AlertCircle, Settings, Zap, AlertTriangle } from 'lucide-react';
import { useSimpleMIDI } from '@/hooks/useSimpleMIDI';

interface SimpleMIDIManagerProps {
  onSendCommandReady?: (sendCommand: (command: string) => Promise<boolean>) => void;
}

export function SimpleMIDIManager({ onSendCommandReady }: SimpleMIDIManagerProps = {}) {
  const { toast } = useToast();
  const midi = useSimpleMIDI();
  const [showSettings, setShowSettings] = useState(false);
  const [showFreezeWarning, setShowFreezeWarning] = useState(false);

  // Expose sendCommand function to parent component
  React.useEffect(() => {
    if (onSendCommandReady) {
      onSendCommandReady(midi.sendCommand);
    }
  }, [midi.sendCommand, onSendCommandReady]);

  // Handle refresh with freeze warning
  const handleRefresh = async () => {
    if (midi.safeMode) {
      toast({
        title: "Refresh Disabled",
        description: "Turn off Safe Mode to scan for new MIDI devices",
        variant: "destructive",
      });
      return;
    }
    
    // Show freeze warning modal
    setShowFreezeWarning(true);
  };

  // Proceed with dangerous refresh after user confirms
  const proceedWithRefresh = async () => {
    setShowFreezeWarning(false);
    
    await midi.refreshDevices();
    
    if (midi.errorMessage && !midi.errorMessage.includes('Scanning')) {
      toast({
        title: "MIDI Status",
        description: midi.errorMessage,
        variant: "destructive",
      });
    } else if (midi.devices.length > 0 && !midi.isLoading) {
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
    
    const isReallyConnected = midi.isReallyConnected(deviceId);
    const connectionType = isReallyConnected ? "Real MIDI connection" : "Simulated connection";
    
    toast({
      title: "Device Connected",
      description: `${connectionType} to ${device?.name || 'Unknown Device'}`,
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
        <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
          <Zap className="h-4 w-4" />
          <AlertTitle>Safe Mode Active</AlertTitle>
          <AlertDescription className="text-green-700 dark:text-green-300">
            MIDI is optimized for live performance - cached devices connect instantly, no freezing.
            <Button 
              variant="link" 
              size="sm" 
              className="ml-2 h-auto p-0 text-green-700 dark:text-green-300"
              onClick={() => setShowSettings(true)}
            >
              Settings
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Non-Safe Mode Warning */}
      {!midi.safeMode && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Performance Risk</AlertTitle>
          <AlertDescription>
            Safe Mode is OFF - MIDI refresh may freeze the app for 15+ seconds. Enable Safe Mode for live shows.
            <Button 
              variant="link" 
              size="sm" 
              className="ml-2 h-auto p-0 text-red-700 dark:text-red-300"
              onClick={() => setShowSettings(true)}
            >
              Enable Safe Mode
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
              {hasDevices && (
                <Badge variant="secondary">{displayDevices.length}</Badge>
              )}
              {midi.safeMode && (
                <Badge variant="outline" className="text-green-600">Safe Mode</Badge>
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
              <Button 
                onClick={handleRefresh}
                disabled={midi.isLoading}
                size="sm"
                variant={midi.safeMode ? "outline" : "default"}
                data-testid="button-refresh-midi"
              >
                {midi.isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                {midi.safeMode ? "Scan New Devices" : "Refresh"}
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        
        <CardContent>
          {midi.errorMessage && !midi.isLoading && (
            <Alert variant={midi.errorMessage.includes('Safe Mode') ? "default" : "destructive"} className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{midi.errorMessage}</AlertDescription>
            </Alert>
          )}

          {midi.isLoading ? (
            <div className="text-center py-4 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
              {midi.errorMessage || "Scanning MIDI devices..."}
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
                const isReallyConnected = midi.isReallyConnected(device.id);
                
                return (
                  <div 
                    key={device.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                    data-testid={`device-${device.id}`}
                  >
                    <div className="flex-1">
                      <div className="font-medium">{device.name}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2">
                        {isConnected ? (
                          <span className="flex items-center gap-1">
                            Connected
                            {isReallyConnected ? (
                              <Badge variant="default" className="text-xs bg-green-500">Real</Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs">Simulated</Badge>
                            )}
                          </span>
                        ) : (
                          <span>Disconnected</span>
                        )}
                        {isCached && (
                          <Badge variant="outline" className="text-xs">Cached</Badge>
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

      {/* Freeze Warning Modal */}
      <Dialog open={showFreezeWarning} onOpenChange={setShowFreezeWarning}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-600">
              <AlertTriangle className="h-5 w-5" />
              App May Freeze Warning
            </DialogTitle>
            <DialogDescription>
              <div className="space-y-3">
                <p className="text-sm">
                  <strong>Warning:</strong> Scanning for new MIDI devices may freeze your app for <strong>15+ seconds</strong>.
                </p>
                <div className="bg-orange-50 dark:bg-orange-950/20 p-3 rounded-lg">
                  <p className="text-sm text-orange-700 dark:text-orange-300">
                    <strong>For live performance:</strong> Enable Safe Mode instead. It shows cached devices instantly without any freezing.
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  Only proceed if you need to discover new MIDI devices and can tolerate app freezing.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
            <Button variant="outline" onClick={() => setShowFreezeWarning(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={proceedWithRefresh}>
              I Understand - Proceed
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Settings Modal */}
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
                  Enable Safe Mode (Recommended)
                </Label>
                <p className="text-xs text-muted-foreground">
                  Prevents app freezing during live shows by using cached devices
                </p>
              </div>
            </div>
            
            <div className="text-sm text-muted-foreground">
              <div className="space-y-2">
                <p><strong>Safe Mode:</strong></p>
                <ul className="space-y-1 list-disc list-inside ml-2">
                  <li>Cached devices appear instantly</li>
                  <li>Real MIDI connections when possible</li>
                  <li>Zero risk of app freezing</li>
                  <li>Perfect for live performance</li>
                </ul>
                
                <p><strong>Discovery Mode:</strong></p>
                <ul className="space-y-1 list-disc list-inside ml-2">
                  <li>Finds new MIDI devices</li>
                  <li>May freeze app 15+ seconds</li>
                  <li>Only use for setup</li>
                </ul>
              </div>
            </div>

            {midi.cachedDevices.length > 0 && (
              <div className="text-sm text-muted-foreground">
                <p><strong>Cached devices:</strong></p>
                <ul className="mt-1 space-y-1">
                  {midi.cachedDevices.map(device => (
                    <li key={device.id} className="flex items-center gap-2">
                      • {device.name}
                      {midi.isReallyConnected(device.id) && (
                        <Badge variant="default" className="text-xs bg-green-500">Ready</Badge>
                      )}
                    </li>
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