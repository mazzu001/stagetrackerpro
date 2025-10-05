import type { Express, RequestHandler } from "express";
import { auth } from "./firebase";
import { firebaseUserStorage } from "./firebaseStorage";

// Firebase Auth middleware
export const isAuthenticated: RequestHandler = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(' ')[1];
    
    // Verify the Firebase ID token
    const decodedToken = await auth.verifyIdToken(token);
    
    // Add user info to request object (compatible with existing code)
    (req as any).user = {
      claims: {
        sub: decodedToken.uid,
        email: decodedToken.email,
        first_name: decodedToken.name?.split(' ')[0] || '',
        last_name: decodedToken.name?.split(' ').slice(1).join(' ') || '',
        profile_image_url: decodedToken.picture || null,
      }
    };
    
    // Ensure user exists in Firestore
    let user = await firebaseUserStorage.getUser(decodedToken.uid);
    if (!user) {
      // Create user if doesn't exist
      user = await firebaseUserStorage.upsertUser({
        id: decodedToken.uid,
        email: decodedToken.email || '',
        firstName: decodedToken.name?.split(' ')[0] || null,
        lastName: decodedToken.name?.split(' ').slice(1).join(' ') || null,
        profileImageUrl: decodedToken.picture || null,
        subscriptionStatus: 1, // Default to free tier
      });
    }
    
    next();
  } catch (error: any) {
    console.error('Firebase auth error:', error);
    return res.status(401).json({ message: "Invalid token" });
  }
};

// Setup Firebase auth (replaces Replit auth setup)
export async function setupFirebaseAuth(app: Express) {
  try {
    console.log('🔥 Setting up Firebase authentication...');
    
    // Firebase auth routes
    app.post('/api/auth/verify-token', async (req, res) => {
      try {
        const { token } = req.body;
        
        if (!token) {
          return res.status(400).json({ error: 'Token is required' });
        }
        
        const decodedToken = await auth.verifyIdToken(token);
        
        // Get or create user
        let user = await firebaseUserStorage.getUser(decodedToken.uid);
        if (!user) {
          user = await firebaseUserStorage.upsertUser({
            id: decodedToken.uid,
            email: decodedToken.email || '',
            firstName: decodedToken.name?.split(' ')[0] || null,
            lastName: decodedToken.name?.split(' ').slice(1).join(' ') || null,
            profileImageUrl: decodedToken.picture || null,
            subscriptionStatus: 1,
          });
        }
        
        const userType = user.subscriptionStatus === 1 ? 'free' : 
                        user.subscriptionStatus === 2 ? 'premium' : 'professional';
        
        res.json({
          success: true,
          user: {
            id: user.id,
            email: user.email,
            userType: userType,
            firstName: user.firstName,
            lastName: user.lastName,
            profileImageUrl: user.profileImageUrl,
          }
        });
      } catch (error: any) {
        console.error('Token verification error:', error);
        res.status(401).json({ error: 'Invalid token' });
      }
    });
    
    // Legacy logout endpoint (Firebase handles logout client-side)
    app.get('/api/logout', (req, res) => {
      res.json({ message: 'Logout handled client-side by Firebase' });
    });
    
    console.log('✅ Firebase authentication setup completed');
  } catch (error: any) {
    console.error('❌ Firebase authentication setup failed:', error);
    throw error;
  }
}