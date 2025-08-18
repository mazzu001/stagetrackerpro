import { useEffect, useRef } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { persistence } from '@/lib/storage-persistence';

export function useAutoSave() {
  const isLoadingRef = useRef(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout>();

  // No-op auto-save (data is now in cloud database)
  const saveToLocalStorage = async () => {
    if (isLoadingRef.current) return;
    // Data is automatically saved to cloud database - no action needed
    console.log('Data auto-saves to cloud database');
  };

  // Load audio file cache from localStorage (files only, not data)
  const loadFromLocalStorage = async () => {
    try {
      isLoadingRef.current = true;
      // Only load audio file references from localStorage
      const audioFileCache = localStorage.getItem('audioFileCache');
      if (audioFileCache) {
        console.log('Audio file cache loaded from localStorage');
      }
    } catch (error) {
      console.warn('Failed to load audio file cache:', error);
    } finally {
      isLoadingRef.current = false;
    }
  };

  // Debounced save function
  const debouncedSave = () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(saveToLocalStorage, 1000);
  };

  // Auto-save whenever data changes
  useEffect(() => {
    // Load data on startup
    loadFromLocalStorage();

    // Set up periodic auto-save
    const interval = setInterval(saveToLocalStorage, 30000); // Save every 30 seconds

    // Clean up
    return () => {
      clearInterval(interval);
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return {
    saveNow: saveToLocalStorage,
    debouncedSave,
    storageInfo: persistence.getStorageInfo(),
    clearData: persistence.clearData
  };
}