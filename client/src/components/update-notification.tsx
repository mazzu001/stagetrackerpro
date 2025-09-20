import { useVersionCheck } from '@/hooks/useVersionCheck';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RefreshCw, X } from 'lucide-react';
import { useState } from 'react';

export function UpdateNotification() {
  const { hasUpdate, refreshApp, isChecking } = useVersionCheck();
  const [dismissed, setDismissed] = useState(false);

  // Don't show if no update available, already dismissed, or currently checking
  if (!hasUpdate || dismissed) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm">
      <Alert className="border-blue-500 bg-blue-50 dark:bg-blue-950 dark:border-blue-400">
        <RefreshCw className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <AlertDescription className="text-blue-800 dark:text-blue-200">
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1">
              <p className="font-medium text-sm">Update Available</p>
              <p className="text-xs opacity-90 mt-1">
                A new version is ready. Refresh to get the latest features.
              </p>
            </div>
            <Button
              onClick={() => setDismissed(true)}
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
              aria-label="Dismiss notification"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
          <div className="flex gap-2 mt-3">
            <Button
              onClick={refreshApp}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1"
              disabled={isChecking}
            >
              {isChecking ? (
                <>
                  <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                  Refreshing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Refresh Now
                </>
              )}
            </Button>
            <Button
              onClick={() => setDismissed(true)}
              variant="outline"
              size="sm"
              className="text-xs px-3 py-1 border-blue-300 text-blue-700 hover:bg-blue-100 dark:border-blue-600 dark:text-blue-300 dark:hover:bg-blue-900"
            >
              Later
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
}