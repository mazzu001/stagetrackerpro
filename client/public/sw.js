// StageTracker Pro Service Worker - CACHE BUSTING VERSION
const CACHE_NAME = 'stagetracker-pro-cache-bust-' + Date.now();
const STATIC_CACHE = [
  '/',
  '/manifest.json',
  '/favicon.svg',
  '/favicon.ico'
];

// Install event - cache static resources
self.addEventListener('install', (event) => {
  console.log('Service Worker installing with cache bust...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Caching static resources with new cache name:', CACHE_NAME);
        return cache.addAll(STATIC_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - AGGRESSIVELY clean up ALL old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating with AGGRESSIVE cache clearing...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      console.log('Found caches to clear:', cacheNames);
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Delete ALL caches except the current one
          if (cacheName !== CACHE_NAME) {
            console.log('FORCE DELETING cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('All old caches cleared, claiming clients');
      return self.clients.claim();
    })
  );
});

// Fetch event - BYPASS cache for JS assets to prevent secret key caching
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip chrome-extension and other non-http(s) requests
  if (!event.request.url.startsWith('http')) return;

  // CRITICAL: Never cache JavaScript files that might contain sensitive data
  if (event.request.url.includes('.js') || event.request.url.includes('/assets/')) {
    console.log('BYPASSING cache for JS/asset:', event.request.url);
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // For non-JS files, use cache-first strategy
        return response || fetch(event.request);
      })
      .catch(() => {
        // If both cache and network fail, return offline page for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('/');
        }
      })
  );
});

// Background sync for when app comes back online
self.addEventListener('sync', (event) => {
  console.log('Background sync triggered:', event.tag);
});

// Push notifications (for future features)
self.addEventListener('push', (event) => {
  console.log('Push message received');
});

console.log('StageTracker Pro Service Worker loaded - CACHE BUSTING ACTIVE');