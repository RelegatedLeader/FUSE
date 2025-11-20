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
  QuerySnapshot,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  uploadString,
  getDownloadURL,
  deleteObject,
  listAll,
} from "firebase/storage";
import { getAuth, getIdToken } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import CryptoJS from "crypto-js";
import { db, storage } from "./firebase";
import { EncryptionService } from "./encryption";
import { KeyManager } from "./keyManager";

// Firebase service with encryption integration for FUSE
export class FirebaseService {
  private static userKeys: {
    masterKey: string;
    dataKey: string;
    messagingKey: string;
  } | null = null;

  // Arweave integration via Irys (formerly Bundlr) HTTP API
  private static arweaveWallet: any; // JWK interface

  // Arweave HTTP API integration for React Native compatibility
  private static readonly ARWEAVE_BASE_URL = "https://arweave.net";
  private static readonly IRYS_BASE_URL = "https://node1.irys.xyz";

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

  // Get Firebase auth token for API requests
  private static async getAuthToken(): Promise<string> {
    const auth = getAuth();
    if (!auth.currentUser) {
      throw new Error("No authenticated user");
    }
    return await getIdToken(auth.currentUser);
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
        sexuality: profileData.sexuality,
        bio: profileData.bio, // Include bio in matching data so it can be displayed
      };

      // Clean matchingData to remove undefined values
      const cleanedMatchingData = Object.fromEntries(
        Object.entries(matchingData).filter(([_, value]) => value !== undefined)
      );

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
        matchingData: cleanedMatchingData,
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
          bio: data!.matchingData?.bio || decryptedSensitiveData?.bio || "",
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
      // Message is already encrypted by MessagingService
      const encryptedMessage = message;

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
        where("conversationId", "==", conversationId)
      );

      const querySnapshot = await getDocs(q);
      const messages = [];

      for (const docSnap of querySnapshot.docs) {
        const data = docSnap.data();
        try {
          const decryptedMessage = EncryptionService.decryptMessage(
            data.encryptedMessage,
            "fuse_shared_messaging_key_2024"
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

      // Sort messages by timestamp
      messages.sort((a, b) => a.timestamp - b.timestamp);
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
    const q = query(messagesRef, where("conversationId", "==", conversationId));

    const unsubscribe = onSnapshot(q, async (querySnapshot) => {
      const messages: any[] = [];

      // Get the conversation key once for this snapshot
      const conversationKey = await this.getConversationKey(conversationId);
      console.log(
        "🔐 Using conversation key:",
        conversationKey.substring(0, 8) + "..."
      );

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        try {
          console.log(
            "🔐 Decrypting message:",
            data.encryptedMessage.substring(0, 50) + "..."
          );
          const decryptedMessage = EncryptionService.decryptMessage(
            data.encryptedMessage,
            conversationKey
          );
          console.log("🔐 Decrypted message:", decryptedMessage);
          messages.push({
            id: doc.id,
            message: decryptedMessage,
            senderAddress: data.senderAddress,
            recipientAddress: data.recipientAddress,
            timestamp: data.timestamp.toDate(),
            status: data.status,
          });
        } catch (decryptError) {
          console.warn("❌ Failed to decrypt message:", doc.id, decryptError);
          console.warn("❌ Encrypted message:", data.encryptedMessage);
          // Still add the message with encrypted content for debugging
          messages.push({
            id: doc.id,
            message: data.encryptedMessage, // Show encrypted content
            senderAddress: data.senderAddress,
            recipientAddress: data.recipientAddress,
            timestamp: data.timestamp.toDate(),
            status: data.status,
          });
        }
      });

      // Sort messages by timestamp on client side
      messages.sort((a, b) => a.timestamp - b.timestamp);
      callback(messages);
    });

    return unsubscribe;
  }

  // Get all messages for a user (for manual refresh)
  static async getAllUserMessages(userAddress: string): Promise<any[]> {
    if (!this.userKeys) {
      throw new Error("User keys not initialized");
    }

    const messagesRef = collection(db, "messages");
    const q = query(messagesRef);
    const querySnapshot = await getDocs(q);

    const messages: any[] = [];
    for (const doc of querySnapshot.docs) {
      const data = doc.data();
      if (
        data.senderAddress === userAddress ||
        data.recipientAddress === userAddress
      ) {
        try {
          const conversationId = [data.senderAddress, data.recipientAddress]
            .sort()
            .join("_");
          const conversationKey = await this.getConversationKey(conversationId);
          const decryptedMessage = EncryptionService.decryptMessage(
            data.encryptedMessage,
            conversationKey
          );
          messages.push({
            id: doc.id,
            message: decryptedMessage,
            senderAddress: data.senderAddress,
            recipientAddress: data.recipientAddress,
            timestamp: data.timestamp.toDate(),
            status: data.status,
          });
        } catch (error) {
          console.warn("Failed to decrypt message:", doc.id);
        }
      }
    }

    return messages.sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );
  }

  // Get or create conversation key for E2E encryption
  private static async getConversationKey(
    conversationId: string
  ): Promise<string> {
    const keyStorageKey = `conversation_key_v2_${conversationId}`;

    // Try to get existing key
    let conversationKey = await AsyncStorage.getItem(keyStorageKey);

    if (!conversationKey) {
      // Generate deterministic key for this conversation (both users will generate the same key)
      // Use hash of conversation ID as the key - take first 32 bytes for AES-256
      const hash = CryptoJS.SHA256(
        conversationId + "fuse_shared_messaging_key_2024"
      );
      conversationKey = CryptoJS.enc.Hex.stringify(hash).substring(0, 64); // 64 hex chars = 32 bytes

      // Store the key
      await AsyncStorage.setItem(keyStorageKey, conversationKey);

      console.log(
        "🔑 FirebaseService: Generated deterministic conversation key for:",
        conversationId
      );
    } else {
      console.log(
        "🔑 FirebaseService: Retrieved conversation key for:",
        conversationId
      );
    }

    return conversationKey;
  }

  // Listen to all messages for a user (for Chats tab)
  static listenToAllUserMessages(
    userAddress: string,
    callback: (messages: any[]) => void
  ): () => void {
    if (!this.userKeys) {
      throw new Error("User keys not initialized");
    }

    const messagesRef = collection(db, "messages");
    let allMessages: any[] = [];
    let callbackScheduled = false;

    const scheduleCallback = () => {
      if (!callbackScheduled) {
        callbackScheduled = true;
        setTimeout(async () => {
          // Filter for user's messages, decrypt with conversation keys, remove duplicates, sort, and limit
          const userMessages = allMessages.filter(
            (msg) =>
              msg.senderAddress === userAddress ||
              msg.recipientAddress === userAddress
          );

          // Decrypt messages with their conversation keys
          const decryptedMessages = await Promise.all(
            userMessages.map(async (msg) => {
              try {
                const conversationId = [msg.senderAddress, msg.recipientAddress]
                  .sort()
                  .join("_");
                const conversationKey = await this.getConversationKey(
                  conversationId
                );
                const decryptedMessage = EncryptionService.decryptMessage(
                  msg.encryptedMessage,
                  conversationKey
                );
                return {
                  ...msg,
                  message: decryptedMessage,
                };
              } catch (error) {
                console.warn("Failed to decrypt message:", msg.id);
                return null;
              }
            })
          );

          const validMessages = decryptedMessages.filter((msg) => msg !== null);
          const uniqueMessages = validMessages.filter(
            (msg, index, self) =>
              index === self.findIndex((m) => m.id === msg.id)
          );
          uniqueMessages.sort(
            (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
          );
          const limitedMessages = uniqueMessages.slice(0, 50);
          callback(limitedMessages);
          callbackScheduled = false;
        }, 100); // Small delay to batch updates
      }
    };

    // Single query for all messages (filter on client)
    const q = query(messagesRef, orderBy("timestamp", "desc"), limit(200));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const snapshotMessages: any[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        // Store raw encrypted message - decryption happens in scheduleCallback
        snapshotMessages.push({
          id: doc.id,
          encryptedMessage: data.encryptedMessage,
          senderAddress: data.senderAddress,
          recipientAddress: data.recipientAddress,
          timestamp: data.timestamp.toDate(),
          status: data.status,
        });
      });

      // Update allMessages with latest snapshot
      allMessages = snapshotMessages;
      scheduleCallback();
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
      console.log(
        "Firebase findMatches: Found",
        querySnapshot.docs.length,
        "total users in database"
      );

      const matches = [];
      for (const docSnap of querySnapshot.docs) {
        if (docSnap.id === userAddress) {
          console.log("Skipping self:", docSnap.id);
          continue; // Skip self
        }

        try {
          const userData = await this.getUserProfile(docSnap.id);
          if (userData && this.matchesCriteria(userData, criteria)) {
            console.log("Adding match:", docSnap.id);
            matches.push({
              address: docSnap.id,
              profile: userData,
              compatibilityScore: this.calculateCompatibility(
                userData,
                criteria
              ),
            });
          } else {
            console.log(
              "User doesn't match criteria or no profile:",
              docSnap.id,
              !!userData
            );
          }
        } catch (error) {
          console.warn("Failed to process user for matching:", docSnap.id);
        }
      }

      // Sort by compatibility score
      console.log("Firebase findMatches: Returning", matches.length, "matches");
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

      await console.log("📦 Batch stored user data and interactions");
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

  // Image Storage Methods

  // Upload encrypted image to Firebase Storage
  static async uploadUserImage(
    walletAddress: string,
    imageUri: string,
    imageIndex: number
  ): Promise<string> {
    if (!this.userKeys) {
      throw new Error("User keys not initialized");
    }

    try {
      // For React Native, we need to handle the image URI differently
      // Convert image URI to blob using fetch
      const response = await fetch(imageUri);
      const blob = await response.blob();

      // Convert blob to base64 first
      const base64Data = await this.blobToBase64(blob);

      // Use the base64 upload method
      return await this.uploadUserImageFromBase64(
        walletAddress,
        base64Data,
        imageIndex
      );
    } catch (error) {
      console.error("Failed to upload image:", error);
      throw error;
    }
  }

  // Helper method to convert blob to base64
  private static async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
          const base64 = reader.result.split(",")[1];
          resolve(base64);
        } else {
          reject(new Error("Failed to convert blob to base64"));
        }
      };
      reader.onerror = () => reject(new Error("Blob reading failed"));
      reader.readAsDataURL(blob);
    });
  }

  // Delete user image from Firebase Storage
  static async deleteUserImage(
    imageUrl: string,
    walletAddress: string
  ): Promise<void> {
    try {
      // Extract the file path from the Firebase Storage URL
      // URL format: https://firebasestorage.googleapis.com/v0/b/bucket/o/path?alt=media
      const urlParts = imageUrl.split("/o/");
      if (urlParts.length < 2) {
        throw new Error("Invalid Firebase Storage URL format");
      }

      const encodedPath = urlParts[1].split("?")[0]; // Remove query parameters
      const filePath = decodeURIComponent(encodedPath);

      console.log("Deleting image at path:", filePath);

      const storageRef = ref(storage, filePath);
      await deleteObject(storageRef);
      console.log(`🗑️ Deleted image for user:`, walletAddress);
    } catch (error) {
      console.error("Failed to delete image:", error);
      throw error;
    }
  }

  // Get all user photo URLs (for profile display)
  static async getUserPhotoUrls(walletAddress: string): Promise<string[]> {
    try {
      const userRef = doc(db, "users", walletAddress);
      const userDoc = await getDoc(userRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        return userData.photoUrls || [];
      }

      return [];
    } catch (error) {
      console.error("Failed to get user photo URLs:", error);
      return [];
    }
  }

  // Update user photo URLs in profile
  static async updateUserPhotoUrls(
    walletAddress: string,
    photoUrls: string[]
  ): Promise<void> {
    try {
      const userRef = doc(db, "users", walletAddress);
      await updateDoc(userRef, {
        photoUrls: photoUrls,
        lastUpdated: Timestamp.now(),
      });
      console.log("📝 Updated photo URLs for user:", walletAddress);
    } catch (error) {
      console.error("Failed to update photo URLs:", error);
      throw error;
    }
  }

  // ===== ARWEAVE HTTP API METHODS (React Native Compatible) =====

  /**
   * Initialize Arweave storage via Irys HTTP API
   */
  static async initializeArweaveStorage(signer?: any): Promise<void> {
    console.log("🔗 Arweave HTTP API initialized via Irys");
    // Using Irys HTTP API for React Native compatibility
  }

  /**
   * Check Arweave balance via Irys HTTP API
   */
  static async checkArweaveBalance(): Promise<{
    hasBalance: boolean;
    balance: string;
    costPerImage: { matic: number; usd: number };
  }> {
    try {
      console.log("💰 Checking Firebase Storage balance...");

      // For Firebase Storage, always have balance (no cost)
      return {
        hasBalance: true,
        balance: "Unlimited",
        costPerImage: {
          matic: 0,
          usd: 0,
        },
      };
    } catch (error) {
      console.error("Failed to check balance:", error);
      return {
        hasBalance: true,
        balance: "Unlimited",
        costPerImage: { matic: 0, usd: 0 },
      };
    }
  }

  /**
   * Fund Arweave storage (integrate with MetaMask for Polygon payments)
   */
  static async fundArweaveStorage(
    amountMatic: number = 0.01,
    signClient?: any,
    sessionTopic?: string,
    address?: string
  ): Promise<number> {
    try {
      console.log(`💸 Funding Arweave storage with ${amountMatic} MATIC...`);

      if (!signClient || !sessionTopic || !address) {
        throw new Error(
          "Wallet connection not available. Please connect your wallet first."
        );
      }

      console.log("Wallet connection validated:", {
        address,
        hasSignClient: !!signClient,
        hasSessionTopic: !!sessionTopic,
      });

      // Check if session is active
      const sessions = signClient.session.getAll();
      const activeSession = sessions.find((s: any) => s.topic === sessionTopic);
      if (!activeSession) {
        throw new Error(
          "WalletConnect session is not active. Please reconnect your wallet."
        );
      }

      console.log("Active session found:", activeSession.peer.metadata.name);

      // Send MATIC payment using WalletConnect to a real service address
      // In production, this would be a service that handles Arweave storage
      const serviceAddress = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"; // Example service address
      const valueInWei = Math.floor(amountMatic * 1e18).toString(16); // Convert to hex wei
      const txPromise = signClient.request({
        topic: sessionTopic,
        chainId: "eip155:137", // Polygon
        request: {
          method: "eth_sendTransaction",
          params: [
            {
              from: address,
              to: serviceAddress,
              value: "0x" + valueInWei,
              gasLimit: "0x5208", // 21000
            },
          ],
        },
      });

      console.log(`💸 Sending ${amountMatic} MATIC to storage service...`);
      console.log("Transaction params:", {
        from: address,
        to: serviceAddress,
        value: "0x" + valueInWei,
        gasLimit: "0x5208",
      });

      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(
          () =>
            reject(
              new Error(
                "Payment timeout - MetaMask didn't respond within 60 seconds"
              )
            ),
          60000
        );
      });

      const txHash = await Promise.race([txPromise, timeoutPromise]);
      console.log("✅ Payment confirmed! Transaction:", txHash);

      // Return the amount paid for reference
      return amountMatic;
    } catch (error) {
      console.error("❌ Failed to fund Arweave storage:", error);
      throw new Error("Funding failed - user may have cancelled transaction");
    }
  }

  /**
   * Upload image to Firebase Storage (publicly viewable)
   */
  static async uploadUserImageFromBase64(
    base64Data: string,
    walletAddress: string,
    imageIndex: number
  ): Promise<string> {
    try {
      console.log("🔄 Starting Firebase Storage upload...");

      // Strip data URL prefix if present
      let cleanBase64 = base64Data;
      if (base64Data.includes(",")) {
        cleanBase64 = base64Data.split(",")[1];
      }

      // Convert base64 to Uint8Array in chunks to avoid memory issues
      const inputBinaryString = atob(cleanBase64);
      const uint8Array = new Uint8Array(inputBinaryString.length);

      console.log("📊 Input data size:", inputBinaryString.length);

      // Process in chunks to avoid blocking the main thread
      const INPUT_CHUNK_SIZE = 8192; // 8KB chunks
      for (let i = 0; i < inputBinaryString.length; i += INPUT_CHUNK_SIZE) {
        const endIndex = Math.min(
          i + INPUT_CHUNK_SIZE,
          inputBinaryString.length
        );
        for (let j = i; j < endIndex; j++) {
          uint8Array[j] = inputBinaryString.charCodeAt(j);
        }
      }

      console.log("� Uploading image to Firebase Storage...");

      // Upload directly without encryption for public viewing
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substr(2, 9);
      const fileName = `users/${walletAddress}/images/${timestamp}_${randomId}.jpg`;
      const downloadUrl = await this.uploadViaXMLHttpRequest(
        uint8Array,
        fileName
      );

      console.log(`✅ Image uploaded to Firebase Storage: ${downloadUrl}`);
      console.log(`📸 Uploaded image ${imageIndex} for user:`, walletAddress);
      return downloadUrl;
    } catch (error) {
      console.error("❌ Failed to upload image to Firebase:", error);
      throw error;
    }
  }

  /**
   * Upload encrypted data directly to Firebase Storage using XMLHttpRequest
   * This bypasses the Firebase SDK's blob creation issues in React Native
   */
  private static async uploadViaXMLHttpRequest(
    data: Uint8Array,
    fileName: string
  ): Promise<string> {
    console.log("🔐 Getting Firebase auth token...");
    // Get Firebase auth token
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
      throw new Error("User not authenticated");
    }

    const token = await getIdToken(user);
    console.log("🔑 Got auth token, length:", token.length);

    // Firebase Storage REST API endpoint - simple media upload
    const bucket = "fuse-ede12.firebasestorage.app";
    const uploadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o?name=${encodeURIComponent(
      fileName
    )}&uploadType=media`;

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.open("POST", uploadUrl, true);
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.setRequestHeader("Content-Type", "application/octet-stream");
      xhr.setRequestHeader("Content-Length", data.length.toString());

      xhr.onload = () => {
        console.log("📡 Upload response received, status:", xhr.status);
        if (xhr.status === 200) {
          try {
            const response = JSON.parse(xhr.responseText);
            console.log("📄 Upload response:", response);
            // For media uploads, use the returned name to construct download URL
            const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(
              response.name
            )}?alt=media`;
            console.log("🔗 Generated download URL:", downloadUrl);
            resolve(downloadUrl);
          } catch (error) {
            console.error("❌ Failed to parse upload response:", error);
            reject(new Error("Failed to parse upload response"));
          }
        } else {
          console.error(
            "❌ Upload failed with status:",
            xhr.status,
            "response:",
            xhr.responseText
          );
          reject(
            new Error(
              `Upload failed with status ${xhr.status}: ${xhr.responseText}`
            )
          );
        }
      };

      xhr.onerror = () => {
        console.error("❌ Network error during upload");
        reject(new Error("Network error during upload"));
      };

      xhr.ontimeout = () => {
        console.error("⏰ Upload timeout");
        reject(new Error("Upload timeout"));
      };

      xhr.timeout = 30000; // 30 second timeout

      // Send the ArrayBuffer directly
      const arrayBuffer = data.buffer.slice(
        data.byteOffset,
        data.byteOffset + data.byteLength
      );
      xhr.send(arrayBuffer as ArrayBuffer);
    });
  }

  // Delete user image from Firebase Storage
  static async downloadUserImage(
    imageUrl: string,
    walletAddress: string
  ): Promise<string> {
    try {
      console.log("📥 Downloading image from Firebase Storage...");

      // Fetch the image from Firebase Storage
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch from Firebase: ${response.status}`);
      }

      // Get as array buffer
      const arrayBuffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // Try to interpret as UTF-8 text (for old JSON format)
      let textData = "";
      let isTextData = true;
      for (let i = 0; i < Math.min(uint8Array.length, 1000); i++) {
        const charCode = uint8Array[i];
        if (
          charCode < 32 &&
          charCode !== 10 &&
          charCode !== 13 &&
          charCode !== 9
        ) {
          // Non-printable character, likely binary data
          isTextData = false;
          break;
        }
        textData += String.fromCharCode(charCode);
      }

      if (isTextData && textData.trim().startsWith("{")) {
        try {
          // Try to parse as JSON (old format)
          const jsonData = JSON.parse(textData);
          if (jsonData.encryptedImage) {
            console.log("📄 Detected old JSON format, extracting base64...");
            return `data:image/jpeg;base64,${jsonData.encryptedImage}`;
          }
        } catch (e) {
          // Not valid JSON, fall through to binary handling
        }
      }

      // Treat as binary data (new format)
      console.log("🔍 Processing as binary image data...");
      let binaryString = "";
      for (let i = 0; i < uint8Array.length; i++) {
        binaryString += String.fromCharCode(uint8Array[i]);
      }
      const base64 = btoa(binaryString);

      console.log("✅ Image downloaded successfully");

      return `data:image/jpeg;base64,${base64}`;
    } catch (error) {
      console.error("❌ Failed to download image:", error);
      throw error;
    }
  }

  // Store fuse request in Firebase
  static async storeFuseRequest(
    targetAddress: string,
    requestData: any
  ): Promise<boolean> {
    console.log(
      "🔥 storeFuseRequest called with targetAddress:",
      targetAddress
    );
    console.log("🔥 requestData:", requestData);
    try {
      const requestsRef = doc(db, "fuse_requests", targetAddress);
      console.log("🔥 requestsRef path:", requestsRef.path);
      const requestSnap = await getDoc(requestsRef);

      let requests = [];
      if (requestSnap.exists()) {
        requests = requestSnap.data().requests || [];
      }

      // Check for mutual request before adding new request
      const requesterAddress = requestData.requesterAddress;

      // Check if the target user has already sent a request to the requester
      const targetRequestsRef = doc(db, "fuse_requests", requesterAddress);
      const targetRequestSnap = await getDoc(targetRequestsRef);
      let targetRequests = [];
      if (targetRequestSnap.exists()) {
        targetRequests = targetRequestSnap.data().requests || [];
      }

      const mutualRequest = targetRequests.find(
        (req: any) =>
          req.requesterAddress === targetAddress &&
          req.targetAddress === requesterAddress
      );

      console.log("🔥 Checking for mutual request:");
      console.log("🔥   Looking in document:", requesterAddress);
      console.log("🔥   targetRequests:", targetRequests);
      console.log(
        "🔥   Looking for req.requesterAddress ===",
        targetAddress,
        "AND req.targetAddress ===",
        requesterAddress
      );
      console.log("🔥   mutualRequest found:", mutualRequest);

      if (mutualRequest) {
        // Mutual match found! Remove both requests since they're now matched
        console.log("🔥 Mutual fuse request detected! Creating match...");

        // Remove the mutual requests
        await this.removeFuseRequest(requesterAddress, targetAddress);
        await this.removeFuseRequest(targetAddress, requesterAddress);

        // Remove sent requests since match is created
        await this.removeSentRequest(requesterAddress, targetAddress);
        await this.removeSentRequest(targetAddress, requesterAddress);

        // Don't add the new request since it's mutual

        console.log(
          "✅ Mutual match detected for:",
          requesterAddress,
          "and",
          targetAddress
        );
        return true; // Indicate mutual match
      }

      // Check for existing request from same user
      const existingRequest = requests.find(
        (req: any) => req.requesterAddress === requesterAddress
      );

      if (existingRequest) {
        // Update existing request instead of adding duplicate
        console.log(
          "🔄 Updating existing fuse request from:",
          requesterAddress
        );
        // Clean the requestData to remove undefined values
        const cleanedRequestData = Object.fromEntries(
          Object.entries(requestData).filter(
            ([_, value]) => value !== undefined
          )
        );
        Object.assign(existingRequest, cleanedRequestData, {
          timestamp: Timestamp.now(),
        });
      } else {
        // Add new request (no mutual match found)
        // Clean the requestData to remove undefined values
        const cleanedRequestData = Object.fromEntries(
          Object.entries(requestData).filter(
            ([_, value]) => value !== undefined
          )
        );
        requests.push({
          ...cleanedRequestData,
          timestamp: Timestamp.now(),
        });
      }

      await setDoc(requestsRef, {
        requests,
        lastUpdated: Timestamp.now(),
      });

      // Store sent request for persistence
      await this.storeSentRequest(requesterAddress, targetAddress);

      console.log("🔥 Fuse request stored in Firebase for:", targetAddress);
      console.log("🔥 Stored requests:", requests);
      return false; // Not mutual
    } catch (error) {
      console.error("Failed to store fuse request:", error);
      throw error;
    }
  }

  // Get fuse requests for a user synchronously
  static async getFuseRequests(userAddress: string): Promise<any[]> {
    console.log("🔥 getFuseRequests called for:", userAddress);
    try {
      const requestsRef = doc(db, "fuse_requests", userAddress);
      console.log("🔥 getFuseRequests ref path:", requestsRef.path);
      const requestSnap = await getDoc(requestsRef);
      console.log("🔥 getFuseRequests doc exists:", requestSnap.exists());

      if (requestSnap.exists()) {
        const data = requestSnap.data();
        console.log("🔥 getFuseRequests data:", data);
        return data.requests || [];
      }
      console.log("🔥 getFuseRequests: no document found");
      return [];
    } catch (error) {
      console.error("Error getting fuse requests:", error);
      return [];
    }
  }

  // Get fuse requests for a user with real-time listener
  static listenToFuseRequests(
    userAddress: string,
    callback: (requests: any[]) => void
  ): () => void {
    console.log("🔥 listenToFuseRequests called for:", userAddress);
    const requestsRef = doc(db, "fuse_requests", userAddress);
    console.log("🔥 listenToFuseRequests ref path:", requestsRef.path);

    const unsubscribe = onSnapshot(
      requestsRef,
      (doc) => {
        console.log(
          "🔥 listenToFuseRequests snapshot received, doc exists:",
          doc.exists()
        );
        if (doc.exists()) {
          const data = doc.data();
          console.log("🔥 listenToFuseRequests data:", data);
          callback(data.requests || []);
        } else {
          console.log("🔥 listenToFuseRequests: no document");
          callback([]);
        }
      },
      (error) => {
        console.error("Error listening to fuse requests:", error);
        callback([]);
      }
    );

    return unsubscribe;
  }

  // Remove fuse request (when accepted or rejected)
  static async removeFuseRequest(
    targetAddress: string,
    requesterAddress: string
  ): Promise<void> {
    try {
      const requestsRef = doc(db, "fuse_requests", targetAddress);
      const requestSnap = await getDoc(requestsRef);

      if (requestSnap.exists()) {
        const data = requestSnap.data();
        const requests = data.requests || [];
        const filteredRequests = requests.filter(
          (req: any) => req.requesterAddress !== requesterAddress
        );

        await setDoc(requestsRef, {
          requests: filteredRequests,
          lastUpdated: Timestamp.now(),
        });
      }

      console.log("🗑️ Fuse request removed for:", targetAddress);
    } catch (error) {
      console.error("Failed to remove fuse request:", error);
      throw error;
    }
  }

  // Store a match in Firebase for a user
  static async storeMatch(userAddress: string, matchData: any): Promise<void> {
    console.log("💕 storeMatch called with userAddress:", userAddress);
    console.log("💕 matchData:", matchData);
    try {
      const matchesRef = doc(db, "user_matches", userAddress);
      console.log("💕 matchesRef path:", matchesRef.path);
      const matchSnap = await getDoc(matchesRef);

      let matches = [];
      if (matchSnap.exists()) {
        matches = matchSnap.data().matches || [];
      }

      // Check if match already exists
      const existingMatch = matches.find(
        (match: any) => match.address === matchData.address
      );

      if (!existingMatch) {
        // Clean the matchData to remove undefined values (Firestore doesn't allow undefined)
        const cleanedMatchData = Object.fromEntries(
          Object.entries(matchData).filter(([_, value]) => value !== undefined)
        );

        matches.push({
          ...cleanedMatchData,
          matchedDate: Timestamp.now(),
        });

        await setDoc(matchesRef, {
          matches,
          lastUpdated: Timestamp.now(),
        });

        console.log(
          "💕 Match stored for:",
          userAddress,
          "with:",
          matchData.address
        );
        console.log("💕 Stored matches:", matches);
      }
    } catch (error) {
      console.error("Failed to store match:", error);
      throw error;
    }
  }

  // Load matches from Firebase for a user
  static async loadMatches(userAddress: string): Promise<any[]> {
    console.log("💕 loadMatches called for:", userAddress);
    try {
      const loadMatchesRef = doc(db, "user_matches", userAddress);
      console.log("💕 loadMatches ref path:", loadMatchesRef.path);
      const matchSnap = await getDoc(loadMatchesRef);
      console.log("💕 loadMatches doc exists:", matchSnap.exists());

      if (matchSnap.exists()) {
        const data = matchSnap.data();
        console.log("💕 loadMatches data:", data);
        return data.matches || [];
      }
      console.log("💕 loadMatches: no document found");
      return [];
    } catch (error) {
      console.error("Failed to load matches:", error);
      return [];
    }
  }

  // Listen to matches for real-time updates
  static listenToMatches(
    userAddress: string,
    callback: (matches: any[]) => void
  ): () => void {
    console.log("💕 listenToMatches called for:", userAddress);
    const listenMatchesRef = doc(db, "user_matches", userAddress);
    console.log("💕 listenToMatches ref path:", listenMatchesRef.path);

    return onSnapshot(listenMatchesRef, (doc) => {
      console.log(
        "💕 listenToMatches snapshot received, doc exists:",
        doc.exists()
      );
      if (doc.exists()) {
        const data = doc.data();
        console.log("💕 listenToMatches data:", data);
        callback(data.matches || []);
      } else {
        console.log("💕 listenToMatches: no document");
        callback([]);
      }
    });
  }

  // Remove a match from Firebase
  static async removeMatch(
    userAddress: string,
    matchAddress: string
  ): Promise<void> {
    try {
      const matchesRef = doc(db, "user_matches", userAddress);
      const matchSnap = await getDoc(matchesRef);

      if (matchSnap.exists()) {
        let matches = matchSnap.data().matches || [];
        matches = matches.filter(
          (match: any) => match.address !== matchAddress
        );

        await setDoc(matchesRef, {
          matches,
          lastUpdated: Timestamp.now(),
        });

        console.log(
          "💔 Match removed for:",
          userAddress,
          "with:",
          matchAddress
        );
      }
    } catch (error) {
      console.error("Failed to remove match:", error);
      throw error;
    }
  }

  // Clear all messages (for testing/reset)
  static async clearAllMessages(): Promise<void> {
    try {
      console.log("🧹 Clearing all messages...");

      const messagesRef = collection(db, "messages");
      const snapshot = await getDocs(messagesRef);

      const batch = writeBatch(db);
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      console.log(`✅ Cleared ${snapshot.docs.length} messages`);
    } catch (error) {
      console.error("Failed to clear messages:", error);
      throw error;
    }
  }

  // Store sent request in Firebase for persistence
  static async storeSentRequest(
    requesterAddress: string,
    targetAddress: string
  ): Promise<void> {
    try {
      const sentRequestsRef = doc(db, "sent_requests", requesterAddress);
      const sentRequestSnap = await getDoc(sentRequestsRef);

      let sentRequests = [];
      if (sentRequestSnap.exists()) {
        sentRequests = sentRequestSnap.data().sentRequests || [];
      }

      // Check if already exists
      const existingRequest = sentRequests.find(
        (addr: string) => addr === targetAddress
      );

      if (!existingRequest) {
        sentRequests.push(targetAddress);
        await setDoc(sentRequestsRef, {
          sentRequests,
          lastUpdated: Timestamp.now(),
        });
        console.log(
          "📤 Sent request stored in Firebase for:",
          requesterAddress,
          "->",
          targetAddress
        );
      }
    } catch (error) {
      console.error("Failed to store sent request:", error);
      throw error;
    }
  }

  // Load sent requests from Firebase
  static async loadSentRequests(
    requesterAddress: string
  ): Promise<Set<string>> {
    try {
      const sentRequestsRef = doc(db, "sent_requests", requesterAddress);
      const sentRequestSnap = await getDoc(sentRequestsRef);

      if (sentRequestSnap.exists()) {
        const sentRequests = sentRequestSnap.data().sentRequests || [];
        console.log(
          "📥 Loaded sent requests from Firebase for:",
          requesterAddress,
          sentRequests
        );
        return new Set(sentRequests);
      }

      console.log(
        "📥 No sent requests found in Firebase for:",
        requesterAddress
      );
      return new Set();
    } catch (error) {
      console.error("Failed to load sent requests:", error);
      return new Set();
    }
  }

  // Remove sent request from Firebase (when match is created)
  static async removeSentRequest(
    requesterAddress: string,
    targetAddress: string
  ): Promise<void> {
    try {
      const sentRequestsRef = doc(db, "sent_requests", requesterAddress);
      const sentRequestSnap = await getDoc(sentRequestsRef);

      if (sentRequestSnap.exists()) {
        const sentRequests = sentRequestSnap.data().sentRequests || [];
        const filteredRequests = sentRequests.filter(
          (addr: string) => addr !== targetAddress
        );

        await setDoc(sentRequestsRef, {
          sentRequests: filteredRequests,
          lastUpdated: Timestamp.now(),
        });
        console.log(
          "🗑️ Sent request removed from Firebase for:",
          requesterAddress,
          "->",
          targetAddress
        );
      }
    } catch (error) {
      console.error("Failed to remove sent request:", error);
      throw error;
    }
  }

  // Clear all fuse data (for testing/reset)
  static async clearAllFuseData(): Promise<void> {
    try {
      console.log("🧹 Clearing all fuse data...");

      // Get all users from users collection
      const usersRef = collection(db, "users");
      const usersSnap = await getDocs(usersRef);
      const userAddresses = usersSnap.docs.map((doc) => doc.id);

      // Clear fuse_requests for each user
      for (const userAddr of userAddresses) {
        const requestsRef = doc(db, "fuse_requests", userAddr);
        await setDoc(requestsRef, {
          requests: [],
          lastUpdated: Timestamp.now(),
        });
      }

      // Clear user_matches for each user
      for (const userAddr of userAddresses) {
        const matchesRef = doc(db, "user_matches", userAddr);
        await setDoc(matchesRef, { matches: [], lastUpdated: Timestamp.now() });
      }

      // Clear sent_requests for each user
      for (const userAddr of userAddresses) {
        const sentRequestsRef = doc(db, "sent_requests", userAddr);
        await setDoc(sentRequestsRef, {
          sentRequests: [],
          lastUpdated: Timestamp.now(),
        });
      }

      console.log("✅ All fuse data cleared");
    } catch (error) {
      console.error("Failed to clear fuse data:", error);
      throw error;
    }
  }
}
