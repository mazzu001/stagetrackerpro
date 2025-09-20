import { useState, useEffect, useCallback } from 'react';

interface VersionInfo {
  version: string;
  buildTime: string;
}

export function useVersionCheck() {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);

  // Generate initial version based on current timestamp
  const getInitialVersion = useCallback(() => {
    // Use build time from window global (set by dynamic script) or meta tag
    const buildTime = (window as any).__BUILD_ID__ || 
                     document.querySelector('meta[name="build-time"]')?.getAttribute('content');
    return buildTime && buildTime !== 'BUILD_TIME_PLACEHOLDER' ? buildTime : Date.now().toString();
  }, []);

  // Check for updates using server version endpoint (more reliable)
  const checkForUpdates = useCallback(async () => {
    if (isChecking) return;
    
    setIsChecking(true);
    
    try {
      // Use server version endpoint with aggressive cache-busting
      const response = await fetch(`/api/version?t=${Date.now()}`, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      if (!response.ok) {
        console.warn('Failed to check for updates:', response.status);
        return;
      }
      
      const data = await response.json();
      const latestVersion = data.version;
      
      if (latestVersion) {
        if (currentVersion && latestVersion !== currentVersion) {
          console.log('🔄 New version detected:', latestVersion, 'Current:', currentVersion);
          console.log('📍 Deployment ID:', data.deploymentId);
          setHasUpdate(true);
        } else if (!currentVersion) {
          setCurrentVersion(latestVersion);
          console.log('✅ Initial version set:', latestVersion);
        }
      }
    } catch (error) {
      console.warn('Version check failed:', error);
    } finally {
      setIsChecking(false);
    }
  }, [currentVersion, isChecking]);

  // Refresh the application with comprehensive cache-busting
  const refreshApp = useCallback(async () => {
    console.log('🔄 Starting comprehensive app refresh...');
    
    try {
      // Import and use cache-busting utilities
      const { nukeCaches, forceReload } = await import('@/lib/cache-buster');
      
      // Clear all caches and service workers
      await nukeCaches();
      
      // Force reload with cache-busting
      forceReload();
    } catch (error) {
      console.warn('Cache-busting utilities failed, using fallback:', error);
      
      // Fallback: basic cache clearing
      try {
        await Promise.all([
          navigator.serviceWorker?.getRegistrations()
            .then(registrations => registrations.forEach(registration => registration.unregister()))
            .catch(() => {}),
          caches?.keys()
            .then(cacheNames => Promise.all(cacheNames.map(name => caches.delete(name))))
            .catch(() => {})
        ]);
      } catch (e) {
        console.warn('Fallback cache clearing failed:', e);
      }
      
      // Force reload
      location.replace(location.pathname + '?v=' + Date.now());
    }
  }, []);

  // Check for updates when the app becomes visible again
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        setTimeout(checkForUpdates, 1000); // Small delay after visibility change
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [checkForUpdates]);

  // Periodic update checks (every 5 minutes when app is active)
  useEffect(() => {
    if (!currentVersion) {
      setCurrentVersion(getInitialVersion());
    }

    const interval = setInterval(() => {
      if (!document.hidden) {
        checkForUpdates();
      }
    }, 5 * 60 * 1000); // 5 minutes

    // Initial check after 30 seconds
    const initialTimeout = setTimeout(checkForUpdates, 30000);

    return () => {
      clearInterval(interval);
      clearTimeout(initialTimeout);
    };
  }, [checkForUpdates, currentVersion, getInitialVersion]);

  return {
    hasUpdate,
    isChecking,
    checkForUpdates,
    refreshApp,
    currentVersion
  };
}