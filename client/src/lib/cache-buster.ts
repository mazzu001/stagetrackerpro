// Emergency cache-busting utilities for production deployment issues

export async function nukeCaches() {
  console.warn('🚨 CACHE CLEARING DISABLED - was destroying user data');
  console.log('💾 User data and audio files are now protected');
  
  // SAFE MINIMAL CLEARING - only clear browser caches, NOT IndexedDB or localStorage
  try {
    // Only clear browser HTTP caches, not storage APIs
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      const safeCacheNames = cacheNames.filter(name => 
        !name.includes('user') && 
        !name.includes('audio') && 
        !name.includes('music') &&
        !name.includes('data')
      );
      
      if (safeCacheNames.length > 0) {
        await Promise.all(safeCacheNames.map(name => caches.delete(name)));
        console.log(`🗑️ Safely cleared ${safeCacheNames.length} HTTP caches`);
      }
    }
  } catch (error) {
    console.warn('Safe cache clearing failed:', error);
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