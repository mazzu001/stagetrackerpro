import React from 'react';
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Upload } from "lucide-react";

interface TrackRecoveryProps {
  trackName: string;
  onReupload: (file: File) => void;
}

export function TrackRecovery({ trackName, onReupload }: TrackRecoveryProps) {
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onReupload(file);
    }
  };

  return (
    <Alert variant="destructive" className="mb-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between">
        <span>Audio file missing for "{trackName}". Please re-select the file.</span>
        <div>
          <input
            type="file"
            accept="audio/*"
            onChange={handleFileChange}
            className="hidden"
            id={`recover-${trackName}`}
          />
          <Button
            variant="outline"
            size="sm"
            asChild
            className="ml-2"
          >
            <label htmlFor={`recover-${trackName}`} className="cursor-pointer">
              <Upload className="w-4 h-4 mr-1" />
              Re-select File
            </label>
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}