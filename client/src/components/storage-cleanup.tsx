import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, HardDrive, AlertTriangle, CheckCircle2 } from "lucide-react";
import { SongDeletionManager } from "@/lib/song-deletion-manager";
import { useToast } from "@/hooks/use-toast";

export default function StorageCleanup() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<{
    songCount: number;
    trackCount: number;
    storedFileCount: number;
    orphanedFileCount: number;
  } | null>(null);
  const { toast } = useToast();

  const loadStats = async () => {
    setIsLoading(true);
    try {
      // Get user email
      const storedUser = localStorage.getItem('lpp_local_user');
      let userEmail = 'default@user.com';
      if (storedUser) {
        try {
          const userData = JSON.parse(storedUser);
          userEmail = userData.email || 'default@user.com';
        } catch (e) {
          console.error('Failed to parse user data:', e);
        }
      }
      
      const storageStats = await SongDeletionManager.getStorageStats(userEmail);
      setStats(storageStats);
    } catch (error) {
      console.error('Failed to load storage stats:', error);
      toast({
        title: "Error",
        description: "Failed to load storage statistics",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCleanup = async () => {
    if (!window.confirm('Clean up orphaned audio files? This will remove audio files that are not associated with any existing songs.')) {
      return;
    }

    setIsLoading(true);
    try {
      // Get user email
      const storedUser = localStorage.getItem('lpp_local_user');
      let userEmail = 'default@user.com';
      if (storedUser) {
        try {
          const userData = JSON.parse(storedUser);
          userEmail = userData.email || 'default@user.com';
        } catch (e) {
          console.error('Failed to parse user data:', e);
        }
      }
      
      const cleanedCount = await SongDeletionManager.cleanupOrphanedFiles(userEmail);
      
      toast({
        title: "Cleanup complete",
        description: `Removed ${cleanedCount} orphaned audio files`,
      });
      
      // Reload stats
      await loadStats();
    } catch (error) {
      console.error('Failed to cleanup orphaned files:', error);
      toast({
        title: "Error",
        description: "Failed to cleanup orphaned files",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const clearAllAudioFiles = () => {
    if (window.confirm('⚠️ WARNING: This will clear ALL stored audio file references from localStorage. You will need to re-add audio files to your songs. Continue?')) {
      localStorage.removeItem('music-app-audio-files');
      toast({
        title: "Cleared",
        description: "All audio file references have been cleared from localStorage",
      });
      setIsOpen(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      setIsOpen(open);
      if (open) {
        loadStats();
      }
    }}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm"
          className="gap-2"
          data-testid="button-storage-cleanup"
        >
          <HardDrive className="w-4 h-4" />
          Storage Cleanup
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-surface border-gray-700 max-w-md">
        <DialogHeader>
          <DialogTitle>Storage Management</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {isLoading ? (
            <div className="animate-pulse space-y-3">
              <div className="h-20 bg-gray-700 rounded"></div>
              <div className="h-20 bg-gray-700 rounded"></div>
            </div>
          ) : stats ? (
            <>
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Storage Statistics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Songs:</span>
                    <span className="font-mono">{stats.songCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tracks:</span>
                    <span className="font-mono">{stats.trackCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Stored Files:</span>
                    <span className="font-mono">{stats.storedFileCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-orange-400">Orphaned Files:</span>
                    <span className="font-mono text-orange-400">{stats.orphanedFileCount}</span>
                  </div>
                </CardContent>
              </Card>

              {stats.orphanedFileCount > 0 && (
                <Card className="bg-orange-900/20 border-orange-700">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-orange-400" />
                      Orphaned Files Detected
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Found {stats.orphanedFileCount} audio files not associated with any song
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      onClick={handleCleanup}
                      disabled={isLoading}
                      className="w-full"
                      variant="default"
                      data-testid="button-cleanup-orphaned"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Clean Up Orphaned Files
                    </Button>
                  </CardContent>
                </Card>
              )}

              {stats.orphanedFileCount === 0 && (
                <Card className="bg-green-900/20 border-green-700">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                      Storage is Clean
                    </CardTitle>
                    <CardDescription className="text-xs">
                      No orphaned files detected
                    </CardDescription>
                  </CardHeader>
                </Card>
              )}

              <div className="pt-2 border-t border-gray-700">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={clearAllAudioFiles}
                  className="w-full"
                  data-testid="button-clear-all-references"
                >
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Clear All Audio File References
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Emergency reset - clears all stored file references
                </p>
              </div>
            </>
          ) : (
            <div className="text-center text-muted-foreground">
              Failed to load storage statistics
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}