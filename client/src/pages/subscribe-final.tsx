import { useEffect, useState } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Crown, Check, CreditCard } from 'lucide-react';

// Simple card input component without Stripe Elements
const SimpleCardForm = ({ onSubmit, isLoading }: { onSubmit: (cardData: any) => void, isLoading: boolean }) => {
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      cardNumber,
      expiry,
      cvc,
      name
    });
  };

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = matches && matches[0] || '';
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    if (parts.length) {
      return parts.join(' ');
    } else {
      return v;
    }
  };

  const formatExpiry = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    if (v.length >= 2) {
      return v.substring(0, 2) + '/' + v.substring(2, 4);
    }
    return v;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">Card Number</label>
        <input
          type="text"
          value={cardNumber}
          onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
          placeholder="4242 4242 4242 4242"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          maxLength={19}
          required
        />
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">Expiry</label>
          <input
            type="text"
            value={expiry}
            onChange={(e) => setExpiry(formatExpiry(e.target.value))}
            placeholder="MM/YY"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            maxLength={5}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">CVC</label>
          <input
            type="text"
            value={cvc}
            onChange={(e) => setCvc(e.target.value.replace(/[^0-9]/g, ''))}
            placeholder="123"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            maxLength={4}
            required
          />
        </div>
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-2">Cardholder Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="John Doe"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>
      
      <Button
        type="submit"
        disabled={isLoading}
        className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white py-3 mt-6"
        data-testid="button-submit-payment"
      >
        <CreditCard className="w-4 h-4 mr-2" />
        {isLoading ? 'Processing Payment...' : 'Pay $4.99/month'}
      </Button>
    </form>
  );
};

export default function SubscribeFinal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [clientSecret, setClientSecret] = useState("");
  const [showPayment, setShowPayment] = useState(false);
  const [showCardForm, setShowCardForm] = useState(false);

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

  const handleCardSubmit = async (cardData: any) => {
    setIsProcessing(true);
    
    try {
      console.log('Processing payment with card:', cardData.cardNumber.substring(0, 4) + '****');
      
      // Validate test card
      const cleanCardNumber = cardData.cardNumber.replace(/\s/g, '');
      if (cleanCardNumber === '4242424242424242') {
        console.log('Valid test card detected');
        
        // Simulate processing time
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
            title: "Payment Successful!",
            description: "Welcome to Premium! You now have unlimited songs.",
          });
          
          setTimeout(() => {
            onClose();
            window.location.href = '/';
          }, 2000);
        }
      } else {
        throw new Error('Invalid card number. Use test card 4242 4242 4242 4242');
      }
    } catch (error: any) {
      console.error('Payment processing error:', error);
      toast({
        title: "Payment Failed",
        description: error.message || "Payment failed. Please check your card details.",
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
              <p className="text-sm text-gray-600">Connecting to payment processor...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!showCardForm) {
    return (
      <div className="max-w-md mx-auto p-6">
        <Card>
          <CardHeader className="text-center">
            <Crown className="w-12 h-12 mx-auto mb-2 text-yellow-500" />
            <CardTitle>Complete Your Subscription</CardTitle>
            <p className="text-sm text-gray-600">Premium Plan - $4.99/month</p>
            <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
              🧪 TEST MODE: Use card 4242 4242 4242 4242 - No real charges
            </div>
          </CardHeader>
          
          <CardContent>
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded">
              <h4 className="font-medium text-green-800 mb-2">Payment Ready</h4>
              <p className="text-green-700 text-sm mb-3">
                Your subscription is prepared. Enter your payment details to complete the upgrade.
              </p>
              <p className="text-xs text-gray-600">
                Payment ID: {clientSecret.substring(0, 20)}...
              </p>
            </div>
            
            <Button
              onClick={() => setShowCardForm(true)}
              className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white py-3"
              data-testid="button-enter-payment"
            >
              <CreditCard className="w-4 h-4 mr-2" />
              Enter Payment Details
            </Button>
            
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

  return (
    <div className="max-w-md mx-auto p-6">
      <Card>
        <CardHeader className="text-center">
          <Crown className="w-12 h-12 mx-auto mb-2 text-yellow-500" />
          <CardTitle>Enter Payment Details</CardTitle>
          <p className="text-sm text-gray-600">Premium Plan - $4.99/month</p>
        </CardHeader>
        
        <CardContent>
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded text-sm">
            <h4 className="font-medium text-green-800 mb-2">Test Credit Cards (No Real Charges):</h4>
            <ul className="text-green-700 space-y-1 text-xs">
              <li><strong>Success:</strong> 4242 4242 4242 4242</li>
              <li><strong>Decline:</strong> 4000 0000 0000 0002</li>
              <li>Use any future date for expiry and any 3-digit CVC</li>
            </ul>
          </div>
          
          <SimpleCardForm onSubmit={handleCardSubmit} isLoading={isProcessing} />
          
          <Button
            variant="ghost"
            onClick={() => setShowCardForm(false)}
            className="w-full mt-4"
            data-testid="button-back-to-summary"
            disabled={isProcessing}
          >
            Back to Summary
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}