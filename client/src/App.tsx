import { useState, useEffect } from 'react';
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Router } from "wouter";
import Performance from "@/pages/performance";
import Subscribe from "@/pages/subscribe";
import Landing from "@/pages/landing";
import { LocalFileSystemInit } from '@/components/local-file-system-init';
import { BrowserFileSystem } from '@/lib/browser-file-system';
import { useLocalAuth } from '@/hooks/useLocalAuth';

function AppContent() {
  const [isLocalFSReady, setIsLocalFSReady] = useState(false);
  const [isCheckingFS, setIsCheckingFS] = useState(true);
  const { isAuthenticated, isLoading, isPaidUser } = useLocalAuth();

  useEffect(() => {
    // Check if local file system is already initialized
    const checkLocalFS = async () => {
      try {
        const browserFS = BrowserFileSystem.getInstance();
        const isAlreadyInitialized = await browserFS.isAlreadyInitialized();
        
        if (isAlreadyInitialized) {
          console.log('Browser file system already initialized - auto-initializing');
          // Auto-initialize since it was already set up before
          const success = await browserFS.initialize();
          if (success) {
            setIsLocalFSReady(true);
          } else {
            console.log('Auto-initialization failed - showing setup screen');
          }
        } else {
          console.log('Browser file system needs initialization');
        }
      } catch (error) {
        console.error('Error checking browser file system:', error);
      } finally {
        setIsCheckingFS(false);
      }
    };

    checkLocalFS();
  }, []);

  const handleLocalFSInitialized = () => {
    setIsLocalFSReady(true);
  };

  if (isCheckingFS || isLoading) {
    return (
      <TooltipProvider>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-400">
              {isLoading ? 'Checking authentication...' : 'Checking local storage...'}
            </p>
          </div>
        </div>
        <Toaster />
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      {!isAuthenticated ? (
        <Landing />
      ) : !isLocalFSReady ? (
        <LocalFileSystemInit onInitialized={handleLocalFSInitialized} />
      ) : (
        <Router>
          <Route path="/" component={() => <Performance userType={isPaidUser ? 'paid' : 'free'} />} />
          <Route path="/subscribe" component={() => <Subscribe onClose={() => window.history.back()} />} />
        </Router>
      )}
      <Toaster />
    </TooltipProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}

export default App;
