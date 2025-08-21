import { db } from './db';
import { sql } from 'drizzle-orm';
import * as schema from '@shared/schema';

async function migrate() {
  console.log('Creating SQLite database tables...');
  
  try {
    // Create tables manually to ensure they exist
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS songs (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        artist TEXT NOT NULL,
        duration INTEGER NOT NULL,
        bpm INTEGER,
        key TEXT,
        lyrics TEXT,
        waveform_data TEXT,
        waveform_generated INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    await db.run(sql`
      CREATE TABLE IF NOT EXISTS tracks (
        id TEXT PRIMARY KEY,
        song_id TEXT NOT NULL REFERENCES songs(id),
        name TEXT NOT NULL,
        track_number INTEGER NOT NULL,
        audio_url TEXT NOT NULL,
        local_file_name TEXT,
        audio_data TEXT,
        mime_type TEXT DEFAULT 'audio/mpeg',
        file_size INTEGER DEFAULT 0,
        volume INTEGER DEFAULT 100,
        balance INTEGER DEFAULT 0,
        is_muted INTEGER DEFAULT 0,
        is_solo INTEGER DEFAULT 0
      )
    `);

    // MIDI events table creation removed - MIDI functionality disabled

    await db.run(sql`
      CREATE TABLE IF NOT EXISTS sessions (
        sid TEXT PRIMARY KEY,
        sess TEXT NOT NULL,
        expire TEXT NOT NULL
      )
    `);

    await db.run(sql`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE,
        first_name TEXT,
        last_name TEXT,
        profile_image_url TEXT,
        stripe_customer_id TEXT,
        stripe_subscription_id TEXT,
        subscription_status TEXT,
        subscription_end_date TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);

    console.log('✅ Local SQLite database tables created successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run migration
migrate().catch(console.error);