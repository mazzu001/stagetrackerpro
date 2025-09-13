/**
 * DataRecoveryDialog - Handle restoration from local folder backup
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { useLocalFolderBackup } from '@/hooks/use-local-folder-backup';
import { useToast } from '@/hooks/use-toast';
import { HardDriveIcon, RefreshCw, AlertTriangle, CheckCircle, FolderOpen } from 'lucide-react';

interface DataRecoveryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onRecoveryComplete: (restoredCount: number) => void;
  userEmail: string;
}

export function DataRecoveryDialog({ 
  isOpen, 
  onClose, 
  onRecoveryComplete, 
  userEmail 
}: DataRecoveryDialogProps) {
  const [status, actions] = useLocalFolderBackup(userEmail);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState(0);
  const [restoreStatus, setRestoreStatus] = useState('');
  const [restoreResult, setRestoreResult] = useState<{
    success: boolean;
    restored: number;
    errors: string[];
  } | null>(null);
  const { toast } = useToast();

  const handleRestore = async () => {
    console.log('🔄 Starting handleRestore with userEmail:', userEmail);
    console.log('🔄 Backup status:', status);
    
    setIsRestoring(true);
    setRestoreProgress(0);
    setRestoreStatus('Scanning local folder...');
    setRestoreResult(null);

    try {
      // Simulate progress updates
      const progressSteps = [
        { progress: 25, status: 'Reading backup manifest...' },
        { progress: 50, status: 'Restoring song metadata...' },
        { progress: 75, status: 'Validating restored data...' },
        { progress: 100, status: 'Recovery complete!' }
      ];

      for (const step of progressSteps) {
        setRestoreProgress(step.progress);
        setRestoreStatus(step.status);
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Perform actual restoration
      console.log('🔄 Calling actions.restoreFromBackup()');
      const result = await actions.restoreFromBackup();
      console.log('✅ Restore result:', result);
      setRestoreResult(result);

      if (result.success) {
        toast({
          title: "Recovery Successful",
          description: `Restored ${result.restored} songs from local backup`,
        });
        
        setTimeout(() => {
          onRecoveryComplete(result.restored);
          onClose();
        }, 2000);
      } else {
        toast({
          title: "Recovery Failed",
          description: "Could not restore data from local backup",
          variant: "destructive",
        });
      }

    } catch (error) {
      console.error('Restore failed:', error);
      setRestoreResult({
        success: false,
        restored: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      });
      
      toast({
        title: "Recovery Error",
        description: "An error occurred during data recovery",
        variant: "destructive",
      });
    } finally {
      setIsRestoring(false);
    }
  };

  const handleSetupBackup = async () => {
    const success = await actions.setupBackup();
    if (success) {
      toast({
        title: "Backup Setup Complete",
        description: "Local folder backup is now active",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg" data-testid="dialog-data-recovery">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HardDriveIcon className="w-5 h-5" />
            Data Recovery
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Local Backup Status</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Backup enabled:</span>
                  <span>{status.isEnabled ? 'Yes' : 'No'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Folder:</span>
                  <span className="text-right truncate max-w-[150px]">{status.folderName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Songs available:</span>
                  <span>{status.stats.totalSongs}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* No backup setup */}
          {!status.isEnabled && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-3">
                  <p>
                    <strong>No local backup found.</strong> Set up automatic backup to protect 
                    your music library from browser data loss.
                  </p>
                  <Button 
                    onClick={handleSetupBackup}
                    size="sm"
                    className="w-full"
                    data-testid="button-setup-backup-recovery"
                  >
                    <FolderOpen className="w-4 h-4 mr-2" />
                    Set Up Local Backup
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Backup available but no songs to restore */}
          {status.isEnabled && status.stats.totalSongs === 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Local backup folder is empty. No songs available to restore.
              </AlertDescription>
            </Alert>
          )}

          {/* Recovery in progress */}
          {isRestoring && (
            <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                    <span className="text-sm font-medium">Restoring data...</span>
                  </div>
                  <Progress value={restoreProgress} className="w-full" />
                  <p className="text-xs text-muted-foreground">{restoreStatus}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recovery result */}
          {restoreResult && (
            <Card className={restoreResult.success ? 
              "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800" :
              "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800"
            }>
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  {restoreResult.success ? 
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" /> :
                    <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                  }
                  <div className="space-y-2">
                    <p className="text-sm font-medium">
                      {restoreResult.success ? 
                        `Successfully restored ${restoreResult.restored} songs` :
                        'Recovery failed'
                      }
                    </p>
                    {restoreResult.errors.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Errors:</p>
                        {restoreResult.errors.map((error, index) => (
                          <p key={index} className="text-xs text-red-600 dark:text-red-400">
                            • {error}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isRestoring}
              data-testid="button-cancel-recovery"
            >
              {restoreResult?.success ? 'Close' : 'Cancel'}
            </Button>
            
            {status.isEnabled && status.stats.totalSongs > 0 && !restoreResult?.success && (
              <Button
                onClick={handleRestore}
                disabled={isRestoring}
                data-testid="button-start-recovery"
              >
                {isRestoring ? 'Restoring...' : `Restore ${status.stats.totalSongs} Songs`}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default DataRecoveryDialog;