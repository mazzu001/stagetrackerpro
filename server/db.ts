import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Enhanced database connection with reconnection handling
class DatabaseManager {
  private pool: Pool | null = null;
  private db: any = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second
  private isReconnecting = false;

  constructor() {
    this.initializeConnection();
  }

  private initializeConnection() {
    try {
      console.log('🔧 Initializing database connection...');
      
      // Create pool with enhanced configuration
      this.pool = new Pool({ 
        connectionString: process.env.DATABASE_URL,
        maxUses: 1000, // Limit connection reuse to prevent stale connections
        connectionTimeoutMillis: 10000, // 10 second connection timeout
      });

      // Set up error handling for the pool
      this.pool.on('error', (err) => {
        console.error('💥 Database pool error:', err.message);
        this.handleConnectionError(err);
      });

      this.db = drizzle({ client: this.pool, schema });
      console.log('✅ Database connection initialized successfully');
    } catch (error: any) {
      console.error('❌ Failed to initialize database connection:', error.message);
      this.handleConnectionError(error);
    }
  }

  private async handleConnectionError(error: any) {
    const errorMessage = error.message || '';
    
    // Check if it's a connection termination error
    if (errorMessage.includes('terminating connection') || 
        errorMessage.includes('connection terminated') ||
        errorMessage.includes('Connection terminated unexpectedly') ||
        errorMessage.includes('administrator command')) {
      
      console.warn('⚠️ Database connection terminated - attempting reconnection...');
      await this.attemptReconnection();
    } else {
      console.error('💥 Non-recoverable database error:', errorMessage);
    }
  }

  private async attemptReconnection() {
    if (this.isReconnecting) {
      console.log('🔄 Reconnection already in progress...');
      return;
    }

    this.isReconnecting = true;

    try {
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('❌ Max reconnection attempts reached. Database unavailable.');
        this.isReconnecting = false;
        return;
      }

      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff
      
      console.log(`🔄 Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms...`);
      
      await new Promise(resolve => setTimeout(resolve, delay));

      // Close existing connection if it exists
      if (this.pool) {
        try {
          await this.pool.end();
        } catch (e) {
          // Ignore errors when closing existing connection
        }
      }

      // Create new connection
      this.initializeConnection();
      
      // Test the connection
      await this.testConnection();
      
      console.log('✅ Database reconnection successful');
      this.reconnectAttempts = 0; // Reset counter on success
      
    } catch (error: any) {
      console.error(`❌ Reconnection attempt ${this.reconnectAttempts} failed:`, error.message);
    } finally {
      this.isReconnecting = false;
    }
  }

  private async testConnection() {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    
    // Simple test query
    await this.db.execute('SELECT 1');
  }

  public getDb() {
    if (!this.db) {
      throw new Error('Database not available. Connection may be down.');
    }
    return this.db;
  }

  public getPool() {
    if (!this.pool) {
      throw new Error('Database pool not available. Connection may be down.');
    }
    return this.pool;
  }

  public async healthCheck() {
    try {
      await this.testConnection();
      return { status: 'healthy', reconnectAttempts: this.reconnectAttempts };
    } catch (error: any) {
      return { status: 'unhealthy', error: error.message, reconnectAttempts: this.reconnectAttempts };
    }
  }
}

// Create singleton instance
const dbManager = new DatabaseManager();

// Export the database instance through the manager
export const pool = dbManager.getPool();
export const db = dbManager.getDb();
export const dbHealthCheck = () => dbManager.healthCheck();