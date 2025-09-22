import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';

export type UserType = 'free' | 'premium' | 'professional';

interface LocalUser {
  email: string;
  userType: UserType;
  loginTime: number;
  lastVerified?: number;
}

const STORAGE_KEY = 'lpp_local_user';
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export function useLocalAuth() {
  console.log("[AUTH] useLocalAuth hook called");
  
  // Initialize state synchronously from localStorage
  const [user, setUser] = useState<LocalUser | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const userData = JSON.parse(stored) as LocalUser;
        
        // Migrate old 'paid' userType to 'premium' for backward compatibility
        if ((userData.userType as any) === 'paid') {
          userData.userType = 'premium';
          localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
        }
        
        // Check if session is still valid (within 24 hours)
        if (Date.now() - userData.loginTime < SESSION_DURATION) {
          console.log("[AUTH] Valid session found:", userData.email);
          return userData;
        } else {
          // Session expired, clear it
          console.log("[AUTH] Session expired, clearing");
          localStorage.removeItem(STORAGE_KEY);
          return null;
        }
      }
      return null;
    } catch (error) {
      console.error('[AUTH] Error reading localStorage:', error);
      return null;
    }
  });

  // isLoading is always false since we check synchronously
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    console.log("[AUTH] useEffect - auth state initialized");
    
    // Listen for auth changes from other tabs/windows
    const handleStorageChange = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const userData = JSON.parse(stored) as LocalUser;
          if (Date.now() - userData.loginTime < SESSION_DURATION) {
            setUser(userData);
          } else {
            localStorage.removeItem(STORAGE_KEY);
            setUser(null);
          }
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error('[AUTH] Error handling storage change:', error);
      }
    };

    // Listen for storage changes and custom auth events
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('auth-change', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('auth-change', handleStorageChange);
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
    
    // Notify other components
    window.dispatchEvent(new Event('auth-change'));
  };

  const logout = () => {
    // Clear all authentication data
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
    
    // Force complete reload to landing page
    window.location.replace('/');
  };

  const upgrade = () => {
    if (user) {
      const upgradedUser = { ...user, userType: 'premium' as const };
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
    isPaidUser: user?.userType === 'premium' || user?.userType === 'professional',
    isFreeUser: user?.userType === 'free',
    login,
    logout,
    upgrade,
    forceRefreshSubscription
  };
}