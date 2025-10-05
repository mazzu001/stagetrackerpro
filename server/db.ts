import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import * as schema from "@shared/schema";
import { firebaseHealthCheck } from './firebase';

// SQLite database for music data only (users now in Firebase)
class LocalDatabaseManager {
  private sqliteClient: Database.Database | null = null;
  private db: any = null;

  constructor() {
    this.initializeConnection();
  }

  private initializeConnection() {
    try {
      console.log('🔧 Initializing local SQLite database for music data...');
      
      const dbDir = path.join(process.cwd(), 'data');
      if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
      const dbPath = path.join(dbDir, 'music.db');

      this.sqliteClient = new Database(dbPath);
      this.db = drizzle(this.sqliteClient, { schema });
      
      console.log('✅ Local SQLite database initialized for music data');
      console.log('🔥 User data will be handled by Firebase');
    } catch (error: any) {
      console.error('❌ Failed to initialize local database:', error.message);
      throw error;
    }
  }

  private async testConnection() {
    if (!this.db || !this.sqliteClient) {
      throw new Error('Database not initialized');
    }
    
    try {
      this.sqliteClient.prepare('SELECT 1').get();
    } catch (e: any) {
      throw new Error(e.message || 'SQLite test query failed');
    }
  }

  public getDb() {
    if (!this.db) {
      throw new Error('Database not available. Connection may be down.');
    }
    return this.db;
  }

  public getSqliteClient() {
    if (!this.sqliteClient) {
      throw new Error('SQLite client not available.');
    }
    return this.sqliteClient;
  }

  public async healthCheck() {
    try {
      await this.testConnection();
      const firebaseHealth = await firebaseHealthCheck();
      
      return { 
        status: firebaseHealth.status === 'healthy' ? 'healthy' : 'degraded',
        sqlite: { status: 'healthy' },
        firebase: firebaseHealth
      };
    } catch (error: any) {
      return { 
        status: 'unhealthy', 
        sqlite: { status: 'unhealthy', error: error.message },
        firebase: await firebaseHealthCheck()
      };
    }
  }
}

// Create singleton instance
const dbManager = new LocalDatabaseManager();

// Export the database instance (only SQLite now)
export const db = dbManager.getDb();
export const sqliteClient = dbManager.getSqliteClient();
export const dbHealthCheck = () => dbManager.healthCheck();