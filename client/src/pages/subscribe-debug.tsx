import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';

export default function SubscribeDebug() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [debugInfo, setDebugInfo] = useState<any>({});

  useEffect(() => {
    const info = {
      stripePublicKey: import.meta.env.VITE_STRIPE_PUBLIC_KEY ? 'EXISTS' : 'MISSING',
      stripeKeyStart: import.meta.env.VITE_STRIPE_PUBLIC_KEY?.substring(0, 7) || 'N/A',
      nodeEnv: import.meta.env.MODE,
      userAgent: navigator.userAgent,
      location: window.location.href
    };
    setDebugInfo(info);
    console.log('🔍 Debug Info:', info);
  }, []);

  const testStripeLoad = async () => {
    try {
      console.log('🔄 Testing Stripe load without using it...');
      
      // Test if we can access the Stripe key
      const key = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
      console.log('Key exists:', !!key);
      console.log('Key starts with pk_:', key?.startsWith('pk_'));
      
      // Test dynamic import
      const { loadStripe } = await import('@stripe/stripe-js');
      console.log('loadStripe imported successfully');
      
      // Don't actually call loadStripe yet
      toast({
        title: "Test Success",
        description: "Stripe imports work correctly",
      });
    } catch (error: any) {
      console.error('❌ Stripe load test error:', error);
      toast({
        title: "Test Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const testActualStripeLoad = async () => {
    try {
      console.log('🔄 Testing actual Stripe initialization...');
      
      const { loadStripe } = await import('@stripe/stripe-js');
      const stripe = await loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY!);
      
      console.log('Stripe instance:', stripe);
      
      toast({
        title: "Stripe Load Success",
        description: "Stripe loaded without error",
      });
    } catch (error: any) {
      console.error('❌ Actual Stripe load error:', error);
      toast({
        title: "Stripe Load Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="max-w-md mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Stripe Debug Page</CardTitle>
          <p className="text-gray-600">Test Stripe loading step by step</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-xs bg-gray-100 p-3 rounded">
            <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
          </div>
          
          <Button onClick={testStripeLoad} className="w-full">
            Test Stripe Import
          </Button>
          
          <Button onClick={testActualStripeLoad} className="w-full" variant="outline">
            Test Stripe Load
          </Button>
          
          <Button onClick={() => setLocation('/')} variant="ghost" className="w-full">
            Back to Home
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}