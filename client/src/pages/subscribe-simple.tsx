import { useEffect, useState } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Crown, Check } from 'lucide-react';

export default function SubscribeSimple({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSimplePayment = async () => {
    setIsProcessing(true);
    
    try {
      // Simulate successful payment for testing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Update local user type to paid and preserve login
      const storedUser = localStorage.getItem('lpp_local_user');
      if (storedUser) {
        try {
          const userData = JSON.parse(storedUser);
          userData.userType = 'paid';
          userData.hasActiveSubscription = true;
          localStorage.setItem('lpp_local_user', JSON.stringify(userData));
          
          // Also preserve the login in stagetracker_user for compatibility
          const stageTrackerUser = localStorage.getItem('stagetracker_user');
          if (stageTrackerUser) {
            const stagingData = JSON.parse(stageTrackerUser);
            stagingData.userType = 'paid';
            stagingData.hasActiveSubscription = true;
            localStorage.setItem('stagetracker_user', JSON.stringify(stagingData));
          }
          
          // Trigger auth change event to update the UI
          window.dispatchEvent(new Event('auth-change'));
          
          toast({
            title: "Welcome to Premium!",
            description: "Your subscription is now active. Enjoy unlimited songs!",
          });
          
          // Wait a moment to ensure auth state is updated
          setTimeout(() => {
            onClose();
            window.location.href = '/'; // Redirect to main app
          }, 1000);
        } catch (error) {
          console.error('Error updating user type:', error);
        }
      }
    } catch (error) {
      toast({
        title: "Payment Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    }
    
    setIsProcessing(false);
  };

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
            <div className="p-4 bg-blue-50 border border-blue-200 rounded">
              <h4 className="font-medium text-blue-800 mb-2">🧪 TEST MODE ACTIVE</h4>
              <p className="text-blue-700 text-sm">
                This is a demonstration version. No real payment will be processed.
                Click the button below to simulate a successful subscription upgrade.
              </p>
            </div>
            
            <Button
              onClick={handleSimplePayment}
              disabled={isProcessing}
              className="bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white px-8 py-3"
              data-testid="button-simple-upgrade"
            >
              <Crown className="w-4 h-4 mr-2" />
              {isProcessing ? 'Processing...' : 'Upgrade to Premium (Demo)'}
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