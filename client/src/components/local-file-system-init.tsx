import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { AlertTriangle, Folder, HardDrive } from "lucide-react";
import { LocalFileSystem } from "../lib/local-file-system";

interface LocalFileSystemInitProps {
  onInitialized: () => void;
}

export function LocalFileSystemInit({ onInitialized }: LocalFileSystemInitProps) {
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);

  useEffect(() => {
    // Check if File System Access API is supported
    if (!('showDirectoryPicker' in window)) {
      setIsSupported(false);
    }
  }, []);

  const handleInitialize = async () => {
    setIsInitializing(true);
    setError(null);

    try {
      const localFS = LocalFileSystem.getInstance();
      const success = await localFS.initialize();
      
      if (success) {
        console.log('Local file system initialized successfully');
        onInitialized();
      } else {
        setError('Failed to initialize local file system');
      }
    } catch (error: any) {
      console.error('Initialization error:', error);
      setError(error.message || 'Unknown error during initialization');
    } finally {
      setIsInitializing(false);
    }
  };

  if (!isSupported) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-red-950 border-red-800">
          <CardHeader>
            <CardTitle className="flex items-center text-red-200">
              <AlertTriangle className="w-5 h-5 mr-2" />
              Browser Not Supported
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-300 mb-4">
              This application requires the File System Access API, which is not supported in your current browser.
            </p>
            <p className="text-red-400 text-sm">
              Please use a modern Chromium-based browser (Chrome, Edge, Opera) for full functionality.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-lg bg-surface border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center text-2xl">
            <HardDrive className="w-6 h-6 mr-2 text-primary" />
            Setup Local Storage
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <p className="text-gray-300">
              This music performance app stores all data locally on your device for maximum performance and offline operation.
            </p>
            
            <div className="bg-blue-950/20 border border-blue-500 rounded-lg p-4">
              <h3 className="text-blue-300 font-medium mb-2">What happens next:</h3>
              <ul className="text-blue-200 text-sm space-y-1">
                <li>• You'll select a folder on your computer for the project</li>
                <li>• Audio files will be stored in organized subfolders</li>
                <li>• A config file will track all your songs and settings</li>
                <li>• Everything stays 100% local - no cloud or internet required</li>
              </ul>
            </div>

            {error && (
              <div className="bg-red-950/20 border border-red-500 rounded-lg p-4">
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}

            <div className="space-y-3">
              <Button
                onClick={handleInitialize}
                disabled={isInitializing}
                className="w-full h-12 text-lg"
                data-testid="button-initialize-local-storage"
              >
                <Folder className="w-5 h-5 mr-2" />
                {isInitializing ? "Setting up..." : "Choose Project Folder"}
              </Button>
              
              <p className="text-xs text-gray-500 text-center">
                This will open a folder picker dialog
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}