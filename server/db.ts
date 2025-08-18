import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import { neon } from '@neondatabase/serverless';
import * as schema from "@shared/schema";
import { users, sessions } from "@shared/schema";
import fs from 'fs';
import path from 'path';

// PostgreSQL connection for user authentication and subscriptions
let cloudDb: ReturnType<typeof drizzleNeon> | null = null;
if (process.env.DATABASE_URL) {
  const sql = neon(process.env.DATABASE_URL);
  cloudDb = drizzleNeon(sql, { 
    schema: { 
      users: schema.usersPg, 
      sessions: schema.sessionsPg 
    },
    logger: false
  });
  console.log('Cloud PostgreSQL database initialized for user management');
} else {
  console.warn('No DATABASE_URL found - user authentication will not work');
}

// Local SQLite database for music performance data
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'music-app.db');
const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');

// Local database with songs, tracks, midiEvents only
const localSchema = { 
  songs: schema.songs, 
  tracks: schema.tracks, 
  midiEvents: schema.midiEvents 
};

export const localDb = drizzle(sqlite, { schema: localSchema });
export const userDb = cloudDb;

// Legacy export for backward compatibility with music data
export const db = localDb;

console.log(`Local SQLite database initialized: ${dbPath}`);