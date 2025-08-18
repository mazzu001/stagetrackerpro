import { useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Crown, Music, Star, Check } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface SubscriptionGuardProps {
  songCount: number;
  onUpgrade: () => void;
}

export function SubscriptionGuard({ songCount, onUpgrade }: SubscriptionGuardProps) {
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const MAX_FREE_SONGS = 2;

  // Check subscription status
  const { data: user } = useQuery({
    queryKey: ['/api/auth/user'],
    queryFn: async () => {
      const res = await fetch('/api/auth/user');
      if (!res.ok) throw new Error('Failed to fetch user');
      return res.json();
    }
  });

  const hasActiveSubscription = user?.subscriptionStatus === 'active';

  const UpgradeDialog = () => (
    <Dialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center text-2xl">
            <Crown className="w-6 h-6 mr-2 text-primary" />
            Upgrade to Music Performance Pro
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Current Plan */}
            <Card className="border-gray-600">
              <CardHeader>
                <CardTitle className="text-lg text-gray-400">Free Trial</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center space-x-2 text-gray-400">
                  <Check className="w-4 h-4" />
                  <span>Up to 2 songs</span>
                </div>
                <div className="flex items-center space-x-2 text-gray-400">
                  <Check className="w-4 h-4" />
                  <span>Basic features</span>
                </div>
                <div className="text-xl font-bold">Free</div>
              </CardContent>
            </Card>

            {/* Pro Plan */}
            <Card className="border-primary bg-primary/10">
              <CardHeader>
                <CardTitle className="text-lg text-primary flex items-center">
                  <Crown className="w-5 h-5 mr-2" />
                  Pro Version
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center space-x-2 text-green-400">
                  <Check className="w-4 h-4" />
                  <span>Unlimited songs</span>
                </div>
                <div className="flex items-center space-x-2 text-green-400">
                  <Check className="w-4 h-4" />
                  <span>Advanced MIDI control</span>
                </div>
                <div className="flex items-center space-x-2 text-green-400">
                  <Check className="w-4 h-4" />
                  <span>Waveform analysis</span>
                </div>
                <div className="flex items-center space-x-2 text-green-400">
                  <Check className="w-4 h-4" />
                  <span>Priority support</span>
                </div>
                <div className="text-xl font-bold text-primary">
                  $4.99<span className="text-sm text-gray-400">/month</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="text-center space-y-4">
            <p className="text-gray-300">
              Perfect for live performers who need reliable, professional-grade tools
            </p>
            <div className="flex space-x-3 justify-center">
              <Button
                variant="outline"
                onClick={() => setShowUpgradeDialog(false)}
                data-testid="button-cancel-upgrade"
              >
                Maybe Later
              </Button>
              <Button
                onClick={() => {
                  setShowUpgradeDialog(false);
                  onUpgrade();
                }}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                data-testid="button-proceed-upgrade"
              >
                <Crown className="w-4 h-4 mr-2" />
                Upgrade Now
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <>
      {/* Status Label and Button */}
      <div className="flex items-center space-x-2">
        <span className={`px-2 py-1 rounded text-xs font-medium ${
          hasActiveSubscription 
            ? 'bg-green-500/20 text-green-300' 
            : 'bg-blue-500/20 text-blue-300'
        }`} data-testid="subscription-status">
          {hasActiveSubscription ? 'Full Version' : 'Trial'}
        </span>
        
        {!hasActiveSubscription && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowUpgradeDialog(true)}
            className="text-xs border-primary/50 text-primary hover:bg-primary/20"
            data-testid="button-subscribe-header"
          >
            <Crown className="w-3 h-3 mr-1" />
            Subscribe Now
          </Button>
        )}
      </div>

      <UpgradeDialog />
    </>
  );
}