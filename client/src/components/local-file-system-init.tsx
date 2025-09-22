import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { AlertTriangle, Folder, HardDrive } from "lucide-react";
import { BrowserFileSystem } from "../lib/browser-file-system";

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
      const hasIndexedDB = 'indexedDB' in window;
      const hasFileAPI = 'File' in window;
      
      console.log('Browser support check:', {
        hasIndexedDB,
        hasFileAPI,
        userAgent: navigator.userAgent.toLowerCase().substring(0, 100)
      });
      
      if (!hasIndexedDB || !hasFileAPI) {
        console.warn('Browser storage APIs not available');
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
      // Get user email from localStorage if logged in
      let userEmail = 'default@user.com';
      const storedUser = localStorage.getItem('lpp_local_user');
      if (storedUser) {
        try {
          const userData = JSON.parse(storedUser);
          userEmail = userData.email || 'default@user.com';
        } catch (e) {
          console.error('Failed to parse user data:', e);
        }
      }
      
      const browserFS = BrowserFileSystem.getInstance(userEmail);
      const success = await browserFS.initialize();
      
      if (success) {
        console.log('Browser file system initialized successfully');
        onInitialized();
      } else {
        setError('Failed to initialize browser storage. Please try again.');
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
              This application requires IndexedDB and File API support for local storage, which is not available in your current browser.
            </p>
            <div className="space-y-2 text-sm">
              <p className="text-red-400">
                <strong>Required:</strong> Modern browser with IndexedDB support
              </p>
              <p className="text-red-400">
                <strong>Supported:</strong> Chrome, Firefox, Safari, Edge (recent versions)
              </p>
              <p className="text-red-300 mt-3">
                Please update your browser to use this application.
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
            Setup Browser Storage
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <p className="text-gray-300">
              This music performance app stores all data locally in your browser for maximum performance and offline operation.
            </p>
            
            <div className="bg-blue-950/20 border border-blue-500 rounded-lg p-4">
              <h3 className="text-blue-300 font-medium mb-2">What happens next:</h3>
              <ul className="text-blue-200 text-sm space-y-1">
                <li>• Browser storage (IndexedDB) will be initialized</li>
                <li>• Audio files will be stored securely in your browser</li>
                <li>• Song metadata and settings saved locally</li>
                <li>• Everything stays 100% local - no cloud or internet required</li>
                <li>• Works in all modern browsers including Edge, Chrome, Firefox</li>
              </ul>
            </div>

            <div className="bg-green-950/20 border border-green-500 rounded-lg p-4">
              <h3 className="text-green-300 font-medium mb-2">Browser Storage Solution:</h3>
              <p className="text-green-200 text-sm">
                This approach works reliably in all environments, including Replit. Your audio files and project data 
                will be stored securely in your browser's local storage.
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
                {isInitializing ? "Setting up..." : "Initialize Local Storage"}
              </Button>
              
              <p className="text-xs text-gray-500 text-center">
                This will initialize secure browser storage for your music project
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}