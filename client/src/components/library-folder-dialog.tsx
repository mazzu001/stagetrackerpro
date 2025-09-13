/**
 * Library Folder Selection Dialog
 * First-time setup flow for choosing music library location
 */

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FolderOpen, Shield, FileMusic, HardDrive, CheckCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface LibraryFolderDialogProps {
  isOpen: boolean;
  onFolderSelected: () => void;
  onSelectFolder: () => Promise<boolean>;
  isSelecting: boolean;
  error?: string | null;
}

export function LibraryFolderDialog({
  isOpen,
  onFolderSelected,
  onSelectFolder,
  isSelecting,
  error
}: LibraryFolderDialogProps) {
  const [step, setStep] = useState<'intro' | 'selecting' | 'success'>('intro');

  const handleSelectFolder = async () => {
    setStep('selecting');
    
    try {
      const success = await onSelectFolder();
      if (success) {
        setStep('success');
        setTimeout(() => {
          onFolderSelected();
        }, 1500);
      } else {
        setStep('intro');
      }
    } catch (error) {
      console.error('❌ Folder selection failed:', error);
      setStep('intro');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-library-setup">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" data-testid="text-dialog-title">
            <FileMusic className="h-5 w-5 text-blue-600" />
            Choose Your Music Library Location
          </DialogTitle>
          <DialogDescription data-testid="text-dialog-description">
            StageTracker stores your music directly on your device for reliability and performance.
          </DialogDescription>
        </DialogHeader>

        {step === 'intro' && (
          <div className="space-y-4">
            {/* Benefits section */}
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                <Shield className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-green-800 dark:text-green-200">Your Music, Your Control</p>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Direct file storage eliminates browser cache issues and gives you full control over your music library.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                <HardDrive className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-blue-800 dark:text-blue-200">Professional Reliability</p>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    Perfect for live performances - your music stays where you put it, accessible anytime.
                  </p>
                </div>
              </div>
            </div>

            {/* Folder structure preview */}
            <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
              <p className="text-sm font-medium mb-2">Your library will be organized like this:</p>
              <div className="text-xs text-gray-600 dark:text-gray-400 font-mono space-y-1">
                <div>📁 MyMusicLibrary/</div>
                <div className="ml-4">📁 songs/ (song metadata)</div>
                <div className="ml-4">📁 audio/ (track files)</div>
                <div className="ml-4">📁 lyrics/ (lyrics with MIDI)</div>
                <div className="ml-4">📁 settings/ (preferences)</div>
              </div>
            </div>

            {error && (
              <Alert variant="destructive" data-testid="alert-error">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col gap-2">
              <Button 
                onClick={handleSelectFolder}
                disabled={isSelecting}
                className="w-full"
                data-testid="button-select-folder"
              >
                <FolderOpen className="h-4 w-4 mr-2" />
                {isSelecting ? 'Opening Folder Picker...' : 'Choose Library Folder'}
              </Button>
              
              <p className="text-xs text-gray-500 text-center">
                We recommend creating a new folder like "StageTracker Music"
              </p>
            </div>
          </div>
        )}

        {step === 'selecting' && (
          <div className="text-center py-8">
            <FolderOpen className="h-12 w-12 text-blue-600 mx-auto mb-4 animate-pulse" />
            <p className="text-lg font-medium" data-testid="text-selecting">Waiting for folder selection...</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Please choose a folder in the file picker that opened
            </p>
          </div>
        )}

        {step === 'success' && (
          <div className="text-center py-8">
            <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
            <p className="text-lg font-medium text-green-800 dark:text-green-200" data-testid="text-success">
              Library Folder Selected!
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Setting up your music library...
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default LibraryFolderDialog;