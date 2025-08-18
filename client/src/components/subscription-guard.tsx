import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard, Lock, Zap } from "lucide-react";

interface SubscriptionGuardProps {
  children: React.ReactNode;
}

export function SubscriptionGuard({ children }: SubscriptionGuardProps) {
  const { toast } = useToast();
  const [showSubscriptionPrompt, setShowSubscriptionPrompt] = useState(false);

  const { data: subscriptionStatus, isLoading } = useQuery({
    queryKey: ["/api/subscription/status"],
    retry: false,
  });

  useEffect(() => {
    const status = subscriptionStatus as any;
    if (status && !status.hasSubscription) {
      setShowSubscriptionPrompt(true);
    } else if (status && status.status !== 'active') {
      toast({
        title: "Subscription Issue",
        description: "Your subscription is not active. Please check your payment method.",
        variant: "destructive",
      });
      setShowSubscriptionPrompt(true);
    }
  }, [subscriptionStatus, toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (showSubscriptionPrompt) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <Card className="max-w-md mx-auto bg-slate-800 border-slate-700 text-white">
          <CardHeader className="text-center">
            <Lock className="w-12 h-12 text-purple-400 mx-auto mb-4" />
            <CardTitle className="text-2xl">Subscription Required</CardTitle>
            <CardDescription className="text-gray-300">
              Get full access to all professional performance features for just $4.99/month
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center text-sm">
                <Zap className="w-4 h-4 text-green-400 mr-2" />
                Up to 6 tracks per song
              </div>
              <div className="flex items-center text-sm">
                <Zap className="w-4 h-4 text-green-400 mr-2" />
                Unlimited songs
              </div>
              <div className="flex items-center text-sm">
                <Zap className="w-4 h-4 text-green-400 mr-2" />
                MIDI event sequencing
              </div>
              <div className="flex items-center text-sm">
                <Zap className="w-4 h-4 text-green-400 mr-2" />
                Lyrics import & editing
              </div>
              <div className="flex items-center text-sm">
                <Zap className="w-4 h-4 text-green-400 mr-2" />
                Real-time visualization
              </div>
            </div>
            
            <Button 
              className="w-full bg-purple-600 hover:bg-purple-700"
              onClick={() => window.location.href = '/subscribe'}
              data-testid="button-subscribe-guard"
            >
              <CreditCard className="w-4 h-4 mr-2" />
              Subscribe Now - $4.99/month
            </Button>

            <Button 
              variant="ghost" 
              className="w-full text-gray-400 hover:text-white"
              onClick={() => window.location.href = '/api/logout'}
              data-testid="button-logout"
            >
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}