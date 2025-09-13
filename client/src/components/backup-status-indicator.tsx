/**
 * BackupStatusIndicator - Shows current backup status in the UI
 */

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useLocalFolderBackup } from '@/hooks/use-local-folder-backup';
import { DataRecoveryDialog } from '@/components/data-recovery-dialog';
import { Shield, FolderOpen, AlertTriangle, CheckCircle, Clock, Settings, Download } from 'lucide-react';

interface BackupStatusIndicatorProps {
  userEmail: string;
  className?: string;
}

export function BackupStatusIndicator({ userEmail, className = '' }: BackupStatusIndicatorProps) {
  const [status, actions] = useLocalFolderBackup(userEmail);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isRecoveryOpen, setIsRecoveryOpen] = useState(false);

  const getStatusIcon = () => {
    if (!status.isSupported) return <Shield className="w-4 h-4 text-gray-400" />;
    if (!status.isEnabled) return <Shield className="w-4 h-4 text-orange-500" />;
    if (status.lastSaveStatus === 'pending') return <Clock className="w-4 h-4 text-blue-500 animate-pulse" />;
    if (status.lastSaveStatus === 'error') return <AlertTriangle className="w-4 h-4 text-red-500" />;
    if (status.lastSaveStatus === 'success') return <CheckCircle className="w-4 h-4 text-green-500" />;
    return <Shield className="w-4 h-4 text-gray-400" />;
  };

  const getStatusText = () => {
    if (!status.isSupported) return 'Not supported';
    if (!status.isEnabled) return 'Browser only';
    if (status.lastSaveStatus === 'pending') return 'Saving...';
    if (status.lastSaveStatus === 'error') return 'Error';
    if (status.lastSaveStatus === 'success') return 'Backed up';
    return 'Ready';
  };

  const getStatusVariant = () => {
    if (!status.isSupported) return 'secondary';
    if (!status.isEnabled) return 'outline';
    if (status.lastSaveStatus === 'error') return 'destructive';
    if (status.lastSaveStatus === 'success') return 'default';
    return 'secondary';
  };

  const formatLastSaveTime = () => {
    if (!status.lastSaveTime) return 'Never';
    const now = Date.now();
    const diff = now - status.lastSaveTime;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return new Date(status.lastSaveTime).toLocaleDateString();
  };

  return (
    <div className={className}>
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs"
                  data-testid="button-backup-status"
                >
                  {getStatusIcon()}
                  <span className="ml-1">{getStatusText()}</span>
                </Button>
              </DialogTrigger>
            </TooltipTrigger>
            <TooltipContent>
              <p>Click to view backup details</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <DialogContent className="max-w-md" data-testid="dialog-backup-status">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="w-5 h-5" />
              Backup Status
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Current Status */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Current Status</CardTitle>
                  <Badge variant={getStatusVariant()}>
                    {getStatusText()}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Folder:</span>
                    <span className="text-right">{status.folderName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Last saved:</span>
                    <span className="text-right">{formatLastSaveTime()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Songs:</span>
                    <span className="text-right">{status.stats.totalSongs}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tracks:</span>
                    <span className="text-right">{status.stats.totalTracks}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Error Display */}
            {status.lastError && (
              <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-red-700 dark:text-red-300">
                    Last Error
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-xs text-red-600 dark:text-red-400">
                    {status.lastError}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <div className="space-y-2">
              {!status.isEnabled && status.isSupported && (
                <Button
                  onClick={async () => {
                    await actions.setupBackup();
                    setIsDetailsOpen(false);
                  }}
                  className="w-full"
                  data-testid="button-setup-backup"
                >
                  <FolderOpen className="w-4 h-4 mr-2" />
                  Set Up Local Backup
                </Button>
              )}

              {status.isEnabled && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      onClick={async () => {
                        await actions.performFullBackup();
                      }}
                      disabled={status.lastSaveStatus === 'pending'}
                      data-testid="button-backup-now"
                    >
                      Backup Now
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        actions.disableBackup();
                      }}
                      data-testid="button-disable-backup"
                    >
                      Disable
                    </Button>
                  </div>
                  
                  {/* Restore from Backup button */}
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={() => {
                      setIsRecoveryOpen(true);
                      setIsDetailsOpen(false);
                    }}
                    data-testid="button-restore-backup"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Restore from Backup
                  </Button>
                </div>
              )}

              {!status.isSupported && (
                <div className="text-center p-3 bg-muted rounded-md">
                  <p className="text-sm text-muted-foreground">
                    Local backup requires Chrome or Edge on desktop/Android
                  </p>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Data Recovery Dialog */}
      <DataRecoveryDialog
        isOpen={isRecoveryOpen}
        onClose={() => setIsRecoveryOpen(false)}
        onRecoveryComplete={(restoredCount) => {
          // Optionally show a success message or refresh the page
          console.log(`Successfully restored ${restoredCount} songs`);
        }}
        userEmail={userEmail}
      />
    </div>
  );
}

export default BackupStatusIndicator;