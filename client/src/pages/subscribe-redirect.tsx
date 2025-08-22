import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Crown, Star, Check, ArrowLeft } from 'lucide-react';
import { useLocation } from 'wouter';

interface PlanOption {
  id: string;
  name: string;
  price: string;
  features: string[];
  icon: React.ComponentType<any>;
  popular?: boolean;
}

const plans: PlanOption[] = [
  {
    id: 'premium',
    name: 'Premium',
    price: '$4.99',
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
    features: [
      'All Premium features',
      'MIDI integration (Coming Soon)',
      'Bluetooth MIDI connectivity (Coming Soon)', 
      'Advanced performance tools (Coming Soon)',
      'Professional stage features (Coming Soon)',
      'Priority support'
    ],
    icon: Star
  }
];

export default function SubscribeRedirect() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  const handleSubscribe = async (plan: PlanOption) => {
    setIsProcessing(plan.id);

    try {
      const storedUser = localStorage.getItem('lpp_local_user');
      if (!storedUser) {
        toast({
          title: "Authentication Required",
          description: "Please sign in to subscribe.",
          variant: "destructive",
        });
        setLocation('/');
        return;
      }

      const userData = JSON.parse(storedUser);

      // Create Stripe Checkout Session instead of using Elements
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: userData.email,
          tier: plan.id,
          priceAmount: plan.id === 'premium' ? 499 : 1499, // cents
          successUrl: `${window.location.origin}/?payment=success`,
          cancelUrl: `${window.location.origin}/subscribe`
        }),
      });

      const data = await response.json();

      if (response.ok && data.url) {
        // Redirect to Stripe Checkout
        window.location.href = data.url;
      } else {
        throw new Error(data.message || 'Failed to create checkout session');
      }
    } catch (error: any) {
      console.error('Subscription error:', error);
      toast({
        title: "Subscription Error",
        description: error.message || 'Failed to start subscription process',
        variant: "destructive",
      });
    } finally {
      setIsProcessing(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Choose Your Plan</h1>
        <p className="text-gray-600">Upgrade to unlock unlimited songs and advanced features</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
        {plans.map((plan) => {
          const Icon = plan.icon;
          const isLoading = isProcessing === plan.id;
          
          return (
            <Card 
              key={plan.id} 
              className={`relative transition-all hover:shadow-lg ${
                plan.popular ? 'ring-2 ring-yellow-400' : ''
              } ${isLoading ? 'opacity-75' : ''}`}
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
                <div className="text-2xl font-bold text-primary">
                  {plan.price}
                  <span className="text-sm text-gray-500">/month</span>
                </div>
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
                  onClick={() => handleSubscribe(plan)}
                  className="w-full" 
                  variant={plan.popular ? "default" : "outline"}
                  disabled={isLoading}
                  data-testid={`button-subscribe-${plan.id}`}
                >
                  {isLoading ? (
                    <div className="flex items-center">
                      <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                      Processing...
                    </div>
                  ) : (
                    `Subscribe to ${plan.name}`
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="text-center mt-8">
        <Button variant="ghost" onClick={() => setLocation('/')} data-testid="button-back-home">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Button>
      </div>

      <div className="text-center mt-6 text-sm text-gray-500">
        <p>Secure payment powered by Stripe</p>
        <p>Cancel anytime from your account settings</p>
      </div>
    </div>
  );
}