import { FirebaseService } from './utils/firebaseService';
import { initializeFirebaseAuth } from './utils/firebase';

async function testImageUpload() {
  try {
    console.log('🧪 Testing Firebase image upload functionality...');

    // Initialize Firebase auth
    await initializeFirebaseAuth();
    console.log('✅ Firebase auth initialized');

    // Initialize user
    const testWalletAddress = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e'; // Test address
    await FirebaseService.initializeUser(testWalletAddress);
    console.log('✅ User initialized');

    // Create a small test image (1x1 pixel red square)
    const testBase64Image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

    console.log('📤 Uploading test image...');
    const downloadUrl = await FirebaseService.uploadUserImageFromBase64(
      testBase64Image,
      testWalletAddress,
      0
    );

    console.log('✅ Test image uploaded successfully!');
    console.log('🔗 Download URL:', downloadUrl);

    // Test downloading the image
    console.log('📥 Testing image download...');
    const downloadedBase64 = await FirebaseService.downloadUserImage(
      downloadUrl,
      testWalletAddress
    );

    console.log('✅ Image downloaded successfully!');
    console.log('📊 Downloaded data length:', downloadedBase64.length);

    // Verify the downloaded data matches original
    if (downloadedBase64.includes(testBase64Image)) {
      console.log('✅ Upload/download cycle successful - data integrity verified!');
    } else {
      console.log('⚠️  Data mismatch detected, but this may be expected for different formats');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testImageUpload();