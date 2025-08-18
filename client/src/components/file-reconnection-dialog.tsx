import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AudioFileStorage } from "@/lib/audio-file-storage";
import { Upload, CheckCircle, AlertCircle, FileAudio, FolderOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface FileReconnectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFilesReconnected: () => void;
}

export function FileReconnectionDialog({ open, onOpenChange, onFilesReconnected }: FileReconnectionDialogProps) {
  const [missingFiles, setMissingFiles] = useState<Array<{ id: string; name: string; filePath: string }>>([]);
  const [reconnectedFiles, setReconnectedFiles] = useState<Set<string>>(new Set());
  const [isScanning, setIsScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Initialize missing files when dialog opens
  useState(() => {
    if (open) {
      const audioStorage = AudioFileStorage.getInstance();
      const allFiles = audioStorage.getAllStoredFiles();
      const missing = allFiles.filter(file => !audioStorage.getAudioUrl(file.id));
      setMissingFiles(missing.map(f => ({ id: f.id, name: f.name, filePath: f.filePath })));
      setReconnectedFiles(new Set());
    }
  });

  const handleFileSelect = async (files: FileList | null) => {
    if (!files) return;

    setIsScanning(true);
    const audioStorage = AudioFileStorage.getInstance();
    let reconnectedCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Check if this file matches any missing files by name
      const matchingFile = missingFiles.find(mf => 
        mf.name.toLowerCase() === file.name.toLowerCase() ||
        mf.filePath.toLowerCase().includes(file.name.toLowerCase())
      );

      if (matchingFile) {
        try {
          await audioStorage.storeAudioFile(matchingFile.id, file);
          setReconnectedFiles(prev => new Set([...Array.from(prev), matchingFile.id]));
          reconnectedCount++;
          
          console.log(`Reconnected: ${file.name} to track ${matchingFile.id}`);
        } catch (error) {
          console.error(`Failed to reconnect ${file.name}:`, error);
        }
      }
    }

    setIsScanning(false);

    if (reconnectedCount > 0) {
      toast({
        title: "Files Reconnected",
        description: `Successfully reconnected ${reconnectedCount} audio file${reconnectedCount > 1 ? 's' : ''}`,
      });

      // If all files are reconnected, close dialog and refresh
      if (reconnectedFiles.size === missingFiles.length) {
        setTimeout(() => {
          onFilesReconnected();
          onOpenChange(false);
        }, 1000);
      }
    } else {
      toast({
        title: "No Matches Found",
        description: "None of the selected files matched your missing audio tracks",
        variant: "destructive",
      });
    }
  };

  const handleSelectFiles = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleSelectFolder = () => {
    if (folderInputRef.current) {
      folderInputRef.current.click();
    }
  };

  const progress = missingFiles.length > 0 ? (reconnectedFiles.size / missingFiles.length) * 100 : 0;
  const allReconnected = missingFiles.length > 0 && reconnectedFiles.size === missingFiles.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileAudio className="w-5 h-5" />
            Reconnect Audio Files
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {missingFiles.length === 0 ? (
            <Card>
              <CardContent className="flex items-center justify-center py-8">
                <div className="text-center">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">All Files Connected</h3>
                  <p className="text-gray-600">All your audio tracks are ready to play</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Missing Audio Files</h3>
                  <span className="text-sm text-gray-500">
                    {reconnectedFiles.size} of {missingFiles.length} reconnected
                  </span>
                </div>
                
                <Progress value={progress} className="w-full" />

                <div className="grid gap-2 max-h-48 overflow-y-auto">
                  {missingFiles.map((file) => (
                    <Card key={file.id} className={`transition-colors ${reconnectedFiles.has(file.id) ? 'bg-green-50 border-green-200' : 'bg-gray-50'}`}>
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {reconnectedFiles.has(file.id) ? (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-orange-500" />
                            )}
                            <div>
                              <p className="font-medium text-sm">{file.name}</p>
                              <p className="text-xs text-gray-500">{file.filePath}</p>
                            </div>
                          </div>
                          {reconnectedFiles.has(file.id) && (
                            <span className="text-xs text-green-600 font-medium">Connected</span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-medium">Select your audio files to reconnect them:</h4>
                
                <div className="grid grid-cols-2 gap-3">
                  <Button 
                    onClick={handleSelectFiles}
                    disabled={isScanning}
                    className="flex items-center gap-2"
                    data-testid="button-select-files"
                  >
                    <Upload className="w-4 h-4" />
                    {isScanning ? "Scanning..." : "Select Files"}
                  </Button>
                  
                  <Button 
                    onClick={handleSelectFolder}
                    disabled={isScanning}
                    variant="outline"
                    className="flex items-center gap-2"
                    data-testid="button-select-folder"
                  >
                    <FolderOpen className="w-4 h-4" />
                    Select Folder
                  </Button>
                </div>
                
                <p className="text-xs text-gray-500">
                  Tip: Select the folder containing your audio files to automatically match them by name
                </p>
              </div>

              {allReconnected && (
                <Card className="bg-green-50 border-green-200">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <div>
                        <p className="font-medium text-green-800">All Files Reconnected!</p>
                        <p className="text-sm text-green-600">Your tracks are ready to play</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-close">
              {allReconnected ? "Done" : "Skip for Now"}
            </Button>
            {allReconnected && (
              <Button onClick={() => { onFilesReconnected(); onOpenChange(false); }} data-testid="button-continue">
                Continue to Performance
              </Button>
            )}
          </div>
        </div>

        {/* Hidden file inputs */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="audio/*,.mp3,.wav,.ogg,.m4a"
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files)}
        />
        <input
          ref={folderInputRef}
          type="file"
          multiple
          {...({ webkitdirectory: "" } as any)}
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files)}
        />
      </DialogContent>
    </Dialog>
  );
}