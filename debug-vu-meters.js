// Debug VU Meters
console.log('🎵 VU METER DEBUG - CHECKING AUDIO LEVELS');

// Function to monitor audio levels
function monitorAudioLevels() {
  console.log('🔍 Monitoring audio levels...');
  
  const interval = setInterval(() => {
    // Check if there are any audio elements
    const audioElements = document.querySelectorAll('audio');
    console.log(`Found ${audioElements.length} audio elements`);
    
    // Check if there are any VU meters
    const vuMeters = document.querySelectorAll('[class*="vu-meter"], [class*="VUMeter"]');
    console.log(`Found ${vuMeters.length} VU meter elements`);
    
    // Check if the track manager component exists
    const trackManager = document.querySelector('[data-testid*="track-item"]');
    console.log('Track manager component found:', !!trackManager);
    
    // Check for audio context activity
    if (typeof window !== 'undefined' && window.AudioContext) {
      console.log('AudioContext available:', !!window.AudioContext);
    }
    
  }, 2000);
  
  // Stop after 30 seconds
  setTimeout(() => {
    clearInterval(interval);
    console.log('🎵 VU METER DEBUG COMPLETED');
  }, 30000);
}

// Start monitoring when the page is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', monitorAudioLevels);
} else {
  monitorAudioLevels();
}