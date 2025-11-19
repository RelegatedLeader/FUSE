import { initializeFirebaseAuth } from './utils/firebase.ts';
import { FirebaseService } from './utils/firebaseService.ts';

async function inspectFirebaseData() {
  try {
    console.log('🔍 Inspecting Firebase data...');

    // Initialize Firebase
    await initializeFirebaseAuth();

    // Test with a known wallet address
    const testAddress = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';
    await FirebaseService.initializeUser(testAddress);

    // Load matches
    console.log('Loading matches for:', testAddress);
    const matches = await FirebaseService.loadMatches(testAddress);
    console.log('Matches found:', matches.length);
    console.log('Match data:', JSON.stringify(matches, null, 2));

    // Load user profile
    console.log('Loading user profile for:', testAddress);
    const profile = await FirebaseService.getUserProfile(testAddress);
    console.log('User profile:', JSON.stringify(profile, null, 2));

  } catch (error) {
    console.error('❌ Inspection failed:', error);
  }
}

inspectFirebaseData();