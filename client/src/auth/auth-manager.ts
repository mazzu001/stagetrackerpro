// Non-hook authentication manager to avoid React module conflicts
export type UserType = 'free' | 'premium' | 'professional';

interface LocalUser {
  email: string;
  userType: UserType;
  loginTime: number;
  lastVerified?: number;
}

class AuthManager {
  private user: LocalUser | null = null;
  private isLoading = false;
  private listeners: Set<() => void> = new Set();

  constructor() {
    // Load user from localStorage on initialization
    this.loadUserFromStorage();
  }

  private loadUserFromStorage() {
    try {
      const stored = localStorage.getItem('stagetracker_user');
      if (stored) {
        this.user = JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to load user from storage:', error);
    }
  }

  private saveUserToStorage() {
    try {
      if (this.user) {
        localStorage.setItem('stagetracker_user', JSON.stringify(this.user));
      } else {
        localStorage.removeItem('stagetracker_user');
      }
    } catch (error) {
      console.warn('Failed to save user to storage:', error);
    }
  }

  private notify() {
    this.listeners.forEach(listener => listener());
  }

  // Subscribe to auth state changes
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // Getters
  getUser() {
    return this.user;
  }

  isAuthenticated() {
    return this.user !== null;
  }

  isPaidUser() {
    return this.user?.userType === 'premium' || this.user?.userType === 'professional';
  }

  isFreeUser() {
    return this.user?.userType === 'free';
  }

  getIsLoading() {
    return this.isLoading;
  }

  // Actions
  async login(email: string, userType: UserType = 'free') {
    this.isLoading = true;
    this.notify();

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      this.user = {
        email,
        userType,
        loginTime: Date.now()
      };
      
      this.saveUserToStorage();
      this.isLoading = false;
      this.notify();
      
      return { success: true };
    } catch (error) {
      this.isLoading = false;
      this.notify();
      return { success: false, error: 'Login failed' };
    }
  }

  logout() {
    this.user = null;
    this.saveUserToStorage();
    this.notify();
  }

  upgrade(newUserType: UserType) {
    if (this.user) {
      this.user.userType = newUserType;
      this.saveUserToStorage();
      this.notify();
    }
  }

  forceRefreshSubscription() {
    // Simulate refresh
    this.notify();
  }
}

// Export singleton instance
export const authManager = new AuthManager();