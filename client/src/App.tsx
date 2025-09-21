import { useState, useEffect } from 'react';
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
import PrivacyPolicy from "@/pages/privacy-policy";
import { LocalFileSystemInit } from '@/components/local-file-system-init';
import { BrowserFileSystem } from '@/lib/browser-file-system';
import { useLocalAuth } from '@/hooks/useLocalAuth';
import { MidiProvider } from '@/contexts/MidiProvider';
// Google Analytics integration - Added from blueprint:javascript_google_analytics
import { initGA } from "./lib/analytics";
import { useAnalytics } from "./hooks/use-analytics";

// Analytics Router component with page tracking
function AnalyticsRouter({ children }: { children: React.ReactNode }) {
  useAnalytics(); // Track page views
  return <Router>{children}</Router>;
}

function AppContent() {
  console.log("🔍 AppContent rendering...");
  const [isLocalFSReady, setIsLocalFSReady] = useState(true); // TEMP: Skip FS check
  const [isCheckingFS, setIsCheckingFS] = useState(false); // TEMP: Skip FS check
  const { isAuthenticated, isLoading, isPaidUser } = useLocalAuth();
  console.log("🔍 Auth state:", { isAuthenticated, isLoading, isPaidUser });

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
            console.log(`✅ Subscription updated to ${tierName} - updating UI state`);
            
            // Trigger auth change event to update components without page reload
            setTimeout(() => {
              window.dispatchEvent(new Event('auth-change'));
              window.dispatchEvent(new Event('force-subscription-refresh'));
            }, 100);
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

  // TEMPORARY: Force direct Performance page for debugging  
  return (
    <TooltipProvider>
      <AnalyticsRouter>
        <Route path="/" component={() => <Performance userType={'free'} />} />
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
        <Route path="/privacy-policy" component={PrivacyPolicy} />
      </AnalyticsRouter>
      <Toaster />
      {/* UpdateNotification DISABLED - was causing constant false alerts and data loss */}
    </TooltipProvider>
  );
}

function App() {
  // Initialize Google Analytics when app loads
  useEffect(() => {
    // Verify required environment variable is present
    if (!import.meta.env.VITE_GA_MEASUREMENT_ID) {
      console.warn('Missing required Google Analytics key: VITE_GA_MEASUREMENT_ID');
    } else {
      initGA();
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <MidiProvider>
        <AppContent />
      </MidiProvider>
    </QueryClientProvider>
  );
}

export default App;
