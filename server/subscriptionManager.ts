import Stripe from "stripe";
import fs from "fs";
import path from "path";

let stripe: Stripe | null = null;
let isStripeEnabled = false;

if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY !== 'placeholder_for_deployment') {
  try {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    isStripeEnabled = true;
    console.log('✅ Stripe initialized successfully for subscriptions');
  } catch (error: any) {
    console.error('❌ Failed to initialize Stripe:', error.message);
    console.log('🔧 Subscription features will be disabled');
  }
} else {
  console.log('⚠️ STRIPE_SECRET_KEY not available - subscription features disabled');
  console.log('💡 For production deployment, ensure STRIPE_SECRET_KEY is properly configured');
}

interface SubscriptionData {
  email: string;
  customerId: string;
  subscriptionId: string;
  status: 'active' | 'canceled' | 'past_due' | 'unpaid';
  planType: 'premium';
  priceId: string;
  currentPeriodStart: number;
  currentPeriodEnd: number;
  updatedAt: number;
}

export class SubscriptionManager {
  private subscriptionsFile: string;

  constructor() {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.subscriptionsFile = path.join(dataDir, 'subscriptions.json');
  }

  private loadSubscriptions(): Record<string, SubscriptionData> {
    try {
      if (fs.existsSync(this.subscriptionsFile)) {
        return JSON.parse(fs.readFileSync(this.subscriptionsFile, 'utf8'));
      }
    } catch (error) {
      console.error('Error loading subscriptions file:', error);
    }
    return {};
  }

  private saveSubscriptions(subscriptions: Record<string, SubscriptionData>): void {
    try {
      fs.writeFileSync(this.subscriptionsFile, JSON.stringify(subscriptions, null, 2));
    } catch (error) {
      console.error('Error saving subscriptions file:', error);
    }
  }

  async verifySubscriptionStatus(email: string): Promise<{
    isPaid: boolean;
    subscriptionData?: SubscriptionData;
    source: 'local' | 'stripe';
  }> {
    // First check local data
    const subscriptions = this.loadSubscriptions();
    const localSubscription = Object.values(subscriptions).find(sub => sub.email === email);
    
    if (localSubscription && localSubscription.status === 'active') {
      // Check if subscription is still within current period
      const now = Date.now() / 1000;
      if (now < localSubscription.currentPeriodEnd) {
        return { 
          isPaid: true, 
          subscriptionData: localSubscription,
          source: 'local'
        };
      }
    }

    // If local data is stale or missing, verify with Stripe (only if Stripe is available)
    if (!isStripeEnabled || !stripe) {
      console.log('⚠️ Stripe not available - using local subscription data only');
      return { isPaid: false, source: 'local' };
    }
    
    try {
      const customers = await stripe.customers.list({
        email: email,
        limit: 1
      });

      if (customers.data.length > 0) {
        const customer = customers.data[0];
        const subscriptions = await stripe.subscriptions.list({
          customer: customer.id,
          status: 'active'
        });

        if (subscriptions.data.length > 0) {
          const subscription = subscriptions.data[0];
          
          // Update local data with fresh Stripe data
          const subscriptionData: SubscriptionData = {
            email: email,
            customerId: customer.id,
            subscriptionId: subscription.id,
            status: subscription.status as 'active',
            planType: 'premium',
            priceId: subscription.items.data[0]?.price.id || '',
            currentPeriodStart: (subscription as any).current_period_start,
            currentPeriodEnd: (subscription as any).current_period_end,
            updatedAt: Date.now()
          };

          const allSubscriptions = this.loadSubscriptions();
          allSubscriptions[customer.id] = subscriptionData;
          this.saveSubscriptions(allSubscriptions);

          return { 
            isPaid: true, 
            subscriptionData: subscriptionData,
            source: 'stripe'
          };
        }
      }
    } catch (error) {
      console.error('Error verifying subscription with Stripe:', error);
    }

    return { isPaid: false, source: 'local' };
  }

  updateSubscription(customerId: string, subscriptionData: Partial<SubscriptionData>): void {
    const subscriptions = this.loadSubscriptions();
    const existingSubscription = subscriptions[customerId];
    
    if (existingSubscription) {
      subscriptions[customerId] = { 
        ...existingSubscription, 
        ...subscriptionData,
        updatedAt: Date.now()
      };
    } else if (subscriptionData.email) {
      subscriptions[customerId] = {
        email: subscriptionData.email,
        customerId: customerId,
        subscriptionId: subscriptionData.subscriptionId || '',
        status: subscriptionData.status || 'active',
        planType: 'premium',
        priceId: subscriptionData.priceId || '',
        currentPeriodStart: subscriptionData.currentPeriodStart || Date.now() / 1000,
        currentPeriodEnd: subscriptionData.currentPeriodEnd || (Date.now() / 1000) + (30 * 24 * 60 * 60),
        updatedAt: Date.now()
      };
    }
    
    this.saveSubscriptions(subscriptions);
  }

  async getAllActiveSubscriptions(): Promise<SubscriptionData[]> {
    const subscriptions = this.loadSubscriptions();
    return Object.values(subscriptions).filter(sub => sub.status === 'active');
  }
}

export const subscriptionManager = new SubscriptionManager();