import { initializeFirebaseAuth } from './utils/firebase';
import { FirebaseService } from './utils/firebaseService';

// Simple test for Firebase Storage upload
async function testFirebaseUpload() {
  try {
    console.log('🧪 Testing Firebase Storage upload...');

    // Initialize Firebase auth first
    await initializeFirebaseAuth();

    // Initialize with a test wallet address
    await FirebaseService.initializeUser('0x742d35Cc6634C0532925a3b844Bc454e4438f44e');

    // Create a small test image (1x1 pixel PNG in base64)
    const testBase64Image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

    // Test the upload
    const downloadUrl = await FirebaseService.uploadUserImageFromBase64(
      testBase64Image,
      '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
      0
    );

    console.log('✅ Upload successful! Download URL:', downloadUrl);
    return downloadUrl;
  } catch (error) {
    console.error('❌ Upload test failed:', error);
    throw error;
  }
}

// Run the test
testFirebaseUpload()
  .then(() => console.log('🎉 Test completed successfully'))
  .catch((error) => console.error('💥 Test failed:', error));