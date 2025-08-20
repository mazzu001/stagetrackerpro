import * as FileSystem from 'expo-file-system';
import { Platform, Alert } from 'react-native';

// Critical Android-specific crash prevention utilities

export const executeWithCrashProtection = async <T>(
  operation: () => Promise<T>,
  context: string,
  fallback?: () => Promise<T>
): Promise<T | null> => {
  try {
    console.log(`[CRASH PROTECTION] Starting: ${context}`);
    const result = await operation();
    console.log(`[CRASH PROTECTION] Success: ${context}`);
    return result;
  } catch (error) {
    console.error(`[CRASH PROTECTION] Failed: ${context}`, error);
    
    if (fallback) {
      try {
        console.log(`[CRASH PROTECTION] Trying fallback for: ${context}`);
        return await fallback();
      } catch (fallbackError) {
        console.error(`[CRASH PROTECTION] Fallback failed: ${context}`, fallbackError);
      }
    }
    
    // Don't re-throw to prevent crash
    return null;
  }
};

export const safeFileOperation = async (
  operation: () => Promise<void>,
  fileName: string
): Promise<boolean> => {
  return await executeWithCrashProtection(
    operation,
    `File operation: ${fileName}`,
    async () => {
      console.log(`Skipping failed file operation for: ${fileName}`);
    }
  ) !== null;
};

export const validateAndroidEnvironment = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') return true;
  
  try {
    console.log('[ANDROID ENV CHECK] Starting environment validation...');
    
    // Test 1: Document directory access
    const docDir = FileSystem.documentDirectory;
    if (!docDir) {
      throw new Error('Document directory unavailable');
    }
    console.log('[ANDROID ENV CHECK] Document directory:', docDir);
    
    // Test 2: Directory info access
    const dirInfo = await FileSystem.getInfoAsync(docDir);
    if (!dirInfo.exists) {
      throw new Error('Document directory not accessible');
    }
    console.log('[ANDROID ENV CHECK] Directory accessible');
    
    // Test 3: Create test directory
    const testDir = `${docDir}crash_test/`;
    await FileSystem.makeDirectoryAsync(testDir, { intermediates: true });
    console.log('[ANDROID ENV CHECK] Directory creation works');
    
    // Test 4: Write test file
    const testFile = `${testDir}test.txt`;
    await FileSystem.writeAsStringAsync(testFile, 'test content');
    console.log('[ANDROID ENV CHECK] File writing works');
    
    // Test 5: Read test file
    const content = await FileSystem.readAsStringAsync(testFile);
    if (content !== 'test content') {
      throw new Error('File read/write mismatch');
    }
    console.log('[ANDROID ENV CHECK] File reading works');
    
    // Cleanup
    await FileSystem.deleteAsync(testDir, { idempotent: true });
    console.log('[ANDROID ENV CHECK] All tests passed');
    
    return true;
  } catch (error) {
    console.error('[ANDROID ENV CHECK] Failed:', error);
    Alert.alert(
      'Android Environment Error',
      `Environment validation failed: ${error.message}\n\nThe app may not work correctly. Please:\n1. Restart the app\n2. Clear app data in Android settings\n3. Reinstall the app if needed`
    );
    return false;
  }
};

export const getAndroidSafeFilePath = (originalPath: string): string => {
  if (Platform.OS !== 'android') return originalPath;
  
  // Android path safety checks
  const safePath = originalPath
    .replace(/[<>:"|?*]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase();
    
  // Ensure path length is safe for Android
  const maxLength = 240; // Conservative Android path limit
  if (safePath.length > maxLength) {
    const extension = safePath.substring(safePath.lastIndexOf('.'));
    const baseName = safePath.substring(0, maxLength - extension.length);
    return baseName + extension;
  }
  
  return safePath;
};

export const createAndroidSafeFileName = (originalName: string): string => {
  if (!originalName) {
    return `track_${Date.now()}.mp3`;
  }
  
  if (Platform.OS !== 'android') {
    return originalName.replace(/[<>:"|?*]/g, '_');
  }
  
  // Aggressive Android filename sanitization
  const cleaned = originalName
    .replace(/[^\w\s.-]/g, '') // Keep only word chars, spaces, dots, hyphens
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/_+/g, '_') // Collapse multiple underscores
    .replace(/^[._]+|[._]+$/g, '') // Remove leading/trailing dots/underscores
    .toLowerCase(); // Lowercase for consistency
    
  // Ensure we have a valid extension
  if (!cleaned.includes('.')) {
    return `${cleaned}.mp3`;
  }
  
  // Limit total filename length for Android
  if (cleaned.length > 100) {
    const parts = cleaned.split('.');
    const extension = parts.pop();
    const baseName = parts.join('.').substring(0, 95);
    return `${baseName}.${extension}`;
  }
  
  return cleaned;
};