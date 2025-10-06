// broadcast-utils.ts - Server-side utilities for database-only broadcasting
import { db } from './db';
import { broadcastSessions, broadcastSongs } from '@shared/schema';
import { eq, lt } from 'drizzle-orm';

export function setupBroadcastCleanup() {
  console.log('📡 Setting up database-only broadcast cleanup...');
  
  // Clean up inactive broadcasts periodically
  const interval = setInterval(async () => {
    try {
      // Find broadcasts that haven't been updated in the last 20 seconds
      const tenMinutesAgo = new Date(Date.now() - 20 * 1000); 
      
      const inactiveBroadcasts = await db
        .select()
        .from(broadcastSessions)
        .where(eq(broadcastSessions.isActive, true)) 
        .where(lt(broadcastSessions.lastActivity, tenMinutesAgo))
        .execute();
      
      if (inactiveBroadcasts.length > 0) {
        console.log(`🧹 Found ${inactiveBroadcasts.length} inactive broadcasts to clean up`);
        
        for (const broadcast of inactiveBroadcasts) {
          // Mark broadcast as inactive
          await db
            .update(broadcastSessions)
            .set({ isActive: false })
            .where(eq(broadcastSessions.id, broadcast.id))
            .execute();
            
          // Clean up associated songs
          const deletedSongs = await db
            .delete(broadcastSongs)
            .where(eq(broadcastSongs.broadcastId, broadcast.id))
            .returning();
            
          console.log(`🧹 Cleaned up broadcast ${broadcast.id} with ${deletedSongs.length} songs`);
        }
      }
    } catch (error) {
      console.error('❌ Error cleaning up inactive broadcasts:', error);
    }
  }, 60000); // Check every minute
  
  // Return cleanup function
  return () => clearInterval(interval);
}