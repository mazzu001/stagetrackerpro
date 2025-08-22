import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft } from 'lucide-react';
import { useLocation } from 'wouter';

export default function SubscribeTest() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleTestSubscription = async () => {
    try {
      console.log('🔄 Testing subscription creation...');
      
      const storedUser = localStorage.getItem('lpp_local_user');
      if (!storedUser) {
        console.error('❌ No stored user found');
        return;
      }

      const userData = JSON.parse(storedUser);
      console.log('📧 User email:', userData.email);

      const response = await fetch('/api/create-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: userData.email,
          tier: 'premium',
          priceId: 'price_premium_placeholder'
        }),
      });

      const data = await response.json();
      console.log('📊 API Response:', data);

      if (response.ok && data.clientSecret) {
        console.log('✅ Client secret received successfully');
        toast({
          title: "Test Successful",
          description: "Subscription API is working correctly",
        });
      } else {
        console.error('❌ API Error:', data);
        toast({
          title: "Test Failed",
          description: data.message || 'API call failed',
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('❌ Test error:', error);
      toast({
        title: "Test Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="max-w-md mx-auto p-6">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => setLocation('/')} data-testid="button-back-home">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Button>
      </div>

      <Card>
        <CardHeader className="text-center">
          <CardTitle>Subscription Test Page</CardTitle>
          <p className="text-gray-600">Test subscription API without Stripe Elements</p>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <Button 
            onClick={handleTestSubscription}
            className="w-full"
            data-testid="button-test-subscription"
          >
            Test Subscription API
          </Button>
          
          <div className="text-sm text-gray-600">
            This page tests the subscription creation without loading Stripe Elements to isolate any errors.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}