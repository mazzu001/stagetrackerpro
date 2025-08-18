import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FolderOpen, Check, X, FileAudio } from "lucide-react";
import { AudioFileStorage } from "@/lib/audio-file-storage";
import { FilePersistence } from "@/lib/file-persistence";
import type { Track } from "@shared/schema";

interface FileReconnectionDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  missingTracks: Track[];
  onComplete: (reconnectedCount: number) => void;
}

interface FileMatch {
  trackId: string;
  trackName: string;
  expectedFileName: string;
  matchedFile?: File;
  status: 'pending' | 'matched' | 'failed';
}

export function FileReconnectionDialog({ 
  isOpen, 
  onOpenChange, 
  missingTracks,
  onComplete 
}: FileReconnectionDialogProps) {
  const [fileMatches, setFileMatches] = useState<FileMatch[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  React.useEffect(() => {
    if (isOpen && missingTracks.length > 0) {
      const filePersistence = FilePersistence.getInstance();
      
      const matches: FileMatch[] = missingTracks.map(track => {
        const fileInfo = filePersistence.getFileInfo(track.id);
        return {
          trackId: track.id,
          trackName: track.name,
          expectedFileName: fileInfo?.fileName || `${track.name}.mp3`,
          status: 'pending' as const
        };
      });
      
      setFileMatches(matches);
    }
  }, [isOpen, missingTracks]);

  const handleSelectFiles = async () => {
    try {
      // Show file picker for multiple audio files
      const files = await showMultiFileDialog();
      if (files.length === 0) return;

      const updatedMatches = [...fileMatches];
      
      // Smart matching algorithm
      for (const file of files) {
        let bestMatch = null;
        let bestScore = 0;
        
        for (const match of updatedMatches) {
          if (match.status !== 'pending') continue;
          
          let score = 0;
          
          // Exact filename match
          if (file.name === match.expectedFileName) {
            score = 100;
          }
          // Track name contains file name (without extension)
          else if (match.trackName.toLowerCase().includes(file.name.replace(/\.[^/.]+$/, "").toLowerCase())) {
            score = 80;
          }
          // File name contains track name
          else if (file.name.toLowerCase().includes(match.trackName.toLowerCase())) {
            score = 70;
          }
          // Partial match with common patterns
          else {
            const trackWords = match.trackName.toLowerCase().split(/[\s-_]+/);
            const fileWords = file.name.toLowerCase().replace(/\.[^/.]+$/, "").split(/[\s-_]+/);
            const commonWords = trackWords.filter(word => fileWords.includes(word));
            if (commonWords.length > 0) {
              score = Math.min(60, commonWords.length * 20);
            }
          }
          
          if (score > bestScore) {
            bestScore = score;
            bestMatch = match;
          }
        }
        
        if (bestMatch && bestScore > 0) {
          bestMatch.matchedFile = file;
          bestMatch.status = 'matched';
        }
      }
      
      setFileMatches(updatedMatches);
      
    } catch (error) {
      console.error('Error selecting files:', error);
    }
  };

  const handleReconnectFiles = async () => {
    setIsProcessing(true);
    const audioStorage = AudioFileStorage.getInstance();
    let reconnectedCount = 0;
    
    try {
      for (const match of fileMatches) {
        if (match.status === 'matched' && match.matchedFile) {
          try {
            const track = missingTracks.find(t => t.id === match.trackId);
            if (track) {
              await audioStorage.storeAudioFile(track.id, match.matchedFile, track);
              match.status = 'matched';
              reconnectedCount++;
            }
          } catch (error) {
            console.error(`Failed to reconnect ${match.trackName}:`, error);
            match.status = 'failed';
          }
        }
      }
      
      setFileMatches([...fileMatches]);
      
      // Close dialog and notify parent
      setTimeout(() => {
        onComplete(reconnectedCount);
        onOpenChange(false);
      }, 1000);
      
    } catch (error) {
      console.error('Error reconnecting files:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const showMultiFileDialog = (): Promise<File[]> => {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'audio/*,.mp3,.wav,.ogg,.m4a';
      input.multiple = true;

      input.onchange = (event) => {
        const files = Array.from((event.target as HTMLInputElement).files || []);
        resolve(files);
      };

      input.oncancel = () => resolve([]);
      input.click();
    });
  };

  const matchedCount = fileMatches.filter(m => m.status === 'matched').length;
  const totalCount = fileMatches.length;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface border-gray-700 max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <FileAudio className="w-5 h-5 text-primary" />
            <span>Reconnect Audio Files</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
            <h3 className="text-blue-200 font-medium mb-2">Missing Audio Files</h3>
            <p className="text-sm text-blue-300">
              {totalCount} audio files need to be reconnected. Select your audio files and I'll automatically match them to the right tracks.
            </p>
          </div>

          <div className="flex flex-col space-y-3">
            <Button
              onClick={handleSelectFiles}
              variant="outline"
              className="w-full justify-start"
              disabled={isProcessing}
            >
              <FolderOpen className="w-4 h-4 mr-2" />
              Select Audio Files ({matchedCount}/{totalCount} matched)
            </Button>
            
            {fileMatches.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-300">File Matching:</h4>
                <div className="bg-gray-800 rounded-lg p-3 max-h-64 overflow-y-auto">
                  {fileMatches.map((match) => (
                    <div key={match.trackId} className="flex items-center justify-between py-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white truncate">
                          {match.trackName}
                        </div>
                        <div className="text-xs text-gray-400 truncate">
                          {match.matchedFile?.name || `Expected: ${match.expectedFileName}`}
                        </div>
                      </div>
                      <div className="ml-3">
                        {match.status === 'matched' && (
                          <Check className="w-4 h-4 text-green-500" />
                        )}
                        {match.status === 'failed' && (
                          <X className="w-4 h-4 text-red-500" />
                        )}
                        {match.status === 'pending' && (
                          <div className="w-4 h-4 border-2 border-gray-500 rounded-full" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleReconnectFiles}
              disabled={matchedCount === 0 || isProcessing}
            >
              {isProcessing ? 'Reconnecting...' : `Reconnect ${matchedCount} Files`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}