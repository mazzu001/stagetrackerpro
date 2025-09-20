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

  // Check for updates by fetching index.html and looking for version changes
  const checkForUpdates = useCallback(async () => {
    if (isChecking) return;
    
    setIsChecking(true);
    
    try {
      // Fetch the index.html with cache-busting
      const response = await fetch(`/index.html?v=${Date.now()}`, {
        method: 'GET',
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
      
      const html = await response.text();
      
      // Look for build time in meta tag or window global
      const buildTimeMatch = html.match(/name="build-time"[^>]*content="([^"]*)"/) ||
                           html.match(/window\.__BUILD_ID__\s*=\s*['"]([^'"]*)['"]/);
      
      if (buildTimeMatch) {
        const latestVersion = buildTimeMatch[1];
        
        // Skip placeholder values
        if (latestVersion && latestVersion !== 'BUILD_TIME_PLACEHOLDER') {
          if (currentVersion && latestVersion !== currentVersion) {
            console.log('🔄 New version detected:', latestVersion, 'Current:', currentVersion);
            setHasUpdate(true);
          } else if (!currentVersion) {
            setCurrentVersion(latestVersion);
          }
        }
      } else {
        // Fallback: check if Vite assets have changed
        const scriptMatch = html.match(/src="\/assets\/index-[\w]+\.js"/);
        if (scriptMatch) {
          const latestScript = scriptMatch[0];
          const currentScript = document.querySelector('script[src*="/assets/index-"]')?.getAttribute('src');
          
          if (currentScript && !latestScript.includes(currentScript.split('?')[0])) {
            console.log('🔄 New build detected via Vite assets changes');
            setHasUpdate(true);
          }
        }
      }
    } catch (error) {
      console.warn('Version check failed:', error);
    } finally {
      setIsChecking(false);
    }
  }, [currentVersion, isChecking]);

  // Refresh the application with cache-busting
  const refreshApp = useCallback(async () => {
    console.log('🔄 Refreshing application...');
    
    try {
      // Clear all caches and unregister service workers
      await Promise.all([
        // Unregister all service workers
        navigator.serviceWorker?.getRegistrations()
          .then(registrations => registrations.forEach(registration => registration.unregister()))
          .catch(err => console.warn('SW unregister failed:', err)),
        
        // Clear all caches
        caches?.keys()
          .then(cacheNames => Promise.all(cacheNames.map(name => caches.delete(name))))
          .catch(err => console.warn('Cache clear failed:', err))
      ]);
      
      console.log('✅ Caches cleared and service workers unregistered');
    } catch (error) {
      console.warn('Cache clearing failed:', error);
    }
    
    // Force reload with cache-busting parameter
    location.replace(location.pathname + '?v=' + Date.now());
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