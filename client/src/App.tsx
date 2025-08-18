import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAutoSave } from "@/hooks/use-auto-save";
import { useAuth } from "@/hooks/useAuth";
import { SubscriptionGuard } from "@/components/subscription-guard";
import Performance from "@/pages/performance";
import Landing from "@/pages/landing";
import Subscribe from "@/pages/subscribe";
import NotFound from "@/pages/not-found";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <Switch>
      {!isAuthenticated ? (
        <Route path="/" component={Landing} />
      ) : (
        <>
          <Route path="/subscribe" component={Subscribe} />
          <Route path="/">
            <SubscriptionGuard>
              <Performance />
            </SubscriptionGuard>
          </Route>
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AutoSaveProvider />
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

function AutoSaveProvider() {
  useAutoSave(); // Initialize auto-save
  return null;
}

export default App;
