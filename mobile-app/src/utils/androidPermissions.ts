import * as FileSystem from 'expo-file-system';
import { Alert, Platform } from 'react-native';

export const checkAndroidPermissions = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') {
    return true; // iOS doesn't need these checks
  }

  try {
    // Test basic file system access
    const documentsDir = FileSystem.documentDirectory;
    if (!documentsDir) {
      throw new Error('Document directory not available');
    }

    // Test reading directory info
    const dirInfo = await FileSystem.getInfoAsync(documentsDir);
    if (!dirInfo.exists) {
      throw new Error('Document directory not accessible');
    }

    // Test creating a directory
    const testDir = `${documentsDir}test_permissions/`;
    await FileSystem.makeDirectoryAsync(testDir, { intermediates: true });
    
    // Test writing a file
    const testFile = `${testDir}test.txt`;
    await FileSystem.writeAsStringAsync(testFile, 'test');
    
    // Test reading the file
    const content = await FileSystem.readAsStringAsync(testFile);
    
    // Cleanup
    await FileSystem.deleteAsync(testDir, { idempotent: true });
    
    console.log('Android permissions check passed');
    return true;
    
  } catch (error) {
    console.error('Android permissions check failed:', error);
    
    Alert.alert(
      'Storage Permission Required',
      'This app needs storage permission to import audio files. Please:\n\n' +
      '1. Go to device Settings\n' +
      '2. Find this app\n' +
      '3. Enable Storage permissions\n' +
      '4. Restart the app',
      [{ text: 'OK' }]
    );
    
    return false;
  }
};

export const validateAndroidFilePath = (filePath: string): string => {
  if (Platform.OS !== 'android') {
    return filePath;
  }

  // Android-specific path validation and correction
  const correctedPath = filePath
    .replace(/[<>:"|?*]/g, '_') // Replace Windows-invalid chars
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/_+/g, '_') // Replace multiple underscores
    .replace(/^_|_$/g, '') // Remove leading/trailing underscores
    .toLowerCase(); // Lowercase for consistency

  return correctedPath;
};

export const getAndroidSafeFileName = (originalName: string): string => {
  if (Platform.OS !== 'android') {
    return originalName;
  }

  const safeName = originalName
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase();

  // Ensure extension is preserved
  const parts = originalName.split('.');
  const extension = parts.length > 1 ? parts[parts.length - 1].toLowerCase() : 'mp3';
  const nameWithoutExt = safeName.replace(/\.[^.]*$/, '');
  
  return `${nameWithoutExt}.${extension}`;
};