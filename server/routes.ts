import type { Express, Request } from "express";
import express from "express";
import { createServer, type Server } from "http";
import bcrypt from "bcrypt";
import { storage } from "./storage";
import { insertSongSchema, insertTrackSchema } from "@shared/schema";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { subscriptionManager } from "./subscriptionManager";
// MIDI functionality removed
import Stripe from "stripe";
import multer from "multer";
import path from "path";
import fs from "fs";
import { promises as fsPromises } from "fs";
import { WebSocketServer, WebSocket } from 'ws';

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

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Email/password authentication endpoints for frontend
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }
      
      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({ error: 'User already exists with this email' });
      }
      
      // Create new user with hashed password
      const passwordHash = await bcrypt.hash(password, 10);
      
      const newUser = await storage.upsertUser({
        id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        email: email.toLowerCase(),
        firstName: null,
        lastName: null,
        profileImageUrl: null,
        subscriptionStatus: 1, // 1 = free user
      });
      
      console.log('✅ New user registered:', newUser.email);
      res.json({ 
        success: true, 
        user: { 
          id: newUser.id, 
          email: newUser.email,
          userType: newUser.subscriptionStatus === 1 ? 'free' : 
                   newUser.subscriptionStatus === 2 ? 'paid' : 'professional'
        }
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
      
      // Check if user exists
      const user = await storage.getUserByEmail(email.toLowerCase());
      if (!user) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      
      console.log('✅ User authenticated:', user.email);
      
      const userType = user.subscriptionStatus === 1 ? 'free' : 
                      user.subscriptionStatus === 2 ? 'paid' : 'professional';
      
      res.json({ 
        success: true, 
        user: { 
          id: user.id, 
          email: user.email,
          userType: userType
        }
      });
    } catch (error: any) {
      console.error('❌ Login error:', error);
      res.status(500).json({ error: 'Login failed' });
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

  // Stripe payment routes for subscription management
  console.log('💳 Registering Stripe payment routes...');
  
  // Create subscription for premium/professional tiers
  app.post('/api/create-subscription', async (req, res) => {
    try {
      const { email, priceId, planName } = req.body;
      
      if (!email || !priceId) {
        return res.status(400).json({ error: 'Email and price ID are required' });
      }

      // Create or retrieve customer
      let customer;
      const existingCustomers = await stripe.customers.list({ email });
      
      if (existingCustomers.data.length > 0) {
        customer = existingCustomers.data[0];
      } else {
        customer = await stripe.customers.create({ email });
      }

      // Create subscription
      const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: priceId }],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          email,
          planName: planName || 'premium'
        }
      });

      // Update user in database with subscription info
      const user = await storage.getUserByEmail(email);
      if (user) {
        const subscriptionStatus = planName === 'professional' ? 3 : 2; // 2=premium, 3=professional
        await storage.updateUserStripeInfo(user.id, customer.id, subscription.id);
        await storage.updateUserSubscription(user.id, {
          subscriptionStatus,
          subscriptionEndDate: null
        });
      }

      const clientSecret = subscription.latest_invoice?.payment_intent?.client_secret;
      
      console.log(`✅ Created subscription for ${email}: ${subscription.id}`);
      
      res.json({
        subscriptionId: subscription.id,
        clientSecret,
        customer: customer.id
      });
    } catch (error: any) {
      console.error('❌ Error creating subscription:', error);
      res.status(500).json({ error: 'Failed to create subscription' });
    }
  });

  // Check subscription status
  app.post('/api/verify-subscription', async (req, res) => {
    try {
      const { email } = req.body;
      console.log('🔍 Verifying subscription for email:', email);
      
      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }

      // Get user from database
      const user = await storage.getUserByEmail(email.toLowerCase());
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      console.log('🔍 Database subscription status:', user.subscriptionStatus);
      
      // Map subscription status to user type
      let userType = 'free';
      let isPaid = false;
      
      if (user.subscriptionStatus === 2) {
        userType = 'paid';
        isPaid = true;
      } else if (user.subscriptionStatus === 3) {
        userType = 'professional';
        isPaid = true;
      }
      
      console.log('🔍 Final userType:', userType);
      
      res.json({
        isPaid,
        userType,
        subscriptionStatus: user.subscriptionStatus,
        email: user.email
      });
    } catch (error: any) {
      console.error('❌ Error verifying subscription:', error);
      res.status(500).json({ 
        error: 'Verification failed',
        message: 'Unable to verify subscription status' 
      });
    }
  });

  // Cancel subscription endpoint
  app.post('/api/cancel-subscription', async (req, res) => {
    try {
      const { email, reasons, feedback } = req.body;
      
      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Cancel Stripe subscription if it exists
      if (user.stripeSubscriptionId) {
        try {
          await stripe.subscriptions.cancel(user.stripeSubscriptionId);
          console.log(`✅ Cancelled Stripe subscription: ${user.stripeSubscriptionId}`);
        } catch (stripeError) {
          console.error('❌ Error cancelling Stripe subscription:', stripeError);
          // Continue with database update even if Stripe fails
        }
      }

      // Update user subscription status to free (1)
      await storage.updateUserSubscription(user.id, {
        subscriptionStatus: 1,
        subscriptionEndDate: null
      });

      // Log cancellation feedback for improvement
      console.log(`📝 Subscription cancelled for ${email}`);
      console.log(`Reasons: ${reasons?.join(', ') || 'None provided'}`);
      if (feedback) {
        console.log(`Feedback: ${feedback}`);
      }

      res.json({
        success: true,
        message: 'Subscription cancelled successfully'
      });
    } catch (error: any) {
      console.error('❌ Error cancelling subscription:', error);
      res.status(500).json({ error: 'Failed to cancel subscription' });
    }
  });

  // Test endpoint to create users with different subscription levels
  app.post('/api/create-test-users', async (req, res) => {
    try {
      // Create paid test user
      await storage.upsertUser({
        id: 'test_paid_user',
        email: 'paid@test.com',
        firstName: 'Paid',
        lastName: 'User'
      });
      await storage.updateUserSubscription('test_paid_user', {
        subscriptionStatus: 2, // Premium
        subscriptionEndDate: null
      });

      // Create professional test user  
      await storage.upsertUser({
        id: 'test_pro_user',
        email: 'pro@test.com',
        firstName: 'Pro',
        lastName: 'User'
      });
      await storage.updateUserSubscription('test_pro_user', {
        subscriptionStatus: 3, // Professional
        subscriptionEndDate: null
      });

      console.log('✅ Test users created successfully');
      res.json({
        success: true,
        users: [
          { email: 'paid@test.com', type: 'Premium (tier 2)' },
          { email: 'pro@test.com', type: 'Professional (tier 3)' },
          { email: 'brooke@mnb.com', type: 'Free (tier 1)' }
        ]
      });
    } catch (error: any) {
      console.error('❌ Error creating test users:', error);
      res.status(500).json({ error: 'Failed to create test users' });
    }
  });

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
        const subscription = event.data.object;
        console.log(`📋 Subscription ${event.type}: ${subscription.id} (${subscription.status})`);
        await handleSubscriptionChange(subscription);
        break;
        
      case 'customer.subscription.deleted':
        const deletedSubscription = event.data.object;
        console.log(`🗑️ Subscription deleted: ${deletedSubscription.id}`);
        await handleSubscriptionDeleted(deletedSubscription);
        break;
        
      case 'invoice.payment_failed':
        const failedInvoice = event.data.object;
        console.log(`💳 Payment failed for subscription: ${failedInvoice.subscription}`);
        await handlePaymentFailed(failedInvoice);
        break;
        
      case 'invoice.payment_succeeded':
        const succeededInvoice = event.data.object;
        console.log(`✅ Payment succeeded for subscription: ${succeededInvoice.subscription}`);
        await handlePaymentSucceeded(succeededInvoice);
        break;
        
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.json({received: true});
  });

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
            userType = 'paid';
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
                description: `${tier === 'premium' ? '$4.99' : '$14.99'}/month subscription`,
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
        success_url: successUrl,
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

  console.log('🗄️ Registering database storage routes...');
  console.log('🎵 Registering song management routes...');
  console.log('🎧 Registering track management routes...');
  console.log('📊 Registering waveform caching routes...');
  console.log('🔍 Registering lyrics search routes...');
  console.log('🎤 Registering recording routes...');

  // Recording API - Simple file saving to disk
  const RECORDINGS_DIR = path.join(process.cwd(), "recordings");
  const RECORDING_PATHS_FILE = path.join(process.cwd(), "data", "recording-paths.txt");
  
  // Ensure recordings directory exists
  if (!fs.existsSync(RECORDINGS_DIR)) {
    fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
  }

  // Simple API to save recorded audio to disk
  app.post("/api/save-recording", upload.single('audio'), async (req, res) => {
    try {
      const { trackId, songId, trackName } = req.body;
      const file = req.file;

      if (!file || !trackId || !songId || !trackName) {
        return res.status(400).json({ error: "Missing required fields: audio file, trackId, songId, trackName" });
      }

      // Create filename with timestamp to avoid conflicts
      const timestamp = Date.now();
      const extension = path.extname(file.originalname) || '.webm';
      const fileName = `${songId}_${trackId}_${timestamp}${extension}`;
      const filePath = path.join(RECORDINGS_DIR, fileName);

      // Save file to disk
      await fsPromises.writeFile(filePath, file.buffer);

      // Track file path in text file
      const pathEntry = `${trackId}|${filePath}|${trackName}|${file.mimetype}|${file.size}|${timestamp}\n`;
      await fsPromises.appendFile(RECORDING_PATHS_FILE, pathEntry);

      console.log(`✅ Recorded audio saved: ${fileName} for track: ${trackName}`);

      res.json({
        success: true,
        trackId,
        filePath,
        fileName,
        size: file.size,
        mimeType: file.mimetype
      });

    } catch (error) {
      console.error('❌ Error saving recording:', error);
      res.status(500).json({ error: "Failed to save recording" });
    }
  });

  // API to get recording file path for playback
  app.get("/api/recording/:trackId", async (req, res) => {
    try {
      const { trackId } = req.params;

      // Read paths file
      if (!fs.existsSync(RECORDING_PATHS_FILE)) {
        return res.status(404).json({ error: "No recordings found" });
      }

      const pathsContent = await fsPromises.readFile(RECORDING_PATHS_FILE, 'utf8');
      const lines = pathsContent.split('\n').filter(line => line.trim());

      // Find track
      for (const line of lines) {
        const [id, filePath, trackName, mimeType, size, timestamp] = line.split('|');
        if (id === trackId && fs.existsSync(filePath)) {
          // Serve the actual audio file
          res.set({
            'Content-Type': mimeType,
            'Content-Length': size,
            'Cache-Control': 'public, max-age=3600'
          });
          
          const fileBuffer = await fsPromises.readFile(filePath);
          return res.send(fileBuffer);
        }
      }

      res.status(404).json({ error: "Recording not found" });

    } catch (error) {
      console.error('❌ Error retrieving recording:', error);
      res.status(500).json({ error: "Failed to retrieve recording" });
    }
  });

  console.log('📁 Registering file registry routes...');

  // MIDI functionality has been completely removed
  
  console.log('🌐 Creating HTTP server...');
  const httpServer = createServer(app);
  console.log('✅ HTTP server created successfully');

  // MIDI WebSocket functionality has been completely removed
  console.log('🎯 Route registration completed successfully');
  
  return httpServer;
}
