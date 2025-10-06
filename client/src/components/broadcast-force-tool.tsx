import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RadioTower } from "lucide-react";
import { forceBroadcastHost, getBroadcastHostForced, clearBroadcastHostForced } from "@/lib/broadcast-helper";

/**
 * Component for controlling forced broadcast mode
 */
export function BroadcastForceTool() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [roomName, setRoomName] = useState("test-broadcast");
  
  // Check for existing forced broadcast on mount
  useEffect(() => {
    const existingRoom = getBroadcastHostForced();
    if (existingRoom) {
      setIsEnabled(true);
      setRoomName(existingRoom);
    }
  }, []);
  
  const handleToggle = (checked: boolean) => {
    if (checked) {
      // Enable forced broadcast mode
      forceBroadcastHost(roomName);
      setIsEnabled(true);
    } else {
      // Disable forced broadcast mode
      clearBroadcastHostForced();
      setIsEnabled(false);
    }
  };
  
  const handleRoomNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRoomName(e.target.value);
    if (isEnabled) {
      // Update existing forced broadcast
      forceBroadcastHost(e.target.value);
    }
  };
  
  return (
    <div className="border border-amber-500 bg-amber-500/10 p-3 rounded-md">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <RadioTower className="h-4 w-4 text-amber-500" />
          <Label htmlFor="broadcast-force" className="font-medium">Force Broadcast Mode</Label>
          {isEnabled && <Badge variant="destructive" className="bg-amber-500">TESTING ONLY</Badge>}
        </div>
        <Switch 
          id="broadcast-force" 
          checked={isEnabled}
          onCheckedChange={handleToggle}
        />
      </div>
      
      <div className="mt-2">
        <Label htmlFor="room-name" className="text-xs">Room Name</Label>
        <div className="flex gap-2 mt-1">
          <Input 
            id="room-name" 
            value={roomName}
            onChange={handleRoomNameChange}
            className="h-8 text-sm"
            placeholder="Enter broadcast room name"
            disabled={!isEnabled}
          />
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => window.location.reload()}
            className="shrink-0"
            disabled={!isEnabled}
          >
            Apply & Reload
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Changing this setting requires a page reload to take full effect.
        </p>
      </div>
    </div>
  );
}