import { useState, useEffect } from 'react';

export type UserType = 'free' | 'paid';

interface LocalUser {
  email: string;
  userType: UserType;
  loginTime: number;
}

const STORAGE_KEY = 'lpp_local_user';
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export function useLocalAuth() {
  const [user, setUser] = useState<LocalUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing session on mount
    const checkExistingSession = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const userData = JSON.parse(stored) as LocalUser;
          
          // Check if session is still valid (within 24 hours)
          if (Date.now() - userData.loginTime < SESSION_DURATION) {
            setUser(userData);
          } else {
            // Session expired, remove it
            localStorage.removeItem(STORAGE_KEY);
          }
        }
      } catch (error) {
        console.error('Error checking local session:', error);
        localStorage.removeItem(STORAGE_KEY);
      } finally {
        setIsLoading(false);
      }
    };

    checkExistingSession();
  }, []);

  const login = (userType: UserType, email: string) => {
    const userData: LocalUser = {
      email,
      userType,
      loginTime: Date.now()
    };
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    console.log('Logout function called');
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
    console.log('User cleared, should redirect to landing page');
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