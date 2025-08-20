import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from './use-toast';
import { Crown } from 'lucide-react';

export function useSubscription() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: subscriptionStatus, isLoading } = useQuery({
    queryKey: ['/api/subscription-status'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/subscription-status');
      if (!response.ok) {
        if (response.status === 401) {
          return { hasActiveSubscription: false, status: 'unauthenticated' };
        }
        throw new Error('Failed to fetch subscription status');
      }
      return response.json();
    },
    retry: 1,
  });

  const createSubscription = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/create-subscription');
      if (!response.ok) {
        throw new Error('Failed to create subscription');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/subscription-status'] });
      toast({
        title: "Subscription Created!",
        description: "Welcome to Premium! You now have access to all features.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Subscription Failed",
        description: error.message || "Failed to create subscription",
        variant: "destructive",
      });
    },
  });

  const hasActiveSubscription = subscriptionStatus?.hasActiveSubscription || false;
  const isFreeTier = !hasActiveSubscription;
  const subscriptionDetails = subscriptionStatus;

  return {
    hasActiveSubscription,
    isFreeTier,
    subscriptionDetails,
    isLoading,
    createSubscription,
  };
}

export function useUpgradePrompt() {
  const { toast } = useToast();

  const showUpgradePrompt = (message?: string, actionText = "Upgrade Now") => {
    toast({
      title: "Premium Feature",
      description: message || "This feature requires a Premium subscription.",
      action: (
        <button
          onClick={() => window.location.href = '/subscribe'}
          className="bg-primary text-primary-foreground px-3 py-1 rounded text-sm hover:bg-primary/90 transition-colors"
        >
          {actionText}
        </button>
      ),
      duration: 10000, // Show longer for upgrade prompts
    });
  };

  const handleSongLimitExceeded = () => {
    toast({
      title: "Song Limit Reached",
      description: "Free accounts are limited to 2 songs. Upgrade to Premium for unlimited songs!",
      action: (
        <button
          onClick={() => window.location.href = '/subscribe'}
          className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-4 py-2 rounded text-sm hover:from-yellow-500 hover:to-orange-600 transition-colors flex items-center gap-2"
        >
          <Crown className="w-4 h-4" />
          Upgrade Now
        </button>
      ),
      duration: 15000, // Show longer for upgrade prompts
    });
  };

  return {
    showUpgradePrompt,
    handleSongLimitExceeded,
  };
}