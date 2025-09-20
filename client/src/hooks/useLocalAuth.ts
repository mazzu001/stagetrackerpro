// Hook-free authentication - components use authManager directly
import { authManager } from '../auth/auth-manager';

export type UserType = 'free' | 'premium' | 'professional';

// Export the auth manager directly instead of a hook
export function useLocalAuth() {
  // Return a static object that components can use
  // Components should subscribe to authManager directly
  return {
    user: authManager.getUser(),
    isLoading: authManager.getIsLoading(),
    isAuthenticated: authManager.isAuthenticated(),
    isPaidUser: authManager.isPaidUser(),
    isFreeUser: authManager.isFreeUser(),
    login: authManager.login.bind(authManager),
    logout: authManager.logout.bind(authManager),
    upgrade: authManager.upgrade.bind(authManager),
    forceRefreshSubscription: authManager.forceRefreshSubscription.bind(authManager),
    // Add subscribe method for components that need re-renders
    subscribe: authManager.subscribe.bind(authManager)
  };
}