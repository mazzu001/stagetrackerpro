import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { AudioFileStorage } from "@/lib/audio-file-storage";
import { FolderOpen, Music, CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";

interface FileReconnectionDialogProps {
  onReconnection?: () => void;
}

export function FileReconnectionDialog({ onReconnection }: FileReconnectionDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [connectedFiles, setConnectedFiles] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const audioStorage = AudioFileStorage.getInstance();
  const expectedFiles = audioStorage.getAllStoredFiles();
  const availableFiles = expectedFiles.filter(file => audioStorage.hasAudioFile(file.id));
  const missingFiles = expectedFiles.filter(file => !audioStorage.hasAudioFile(file.id));

  const handleSelectFiles = async () => {
    setIsLoading(true);
    
    try {
      // Create file input for multiple file selection
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'audio/*,.mp3,.wav,.ogg,.m4a';
      input.multiple = true;
      
      const fileSelectPromise = new Promise<File[]>((resolve) => {
        input.onchange = (event) => {
          const files = Array.from((event.target as HTMLInputElement).files || []);
          resolve(files);
        };
        
        // Handle cancel
        input.oncancel = () => resolve([]);
        
        // Auto-resolve if input is not clicked within 30 seconds
        setTimeout(() => resolve([]), 30000);
      });
      
      input.click();
      const selectedFiles = await fileSelectPromise;
      
      if (selectedFiles.length === 0) {
        setIsLoading(false);
        return;
      }

      // Try to match files with missing tracks
      let reconnectedCount = 0;
      const newConnected = new Set(connectedFiles);

      for (const file of selectedFiles) {
        const fileName = file.name;
        const baseFileName = fileName.replace(/\.[^/.]+$/, ""); // Remove extension
        
        // Find matching tracks by name
        for (const missingFile of missingFiles) {
          if (newConnected.has(missingFile.id)) continue; // Already connected
          
          const trackBaseName = missingFile.name.replace(/\.[^/.]+$/, "");
          
          // Match by exact name or base name
          if (fileName === missingFile.name || 
              baseFileName === trackBaseName ||
              fileName.includes(trackBaseName) ||
              trackBaseName.includes(baseFileName)) {
            
            // Store the file in audio storage
            await audioStorage.storeAudioFile(missingFile.id, file);
            newConnected.add(missingFile.id);
            reconnectedCount++;
            
            console.log(`Reconnected: ${fileName} -> ${missingFile.name} (${missingFile.id})`);
            break;
          }
        }
      }

      setConnectedFiles(newConnected);

      if (reconnectedCount > 0) {
        toast({
          title: "Files reconnected",
          description: `Successfully reconnected ${reconnectedCount} audio file${reconnectedCount > 1 ? 's' : ''}`,
        });
        
        // Notify parent component
        onReconnection?.();
      } else {
        toast({
          title: "No matches found",
          description: "Could not match selected files to missing tracks. Make sure file names are similar to track names.",
          variant: "destructive"
        });
      }
      
    } catch (error) {
      console.error('File reconnection failed:', error);
      toast({
        title: "Reconnection failed",
        description: error instanceof Error ? error.message : "Failed to reconnect files",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const allConnected = missingFiles.length === 0;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant={allConnected ? "outline" : "default"} size="sm">
          {allConnected ? (
            <>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              All Files Ready
            </>
          ) : (
            <>
              <AlertTriangle className="w-4 h-4 mr-2" />
              Reconnect Files ({missingFiles.length} missing)
            </>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reconnect Audio Files</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="text-sm text-muted-foreground">
            Your tracks are stored in the database, but the audio files need to be reconnected for playback. 
            Select your audio files to reconnect them with your tracks.
          </div>

          {/* Available Files */}
          {availableFiles.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center text-green-600">
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Connected Files ({availableFiles.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {availableFiles.map((file) => (
                  <div key={file.id} className="flex items-center gap-2 text-sm">
                    <Music className="w-4 h-4 text-green-600" />
                    <span>{file.name}</span>
                    <span className="text-muted-foreground">({Math.round(file.size / 1024)}KB)</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Missing Files */}
          {missingFiles.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center text-orange-600">
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Missing Files ({missingFiles.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {missingFiles.map((file) => (
                  <div key={file.id} className="flex items-center gap-2 text-sm">
                    <Music className="w-4 h-4 text-orange-600" />
                    <span>{file.name}</span>
                    <span className="text-muted-foreground">({Math.round(file.size / 1024)}KB)</span>
                    {connectedFiles.has(file.id) && (
                      <CheckCircle2 className="w-4 h-4 text-green-600 ml-auto" />
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Action Button */}
          {missingFiles.length > 0 && (
            <div className="flex justify-center">
              <Button 
                onClick={handleSelectFiles} 
                disabled={isLoading}
                className="w-full max-w-sm"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Reconnecting Files...
                  </>
                ) : (
                  <>
                    <FolderOpen className="w-4 h-4 mr-2" />
                    Select Audio Files to Reconnect
                  </>
                )}
              </Button>
            </div>
          )}

          {/* All Connected Message */}
          {allConnected && (
            <Card className="bg-green-50 dark:bg-green-950">
              <CardContent className="pt-6">
                <div className="flex items-center justify-center gap-2 text-green-700 dark:text-green-300">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-medium">All audio files are connected and ready!</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}