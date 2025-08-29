import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';

export type UserType = 'free' | 'paid' | 'premium' | 'professional';

interface LocalUser {
  email: string;
  userType: UserType;
  loginTime: number;
  lastVerified?: number;
}

const STORAGE_KEY = 'lpp_local_user';
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const VERIFICATION_INTERVAL = 4 * 60 * 60 * 1000; // 4 hours

// Edge browser detection
const isEdgeBrowser = () => {
  const userAgent = navigator.userAgent;
  return userAgent.includes('Edg/') || userAgent.includes('Edge/');
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
      if (isVerifying) return; // Prevent concurrent calls
      
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
                
                const responsePromise = apiRequest('POST', '/api/verify-subscription', {
                  email: userData.email
                });
                
                const response = await Promise.race([responsePromise, timeoutPromise]) as Response;
                
                if (response.ok && mounted) {
                  const verificationResult = await response.json();
                  console.log('✅ Fresh subscription status:', verificationResult.userType);
                  
                  // Always update with fresh subscription status from server
                  const updatedUserData = {
                    ...userData,
                    userType: verificationResult.userType as UserType,
                    lastVerified: Date.now()
                  };
                  
                  localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUserData));
                  setUser(updatedUserData);
                } else if (mounted) {
                  console.log('❌ Subscription verification failed, using cached data');
                  // Use cached data instead of logging out on verification failure
                  setUser(userData);
                }
              } catch (verificationError) {
                console.error('❌ Error verifying subscription (Edge browser compatibility):', verificationError);
                if (mounted) {
                  // Always use cached data if verification fails - don't block Edge users
                  console.log('📱 Using cached authentication data for Edge browser');
                  setUser(userData);
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
                      const response = await apiRequest('POST', '/api/verify-subscription', {
                        email: userData.email
                      });
                      
                      if (response.ok && mounted) {
                        const verificationResult = await response.json();
                        const updatedUserData = {
                          ...userData,
                          userType: verificationResult.userType as UserType,
                          lastVerified: Date.now()
                        };
                        
                        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUserData));
                        setUser(updatedUserData);
                        console.log('✅ Edge browser: Background verification complete');
                      }
                    } catch (error) {
                      console.log('📱 Edge browser: Background verification failed, keeping cached data');
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
        // Don't remove localStorage for Edge browser compatibility
        // Edge sometimes has issues accessing localStorage during initial load
        if (mounted) {
          try {
            // Try fallback session read for Edge browser
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
              const userData = JSON.parse(stored) as LocalUser;
              console.log('📱 Using fallback authentication for Edge browser compatibility');
              setUser(userData);
            } else {
              setUser(null);
            }
          } catch (fallbackError) {
            console.error('❌ Fallback session check failed:', fallbackError);
            setUser(null);
          }
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
      clearTimeout(authChangeTimeout);
      authChangeTimeout = setTimeout(() => {
        if (mounted && !isVerifying) {
          setIsLoading(true);
          checkExistingSession();
        }
      }, 100); // 100ms debounce
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
  }, [isVerifying]);

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
      const response = await apiRequest('POST', '/api/verify-subscription', {
        email: user.email
      });
      
      if (response.ok) {
        const verificationResult = await response.json();
        console.log('✅ Force refresh result:', verificationResult.userType);
        
        const updatedUserData = {
          ...user,
          userType: verificationResult.userType as UserType,
          lastVerified: Date.now()
        };
        
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUserData));
        setUser(updatedUserData);
      }
    } catch (error) {
      console.error('❌ Error force refreshing subscription:', error);
    }
  };

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    isPaidUser: user?.userType === 'paid',
    isFreeUser: user?.userType === 'free',
    login,
    logout,
    upgrade,
    forceRefreshSubscription
  };
}