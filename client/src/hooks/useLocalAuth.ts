import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';

export type UserType = 'trial' | 'paid';

interface LocalUser {
  email: string;
  userType: UserType;
  loginTime: number;
  lastVerified?: number;
  isTrialActive?: boolean; // Track if trial is still active
  trialEndsAt?: number; // When trial expires (timestamp)
}

const STORAGE_KEY = 'lpp_local_user';
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const VERIFICATION_INTERVAL = 4 * 60 * 60 * 1000; // 4 hours

// Browser detection utilities
const getBrowserInfo = () => {
  const userAgent = navigator.userAgent;
  
  // Check for Android first (prevents false Edge detection)
  const isAndroid = /Android/i.test(userAgent);
  const isChrome = /Chrome/i.test(userAgent) && !/Edg|Edge/i.test(userAgent);
  const isEdge = (/Edg\/|Edge\//i.test(userAgent)) && !isAndroid;
  
  return {
    isAndroid,
    isChrome,
    isEdge,
    isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent),
    isAndroidChrome: isAndroid && isChrome
  };
};

const isEdgeBrowser = () => {
  return getBrowserInfo().isEdge;
};

export function useLocalAuth() {
  const [user, setUser] = useState<LocalUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    let mounted = true;
    
    // Browser compatibility check
    const isBrowserCompatible = () => {
      try {
        // Test localStorage access (Edge sometimes blocks this)
        const testKey = '_test_' + Date.now();
        localStorage.setItem(testKey, 'test');
        localStorage.removeItem(testKey);
        
        // Test fetch API availability
        if (typeof fetch === 'undefined') {
          console.error('❌ Fetch API not available');
          return false;
        }
        
        return true;
      } catch (error) {
        console.error('❌ Browser compatibility issue:', error);
        return false;
      }
    };
    
    // Prevent multiple simultaneous verification requests
    const checkExistingSession = async () => {
      if (isVerifying) {
        console.log('🔄 Authentication already in progress, skipping...');
        return; // Prevent concurrent calls
      }
      
      // Check browser compatibility first
      if (!isBrowserCompatible()) {
        console.error('❌ Browser not compatible with authentication system');
        setIsLoading(false);
        return;
      }
      
      try {
        setIsVerifying(true);
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const userData = JSON.parse(stored) as LocalUser;
          
          // Migrate old user types for backward compatibility
          if ((userData.userType as any) === 'free') {
            userData.userType = 'trial'; // New users default to trial
            localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
            console.log('🔄 Migrated old "free" status to "trial"');
          } else if ((userData.userType as any) === 'premium' || (userData.userType as any) === 'professional') {
            userData.userType = 'paid';
            localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
            console.log('🔄 Migrated old subscription status to "paid"');
          }
          
          // Check if session is still valid (within 24 hours)
          if (Date.now() - userData.loginTime < SESSION_DURATION) {
            // Check if we need to verify (only verify once per hour max)
            // Skip verification on initial load for Edge browser to prevent auth stuck state
            const isEdge = isEdgeBrowser();
            const needsVerification = !userData.lastVerified || 
              (Date.now() - userData.lastVerified > 60 * 60 * 1000); // 1 hour
            
            if (userData.email && needsVerification && !isEdge) {
              try {
                console.log('🔄 Checking fresh subscription status for:', userData.email);
                
                // Add timeout for Edge browser compatibility
                const timeoutPromise = new Promise((_, reject) => 
                  setTimeout(() => reject(new Error('Authentication timeout')), 10000) // 10 second timeout
                );
                
                // Use secure trial status endpoint (GET request with email in query params)
                const response = await fetch(`/api/auth/trial-status?email=${encodeURIComponent(userData.email)}`, {
                  method: 'GET',
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  signal: AbortSignal.timeout(10000) // 10 second timeout
                });
                
                if (response.ok && mounted) {
                  const verificationResult = await response.json();
                  console.log('✅ Fresh trial status:', verificationResult);
                  
                  // Use server-computed trial status
                  const updatedUserData = {
                    ...userData,
                    userType: verificationResult.userType as UserType,
                    isTrialActive: verificationResult.isTrialActive || false,
                    trialEndsAt: verificationResult.trialEndsAt || null,
                    lastVerified: Date.now()
                  };
                  
                  // Log trial status for debugging
                  if (verificationResult.userType === 'trial') {
                    if (verificationResult.isTrialActive) {
                      console.log('✅ Trial is active until:', new Date(verificationResult.trialEndsAt || 0));
                    } else {
                      console.log('⚠️ Trial has expired - access blocked');
                    }
                  }
                  
                  localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUserData));
                  setUser(updatedUserData);
                } else if (mounted) {
                  console.log('❌ Trial verification failed - logging out for security');
                  // For security, log out the user if verification fails
                  localStorage.removeItem(STORAGE_KEY);
                  setUser(null);
                }
              } catch (verificationError) {
                console.error('❌ Error verifying subscription:', verificationError);
                if (mounted) {
                  // For security, log out the user if verification fails
                  console.log('❌ Authentication verification failed - logging out for security');
                  localStorage.removeItem(STORAGE_KEY);
                  setUser(null);
                }
              }
            } else {
              // Use existing data without re-verification
              if (mounted) {
                setUser(userData);
                
                // For Edge browser: Schedule delayed background verification after UI loads
                if (isEdge && userData.email && needsVerification) {
                  setTimeout(async () => {
                    try {
                      console.log('📱 Edge browser: Starting background verification');
                      const response = await fetch(`/api/auth/trial-status?email=${encodeURIComponent(userData.email)}`, {
                        method: 'GET',
                        headers: {
                          'Content-Type': 'application/json'
                        }
                      });
                      
                      if (response.ok && mounted) {
                        const verificationResult = await response.json();
                        const updatedUserData = {
                          ...userData,
                          userType: verificationResult.userType as UserType,
                          lastVerified: Date.now()
                        };
                        
                        // Update with server trial state
                        updatedUserData.isTrialActive = verificationResult.isTrialActive || false;
                        updatedUserData.trialEndsAt = verificationResult.trialEndsAt || null;
                        
                        // Log trial status
                        if (verificationResult.userType === 'trial') {
                          if (verificationResult.isTrialActive) {
                            console.log('✅ Background verification: Trial is active');
                          } else {
                            console.log('⚠️ Background verification: Trial has expired');
                          }
                        }
                        
                        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUserData));
                        setUser(updatedUserData);
                        console.log('✅ Background verification complete');
                      }
                    } catch (error) {
                      console.log('❌ Background verification failed - logging out for security');
                      localStorage.removeItem(STORAGE_KEY);
                      setUser(null);
                    }
                  }, 2000); // 2 second delay for background verification
                }
              }
            }
          } else {
            // Session expired, remove it
            localStorage.removeItem(STORAGE_KEY);
            if (mounted) setUser(null);
          }
        }
      } catch (error) {
        console.error('Error checking local session:', error);
        // For security, don't use cached data if session check fails
        if (mounted) {
          console.error('❌ Session check failed - clearing authentication for security');
          localStorage.removeItem(STORAGE_KEY);
          setUser(null);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
          setIsVerifying(false);
        }
      }
    };

    // Add longer delay for Edge browser to ensure DOM is ready
    const isEdge = isEdgeBrowser();
    const initTimeout = setTimeout(() => {
      if (isEdge) {
        console.log('📱 Edge browser detected - using compatibility mode');
      }
      checkExistingSession();
    }, isEdge ? 500 : 100); // 500ms delay for Edge, 100ms for other browsers
    
    // Debounced auth change handler to prevent rapid-fire calls
    let authChangeTimeout: NodeJS.Timeout;
    const handleAuthChange = () => {
      if (isVerifying) {
        console.log('🔄 Skipping auth change - verification in progress');
        return;
      }
      clearTimeout(authChangeTimeout);
      authChangeTimeout = setTimeout(() => {
        if (mounted && !isVerifying) {
          setIsLoading(true);
          checkExistingSession();
        }
      }, 500); // Increased debounce to 500ms to prevent rapid calls
    };
    
    // Listen for force subscription refresh events
    const handleForceRefresh = () => {
      clearTimeout(authChangeTimeout);
      authChangeTimeout = setTimeout(() => {
        if (mounted && user?.email) {
          console.log('🔄 Force refreshing subscription on demand');
          // Reset verification time to force immediate check
          const updatedUser = { ...user, lastVerified: 0 };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUser));
          checkExistingSession();
        }
      }, 100);
    };

    window.addEventListener('auth-change', handleAuthChange);
    window.addEventListener('storage', handleAuthChange);
    window.addEventListener('force-subscription-refresh', handleForceRefresh);
    
    return () => {
      mounted = false;
      clearTimeout(authChangeTimeout);
      clearTimeout(initTimeout);
      window.removeEventListener('auth-change', handleAuthChange);
      window.removeEventListener('storage', handleAuthChange);
      window.removeEventListener('force-subscription-refresh', handleForceRefresh);
    };
  }, []); // Remove isVerifying dependency to prevent infinite loops

  const login = (userType: UserType, email: string) => {
    const userData: LocalUser = {
      email,
      userType,
      loginTime: Date.now(),
      lastVerified: Date.now()
    };
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
    setUser(userData);
    setIsLoading(false);
    
    // Force a re-render by triggering a window event
    setTimeout(() => {
      window.dispatchEvent(new Event('auth-change'));
    }, 0);
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
    
    // Force page refresh to ensure clean logout
    window.location.reload();
  };

  const upgrade = () => {
    if (user) {
      const upgradedUser = { ...user, userType: 'paid' as const };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(upgradedUser));
      setUser(upgradedUser);
    }
  };

  const forceRefreshSubscription = async () => {
    if (!user?.email) return;
    
    try {
      console.log('🔄 Force refreshing subscription status for:', user.email);
      const response = await fetch(`/api/auth/trial-status?email=${encodeURIComponent(user.email)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const verificationResult = await response.json();
        console.log('✅ Force refresh result:', verificationResult);
        
        const updatedUserData = {
          ...user,
          userType: verificationResult.userType as UserType,
          isTrialActive: verificationResult.isTrialActive || false,
          trialEndsAt: verificationResult.trialEndsAt || null,
          lastVerified: Date.now()
        };
        
        // Log trial status
        if (verificationResult.userType === 'trial') {
          if (verificationResult.isTrialActive) {
            console.log('✅ Force refresh: Trial is active until:', new Date(verificationResult.trialEndsAt || 0));
          } else {
            console.log('⚠️ Force refresh: Trial has expired');
          }
        }
        
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUserData));
        setUser(updatedUserData);
      }
    } catch (error) {
      console.error('❌ Error force refreshing subscription:', error);
    }
  };

  // Check if trial has expired based on local state
  const isTrialExpired = user?.userType === 'trial' && 
    (user.isTrialActive === false || 
     (user.trialEndsAt && Date.now() > user.trialEndsAt));

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    isPaidUser: user?.userType === 'paid',
    isTrialUser: user?.userType === 'trial',
    isTrialActive: user?.isTrialActive && !isTrialExpired,
    isTrialExpired,
    trialEndsAt: user?.trialEndsAt,
    hasAccess: user?.userType === 'paid' || (user?.userType === 'trial' && !isTrialExpired),
    login,
    logout,
    upgrade,
    forceRefreshSubscription
  };
}