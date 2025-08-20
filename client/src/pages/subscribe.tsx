import { useStripe, Elements, PaymentElement, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useEffect, useState } from 'react';
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Crown, Check, Music } from 'lucide-react';

// Make sure to call `loadStripe` outside of a component's render to avoid
// recreating the `Stripe` object on every render.
if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
  throw new Error('Missing required Stripe key: VITE_STRIPE_PUBLIC_KEY');
}
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

const SubscribeForm = ({ onSuccess }: { onSuccess: () => void }) => {
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

    if (error) {
      toast({
        title: "Payment Failed",
        description: error.message,
        variant: "destructive",
      });
    } else {
      // Update local user type to paid
      const storedUser = localStorage.getItem('lpp_local_user');
      if (storedUser) {
        try {
          const userData = JSON.parse(storedUser);
          userData.userType = 'paid';
          localStorage.setItem('lpp_local_user', JSON.stringify(userData));
          
          // Trigger auth change event to update the UI
          window.dispatchEvent(new Event('auth-change'));
        } catch (error) {
          console.error('Error updating user type:', error);
        }
      }
      
      toast({
        title: "Welcome to Premium!",
        description: "Your subscription is now active. Enjoy unlimited songs!",
      });
      onSuccess();
    }
    
    setIsLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      <Button 
        type="submit" 
        disabled={!stripe || isLoading} 
        className="w-full"
        data-testid="button-subscribe"
      >
        {isLoading ? 'Processing...' : 'Subscribe to Premium - $4.99/month'}
      </Button>
    </form>
  );
};

export default function Subscribe({ onClose }: { onClose: () => void }) {
  const [clientSecret, setClientSecret] = useState("");
  const [showPayment, setShowPayment] = useState(false);

  useEffect(() => {
    // Create subscription when payment form is shown
    if (showPayment && !clientSecret) {
      // Get user email from localStorage
      const storedUser = localStorage.getItem('lpp_local_user');
      let userEmail = 'user@example.com'; // Default fallback
      
      if (storedUser) {
        try {
          const userData = JSON.parse(storedUser);
          userEmail = userData.email || 'user@example.com';
        } catch (error) {
          console.error('Error parsing user data:', error);
        }
      }
      
      console.log('Creating subscription for:', userEmail);
      
      fetch('/api/create-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: userEmail }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.clientSecret) {
            setClientSecret(data.clientSecret);
          } else {
            console.error('No client secret returned:', data);
          }
        })
        .catch((error) => {
          console.error('Error creating subscription:', error);
        });
    }
  }, [showPayment, clientSecret]);

  if (!showPayment) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mb-4">
              <Crown className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-2xl">Upgrade to Premium</CardTitle>
            <p className="text-gray-600">Unlock unlimited songs and advanced features</p>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Free Plan */}
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-2">Free Plan</h3>
                <p className="text-2xl font-bold mb-4">$0<span className="text-sm font-normal">/month</span></p>
                <ul className="space-y-2 mb-4">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>Up to 2 songs</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>Basic audio controls</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>Lyrics display</span>
                  </li>
                </ul>
              </div>

              {/* Premium Plan */}
              <div className="border-2 border-orange-500 rounded-lg p-4 relative">
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                    Recommended
                  </span>
                </div>
                <h3 className="font-semibold mb-2">Premium Plan</h3>
                <p className="text-2xl font-bold mb-4">$4.99<span className="text-sm font-normal">/month</span></p>
                <ul className="space-y-2 mb-4">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>Unlimited songs</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>Up to 6 tracks per song</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>Advanced audio mixing</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>MIDI integration</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>Priority support</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="text-center space-y-4">
              <Button
                onClick={() => setShowPayment(true)}
                className="bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white px-8 py-3"
                data-testid="button-show-payment"
              >
                <Crown className="w-4 h-4 mr-2" />
                Upgrade to Premium
              </Button>
              
              <Button
                variant="ghost"
                onClick={onClose}
                data-testid="button-cancel"
              >
                Continue with Free Plan
              </Button>
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
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Setting up your subscription...</h3>
              <p className="text-sm text-gray-600">Please wait while we prepare your payment.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-6">
      <Card>
        <CardHeader className="text-center">
          <Crown className="w-12 h-12 mx-auto mb-2 text-yellow-500" />
          <CardTitle>Complete Your Subscription</CardTitle>
          <p className="text-sm text-gray-600">Premium Plan - $4.99/month</p>
        </CardHeader>
        
        <CardContent>
          <Elements stripe={stripePromise} options={{ clientSecret }}>
            <SubscribeForm onSuccess={onClose} />
          </Elements>
          
          <Button
            variant="ghost"
            onClick={() => setShowPayment(false)}
            className="w-full mt-4"
            data-testid="button-back"
          >
            Back to Plans
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}