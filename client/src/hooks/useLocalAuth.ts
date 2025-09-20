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
  const [user, setUser] = useState<LocalUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    let mounted = true;
    
    const checkExistingSession = async () => {
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
            if (mounted) setUser(userData);
          } else {
            // Session expired, remove it
            localStorage.removeItem(STORAGE_KEY);
            if (mounted) setUser(null);
          }
        }
      } catch (error) {
        console.error('Error checking local session:', error);
        if (mounted) setUser(null);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    setTimeout(checkExistingSession, 100);

    return () => {
      mounted = false;
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
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
    window.location.reload();
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
      const response = await apiRequest('POST', '/api/verify-subscription', {
        email: user.email
      });
      
      if (response.ok) {
        const verificationResult = await response.json();
        const updatedUserData = {
          ...user,
          userType: verificationResult.userType as UserType,
          lastVerified: Date.now()
        };
        
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUserData));
        setUser(updatedUserData);
      }
    } catch (error) {
      console.error('Error force refreshing subscription:', error);
    }
  };

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    isPaidUser: user?.userType === 'premium',
    isFreeUser: user?.userType === 'free',
    login,
    logout,
    upgrade,
    forceRefreshSubscription
  };
}