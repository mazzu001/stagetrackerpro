// Emergency cache-busting utilities for production deployment issues

export async function nukeCaches() {
  console.log('🧹 Starting emergency cache clearing...');
  
  try {
    const results = await Promise.all([
      // Unregister all service workers
      navigator.serviceWorker?.getRegistrations()
        .then(registrations => {
          console.log(`🗑️ Unregistering ${registrations.length} service workers`);
          return Promise.all(registrations.map(registration => registration.unregister()));
        })
        .catch(err => {
          console.warn('SW unregister failed:', err);
          return [];
        }),
      
      // Clear all caches
      caches?.keys()
        .then(cacheNames => {
          console.log(`🗑️ Clearing ${cacheNames.length} caches`);
          return Promise.all(cacheNames.map(name => caches.delete(name)));
        })
        .catch(err => {
          console.warn('Cache clear failed:', err);
          return [];
        })
    ]);
    
    console.log('✅ Emergency cache clearing completed:', results);
    
    // Clear localStorage except for user data
    const protectedKeys = ['auth_user', 'auth_token', 'user_data'];
    const keysToRemove = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && !protectedKeys.includes(key) && !key.startsWith('user_')) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        console.warn('Failed to remove localStorage key:', key, e);
      }
    });
    
    console.log(`🗑️ Cleared ${keysToRemove.length} localStorage keys`);
    
  } catch (error) {
    console.error('Emergency cache clearing failed:', error);
  }
}

export function forceReload() {
  console.log('🔄 Forcing complete application reload...');
  
  // Use location.replace to avoid history issues
  const currentUrl = new URL(window.location.href);
  currentUrl.searchParams.set('v', Date.now().toString());
  currentUrl.searchParams.set('cache_bust', '1');
  
  location.replace(currentUrl.toString());
}