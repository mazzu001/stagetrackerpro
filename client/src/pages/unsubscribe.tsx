import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Crown, Star, Heart, Music, Headphones, Zap, AlertTriangle } from 'lucide-react';
import { useLocalAuth } from '@/hooks/useLocalAuth';

const retentionOffers = [
  {
    id: 'pause',
    title: 'Pause Your Subscription',
    description: 'Take a break for up to 3 months and keep your data',
    icon: Heart,
    action: 'Pause Subscription',
    variant: 'outline' as const
  },
  {
    id: 'discount',
    title: '50% Off Next 3 Months',
    description: 'Special offer just for you - continue at half price',
    icon: Star,
    action: 'Apply Discount',
    variant: 'default' as const
  },
  {
    id: 'downgrade',
    title: 'Switch to Premium',
    description: 'Keep unlimited songs at a lower monthly price',
    icon: Crown,
    action: 'Downgrade to Premium',
    variant: 'outline' as const
  }
];

const cancellationReasons = [
  'Too expensive',
  'Not using all features',
  'Found a better alternative',
  'Technical issues',
  'No longer performing live',
  'Temporary financial situation',
  'Other'
];

export default function Unsubscribe() {
  const [, setLocation] = useLocation();
  const { user, isLoading } = useLocalAuth();
  const { toast } = useToast();
  const [step, setStep] = useState<'retention' | 'feedback' | 'confirm'>('retention');
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [additionalFeedback, setAdditionalFeedback] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Redirect if not authenticated or free user - but wait for loading to complete
  useEffect(() => {
    if (!isLoading) {
      if (!user || user.userType === 'free' || !user.userType) {
        console.log('🚫 Unsubscribe access denied - User type:', user?.userType, 'User exists:', !!user);
        setLocation('/');
      } else {
        console.log('✅ Unsubscribe access granted - User type:', user.userType);
      }
    }
  }, [user, isLoading, setLocation]);

  const handleRetentionOffer = async (offerId: string) => {
    setIsProcessing(true);
    
    try {
      // Simulate API call for retention offers
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      switch (offerId) {
        case 'pause':
          toast({
            title: "Subscription Paused",
            description: "Your subscription is paused for 3 months. You can reactivate anytime.",
          });
          break;
        case 'discount':
          toast({
            title: "Discount Applied",
            description: "You'll receive 50% off your next 3 billing cycles!",
          });
          break;
        case 'downgrade':
          toast({
            title: "Plan Changed",
            description: "You've been switched to Premium. Your next bill will reflect the new rate.",
          });
          break;
      }
      
      setTimeout(() => setLocation('/'), 2000);
    } catch (error) {
      toast({
        title: "Error",
        description: "Unable to process your request. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReasonToggle = (reason: string) => {
    setSelectedReasons(prev => 
      prev.includes(reason) 
        ? prev.filter(r => r !== reason)
        : [...prev, reason]
    );
  };

  const handleFinalCancel = async () => {
    setIsProcessing(true);
    
    try {
      const response = await fetch('/api/cancel-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: user?.email,
          reasons: selectedReasons,
          feedback: additionalFeedback
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to cancel subscription');
      }

      toast({
        title: "Subscription Cancelled",
        description: "Your subscription has been cancelled. You'll retain access until your current billing period ends.",
      });

      // Update local user data
      const userData = localStorage.getItem('lpp_local_user');
      if (userData) {
        const user = JSON.parse(userData);
        user.userType = 'free';
        user.hasActiveSubscription = false;
        localStorage.setItem('lpp_local_user', JSON.stringify(user));
        window.dispatchEvent(new Event('auth-change'));
      }

      setTimeout(() => setLocation('/'), 3000);
    } catch (error) {
      toast({
        title: "Error",
        description: "Unable to cancel subscription. Please contact support.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Show loading while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Checking access permissions...</p>
        </div>
      </div>
    );
  }

  // Don't render anything if user is not eligible (redirect will happen via useEffect)
  if (!user || user.userType === 'free' || !user.userType) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            onClick={() => setLocation('/')}
            className="flex items-center gap-2"
            data-testid="button-back-home"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to App
          </Button>
          <div>
            <h1 className="text-3xl font-bold">We're Sorry to See You Go</h1>
            <p className="text-muted-foreground">Let's see if we can help before you cancel</p>
          </div>
        </div>

        {step === 'retention' && (
          <div className="space-y-6">
            {/* Current Plan Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Music className="w-5 h-5" />
                  Your Current Plan
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {user.userType === 'professional' ? (
                      <>
                        <Star className="w-6 h-6 text-yellow-500" />
                        <div>
                          <h3 className="font-semibold">Professional Plan</h3>
                          <p className="text-sm text-muted-foreground">Full audio integration and advanced features</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <Crown className="w-6 h-6 text-purple-500" />
                        <div>
                          <h3 className="font-semibold">Premium Plan</h3>
                          <p className="text-sm text-muted-foreground">Unlimited songs and advanced lyrics</p>
                        </div>
                      </>
                    )}
                  </div>
                  <Badge variant="secondary">Active</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Retention Offers */}
            <div className="grid md:grid-cols-3 gap-4">
              {retentionOffers.map((offer) => {
                const Icon = offer.icon;
                return (
                  <Card key={offer.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader className="text-center">
                      <Icon className="w-8 h-8 mx-auto mb-2 text-primary" />
                      <CardTitle className="text-lg">{offer.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="text-center space-y-4">
                      <p className="text-sm text-muted-foreground">{offer.description}</p>
                      <Button
                        variant={offer.variant}
                        onClick={() => handleRetentionOffer(offer.id)}
                        disabled={isProcessing}
                        className="w-full"
                        data-testid={`button-retention-${offer.id}`}
                      >
                        {isProcessing ? 'Processing...' : offer.action}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Features Reminder */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Headphones className="w-5 h-5" />
                  You'll Lose Access To
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Zap className="w-4 h-4 text-yellow-500" />
                      Unlimited song storage
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Zap className="w-4 h-4 text-yellow-500" />
                      Advanced waveform visualization
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Zap className="w-4 h-4 text-yellow-500" />
                      Timestamped lyrics with automation
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Zap className="w-4 h-4 text-yellow-500" />
                      Professional stage features
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Zap className="w-4 h-4 text-yellow-500" />
                      Audio device integration
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Zap className="w-4 h-4 text-yellow-500" />
                      Priority support
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Continue to Cancel */}
            <div className="text-center">
              <Button
                variant="ghost"
                onClick={() => setStep('feedback')}
                className="text-muted-foreground hover:text-foreground"
                data-testid="button-continue-cancel"
              >
                No thanks, continue with cancellation
              </Button>
            </div>
          </div>
        )}

        {step === 'feedback' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-500" />
                Help Us Improve
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="text-base font-medium">Why are you cancelling? (Select all that apply)</Label>
                <div className="grid md:grid-cols-2 gap-3 mt-3">
                  {cancellationReasons.map((reason) => (
                    <div key={reason} className="flex items-center space-x-2">
                      <Checkbox
                        id={reason}
                        checked={selectedReasons.includes(reason)}
                        onCheckedChange={() => handleReasonToggle(reason)}
                        data-testid={`checkbox-reason-${reason.toLowerCase().replace(/\s+/g, '-')}`}
                      />
                      <Label htmlFor={reason} className="text-sm cursor-pointer">
                        {reason}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="feedback" className="text-base font-medium">
                  Additional feedback (optional)
                </Label>
                <Textarea
                  id="feedback"
                  placeholder="Tell us more about your experience or what could have been better..."
                  value={additionalFeedback}
                  onChange={(e) => setAdditionalFeedback(e.target.value)}
                  className="mt-2"
                  data-testid="textarea-additional-feedback"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setStep('retention')}
                  className="flex-1"
                  data-testid="button-back-retention"
                >
                  Back to Offers
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setStep('confirm')}
                  className="flex-1"
                  data-testid="button-continue-feedback"
                >
                  Continue Cancellation
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 'confirm' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-5 h-5" />
                Confirm Cancellation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-muted p-4 rounded-lg">
                <h3 className="font-medium mb-2">What happens next:</h3>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>• Your subscription will be cancelled immediately</li>
                  <li>• You'll retain access until your current billing period ends</li>
                  <li>• Your account will automatically switch to the free plan (2 songs limit)</li>
                  <li>• All your local music files and data will be preserved</li>
                  <li>• You can resubscribe anytime to regain full access</li>
                </ul>
              </div>

              <div className="flex gap-4">
                <Button
                  variant="outline"
                  onClick={() => setStep('feedback')}
                  className="flex-1"
                  data-testid="button-back-feedback"
                >
                  Go Back
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleFinalCancel}
                  disabled={isProcessing}
                  className="flex-1"
                  data-testid="button-final-cancel"
                >
                  {isProcessing ? 'Cancelling...' : 'Yes, Cancel My Subscription'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}