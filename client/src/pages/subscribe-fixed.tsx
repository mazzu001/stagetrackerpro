import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';

// Don't initialize stripe globally - do it only when needed
let stripePromise: Promise<any> | null = null;

const getStripe = () => {
  if (!stripePromise) {
    stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY!);
  }
  return stripePromise;
};

function CheckoutForm() {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
      });

      if (error) {
        toast({
          title: "Payment Failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        // Update user status
        const storedUser = localStorage.getItem('lpp_local_user');
        if (storedUser) {
          const userData = JSON.parse(storedUser);
          userData.userType = 'paid';
          userData.hasActiveSubscription = true;
          userData.subscriptionTier = 'premium';
          localStorage.setItem('lpp_local_user', JSON.stringify(userData));
          window.dispatchEvent(new Event('auth-change'));
        }

        toast({
          title: "Success!",
          description: "Welcome to Premium!",
        });
        
        setTimeout(() => setLocation('/'), 1500);
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "Payment failed",
        variant: "destructive",
      });
    }

    setIsLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement 
        options={{
          layout: 'tabs'
        }}
      />
      <Button 
        type="submit" 
        disabled={!stripe || isLoading} 
        className="w-full"
      >
        {isLoading ? 'Processing...' : 'Subscribe for $4.99/month'}
      </Button>
    </form>
  );
}

export default function SubscribeFixed() {
  const [clientSecret, setClientSecret] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  useEffect(() => {
    let mounted = true;

    const initializePayment = async () => {
      try {
        const storedUser = localStorage.getItem('lpp_local_user');
        if (!storedUser) {
          setLocation('/');
          return;
        }

        const userData = JSON.parse(storedUser);
        
        const response = await fetch('/api/create-subscription', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: userData.email,
            tier: 'premium',
            priceId: 'price_premium_placeholder'
          }),
        });

        if (!mounted) return;

        const data = await response.json();
        
        if (response.ok && data.clientSecret) {
          setClientSecret(data.clientSecret);
        } else {
          throw new Error('Failed to create payment intent');
        }
      } catch (error) {
        if (!mounted) return;
        
        toast({
          title: "Error",
          description: "Failed to initialize payment",
          variant: "destructive",
        });
        setLocation('/');
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    initializePayment();

    return () => {
      mounted = false;
    };
  }, [toast, setLocation]);

  if (isLoading) {
    return (
      <div className="max-w-md mx-auto p-6">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
            <p>Setting up payment...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!clientSecret) {
    return (
      <div className="max-w-md mx-auto p-6">
        <Card>
          <CardContent className="pt-6 text-center">
            <p>Unable to initialize payment</p>
            <Button onClick={() => setLocation('/')} className="mt-4">
              Back to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const options = {
    clientSecret,
    appearance: {
      theme: 'stripe' as const,
    },
  };

  return (
    <div className="max-w-md mx-auto p-6">
      <Card>
        <CardHeader className="text-center">
          <CardTitle>Subscribe to Premium</CardTitle>
          <p className="text-gray-600">$4.99/month - Unlimited songs</p>
        </CardHeader>
        <CardContent>
          <Elements stripe={getStripe()} options={options}>
            <CheckoutForm />
          </Elements>
        </CardContent>
      </Card>
    </div>
  );
}