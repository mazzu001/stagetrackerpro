import { useState, useEffect } from "react";

export type UserType = 'free' | 'premium' | 'professional';

/**
 * Replacement for authentication hook - provides local-only access
 * All features are always available since no tiers/subscriptions
 */
export function useLocalStorage() {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    console.log('🔧 Local storage hook initializing...');
    // Always consider the app "ready" since no auth needed
    setIsInitialized(true);
    console.log('✅ Local storage hook ready - all features available');
  }, []);

  // Return state that mimics successful professional authentication
  // but without any actual authentication
  return {
    isLoading: false,
    isAuthenticated: true, // Always authenticated (no login needed)
    isInitialized,
    isPaidUser: true, // All features always available
    isFreeUser: false, // Never free
    userType: 'professional' as const, // Always professional tier
    tier: 3, // Always tier 3 (highest)
    userEmail: 'local_user', // Static identifier for storage
    user: {
      id: 'local_user',
      email: 'local_user',
      userType: 'professional' as const,
      stripeSubscriptionId: 'local_professional'
    },
    // Empty functions since no login/logout needed
    login: async () => {},
    logout: () => {},
    register: async () => {}
  };
}