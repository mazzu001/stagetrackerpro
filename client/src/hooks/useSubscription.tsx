import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from './use-toast';
import { Crown } from 'lucide-react';
import { useLocalAuth } from './useLocalAuth';

export function useSubscription() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user, isPaidUser, isAuthenticated } = useLocalAuth();

  // For beta testing: Use local auth tier instead of server subscription check
  const subscriptionStatus = {
    hasActiveSubscription: isPaidUser && isAuthenticated,
    status: isPaidUser ? 'active' : 'inactive',
    tier: 3, // Professional tier for beta testing
    plan: 'professional',
    subscriptionTier: 'professional'
  };

  const isLoading = false; // No server call needed for beta testing

  const createSubscription = useMutation({
    mutationFn: async (email: string) => {
      // For beta testing, subscription creation is simulated
      toast({
        title: "Beta Testing Mode",
        description: "Subscription management is disabled in beta testing. You already have professional access!",
      });
      return { success: true, message: "Beta testing - professional tier active" };
    },
    onSuccess: () => {
      toast({
        title: "Professional Access Active!",
        description: "You have unlimited access to all features in beta testing mode.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Beta Testing Mode",
        description: "All features are available in beta testing.",
        variant: "default",
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