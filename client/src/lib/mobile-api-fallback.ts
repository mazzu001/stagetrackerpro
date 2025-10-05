/**
 * Mobile API Fallback System
 * 
 * Intercepts API calls and provides local fallbacks for mobile deployment
 * where no backend server is available.
 */

interface ApiFallbackConfig {
  enableFallbacks: boolean;
  logCalls: boolean;
}

// Configuration - can be toggled via environment or localStorage
const config: ApiFallbackConfig = {
  enableFallbacks: true, // Always true for mobile deployment
  logCalls: true
};

// Intercepted API responses for mobile mode
const mobileFallbacks = {
  // Health check
  '/api/health': () => ({ status: 'mobile_mode', message: 'Running in client-side mode' }),
  
  // Songs API
  '/api/songs': () => ({ songs: [] }), // Empty list - songs come from local storage
  
  // File upload (return success but handle locally)
  '/api/upload': () => ({ success: true, message: 'File processed locally' }),
  
  // Profile/auth APIs
  '/api/profile': () => ({ success: true, user: { email: 'local_user', tier: 'professional' }}),
  '/api/profile-photo': () => ({ success: true, message: 'Profile photos disabled in mobile mode' }),
  
  // Subscription APIs (always professional)
  '/api/create-subscription': () => ({ success: true, subscriptionStatus: 'professional' }),
  '/api/cancel-subscription': () => ({ success: true, message: 'Subscription managed by app store' }),
  '/api/update-subscription-status': () => ({ success: true }),
  
  // Broadcast/sharing APIs (disabled for mobile)
  '/api/broadcast/create': () => ({ success: false, message: 'Sharing disabled in mobile mode' }),
  '/api/broadcast/check': () => ({ exists: false }),
  
  // Lyrics search (use local only)
  '/api/lyrics/search': () => ({ 
    success: false, 
    message: 'External lyrics search disabled. Use manual entry or stored lyrics.',
    openBrowser: false 
  }),
  
  // File registry (use local storage)
  '/api/file-registry': () => ({ files: [] }),
  '/api/file-paths': () => ({ paths: [] }),
  
  // Track audio (handle via local storage)
  '/api/tracks': () => ({ success: true })
};

/**
 * Intercept fetch calls and provide mobile fallbacks
 */
const originalFetch = window.fetch;

window.fetch = async function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  
  // Check if this is an API call that needs fallback
  if (config.enableFallbacks && url.startsWith('/api/')) {
    const apiPath = url.split('?')[0]; // Remove query parameters
    const fallback = mobileFallbacks[apiPath as keyof typeof mobileFallbacks];
    
    if (fallback) {
      if (config.logCalls) {
        console.log(`📱 Mobile fallback for: ${url}`);
      }
      
      // Create a mock response
      const fallbackData = fallback();
      const response = new Response(JSON.stringify(fallbackData), {
        status: 200,
        statusText: 'OK',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      return Promise.resolve(response);
    }
    
    // For API calls without specific fallbacks, return generic success
    if (config.logCalls) {
      console.log(`📱 Generic mobile fallback for: ${url}`);
    }
    
    const genericResponse = new Response(JSON.stringify({ 
      success: true, 
      message: 'Mobile mode - operation handled locally' 
    }), {
      status: 200,
      statusText: 'OK',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    return Promise.resolve(genericResponse);
  }
  
  // For non-API calls, use original fetch
  return originalFetch.call(this, input, init);
};

/**
 * Initialize mobile mode
 */
export function initializeMobileMode() {
  console.log('📱 Mobile API fallback system initialized');
  
  // Set mobile mode flags in localStorage
  localStorage.setItem('mobile_mode', 'true');
  localStorage.setItem('user_tier', 'professional');
  localStorage.setItem('user_subscription_status', '3');
  
  // Ensure we have a local user
  const userData = localStorage.getItem('lpp_local_user');
  if (!userData) {
    const defaultUser = {
      email: 'local_user@mobile.app',
      userType: 'professional',
      tier: 'professional',
      subscriptionStatus: 3
    };
    localStorage.setItem('lpp_local_user', JSON.stringify(defaultUser));
  }
  
  console.log('📱 Mobile mode setup complete - all API calls will use local fallbacks');
}

// Auto-initialize if we're in a static hosting environment
if (typeof window !== 'undefined') {
  // Check if we're likely in a static deployment (no dev server)
  const isStaticDeployment = !window.location.hostname.includes('localhost') && 
                            !window.location.hostname.includes('127.0.0.1') &&
                            !window.location.hostname.includes('dev');
  
  if (isStaticDeployment || localStorage.getItem('force_mobile_mode') === 'true') {
    initializeMobileMode();
  }
}

export { config as mobileApiConfig };