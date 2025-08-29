// Test script to create users with different subscription levels
import { Pool } from '@neondatabase/serverless';

async function createTestUsers() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    // Create a paid test user
    await pool.query(`
      INSERT INTO users (id, email, first_name, last_name, subscription_status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      ON CONFLICT (email) DO UPDATE SET
        subscription_status = $5,
        updated_at = NOW()
    `, ['test_paid_user', 'paid@test.com', 'Paid', 'User', 2]);
    
    // Create a professional test user
    await pool.query(`
      INSERT INTO users (id, email, first_name, last_name, subscription_status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      ON CONFLICT (email) DO UPDATE SET
        subscription_status = $5,
        updated_at = NOW()
    `, ['test_pro_user', 'pro@test.com', 'Pro', 'User', 3]);
    
    console.log('✅ Test users created successfully:');
    console.log('📧 paid@test.com (password: test123) - Premium subscription');
    console.log('📧 pro@test.com (password: test123) - Professional subscription');
    console.log('📧 brooke@mnb.com (password: demo123) - Free subscription');
    
  } catch (error) {
    console.error('❌ Error creating test users:', error);
  } finally {
    await pool.end();
  }
}

createTestUsers();