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
    const checkSupport = () => {
      const hasAPI = 'showDirectoryPicker' in window;
      const isSecureContext = window.isSecureContext;
      const userAgent = navigator.userAgent.toLowerCase();
      
      console.log('Browser support check:', {
        hasAPI,
        isSecureContext,
        userAgent: userAgent.substring(0, 100)
      });
      
      if (!hasAPI) {
        console.warn('File System Access API not available');
        setIsSupported(false);
        return;
      }
      
      if (!isSecureContext) {
        console.warn('Secure context required for File System Access API');
        setIsSupported(false);
        return;
      }
      
      setIsSupported(true);
    };
    
    checkSupport();
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
        setError('Directory selection was cancelled. Please try again to set up your music project folder.');
      }
    } catch (error: any) {
      console.error('Initialization error:', error);
      
      let errorMessage = 'Unknown error during initialization';
      
      if (error.message.includes('not supported')) {
        errorMessage = 'Your browser doesn\'t support the File System Access API. Please use Chrome, Edge, or another Chromium-based browser.';
      } else if (error.message.includes('secure context')) {
        errorMessage = 'This feature requires HTTPS. Please make sure you\'re accessing the app over a secure connection.';
      } else if (error.message.includes('AbortError') || error.message.includes('cancelled')) {
        errorMessage = 'Directory selection was cancelled. Click the button again to choose your project folder.';
      } else if (error.message.includes('picker')) {
        errorMessage = 'Could not open the folder selection dialog. Please ensure you\'re using a supported browser and try again.';
      } else if (error.message.includes('Permission denied') || error.message.includes('NotAllowedError')) {
        errorMessage = 'Permission denied. Please grant permission to access folders when prompted by your browser. You may need to check browser settings or enable file system access flags.';
      } else if (error.message.includes('SecurityError')) {
        errorMessage = 'Security error: Your browser is blocking file system access. Please ensure you\'re on HTTPS and check browser security settings.';
      } else {
        errorMessage = error.message || 'Failed to set up local file storage.';
      }
      
      setError(errorMessage);
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
              This application requires the File System Access API for local file storage, which is not available in your current browser.
            </p>
            <div className="space-y-2 text-sm">
              <p className="text-red-400">
                <strong>Required:</strong> Chrome 86+, Edge 86+, or another Chromium-based browser
              </p>
              <p className="text-red-400">
                <strong>Not supported:</strong> Firefox, Safari, Internet Explorer
              </p>
              <p className="text-red-300 mt-3">
                Please switch to a supported browser and make sure you're on HTTPS to use this application.
              </p>
            </div>
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
                <li>• You'll see a folder picker dialog</li>
                <li>• Choose or create a folder for your music project</li>
                <li>• Audio files will be organized in subfolders by song</li>
                <li>• A config file will track all your songs and settings</li>
                <li>• Everything stays 100% local - no cloud or internet required</li>
              </ul>
            </div>

            <div className="bg-yellow-950/20 border border-yellow-500 rounded-lg p-4">
              <h3 className="text-yellow-300 font-medium mb-2">Browser Requirements:</h3>
              <p className="text-yellow-200 text-sm mb-2">
                This feature requires Chrome, Edge, or another Chromium-based browser. 
                Safari and Firefox don't support local file system access yet.
              </p>
              <p className="text-yellow-200 text-sm">
                <strong>Edge users:</strong> If the folder picker doesn't open, try enabling "Experimental Web Platform features" in edge://flags/
              </p>
            </div>

            {error && (
              <div className="bg-red-950/20 border border-red-500 rounded-lg p-4">
                <h3 className="text-red-300 font-medium mb-2">Setup Error:</h3>
                <p className="text-red-200 text-sm">{error}</p>
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
              
              <div className="text-xs text-gray-500 text-center space-y-1">
                <p>Your browser will ask permission to access a folder on your computer</p>
                <p className="text-yellow-400">
                  Edge users: If nothing happens, try enabling "Experimental Web Platform features" in edge://flags/
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}