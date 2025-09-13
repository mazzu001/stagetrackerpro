/**
 * Cloud Library Setup Dialog
 * Upload and manage music files in cloud storage
 */

import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, Shield, FileMusic, Cloud, CheckCircle, X } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useCloudLibrary } from '@/hooks/use-cloud-library';
import { Progress } from '@/components/ui/progress';

interface CloudLibraryDialogProps {
  isOpen: boolean;
  onLibraryReady: () => void;
}

export function CloudLibraryDialog({
  isOpen,
  onLibraryReady
}: CloudLibraryDialogProps) {
  const [step, setStep] = useState<'intro' | 'uploading' | 'success'>('intro');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { uploadFiles, isLoading, error, files } = useCloudLibrary();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const fileArray = Array.from(files);
      setSelectedFiles(fileArray);
      console.log(`📁 Selected ${fileArray.length} files for upload`);
    }
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      return;
    }

    setStep('uploading');
    setUploadProgress(0);

    // Simulate upload progress
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + Math.random() * 10;
      });
    }, 200);

    try {
      const fileList = new DataTransfer();
      selectedFiles.forEach(file => fileList.items.add(file));
      
      const success = await uploadFiles(fileList.files);
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      if (success) {
        setStep('success');
        setTimeout(() => {
          onLibraryReady();
        }, 1500);
      } else {
        setStep('intro');
      }
    } catch (error) {
      console.error('❌ Upload failed:', error);
      clearInterval(progressInterval);
      setStep('intro');
    }
  };

  const handleSelectFiles = () => {
    fileInputRef.current?.click();
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="audio/*,.mp3,.wav,.ogg,.m4a"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
        data-testid="input-file-upload"
      />
      
      <Dialog open={isOpen} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-lg" data-testid="dialog-cloud-library-setup">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2" data-testid="text-dialog-title">
              <Cloud className="h-5 w-5 text-blue-600" />
              Set Up Your Cloud Music Library
            </DialogTitle>
            <DialogDescription data-testid="text-dialog-description">
              Upload your music files to secure cloud storage for reliable access across all your devices.
            </DialogDescription>
          </DialogHeader>

          {step === 'intro' && (
            <div className="space-y-4">
              {/* Benefits section */}
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                  <Shield className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-green-800 dark:text-green-200">Secure & Reliable</p>
                    <p className="text-sm text-green-700 dark:text-green-300">
                      Your music is safely stored in the cloud with automatic backups and fast access.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                  <FileMusic className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-blue-800 dark:text-blue-200">Professional Performance</p>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      Perfect for live shows - your music loads instantly and works offline when needed.
                    </p>
                  </div>
                </div>
              </div>

              {/* File selection area */}
              {selectedFiles.length === 0 ? (
                <div 
                  className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 transition-colors"
                  onClick={handleSelectFiles}
                  data-testid="area-file-drop"
                >
                  <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-lg font-medium mb-2">Select Your Music Files</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Choose MP3, WAV, OGG, or M4A files to upload
                  </p>
                  <Button variant="outline" data-testid="button-select-files">
                    <Upload className="h-4 w-4 mr-2" />
                    Browse Files
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">Selected Files ({selectedFiles.length})</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleSelectFiles}
                      data-testid="button-add-more"
                    >
                      Add More
                    </Button>
                  </div>
                  
                  <div className="max-h-40 overflow-y-auto space-y-2">
                    {selectedFiles.map((file, index) => (
                      <div 
                        key={index} 
                        className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded"
                        data-testid={`file-item-${index}`}
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <FileMusic className="h-4 w-4 text-blue-600 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{file.name}</p>
                            <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => removeFile(index)}
                          data-testid={`button-remove-${index}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {error && (
                <Alert variant="destructive" data-testid="alert-error">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="flex flex-col gap-2">
                <Button 
                  onClick={handleUpload}
                  disabled={selectedFiles.length === 0 || isLoading}
                  className="w-full"
                  data-testid="button-upload"
                >
                  <Cloud className="h-4 w-4 mr-2" />
                  {isLoading ? 'Uploading...' : `Upload ${selectedFiles.length} Files`}
                </Button>
                
                <p className="text-xs text-gray-500 text-center">
                  Your files will be securely stored in your private cloud library
                </p>
              </div>
            </div>
          )}

          {step === 'uploading' && (
            <div className="text-center py-8 space-y-4">
              <Cloud className="h-12 w-12 text-blue-600 mx-auto mb-4 animate-pulse" />
              <div className="space-y-2">
                <p className="text-lg font-medium" data-testid="text-uploading">
                  Uploading {selectedFiles.length} files...
                </p>
                <Progress value={uploadProgress} className="w-full" data-testid="progress-upload" />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {Math.round(uploadProgress)}% complete
                </p>
              </div>
            </div>
          )}

          {step === 'success' && (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <p className="text-lg font-medium text-green-800 dark:text-green-200" data-testid="text-success">
                Cloud Library Ready!
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Your music is now available across all your devices
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default CloudLibraryDialog;