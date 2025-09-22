import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { BrowserFileSystem } from '@/lib/browser-file-system';
import { AudioFileStorage } from '@/lib/audio-file-storage';
import { LocalSongStorage } from '@/lib/local-song-storage';
import { useLocalAuth } from '@/hooks/useLocalAuth';

interface StorageContextType {
  browserFS: BrowserFileSystem | null;
  audioStorage: AudioFileStorage | null;
  userEmail: string;
  isInitialized: boolean;
  error: string | null;
}

const StorageContext = createContext<StorageContextType>({
  browserFS: null,
  audioStorage: null,
  userEmail: 'default@user.com',
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
}

export function StorageProvider({ children }: StorageProviderProps) {
  const { user } = useLocalAuth();
  const [browserFS, setBrowserFS] = useState<BrowserFileSystem | null>(null);
  const [audioStorage, setAudioStorage] = useState<AudioFileStorage | null>(null);
  const [userEmail, setUserEmail] = useState('default@user.com');
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeStorage = async () => {
      // Reset state when user changes
      setIsInitialized(false);
      setError(null);
      
      // Determine user email (use default if not logged in)
      const email = user?.email || 'default@user.com';
      console.log(`🔧 Initializing storage for user: ${email}`);
      setUserEmail(email);
      
      try {
        // Step 1: Get or create BrowserFileSystem instance
        const fs = BrowserFileSystem.getInstance(email);
        
        // Step 2: Check if database exists
        const dbExists = await fs.isAlreadyInitialized();
        console.log(`📊 Database exists for ${email}: ${dbExists}`);
        
        // Step 3: Initialize (load existing or create new)
        if (dbExists) {
          console.log(`📂 Loading existing database for ${email}`);
        } else {
          console.log(`🆕 Creating new database for ${email}`);
        }
        
        const initialized = await fs.initialize();
        if (!initialized) {
          throw new Error('Failed to initialize BrowserFileSystem');
        }
        
        // Step 4: Get storage instances (they share the same user context)
        const audio = AudioFileStorage.getInstance(email);
        
        // Step 5: LocalSongStorage is a static class that uses userEmail directly
        
        // Step 6: Update state
        setBrowserFS(fs);
        setAudioStorage(audio);
        setIsInitialized(true);
        
        console.log(`✅ Storage initialization complete for ${email}`);
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
  }, [user?.email]); // Re-initialize when user email changes
  
  return (
    <StorageContext.Provider value={{
      browserFS,
      audioStorage,
      userEmail,
      isInitialized,
      error
    }}>
      {children}
    </StorageContext.Provider>
  );
}