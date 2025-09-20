import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Emergency cache-busting on startup (disabled service worker to prevent caching issues)
if ('serviceWorker' in navigator) {
  // Immediately unregister any existing service workers that might serve stale content
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(registration => {
      console.log('🗑️ Unregistering stale service worker:', registration);
      registration.unregister();
    });
  }).catch(err => {
    console.warn('Failed to unregister service workers:', err);
  });
}

// One-time startup cache clear if we detect cache-busting URL params
if (location.search.includes('cache_bust=1')) {
  console.log('🧹 Performing startup cache clear...');
  
  // Clear caches if available
  caches?.keys().then(cacheNames => {
    return Promise.all(cacheNames.map(name => caches.delete(name)));
  }).then(() => {
    console.log('✅ Startup cache clear completed');
  }).catch(err => {
    console.warn('Startup cache clear failed:', err);
  });
}

createRoot(document.getElementById("root")!).render(<App />);
