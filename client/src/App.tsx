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
// Subscription pages removed - mobile app model
// import Subscribe from "@/pages/subscribe";
// import SubscribeRedirect from "@/pages/subscribe-redirect";
// import SubscribeFixed from "@/pages/subscribe-fixed";
// import SubscribeSimple from "@/pages/subscribe-simple";
// import SubscribeDebug from "@/pages/subscribe-debug";
// import SubscribeElementsTest from "@/pages/subscribe-elements-test";
// import SubscribeTest from "@/pages/subscribe-test";
// import Plans from "@/pages/plans";
// import Unsubscribe from "@/pages/unsubscribe";
import PrivacyPolicy from "@/pages/privacy-policy";
import { useLocalStorage, type UserType } from '@/hooks/useLocalStorage';
import { useStorage } from '@/contexts/StorageContext';
import { MidiProvider } from '@/contexts/MidiProvider';
import { StorageProvider } from '@/contexts/StorageContext';
// Google Analytics integration - Added from blueprint:javascript_google_analytics
import { initGA } from "./lib/analytics";
import { useAnalytics } from "./hooks/use-analytics";

// Analytics Router component with page tracking
function AnalyticsRouter({ children }: { children: React.ReactNode }) {
  useAnalytics(); // Track page views
  return <Router>{children}</Router>;
}

interface AppContentProps {
  isAuthenticated: boolean;
  isPaidUser: boolean;
  user?: { email: string; userType?: string; } | null;
  userType?: string;
}

function AppContent({ isAuthenticated, isPaidUser, user, userType, userEmail }: AppContentProps & { userEmail?: string }) {
  console.log("[APP] AppContent component rendering...");
  const { isInitialized: storageInitialized } = useStorage();
  console.log("[APP] Storage initialized:", storageInitialized);

  useEffect(() => {
    // Check URL parameters for successful payment - handle both valid and invalid query formats
    
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
      
      // Update subscription status immediately (CLIENT-SIDE MODE)
      const updateSubscription = async () => {
        try {
          // Determine subscription status based on tier (always professional in mobile mode)
          const subscriptionStatus = tier === 'professional' ? 3 : tier === 'premium' ? 2 : 1;
          
          console.log(`� Mobile mode: subscription status set to professional (${subscriptionStatus})`);
          
          // No API call needed - store locally
          localStorage.setItem('user_subscription_status', subscriptionStatus.toString());
          localStorage.setItem('user_tier', tier);
          
          console.log(`✅ Local storage updated: tier=${tier}, status=${subscriptionStatus}`);
          
          // Always success in mobile mode
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
          window.dispatchEvent(new Event('auth-change'));
        } catch (error) {
          console.error('❌ Error updating subscription:', error);
        }
      };
      
      updateSubscription();
    } else {
      console.log('🔍 No payment success detected in URL');
    }
  }, []);

  // AppContent now handles the rendering - no authentication needed
  return (
    <TooltipProvider>
      {!storageInitialized ? (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-400">Initializing storage...</p>
          </div>
        </div>
      ) : (
        <AnalyticsRouter>
          <Route path="/" component={() => <Performance userType={userType as UserType || 'professional'} userEmail={userEmail} />} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/broadcast-viewer" component={SimpleBroadcastViewer} />
        <Route path="/broadcast-viewer-old" component={BroadcastViewer} />
        <Route path="/streaming-demo" component={StreamingDemo} />
        {/* Subscription routes removed - mobile app model 
        <Route path="/subscribe" component={SubscribeRedirect} />
        <Route path="/subscribe-fixed" component={SubscribeFixed} />
        <Route path="/subscribe-test-elements" component={SubscribeElementsTest} />
        <Route path="/subscribe-debug" component={SubscribeDebug} />
        <Route path="/subscribe-simple" component={SubscribeSimple} />
        <Route path="/subscribe-old" component={Subscribe} />
        <Route path="/subscribe-test" component={SubscribeTest} />
        <Route path="/plans" component={Plans} />
        <Route path="/unsubscribe" component={Unsubscribe} /> */}
        <Route path="/privacy-policy" component={PrivacyPolicy} />
        </AnalyticsRouter>
      )}
      <Toaster />
      {/* UpdateNotification DISABLED - was causing constant false alerts and data loss */}
    </TooltipProvider>
  );
}

function App() {
  console.log("[APP] About to call useLocalStorage hook...");
  const { isAuthenticated, isLoading, isPaidUser, user, userType } = useLocalStorage();
  console.log("[APP] Auth state:", { isAuthenticated, isLoading, isPaidUser, userEmail: user?.email, userType });

  // Initialize Google Analytics when app loads
  useEffect(() => {
    // Verify required environment variable is present
    if (!import.meta.env.VITE_GA_MEASUREMENT_ID) {
      console.warn('Missing required Google Analytics key: VITE_GA_MEASUREMENT_ID');
    } else {
      initGA();
    }
  }, []);

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <TooltipProvider>
        <div className="min-h-screen min-h-[100dvh] bg-background flex items-center justify-center mobile-vh-fix">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-400">Checking authentication...</p>
          </div>
        </div>
        <Toaster />
      </TooltipProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <StorageProvider>
        <MidiProvider>
          <AppContent isAuthenticated={isAuthenticated} isPaidUser={isPaidUser} user={user} userType={userType} userEmail="local_user" />
        </MidiProvider>
      </StorageProvider>
    </QueryClientProvider>
  );
}

export default App;
