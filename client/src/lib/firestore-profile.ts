/**
 * Firestore User Profile Storage
 * Stores user profile data in Firestore for cloud sync and cross-device access
 * All fields are optional - no authentication required for basic use
 */

import { getFirestore, doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { app } from '@/lib/firebase-config';

const db = getFirestore(app);

export interface UserProfile {
  // Basic Profile Information
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  password?: string; // Optional password for account security (stored hashed in production)
  profilePhoto?: string;
  customBroadcastId?: string;
  
  // Device/Session Info
  deviceId: string;
  lastSync: any; // Firestore Timestamp
  createdAt: any; // Firestore Timestamp
  
  // Stripe Fields (Optional - for future web integration)
  stripeCustomerId?: string | null; // Stripe customer ID
  stripeSubscriptionId?: string | null; // Current subscription ID
  subscriptionStatus?: 'active' | 'canceled' | 'past_due' | 'unpaid' | 'trialing' | null;
  subscriptionTier?: 'free' | 'premium' | 'professional' | null;
  subscriptionStartDate?: any | null; // Firestore Timestamp
  subscriptionEndDate?: any | null; // Firestore Timestamp
  cancelAtPeriodEnd?: boolean; // Whether subscription will cancel at end of period
  
  // App Store Purchase Info (Optional - for mobile in-app purchases)
  appStorePurchaseToken?: string | null; // Google Play/Apple purchase token
  appStoreSubscriptionId?: string | null; // Store-specific subscription ID
  appStorePlatform?: 'google_play' | 'apple_app_store' | 'microsoft_store' | null;
  
  // Additional Metadata
  preferences?: {
    theme?: 'light' | 'dark' | 'auto';
    notifications?: boolean;
  };
}

/**
 * Generate or retrieve unique device ID
 * Stored in localStorage to persist across sessions
 */
export const getDeviceId = (): string => {
  let deviceId = localStorage.getItem('bandmaestro_device_id');
  if (!deviceId) {
    deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('bandmaestro_device_id', deviceId);
    console.log('🆔 New device ID generated:', deviceId);
  }
  return deviceId;
};

/**
 * Save user profile to Firestore
 * Uses merge to only update provided fields
 */
export const saveUserProfile = async (profileData: Partial<UserProfile>): Promise<void> => {
  const deviceId = getDeviceId();
  
  try {
    await setDoc(doc(db, 'user_profiles', deviceId), {
      ...profileData,
      deviceId,
      lastSync: serverTimestamp(),
    }, { merge: true }); // merge = only update provided fields, don't overwrite everything
    
    console.log('✅ User profile saved to Firestore');
  } catch (error) {
    console.error('❌ Failed to save user profile to Firestore:', error);
    throw error;
  }
};

/**
 * Load user profile from Firestore
 * Returns null if no profile exists yet
 */
export const loadUserProfile = async (): Promise<UserProfile | null> => {
  const deviceId = getDeviceId();
  
  try {
    const docRef = doc(db, 'user_profiles', deviceId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      console.log('✅ User profile loaded from Firestore');
      return docSnap.data() as UserProfile;
    }
    
    console.log('📭 No user profile found in Firestore (new user)');
    return null;
  } catch (error) {
    console.error('❌ Failed to load user profile from Firestore:', error);
    return null;
  }
};

/**
 * Initialize new user profile (first time setup)
 * Creates profile with default values if it doesn't exist
 */
export const initializeUserProfile = async (email?: string): Promise<void> => {
  const deviceId = getDeviceId();
  
  try {
    const existingProfile = await loadUserProfile();
    
    if (!existingProfile) {
      await setDoc(doc(db, 'user_profiles', deviceId), {
        deviceId,
        email: email || '',
        firstName: '',
        lastName: '',
        phone: '',
        profilePhoto: '',
        customBroadcastId: '',
        
        // Stripe fields - all empty/null for now (ready for future web integration)
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        subscriptionStatus: null,
        subscriptionTier: 'free', // Default to free tier
        subscriptionStartDate: null,
        subscriptionEndDate: null,
        cancelAtPeriodEnd: false,
        
        // App store fields - all empty/null (ready for future mobile IAP)
        appStorePurchaseToken: null,
        appStoreSubscriptionId: null,
        appStorePlatform: null,
        
        createdAt: serverTimestamp(),
        lastSync: serverTimestamp(),
      });
      
      console.log('✅ New user profile initialized in Firestore');
    } else {
      console.log('✅ User profile already exists in Firestore');
    }
  } catch (error) {
    console.error('❌ Failed to initialize user profile:', error);
    throw error;
  }
};

/**
 * Update specific profile field
 * Useful for inline editing of individual fields
 */
export const updateProfileField = async (
  field: keyof UserProfile, 
  value: any
): Promise<void> => {
  const deviceId = getDeviceId();
  
  try {
    await setDoc(doc(db, 'user_profiles', deviceId), {
      [field]: value,
      lastSync: serverTimestamp(),
    }, { merge: true });
    
    console.log(`✅ Profile field '${field}' updated in Firestore`);
  } catch (error) {
    console.error(`❌ Failed to update profile field '${field}':`, error);
    throw error;
  }
};

/**
 * Get display name from profile
 * Returns formatted name or fallback to "local_user"
 */
export const getDisplayName = (profile: UserProfile | null): string => {
  if (!profile) return 'local_user';
  
  const firstName = profile.firstName?.trim();
  const lastName = profile.lastName?.trim();
  
  if (firstName && lastName) {
    return `${firstName} ${lastName}`;
  } else if (firstName) {
    return firstName;
  } else if (lastName) {
    return lastName;
  }
  
  return 'local_user';
};

/**
 * FUTURE: Update Stripe subscription info
 * Called when user subscribes via web portal
 */
export const updateStripeSubscription = async (stripeData: {
  customerId?: string;
  subscriptionId?: string;
  status?: UserProfile['subscriptionStatus'];
  tier?: UserProfile['subscriptionTier'];
  startDate?: Date;
  endDate?: Date;
  cancelAtPeriodEnd?: boolean;
}): Promise<void> => {
  const deviceId = getDeviceId();
  
  try {
    await setDoc(doc(db, 'user_profiles', deviceId), {
      stripeCustomerId: stripeData.customerId || null,
      stripeSubscriptionId: stripeData.subscriptionId || null,
      subscriptionStatus: stripeData.status || null,
      subscriptionTier: stripeData.tier || 'free',
      subscriptionStartDate: stripeData.startDate || null,
      subscriptionEndDate: stripeData.endDate || null,
      cancelAtPeriodEnd: stripeData.cancelAtPeriodEnd || false,
      lastSync: serverTimestamp(),
    }, { merge: true });
    
    console.log('✅ Stripe subscription info updated in Firestore');
  } catch (error) {
    console.error('❌ Failed to update Stripe subscription:', error);
    throw error;
  }
};

/**
 * FUTURE: Update app store purchase info
 * Called when user purchases via Google Play/Apple App Store
 */
export const updateAppStorePurchase = async (storeData: {
  purchaseToken?: string;
  subscriptionId?: string;
  platform?: UserProfile['appStorePlatform'];
}): Promise<void> => {
  const deviceId = getDeviceId();
  
  try {
    await setDoc(doc(db, 'user_profiles', deviceId), {
      appStorePurchaseToken: storeData.purchaseToken || null,
      appStoreSubscriptionId: storeData.subscriptionId || null,
      appStorePlatform: storeData.platform || null,
      lastSync: serverTimestamp(),
    }, { merge: true });
    
    console.log('✅ App store purchase info updated in Firestore');
  } catch (error) {
    console.error('❌ Failed to update app store purchase:', error);
    throw error;
  }
};

/**
 * FUTURE: Migration function to convert device profile to authenticated user profile
 * Called after user signs up/logs in with proper authentication
 */
export const migrateDeviceProfileToUser = async (userId: string): Promise<void> => {
  const deviceId = getDeviceId();
  
  try {
    // 1. Get device profile
    const deviceProfile = await getDoc(doc(db, 'user_profiles', deviceId));
    
    if (deviceProfile.exists()) {
      // 2. Copy to user account collection
      await setDoc(doc(db, 'authenticated_users', userId), {
        ...deviceProfile.data(),
        userId,
        migratedFrom: deviceId,
        migratedAt: serverTimestamp()
      }, { merge: true });
      
      console.log('✅ Device profile migrated to authenticated user profile');
      
      // 3. Optionally delete device profile (or keep for backup)
      // await deleteDoc(doc(db, 'user_profiles', deviceId));
    }
  } catch (error) {
    console.error('❌ Failed to migrate device profile:', error);
    throw error;
  }
};
