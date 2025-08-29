import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzleSQLite } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import ws from "ws";
import { users, sessions } from "@shared/schema";
import { songs, tracks } from "@shared/schema";
import path from 'path';

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// PostgreSQL connection for user data
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const pgDb = drizzleNeon({ client: pool, schema: { users, sessions } });

// SQLite connection for music data
const sqliteDb = new Database(path.join(process.cwd(), 'data', 'music.db'));
export const sqliteDbConn = drizzleSQLite({ client: sqliteDb, schema: { songs, tracks } });

// Backward compatibility export
export const db = pgDb;