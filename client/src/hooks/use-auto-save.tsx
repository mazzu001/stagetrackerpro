import { useEffect, useRef } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { persistence } from '@/lib/storage-persistence';

export function useAutoSave() {
  const isLoadingRef = useRef(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout>();

  // Auto-save data to localStorage
  const saveToLocalStorage = async () => {
    if (isLoadingRef.current) return;

    try {
      // Get current data from server
      const response = await apiRequest('POST', '/api/persistence/save');
      const result = await response.json();
      
      if (result.success) {
        const { songs, tracks, midiEvents } = result.data;
        persistence.saveData(songs, tracks, midiEvents);
      }
    } catch (error) {
      console.warn('Failed to auto-save data:', error);
    }
  };

  // Load data from localStorage on startup
  const loadFromLocalStorage = async () => {
    try {
      isLoadingRef.current = true;
      const data = persistence.loadData();
      
      if (data) {
        await apiRequest('POST', '/api/persistence/load', data);
        console.log('Loaded data from localStorage');
      }
    } catch (error) {
      console.warn('Failed to load data from localStorage:', error);
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