import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { BrowserFileSystem } from '@/lib/browser-file-system';
import { AudioFileStorage } from '@/lib/audio-file-storage';
import { LocalSongStorage } from '@/lib/local-song-storage';

interface StorageContextType {
  browserFS: BrowserFileSystem | null;
  audioStorage: AudioFileStorage | null;
  userIdentifier: string;
  isInitialized: boolean;
  error: string | null;
}

const StorageContext = createContext<StorageContextType>({
  browserFS: null,
  audioStorage: null,
  userIdentifier: 'local_user',
  isInitialized: false,
  error: null
});

export function useStorage() {
  const context = useContext(StorageContext);
  if (!context) {
    throw new Error('useStorage must be used within StorageProvider');
  }
  return context;
}

interface StorageProviderProps {
  children: ReactNode;
  // No longer need userEmail prop - always use local storage
}

export function StorageProvider({ children }: StorageProviderProps) {
  const [browserFS, setBrowserFS] = useState<BrowserFileSystem | null>(null);
  const [audioStorage, setAudioStorage] = useState<AudioFileStorage | null>(null);
  const [currentUserIdentifier] = useState('local_user'); // Static local identifier
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeStorage = async () => {
      // Reset state when initializing
      setIsInitialized(false);
      setError(null);
      
      // Use static local identifier
      const identifier = currentUserIdentifier;
      console.log(`🔧 Initializing storage for local user: ${identifier}`);
      
      try {
        // Step 1: Get or create BrowserFileSystem instance
        const fs = BrowserFileSystem.getInstance(identifier);
        
        // Step 2: Check if database exists
        const dbExists = await fs.isAlreadyInitialized();
        console.log(`📊 Database exists for ${identifier}: ${dbExists}`);
        
        // Step 3: Initialize (load existing or create new) - SEQUENTIAL
        if (dbExists) {
          console.log(`📂 Loading existing database for ${identifier}`);
        } else {
          console.log(`🆕 Creating new database for ${identifier}`);
        }
        
        const initialized = await fs.initialize();
        if (!initialized) {
          throw new Error('Failed to initialize BrowserFileSystem');
        }
        
        // Step 4: Get storage instances (they share the same user context)
        const audio = AudioFileStorage.getInstance(identifier);
        
        // Step 5: Initialize AudioFileStorage sequentially
        console.log('📦 Initializing AudioFileStorage sequentially...');
        await audio.initializeSequential();
        console.log('✅ AudioFileStorage initialized');
        
        // Step 6: LocalSongStorage is a static class that uses userEmail directly
        
        // Step 7: Update state
        setBrowserFS(fs);
        setAudioStorage(audio);
        setIsInitialized(true);
        
        console.log(`✅ Storage initialization complete for ${identifier}`);
      } catch (err) {
        console.error('❌ Storage initialization failed:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setIsInitialized(false);
      }
    };
    
    // Initialize storage when user changes
    initializeStorage();
    
    // Cleanup function
    return () => {
      // Don't clear instances on unmount, they're singletons
      console.log('🧹 StorageProvider cleanup');
    };
  }, [currentUserIdentifier]); // Re-initialize when user identifier changes
  
  return (
    <StorageContext.Provider value={{
      browserFS,
      audioStorage,
      userIdentifier: currentUserIdentifier,
      isInitialized,
      error
    }}>
      {children}
    </StorageContext.Provider>
  );
}