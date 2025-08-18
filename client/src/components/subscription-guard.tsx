import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Crown, Music, Lock, Star } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface SubscriptionGuardProps {
  songCount: number;
  onUpgrade: () => void;
}

export function SubscriptionGuard({ songCount, onUpgrade }: SubscriptionGuardProps) {
  const MAX_FREE_SONGS = 2;
  const songsRemaining = Math.max(0, MAX_FREE_SONGS - songCount);
  const isTrialExpired = songCount >= MAX_FREE_SONGS;

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

  if (hasActiveSubscription) {
    return null; // Don't show guard if user has active subscription
  }

  if (!isTrialExpired) {
    return (
      <div className="mb-6 p-4 bg-blue-950/20 border border-blue-500 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Star className="w-5 h-5 text-blue-400" />
            <div>
              <h3 className="text-blue-300 font-medium">Free Trial</h3>
              <p className="text-blue-200 text-sm">
                {songsRemaining} of {MAX_FREE_SONGS} songs remaining
              </p>
            </div>
          </div>
          <Button
            onClick={onUpgrade}
            variant="outline"
            size="sm"
            className="border-blue-500 text-blue-300 hover:bg-blue-500/20"
            data-testid="button-upgrade-trial"
          >
            <Crown className="w-4 h-4 mr-2" />
            Upgrade Now
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Card className="mb-6 bg-gradient-to-r from-purple-950/20 to-blue-950/20 border-purple-500">
      <CardHeader>
        <CardTitle className="flex items-center text-xl">
          <Lock className="w-6 h-6 mr-2 text-purple-400" />
          Trial Limit Reached
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-gray-300">
          You've created {songCount} songs and reached your free trial limit of {MAX_FREE_SONGS} songs.
        </p>
        
        <div className="bg-purple-950/30 border border-purple-600 rounded-lg p-4">
          <h3 className="text-purple-300 font-medium mb-2">Upgrade to Music Performance Pro</h3>
          <div className="space-y-2 text-sm text-purple-200">
            <div className="flex items-center space-x-2">
              <Music className="w-4 h-4" />
              <span>Unlimited songs</span>
            </div>
            <div className="flex items-center space-x-2">
              <Star className="w-4 h-4" />
              <span>Professional features</span>
            </div>
            <div className="flex items-center space-x-2">
              <Crown className="w-4 h-4" />
              <span>Priority support</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold text-primary">$4.99<span className="text-sm text-gray-400">/month</span></p>
            <p className="text-sm text-gray-400">Cancel anytime</p>
          </div>
          <Button
            onClick={onUpgrade}
            size="lg"
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            data-testid="button-upgrade-required"
          >
            <Crown className="w-5 h-5 mr-2" />
            Upgrade Now
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}