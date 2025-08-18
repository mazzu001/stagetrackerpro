import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function initPostgresTables() {
  try {
    console.log('Creating PostgreSQL tables for user management...');
    
    // Create users table
    await sql(`
      CREATE TABLE IF NOT EXISTS users (
        id text PRIMARY KEY,
        email text UNIQUE,
        first_name text,
        last_name text,
        profile_image_url text,
        stripe_customer_id text,
        stripe_subscription_id text,
        subscription_status text,
        subscription_end_date text,
        song_count integer DEFAULT 0,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      );
    `);
    
    // Create sessions table for authentication
    await sql(`
      CREATE TABLE IF NOT EXISTS sessions (
        sid text PRIMARY KEY,
        sess jsonb NOT NULL,
        expire timestamp NOT NULL
      );
    `);
    
    // Create index on sessions expire for cleanup
    await sql(`
      CREATE INDEX IF NOT EXISTS IDX_session_expire ON sessions (expire);
    `);
    
    console.log('PostgreSQL tables created successfully!');
    
  } catch (error) {
    console.error('Failed to create PostgreSQL tables:', error);
    throw error;
  }
}

// Run the initialization
initPostgresTables()
  .then(() => {
    console.log('Database initialization completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Database initialization failed:', error);
    process.exit(1);
  });