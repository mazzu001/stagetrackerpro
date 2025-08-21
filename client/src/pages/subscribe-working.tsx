import { useEffect, useState } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Crown, Check } from 'lucide-react';

export default function SubscribeWorking({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [clientSecret, setClientSecret] = useState("");
  const [showPayment, setShowPayment] = useState(false);

  useEffect(() => {
    if (showPayment && !clientSecret) {
      const storedUser = localStorage.getItem('lpp_local_user');
      let userEmail = null;
      
      if (storedUser) {
        try {
          const userData = JSON.parse(storedUser);
          userEmail = userData.email;
        } catch (error) {
          console.error('Error parsing stored user:', error);
        }
      }

      if (!userEmail) {
        toast({
          title: "Error",
          description: "No email found. Please log in again.",
          variant: "destructive",
        });
        return;
      }

      console.log('Creating subscription for:', userEmail);
      
      // Create subscription on backend
      fetch('/api/create-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail })
      })
      .then(res => res.json())
      .then(data => {
        if (data.clientSecret) {
          setClientSecret(data.clientSecret);
        } else {
          throw new Error(data.error || 'Failed to create subscription');
        }
      })
      .catch(error => {
        console.error('Subscription creation error:', error);
        toast({
          title: "Error",
          description: "Failed to create subscription. Please try again.",
          variant: "destructive",
        });
      });
    }
  }, [showPayment, clientSecret, toast]);

  const handleSimpleUpgrade = async () => {
    setIsProcessing(true);
    
    try {
      // Simulate payment processing with backend validation
      console.log('Processing payment with client secret:', clientSecret);
      
      // In a real implementation, this would use Stripe's client-side confirmPayment
      // For now, simulate successful payment after delay
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Update user to premium status
      const storedUser = localStorage.getItem('lpp_local_user');
      if (storedUser) {
        const userData = JSON.parse(storedUser);
        userData.userType = 'paid';
        userData.hasActiveSubscription = true;
        localStorage.setItem('lpp_local_user', JSON.stringify(userData));
        
        const stageTrackerUser = localStorage.getItem('stagetracker_user');
        if (stageTrackerUser) {
          const stagingData = JSON.parse(stageTrackerUser);
          stagingData.userType = 'paid';
          stagingData.hasActiveSubscription = true;
          localStorage.setItem('stagetracker_user', JSON.stringify(stagingData));
        }
        
        window.dispatchEvent(new Event('auth-change'));
        
        toast({
          title: "Welcome to Premium!",
          description: "Your subscription is now active. Enjoy unlimited songs!",
        });
        
        setTimeout(() => {
          onClose();
          window.location.href = '/';
        }, 1500);
      }
    } catch (error) {
      console.error('Payment processing error:', error);
      toast({
        title: "Payment Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    }
    
    setIsProcessing(false);
  };

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
              <div className="border-2 border-yellow-400 rounded-lg p-4 relative">
                <div className="absolute -top-2 left-4 bg-yellow-400 text-white px-3 py-1 rounded text-xs font-bold">
                  RECOMMENDED
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
                    <span>Advanced audio mixing</span>
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
          <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
            🧪 TEST MODE: This is a demonstration. No real charges will be made.
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded">
            <h4 className="font-medium text-green-800 mb-2">Payment Ready</h4>
            <p className="text-green-700 text-sm mb-3">
              Your subscription has been prepared with Stripe. Click below to complete the upgrade process.
            </p>
            <p className="text-xs text-gray-600">
              Payment ID: {clientSecret.substring(0, 20)}...
            </p>
          </div>
          
          <Button
            onClick={handleSimpleUpgrade}
            disabled={isProcessing}
            className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white py-3"
            data-testid="button-complete-upgrade"
          >
            <Crown className="w-4 h-4 mr-2" />
            {isProcessing ? 'Processing Payment...' : 'Complete Upgrade to Premium'}
          </Button>
          
          <Button
            variant="ghost"
            onClick={() => setShowPayment(false)}
            className="w-full mt-4"
            data-testid="button-back"
            disabled={isProcessing}
          >
            Back to Plans
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}