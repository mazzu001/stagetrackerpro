import { useState, useEffect, useRef } from 'react';
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Router } from "wouter";
import Performance from "@/pages/performance";
import StreamingDemo from "@/pages/streaming-demo";
import Dashboard from "@/pages/dashboard";
import BroadcastViewer from "@/pages/broadcast-viewer";
import SimpleBroadcastViewer from "@/pages/broadcast-viewer-simple";
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
import { CloudLibraryDialog } from '@/components/cloud-library-dialog';
import { useSecureStorage } from '@/hooks/use-secure-storage';
import { useLocalAuth } from '@/hooks/useLocalAuth';
import { MidiProvider } from '@/contexts/MidiProvider';

function AppContent() {
  const { isAuthenticated, isLoading, isPaidUser, user } = useLocalAuth();
  const [storageState, storageActions] = useSecureStorage();
  const initStartedRef = useRef<string | null>(null);

  useEffect(() => {
    // Check URL parameters for successful payment - handle both valid and invalid query formats
    console.log('🔍 Checking URL for payment success:', window.location.href);
    
    let redirectStatus, email, tier;
    
    // Handle malformed URLs with double question marks
    const url = window.location.href;
    if (url.includes('redirect_status=succeeded')) {
      const parts = url.split('redirect_status=succeeded')[1];
      if (parts) {
        const params = new URLSearchParams(parts);
        redirectStatus = 'succeeded';
        email = params.get('email') || params.get('&email');
        tier = params.get('tier') || params.get('&tier');
      }
    } else {
      // Normal URL parsing
      const urlParams = new URLSearchParams(window.location.search);
      redirectStatus = urlParams.get('redirect_status');
      email = urlParams.get('email');
      tier = urlParams.get('tier');
    }
    
    console.log('🔍 Parsed values:', { redirectStatus, email, tier });
    
    if (redirectStatus === 'succeeded' && email && tier) {
      // Clear URL parameters immediately to prevent re-processing
      window.history.replaceState({}, document.title, window.location.pathname);
      
      console.log(`✅ Payment completed successfully - updating ${email} to ${tier}`);
      
      // Update subscription status immediately
      const updateSubscription = async () => {
        try {
          // Determine subscription status based on tier
          const subscriptionStatus = tier === 'professional' ? 3 : tier === 'premium' ? 2 : 1;
          
          console.log(`🔄 Making API call to update subscription: ${email} -> ${subscriptionStatus}`);
          
          const response = await fetch('/api/update-subscription-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              email: email,
              subscriptionStatus: subscriptionStatus
            })
          });
          
          console.log(`📋 API response status: ${response.status}`);
          const result = await response.json();
          console.log(`📋 API response data:`, result);
          
          if (response.ok) {
            // Update local storage immediately  
            const userData = localStorage.getItem('lpp_local_user');
            if (userData) {
              const user = JSON.parse(userData);
              user.userType = tier;
              localStorage.setItem('lpp_local_user', JSON.stringify(user));
              console.log(`📱 Updated localStorage: ${user.email} -> ${tier}`);
            }
            
            const tierName = tier === 'professional' ? 'Professional' : tier === 'premium' ? 'Premium' : 'Free';
            console.log(`✅ Subscription updated to ${tierName} - refreshing page in 1 second`);
            
            // Force page refresh to load with new subscription
            setTimeout(() => {
              window.location.reload();
            }, 1000);
          } else {
            console.error('❌ Failed to update subscription status:', result);
          }
        } catch (error) {
          console.error('❌ Error updating subscription:', error);
        }
      };
      
      updateSubscription();
    } else {
      console.log('🔍 No payment success detected in URL');
    }
  }, []);

  // Initialize secure storage when user is available (prevent infinite loop with ref)
  useEffect(() => {
    if (!isAuthenticated || !user?.email) return;
    if (storageState.status.isInitialized) return;
    if (initStartedRef.current === user.email) return; // prevent repeats
    
    console.log('🔧 Initializing secure storage for user:', user.email);
    initStartedRef.current = user.email;
    storageActions.initialize(user.email);
  }, [isAuthenticated, user?.email, storageState.status.isInitialized]);

  const handleLibraryFolderSelected = () => {
    // Close the folder selection dialog and refresh the app
    storageActions.refreshStatus();
  };

  // Show loading state while checking authentication or initializing storage
  if (isLoading || (isAuthenticated && storageState.isLoading)) {
    return (
      <TooltipProvider>
        <div className="min-h-screen min-h-[100dvh] bg-background flex items-center justify-center mobile-vh-fix">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-400">
              {isLoading ? 'Checking authentication...' : 'Initializing secure storage...'}
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
      ) : storageState.needsLibrarySelection ? (
        <>
          <CloudLibraryDialog
            isOpen={true}
            onLibraryReady={handleLibraryFolderSelected}
          />
          <Toaster />
        </>
      ) : (
        <Router>
          <Route path="/" component={() => <Performance userType={user?.userType || 'free'} />} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/broadcast-viewer" component={SimpleBroadcastViewer} />
          <Route path="/broadcast-viewer-old" component={BroadcastViewer} />
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
      <MidiProvider>
        <AppContent />
      </MidiProvider>
    </QueryClientProvider>
  );
}

export default App;
