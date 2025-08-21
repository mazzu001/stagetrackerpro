import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import { neon, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import * as schema from "@shared/schema";
import { users, sessions } from "@shared/schema";
import fs from 'fs';
import path from 'path';

// Configure Neon for serverless environment
neonConfig.webSocketConstructor = ws;

// PostgreSQL connection for user authentication and subscriptions
let cloudDb: ReturnType<typeof drizzleNeon> | null = null;
try {
  if (process.env.DATABASE_URL) {
    console.log('🔗 Connecting to PostgreSQL database...');
    const sql = neon(process.env.DATABASE_URL);
    cloudDb = drizzleNeon(sql, { 
      schema: { 
        users: schema.usersPg, 
        sessions: schema.sessionsPg 
      }
    });
    console.log('✅ Cloud PostgreSQL database initialized for user management');
    
    // Test the connection (wrapped in async function to avoid top-level await)
    Promise.resolve().then(async () => {
      try {
        await sql`SELECT 1`;
        console.log('✅ PostgreSQL database connection verified');
      } catch (testError) {
        console.warn('⚠️ PostgreSQL connection test failed, but continuing:', testError);
      }
    });
  } else {
    console.warn('⚠️ No DATABASE_URL found - user authentication will not work in production');
    console.log('💡 For full functionality, configure DATABASE_URL environment variable');
  }
} catch (error: any) {
  console.error('❌ Failed to initialize PostgreSQL database:', error);
  console.warn('⚠️ Continuing without cloud database - some features may not work');
  cloudDb = null;
}

// Local SQLite database for music performance data
let localDb: ReturnType<typeof drizzle>;
try {
  console.log('🗄️ Initializing local SQLite database...');
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    console.log('📁 Creating data directory...');
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('✅ Data directory created');
  }

  const dbPath = path.join(dataDir, 'music-app.db');
  console.log(`📊 Opening SQLite database at: ${dbPath}`);
  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  console.log('✅ SQLite WAL mode enabled for better performance');

  // Local database with songs, tracks only (MIDI removed)
  const localSchema = { 
    songs: schema.songs, 
    tracks: schema.tracks
  };

  localDb = drizzle(sqlite, { schema: localSchema });
  console.log(`✅ Local SQLite database initialized: ${dbPath}`);
  
  // Test the local database (wrapped in promise to avoid execution during init)
  Promise.resolve().then(async () => {
    try {
      await localDb.select().from(schema.songs).limit(1);
      console.log('✅ Local SQLite database connection verified');
    } catch (testError) {
      console.warn('⚠️ SQLite connection test failed, but continuing:', testError);
    }
  });
} catch (error: any) {
  console.error('❌ Critical error initializing SQLite database:', error);
  throw new Error(`SQLite database initialization failed: ${error.message}`);
}

export { localDb };
export const userDb = cloudDb;

// Legacy export for backward compatibility with music data
export const db = localDb;