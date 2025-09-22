import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Activity, CheckCircle } from "lucide-react";
import { useMidi } from "@/contexts/SimpleMidiContext";

interface SimpleMidiDevicesProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SimpleMidiDevices({ isOpen, onClose }: SimpleMidiDevicesProps) {
  const { devices, isInitialized, error, initMidi } = useMidi();
  
  const inputs = devices.filter(d => d.type === 'input');
  const outputs = devices.filter(d => d.type === 'output');
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md" data-testid="dialog-midi-devices">
        <DialogHeader>
          <DialogTitle>MIDI Devices</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Initialize button if not initialized */}
          {!isInitialized && (
            <div className="text-center py-4">
              <Button onClick={initMidi} data-testid="button-init-midi">
                <Activity className="mr-2 h-4 w-4" />
                Connect MIDI Devices
              </Button>
              {error && (
                <p className="text-sm text-red-500 mt-2">{error}</p>
              )}
            </div>
          )}
          
          {/* Show devices if initialized */}
          {isInitialized && (
            <>
              {/* Input devices */}
              <div>
                <h3 className="font-semibold mb-2">Input Devices</h3>
                {inputs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No input devices connected</p>
                ) : (
                  <div className="space-y-2">
                    {inputs.map(device => (
                      <div key={device.id} className="flex items-center gap-2 p-2 bg-secondary/50 rounded">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-sm">{device.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Output devices */}
              <div>
                <h3 className="font-semibold mb-2">Output Devices</h3>
                {outputs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No output devices connected</p>
                ) : (
                  <div className="space-y-2">
                    {outputs.map(device => (
                      <div key={device.id} className="flex items-center gap-2 p-2 bg-secondary/50 rounded">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-sm">{device.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}