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

export function useLocalAuth() {
  const [user, setUser] = useState<LocalUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simplified auth check - no repeated API calls
    const checkExistingSession = async () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const userData = JSON.parse(stored) as LocalUser;
          
          // Check if session is still valid (within 24 hours)
          if (Date.now() - userData.loginTime < SESSION_DURATION) {
            // Only verify if it's been more than 8 hours since last verification
            const needsVerification = !userData.lastVerified || 
                                    (Date.now() - userData.lastVerified > (8 * 60 * 60 * 1000));
            
            if (needsVerification && userData.email) {
              // Use cached data immediately, verify in background
              setUser(userData);
              
              // Background verification
              setTimeout(async () => {
                try {
                  const response = await apiRequest('POST', '/api/verify-subscription', {
                    email: userData.email
                  });
                  
                  if (response.ok) {
                    const verificationResult = await response.json();
                    const updatedUserData = {
                      ...userData,
                      userType: verificationResult.userType as UserType,
                      lastVerified: Date.now()
                    };
                    
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUserData));
                    setUser(updatedUserData);
                  }
                } catch (error) {
                  // Silently fail background verification
                }
              }, 2000); // Verify after 2 seconds
            } else {
              // Use existing data without verification
              setUser(userData);
            }
          } else {
            // Session expired, remove it
            localStorage.removeItem(STORAGE_KEY);
            setUser(null);
          }
        }
      } catch (error) {
        console.error('Error checking local session:', error);
        localStorage.removeItem(STORAGE_KEY);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkExistingSession();
    
    // Listen for auth changes to force re-renders
    const handleAuthChange = () => {
      setIsLoading(true);
      checkExistingSession();
    };
    
    window.addEventListener('auth-change', handleAuthChange);
    window.addEventListener('storage', handleAuthChange);
    
    return () => {
      window.removeEventListener('auth-change', handleAuthChange);
      window.removeEventListener('storage', handleAuthChange);
    };
  }, []);

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

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    isPaidUser: user?.userType === 'paid',
    isFreeUser: user?.userType === 'free',
    login,
    logout,
    upgrade
  };
}