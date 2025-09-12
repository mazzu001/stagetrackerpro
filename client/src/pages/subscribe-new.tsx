import { useStripe, Elements, PaymentElement, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useEffect, useState } from 'react';
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Crown, Check, Music, Zap, Star } from 'lucide-react';

if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
  throw new Error('Missing required Stripe key: VITE_STRIPE_PUBLIC_KEY');
}

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

interface SubscriptionTier {
  id: string;
  name: string;
  price: string;
  priceId?: string; // Stripe price ID
  features: string[];
  popular?: boolean;
  icon: any;
  description: string;
}

const subscriptionTiers: SubscriptionTier[] = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    features: [
      'Up to 2 songs',
      'Basic audio playback',
      'Lyrics display',
      'Basic transport controls'
    ],
    icon: Music,
    description: 'Perfect for trying out StageTracker'
  },
  {
    id: 'premium',
    name: 'Premium',
    price: '$4.99',
    priceId: 'price_premium_placeholder', // Will be set when you create it
    features: [
      'Unlimited songs',
      'Multi-track audio engine (6 tracks)',
      'VU meters & audio mixing',
      'Advanced lyrics with timestamps',
      'Waveform visualization',
      'Fullscreen performance mode'
    ],
    popular: true,
    icon: Crown,
    description: 'Everything you need for live performance'
  },
  {
    id: 'professional',
    name: 'Professional',
    price: '$6.99',
    priceId: 'price_1S6geUK3Nj4A0Az4kYc5HopM',
    features: [
      'All Premium features',
      'Advanced audio control (Coming Soon)',
      'Wireless audio connectivity (Coming Soon)',
      'Advanced performance tools (Coming Soon)',
      'Professional stage features (Coming Soon)',
      'Priority support'
    ],
    icon: Star,
    description: 'For professional musicians who need advanced audio control'
  }
];

const PaymentForm = ({ tier, onSuccess }: { tier: SubscriptionTier, onSuccess: () => void }) => {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    console.log('🔄 Starting payment submission for tier:', tier.id);

    if (!stripe || !elements) {
      console.error('❌ Stripe or elements not available');
      setIsLoading(false);
      return;
    }

    try {
      console.log('🔄 Confirming payment with Stripe...');
      
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
      });

      console.log('📊 Payment confirmation result:', { error: error?.message, status: paymentIntent?.status });

      if (error) {
        console.error('❌ Payment error:', error);
        toast({
          title: "Payment Failed",
          description: error.message || 'Payment failed. Please try again.',
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      if (paymentIntent && paymentIntent.status === 'succeeded') {
        console.log('✅ Payment succeeded, updating user data...');
        
        try {
          // Update local user data
          const storedUser = localStorage.getItem('lpp_local_user');
          if (storedUser) {
            const userData = JSON.parse(storedUser);
            userData.userType = tier.id === 'premium' ? 'paid' : 'professional';
            userData.hasActiveSubscription = true;
            userData.subscriptionTier = tier.id;
            localStorage.setItem('lpp_local_user', JSON.stringify(userData));
            
            console.log('✅ Updated user data:', userData);
            window.dispatchEvent(new Event('auth-change'));
          }

          toast({
            title: `Welcome to ${tier.name}!`,
            description: `Your ${tier.name} subscription is now active!`,
          });

          console.log('🔄 Redirecting to home page...');
          setTimeout(() => {
            try {
              onSuccess();
              // Use location instead of direct window manipulation
              window.location.replace('/');
            } catch (redirectError) {
              console.error('❌ Redirect error:', redirectError);
              // Fallback: try different redirect method
              window.location.assign('/');
            }
          }, 2000);
        } catch (storageError) {
          console.error('❌ Error updating localStorage:', storageError);
          throw storageError;
        }
      }
    } catch (error: any) {
      console.error('❌ Caught payment error:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      
      toast({
        title: "Payment Error",
        description: `Error: ${error.message || 'An unexpected error occurred'}`,
        variant: "destructive",
      });
    }
    
    setIsLoading(false);
  };

  if (!stripe || !elements) {
    return (
      <div className="text-center p-4">
        <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2" />
        <p className="text-sm text-gray-600">Loading payment form...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      <Button 
        type="submit" 
        disabled={!stripe || isLoading} 
        className="w-full"
        data-testid={`button-subscribe-${tier.id}`}
      >
        {isLoading ? 'Processing...' : `Subscribe to ${tier.name} - ${tier.price}/month`}
      </Button>
    </form>
  );
};

export default function SubscribeNew({ onClose }: { onClose: () => void }) {
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier | null>(null);
  const [clientSecret, setClientSecret] = useState("");
  const [isCreatingSubscription, setIsCreatingSubscription] = useState(false);
  const { toast } = useToast();

  const handleSelectTier = async (tier: SubscriptionTier) => {
    if (tier.id === 'free') {
      toast({
        title: "You're already on the Free plan",
        description: "No payment required for the free tier.",
      });
      return;
    }

    // Clear previous state to force fresh Elements component
    setSelectedTier(null);
    setClientSecret("");
    setIsCreatingSubscription(true);

    try {
      // Get user email from localStorage
      const storedUser = localStorage.getItem('lpp_local_user');
      if (!storedUser) {
        toast({
          title: "Authentication Required",
          description: "Please sign in to subscribe.",
          variant: "destructive",
        });
        return;
      }

      const userData = JSON.parse(storedUser);
      const userEmail = userData.email;

      console.log('🔄 Creating subscription for:', { email: userEmail, tier: tier.id });

      const response = await fetch('/api/create-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          email: userEmail,
          tier: tier.id,
          priceId: tier.priceId 
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to create subscription');
      }

      console.log('✅ Subscription created, client secret:', data.clientSecret ? 'received' : 'missing');

      if (data.clientSecret) {
        // Set tier first, then clientSecret to trigger fresh Elements mount
        setSelectedTier(tier);
        setClientSecret(data.clientSecret);
      } else {
        throw new Error('No client secret returned');
      }
    } catch (error: any) {
      console.error('❌ Error creating subscription:', error);
      toast({
        title: "Subscription Error",
        description: error.message || 'Failed to start subscription process',
        variant: "destructive",
      });
      setSelectedTier(null);
      setClientSecret("");
    } finally {
      setIsCreatingSubscription(false);
    }
  };

  if (selectedTier && clientSecret) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => setSelectedTier(null)}>
            ← Back to Plans
          </Button>
        </div>
        
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mb-4">
              <selectedTier.icon className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-2xl">Subscribe to {selectedTier.name}</CardTitle>
            <p className="text-gray-600">{selectedTier.description}</p>
          </CardHeader>
          
          <CardContent>
            <Elements 
              key={clientSecret} 
              stripe={stripePromise} 
              options={{ clientSecret }}
            >
              <PaymentForm tier={selectedTier} onSuccess={onClose} />
            </Elements>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Choose Your Plan</h1>
        <p className="text-gray-600 text-lg">Select the plan that's right for your musical journey</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {subscriptionTiers.map((tier) => {
          const Icon = tier.icon;
          
          return (
            <Card 
              key={tier.id} 
              className={`relative ${tier.popular ? 'border-2 border-orange-500' : 'border'}`}
            >
              {tier.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                    Most Popular
                  </span>
                </div>
              )}
              
              <CardHeader className="text-center">
                <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
                  tier.id === 'free' ? 'bg-gray-100' :
                  tier.id === 'premium' ? 'bg-gradient-to-r from-yellow-400 to-orange-500' :
                  'bg-gradient-to-r from-purple-500 to-blue-600'
                }`}>
                  <Icon className={`w-8 h-8 ${tier.id === 'free' ? 'text-gray-600' : 'text-white'}`} />
                </div>
                <CardTitle className="text-2xl">{tier.name}</CardTitle>
                <div className="text-3xl font-bold">
                  {tier.price}
                  <span className="text-sm font-normal text-gray-600">/month</span>
                </div>
                <p className="text-gray-600 text-sm">{tier.description}</p>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {tier.features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
                
                <Button 
                  onClick={() => handleSelectTier(tier)}
                  disabled={isCreatingSubscription && selectedTier?.id === tier.id}
                  className={`w-full ${
                    tier.id === 'free' ? 'bg-gray-500 hover:bg-gray-600' :
                    tier.popular ? 'bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600' :
                    'bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700'
                  } text-white`}
                  data-testid={`button-select-${tier.id}`}
                >
                  {isCreatingSubscription && selectedTier?.id === tier.id ? (
                    'Setting up...'
                  ) : tier.id === 'free' ? (
                    'Current Plan'
                  ) : (
                    `Choose ${tier.name}`
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
      
      <div className="text-center mt-8 text-gray-600">
        <p>All plans include 30-day money-back guarantee • Cancel anytime</p>
        <p className="text-sm mt-2">Advanced audio features in Professional plan coming in future updates</p>
      </div>
    </div>
  );
}