// Simple test to trigger the mobile app crash
// This simulates adding tracks step by step

console.log('=== SIMPLE CRASH TEST START ===');

// Test the document picker result structure that might be causing the crash
const mockDocumentPickerResult = {
  canceled: false,
  assets: [
    {
      name: 'test-track.mp3',
      uri: 'file:///storage/emulated/0/Download/test-track.mp3',
      size: 5242880, // 5MB
      mimeType: 'audio/mpeg'
    }
  ]
};

console.log('Mock document picker result:', JSON.stringify(mockDocumentPickerResult, null, 2));

// Test the potential crash points
try {
  console.log('Testing result.canceled:', mockDocumentPickerResult.canceled);
  console.log('Testing result.assets:', mockDocumentPickerResult.assets);
  console.log('Testing Array.isArray(result.assets):', Array.isArray(mockDocumentPickerResult.assets));
  console.log('Testing result.assets.length:', mockDocumentPickerResult.assets.length);
  
  // Test asset iteration
  for (const asset of mockDocumentPickerResult.assets) {
    console.log('Processing asset:', asset.name);
    console.log('Asset URI:', asset.uri);
    console.log('Asset size:', asset.size);
    
    // Test filename sanitization
    const fileName = asset.name ? 
      asset.name.replace(/[^a-zA-Z0-9.-]/g, '_') : 
      `track_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.mp3`;
    console.log('Sanitized filename:', fileName);
    
    // Test path construction
    const permanentPath = `DOCUMENT_DIRECTORY/audio/${fileName}`;
    console.log('Permanent path:', permanentPath);
  }
  
  console.log('✅ All basic operations passed');
} catch (error) {
  console.error('❌ Crash in basic operations:', error);
}

console.log('=== SIMPLE CRASH TEST END ===');