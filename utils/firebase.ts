import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";

// Firebase configuration for FUSE
const firebaseConfig = {
  apiKey:
    process.env.EXPO_PUBLIC_FIREBASE_API_KEY ||
    "AIzaSyAvPvnDfJVt49njOLiSfs3bX714TSxEIiE",
  authDomain:
    process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ||
    "fuse-ede12.firebaseapp.com",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "fuse-ede12",
  storageBucket:
    process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    "fuse-ede12.firebasestorage.app",
  messagingSenderId:
    process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "912263943195",
  appId:
    process.env.EXPO_PUBLIC_FIREBASE_APP_ID ||
    "1:912263943195:web:0326708ad673c37a0014be",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const db = getFirestore(app);
export const auth = getAuth(app);

// Initialize anonymous authentication
export const initializeFirebaseAuth = async () => {
  try {
    if (!auth.currentUser) {
      await signInAnonymously(auth);
      console.log("🔐 Firebase anonymous authentication initialized");
    }
  } catch (error) {
    console.error("Failed to initialize Firebase auth:", error);
  }
};

// Firestore security rules helper (PRODUCTION MODE - requires authentication)
export const FIRESTORE_RULES = `
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection: Authenticated users can read all profiles and write their own
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }

    // Messages collection: Only authenticated users can read/write messages
    match /messages/{messageId} {
      allow read, write: if request.auth != null;
    }

    // Matches collection: Only authenticated users can read/write matches
    match /matches/{matchId} {
      allow read, write: if request.auth != null;
    }

    // Interactions collection: Only authenticated users can read/write interactions
    match /interactions/{interactionId} {
      allow read, write: if request.auth != null;
    }

    // Sessions collection: Only authenticated users can read/write sessions
    match /sessions/{sessionId} {
      allow read, write: if request.auth != null;
    }
  }
}
`;
