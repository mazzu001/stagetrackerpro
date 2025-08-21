import { storage } from "./storage";
import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export class SubscriptionMonitor {
  private intervalId: NodeJS.Timeout | null = null;

  start() {
    // Run immediately on start
    this.checkSubscriptions();
    
    // Run every 24 hours (86400000 milliseconds)
    this.intervalId = setInterval(() => {
      this.checkSubscriptions();
    }, 24 * 60 * 60 * 1000);
    
    console.log('📅 Subscription monitor started - checking every 24 hours');
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('🛑 Subscription monitor stopped');
    }
  }

  private async checkSubscriptions() {
    console.log('🔍 Starting subscription status check...');
    
    try {
      // Get all users with Stripe subscription IDs
      const users = await this.getAllUsersWithSubscriptions();
      
      for (const user of users) {
        await this.checkUserSubscription(user);
      }
      
      console.log(`✅ Subscription check completed for ${users.length} users`);
    } catch (error) {
      console.error('❌ Error during subscription check:', error);
    }
  }

  private async getAllUsersWithSubscriptions() {
    return await storage.getAllUsersWithSubscriptions();
  }

  private async checkUserSubscription(user: any) {
    if (!user.stripeSubscriptionId) {
      return; // No subscription to check
    }

    try {
      // Get subscription from Stripe
      const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
      
      let newStatus = 1; // Default to free
      
      switch (subscription.status) {
        case 'active':
        case 'trialing':
          newStatus = 2; // Premium
          break;
        case 'canceled':
        case 'incomplete_expired':
        case 'past_due':
        case 'unpaid':
          newStatus = 1; // Free
          break;
        default:
          newStatus = 1; // Default to free for unknown status
      }

      // Update user status if it changed
      if (user.subscriptionStatus !== newStatus) {
        await this.updateUserSubscriptionStatus(user.id, newStatus, subscription);
        console.log(`📝 Updated user ${user.email}: ${user.subscriptionStatus} → ${newStatus}`);
      }

    } catch (error: any) {
      if (error.code === 'resource_missing') {
        // Subscription no longer exists in Stripe, set to free
        await this.updateUserSubscriptionStatus(user.id, 1, null);
        console.log(`❌ Subscription not found for ${user.email}, set to free`);
      } else {
        console.error(`❌ Error checking subscription for ${user.email}:`, error);
      }
    }
  }

  private async updateUserSubscriptionStatus(userId: string, status: number, subscription: Stripe.Subscription | null) {
    try {
      // Calculate subscription end date
      let endDate = null;
      if (subscription && subscription.current_period_end) {
        endDate = new Date(subscription.current_period_end * 1000).toISOString();
      }

      // Update user in database
      await storage.updateUserSubscription(userId, {
        subscriptionStatus: status,
        subscriptionEndDate: endDate
      });
      
    } catch (error) {
      console.error(`❌ Error updating subscription status for user ${userId}:`, error);
    }
  }
}

// Create singleton instance
export const subscriptionMonitor = new SubscriptionMonitor();