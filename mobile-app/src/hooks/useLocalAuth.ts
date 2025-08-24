import { useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';

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

// Mock API request function for mobile (in real app, this would connect to backend)
const apiRequest = async (method: string, endpoint: string, data?: any) => {
  // Simulate API response for subscription verification
  if (endpoint === '/api/verify-subscription') {
    // Mock verification - in real app this would call your backend
    return {
      ok: true,
      json: () => Promise.resolve({
        isPaid: data.email.includes('paid') || data.email.includes('professional'),
        userType: data.email.includes('professional') ? 'professional' : 
                 data.email.includes('paid') ? 'paid' : 'free'
      })
    };
  }
  return { ok: false };
};

export function useLocalAuth() {
  const [user, setUser] = useState<LocalUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Always check fresh subscription status on app launch
    const checkExistingSession = async () => {
      try {
        const stored = await SecureStore.getItemAsync(STORAGE_KEY);
        if (stored) {
          const userData = JSON.parse(stored) as LocalUser;
          
          // Check if session is still valid (within 24 hours)
          if (Date.now() - userData.loginTime < SESSION_DURATION) {
            // ALWAYS verify subscription status on launch - no caching
            if (userData.email) {
              try {
                console.log('🔄 Checking fresh subscription status for:', userData.email);
                const response = await apiRequest('POST', '/api/verify-subscription', {
                  email: userData.email
                });
                
                if (response.ok) {
                  const verificationResult = await response.json();
                  console.log('✅ Fresh subscription status:', verificationResult.userType);
                  
                  // Always update with fresh subscription status from server
                  const updatedUserData = {
                    ...userData,
                    userType: verificationResult.userType as UserType,
                    lastVerified: Date.now()
                  };
                  
                  await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(updatedUserData));
                  setUser(updatedUserData);
                } else {
                  console.log('❌ Subscription verification failed, logging out');
                  await SecureStore.deleteItemAsync(STORAGE_KEY);
                  setUser(null);
                }
              } catch (verificationError) {
                console.error('❌ Error verifying subscription:', verificationError);
                // If verification fails, log out to be safe
                await SecureStore.deleteItemAsync(STORAGE_KEY);
                setUser(null);
              }
            } else {
              // No email stored, invalid session
              await SecureStore.deleteItemAsync(STORAGE_KEY);
              setUser(null);
            }
          } else {
            // Session expired, remove it
            await SecureStore.deleteItemAsync(STORAGE_KEY);
            setUser(null);
          }
        }
      } catch (error) {
        console.error('Error checking local session:', error);
        await SecureStore.deleteItemAsync(STORAGE_KEY);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkExistingSession();
  }, []);

  const login = async (userType: UserType, email: string) => {
    const userData: LocalUser = {
      email,
      userType,
      loginTime: Date.now(),
      lastVerified: Date.now()
    };
    
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(userData));
    setUser(userData);
    setIsLoading(false);
  };

  const logout = async () => {
    await SecureStore.deleteItemAsync(STORAGE_KEY);
    setUser(null);
  };

  const upgrade = async () => {
    if (user) {
      const upgradedUser = { ...user, userType: 'paid' as const };
      await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(upgradedUser));
      setUser(upgradedUser);
    }
  };

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    isPaidUser: user?.userType === 'paid' || user?.userType === 'premium' || user?.userType === 'professional',
    isFreeUser: user?.userType === 'free',
    isProfessionalUser: user?.userType === 'professional',
    login,
    logout,
    upgrade
  };
}