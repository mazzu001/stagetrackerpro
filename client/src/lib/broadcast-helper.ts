/**
 * Simple broadcast helper function to force host mode for testing
 */

// Store the broadcast state across app restarts
const STORAGE_KEY = 'bandmaestro_broadcast_test';

/**
 * Force broadcast host mode for testing
 * @param roomName Optional room name
 * @returns Boolean indicating if host mode was enabled
 */
export function forceBroadcastHost(roomName: string = 'test-broadcast'): boolean {
  try {
    if (typeof localStorage !== 'undefined') {
      // Save the room name
      localStorage.setItem(STORAGE_KEY, roomName);
      console.log('✅ Forced broadcast host mode enabled:', roomName);
      return true;
    }
  } catch (error) {
    console.error('❌ Error forcing broadcast host mode:', error);
  }
  return false;
}

/**
 * Check if broadcast host mode is forced
 * @returns The room name if host mode is forced, null otherwise
 */
export function getBroadcastHostForced(): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      const roomName = localStorage.getItem(STORAGE_KEY);
      return roomName;
    }
  } catch (error) {
    console.error('❌ Error checking forced broadcast host mode:', error);
  }
  return null;
}

/**
 * Clear forced broadcast host mode
 */
export function clearBroadcastHostForced(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
      console.log('✅ Forced broadcast host mode cleared');
    }
  } catch (error) {
    console.error('❌ Error clearing forced broadcast host mode:', error);
  }
}