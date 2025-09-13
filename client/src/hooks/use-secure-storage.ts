/**
 * React hook for secure direct storage system
 * Manages user's music library with built-in security and trial protection
 */

import { useState, useCallback, useEffect } from 'react';
import SecureDirectStorage, { type DirectStorageStatus } from '@/lib/secure-direct-storage';

interface SecureStorageState {
  status: DirectStorageStatus;
  isLoading: boolean;
  error: string | null;
  needsLibrarySelection: boolean;
}

interface SecureStorageActions {
  initialize: (userEmail: string) => Promise<boolean>;
  selectLibraryFolder: () => Promise<boolean>;
  writeSong: (songId: string, songData: any) => Promise<boolean>;
  readSong: (songId: string) => Promise<any | null>;
  writeAudio: (trackId: string, audioBlob: Blob, filename: string) => Promise<boolean>;
  readAudio: (filename: string) => Promise<Blob | null>;
  listSongs: () => Promise<string[]>;
  refreshStatus: () => void;
}

export function useSecureStorage(): [SecureStorageState, SecureStorageActions] {
  const [state, setState] = useState<SecureStorageState>({
    status: {
      isSupported: SecureDirectStorage.isSupported(),
      isInitialized: false,
      hasLibraryFolder: false,
      libraryPath: 'No folder selected'
    },
    isLoading: false,
    error: null,
    needsLibrarySelection: false
  });

  const storage = SecureDirectStorage.getInstance();

  // Update state from storage status
  const refreshStatus = useCallback(() => {
    const status = storage.getStatus();
    setState(prev => ({
      ...prev,
      status,
      needsLibrarySelection: status.isSupported && !status.isInitialized,
      error: status.lastError || null
    }));
  }, [storage]);

  // Initialize storage with user email
  const initialize = useCallback(async (userEmail: string): Promise<boolean> => {
    console.log('🔧 Initializing secure storage for:', userEmail);
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const initialized = await storage.initialize(userEmail);
      refreshStatus();
      
      if (!initialized) {
        console.log('ℹ️ No existing library found, user needs to select folder');
        setState(prev => ({ ...prev, needsLibrarySelection: true }));
      }
      
      setState(prev => ({ ...prev, isLoading: false }));
      return initialized;
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to initialize storage';
      console.error('❌ Storage initialization failed:', error);
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: errorMsg 
      }));
      return false;
    }
  }, [storage, refreshStatus]);

  // Select library folder
  const selectLibraryFolder = useCallback(async (): Promise<boolean> => {
    console.log('📁 Requesting library folder selection...');
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const selected = await storage.selectLibraryFolder();
      refreshStatus();
      
      if (selected) {
        setState(prev => ({ 
          ...prev, 
          needsLibrarySelection: false, 
          isLoading: false 
        }));
        console.log('✅ Library folder selected successfully');
      } else {
        setState(prev => ({ 
          ...prev, 
          isLoading: false,
          error: 'Failed to select library folder' 
        }));
      }
      
      return selected;
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to select folder';
      console.error('❌ Folder selection failed:', error);
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: errorMsg 
      }));
      return false;
    }
  }, [storage, refreshStatus]);

  // Write song data
  const writeSong = useCallback(async (songId: string, songData: any): Promise<boolean> => {
    try {
      return await storage.writeSongData(songId, songData);
    } catch (error) {
      console.error('❌ Failed to write song:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to write song' 
      }));
      return false;
    }
  }, [storage]);

  // Read song data
  const readSong = useCallback(async (songId: string): Promise<any | null> => {
    try {
      return await storage.readSongData(songId);
    } catch (error) {
      console.error('❌ Failed to read song:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to read song' 
      }));
      return null;
    }
  }, [storage]);

  // Write audio file
  const writeAudio = useCallback(async (trackId: string, audioBlob: Blob, filename: string): Promise<boolean> => {
    try {
      return await storage.writeAudioFile(trackId, audioBlob, filename);
    } catch (error) {
      console.error('❌ Failed to write audio:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to write audio' 
      }));
      return false;
    }
  }, [storage]);

  // Read audio file
  const readAudio = useCallback(async (filename: string): Promise<Blob | null> => {
    try {
      return await storage.readAudioFile(filename);
    } catch (error) {
      console.error('❌ Failed to read audio:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to read audio' 
      }));
      return null;
    }
  }, [storage]);

  // List all songs
  const listSongs = useCallback(async (): Promise<string[]> => {
    try {
      return await storage.listSongs();
    } catch (error) {
      console.error('❌ Failed to list songs:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to list songs' 
      }));
      return [];
    }
  }, [storage]);

  // Clear any existing error after some time
  useEffect(() => {
    if (state.error) {
      const timer = setTimeout(() => {
        setState(prev => ({ ...prev, error: null }));
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [state.error]);

  const actions: SecureStorageActions = {
    initialize,
    selectLibraryFolder,
    writeSong,
    readSong,
    writeAudio,
    readAudio,
    listSongs,
    refreshStatus
  };

  return [state, actions];
}

export default useSecureStorage;