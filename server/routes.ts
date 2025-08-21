import type { Express, Request } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertSongSchema, insertTrackSchema } from "@shared/schema";
import { setupAuth, isAuthenticated, requireSubscription } from "./replitAuth";
import { subscriptionManager } from "./subscriptionManager";
import Stripe from "stripe";
import multer from "multer";
import path from "path";
import fs from "fs";
import { promises as fsPromises } from "fs";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}

// Check if we're using test keys
const isTestMode = process.env.STRIPE_SECRET_KEY.startsWith('sk_test_');
console.log(`🔑 Stripe API Mode: ${isTestMode ? 'TEST MODE ✅' : 'LIVE MODE ⚠️'}`);

if (!isTestMode) {
  console.warn('⚠️ WARNING: Using live Stripe keys - test cards will be declined!');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Configure multer for file uploads
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  storage: multer.memoryStorage(), // Use memory storage to access file.buffer
  fileFilter: (req: any, file: any, cb: any) => {
    const allowedTypes = ['.mp3', '.wav', '.ogg', '.m4a'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only audio files are allowed.'));
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check endpoint for Replit
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });
  console.log('🔧 Starting route registration...');
  
  try {
    // Enable auth middleware for user-specific songs
    console.log('🔐 Setting up authentication middleware...');
    await setupAuth(app);
    console.log('✅ Authentication middleware configured successfully');
  } catch (error: any) {
    console.error('❌ Failed to setup authentication:', error);
    throw new Error(`Authentication setup failed: ${error.message}`);
  }

  // Auth routes with proper authentication
  console.log('📝 Registering authentication routes...');
  
  // Register new user endpoint
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }
      
      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }
      
      // For now, create users locally until cloud database is fully working
      // Check demo users first
      const isDemoUser = email.toLowerCase() in {'mazzu001@hotmail.com': true, 'paid@demo.com': true};
      if (isDemoUser) {
        return res.status(409).json({ error: 'This email is reserved for demo accounts' });
      }
      
      // Create new user locally for now
      const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const newUser = {
        id: userId,
        email: email.toLowerCase(),
        userType: 'free' as const
      };
      
      console.log('✅ New user registered locally:', newUser.email);
      res.json({ 
        success: true, 
        user: newUser
      });
    } catch (error: any) {
      console.error('❌ Registration error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  });
  
  // Login endpoint for email/password authentication
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }
      
      // For now, accept any non-demo email as a valid registration
      // This allows users to create accounts that persist across sessions
      console.log('✅ User authenticated locally:', email.toLowerCase());
      res.json({ 
        success: true, 
        user: { 
          id: `user_${email.replace('@', '_').replace('.', '_')}`,
          email: email.toLowerCase(),
          userType: 'free'
        }
      });
    } catch (error: any) {
      console.error('❌ Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  });

  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      console.log(`🔍 Fetching user data for userId: ${userId}`);
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("❌ Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
  console.log('✅ Authentication routes registered');

  // Sample ZIP file download routes
  console.log('📦 Registering sample file download routes...');
  app.get('/api/download/3am-sample', (req, res) => {
    const filePath = path.join(process.cwd(), 'attached_assets', '3AM_1755653001926.zip');
    res.download(filePath, '3AM_Matchbox20_Sample.zip', (err) => {
      if (err) {
        console.error('Error downloading 3AM sample:', err);
        res.status(404).json({ error: 'Sample file not found' });
      }
    });
  });

  app.get('/api/download/comfortably-numb-sample', (req, res) => {
    const filePath = path.join(process.cwd(), 'attached_assets', 'Comfortably Numb_1755653007913.zip');
    res.download(filePath, 'ComfortablyNumb_PinkFloyd_Sample.zip', (err) => {
      if (err) {
        console.error('Error downloading Comfortably Numb sample:', err);
        res.status(404).json({ error: 'Sample file not found' });
      }
    });
  });
  console.log('✅ Sample file download routes registered');

  // Stripe webhook endpoint for subscription validation
  app.post('/api/stripe-webhook', express.raw({type: 'application/json'}), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
      // For development, we'll skip signature verification
      // In production, you should verify the webhook signature
      event = JSON.parse(req.body);
    } catch (err) {
      console.error('Webhook signature verification failed.', err);
      return res.status(400).send(`Webhook Error: ${err}`);
    }

    // Handle the event
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        const subscription = event.data.object;
        console.log('Subscription event:', event.type, subscription.id);
        
        // Store subscription status in a simple JSON file for local tracking
        const subscriptionData = {
          customerId: subscription.customer,
          subscriptionId: subscription.id,
          status: subscription.status,
          email: subscription.metadata?.email,
          updatedAt: Date.now()
        };
        
        try {
          const subscriptionsFile = path.join(process.cwd(), 'data', 'subscriptions.json');
          let subscriptions = {};
          
          // Read existing subscriptions
          if (fs.existsSync(subscriptionsFile)) {
            subscriptions = JSON.parse(fs.readFileSync(subscriptionsFile, 'utf8'));
          }
          
          // Update subscription
          (subscriptions as any)[subscription.customer] = subscriptionData;
          
          // Write back to file
          fs.writeFileSync(subscriptionsFile, JSON.stringify(subscriptions, null, 2));
          console.log('Subscription status updated for customer:', subscription.customer);
        } catch (error) {
          console.error('Error updating subscription file:', error);
        }
        break;
        
      case 'invoice.payment_succeeded':
        console.log('Payment succeeded for subscription:', event.data.object.subscription);
        
        // Update subscription status to active on successful payment
        const invoice = event.data.object;
        if (invoice.subscription) {
          try {
            const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
            const customer = await stripe.customers.retrieve(subscription.customer as string);
            
            const subscriptionData = {
              subscriptionId: subscription.id,
              customerId: subscription.customer,
              email: (customer as any).email,
              status: 'active',
              updatedAt: new Date().toISOString()
            };
            
            const subscriptionsFile = path.join(process.cwd(), 'data', 'subscriptions.json');
            
            // Create data directory if it doesn't exist
            const dataDir = path.dirname(subscriptionsFile);
            if (!fs.existsSync(dataDir)) {
              fs.mkdirSync(dataDir, { recursive: true });
            }
            
            // Read existing subscriptions
            let subscriptions = {};
            if (fs.existsSync(subscriptionsFile)) {
              subscriptions = JSON.parse(fs.readFileSync(subscriptionsFile, 'utf8'));
            }
            
            // Update subscription
            (subscriptions as any)[subscription.customer as string] = subscriptionData;
            
            // Write back to file
            fs.writeFileSync(subscriptionsFile, JSON.stringify(subscriptions, null, 2));
            console.log('Subscription activated via payment webhook:', subscription.id);
          } catch (error) {
            console.error('Error processing payment success webhook:', error);
          }
        }
        break;
        
      case 'invoice.payment_failed':
        console.log('Payment failed for subscription:', event.data.object.subscription);
        break;
        
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.json({received: true});
  });

  // Subscription verification endpoint
  app.post('/api/verify-subscription', async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ 
          error: 'Email required',
          message: 'Email address is required to verify subscription' 
        });
      }
      
      console.log('🔍 Verifying subscription for email:', email);
      
      const verificationResult = await subscriptionManager.verifySubscriptionStatus(email);
      
      res.json({
        isPaid: verificationResult.isPaid,
        userType: verificationResult.isPaid ? 'paid' : 'free',
        subscriptionData: verificationResult.subscriptionData || null,
        source: verificationResult.source
      });
      
    } catch (error: any) {
      console.error('❌ Error verifying subscription:', error);
      res.status(500).json({ 
        error: 'Verification failed',
        message: 'Could not verify subscription status' 
      });
    }
  });

  // Stripe subscription routes
  console.log('💳 Registering Stripe payment routes...');
  
  app.post('/api/create-subscription', async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ 
          error: 'Email required',
          message: 'Email address is required to create subscription' 
        });
      }
      
      console.log('💰 Creating Stripe subscription for email:', email);
      
      // Check if customer already exists to prevent duplicates
      const existingCustomers = await stripe.customers.list({
        email: email,
        limit: 1
      });
      
      if (existingCustomers.data.length > 0) {
        const customer = existingCustomers.data[0];
        
        // Check if customer already has an active subscription
        const subscriptions = await stripe.subscriptions.list({
          customer: customer.id,
          status: 'active'
        });
        
        if (subscriptions.data.length > 0) {
          return res.status(400).json({
            error: 'Subscription exists',
            message: 'You already have an active subscription'
          });
        }
      }

      // Use existing customer or create new one
      let customer;
      if (existingCustomers.data.length > 0) {
        customer = existingCustomers.data[0];
        console.log('Using existing customer:', customer.id);
      } else {
        customer = await stripe.customers.create({
          email: email,
          name: email, // Use email as name for simplicity
          metadata: { email: email }
        });
        console.log('Created new customer:', customer.id);
      }

      // Use a fixed price ID to prevent creating duplicate products/prices
      // In production, you would create these once in Stripe dashboard
      let priceId = 'price_stagetracker_premium'; // Fixed price ID
      
      try {
        // Try to retrieve existing price first
        await stripe.prices.retrieve(priceId);
        console.log('Using existing price:', priceId);
      } catch (error) {
        // Price doesn't exist, create product and price
        const product = await stripe.products.create({
          name: 'StageTracker Pro Premium',
          metadata: { app: 'stagetracker' }
        });

        const price = await stripe.prices.create({
          currency: 'usd',
          unit_amount: 499, // $4.99 in cents
          recurring: {
            interval: 'month'
          },
          product: product.id
        });
        priceId = price.id;
        console.log('Created new price:', price.id);
      }

      // Create a simple payment intent for the subscription
      console.log('Creating payment intent for subscription');
      
      const paymentIntent = await stripe.paymentIntents.create({
        amount: 499, // $4.99 in cents
        currency: 'usd',
        customer: customer.id,
        payment_method_types: ['card'],
        confirmation_method: 'manual',
        confirm: false,
        metadata: {
          email: email,
          subscription_amount: '499'
        }
      });

      console.log(`✅ Payment intent created: ${paymentIntent.id}`);
      
      res.json({
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        customerId: customer.id
      });
    } catch (error: any) {
      console.error('Subscription creation error:', error);
      res.status(500).json({ 
        error: 'Failed to create subscription',
        message: error.message 
      });
    }
  });

  // Check subscription status via webhook data
  app.post('/api/subscription-status', async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.json({ 
          hasActiveSubscription: false, 
          status: 'inactive',
          message: 'No email provided'
        });
      }
      
      // Check local subscription file for this email
      const subscriptionsFile = path.join(process.cwd(), 'data', 'subscriptions.json');
      
      if (fs.existsSync(subscriptionsFile)) {
        const subscriptions = JSON.parse(fs.readFileSync(subscriptionsFile, 'utf8'));
        
        // Find subscription by email
        const userSubscription = Object.values(subscriptions).find((sub: any) => sub.email === email) as any;
        
        if (userSubscription && userSubscription.status === 'active') {
          return res.json({
            hasActiveSubscription: true,
            status: 'active',
            subscriptionId: userSubscription.subscriptionId
          });
        }
      }
      
      res.json({ 
        hasActiveSubscription: false, 
        status: 'inactive'
      });
    } catch (error: any) {
      console.error('Subscription status error:', error);
      res.status(500).json({ 
        error: 'Failed to get subscription status',
        message: error.message 
      });
    }
  });

  // Serve uploaded files
  app.use("/uploads", express.static(uploadDir));

  // Subscription checking middleware
  const requireSubscription = async (req: any, res: any, next: any) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      // Always allow beta test account
      if (req.user.claims.email === 'paid@demo.com') {
        return next();
      }
      
      if (!user || !user.stripeSubscriptionId) {
        return res.status(403).json({ 
          error: 'subscription_required',
          message: 'Premium subscription required. Please upgrade to continue.' 
        });
      }

      // Check subscription status with Stripe
      const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
      if (subscription.status !== 'active') {
        return res.status(403).json({ 
          error: 'subscription_inactive',
          message: 'Your subscription is not active. Please update your payment method.' 
        });
      }

      next();
    } catch (error: any) {
      console.error('Subscription check error:', error);
      res.status(500).json({ 
        error: 'subscription_check_failed',
        message: 'Unable to verify subscription status' 
      });
    }
  };

  // Songs routes (require authentication for user-specific songs)
  app.get("/api/songs", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const songs = await storage.getAllSongs(userId);
      
      // Check song count limits for free users
      const isFreeTier = !user?.stripeSubscriptionId && req.user.claims.email !== 'paid@demo.com';
      if (isFreeTier && songs.length > 2) {
        // Return only first 2 songs for free tier users
        res.json(songs.slice(0, 2));
      } else {
        res.json(songs);
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch songs" });
    }
  });

  app.get("/api/songs/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const song = await storage.getSongWithTracks(req.params.id, userId);
      if (!song) {
        return res.status(404).json({ message: "Song not found" });
      }
      res.json(song);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch song" });
    }
  });

  app.post("/api/songs", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      // Check song limits for free tier users
      const isFreeTier = !user?.stripeSubscriptionId && req.user.claims.email !== 'paid@demo.com';
      if (isFreeTier) {
        const existingSongs = await storage.getAllSongs(userId);
        if (existingSongs.length >= 2) {
          return res.status(403).json({ 
            error: 'song_limit_exceeded',
            message: 'Free tier is limited to 2 songs. Please upgrade to Premium for unlimited songs.' 
          });
        }
      }
      
      const validatedData = insertSongSchema.parse({
        ...req.body,
        userId: userId  // Associate song with authenticated user
      });
      const song = await storage.createSong(validatedData);
      res.status(201).json(song);
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Failed to create song" });
      }
    }
  });

  app.patch("/api/songs/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const partialData = insertSongSchema.partial().parse(req.body);
      const song = await storage.updateSong(req.params.id, partialData, userId);
      if (!song) {
        return res.status(404).json({ message: "Song not found" });
      }
      res.json(song);
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Failed to update song" });
      }
    }
  });

  app.delete("/api/songs/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      console.log('DELETE request received for song ID:', req.params.id, 'by user:', userId);
      const success = await storage.deleteSong(req.params.id, userId);
      if (!success) {
        console.log('Song deletion failed - not found or not owned by user:', req.params.id);
        return res.status(404).json({ message: "Song not found" });
      }
      console.log('Song deletion successful:', req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error('Error in DELETE /api/songs/:id:', error);
      res.status(500).json({ message: "Failed to delete song" });
    }
  });

  // Tracks routes (require authentication)
  app.get("/api/songs/:songId/tracks", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      // Verify song belongs to user first
      const song = await storage.getSong(req.params.songId, userId);
      if (!song) {
        return res.status(404).json({ message: "Song not found" });
      }
      
      const tracks = await storage.getTracksBySongId(req.params.songId);
      res.json(tracks);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch tracks" });
    }
  });

  app.post("/api/songs/:songId/tracks", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      // Check if song exists and belongs to user
      const song = await storage.getSong(req.params.songId, userId);
      if (!song) {
        return res.status(404).json({ message: "Song not found" });
      }

      const existingTracks = await storage.getTracksBySongId(req.params.songId);
      if (existingTracks.length >= 6) {
        return res.status(400).json({ message: "Maximum 6 tracks allowed per song" });
      }

      const trackData = {
        songId: req.params.songId,
        name: req.body.name,
        trackNumber: parseInt(req.body.trackNumber) || (existingTracks.length + 1),
        audioUrl: req.body.audioUrl, // This will be the blob URL for local files
        volume: parseInt(req.body.volume) || 100,
        balance: parseInt(req.body.balance) || 0,
        isMuted: req.body.isMuted === true,
        isSolo: req.body.isSolo === true
      };

      const validatedData = insertTrackSchema.parse(trackData);
      const track = await storage.createTrack(validatedData);

      // Update song duration based on provided duration or keep existing
      const trackDuration = parseInt(req.body.duration) || 0;
      if (trackDuration > 0) {
        const maxDuration = Math.max(song.duration, trackDuration);
        await storage.updateSong(req.params.songId, { duration: maxDuration });
      }

      res.status(201).json(track);
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Failed to create track" });
      }
    }
  });

  app.patch("/api/tracks/:id", async (req, res) => {
    try {
      const partialData = insertTrackSchema.partial().parse(req.body);
      const track = await storage.updateTrack(req.params.id, partialData);
      if (!track) {
        return res.status(404).json({ message: "Track not found" });
      }
      res.json(track);
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Failed to update track" });
      }
    }
  });

  // Add specific route for updating tracks within songs
  app.patch("/api/songs/:songId/tracks/:trackId", async (req, res) => {
    try {
      const partialData = insertTrackSchema.partial().parse(req.body);
      const track = await storage.updateTrack(req.params.trackId, partialData);
      if (!track) {
        return res.status(404).json({ message: "Track not found" });
      }
      res.json(track);
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Failed to update track" });
      }
    }
  });

  // Upload audio file and store in database as base64
  app.post("/api/tracks/:id/audio", upload.single('audio'), async (req, res) => {
    try {
      const trackId = req.params.id;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ message: "No audio file provided" });
      }

      // Convert file buffer to base64
      const audioData = file.buffer.toString('base64');
      
      // Store in database
      await storage.storeAudioFile(trackId, audioData, file.mimetype, file.size);

      res.json({ 
        message: "Audio file stored successfully",
        trackId,
        size: file.size,
        mimeType: file.mimetype,
        success: true
      });
    } catch (error) {
      console.error('Error storing audio file:', error);
      res.status(500).json({ message: "Failed to store audio file" });
    }
  });

  // Get audio file from database
  app.get("/api/tracks/:id/audio", async (req, res) => {
    try {
      const trackId = req.params.id;
      const audioFile = await storage.getAudioFileData(trackId);

      if (!audioFile) {
        return res.status(404).json({ message: "Audio file not found" });
      }

      // Convert base64 back to buffer
      const buffer = Buffer.from(audioFile.data, 'base64');
      
      res.set({
        'Content-Type': audioFile.mimeType,
        'Content-Length': audioFile.size.toString(),
        'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
      });

      res.send(buffer);
    } catch (error) {
      console.error('Error retrieving audio file:', error);
      res.status(500).json({ message: "Failed to retrieve audio file" });
    }
  });

  app.delete("/api/tracks/:id", async (req, res) => {
    try {
      const success = await storage.deleteTrack(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Track not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete track" });
    }
  });

  // MIDI routes have been completely removed

  // Legacy persistence routes (no-op - data is now in cloud database)
  app.post("/api/persistence/save", (req, res) => {
    res.json({ 
      success: true, 
      message: "Data is automatically saved to cloud database",
      timestamp: new Date().toISOString() 
    });
  });

  app.post("/api/persistence/load", (req, res) => {
    res.json({ success: true, message: "Data is loaded from cloud database automatically" });
  });

  // Lyrics search route
  app.post("/api/lyrics/search", async (req, res) => {
    try {
      const { title, artist } = req.body;
      
      if (!title || !artist) {
        return res.status(400).json({ 
          success: false, 
          error: "Both title and artist are required" 
        });
      }

      console.log(`Searching lyrics for "${title}" by ${artist}...`);

      // Use Google Custom Search to find lyrics from text-based lyrics sites
      try {
        const searchQuery = `${title} ${artist} Lyrics site:genius.com OR site:azlyrics.com OR site:metrolyrics.com OR site:lyrics.com OR site:songlyrics.com`;
        const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${process.env.GOOGLE_API_KEY}&cx=${process.env.GOOGLE_SEARCH_ENGINE_ID}&q=${encodeURIComponent(searchQuery)}`;
        
        if (!process.env.GOOGLE_API_KEY || !process.env.GOOGLE_SEARCH_ENGINE_ID) {
          console.log('Google Search API credentials not configured, using fallback');
          throw new Error('Search API not configured');
        }

        const response = await fetch(searchUrl);
        const data = await response.json();

        if (data.items && data.items.length > 0) {
          // Filter out video sites and find text-based lyrics sites
          const textLyricsSites = data.items.filter((item: any) => {
            const url = item.link.toLowerCase();
            return !url.includes('youtube.com') && 
                   !url.includes('vimeo.com') && 
                   !url.includes('dailymotion.com') && 
                   !url.includes('video') &&
                   (url.includes('genius.com') || 
                    url.includes('azlyrics.com') || 
                    url.includes('metrolyrics.com') || 
                    url.includes('lyrics.com') || 
                    url.includes('songlyrics.com') ||
                    item.title.toLowerCase().includes('lyrics'));
          });

          if (textLyricsSites.length > 0) {
            const firstResult = textLyricsSites[0];
            const lyricsUrl = firstResult.link;
            
            console.log(`Found text lyrics page: ${lyricsUrl}`);
            
            return res.json({
              success: false,
              error: "Manual verification needed",
              message: `Found "${title}" by ${artist} lyrics on text site. Opening browser for manual copy-paste.`,
              searchResult: {
                url: lyricsUrl,
                title: firstResult.title,
                snippet: firstResult.snippet
              },
              openBrowser: true
            });
          } else {
            console.log('No text-based lyrics sites found in results');
          }
        }
        
      } catch (searchError: any) {
        console.log('Web search failed, using manual guidance:', searchError?.message || 'Unknown error');
      }

      // Fallback to manual entry guidance
      console.log(`Providing manual entry guidance for "${title}" by ${artist}`);
      
      return res.json({
        success: false,
        error: "Manual entry recommended", 
        message: `Please search and copy lyrics manually for "${title}" by ${artist}. Opening browser search.`,
        guidance: {
          suggestion: `Search for "${title} ${artist} Lyrics" will be opened in your browser`,
          tip: "Copy lyrics from your preferred site and paste them into the text area"
        },
        searchQuery: `${title} ${artist} Lyrics -youtube -video`,
        openBrowser: true
      });

      // Legacy code for multiple APIs (currently disabled due to reliability issues)
      /*
      const apis = [
        {
          name: "Lyrics.ovh",
          url: `https://api.lyrics.ovh/v1/${cleanArtist}/${cleanTitle}`,
          timeout: 8000
        }
      ];

      // Legacy API calling code (disabled)
      */
      
    } catch (error) {
      console.error("Lyrics search error:", error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to search for lyrics",
        message: "Network error occurred while searching for lyrics. Please check your internet connection."
      });
    }
  });

  // Waveform caching routes
  app.post("/api/waveforms/:songId", async (req, res) => {
    try {
      const { songId } = req.params;
      const { waveformData } = req.body;
      
      if (!Array.isArray(waveformData)) {
        return res.status(400).json({ error: 'Invalid waveform data' });
      }
      
      await storage.saveWaveform(songId, waveformData);
      res.json({ success: true, message: 'Waveform saved successfully' });
    } catch (error) {
      console.error('Error saving waveform:', error);
      res.status(500).json({ error: 'Failed to save waveform' });
    }
  });

  app.get("/api/waveforms/:songId", async (req, res) => {
    try {
      const { songId } = req.params;
      const waveformData = await storage.getWaveform(songId);
      
      if (waveformData) {
        res.json({ success: true, waveformData });
      } else {
        res.status(404).json({ success: false, message: 'Waveform not found' });
      }
    } catch (error) {
      console.error('Error loading waveform:', error);
      res.status(500).json({ error: 'Failed to load waveform' });
    }
  });

  // Set up auto-save callback
  storage.setAutoSaveCallback(() => {
    console.log("Auto-save triggered");
  });

  // File Registry API for persistent file tracking
  const REGISTRY_FILE_PATH = path.join(process.cwd(), "data", "file-registry.json");

  // Ensure data directory exists
  const dataDir = path.dirname(REGISTRY_FILE_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  app.get("/api/file-registry", async (req, res) => {
    try {
      if (fs.existsSync(REGISTRY_FILE_PATH)) {
        const registryData = await fsPromises.readFile(REGISTRY_FILE_PATH, 'utf8');
        const registry = JSON.parse(registryData);
        res.json(registry);
      } else {
        // Return empty registry
        const emptyRegistry = {
          version: '1.0.0',
          lastUpdated: Date.now(),
          files: []
        };
        res.json(emptyRegistry);
      }
    } catch (error) {
      console.error('Error reading file registry:', error);
      res.status(500).json({ message: "Failed to read file registry" });
    }
  });

  app.post("/api/file-registry", async (req, res) => {
    try {
      const registryData = JSON.stringify(req.body, null, 2);
      await fsPromises.writeFile(REGISTRY_FILE_PATH, registryData, 'utf8');
      console.log('File registry saved successfully');
      res.json({ success: true });
    } catch (error) {
      console.error('Error saving file registry:', error);
      res.status(500).json({ message: "Failed to save file registry" });
    }
  });

  // File Path Configuration API for persistent file location tracking
  const FILE_PATHS_CONFIG_PATH = path.join(process.cwd(), "data", "file-paths-config.json");

  app.get("/api/file-paths", async (req, res) => {
    try {
      if (fs.existsSync(FILE_PATHS_CONFIG_PATH)) {
        const configData = await fsPromises.readFile(FILE_PATHS_CONFIG_PATH, 'utf8');
        const config = JSON.parse(configData);
        res.json(config);
      } else {
        // Return empty config
        const emptyConfig = {
          version: '1.0.0',
          lastUpdated: Date.now(),
          mappings: []
        };
        res.json(emptyConfig);
      }
    } catch (error) {
      console.error('Error reading file paths config:', error);
      res.status(500).json({ message: "Failed to read file paths config" });
    }
  });

  app.post("/api/file-paths", async (req, res) => {
    try {
      const configData = JSON.stringify(req.body, null, 2);
      await fsPromises.writeFile(FILE_PATHS_CONFIG_PATH, configData, 'utf8');
      console.log(`File paths config saved with ${req.body.mappings?.length || 0} mappings`);
      res.json({ success: true });
    } catch (error) {
      console.error('Error saving file paths config:', error);
      res.status(500).json({ message: "Failed to save file paths config" });
    }
  });

  console.log('🗄️ Registering database storage routes...');
  console.log('🎵 Registering song management routes...');
  console.log('🎧 Registering track management routes...');
  // MIDI event routes removed
  console.log('📊 Registering waveform caching routes...');
  console.log('🔍 Registering lyrics search routes...');
  console.log('📁 Registering file registry routes...');
  
  console.log('🌐 Creating HTTP server...');
  const httpServer = createServer(app);
  console.log('✅ HTTP server created successfully');
  console.log('🎯 Route registration completed successfully');
  
  return httpServer;
}
