/**
 * useLocalFolderBackup - React hook for managing local folder backup functionality
 */

import { useState, useEffect, useCallback } from 'react';
import { StorageOrchestrator } from '@/lib/storage-orchestrator';
import { LocalDiskFileSystem } from '@/lib/local-disk-file-system';

interface BackupStatus {
  isEnabled: boolean;
  isSupported: boolean;
  lastSaveTime: number | null;
  lastSaveStatus: 'success' | 'error' | 'pending' | null;
  lastError: string | null;
  folderName: string;
  stats: {
    totalSongs: number;
    totalTracks: number;
  };
}

interface BackupActions {
  setupBackup: () => Promise<boolean>;
  performFullBackup: () => Promise<boolean>;
  disableBackup: () => void;
  restoreFromBackup: () => Promise<{success: boolean, restored: number, errors: string[]}>;
  markSongDirty: (songId: string) => void;
  markWaveformDirty: (songId: string) => void;
  markAudioDirty: (trackId: string) => void;
}

export function useLocalFolderBackup(userEmail: string): [BackupStatus, BackupActions] {
  const [status, setStatus] = useState<BackupStatus>({
    isEnabled: false,
    isSupported: LocalDiskFileSystem.isSupported(),
    lastSaveTime: null,
    lastSaveStatus: null,
    lastError: null,
    folderName: 'No folder selected',
    stats: {
      totalSongs: 0,
      totalTracks: 0
    }
  });

  const orchestrator = StorageOrchestrator.getInstance();

  // Update status from orchestrator
  const updateStatus = useCallback(async () => {
    const autoSaveStatus = orchestrator.getAutoSaveStatus();
    const storageStats = await orchestrator.getStorageStats(userEmail);
    const diskStatus = LocalDiskFileSystem.getInstance().getStatus();
    
    // Check actual folder permission, not just the autoSave flag
    const hasFolderAccess = await LocalDiskFileSystem.getInstance().silentVerifyPermission();

    setStatus({
      isEnabled: autoSaveStatus.isEnabled && hasFolderAccess,
      isSupported: diskStatus.isSupported,
      lastSaveTime: autoSaveStatus.lastSaveTime,
      lastSaveStatus: autoSaveStatus.lastSaveStatus,
      lastError: autoSaveStatus.lastError,
      folderName: diskStatus.directoryName,
      stats: {
        totalSongs: storageStats.totalSongs,
        totalTracks: storageStats.totalTracks
      }
    });
  }, [orchestrator, userEmail]);

  // Initialize on mount
  useEffect(() => {
    const init = async () => {
      await orchestrator.initialize();
      await updateStatus();
    };
    init();
  }, [orchestrator, updateStatus]);

  // Poll for status updates
  useEffect(() => {
    const interval = setInterval(updateStatus, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, [updateStatus]);

  const setupBackup = useCallback(async (): Promise<boolean> => {
    const success = await orchestrator.setupLocalFolderBackup();
    await updateStatus();
    return success;
  }, [orchestrator, updateStatus]);

  const performFullBackup = useCallback(async (): Promise<boolean> => {
    const success = await orchestrator.performFullBackup(userEmail);
    await updateStatus();
    return success;
  }, [orchestrator, userEmail, updateStatus]);

  const disableBackup = useCallback(() => {
    orchestrator.disableAutoSave();
    updateStatus();
  }, [orchestrator, updateStatus]);

  const restoreFromBackup = useCallback(async () => {
    const result = await orchestrator.restoreFromLocalFolder(userEmail);
    await updateStatus();
    return result;
  }, [orchestrator, userEmail, updateStatus]);

  const markSongDirty = useCallback((songId: string) => {
    orchestrator.markSongDirty(songId);
  }, [orchestrator]);

  const markWaveformDirty = useCallback((songId: string) => {
    orchestrator.markWaveformDirty(songId);
  }, [orchestrator]);

  const markAudioDirty = useCallback((trackId: string) => {
    orchestrator.markAudioDirty(trackId);
  }, [orchestrator]);

  const actions: BackupActions = {
    setupBackup,
    performFullBackup,
    disableBackup,
    restoreFromBackup,
    markSongDirty,
    markWaveformDirty,
    markAudioDirty
  };

  return [status, actions];
}

export default useLocalFolderBackup;