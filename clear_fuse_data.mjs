import { FirebaseService } from './utils/firebaseService';
import { initializeFirebaseAuth } from './utils/firebase';

async function clearData() {
  try {
    await initializeFirebaseAuth();
    await FirebaseService.clearAllFuseData();
    console.log('Data cleared successfully');
  } catch (error) {
    console.error('Error clearing data:', error);
  }
}

clearData();