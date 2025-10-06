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

/**
 * Updates the current broadcast song in localStorage
 * This helps the fallback system show the right song in the viewer
 * 
 * @param songId The ID of the song being broadcast
 * @param songTitle The title of the song
 * @param artistName The artist name
 * @param duration The duration in seconds
 * @param lyrics The song lyrics (optional)
 */
export function updateCurrentBroadcastSong(
  songId: string, 
  songTitle: string, 
  artistName: string, 
  duration: number, 
  lyrics?: string
) {
  // Save the broadcast data for the mobile API fallback
  localStorage.setItem('active_broadcast_data', JSON.stringify({
    currentSongId: songId,
    songTitle,
    artistName,
    songDuration: duration,
    hasLyrics: !!lyrics
  }));
  
  // Save the full song data keyed by ID
  localStorage.setItem(`broadcast_song_${songId}`, JSON.stringify({
    id: songId,
    songTitle,
    artistName,
    duration,
    lyrics,
    trackCount: 1
  }));
  
  console.log(`📱 Saved broadcast song to localStorage: ${songTitle}`);
}

// Configuration - can be toggled via environment or localStorage
const config: ApiFallbackConfig = {
  // Only enable fallbacks if explicitly set in localStorage or if in mobile mode
  // This allows us to use database-only approach for broadcasts in development
  enableFallbacks: localStorage.getItem('force_mobile_mode') === 'true' || 
                  localStorage.getItem('mobile_mode') === 'true',
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
  
  // Broadcast/sharing APIs - enhanced for mobile database mode
  '/api/broadcast/create': () => ({ success: true, message: 'Broadcast created successfully' }),
  '/api/broadcast/check': () => ({ exists: true }),
  
  // Custom broadcast endpoints for specific sessions
  '/api/broadcast/Matt': () => ({ 
    id: 'Matt',
    name: 'Matt\'s Broadcast Demo',
    hostName: 'Matt',
    hostId: 'host_123',
    viewerCount: 3,
    isActive: true,
    lastActivity: Date.now()
  }),
  
  // State for specific broadcasts - updated with a real song and playing state
  '/api/broadcast/Matt/state': () => {
    // Make the demo progress over time for a more realistic experience
    const sessionStartTime = localStorage.getItem('demo_session_start') || Date.now().toString();
    if (!localStorage.getItem('demo_session_start')) {
      localStorage.setItem('demo_session_start', sessionStartTime);
    }
    
    // Calculate a simulated position based on time since page load (looping through the song)
    const timeElapsed = (Date.now() - parseInt(sessionStartTime)) / 1000;
    const songDuration = 230; // 3:50 in seconds
    const currentPosition = timeElapsed % songDuration;
    
    return {
      isActive: true,
      curTime: currentPosition, 
      curSong: 'demo_song_1',
      isPlaying: true, // Always playing in the demo
      duration: songDuration,
      lastUpdateTimestamp: Date.now()
    };
  },
  
  // Song data for specific broadcast songs - with real lyrics for testing
  '/api/broadcast/song/demo_song_1': () => ({
    song: {
      id: 'demo_song_1',
      songTitle: 'The Sound of Silence',
      artistName: 'Simon & Garfunkel',
      duration: 230, // 3:50
      lyrics: "[00:00.00] \n[00:05.00] Hello darkness, my old friend\n[00:10.00] I've come to talk with you again\n[00:15.00] Because a vision softly creeping\n[00:20.00] Left its seeds while I was sleeping\n[00:25.00] And the vision that was planted in my brain\n[00:31.00] Still remains\n[00:36.00] Within the sound of silence\n[00:43.00] \n[00:47.00] In restless dreams I walked alone\n[00:52.00] Narrow streets of cobblestone\n[00:57.00] 'Neath the halo of a street lamp\n[01:02.00] I turned my collar to the cold and damp\n[01:07.00] When my eyes were stabbed by the flash of a neon light\n[01:13.00] That split the night\n[01:18.00] And touched the sound of silence\n[01:25.00] \n[01:29.00] And in the naked light I saw\n[01:34.00] Ten thousand people, maybe more\n[01:39.00] People talking without speaking\n[01:44.00] People hearing without listening\n[01:49.00] People writing songs that voices never share\n[01:55.00] And no one dared\n[02:00.00] Disturb the sound of silence\n[02:07.00] \n[02:11.00] \"Fools\", said I, \"You do not know\n[02:16.00] Silence like a cancer grows\n[02:21.00] Hear my words that I might teach you\n[02:26.00] Take my arms that I might reach you\"\n[02:31.00] But my words, like silent raindrops fell\n[02:37.00] And echoed\n[02:42.00] In the wells of silence\n[02:49.00] \n[02:53.00] And the people bowed and prayed\n[02:58.00] To the neon god they made\n[03:03.00] And the sign flashed out its warning\n[03:08.00] In the words that it was forming\n[03:13.00] And the sign said, \"The words of the prophets are written on the subway walls\n[03:22.00] And tenement halls\"\n[03:27.00] And whispered in the sound of silence",
      trackCount: 1
    }
  }),
  
  // Lyrics search (open Google search directly)
  '/api/lyrics/search': (body?: any) => {
    if (body && body.title && body.artist) {
      const searchQuery = `${body.title} ${body.artist} lyrics`;
      const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;
      return { 
        success: false, 
        openBrowser: true,
        searchResult: {
          url: googleUrl,
          title: `${body.title} by ${body.artist} - Lyrics`,
          snippet: `Search results for "${searchQuery}"`
        },
        message: 'Opening Google search for lyrics'
      };
    }
    return { 
      success: false, 
      message: 'Missing song title or artist information.',
      openBrowser: false 
    };
  },
  
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
    // IMPORTANT: For broadcast viewer, we always use fallbacks, never pass through
    // This ensures we don't depend on the server for broadcast functionality
    
    const apiPath = url.split('?')[0]; // Remove query parameters
    
    // Handle broadcast endpoints dynamically
    if (apiPath.match(/^\/api\/broadcast\/[^\/]+$/)) {
      // Broadcast info endpoint: /api/broadcast/{id}
      const broadcastId = apiPath.split('/').pop() || 'unknown';
      if (config.logCalls) {
        console.log(`📱 Dynamic broadcast info fallback for: ${broadcastId}`);
      }
      
      const broadcastData = {
        id: broadcastId,
        name: `${broadcastId}'s Broadcast`,
        hostName: broadcastId,
        hostId: `host_${broadcastId}`,
        viewerCount: Math.floor(Math.random() * 10) + 1,
        isActive: true,
        lastActivity: Date.now()
      };
      
      return Promise.resolve(new Response(JSON.stringify(broadcastData), {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' }
      }));
    }
    else if (apiPath.match(/^\/api\/broadcast\/[^\/]+\/state$/)) {
      // Broadcast state endpoint: /api/broadcast/{id}/state
      const broadcastId = apiPath.split('/')[3]; // Extract ID from path
      
      if (config.logCalls) {
        console.log(`📱 Dynamic broadcast state fallback for: ${broadcastId}`);
      }
      
      // Check if there's a currently broadcasting song in localStorage
      // This is set when someone is broadcasting in another tab/window
      const activeBroadcastData = localStorage.getItem('active_broadcast_data');
      let currentSongId = 'demo_song_1'; // Default fallback song
      let songDuration = 230; // Default duration (3:50)
      
      if (activeBroadcastData) {
        try {
          const broadcastInfo = JSON.parse(activeBroadcastData);
          if (broadcastInfo.currentSongId) {
            currentSongId = broadcastInfo.currentSongId;
            console.log(`📱 Using active broadcast song: ${currentSongId}`);
            
            // If there's duration info, use it
            if (broadcastInfo.songDuration) {
              songDuration = broadcastInfo.songDuration;
            }
          }
        } catch (e) {
          console.error('Error parsing active broadcast data:', e);
        }
      }
      
      // Make the demo progress over time for a more realistic experience
      const sessionStartTime = localStorage.getItem(`demo_session_start_${broadcastId}`) || 
                               Date.now().toString();
      
      if (!localStorage.getItem(`demo_session_start_${broadcastId}`)) {
        localStorage.setItem(`demo_session_start_${broadcastId}`, sessionStartTime);
      }
      
      // Calculate a simulated position based on time since page load (looping through the song)
      const timeElapsed = (Date.now() - parseInt(sessionStartTime)) / 1000;
      const currentPosition = timeElapsed % songDuration;
      
      // Use a simple localStorage value to store what song is currently being broadcast
      const currentBroadcastSong = localStorage.getItem('current_broadcast_song') || currentSongId;
      
      const stateData = {
        isActive: true,
        curTime: currentPosition, 
        curSong: currentBroadcastSong,
        isPlaying: true, // Always playing in the demo
        duration: songDuration,
        lastUpdateTimestamp: Date.now()
      };
      
      return Promise.resolve(new Response(JSON.stringify(stateData), {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' }
      }));
    }
    else if (apiPath.match(/^\/api\/broadcast\/song\/[^\/]+$/)) {
      // Song data endpoint: /api/broadcast/song/{songId}
      const songId = apiPath.split('/').pop();
      
      if (config.logCalls) {
        console.log(`📱 Dynamic song data fallback for song ID: ${songId}`);
      }
      
      // SIMPLE APPROACH: First check for directly saved song data from performance page
      // This is directly set when a user selects a song in the performance view
      const broadcastSongJson = localStorage.getItem('broadcast_song_' + songId);
      if (broadcastSongJson) {
        try {
          const broadcastSong = JSON.parse(broadcastSongJson);
          console.log(`� Found broadcast song in localStorage: ${broadcastSong.songTitle}`);
          
          return Promise.resolve(new Response(JSON.stringify({
            song: broadcastSong
          }), {
            status: 200,
            statusText: 'OK',
            headers: { 'Content-Type': 'application/json' }
          }));
        } catch (e) {
          console.error('Error parsing broadcast song from localStorage:', e);
        }
      }
      
      // Fall back to looking in the user's song library
      try {
        const songsJson = localStorage.getItem('songs_data');
        if (songsJson) {
          const songs = JSON.parse(songsJson);
          if (Array.isArray(songs)) {
            const foundSong = songs.find(s => s.id === songId);
            if (foundSong) {
              console.log(`📱 Found song in songs library: ${foundSong.songTitle}`);
              
              return Promise.resolve(new Response(JSON.stringify({
                song: foundSong
              }), {
                status: 200,
                statusText: 'OK',
                headers: { 'Content-Type': 'application/json' }
              }));
            }
          }
        }
      } catch (e) {
        console.error('Error checking songs library:', e);
      }
      
      // Create sample songs to switch between as a last resort
      const sampleSongs = {
        'demo_song_1': {
          id: 'demo_song_1',
          songTitle: 'The Sound of Silence',
          artistName: 'Simon & Garfunkel',
          duration: 230, // 3:50
          lyrics: "[00:00.00] \n[00:05.00] Hello darkness, my old friend\n[00:10.00] I've come to talk with you again\n[00:15.00] Because a vision softly creeping\n[00:20.00] Left its seeds while I was sleeping\n[00:25.00] And the vision that was planted in my brain\n[00:31.00] Still remains\n[00:36.00] Within the sound of silence\n[00:43.00] \n[00:47.00] In restless dreams I walked alone\n[00:52.00] Narrow streets of cobblestone\n[00:57.00] 'Neath the halo of a street lamp\n[01:02.00] I turned my collar to the cold and damp\n[01:07.00] When my eyes were stabbed by the flash of a neon light\n[01:13.00] That split the night\n[01:18.00] And touched the sound of silence\n[01:25.00] \n[01:29.00] And in the naked light I saw\n[01:34.00] Ten thousand people, maybe more\n[01:39.00] People talking without speaking\n[01:44.00] People hearing without listening\n[01:49.00] People writing songs that voices never share\n[01:55.00] And no one dared\n[02:00.00] Disturb the sound of silence\n[02:07.00] \n[02:11.00] \"Fools\", said I, \"You do not know\n[02:16.00] Silence like a cancer grows\n[02:21.00] Hear my words that I might teach you\n[02:26.00] Take my arms that I might reach you\"\n[02:31.00] But my words, like silent raindrops fell\n[02:37.00] And echoed\n[02:42.00] In the wells of silence\n[02:49.00] \n[02:53.00] And the people bowed and prayed\n[02:58.00] To the neon god they made\n[03:03.00] And the sign flashed out its warning\n[03:08.00] In the words that it was forming\n[03:13.00] And the sign said, \"The words of the prophets are written on the subway walls\n[03:22.00] And tenement halls\"\n[03:27.00] And whispered in the sound of silence",
          trackCount: 1
        },
        '3am': {
          id: '3am',
          songTitle: '3 AM',
          artistName: 'Matchbox 20',
          duration: 210, // 3:30
          lyrics: "[00:00.00] \n[00:05.00] She says it's cold outside and she hands me my raincoat\n[00:10.00] She's always worried about things like that\n[00:15.00] She says it's all gonna end and it might as well be my fault\n[00:20.00] And she only sleeps when it's raining\n[00:25.00] And she screams and her voice is straining\n[00:30.00] \n[00:31.00] And she says, baby\n[00:33.00] It's 3 AM, I must be lonely\n[00:38.00] When she says, baby\n[00:41.00] Well, I can't help but be scared of it all sometimes\n[00:46.00] And the rain's gonna wash away, I believe it\n[00:51.00] \n[00:55.00] She's got a little bit of something, God, it's better than nothing\n[01:00.00] And in her color portrait world, she believes that she's got it all\n[01:05.00] She swears the moon don't hang quite as high as it used to\n[01:10.00] And she only sleeps when it's raining\n[01:15.00] And she screams, and her voice is straining\n[01:20.00] \n[01:21.00] And she says, baby\n[01:23.00] It's 3 AM, I must be lonely\n[01:28.00] When she says, baby\n[01:31.00] Well, I can't help but be scared of it all sometimes\n[01:36.00] And the rain's gonna wash away, I believe it\n[01:41.00] \n[01:50.00] She believes that life is made up of all that you're used to\n[01:55.00] And the clock on the wall has been stuck at three for days and days\n[02:00.00] She thinks that happiness is a mat that sits on her doorway\n[02:05.00] But outside, it's stopped raining\n[02:10.00] \n[02:11.00] And she says, baby\n[02:13.00] It's 3 AM, I must be lonely\n[02:18.00] When she says, baby\n[02:21.00] Well, I can't help but be scared of it all sometimes\n[02:26.00] And the rain's gonna wash away, I believe it\n[02:31.00] \n[02:36.00] And she says, baby\n[02:38.00] It's 3 AM, I must be lonely\n[02:43.00] When she says, baby\n[02:46.00] Well, I can't help but be scared of it all sometimes\n[02:51.00] And the rain's gonna wash away, I believe it",
          trackCount: 1
        }
      };
      
      // Use the requested song if we have it in our samples, otherwise default to demo_song_1
      console.log(`📻 Using fallback sample song for ID: ${songId}`);
      const songToUse = sampleSongs[songId as keyof typeof sampleSongs] || sampleSongs.demo_song_1;
      const songData = { song: songToUse };
      
      return Promise.resolve(new Response(JSON.stringify(songData), {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' }
      }));
    }
    
    // Try using the predefined fallbacks for other paths
    const fallback = mobileFallbacks[apiPath as keyof typeof mobileFallbacks];
    
    if (fallback) {
      if (config.logCalls) {
        console.log(`📱 Mobile fallback for: ${url}`);
      }
      
      // Parse request body for POST requests
      let requestBody = null;
      if (init?.method === 'POST' && init?.body) {
        try {
          requestBody = JSON.parse(init.body as string);
        } catch (e) {
          // If body is not JSON, keep it as is
          requestBody = init.body;
        }
      }
      
      // Create a mock response
      const fallbackData = fallback(requestBody);
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