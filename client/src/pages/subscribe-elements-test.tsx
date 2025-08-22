import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY!);

function TestComponent() {
  return <div>Elements component loaded successfully!</div>;
}

export default function SubscribeElementsTest() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [clientSecret, setClientSecret] = useState('');
  const [showElements, setShowElements] = useState(false);

  const createClientSecret = async () => {
    try {
      console.log('🔄 Creating client secret for Elements test...');
      
      const storedUser = localStorage.getItem('lpp_local_user');
      if (!storedUser) {
        toast({
          title: "Error",
          description: "No user found",
          variant: "destructive",
        });
        return;
      }

      const userData = JSON.parse(storedUser);
      
      const response = await fetch('/api/create-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userData.email,
          tier: 'premium',
          priceId: 'price_premium_placeholder'
        }),
      });

      const data = await response.json();
      
      if (response.ok && data.clientSecret) {
        console.log('✅ Client secret created:', data.clientSecret.substring(0, 20) + '...');
        setClientSecret(data.clientSecret);
        toast({
          title: "Success",
          description: "Client secret created",
        });
      } else {
        throw new Error('Failed to create client secret');
      }
    } catch (error: any) {
      console.error('❌ Client secret creation error:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const testElementsRender = () => {
    console.log('🔄 Testing Elements component render...');
    if (!clientSecret) {
      toast({
        title: "Error",
        description: "Need client secret first",
        variant: "destructive",
      });
      return;
    }
    
    console.log('🔄 About to render Elements component...');
    setShowElements(true);
    console.log('✅ Elements component render triggered');
  };

  return (
    <div className="max-w-md mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Elements Component Test</CardTitle>
          <p className="text-gray-600">Test Stripe Elements step by step</p>
        </CardHeader>
        <CardContent className="space-y-4">
          
          <Button onClick={createClientSecret} className="w-full">
            Step 1: Create Client Secret
          </Button>
          
          {clientSecret && (
            <div className="text-xs bg-green-100 p-2 rounded">
              ✅ Client Secret: {clientSecret.substring(0, 20)}...
            </div>
          )}
          
          <Button 
            onClick={testElementsRender} 
            className="w-full" 
            disabled={!clientSecret}
          >
            Step 2: Render Elements Component
          </Button>
          
          {showElements && clientSecret && (
            <div className="border p-4 rounded">
              <p className="mb-2">Testing Elements component:</p>
              <Elements stripe={stripePromise} options={{ clientSecret }}>
                <TestComponent />
              </Elements>
            </div>
          )}
          
          <Button onClick={() => setLocation('/')} variant="ghost" className="w-full">
            Back to Home
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}