import { storage } from "./storage";
import Stripe from "stripe";

let stripe: Stripe | null = null;
let isStripeEnabled = false;

if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY !== 'placeholder_for_deployment') {
  try {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    isStripeEnabled = true;
    console.log('✅ Stripe initialized successfully for monitoring');
  } catch (error: any) {
    console.error('❌ Failed to initialize Stripe for monitoring:', error.message);
    console.log('🔧 Subscription monitoring will be disabled');
  }
} else {
  console.log('⚠️ STRIPE_SECRET_KEY not available - subscription monitoring disabled');
  console.log('💡 For production deployment, ensure STRIPE_SECRET_KEY is properly configured');
}

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
    
    if (!isStripeEnabled || !stripe) {
      console.log('⚠️ Stripe not available - skipping subscription check');
      return;
    }
    
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
      if (!stripe) {
        console.log(`⚠️ Stripe not available - skipping check for user ${user.email}`);
        return;
      }
      
      const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId, {
        expand: ['latest_invoice', 'latest_invoice.payment_intent']
      });
      
      let newStatus = 1; // Default to free
      let statusReason = '';
      
      switch (subscription.status) {
        case 'active':
          newStatus = 2; // Premium - active subscription
          statusReason = 'Active subscription';
          break;
        case 'trialing':
          newStatus = 2; // Premium - trial period
          statusReason = 'Trial period';
          break;
        case 'past_due':
          // Check if payment failed
          const latestInvoice = subscription.latest_invoice as Stripe.Invoice;
          if (latestInvoice && (latestInvoice as any).payment_intent) {
            const paymentIntent = (latestInvoice as any).payment_intent as Stripe.PaymentIntent;
            if (paymentIntent.status === 'requires_payment_method') {
              newStatus = 1; // Free - payment method failed
              statusReason = 'Payment method declined';
              await this.notifyPaymentFailure(user, 'Payment method declined');
            } else {
              newStatus = 1; // Free - payment past due
              statusReason = 'Payment past due';
              await this.notifyPaymentFailure(user, 'Payment past due');
            }
          } else {
            newStatus = 1;
            statusReason = 'Payment past due';
          }
          break;
        case 'canceled':
          newStatus = 1; // Free - subscription cancelled
          statusReason = 'Subscription cancelled';
          break;
        case 'incomplete':
        case 'incomplete_expired':
          newStatus = 1; // Free - incomplete payment
          statusReason = 'Incomplete payment';
          await this.notifyPaymentFailure(user, 'Payment incomplete');
          break;
        case 'unpaid':
          newStatus = 1; // Free - unpaid invoice
          statusReason = 'Unpaid invoice';
          await this.notifyPaymentFailure(user, 'Invoice unpaid');
          break;
        default:
          newStatus = 1; // Default to free for unknown status
          statusReason = `Unknown status: ${subscription.status}`;
      }

      // Check if subscription has expired
      const currentPeriodEnd = (subscription as any).current_period_end * 1000;
      const now = Date.now();
      if (currentPeriodEnd < now && subscription.status !== 'canceled') {
        newStatus = 1; // Free - subscription expired
        statusReason = 'Subscription expired';
        await this.notifySubscriptionExpired(user);
      }

      // Update user status if it changed
      if (user.subscriptionStatus !== newStatus) {
        await this.updateUserSubscriptionStatus(user.id, newStatus, subscription);
        console.log(`✅ Updated subscription for user ${user.email}: status=${newStatus} (${statusReason})`);
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

  private async notifyPaymentFailure(user: any, reason: string) {
    console.log(`💳 Payment failure detected for ${user.email}: ${reason}`);
    // TODO: Send email notification to user about payment failure
    // Could integrate with email service here
  }

  private async notifySubscriptionExpired(user: any) {
    console.log(`⏰ Subscription expired for ${user.email}`);
    // TODO: Send email notification to user about subscription expiration
    // Could integrate with email service here
  }

  private async updateUserSubscriptionStatus(userId: string, status: number, subscription: Stripe.Subscription | null) {
    try {
      // Calculate subscription end date
      let endDate = null;
      if (subscription && (subscription as any).current_period_end) {
        endDate = new Date((subscription as any).current_period_end * 1000).toISOString();
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