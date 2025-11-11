# FUSE - Web3 Social Matching Platform

FUSE is a revolutionary web3 social platform that connects people through sophisticated ML-powered matching algorithms, featuring military-grade E2E encryption and $0/month infrastructure costs.

## 🚀 Features

- **Zero-Knowledge Architecture**: All user data is encrypted client-side before reaching servers
- **ML-Powered Matching**: Advanced compatibility algorithms using MBTI, personality traits, and interaction history
- **E2E Encrypted Messaging**: Real-time messaging with AES-256-GCM encryption
- **Web3 Integration**: MetaMask wallet connection and Polygon blockchain verification
- **Offline-First**: Local encrypted storage for offline functionality
- **Privacy-Focused**: Firebase only stores encrypted blobs, never plaintext data

## 🏗️ Architecture

### Core Components

1. **Encryption Layer** (`utils/encryption.ts`)

   - AES-256-GCM encryption for all user data
   - PBKDF2 key derivation
   - Secure random key generation

2. **Key Management** (`utils/keyManager.ts`)

   - Device-specific key storage
   - User-specific encryption keys
   - Secure key rotation and backup

3. **Firebase Service** (`utils/firebaseService.ts`)

   - Encrypted data storage and retrieval
   - Real-time messaging coordination
   - Zero-knowledge Firebase integration

4. **Messaging Service** (`utils/messagingService.ts`)

   - E2E encrypted messaging
   - Real-time message synchronization
   - Typing indicators and presence

5. **Matching Engine** (`utils/matchingEngine.ts`)
   - Client-side ML compatibility analysis
   - MBTI compatibility matrix
   - Personality trait similarity scoring
   - Learning from user interactions

### Data Flow

```
User Input → Client-Side Encryption → Firebase (Encrypted) → Client-Side Decryption → User Display
```

## 🛠️ Setup Instructions

### 1. Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Fill in your Firebase configuration
# Get these values from your Firebase project settings
```

### 2. Firebase Configuration

1. Create a new Firebase project at https://console.firebase.google.com/
2. Enable Firestore Database
3. Enable Authentication (optional, using wallet-based auth)
4. Copy your Firebase config to `.env`:

```env
EXPO_PUBLIC_FIREBASE_API_KEY=your_api_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
EXPO_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef123456
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Firebase Security Rules

Apply the following security rules to your Firestore database:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection - encrypted data only
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      allow read: if request.auth != null;
    }

    // Messages collection - E2E encrypted
    match /messages/{messageId} {
      allow read, write: if request.auth != null;
    }

    // Matches collection - encrypted compatibility data
    match /matches/{matchId} {
      allow read, write: if request.auth != null;
    }

    // Interactions collection - encrypted activity data
    match /interactions/{interactionId} {
      allow read, write: if request.auth != null;
    }

    // Sessions collection - temporary coordination
    match /sessions/{sessionId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### 5. Run the Application

```bash
# Start the development server
npm start

# Or run on specific platform
npm run ios
npm run android
npm run web
```

## 🔐 Security Features

### Encryption

- **AES-256-GCM**: Industry-standard encryption for all user data
- **Client-Side Only**: Encryption/decryption happens entirely on device
- **Zero Knowledge**: Servers never see plaintext data

### Key Management

- **Device Keys**: Unique keys per device for additional security layer
- **User Keys**: Separate keys for each user account
- **Key Rotation**: Automatic key rotation for enhanced security
- **Secure Storage**: Encrypted key storage using AsyncStorage

### Privacy

- **No Plaintext Storage**: Firebase only stores encrypted data
- **Local Processing**: All ML matching runs client-side
- **Anonymous Analytics**: No personally identifiable information collected

## 🎯 Usage Examples

### Initialize User Session

```typescript
import { KeyManager } from "./utils/keyManager";
import { FirebaseService } from "./utils/firebaseService";
import { MessagingService } from "./utils/messagingService";

// Initialize encryption keys
await KeyManager.initializeDeviceKeys();

// Initialize Firebase with user
await FirebaseService.initializeUser(walletAddress);

// Initialize messaging
await MessagingService.initialize(walletAddress);
```

### Send Encrypted Message

```typescript
import { MessagingService } from "./utils/messagingService";

// Send a message
await MessagingService.sendMessage(
  recipientAddress,
  "Hello! I think we'd be great matches based on our MBTI compatibility! 🎯"
);
```

### Find Matches

```typescript
import { MatchingEngine } from "./utils/matchingEngine";

// Get personalized match recommendations
const matches = await MatchingEngine.findMatchesForUser(walletAddress, {
  minAge: 25,
  maxAge: 35,
  location: "Austin, TX",
});

// Get smart recommendations with ML learning
const smartMatches = await MatchingEngine.getSmartRecommendations(
  walletAddress,
  userInteractionHistory
);
```

### Store User Profile

```typescript
import { FirebaseService } from "./utils/firebaseService";

const userProfile = {
  firstName: "John",
  lastName: "Doe",
  birthdate: "1990-05-15",
  gender: "Male",
  location: "Austin, TX",
  mbti: "INTJ",
  traits: {
    personalityTraits: {
      extroversion: 25,
      openness: 85,
      conscientiousness: 90,
      agreeableness: 45,
      neuroticism: 30,
    },
    bio: "Tech enthusiast who loves blockchain and AI...",
    openEnded: "Looking for meaningful connections...",
  },
};

await FirebaseService.storeUserProfile(walletAddress, userProfile);
```

## 🔧 API Reference

### EncryptionService

- `generateKey()`: Generate random encryption key
- `encrypt(data, key)`: Encrypt data with AES-256-GCM
- `decrypt(data, key, iv, tag)`: Decrypt data
- `encryptUserProfile(profile, key)`: Encrypt user profile
- `decryptUserProfile(encryptedProfile, key)`: Decrypt user profile

### KeyManager

- `initializeDeviceKeys()`: Set up device encryption keys
- `generateUserKeys(walletAddress)`: Create user-specific keys
- `getUserKeys(walletAddress)`: Retrieve user keys
- `rotateUserKeys(walletAddress)`: Rotate encryption keys

### FirebaseService

- `initializeUser(walletAddress)`: Initialize user session
- `storeUserProfile(walletAddress, profile)`: Store encrypted profile
- `getUserProfile(walletAddress)`: Retrieve decrypted profile
- `sendMessage(conversationId, message, sender, recipient)`: Send encrypted message
- `findMatches(walletAddress, criteria)`: Find potential matches

### MessagingService

- `initialize(userAddress)`: Initialize messaging for user
- `sendMessage(recipientAddress, message)`: Send E2E encrypted message
- `getConversationMessages(recipientAddress)`: Get message history
- `listenToConversation(recipientAddress, callback)`: Real-time message listener

### MatchingEngine

- `findMatchesForUser(userAddress, criteria)`: Get match recommendations
- `calculateDetailedCompatibility(userA, userB)`: Calculate compatibility score
- `createMatch(userA, userB)`: Create a match between users
- `getSmartRecommendations(userAddress, history)`: ML-enhanced recommendations

## 📊 Compatibility Algorithm

FUSE uses a sophisticated multi-factor compatibility algorithm:

### Factors (Weighted)

- **MBTI Compatibility** (25%): Myers-Briggs personality type matching
- **Personality Traits** (35%): Big Five personality dimensions similarity
- **Interests & Values** (20%): Text analysis of user bios
- **Location Proximity** (10%): Geographic compatibility
- **Age Compatibility** (10%): Life stage alignment

### MBTI Compatibility Matrix

Pre-computed compatibility scores for all 16 MBTI types, based on psychological research and user data patterns.

### Machine Learning Features

- **Interaction Learning**: Learns from user likes, messages, and matches
- **Preference Adaptation**: Adjusts recommendations based on interaction history
- **Compatibility Refinement**: Improves accuracy over time

## 🚀 Deployment

### Vercel (Serverless Functions)

```bash
# Deploy to Vercel
npm i -g vercel
vercel --prod
```

### Firebase Hosting (Web)

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Initialize Firebase hosting
firebase init hosting

# Deploy
firebase deploy
```

## 🔒 Security Considerations

1. **Client-Side Encryption**: All sensitive operations happen on-device
2. **Key Security**: Keys never leave the device
3. **Zero Trust**: Firebase sees only encrypted data
4. **Regular Rotation**: Automatic key rotation for enhanced security
5. **Secure Storage**: Encrypted local storage for offline functionality

## 📈 Performance

- **Client-Side ML**: No server costs for matching algorithms
- **Efficient Encryption**: Optimized AES-256-GCM implementation
- **Lazy Loading**: On-demand data decryption
- **Offline Support**: Local encrypted cache for offline use

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Implement your changes with comprehensive tests
4. Ensure all TypeScript checks pass
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## ⚠️ Disclaimer

This is a sophisticated social platform with strong privacy guarantees. Users should understand that while data is encrypted, blockchain transactions are public. Always practice safe social networking habits.

---

**Built with ❤️ for the web3 social future**
