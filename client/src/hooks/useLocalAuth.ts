import { useState, useEffect } from "react";

export type UserType = 'free' | 'premium' | 'professional';

interface User {
  id: string;
  email: string;
  stripeSubscriptionId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface AuthState {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: User | null;
}

export function useLocalAuth() {
  console.log('[AUTH] useLocalAuth hook called');
  
  const [authState, setAuthState] = useState<AuthState>({
    isLoading: true,
    isAuthenticated: false,
    user: null,
  });

  useEffect(() => {
    console.log('[AUTH] useEffect - auth state initialized');
    
    // Check if user was previously "logged in" during this session
    const savedUser = sessionStorage.getItem('testUser');
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        console.log('🧪 TESTING: Restoring previous mock session for', parsedUser.email);
        setAuthState({
          isLoading: false,
          isAuthenticated: true,
          user: parsedUser
        });
        return;
      } catch (error) {
        console.warn('Failed to parse saved user, clearing session');
        sessionStorage.removeItem('testUser');
      }
    }
    
    // No saved user - show login
    setAuthState({
      isLoading: false,
      isAuthenticated: false,
      user: null
    });
  }, []);

  const login = async (email: string, password: string) => {
    console.log('🧪 TESTING MODE: Pure client-side mock login for', email);
    
    // Validate input
    if (!email?.trim() || !password?.trim()) {
      throw new Error('Email and password are required');
    }

    try {
      // Simulate brief loading for realistic feel
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Create test user with full professional access (NO API CALLS)
      const testUser: User = {
        id: `test-${Date.now()}`,
        email: email.trim(),
        stripeSubscriptionId: 'demo_professional_access', // Full access granted
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Save to session storage for persistence during testing
      sessionStorage.setItem('testUser', JSON.stringify(testUser));

      // Update auth state
      setAuthState({
        isLoading: false,
        isAuthenticated: true,
        user: testUser
      });

      console.log('✅ TESTING: Pure client-side authentication successful with full professional access');
      return Promise.resolve();
      
    } catch (error: any) {
      console.error('❌ Mock login error:', error);
      throw error;
    }
  };

  const logout = () => {
    console.log('🧪 TESTING MODE: Pure client-side logout');
    sessionStorage.removeItem('testUser');
    setAuthState({
      isLoading: false,
      isAuthenticated: false,
      user: null
    });
  };

  const register = async (email: string, password: string) => {
    console.log('🧪 TESTING MODE: Pure client-side mock registration for', email);
    // Registration works the same as login in testing mode (NO API CALLS)
    return login(email, password);
  };

  return {
    ...authState,
    // Legacy compatibility for existing components
    isPaidUser: true, // Always true for testing
    isFreeUser: false, // Always false for testing  
    userEmail: authState.user?.email,
    userType: 'professional' as const, // Always professional for beta testing
    login,
    logout,
    register,
  };
}