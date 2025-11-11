import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Firebase configuration for FUSE
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "your-api-key",
  authDomain:
    process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ||
    "your-project.firebaseapp.com",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "your-project-id",
  storageBucket:
    process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    "your-project.appspot.com",
  messagingSenderId:
    process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId:
    process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "1:123456789:web:abcdef123456",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const db = getFirestore(app);
export const auth = getAuth(app);

// Firestore security rules helper
export const FIRESTORE_RULES = `
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection - encrypted data only
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      allow read: if request.auth != null; // Allow reading for matching
    }

    // Messages collection - E2E encrypted
    match /messages/{messageId} {
      allow read, write: if request.auth != null;
      // Additional validation can be added for message structure
    }

    // Matches collection - encrypted compatibility data
    match /matches/{matchId} {
      allow read, write: if request.auth != null;
    }

    // User interactions - encrypted activity data
    match /interactions/{interactionId} {
      allow read, write: if request.auth != null;
    }

    // Temporary sessions for real-time coordination
    match /sessions/{sessionId} {
      allow read, write: if request.auth != null;
      // Auto-delete after 24 hours
    }
  }
}
`;

export default app;
