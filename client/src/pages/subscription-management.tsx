import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useLocalAuth } from '@/hooks/useLocalAuth';
import { ArrowLeft, CreditCard, Calendar, DollarSign, AlertCircle, CheckCircle, XCircle, Download, ExternalLink } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface SubscriptionDetails {
  id: string;
  status: 'active' | 'canceled' | 'past_due' | 'unpaid' | 'trialing';
  currentPeriodStart: number;
  currentPeriodEnd: number;
  cancelAtPeriodEnd: boolean;
  planName: string;
  amount: number;
  currency: string;
  interval: string;
  customerId: string;
}

interface Invoice {
  id: string;
  status: string;
  amount: number;
  currency: string;
  created: number;
  hostedInvoiceUrl?: string;
  invoicePdf?: string;
}

export default function SubscriptionManagement() {
  const [, setLocation] = useLocation();
  const { user } = useLocalAuth();
  const { toast } = useToast();
  
  const [subscription, setSubscription] = useState<SubscriptionDetails | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [canceling, setCanceling] = useState(false);

  useEffect(() => {
    if (!user?.email) {
      setLocation('/');
      return;
    }
    loadSubscriptionDetails();
  }, [user?.email, setLocation]);

  const loadSubscriptionDetails = async () => {
    try {
      setLoading(true);
      const response = await apiRequest('GET', '/api/subscription/details');
      const data = await response.json();
      
      if (data.subscription) {
        setSubscription(data.subscription);
        setInvoices(data.invoices || []);
      }
    } catch (error) {
      console.error('Error loading subscription details:', error);
      toast({
        title: "Error Loading Subscription",
        description: "Unable to load subscription details. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    try {
      setCanceling(true);
      const response = await apiRequest('POST', '/api/subscription/cancel');
      const data = await response.json();
      
      if (data.success) {
        setSubscription(prev => prev ? { ...prev, cancelAtPeriodEnd: true } : null);
        toast({
          title: "Subscription Canceled",
          description: "Your subscription will end at the current billing period. You'll continue to have access until then.",
        });
      } else {
        throw new Error(data.error || 'Failed to cancel subscription');
      }
    } catch (error) {
      console.error('Error canceling subscription:', error);
      toast({
        title: "Cancellation Failed",
        description: "Unable to cancel subscription. Please try again or contact support.",
        variant: "destructive",
      });
    } finally {
      setCanceling(false);
    }
  };

  const handleReactivateSubscription = async () => {
    try {
      setCanceling(true);
      const response = await apiRequest('POST', '/api/subscription/reactivate');
      const data = await response.json();
      
      if (data.success) {
        setSubscription(prev => prev ? { ...prev, cancelAtPeriodEnd: false } : null);
        toast({
          title: "Subscription Reactivated",
          description: "Your subscription will continue at the next billing period.",
        });
      } else {
        throw new Error(data.error || 'Failed to reactivate subscription');
      }
    } catch (error) {
      console.error('Error reactivating subscription:', error);
      toast({
        title: "Reactivation Failed",
        description: "Unable to reactivate subscription. Please try again or contact support.",
        variant: "destructive",
      });
    } finally {
      setCanceling(false);
    }
  };

  const openStripePortal = async () => {
    try {
      const response = await apiRequest('POST', '/api/subscription/portal');
      const data = await response.json();
      
      if (data.url) {
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Error opening Stripe portal:', error);
      toast({
        title: "Error",
        description: "Unable to open billing portal. Please try again.",
        variant: "destructive",
      });
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase()
    }).format(amount / 100);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'trialing':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'canceled':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      case 'past_due':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4" />;
      case 'trialing':
        return <Calendar className="h-4 w-4" />;
      case 'canceled':
        return <XCircle className="h-4 w-4" />;
      case 'past_due':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <Button
              variant="ghost"
              onClick={() => setLocation('/')}
              className="flex items-center gap-2"
              data-testid="button-back-to-app"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to App
            </Button>
          </div>

          <Card className="text-center py-12">
            <CardContent>
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <h2 className="text-xl font-semibold mb-2">No Active Subscription</h2>
              <p className="text-muted-foreground mb-6">
                You don't have an active subscription. Upgrade to unlock premium features!
              </p>
              <Button
                onClick={() => setLocation('/plans')}
                data-testid="button-view-plans"
              >
                View Plans
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            onClick={() => setLocation('/')}
            className="flex items-center gap-2"
            data-testid="button-back-to-app"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to App
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Subscription Management</h1>
            <p className="text-muted-foreground">Manage your billing and subscription details</p>
          </div>
        </div>

        {/* Current Subscription Card */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Current Plan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold">{subscription.planName}</h3>
                <Badge className={`flex items-center gap-1 ${getStatusColor(subscription.status)}`}>
                  {getStatusIcon(subscription.status)}
                  {subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
                </Badge>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">
                  {formatAmount(subscription.amount, subscription.currency)}
                </div>
                <div className="text-sm text-muted-foreground">
                  per {subscription.interval}
                </div>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="font-medium">Current Period</div>
                  <div className="text-sm text-muted-foreground">
                    {formatDate(subscription.currentPeriodStart)} - {formatDate(subscription.currentPeriodEnd)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="font-medium">Next Billing</div>
                  <div className="text-sm text-muted-foreground">
                    {subscription.cancelAtPeriodEnd ? 'Canceled' : formatDate(subscription.currentPeriodEnd)}
                  </div>
                </div>
              </div>
            </div>

            {subscription.cancelAtPeriodEnd && (
              <div className="bg-orange-50 dark:bg-orange-950/50 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-orange-600" />
                  <div>
                    <div className="font-medium text-orange-900 dark:text-orange-300">
                      Subscription Canceled
                    </div>
                    <div className="text-sm text-orange-700 dark:text-orange-400">
                      Your subscription will end on {formatDate(subscription.currentPeriodEnd)}. 
                      You'll continue to have access until then.
                    </div>
                  </div>
                </div>
              </div>
            )}

            <Separator />

            <div className="flex flex-wrap gap-3">
              <Button
                onClick={openStripePortal}
                variant="outline"
                className="flex items-center gap-2"
                data-testid="button-billing-portal"
              >
                <ExternalLink className="h-4 w-4" />
                Billing Portal
              </Button>

              {subscription.cancelAtPeriodEnd ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="default"
                      className="flex items-center gap-2"
                      disabled={canceling}
                      data-testid="button-reactivate-subscription"
                    >
                      <CheckCircle className="h-4 w-4" />
                      {canceling ? 'Processing...' : 'Reactivate Subscription'}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Reactivate Subscription</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to reactivate your subscription? 
                        You'll be charged at the next billing cycle.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleReactivateSubscription}>
                        Reactivate
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      className="flex items-center gap-2"
                      disabled={canceling}
                      data-testid="button-cancel-subscription"
                    >
                      <XCircle className="h-4 w-4" />
                      {canceling ? 'Processing...' : 'Cancel Subscription'}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancel Subscription</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to cancel your subscription? 
                        You'll continue to have access until the end of your current billing period 
                        ({formatDate(subscription.currentPeriodEnd)}).
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={handleCancelSubscription}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        Cancel Subscription
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Billing History */}
        {invoices.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Billing History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {invoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="font-medium">
                          {formatDate(invoice.created)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Invoice #{invoice.id.slice(-8).toUpperCase()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="font-medium">
                          {formatAmount(invoice.amount, invoice.currency)}
                        </div>
                        <Badge variant={invoice.status === 'paid' ? 'default' : 'secondary'}>
                          {invoice.status}
                        </Badge>
                      </div>
                      {invoice.hostedInvoiceUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(invoice.hostedInvoiceUrl, '_blank')}
                          data-testid={`button-view-invoice-${invoice.id}`}
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          View
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}