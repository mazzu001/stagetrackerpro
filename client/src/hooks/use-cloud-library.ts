import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

export interface CloudLibraryFile {
  id: string;
  originalName: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
  path: string;
}

export interface UseCloudLibraryReturn {
  files: CloudLibraryFile[];
  isLoading: boolean;
  error: string | null;
  uploadFiles: (files: FileList) => Promise<boolean>;
  downloadFile: (fileId: string) => Promise<Blob | null>;
  deleteFile: (fileId: string) => Promise<boolean>;
  refreshLibrary: () => Promise<void>;
  isLibraryConnected: boolean;
}

export function useCloudLibrary(): UseCloudLibraryReturn {
  const [files, setFiles] = useState<CloudLibraryFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLibraryConnected, setIsLibraryConnected] = useState(false);
  const { toast } = useToast();

  const refreshLibrary = useCallback(async () => {
    console.log('☁️ Refreshing cloud library...');
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/library');
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Please log in to access your music library');
        }
        throw new Error(`Failed to load library: ${response.statusText}`);
      }
      
      const data = await response.json();
      setFiles(data.files || []);
      setIsLibraryConnected(true);
      console.log(`✅ Loaded ${data.files?.length || 0} files from cloud library`);
      
    } catch (err: any) {
      console.error('❌ Error loading cloud library:', err);
      setError(err.message);
      setIsLibraryConnected(false);
      toast({
        title: "Library Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const uploadFiles = useCallback(async (fileList: FileList): Promise<boolean> => {
    console.log(`☁️ Uploading ${fileList.length} files to cloud library...`);
    setIsLoading(true);
    setError(null);
    
    try {
      const formData = new FormData();
      
      // Add all files to the form data
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        formData.append('files', file);
        console.log(`📁 Adding file: ${file.name} (${file.size} bytes)`);
      }
      
      const response = await fetch('/api/library/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Please log in to upload files');
        }
        throw new Error(`Upload failed: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log(`✅ Successfully uploaded ${result.uploadedFiles?.length || 0} files`);
      
      toast({
        title: "Upload Successful",
        description: `Uploaded ${result.uploadedFiles?.length || 0} files to your cloud library`,
      });
      
      // Refresh the library to show new files
      await refreshLibrary();
      return true;
      
    } catch (err: any) {
      console.error('❌ Error uploading files:', err);
      setError(err.message);
      toast({
        title: "Upload Failed",
        description: err.message,
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [refreshLibrary, toast]);

  const downloadFile = useCallback(async (fileId: string): Promise<Blob | null> => {
    console.log(`☁️ Downloading file: ${fileId}`);
    setError(null);
    
    try {
      const response = await fetch(`/api/library/download/${fileId}`);
      
      if (!response.ok) {
        throw new Error(`Download failed: ${response.statusText}`);
      }
      
      const blob = await response.blob();
      console.log(`✅ Downloaded file: ${fileId} (${blob.size} bytes)`);
      return blob;
      
    } catch (err: any) {
      console.error('❌ Error downloading file:', err);
      setError(err.message);
      toast({
        title: "Download Failed",
        description: err.message,
        variant: "destructive",
      });
      return null;
    }
  }, [toast]);

  const deleteFile = useCallback(async (fileId: string): Promise<boolean> => {
    console.log(`☁️ Deleting file: ${fileId}`);
    setError(null);
    
    try {
      const response = await fetch(`/api/library/${fileId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error(`Delete failed: ${response.statusText}`);
      }
      
      console.log(`✅ Deleted file: ${fileId}`);
      toast({
        title: "File Deleted",
        description: "File removed from your cloud library",
      });
      
      // Refresh the library to remove deleted file
      await refreshLibrary();
      return true;
      
    } catch (err: any) {
      console.error('❌ Error deleting file:', err);
      setError(err.message);
      toast({
        title: "Delete Failed",
        description: err.message,
        variant: "destructive",
      });
      return false;
    }
  }, [refreshLibrary, toast]);

  return {
    files,
    isLoading,
    error,
    uploadFiles,
    downloadFile,
    deleteFile,
    refreshLibrary,
    isLibraryConnected,
  };
}