import type { Express, RequestHandler } from "express";

// Mock Auth middleware for beta testing
export const mockAuthenticated: RequestHandler = async (req, res, next) => {
  try {
    console.log('🧪 BETA TESTING: Using mock authentication middleware');
    
    // Check for any user email from sessionStorage (set by frontend)
    const userEmail = req.headers['x-user-email'] || 'beta@test.com';
    
    // Add mock user info to request object (compatible with existing code)
    (req as any).user = {
      claims: {
        sub: `mock-user-${Date.now()}`, // Unique user ID
        email: userEmail,
        first_name: 'Beta',
        last_name: 'Tester',
        profile_image_url: null,
      }
    };
    
    console.log(`🧪 BETA TESTING: Mock user authenticated - ${userEmail} with professional tier access`);
    next();
  } catch (error: any) {
    console.error('Mock auth error:', error);
    return res.status(401).json({ message: "Mock auth failed" });
  }
};

// Setup mock authentication for beta testing
export async function setupMockAuth(app: Express) {
  try {
    console.log('🧪 Setting up MOCK authentication for beta testing...');
    
    // Mock auth verification endpoint
    app.post('/api/auth/verify-token', async (req, res) => {
      console.log('🧪 BETA TESTING: Mock token verification - granting professional access');
      
      res.json({
        success: true,
        user: {
          id: `mock-user-${Date.now()}`,
          email: 'beta@test.com',
          userType: 'professional', // Always professional for beta testing
          firstName: 'Beta',
          lastName: 'Tester',
          profileImageUrl: null,
        }
      });
    });
    
    // Mock logout endpoint
    app.get('/api/logout', (req, res) => {
      res.json({ message: 'Mock logout successful' });
    });
    
    console.log('✅ MOCK authentication setup completed - all users get professional access');
  } catch (error: any) {
    console.error('❌ Mock authentication setup failed:', error);
    throw error;
  }
}