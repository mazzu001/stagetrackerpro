import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Crown, Star, Check, ArrowLeft } from 'lucide-react';
import { useLocation } from 'wouter';

// Initialize Stripe safely with error handling
const initializeStripe = async () => {
  try {
    if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
      throw new Error('Missing Stripe public key');
    }
    return await loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);
  } catch (error) {
    console.error('❌ Failed to initialize Stripe:', error);
    return null;
  }
};

interface PlanOption {
  id: string;
  name: string;
  price: string;
  priceId: string;
  features: string[];
  icon: React.ComponentType<any>;
  popular?: boolean;
}

const plans: PlanOption[] = [
  {
    id: 'premium',
    name: 'Premium',
    price: '$4.99',
    priceId: 'price_premium_placeholder',
    features: [
      'Unlimited songs',
      'Advanced lyrics with timestamps', 
      'Waveform visualization',
      'Fullscreen performance mode'
    ],
    icon: Crown,
    popular: true
  },
  {
    id: 'professional',
    name: 'Professional', 
    price: '$14.99',
    priceId: 'price_professional_placeholder',
    features: [
      'All Premium features',
      'Advanced audio control (Coming Soon)',
      'Wireless audio connectivity (Coming Soon)', 
      'Advanced performance tools (Coming Soon)',
      'Professional stage features (Coming Soon)',
      'Priority support'
    ],
    icon: Star
  }
];

const CheckoutForm = ({ plan, clientSecret }: { plan: PlanOption; clientSecret: string }) => {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [, setLocation] = useLocation();

  console.log('🔧 CheckoutForm render - stripe available:', !!stripe, 'elements available:', !!elements);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    console.log('🔄 Processing payment for plan:', plan.name);

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
      });

      if (error) {
        console.error('❌ Payment failed:', error.message);
        toast({
          title: "Payment Failed",
          description: error.message,
          variant: "destructive",
        });
      } else if (paymentIntent?.status === 'succeeded') {
        console.log('✅ Payment succeeded');
        
        // Update user subscription status
        const storedUser = localStorage.getItem('lpp_local_user');
        if (storedUser) {
          const userData = JSON.parse(storedUser);
          userData.userType = plan.id === 'premium' ? 'paid' : 'professional';
          userData.hasActiveSubscription = true;
          userData.subscriptionTier = plan.id;
          localStorage.setItem('lpp_local_user', JSON.stringify(userData));
          window.dispatchEvent(new Event('auth-change'));
        }

        toast({
          title: `Welcome to ${plan.name}!`,
          description: `Your ${plan.name} subscription is now active!`,
        });

        // Redirect to home page
        setTimeout(() => {
          setLocation('/');
        }, 2000);
      }
    } catch (error: any) {
      console.error('❌ Payment error:', error);
      toast({
        title: "Payment Error", 
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    }

    setIsProcessing(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      <Button 
        type="submit" 
        disabled={!stripe || isProcessing} 
        className="w-full"
        data-testid={`button-pay-${plan.id}`}
      >
        {isProcessing ? 'Processing...' : `Pay ${plan.price}/month`}
      </Button>
    </form>
  );
};

const PaymentPage = ({ plan, onBack }: { plan: PlanOption; onBack: () => void }) => {
  const [clientSecret, setClientSecret] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [stripeInstance, setStripeInstance] = useState<any>(null);
  const { toast } = useToast();

  // Initialize Stripe instance safely
  useEffect(() => {
    const setupStripe = async () => {
      try {
        console.log('🔄 Initializing Stripe instance...');
        const stripe = await initializeStripe();
        if (stripe) {
          console.log('✅ Stripe initialized successfully');
          setStripeInstance(stripe);
        } else {
          throw new Error('Failed to initialize Stripe');
        }
      } catch (error) {
        console.error('❌ Stripe initialization error:', error);
        toast({
          title: "Payment System Error",
          description: "Failed to initialize payment system",
          variant: "destructive",
        });
        onBack();
      }
    };

    setupStripe();
  }, [toast, onBack]);

  React.useEffect(() => {
    const createSubscription = async () => {
      try {
        console.log('🔄 PaymentPage useEffect - Creating subscription for plan:', plan.id);
        
        const storedUser = localStorage.getItem('lpp_local_user');
        if (!storedUser) {
          console.error('❌ No stored user found');
          toast({
            title: "Authentication Required",
            description: "Please sign in to subscribe.",
            variant: "destructive",
          });
          onBack();
          return;
        }

        const userData = JSON.parse(storedUser);
        console.log('🔄 Creating subscription for:', userData.email);

        const response = await fetch('/api/create-subscription', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: userData.email,
            planName: plan.id,
            priceId: plan.priceId
          }),
        });

        const data = await response.json();
        console.log('📊 Subscription API response:', { ok: response.ok, status: response.status, data });

        if (!response.ok) {
          throw new Error(data.message || 'Failed to create subscription');
        }

        if (!data.clientSecret) {
          console.error('❌ No clientSecret in response:', data);
          throw new Error('No client secret returned from server');
        }

        console.log('✅ Subscription created successfully, setting clientSecret');
        setClientSecret(data.clientSecret);
      } catch (error: any) {
        console.error('❌ Subscription creation failed:', error);
        console.error('Error stack:', error.stack);
        toast({
          title: "Subscription Error",
          description: error.message || 'Failed to start subscription process',
          variant: "destructive",
        });
        onBack();
      } finally {
        setIsLoading(false);
      }
    };

    createSubscription();
  }, [plan.id, plan.priceId, toast, onBack]);

  if (isLoading) {
    return (
      <div className="max-w-md mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-gray-600">Setting up your subscription...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!clientSecret) {
    return (
      <div className="max-w-md mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-red-600 mb-4">Failed to initialize payment</p>
              <Button onClick={onBack} variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Plans
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  console.log('🔧 PaymentPage render - clientSecret available:', !!clientSecret);

  return (
    <div className="max-w-md mx-auto p-6">
      <div className="mb-6">
        <Button variant="ghost" onClick={onBack} data-testid="button-back-to-plans">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Plans
        </Button>
      </div>

      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mb-4">
            <plan.icon className="w-8 h-8 text-white" />
          </div>
          <CardTitle>Subscribe to {plan.name}</CardTitle>
          <p className="text-gray-600">{plan.price}/month</p>
        </CardHeader>
        
        <CardContent>
          {stripeInstance ? (
            <Elements 
              stripe={stripeInstance} 
              options={{ 
                clientSecret,
                appearance: {
                  theme: 'stripe',
                }
              }}
            >
              <CheckoutForm plan={plan} clientSecret={clientSecret} />
            </Elements>
          ) : (
            <div className="text-center p-4">
              <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2" />
              <p className="text-sm text-gray-600">Initializing payment system...</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default function Subscribe() {
  const [selectedPlan, setSelectedPlan] = useState<PlanOption | null>(null);
  const [, setLocation] = useLocation();

  if (selectedPlan) {
    return <PaymentPage plan={selectedPlan} onBack={() => setSelectedPlan(null)} />;
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Choose Your Plan</h1>
        <p className="text-gray-600">Upgrade to unlock unlimited songs and advanced features</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
        {plans.map((plan) => {
          const Icon = plan.icon;
          
          return (
            <Card 
              key={plan.id} 
              className={`relative cursor-pointer transition-all hover:shadow-lg ${
                plan.popular ? 'ring-2 ring-yellow-400' : ''
              }`}
              onClick={() => setSelectedPlan(plan)}
              data-testid={`card-plan-${plan.id}`}
            >
              {plan.popular && (
                <Badge className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-yellow-400 text-black">
                  Most Popular
                </Badge>
              )}
              
              <CardHeader className="text-center pb-4">
                <div className="mx-auto w-12 h-12 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mb-3">
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <div className="text-2xl font-bold text-primary">{plan.price}<span className="text-sm text-gray-500">/month</span></div>
              </CardHeader>
              
              <CardContent>
                <ul className="space-y-2 mb-6">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-center text-sm">
                      <Check className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                
                <Button 
                  className="w-full" 
                  variant={plan.popular ? "default" : "outline"}
                  data-testid={`button-select-${plan.id}`}
                >
                  Select {plan.name}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="text-center mt-8">
        <Button variant="ghost" onClick={() => setLocation('/')} data-testid="button-back-home">
          Back to Home
        </Button>
      </div>
    </div>
  );
}