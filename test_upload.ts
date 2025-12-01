// Test script for XMLHttpRequest Firebase Storage upload
import { FirebaseService } from "./utils/firebaseService";
import { initializeFirebaseAuth } from "./utils/firebase";

async function testXMLHttpRequestUpload() {
  try {
    console.log("🧪 Testing XMLHttpRequest Firebase Storage upload...");

    // Initialize Firebase auth
    await initializeFirebaseAuth();

    // Initialize user
    await FirebaseService.initializeUser("test_wallet_address");

    // Test the upload with a small base64 image
    const downloadURL = await FirebaseService.uploadUserImageFromBase64(
      "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=",
      "test_wallet_address",
      0
    );

    console.log("✅ Test upload successful! Download URL:", downloadURL);
  } catch (error) {
    console.error("❌ Test upload failed:", error);
  }
}

// Run the test
testXMLHttpRequestUpload();
