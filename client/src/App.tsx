import { useState, useEffect } from 'react';
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Performance from "@/pages/performance";
import { LocalFileSystemInit } from '@/components/local-file-system-init';
import { LocalFileSystem } from '@/lib/local-file-system';

function App() {
  const [isLocalFSReady, setIsLocalFSReady] = useState(false);
  const [isCheckingFS, setIsCheckingFS] = useState(true);

  useEffect(() => {
    // Check if local file system is already initialized
    const checkLocalFS = async () => {
      try {
        const localFS = LocalFileSystem.getInstance();
        const isReady = localFS.isReady();
        
        if (isReady) {
          console.log('Local file system already ready');
          setIsLocalFSReady(true);
        } else {
          console.log('Local file system needs initialization');
        }
      } catch (error) {
        console.error('Error checking local file system:', error);
      } finally {
        setIsCheckingFS(false);
      }
    };

    checkLocalFS();
  }, []);

  const handleLocalFSInitialized = () => {
    setIsLocalFSReady(true);
  };

  if (isCheckingFS) {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <div className="min-h-screen bg-background flex items-center justify-center">
            <div className="text-center">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-400">Checking local storage...</p>
            </div>
          </div>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {isLocalFSReady ? (
          <Performance />
        ) : (
          <LocalFileSystemInit onInitialized={handleLocalFSInitialized} />
        )}
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
