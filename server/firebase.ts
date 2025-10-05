import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

// Service account for admin operations
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY 
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
  : null;

// Initialize Firebase Admin SDK
let app;
if (getApps().length === 0) {
  if (serviceAccount) {
    app = initializeApp({
      credential: cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID,
    });
  } else {
    // Fallback for development - requires GOOGLE_APPLICATION_CREDENTIALS
    app = initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID,
    });
  }
} else {
  app = getApps()[0];
}

// Export initialized services
export const firestore = getFirestore(app);
export const auth = getAuth(app);
export const firebaseApp = app;

// Health check for Firebase connection
export async function firebaseHealthCheck() {
  try {
    // Test Firestore connection
    await firestore.doc('health/check').get();
    return { status: 'healthy', service: 'firebase' };
  } catch (error: any) {
    return { status: 'unhealthy', service: 'firebase', error: error.message };
  }
}

console.log('🔥 Firebase Admin SDK initialized');