import Database from 'better-sqlite3';
import path from 'path';

// Create database migration to add userId column to songs table
const dbPath = path.join(process.cwd(), 'data', 'music-app.db');
const db = new Database(dbPath);

try {
  console.log('Starting database migration...');
  
  // Check if userId column already exists
  const tableInfo = db.prepare("PRAGMA table_info(songs)").all() as any[];
  const userIdExists = tableInfo.some((column: any) => column.name === 'user_id');
  
  if (!userIdExists) {
    console.log('Adding user_id column to songs table...');
    db.exec('ALTER TABLE songs ADD COLUMN user_id TEXT NOT NULL DEFAULT "test-user"');
    console.log('Successfully added user_id column');
  } else {
    console.log('user_id column already exists');
  }
  
  // Show updated schema
  console.log('Current songs table schema:');
  console.table(tableInfo);
  
  console.log('Migration completed successfully!');
} catch (error) {
  console.error('Migration failed:', error);
} finally {
  db.close();
}