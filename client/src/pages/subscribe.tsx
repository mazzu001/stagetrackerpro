import { useStripe, Elements, PaymentElement, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useEffect, useState } from 'react';
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Crown, Music, Zap, Star } from "lucide-react";

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
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.origin,
      },
    });

    if (error) {
      toast({
        title: "Payment Failed",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Payment Successful",
        description: "Welcome to Music Performance Pro! You now have unlimited songs.",
      });
      // Redirect to performance app after successful payment
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    }

    setIsProcessing(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      <Button 
        type="submit" 
        disabled={!stripe || isProcessing} 
        className="w-full h-12 text-lg"
        data-testid="button-subscribe"
      >
        {isProcessing ? "Processing..." : "Subscribe for $4.99/month"}
      </Button>
    </form>
  );
};

export default function Subscribe() {
  const [clientSecret, setClientSecret] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Create subscription payment intent
    apiRequest("POST", "/api/create-subscription")
      .then((res) => res.json())
      .then((data) => {
        setClientSecret(data.clientSecret);
      })
      .catch((error) => {
        console.error('Error creating subscription:', error);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-400">Setting up subscription...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-4">
            <Crown className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Upgrade to Music Performance Pro</h1>
          <p className="text-gray-400">Unlock unlimited songs and professional features</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Features */}
          <div className="space-y-6">
            <Card className="bg-surface border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center text-xl">
                  <Music className="w-5 h-5 mr-2 text-primary" />
                  What You Get
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start space-x-3">
                  <Star className="w-5 h-5 text-yellow-500 mt-0.5" />
                  <div>
                    <h3 className="font-medium">Unlimited Songs</h3>
                    <p className="text-sm text-gray-400">Create and manage as many songs as you need</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <Zap className="w-5 h-5 text-blue-500 mt-0.5" />
                  <div>
                    <h3 className="font-medium">Professional Features</h3>
                    <p className="text-sm text-gray-400">Advanced MIDI control, waveform analysis, and more</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <Crown className="w-5 h-5 text-purple-500 mt-0.5" />
                  <div>
                    <h3 className="font-medium">Priority Support</h3>
                    <p className="text-sm text-gray-400">Get help when you need it most</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="text-center p-6 bg-green-950/20 border border-green-500 rounded-lg">
              <h3 className="text-green-300 font-medium mb-2">Special Launch Price</h3>
              <p className="text-green-200 text-sm">
                Just $4.99/month - Cancel anytime. No setup fees or long-term commitments.
              </p>
            </div>
          </div>

          {/* Payment Form */}
          <Card className="bg-surface border-gray-700">
            <CardHeader>
              <CardTitle>Complete Your Subscription</CardTitle>
            </CardHeader>
            <CardContent>
              {clientSecret ? (
                <Elements stripe={stripePromise} options={{ clientSecret }}>
                  <SubscribeForm />
                </Elements>
              ) : (
                <div className="text-center py-8">
                  <p className="text-red-400">Unable to initialize payment. Please try again.</p>
                  <Button 
                    onClick={() => window.location.reload()} 
                    variant="outline" 
                    className="mt-4"
                  >
                    Retry
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Back to App */}
        <div className="text-center mt-8">
          <Button 
            variant="ghost" 
            onClick={() => window.location.href = '/'}
            data-testid="button-back-to-app"
          >
            ← Back to App
          </Button>
        </div>
      </div>
    </div>
  );
}