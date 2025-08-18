import { useStripe, Elements, PaymentElement, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useEffect, useState } from 'react';
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, CreditCard } from "lucide-react";

// Make sure to call `loadStripe` outside of a component's render to avoid
// recreating the `Stripe` object on every render.
if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
  throw new Error('Missing required Stripe key: VITE_STRIPE_PUBLIC_KEY');
}
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

const SubscribeForm = () => {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (!stripe || !elements) {
      setIsLoading(false);
      return;
    }

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.origin,
      },
    });

    setIsLoading(false);

    if (error) {
      toast({
        title: "Payment Failed",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Welcome to Pro!",
        description: "Your subscription is now active. You have full access to all features.",
      });
      // Redirect to performance page
      window.location.href = '/';
    }
  }

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="w-5 h-5" />
          Complete Your Subscription
        </CardTitle>
        <CardDescription>
          $4.99/month - Cancel anytime
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <PaymentElement />
          <Button 
            type="submit" 
            className="w-full" 
            disabled={!stripe || isLoading}
            data-testid="button-complete-payment"
          >
            {isLoading ? "Processing..." : "Complete Payment"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default function Subscribe() {
  const [clientSecret, setClientSecret] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // Create subscription as soon as the page loads
    apiRequest("POST", "/api/create-subscription")
      .then((res) => res.json())
      .then((data) => {
        console.log('Subscription response:', data);
        if (data.clientSecret) {
          setClientSecret(data.clientSecret);
        } else if (data.subscriptionId && !data.clientSecret) {
          // Subscription exists but no payment needed (already active)
          toast({
            title: "Already Subscribed",
            description: "You already have an active subscription!",
          });
          setTimeout(() => {
            window.location.href = '/';
          }, 2000);
        } else {
          console.error('No client secret in response:', data);
          toast({
            title: "Payment Setup Issue",
            description: "Unable to initialize payment. Please contact support if this continues.",
            variant: "destructive",
          });
        }
      })
      .catch((error) => {
        console.error('Subscription creation error:', error);
        toast({
          title: "Subscription Error",
          description: error.message || "Failed to create subscription. Please try again.",
          variant: "destructive",
        });
      })
      .finally(() => setIsLoading(false));
  }, [toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <Card className="max-w-md mx-auto">
          <CardContent className="flex items-center justify-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" aria-label="Loading"/>
            <span className="ml-3 text-lg">Setting up your subscription...</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!clientSecret) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <Card className="max-w-md mx-auto">
          <CardContent className="text-center py-12">
            <p className="text-red-500 mb-4">Failed to initialize payment</p>
            <Button onClick={() => window.location.href = '/'} data-testid="button-back-home">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 py-12">
      <div className="container mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Subscribe to Pro</h1>
          <p className="text-gray-400">Get full access to all professional features</p>
        </div>
        
        {/* Make SURE to wrap the form in <Elements> which provides the stripe context. */}
        <Elements stripe={stripePromise} options={{ clientSecret }}>
          <SubscribeForm />
        </Elements>

        <div className="text-center mt-8">
          <Button 
            variant="ghost" 
            onClick={() => window.location.href = '/'}
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </div>
      </div>
    </div>
  );
}