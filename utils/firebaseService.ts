import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  query,
  where,
  getDocs,
  onSnapshot,
  orderBy,
  limit,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import { EncryptionService } from "./encryption";
import { KeyManager } from "./keyManager";

// Firebase service with encryption integration for FUSE
export class FirebaseService {
  private static userKeys: {
    masterKey: string;
    dataKey: string;
    messagingKey: string;
  } | null = null;

  // Initialize user encryption keys (TEST MODE: no auth required)
  static async initializeUser(walletAddress: string): Promise<void> {
    try {
      console.log("🔐 Initializing Firebase service for:", walletAddress);
      this.userKeys = await KeyManager.getUserKeys(walletAddress);
      if (!this.userKeys) {
        console.log("🔑 Generating new user keys...");
        this.userKeys = await KeyManager.generateUserKeys(walletAddress);
      }
      console.log("🔐 Firebase service initialized with user keys");
    } catch (error) {
      console.error("Failed to initialize Firebase user:", error);
      // For testing, create basic keys even if KeyManager fails
      this.userKeys = {
        masterKey: "test_master_key_" + walletAddress,
        dataKey: "test_data_key_" + walletAddress,
        messagingKey: "test_messaging_key_" + walletAddress,
      };
      console.log("🔐 Using test keys for development");
    }
  }

  // Store encrypted user profile
  static async storeUserProfile(
    walletAddress: string,
    profileData: any
  ): Promise<void> {
    if (!this.userKeys) {
      throw new Error("User keys not initialized");
    }

    try {
      // Separate matching data from sensitive data
      const matchingData = {
        mbti: profileData.mbti,
        personalityTraits: profileData.personalityTraits,
        location: profileData.location,
        birthdate: profileData.dob,
        // Add basic info needed for matching
        firstName: profileData.firstName,
        lastName: profileData.lastName,
        gender: profileData.gender,
      };

      const sensitiveData = {
        email: profileData.email,
        occupation: profileData.occupation,
        careerAspiration: profileData.careerAspiration,
        bio: profileData.bio,
        id: profileData.id,
        openEnded: profileData.openEnded,
        transactionHash: profileData.transactionHash,
        walletAddress: profileData.walletAddress,
      };

      const encryptedSensitiveData = EncryptionService.encryptUserProfile(
        sensitiveData,
        this.userKeys.dataKey
      );

      const userRef = doc(db, "users", walletAddress);
      await setDoc(userRef, {
        // Public matching data (unencrypted)
        matchingData,
        // Encrypted sensitive data
        encryptedProfile: encryptedSensitiveData,
        lastUpdated: Timestamp.now(),
        version: "1.0",
      });

      console.log("💾 Stored user profile for:", walletAddress);
    } catch (error) {
      throw new Error("Failed to store user profile: " + error);
    }
  }

  // Retrieve and decrypt user profile
  static async getUserProfile(walletAddress: string): Promise<any> {
    if (!this.userKeys) {
      throw new Error("User keys not initialized");
    }

    try {
      const userRef = doc(db, "users", walletAddress);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        return null;
      }

      const data = userSnap.data();

      // Handle both old format (fully encrypted) and new format (separated)
      if (data!.matchingData) {
        // New format: matching data is separate
        let decryptedSensitiveData: any = {};
        if (data!.encryptedProfile) {
          try {
            decryptedSensitiveData = EncryptionService.decryptUserProfile(
              data!.encryptedProfile,
              this.userKeys.dataKey
            );
          } catch (error) {
            // If we can't decrypt (different user's keys), that's OK for matching
            console.log(
              "Cannot decrypt sensitive data for user:",
              walletAddress
            );
          }
        }

        return {
          ...data!.matchingData,
          ...decryptedSensitiveData,
          traits: {
            personalityTraits: data!.matchingData?.personalityTraits,
            bio: data!.matchingData?.bio || decryptedSensitiveData?.bio || "",
          },
        };
      } else if (data!.encryptedProfile) {
        // Old format: try to decrypt everything
        try {
          const decryptedData = EncryptionService.decryptUserProfile(
            data!.encryptedProfile,
            this.userKeys.dataKey
          );

          // For old format, we can only return data if we can decrypt it
          // This will only work for the user's own profile
          return decryptedData;
        } catch (error) {
          // Cannot decrypt old format data from other users
          return null;
        }
      }

      return null;
    } catch (error) {
      throw new Error("Failed to retrieve user profile: " + error);
    }
  }

  // Store encrypted message
  static async sendMessage(
    conversationId: string,
    message: string,
    senderAddress: string,
    recipientAddress: string
  ): Promise<void> {
    if (!this.userKeys) {
      throw new Error("User keys not initialized");
    }

    try {
      const messageId = `${conversationId}_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;
      const encryptedMessage = EncryptionService.encryptMessage(
        message,
        this.userKeys.messagingKey,
        this.userKeys.messagingKey
      );

      const messageRef = doc(db, "messages", messageId);
      await setDoc(messageRef, {
        conversationId,
        encryptedMessage,
        senderAddress,
        recipientAddress,
        timestamp: Timestamp.now(),
        status: "sent",
      });

      console.log("📤 Sent encrypted message:", messageId);
    } catch (error) {
      throw new Error("Failed to send message: " + error);
    }
  }

  // Get messages for a conversation
  static async getConversationMessages(conversationId: string): Promise<any[]> {
    if (!this.userKeys) {
      throw new Error("User keys not initialized");
    }

    try {
      const messagesRef = collection(db, "messages");
      const q = query(
        messagesRef,
        where("conversationId", "==", conversationId),
        orderBy("timestamp", "asc")
      );

      const querySnapshot = await getDocs(q);
      const messages = [];

      for (const docSnap of querySnapshot.docs) {
        const data = docSnap.data();
        try {
          const decryptedMessage = EncryptionService.decryptMessage(
            data.encryptedMessage,
            this.userKeys.messagingKey
          );
          messages.push({
            id: docSnap.id,
            message: decryptedMessage,
            senderAddress: data.senderAddress,
            recipientAddress: data.recipientAddress,
            timestamp: data.timestamp.toDate(),
            status: data.status,
          });
        } catch (decryptError) {
          console.warn("Failed to decrypt message:", docSnap.id, decryptError);
          // Skip undecryptable messages
        }
      }

      return messages;
    } catch (error) {
      throw new Error("Failed to get conversation messages: " + error);
    }
  }

  // Listen to real-time messages
  static listenToMessages(
    conversationId: string,
    callback: (messages: any[]) => void
  ): () => void {
    if (!this.userKeys) {
      throw new Error("User keys not initialized");
    }

    const messagesRef = collection(db, "messages");
    const q = query(
      messagesRef,
      where("conversationId", "==", conversationId),
      orderBy("timestamp", "desc"),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const messages: any[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        try {
          const decryptedMessage = EncryptionService.decryptMessage(
            data.encryptedMessage,
            this.userKeys!.messagingKey
          );
          messages.unshift({
            id: doc.id,
            message: decryptedMessage,
            senderAddress: data.senderAddress,
            recipientAddress: data.recipientAddress,
            timestamp: data.timestamp.toDate(),
            status: data.status,
          });
        } catch (error) {
          console.warn("Failed to decrypt real-time message:", doc.id);
        }
      });
      callback(messages);
    });

    return unsubscribe;
  }

  // Store encrypted match data
  static async storeMatchData(matchId: string, matchData: any): Promise<void> {
    if (!this.userKeys) {
      throw new Error("User keys not initialized");
    }

    try {
      const encryptedMatchData = EncryptionService.encryptUserProfile(
        matchData,
        this.userKeys.dataKey
      );

      const matchRef = doc(db, "matches", matchId);
      await setDoc(matchRef, {
        encryptedMatchData,
        createdAt: Timestamp.now(),
        lastUpdated: Timestamp.now(),
      });

      console.log("🎯 Stored encrypted match data:", matchId);
    } catch (error) {
      throw new Error("Failed to store match data: " + error);
    }
  }

  // Get potential matches (encrypted compatibility scores)
  static async findMatches(userAddress: string, criteria: any): Promise<any[]> {
    if (!this.userKeys) {
      throw new Error("User keys not initialized");
    }

    try {
      const usersRef = collection(db, "users");
      const querySnapshot = await getDocs(usersRef);

      const matches = [];
      for (const docSnap of querySnapshot.docs) {
        if (docSnap.id === userAddress) continue; // Skip self

        try {
          const userData = await this.getUserProfile(docSnap.id);
          if (userData && this.matchesCriteria(userData, criteria)) {
            matches.push({
              address: docSnap.id,
              profile: userData,
              compatibilityScore: this.calculateCompatibility(
                userData,
                criteria
              ),
            });
          }
        } catch (error) {
          console.warn("Failed to process user for matching:", docSnap.id);
        }
      }

      // Sort by compatibility score
      return matches.sort(
        (a, b) => b.compatibilityScore - a.compatibilityScore
      );
    } catch (error) {
      throw new Error("Failed to find matches: " + error);
    }
  }

  // Store encrypted interaction data
  static async storeInteraction(interactionData: any): Promise<void> {
    if (!this.userKeys) {
      throw new Error("User keys not initialized");
    }

    try {
      const interactionId = `interaction_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;
      const encryptedInteraction = EncryptionService.encryptUserProfile(
        interactionData,
        this.userKeys.dataKey
      );

      const interactionRef = doc(db, "interactions", interactionId);
      await setDoc(interactionRef, {
        encryptedInteraction,
        timestamp: Timestamp.now(),
      });

      console.log("📊 Stored encrypted interaction data:", interactionId);
    } catch (error) {
      throw new Error("Failed to store interaction: " + error);
    }
  }

  // Create temporary session for real-time coordination
  static async createSession(sessionData: any): Promise<string> {
    try {
      const sessionId = `session_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      const sessionRef = doc(db, "sessions", sessionId);
      await setDoc(sessionRef, {
        ...sessionData,
        createdAt: Timestamp.now(),
        expiresAt: Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      });

      console.log("⏰ Created temporary session:", sessionId);
      return sessionId;
    } catch (error) {
      throw new Error("Failed to create session: " + error);
    }
  }

  // Batch operations for efficiency
  static async batchStoreUserData(
    userAddress: string,
    profileData: any,
    interactions: any[]
  ): Promise<void> {
    if (!this.userKeys) {
      throw new Error("User keys not initialized");
    }

    try {
      const batch = writeBatch(db);

      // Store profile
      const encryptedProfile = EncryptionService.encryptUserProfile(
        profileData,
        this.userKeys.dataKey
      );
      const userRef = doc(db, "users", userAddress);
      batch.set(userRef, {
        encryptedProfile,
        lastUpdated: Timestamp.now(),
        version: "1.0",
      });

      // Store interactions
      interactions.forEach((interaction, index) => {
        const interactionId = `interaction_${userAddress}_${Date.now()}_${index}`;
        const encryptedInteraction = EncryptionService.encryptUserProfile(
          interaction,
          this.userKeys!.dataKey
        );
        const interactionRef = doc(db, "interactions", interactionId);
        batch.set(interactionRef, {
          encryptedInteraction,
          timestamp: Timestamp.now(),
        });
      });

      await batch.commit();
      console.log("📦 Batch stored user data and interactions");
    } catch (error) {
      throw new Error("Failed to batch store user data: " + error);
    }
  }

  // Helper: Check if user matches criteria
  private static matchesCriteria(userData: any, criteria: any): boolean {
    // Basic filtering logic - can be enhanced with ML
    if (criteria.minAge && userData.birthdate) {
      const age =
        new Date().getFullYear() - new Date(userData.birthdate).getFullYear();
      if (age < criteria.minAge) return false;
    }

    if (criteria.maxAge && userData.birthdate) {
      const age =
        new Date().getFullYear() - new Date(userData.birthdate).getFullYear();
      if (age > criteria.maxAge) return false;
    }

    // Location filtering disabled for now - allow global matching
    // if (criteria.location && userData.location) {
    //   if (
    //     !userData.location
    //       .toLowerCase()
    //       .includes(criteria.location.toLowerCase())
    //   ) {
    //     return false;
    //   }
    // }

    return true;
  }

  // Helper: Calculate compatibility score (placeholder - will be enhanced with ML)
  private static calculateCompatibility(userData: any, criteria: any): number {
    let score = 0;

    // MBTI compatibility (simplified)
    if (userData.mbti && criteria.mbti) {
      if (userData.mbti === criteria.mbti) score += 30;
      else if (userData.mbti.charAt(0) === criteria.mbti.charAt(0)) score += 15;
    }

    // Location match disabled for now - global matching
    // if (userData.location && criteria.location) {
    //   if (
    //     userData.location
    //       .toLowerCase()
    //       .includes(criteria.location.toLowerCase())
    //   ) {
    //     score += 20;
    //   }
    // }

    // Age compatibility
    if (userData.birthdate && criteria.birthdate) {
      const userAge =
        new Date().getFullYear() - new Date(userData.birthdate).getFullYear();
      const criteriaAge =
        new Date().getFullYear() - new Date(criteria.birthdate).getFullYear();
      const ageDiff = Math.abs(userAge - criteriaAge);
      score += Math.max(0, 25 - ageDiff * 2);
    }

    return Math.min(100, score);
  }
}
