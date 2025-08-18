import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAutoSave } from "@/hooks/use-auto-save";
import Performance from "@/pages/performance";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Performance} />
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
