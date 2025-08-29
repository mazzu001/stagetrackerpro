import { useState, useEffect } from 'react';
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Router } from "wouter";
import Performance from "@/pages/performance";
import StreamingDemo from "@/pages/streaming-demo";
import Subscribe from "@/pages/subscribe";
import SubscribeRedirect from "@/pages/subscribe-redirect";
import SubscribeFixed from "@/pages/subscribe-fixed";
import SubscribeSimple from "@/pages/subscribe-simple";
import SubscribeDebug from "@/pages/subscribe-debug";
import SubscribeElementsTest from "@/pages/subscribe-elements-test";
import SubscribeTest from "@/pages/subscribe-test";
import Plans from "@/pages/plans";
import Landing from "@/pages/landing";
import Unsubscribe from "@/pages/unsubscribe";
import { LocalFileSystemInit } from '@/components/local-file-system-init';
import { BrowserFileSystem } from '@/lib/browser-file-system';
import { useLocalAuth } from '@/hooks/useLocalAuth';

function AppContent() {
  const [isLocalFSReady, setIsLocalFSReady] = useState(false);
  const [isCheckingFS, setIsCheckingFS] = useState(true);
  const { isAuthenticated, isLoading, isPaidUser } = useLocalAuth();

  useEffect(() => {
    // Check URL parameters for successful payment
    const urlParams = new URLSearchParams(window.location.search);
    const redirectStatus = urlParams.get('redirect_status');
    const email = urlParams.get('email');
    const tier = urlParams.get('tier');
    
    if (redirectStatus === 'succeeded' && email && tier) {
      // Clear URL parameters immediately to prevent re-processing
      window.history.replaceState({}, document.title, window.location.pathname);
      
      console.log(`✅ Payment completed successfully - updating ${email} to ${tier}`);
      
      // Update subscription status immediately
      const updateSubscription = async () => {
        try {
          // Determine subscription status based on tier
          const subscriptionStatus = tier === 'professional' ? 3 : tier === 'premium' ? 2 : 1;
          
          const response = await fetch('/api/update-subscription-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              email: email,
              subscriptionStatus: subscriptionStatus
            })
          });
          
          if (response.ok) {
            // Update local storage immediately  
            const userData = localStorage.getItem('lpp_local_user');
            if (userData) {
              const user = JSON.parse(userData);
              user.userType = tier;
              localStorage.setItem('lpp_local_user', JSON.stringify(user));
            }
            
            const tierName = tier === 'professional' ? 'Professional' : tier === 'premium' ? 'Premium' : 'Free';
            console.log(`✅ Subscription updated to ${tierName}`);
            
            // Force page refresh to load with new subscription
            window.location.reload();
          } else {
            console.error('❌ Failed to update subscription status');
          }
        } catch (error) {
          console.error('❌ Error updating subscription:', error);
        }
      };
      
      updateSubscription();
    }
    
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
        <div className="min-h-screen min-h-[100dvh] bg-background flex items-center justify-center mobile-vh-fix">
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
          <Route path="/streaming-demo" component={StreamingDemo} />
          <Route path="/subscribe" component={SubscribeRedirect} />
          <Route path="/subscribe-fixed" component={SubscribeFixed} />
          <Route path="/subscribe-test-elements" component={SubscribeElementsTest} />
          <Route path="/subscribe-debug" component={SubscribeDebug} />
          <Route path="/subscribe-simple" component={SubscribeSimple} />
          <Route path="/subscribe-old" component={Subscribe} />
          <Route path="/subscribe-test" component={SubscribeTest} />
          <Route path="/plans" component={Plans} />
          <Route path="/unsubscribe" component={Unsubscribe} />
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
