/**
 * FirstRunSetupWizard - Guide users through local folder backup setup
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { LocalDiskFileSystem } from '@/lib/local-disk-file-system';
import { StorageOrchestrator } from '@/lib/storage-orchestrator';
import { FolderOpen, Shield, Smartphone, Monitor, AlertTriangle, CheckCircle, X } from 'lucide-react';

interface SetupWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSetupComplete: (enabled: boolean) => void;
  userEmail: string;
}

interface PlatformInfo {
  isSupported: boolean;
  browserName: string;
  platformName: string;
  recommendation: 'recommended' | 'limited' | 'not-supported';
}

export function FirstRunSetupWizard({ isOpen, onClose, onSetupComplete, userEmail }: SetupWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [platformInfo, setPlatformInfo] = useState<PlatformInfo | null>(null);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [setupProgress, setSetupProgress] = useState(0);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [selectedChoice, setSelectedChoice] = useState<'local' | 'browser' | null>(null);

  const totalSteps = 3;

  useEffect(() => {
    if (isOpen) {
      detectPlatform();
    }
  }, [isOpen]);

  const detectPlatform = () => {
    const userAgent = navigator.userAgent;
    const isSupported = LocalDiskFileSystem.isSupported();
    
    let browserName = 'Unknown';
    let platformName = 'Unknown';
    let recommendation: PlatformInfo['recommendation'] = 'not-supported';

    // Detect browser
    if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
      browserName = 'Chrome';
    } else if (userAgent.includes('Edg')) {
      browserName = 'Edge';
    } else if (userAgent.includes('Firefox')) {
      browserName = 'Firefox';
    } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
      browserName = 'Safari';
    }

    // Detect platform
    if (userAgent.includes('Android')) {
      platformName = 'Android';
      if (browserName === 'Chrome' || browserName === 'Edge') {
        recommendation = 'recommended';
      } else {
        recommendation = 'limited';
      }
    } else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
      platformName = 'iOS';
      recommendation = 'limited';
    } else if (userAgent.includes('Windows')) {
      platformName = 'Windows';
      if (browserName === 'Chrome' || browserName === 'Edge') {
        recommendation = 'recommended';
      } else {
        recommendation = 'limited';
      }
    } else if (userAgent.includes('Mac')) {
      platformName = 'macOS';
      if (browserName === 'Chrome' || browserName === 'Edge') {
        recommendation = 'recommended';
      } else {
        recommendation = 'limited';
      }
    } else if (userAgent.includes('Linux')) {
      platformName = 'Linux';
      if (browserName === 'Chrome' || browserName === 'Edge') {
        recommendation = 'recommended';
      } else {
        recommendation = 'limited';
      }
    }

    setPlatformInfo({
      isSupported,
      browserName,
      platformName,
      recommendation
    });
  };

  const handleSetupLocalFolder = async () => {
    setIsSettingUp(true);
    setSetupProgress(0);
    setSetupError(null);

    try {
      const orchestrator = StorageOrchestrator.getInstance();
      
      // Step 1: Request folder access
      setSetupProgress(25);
      const success = await orchestrator.setupLocalFolderBackup();
      
      if (!success) {
        throw new Error('Failed to setup local folder backup');
      }

      // Step 2: Migrate existing data
      setSetupProgress(50);
      await new Promise(resolve => setTimeout(resolve, 500)); // Show progress

      // Step 3: Initialize auto-save
      setSetupProgress(75);
      await orchestrator.performFullBackup(userEmail);
      
      // Complete
      setSetupProgress(100);
      
      setTimeout(() => {
        onSetupComplete(true);
        onClose();
      }, 1000);

    } catch (error) {
      console.error('Setup failed:', error);
      setSetupError(error instanceof Error ? error.message : 'Setup failed');
      setSetupProgress(0);
    } finally {
      setIsSettingUp(false);
    }
  };

  const handleContinueWithBrowser = () => {
    onSetupComplete(false);
    onClose();
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="text-center space-y-4">
        <Shield className="w-16 h-16 mx-auto text-blue-500" />
        <div>
          <h3 className="text-xl font-semibold mb-2">Protect Your Music Library</h3>
          <p className="text-muted-foreground">
            Set up automatic backup to keep your songs safe from browser data loss
          </p>
        </div>
      </div>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>Important:</strong> Browser storage can be cleared by cache cleanup, 
          browser updates, or device changes. Setting up local folder backup ensures 
          your music library is always protected.
        </AlertDescription>
      </Alert>

      <div className="flex justify-end">
        <Button onClick={() => setCurrentStep(2)}>
          Continue
        </Button>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-xl font-semibold mb-2">Choose Your Setup</h3>
        <p className="text-muted-foreground">
          Select the storage method that works best for your device
        </p>
      </div>

      {/* Platform compatibility info */}
      {platformInfo && (
        <Card className="bg-muted/50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              {platformInfo.platformName.includes('Android') || platformInfo.platformName.includes('iOS') ? 
                <Smartphone className="w-5 h-5" /> : 
                <Monitor className="w-5 h-5" />
              }
              <span className="font-medium">
                {platformInfo.browserName} on {platformInfo.platformName}
              </span>
              <Badge variant={
                platformInfo.recommendation === 'recommended' ? 'default' :
                platformInfo.recommendation === 'limited' ? 'secondary' : 'destructive'
              }>
                {platformInfo.recommendation === 'recommended' ? 'Fully Supported' :
                 platformInfo.recommendation === 'limited' ? 'Limited Support' : 'Not Supported'}
              </Badge>
            </div>
          </CardHeader>
        </Card>
      )}

      <div className="grid gap-4">
        {/* Local Folder Option */}
        <Card 
          className={`cursor-pointer transition-all ${
            selectedChoice === 'local' ? 'ring-2 ring-primary' : 'hover:bg-muted/50'
          } ${platformInfo?.recommendation === 'not-supported' ? 'opacity-50' : ''}`}
          onClick={() => platformInfo?.recommendation !== 'not-supported' && setSelectedChoice('local')}
        >
          <CardHeader>
            <div className="flex items-start gap-3">
              <FolderOpen className="w-6 h-6 mt-1 text-primary" />
              <div className="flex-1">
                <CardTitle className="text-lg">Local Folder Backup (Recommended)</CardTitle>
                <CardDescription className="mt-2">
                  Choose a folder on your device for automatic, continuous backup. 
                  Your music library will be saved to your selected folder and automatically 
                  synced whenever you make changes.
                </CardDescription>
                <div className="flex flex-wrap gap-2 mt-3">
                  <Badge variant="outline">✅ Survives browser clearing</Badge>
                  <Badge variant="outline">✅ Works offline</Badge>
                  <Badge variant="outline">✅ Cross-device compatible</Badge>
                  {platformInfo?.recommendation === 'recommended' && 
                    <Badge>Recommended for your device</Badge>
                  }
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Browser Only Option */}
        <Card 
          className={`cursor-pointer transition-all ${
            selectedChoice === 'browser' ? 'ring-2 ring-primary' : 'hover:bg-muted/50'
          }`}
          onClick={() => setSelectedChoice('browser')}
        >
          <CardHeader>
            <div className="flex items-start gap-3">
              <Shield className="w-6 h-6 mt-1 text-orange-500" />
              <div className="flex-1">
                <CardTitle className="text-lg">Browser Storage Only</CardTitle>
                <CardDescription className="mt-2">
                  Use only browser storage with manual export backups. 
                  You'll need to manually export your library to protect against data loss.
                </CardDescription>
                <div className="flex flex-wrap gap-2 mt-3">
                  <Badge variant="outline">⚠️ Manual backups needed</Badge>
                  <Badge variant="outline">✅ Works on all browsers</Badge>
                  <Badge variant="outline">✅ No folder permissions</Badge>
                  {platformInfo?.recommendation === 'limited' && 
                    <Badge variant="secondary">Recommended for your device</Badge>
                  }
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setCurrentStep(1)}>
          Back
        </Button>
        <Button 
          onClick={() => setCurrentStep(3)}
          disabled={!selectedChoice}
        >
          Continue
        </Button>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      {selectedChoice === 'local' ? (
        <div className="text-center space-y-4">
          <FolderOpen className="w-16 h-16 mx-auto text-primary" />
          <div>
            <h3 className="text-xl font-semibold mb-2">Set Up Local Folder Backup</h3>
            <p className="text-muted-foreground">
              Click "Choose Folder" to select where your music library will be automatically backed up
            </p>
          </div>

          {isSettingUp && (
            <div className="space-y-4">
              <Progress value={setupProgress} className="w-full" />
              <p className="text-sm text-muted-foreground">
                {setupProgress < 25 ? 'Requesting folder access...' :
                 setupProgress < 50 ? 'Creating backup structure...' :
                 setupProgress < 75 ? 'Migrating existing data...' :
                 setupProgress < 100 ? 'Initializing auto-save...' : 'Setup complete!'}
              </p>
            </div>
          )}

          {setupError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{setupError}</AlertDescription>
            </Alert>
          )}
        </div>
      ) : (
        <div className="text-center space-y-4">
          <Shield className="w-16 h-16 mx-auto text-orange-500" />
          <div>
            <h3 className="text-xl font-semibold mb-2">Browser Storage Confirmed</h3>
            <p className="text-muted-foreground">
              Your music will be stored in browser storage. Remember to regularly export 
              your library using the export feature to protect against data loss.
            </p>
          </div>

          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Reminder:</strong> Use the export feature regularly to create backups 
              of your music library. You can access this from the main menu.
            </AlertDescription>
          </Alert>
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setCurrentStep(2)}>
          Back
        </Button>
        <div className="space-x-2">
          {selectedChoice === 'local' && (
            <Button 
              onClick={handleSetupLocalFolder}
              disabled={isSettingUp}
              data-testid="button-setup-local-folder"
            >
              {isSettingUp ? 'Setting up...' : 'Choose Folder'}
            </Button>
          )}
          {selectedChoice === 'browser' && (
            <Button 
              onClick={handleContinueWithBrowser}
              data-testid="button-continue-browser"
            >
              Continue with Browser Storage
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl" data-testid="dialog-setup-wizard">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl">Welcome to StageTracker</DialogTitle>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              Step {currentStep} of {totalSteps}
            </div>
          </div>
        </DialogHeader>

        <div className="py-4">
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default FirstRunSetupWizard;