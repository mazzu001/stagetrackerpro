/**
 * Simple broadcasting system - requires internet connection
 * When broadcasting is enabled:
 * 1. Song selection sends song data to server
 * 2. Playback position updates every second
 * 3. Viewers can read this data from server
 */

export interface SimpleBroadcastSong {
  id: string;
  title: string;
  artist: string;
  lyrics: string;
  duration: number;
  waveformData?: string;
}

export interface SimpleBroadcastState {
  isActive: boolean;
  currentSong: string | null;
  position: number;
  isPlaying: boolean;
  lastUpdated: number;
  duration?: number;
}

// Using deployed server on Render.com
const SERVER_URL = process.env.NODE_ENV === 'production' 
  ? 'https://stagetrackerpro-broadcast.onrender.com'
  : 'http://localhost:3001';

class SimpleBroadcast {
  private broadcastId: string | null = null;
  private positionUpdateInterval: NodeJS.Timeout | null = null;
  private isHost = false;

  /**
   * Start broadcasting as host
   */
  async startBroadcasting(broadcastId: string, hostName: string = 'Host'): Promise<boolean> {
    try {
      this.broadcastId = broadcastId;
      this.isHost = true;
      
      // Create broadcast room on server
      const response = await fetch(`${SERVER_URL}/api/broadcast/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: broadcastId,
          name: `${hostName}'s Broadcast`,
          hostName
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create broadcast: ${response.statusText}`);
      }
      
      console.log('🎭 Broadcasting started:', broadcastId);
      return true;
    } catch (error) {
      console.error('❌ Failed to start broadcasting:', error);
      this.isHost = false;
      this.broadcastId = null;
      return false;
    }
  }

  /**
   * Send song data when a song is selected
   */
  async broadcastSong(song: SimpleBroadcastSong): Promise<void> {
    if (!this.isHost || !this.broadcastId) return;
    
    try {
      await fetch(`${SERVER_URL}/api/broadcast/${this.broadcastId}/song`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ song })
      });
      
      console.log('🎵 Song broadcasted:', song.title);
      
      // Start position updates
      this.startPositionUpdates();
    } catch (error) {
      console.error('❌ Failed to broadcast song:', error);
    }
  }

  /**
   * Start sending position updates every second
   */
  private startPositionUpdates(): void {
    if (this.positionUpdateInterval) {
      clearInterval(this.positionUpdateInterval);
    }
    
    this.positionUpdateInterval = setInterval(() => {
      this.updatePosition();
    }, 1000);
  }

  /**
   * Send current playback position to server
   */
  private async updatePosition(): Promise<void> {
    if (!this.isHost || !this.broadcastId) return;
    
    // Get current position from audio element or player
    const audioElement = document.querySelector('audio') as HTMLAudioElement;
    if (!audioElement) return;
    
    const position = audioElement.currentTime || 0;
    const isPlaying = !audioElement.paused;
    
    try {
      await fetch(`${SERVER_URL}/api/broadcast/${this.broadcastId}/state`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          position,
          isPlaying,
          lastUpdated: Date.now()
        })
      });
    } catch (error) {
      // Silently fail position updates to avoid spam
      console.debug('Position update failed:', error);
    }
  }

  /**
   * Stop broadcasting
   */
  async stopBroadcasting(): Promise<void> {
    if (!this.isHost || !this.broadcastId) return;
    
    try {
      // Clear position updates
      if (this.positionUpdateInterval) {
        clearInterval(this.positionUpdateInterval);
        this.positionUpdateInterval = null;
      }
      
      // Mark broadcast as inactive
      await fetch(`${SERVER_URL}/api/broadcast/${this.broadcastId}`, {
        method: 'DELETE'
      });
      
      console.log('🎭 Broadcasting stopped');
    } catch (error) {
      console.error('❌ Failed to stop broadcasting:', error);
    } finally {
      this.broadcastId = null;
      this.isHost = false;
    }
  }

  /**
   * Get current broadcast state (for viewers)
   */
  async getBroadcastState(broadcastId: string): Promise<SimpleBroadcastState | null> {
    try {
      const response = await fetch(`${SERVER_URL}/api/broadcast/${broadcastId}/state`);
      if (!response.ok) return null;
      
      return await response.json();
    } catch (error) {
      console.error('❌ Failed to get broadcast state:', error);
      return null;
    }
  }

  /**
   * Get broadcast song data (for viewers)
   */
  async getBroadcastSong(songId: string): Promise<SimpleBroadcastSong | null> {
    try {
      const response = await fetch(`${SERVER_URL}/api/broadcast/song/${songId}`);
      if (!response.ok) return null;
      
      const data = await response.json();
      return data.song;
    } catch (error) {
      console.error('❌ Failed to get broadcast song:', error);
      return null;
    }
  }

  // Getters
  get isBroadcasting(): boolean {
    return this.isHost && this.broadcastId !== null;
  }

  get currentBroadcastId(): string | null {
    return this.broadcastId;
  }
}

// Export singleton instance
export const simpleBroadcast = new SimpleBroadcast();