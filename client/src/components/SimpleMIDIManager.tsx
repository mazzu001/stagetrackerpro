// Ultra-Simple MIDI Manager Component
import { useState } from 'react';
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, RefreshCw, Plug, Unplug } from 'lucide-react';
import { useSimpleMIDI } from '@/hooks/useSimpleMIDI';

interface SimpleMIDIManagerProps {
  onSendCommandReady?: (sendCommand: (command: string) => Promise<boolean>) => void;
}

export function SimpleMIDIManager({ onSendCommandReady }: SimpleMIDIManagerProps = {}) {
  const { toast } = useToast();
  const midi = useSimpleMIDI();

  // Expose sendCommand function to parent component
  React.useEffect(() => {
    if (onSendCommandReady) {
      onSendCommandReady(midi.sendCommand);
    }
  }, [midi.sendCommand, onSendCommandReady]);

  const handleRefresh = async () => {
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
    const device = midi.devices.find(d => d.id === deviceId);
    toast({
      title: "Device Connected",
      description: `Connected to ${device?.name || 'Unknown Device'}`,
    });
  };

  const handleDisconnect = (deviceId: string) => {
    midi.disconnectDevice(deviceId);
    const device = midi.devices.find(d => d.id === deviceId);
    toast({
      title: "Device Disconnected", 
      description: `Disconnected from ${device?.name || 'Unknown Device'}`,
    });
  };

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>MIDI Devices</span>
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
        </CardTitle>
      </CardHeader>
      
      <CardContent>
        {midi.errorMessage && (
          <div className="text-red-500 mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded">
            {midi.errorMessage}
          </div>
        )}
        
        {midi.devices.length === 0 && !midi.isLoading && !midi.errorMessage && (
          <div className="text-gray-500 text-center py-8">
            Click Refresh to scan for MIDI devices
          </div>
        )}
        
        {midi.devices.length > 0 && (
          <div className="space-y-2">
            {midi.devices.map((device) => {
              const isConnected = midi.connectedDevices.includes(device.id);
              return (
                <div 
                  key={device.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                  data-testid={`device-${device.id}`}
                >
                  <div>
                    <div className="font-medium">{device.name}</div>
                    <div className="text-sm text-gray-500">
                      {isConnected ? 'Connected' : 'Disconnected'}
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
  );
}