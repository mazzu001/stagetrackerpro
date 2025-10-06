import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import bcrypt from "bcrypt";
import { storage } from "./storage";
import { insertSongSchema, insertTrackSchema, broadcastSessions, broadcastSongs } from "@shared/schema";
import { eq, sql, desc } from "drizzle-orm";
import { db } from "./db";
// Authentication removed - mobile app model
// import { setupFirebaseAuth, isAuthenticated } from "./firebaseAuth";
// import { setupMockAuth, mockAuthenticated } from "./mockAuth";

// Mobile app mode - no authentication needed
// const BETA_TESTING_MODE = true;
// const authMiddleware = BETA_TESTING_MODE ? mockAuthenticated : isAuthenticated;
import { subscriptionManager } from "./subscriptionManager";
import { setupBroadcastCleanup } from "./broadcast-utils";
import Stripe from "stripe";
import multer from "multer";
import path from "path";
import fs from "fs";
import { promises as fsPromises } from "fs";

let stripe: Stripe | null = null;
let isStripeEnabled = false;
let isTestMode = false;

if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY !== 'placeholder_for_deployment') {
  try {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    isStripeEnabled = true;
    isTestMode = process.env.STRIPE_SECRET_KEY.startsWith('sk_test_');
    console.log(`🔑 Stripe API Mode: ${isTestMode ? 'TEST MODE ✅' : 'LIVE MODE ⚠️'}`);
    
    if (!isTestMode) {
      console.warn('⚠️ WARNING: Using live Stripe keys - test cards will be declined!');
    }
    console.log('✅ Stripe initialized successfully for payments');
  } catch (error: any) {
    console.error('❌ Failed to initialize Stripe for payments:', error.message);
    console.log('🔧 Payment features will be disabled');
  }
} else {
  console.log('⚠️ STRIPE_SECRET_KEY not available - payment features disabled');
  console.log('💡 For production deployment, ensure STRIPE_SECRET_KEY is properly configured');
}

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


  // Webhook handler functions
  async function handleSubscriptionChange(subscription: any) {
    try {
      // Find user by Stripe customer ID
      const user = await storage.getUserByStripeCustomerId(subscription.customer);
      if (!user) {
        console.log(`⚠️ User not found for customer ID: ${subscription.customer}`);
        return;
      }

      let newStatus = 1; // Default to free
      
      switch (subscription.status) {
        case 'active':
        case 'trialing':
          newStatus = 2; // Premium
          break;
        case 'past_due':
        case 'canceled':
        case 'incomplete':
        case 'incomplete_expired':
        case 'unpaid':
          newStatus = 1; // Free
          break;
      }

      // Update user subscription status
      await storage.updateUserSubscription(user.id, {
        subscriptionStatus: newStatus,
        subscriptionEndDate: subscription.current_period_end ? 
          new Date(subscription.current_period_end * 1000).toISOString() : null
      });

      console.log(`✅ Updated user ${user.email} subscription status: ${newStatus}`);
    } catch (error) {
      console.error('❌ Error handling subscription change:', error);
    }
  }

  async function handleSubscriptionDeleted(subscription: any) {
    try {
      // Find user by Stripe customer ID
      const user = await storage.getUserByStripeCustomerId(subscription.customer);
      if (!user) {
        console.log(`⚠️ User not found for customer ID: ${subscription.customer}`);
        return;
      }

      // Set user to free tier
      await storage.updateUserSubscription(user.id, {
        subscriptionStatus: 1, // Free
        subscriptionEndDate: null
      });

      console.log(`✅ Subscription cancelled for user ${user.email}, set to free tier`);
    } catch (error) {
      console.error('❌ Error handling subscription deletion:', error);
    }
  }

  async function handlePaymentFailed(invoice: any) {
    try {
      if (!invoice.subscription) return;

      // Get subscription details
      const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
      const user = await storage.getUserByStripeCustomerId(subscription.customer as string);
      
      if (!user) {
        console.log(`⚠️ User not found for customer ID: ${subscription.customer}`);
        return;
      }

      // Set user to free tier on payment failure
      await storage.updateUserSubscription(user.id, {
        subscriptionStatus: 1, // Free
        subscriptionEndDate: null
      });

      console.log(`💳 Payment failed for user ${user.email}, downgraded to free tier`);
      
      // Log the failure reason
      const paymentIntent = invoice.payment_intent;
      if (paymentIntent) {
        console.log(`💳 Payment failure reason: ${paymentIntent.last_payment_error?.message || 'Unknown'}`);
      }
    } catch (error) {
      console.error('❌ Error handling payment failure:', error);
    }
  }

  async function handlePaymentSucceeded(invoice: any) {
    try {
      if (!invoice.subscription) return;

      // Get subscription details
      const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
      const user = await storage.getUserByStripeCustomerId(subscription.customer as string);
      
      if (!user) {
        console.log(`⚠️ User not found for customer ID: ${subscription.customer}`);
        return;
      }

      // Update user to premium tier on successful payment
      await storage.updateUserSubscription(user.id, {
        subscriptionStatus: 2, // Premium
        subscriptionEndDate: subscription.current_period_end ? 
          new Date(subscription.current_period_end * 1000).toISOString() : null
      });

      console.log(`✅ Payment succeeded for user ${user.email}, upgraded to premium`);
    } catch (error) {
      console.error('❌ Error handling payment success:', error);
    }
  }

  async function handleCheckoutCompleted(session: any) {
    try {
      console.log(`🎯 Processing checkout completion for session: ${session.id}`);
      
      // Find user by Stripe customer ID
      const user = await storage.getUserByStripeCustomerId(session.customer);
      if (!user) {
        console.log(`⚠️ User not found for customer ID: ${session.customer}`);
        return;
      }

      // Get the subscription from Stripe
      if (session.subscription) {
        const subscription = await stripe.subscriptions.retrieve(session.subscription);
        console.log(`📋 Retrieved subscription: ${subscription.id} (${subscription.status})`);
        
        // Determine subscription tier from amount or metadata
        let newStatus = 2; // Default to premium
        if (session.amount_total >= 699) { // $6.99 or higher = professional
          newStatus = 3; // Professional
        }

        // Update user subscription status immediately after checkout
        await storage.updateUserSubscription(user.id, {
          subscriptionStatus: newStatus,
          stripeSubscriptionId: subscription.id,
          subscriptionEndDate: subscription.current_period_end ? 
            new Date(subscription.current_period_end * 1000).toISOString() : null
        });

        console.log(`✅ Checkout completed: Updated user ${user.email} subscription status: ${newStatus} (${newStatus === 3 ? 'Professional' : 'Premium'})`);
      } else {
        console.log(`⚠️ No subscription found in checkout session: ${session.id}`);
      }
    } catch (error) {
      console.error('❌ Error handling checkout completion:', error);
    }
  }

  // Simple subscription status update (for Stripe redirect success)
  app.post('/api/update-subscription-status', async (req, res) => {
    try {
      const { email, subscriptionStatus } = req.body;
      if (!email || !subscriptionStatus) {
        return res.status(400).json({ error: 'Email and subscription status are required' });
      }

      console.log(`🔄 Updating subscription status for ${email} to ${subscriptionStatus}`);
      
      // Get user from database
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Update user subscription status directly
      await storage.updateUserSubscription(user.id, {
        subscriptionStatus: subscriptionStatus,
        subscriptionEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days from now
      });

      const statusName = subscriptionStatus === 3 ? 'Professional' : subscriptionStatus === 2 ? 'Premium' : 'Free';
      console.log(`✅ Updated ${email} subscription status: ${subscriptionStatus} (${statusName})`);

      res.json({ 
        success: true, 
        newStatus: subscriptionStatus,
        statusName
      });
    } catch (error) {
      console.error('❌ Error updating subscription status:', error);
      res.status(500).json({ error: 'Failed to update subscription status' });
    }
  });

  // Force refresh single user subscription status
  app.post('/api/force-refresh-subscription', async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }

      console.log(`🔄 Force refreshing subscription for: ${email}`);
      
      // Get user from database
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (!user.stripeCustomerId) {
        return res.status(400).json({ error: 'User has no Stripe customer ID' });
      }

      // Get all subscriptions for this customer
      const subscriptions = await stripe.subscriptions.list({
        customer: user.stripeCustomerId,
        status: 'all',
        limit: 10
      });

      console.log(`📋 Found ${subscriptions.data.length} subscriptions for customer: ${user.stripeCustomerId}`);

      let newStatus = 1; // Default to free
      let activeSubscription = null;

      // Find the most recent active subscription
      for (const subscription of subscriptions.data) {
        console.log(`📋 Subscription ${subscription.id}: ${subscription.status} (${subscription.items.data[0]?.price?.unit_amount || 0})`);
        
        if (subscription.status === 'active' || subscription.status === 'trialing') {
          activeSubscription = subscription;
          // Determine tier based on price
          const priceAmount = subscription.items.data[0]?.price?.unit_amount || 0;
          if (priceAmount >= 699) { // $6.99 or more = Professional
            newStatus = 3;
          } else if (priceAmount > 0) { // Any payment = Premium
            newStatus = 2;
          }
          break; // Use the first active subscription
        }
      }

      // Update user subscription status
      await storage.updateUserSubscription(user.id, {
        subscriptionStatus: newStatus,
        stripeSubscriptionId: activeSubscription?.id || null,
        subscriptionEndDate: activeSubscription?.current_period_end ? 
          new Date(activeSubscription.current_period_end * 1000).toISOString() : null
      });

      const statusName = newStatus === 3 ? 'Professional' : newStatus === 2 ? 'Premium' : 'Free';
      console.log(`✅ Updated ${email} subscription status: ${newStatus} (${statusName})`);

      res.json({ 
        success: true, 
        oldStatus: user.subscriptionStatus,
        newStatus,
        statusName,
        activeSubscription: activeSubscription?.id || null
      });
    } catch (error) {
      console.error('❌ Error forcing subscription refresh:', error);
      res.status(500).json({ error: 'Failed to refresh subscription status' });
    }
  });

  // Manual subscription status check endpoint
  app.post('/api/check-subscriptions', async (req, res) => {
    try {
      console.log('🔍 Manual subscription status check triggered');
      
      // Get all users with subscriptions
      const users = await storage.getAllUsersWithSubscriptions();
      const results = [];
      
      for (const user of users) {
        if (!user.stripeSubscriptionId) continue;
        
        try {
          // Get subscription from Stripe
          const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId, {
            expand: ['latest_invoice', 'latest_invoice.payment_intent']
          });
          
          let status = 'unknown';
          let needsUpdate = false;
          let newStatus = user.subscriptionStatus;
          
          switch (subscription.status) {
            case 'active':
              status = 'Active';
              newStatus = 2; // Premium
              break;
            case 'trialing':
              status = 'Trial';
              newStatus = 2; // Premium
              break;
            case 'past_due':
              status = 'Payment Past Due';
              newStatus = 1; // Free
              needsUpdate = true;
              break;
            case 'canceled':
              status = 'Cancelled';
              newStatus = 1; // Free
              needsUpdate = true;
              break;
            case 'incomplete':
            case 'incomplete_expired':
              status = 'Payment Incomplete';
              newStatus = 1; // Free
              needsUpdate = true;
              break;
            case 'unpaid':
              status = 'Unpaid';
              newStatus = 1; // Free
              needsUpdate = true;
              break;
          }
          
          // Check if subscription has expired
          const currentPeriodEnd = subscription.current_period_end * 1000;
          const now = Date.now();
          if (currentPeriodEnd < now && subscription.status !== 'canceled') {
            status = 'Expired';
            newStatus = 1; // Free
            needsUpdate = true;
          }
          
          // Update if needed
          if (needsUpdate && user.subscriptionStatus !== newStatus) {
            await storage.updateUserSubscription(user.id, {
              subscriptionStatus: newStatus,
              subscriptionEndDate: subscription.current_period_end ? 
                new Date(subscription.current_period_end * 1000).toISOString() : null
            });
            console.log(`✅ Updated ${user.email}: ${user.subscriptionStatus} → ${newStatus}`);
          }
          
          results.push({
            email: user.email,
            subscriptionId: user.stripeSubscriptionId,
            stripeStatus: subscription.status,
            readableStatus: status,
            currentDbStatus: newStatus,
            previousDbStatus: user.subscriptionStatus,
            updated: needsUpdate,
            expiresAt: subscription.current_period_end ? 
              new Date(subscription.current_period_end * 1000).toISOString() : null
          });
          
        } catch (error: any) {
          if (error.code === 'resource_missing') {
            await storage.updateUserSubscription(user.id, {
              subscriptionStatus: 1,
              subscriptionEndDate: null
            });
            results.push({
              email: user.email,
              subscriptionId: user.stripeSubscriptionId,
              error: 'Subscription not found in Stripe',
              currentDbStatus: 1,
              previousDbStatus: user.subscriptionStatus,
              updated: true
            });
          } else {
            results.push({
              email: user.email,
              subscriptionId: user.stripeSubscriptionId,
              error: error.message
            });
          }
        }
      }
      
      res.json({
        success: true,
        checked: results.length,
        results: results
      });
      
    } catch (error: any) {
      console.error('❌ Error in manual subscription check:', error);
      res.status(500).json({ error: 'Failed to check subscriptions' });
    }
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
      
      // First check database for subscription status
      const user = await storage.getUserByEmail(email);
      
      if (user && user.subscriptionStatus) {
        const status = parseInt(user.subscriptionStatus as any);
        console.log('🔍 Database subscription status:', status);
        
        let userType = 'free';
        let isPaid = false;
        
        switch (status) {
          case 1:
            userType = 'free';
            isPaid = false;
            break;
          case 2:
            userType = 'premium';
            isPaid = true;
            break;
          case 3:
            userType = 'professional';
            isPaid = true;
            break;
          default:
            userType = 'free';
            isPaid = false;
        }
        
        console.log('🔍 Final userType:', userType);
        
        return res.json({
          isPaid: isPaid,
          userType: userType,
          subscriptionData: { status: status },
          source: 'database'
        });
      }
      
      // Fallback to subscription manager if no database record
      const verificationResult = await subscriptionManager.verifySubscriptionStatus(email);
      
      res.json({
        isPaid: verificationResult.isPaid,
        userType: verificationResult.isPaid ? 'premium' : 'free',
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
      let priceId = 'price_1RygaOK3Nj4A0Az4jtovDojK'; // Real premium price ID
      
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

  // Create Stripe Checkout Session (redirect-based payment)
  app.post('/api/create-checkout-session', async (req, res) => {
    try {
      const { email, tier, priceAmount, successUrl, cancelUrl } = req.body;
      
      if (!email || !tier || !priceAmount) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      console.log(`💳 Creating Stripe Checkout Session for: ${email}, tier: ${tier}, amount: ${priceAmount}`);

      // Find or create customer
      let customer;
      const existingCustomers = await stripe.customers.list({ email, limit: 1 });
      
      if (existingCustomers.data.length > 0) {
        customer = existingCustomers.data[0];
        console.log('Using existing customer:', customer.id);
      } else {
        customer = await stripe.customers.create({
          email,
          name: email,
          metadata: { email }
        });
        console.log('Created new customer:', customer.id);
      }

      // Create checkout session
      const session = await stripe.checkout.sessions.create({
        customer: customer.id,
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: `StageTracker Pro - ${tier.charAt(0).toUpperCase() + tier.slice(1)}`,
                description: `${tier === 'premium' ? '$4.99' : '$6.99'}/month subscription`,
              },
              unit_amount: priceAmount,
              recurring: {
                interval: 'month',
              },
            },
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: `${successUrl}?redirect_status=succeeded&email=${encodeURIComponent(email)}&tier=${tier}`,
        cancel_url: cancelUrl,
        metadata: {
          email,
          tier
        }
      });

      console.log(`✅ Checkout session created: ${session.id}`);
      
      res.json({
        url: session.url
      });
    } catch (error: any) {
      console.error('Checkout session creation error:', error);
      res.status(500).json({ 
        error: 'Failed to create checkout session',
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

  // Songs routes - mobile app mode, no authentication needed
  app.get("/api/songs", async (req: any, res) => {
    try {
      // Mobile app mode - use static local user
      const userId = 'local_user';
      const user = { userType: 'professional', isPaidUser: true };
      const songs = await storage.getAllSongs(userId);
      
      // Mobile app mode - always professional tier
      const isFreeTier = false; // Always professional in mobile app
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

  app.get("/api/songs/:id", async (req: any, res) => {
    try {
      const userId = 'local_user';
      const song = await storage.getSongWithTracks(req.params.id, userId);
      if (!song) {
        return res.status(404).json({ message: "Song not found" });
      }
      res.json(song);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch song" });
    }
  });

  app.post("/api/songs", async (req: any, res) => {
    try {
      const userId = 'local_user';
      const user = { userType: 'professional', isPaidUser: true };
      
      // Mobile app mode - always professional tier
      const isFreeTier = false; // Always professional in mobile app
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

  app.patch("/api/songs/:id", async (req: any, res) => {
    try {
      const userId = 'local_user';
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

  app.delete("/api/songs/:id", async (req: any, res) => {
    try {
      const userId = 'local_user';
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
  app.get("/api/songs/:songId/tracks", async (req: any, res) => {
    try {
      const userId = 'local_user';
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

  app.post("/api/songs/:songId/tracks", async (req: any, res) => {
    try {
      const userId = 'local_user';
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

  // Simplified lyrics search route - Basic Google search
  app.post("/api/lyrics/search", async (req, res) => {
    try {
      const { title, artist } = req.body;
      
      if (!title || !artist) {
        return res.status(400).json({ 
          success: false, 
          error: "Both title and artist are required" 
        });
      }

      console.log(`Opening Google search for "${title}" by ${artist} lyrics...`);

      // Simple Google search for lyrics
      const searchQuery = `${title} ${artist} lyrics`;
      const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;

      console.log(`Google search URL: ${googleSearchUrl}`);

      return res.json({
        success: false,
        message: `Opening Google search for "${title}" by ${artist} lyrics`,
        searchResult: {
          url: googleSearchUrl,
          title: `${title} by ${artist} - Lyrics`,
          snippet: "Google search results for song lyrics"
        },
        openBrowser: true
      });

    } catch (error) {
      console.error("Lyrics search error:", error);
      return res.status(500).json({ 
        success: false, 
        error: "Failed to search for lyrics" 
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

  // Broadcast session management routes
  app.post('/api/broadcast/create', async (req, res) => {
    try {
      const { id, name, hostId, hostName } = req.body;
      
      // Normalize session ID to lowercase for consistency
      const normalizedId = id.toLowerCase().trim();
      
      // Upsert broadcast session - replace if exists
      await db
        .insert(broadcastSessions)
        .values({
          id: normalizedId,
          name,
          hostId,
          hostName,
          isActive: true,
          lastActivity: new Date()
        })
        .onConflictDoUpdate({
          target: broadcastSessions.id,
          set: {
            name,
            hostId,
            hostName,
            isActive: true,
            lastActivity: new Date()
          }
        });
        
      console.log(`📡 Created broadcast session: ${normalizedId} (${name}) by ${hostName}`);
      res.json({ success: true, message: 'Broadcast session created' });
    } catch (error) {
      console.error('Failed to create broadcast session:', error);
      res.status(500).json({ error: 'Failed to create broadcast session' });
    }
  });

  app.get('/api/broadcast/check/:sessionName', async (req, res) => {
    try {
      const { sessionName } = req.params;
      
      // Normalize session name to lowercase for consistency
      const normalizedSessionName = sessionName.toLowerCase().trim();
      
      const session = await db
        .select()
        .from(broadcastSessions)
        .where(sql`${broadcastSessions.id} = ${normalizedSessionName} AND ${broadcastSessions.isActive} = true`)
        .limit(1);
        
      if (session.length > 0) {
        // Check if the session is still active (less than 20 seconds since last activity)
        const now = Date.now();
        const lastActivity = new Date(session[0].lastActivity).getTime();
        const isStale = now - lastActivity > 20000; // 20 seconds
        
        if (isStale) {
          console.log(`📡 Broadcast session ${normalizedSessionName} is stale - last activity ${Math.floor((now - lastActivity) / 1000)}s ago`);
          res.json({ 
            exists: false,
            stale: true,
            message: 'Broadcast session exists but has expired due to inactivity'
          });
        } else {
          console.log(`📡 Broadcast session found: ${normalizedSessionName}`);
          res.json({ 
            exists: true, 
            session: session[0]
          });
        }
      } else {
        console.log(`📡 Broadcast session not found: ${normalizedSessionName}`);
        res.json({ exists: false });
      }
    } catch (error) {
      console.error('Failed to check broadcast session:', error);
      res.status(500).json({ error: 'Failed to check broadcast session' });
    }
  });

  // Update broadcast session activity (ping)
  app.post('/api/broadcast/:sessionId/ping', async (req, res) => {
    try {
      const { sessionId } = req.params;
      const normalizedId = sessionId.toLowerCase().trim();
      
      // Update last activity timestamp
      await db
        .update(broadcastSessions)
        .set({ lastActivity: new Date() })
        .where(eq(broadcastSessions.id, normalizedId))
        .where(eq(broadcastSessions.isActive, true));
        
      console.log(`📡 Updated broadcast activity: ${normalizedId}`);
      res.json({ success: true, timestamp: new Date().toISOString() });
    } catch (error) {
      console.error('Failed to update broadcast activity:', error);
      res.status(500).json({ error: 'Failed to update broadcast activity' });
    }
  });

  app.delete('/api/broadcast/:sessionId', async (req, res) => {
    try {
      const { sessionId } = req.params;
      const normalizedId = sessionId.toLowerCase().trim();
      
      // First clean up all songs associated with this broadcast
      const deletedSongs = await db.delete(broadcastSongs)
        .where(eq(broadcastSongs.broadcastId, normalizedId))
        .returning();
      
      console.log(`🗑️ Cleaned up ${deletedSongs.length} songs for broadcast ${normalizedId}`);
      
      // Then mark the broadcast session as inactive
      await db
        .update(broadcastSessions)
        .set({ isActive: false })
        .where(eq(broadcastSessions.id, normalizedId));
        
      console.log(`📡 Ended broadcast session: ${normalizedId}`);
      res.json({ 
        success: true, 
        message: 'Broadcast session ended', 
        deletedSongs: deletedSongs.length 
      });
    } catch (error) {
      console.error('Failed to end broadcast session:', error);
      res.status(500).json({ error: 'Failed to end broadcast session' });
    }
  });

  // Upload songs for a broadcast session
  app.post('/api/broadcast/:broadcastId/songs', async (req, res) => {
    try {
      const { broadcastId } = req.params;
      const { songs } = req.body; // Array of song data from local library
      
      if (!Array.isArray(songs)) {
        return res.status(400).json({ error: 'Songs must be an array' });
      }
      
      // Insert all songs for this broadcast
      const insertedSongs = [];
      for (const songData of songs) {
        const [insertedSong] = await db.insert(broadcastSongs).values({
          broadcastId,
          songId: songData.id,
          songTitle: songData.title,
          artistName: songData.artist,
          duration: songData.duration,
          lyrics: songData.lyrics,
          waveformData: songData.waveformData ? JSON.parse(songData.waveformData) : null,
          trackCount: songData.trackCount || 1
        }).returning();
        
        insertedSongs.push(insertedSong);
      }
      
      console.log(`📡 Uploaded ${insertedSongs.length} songs for broadcast ${broadcastId}`);
      res.json({ success: true, count: insertedSongs.length, songs: insertedSongs });
    } catch (error) {
      console.error('Error uploading broadcast songs:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get song data by entry ID  
  app.get('/api/broadcast/song/:songEntryId', async (req, res) => {
    try {
      const { songEntryId } = req.params;
      const [song] = await db.select().from(broadcastSongs)
        .where(eq(broadcastSongs.id, songEntryId))
        .limit(1);
      
      if (!song) {
        return res.status(404).json({ error: 'Song not found' });
      }
      
      res.json({ song });
    } catch (error) {
      console.error('Error fetching broadcast song:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Clean up all songs for a broadcast (when broadcast ends)
  app.delete('/api/broadcast/:broadcastId/songs', async (req, res) => {
    try {
      const { broadcastId } = req.params;
      const deletedSongs = await db.delete(broadcastSongs)
        .where(eq(broadcastSongs.broadcastId, broadcastId))
        .returning();
      
      console.log(`🗑️ Cleaned up ${deletedSongs.length} songs for broadcast ${broadcastId}`);
      res.json({ success: true, deletedCount: deletedSongs.length });
    } catch (error) {
      console.error('Error cleaning up broadcast songs:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Get broadcast info
  app.get('/api/broadcast/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const normalizedId = id.toLowerCase().trim();
      
      console.log(`🔍 Fetching broadcast session info: ${normalizedId}`);
      
      const session = await db.select()
        .from(broadcastSessions)
        .where(eq(broadcastSessions.id, normalizedId))
        .limit(1);
      
      if (session && session.length > 0) {
        console.log(`✅ Found broadcast session: ${normalizedId}`);
        res.json({
          ...session[0],
          name: session[0].name || normalizedId,
          hostName: session[0].hostName || 'Host'
        });
      } else {
        console.log(`❌ Broadcast session not found: ${normalizedId}`);
        res.status(404).json({ error: 'Broadcast not found' });
      }
    } catch (error) {
      console.error('Error fetching broadcast info:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Get broadcast state
  app.get('/api/broadcast/:id/state', async (req, res) => {
    try {
      const { id } = req.params;
      const normalizedId = id.toLowerCase().trim();
      
      console.log(`🔍 Fetching broadcast state: ${normalizedId}`);
      
      // First check if the broadcast exists
      const session = await db.select()
        .from(broadcastSessions)
        .where(eq(broadcastSessions.id, normalizedId))
        .limit(1);
      
      if (!session || session.length === 0) {
        console.log(`❌ Broadcast session not found: ${normalizedId}`);
        return res.status(404).json({ error: 'Broadcast not found' });
      }
      
      // Now get the most recent song for this broadcast
      const songs = await db.select()
        .from(broadcastSongs)
        .where(eq(broadcastSongs.broadcastId, normalizedId))
        .orderBy(desc(broadcastSongs.createdAt))
        .limit(1);
      
      const state = {
        isActive: session[0].isActive,
        curTime: session[0].position || 0,
        curSong: songs.length > 0 ? songs[0].songEntryId : null,
        isPlaying: session[0].isPlaying || false,
        duration: songs.length > 0 ? songs[0].duration : 0,
        lastUpdateTimestamp: session[0].lastActivity
      };
      
      console.log(`✅ Broadcast state: ${JSON.stringify(state)}`);
      res.json(state);
    } catch (error) {
      console.error('Error fetching broadcast state:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Help request endpoint
  app.post('/api/help', async (req, res) => {
    try {
      const { email, name, subject, message } = req.body;
      
      if (!email || !message) {
        return res.status(400).json({ error: 'Email and message are required' });
      }

      // Use SendGrid to send help request
      const { sendEmail } = await import('./sendgrid');
      
      const emailSuccess = await sendEmail({
        to: 'mazzu001@hotmail.com',
        from: 'mazzu001@hotmail.com',
        subject: `🎵 BandMaestro Help: ${subject || 'Support Request'}`,
        text: `BandMaestro Help Request\n\nFrom: ${name || 'User'} (${email})\nSubject: ${subject || 'Help Request'}\n\nMessage:\n${message}\n\n---\nSent via BandMaestro Help System`,
        html: `
          <div style="max-width: 600px; font-family: Arial, sans-serif;">
            <h2 style="color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">🎵 BandMaestro Help Request</h2>
            <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>From:</strong> ${name || 'User'}</p>
              <p><strong>Email:</strong> ${email}</p>
              <p><strong>Subject:</strong> ${subject || 'Help Request'}</p>
            </div>
            <h3>Message:</h3>
            <div style="background: white; border-left: 4px solid #2563eb; padding: 15px; margin: 15px 0;">
              ${message.replace(/\n/g, '<br>')}
            </div>
            <p style="color: #64748b; font-size: 12px; margin-top: 30px;">Sent via BandMaestro Help System</p>
          </div>
        `
      });

      if (emailSuccess) {
        console.log(`📧 Help request sent successfully from ${email}`);
        res.json({ success: true, message: 'Help request sent successfully' });
      } else {
        throw new Error('Failed to send email');
      }
    } catch (error) {
      console.error('❌ Error sending help request:', error);
      res.status(500).json({ error: 'Failed to send help request' });
    }
  });

  // 🎵 Stem Splitter API routes (isolated feature)
  const stemSplitterEnabled = process.env.ENABLE_STEM_SPLITTER !== 'false'; // Enabled by default for development
  
  if (stemSplitterEnabled) {
    // Health check endpoint for Replit
    app.get('/api/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });
  } else {
    console.log('⚠️ Stem splitter disabled via ENABLE_STEM_SPLITTER environment variable');
  }

  console.log('📡 Registering broadcast session routes...');
  console.log('🗄️ Registering database storage routes...');
  console.log('🎵 Registering song management routes...');
  console.log('🎧 Registering track management routes...');
  console.log('📊 Registering waveform caching routes...');
  console.log('🔍 Registering lyrics search routes...');
  console.log('📁 Registering file registry routes...');

  
  console.log('🌐 Creating HTTP server...');
  const httpServer = createServer(app);
  console.log('✅ HTTP server created successfully');

  console.log('🎯 Route registration completed successfully');
  return httpServer;
}
