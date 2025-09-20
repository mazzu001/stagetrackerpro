// WORKAROUND VERSION - Import React explicitly to force single instance
import React from 'react';

export type UserType = 'free' | 'premium' | 'professional';

interface LocalUser {
  email: string;
  userType: UserType;
  loginTime: number;
  lastVerified?: number;
}

// Force React to be the correct instance
const useState = React.useState;
const useEffect = React.useEffect;

export function useLocalAuth() {
  console.log('useLocalAuth called');
  console.log('React is:', React);
  console.log('useState is:', useState);
  
  // Use the explicit React instance
  const [user] = useState<LocalUser | null>(null);
  const [isLoading] = useState(false);

  return {
    user,
    isLoading,
    isAuthenticated: false,
    isPaidUser: false,
    isFreeUser: true,
    login: () => {},
    logout: () => {},
    upgrade: () => {},
    forceRefreshSubscription: () => {}
  };
}