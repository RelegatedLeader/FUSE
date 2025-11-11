import { Timestamp } from "firebase/firestore";

/**
 * FUSE Database Schema Design
 *
 * All user data is encrypted client-side using AES-256-GCM before storage.
 * Firebase only stores encrypted blobs - zero-knowledge architecture.
 */

export interface FirebaseSchema {
  // Users Collection - Encrypted user profiles
  users: {
    [walletAddress: string]: {
      encryptedProfile: string; // AES-256-GCM encrypted JSON
      lastUpdated: Timestamp;
      version: string;
    };
  };

  // Messages Collection - E2E encrypted messaging
  messages: {
    [messageId: string]: {
      conversationId: string;
      encryptedMessage: string; // AES-256-GCM encrypted message content
      senderAddress: string;
      recipientAddress: string;
      timestamp: Timestamp;
      status: "sent" | "delivered" | "read";
    };
  };

  // Matches Collection - Encrypted compatibility data
  matches: {
    [matchId: string]: {
      encryptedMatchData: string; // AES-256-GCM encrypted match analysis
      participants: string[]; // Wallet addresses
      createdAt: Timestamp;
      lastUpdated: Timestamp;
      status: "active" | "completed" | "expired";
    };
  };

  // Interactions Collection - Encrypted user activity data
  interactions: {
    [interactionId: string]: {
      encryptedInteraction: string; // AES-256-GCM encrypted interaction data
      userAddress: string;
      interactionType: "view" | "like" | "message" | "match" | "block";
      targetAddress?: string;
      timestamp: Timestamp;
    };
  };

  // Sessions Collection - Temporary real-time coordination
  sessions: {
    [sessionId: string]: {
      userAddress: string;
      sessionType: "matching" | "messaging" | "discovery";
      sessionData: any; // Minimal unencrypted coordination data
      createdAt: Timestamp;
      expiresAt: Timestamp;
    };
  };
}

// User Profile Structure (before encryption)
export interface UserProfile {
  // Basic Info
  firstName: string;
  lastName: string;
  birthdate: string;
  gender: string;
  location: string;

  // Personality Data
  mbti: string;
  traits: {
    personalityTraits: {
      extroversion: number; // 0-100
      openness: number; // 0-100
      conscientiousness: number; // 0-100
      agreeableness: number; // 0-100
      neuroticism: number; // 0-100
    };
    bio: string;
    openEnded: string;
  };

  // Metadata
  id: string;
  interactionCount: number;
  isRegistered: boolean;
  isVerified: boolean;
  lastUpdate: number;
}

// Message Structure (before encryption)
export interface MessageData {
  content: string;
  messageType: "text" | "image" | "system";
  metadata?: {
    replyTo?: string;
    attachments?: string[];
  };
}

// Match Data Structure (before encryption)
export interface MatchData {
  compatibilityScore: number;
  matchReasoning: {
    mbtiCompatibility: number;
    traitSimilarity: number;
    interestOverlap: number;
    locationProximity: number;
  };
  participantA: string;
  participantB: string;
  matchTimestamp: number;
  status: "pending" | "accepted" | "declined";
}

// Interaction Data Structure (before encryption)
export interface InteractionData {
  interactionType:
    | "view_profile"
    | "send_message"
    | "like_profile"
    | "create_match";
  targetUser: string;
  metadata: {
    duration?: number; // For profile views
    messageLength?: number; // For messages
    matchScore?: number; // For matches
  };
}

// Database Indexes (for Firestore performance)
export const FIRESTORE_INDEXES = [
  // Messages by conversation
  {
    collectionGroup: "messages",
    queryScope: "COLLECTION",
    fields: [
      { fieldPath: "conversationId", order: "ASCENDING" },
      { fieldPath: "timestamp", order: "ASCENDING" },
    ],
  },

  // Messages real-time listener
  {
    collectionGroup: "messages",
    queryScope: "COLLECTION",
    fields: [
      { fieldPath: "conversationId", order: "ASCENDING" },
      { fieldPath: "timestamp", order: "DESCENDING" },
    ],
  },

  // User interactions by user
  {
    collectionGroup: "interactions",
    queryScope: "COLLECTION",
    fields: [
      { fieldPath: "userAddress", order: "ASCENDING" },
      { fieldPath: "timestamp", order: "DESCENDING" },
    ],
  },

  // Sessions by expiration
  {
    collectionGroup: "sessions",
    queryScope: "COLLECTION",
    fields: [{ fieldPath: "expiresAt", order: "ASCENDING" }],
  },
];

// Security Rules Summary
export const SECURITY_RULES_SUMMARY = `
Firestore Security Rules for FUSE:

1. Users Collection:
   - Read/Write: Only authenticated users can access their own data
   - Read: Authenticated users can read other profiles for matching

2. Messages Collection:
   - Read/Write: All authenticated users (E2E encryption protects content)

3. Matches Collection:
   - Read/Write: All authenticated users (encrypted match data)

4. Interactions Collection:
   - Read/Write: All authenticated users (encrypted interaction data)

5. Sessions Collection:
   - Read/Write: All authenticated users
   - Auto-expiration: Sessions deleted after 24 hours

All sensitive data is encrypted client-side before reaching Firebase.
Firebase acts as a zero-knowledge encrypted storage and real-time coordination layer.
`;
