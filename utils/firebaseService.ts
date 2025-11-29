import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  onSnapshot,
  orderBy,
  limit,
  Timestamp,
  writeBatch,
  runTransaction,
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

  // Helper function to clean data for Firestore (remove undefined values)
  private static cleanDataForFirestore(data: any): any {
    if (data === null || data === undefined) {
      return null;
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.cleanDataForFirestore(item));
    }

    if (typeof data === "object") {
      const cleaned: any = {};
      for (const key in data) {
        if (data[key] !== undefined) {
          cleaned[key] = this.cleanDataForFirestore(data[key]);
        }
      }
      return cleaned;
    }

    return data;
  }

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
      const encryptedMessage = EncryptionService.encryptMessage(
        message,
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
        where("conversationId", "==", conversationId)
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

      // Sort messages by timestamp
      messages.sort((a, b) => a.timestamp - b.timestamp);
      return messages;
    } catch (error) {
      throw new Error("Failed to get conversation messages: " + error);
    }
  }

  // Get conversation summary
  static async getConversationSummary(conversationId: string): Promise<any> {
    try {
      const summaryRef = doc(db, "conversation_summaries", conversationId);
      const summarySnap = await getDoc(summaryRef);

      if (summarySnap.exists()) {
        return summarySnap.data();
      }
      return null;
    } catch (error) {
      console.error("Failed to get conversation summary:", error);
      return null;
    }
  }

  // Create conversation summary
  static async createConversationSummary(summary: any): Promise<void> {
    try {
      const summaryRef = doc(db, "conversation_summaries", summary.id);
      await setDoc(summaryRef, {
        ...summary,
        createdAt: Timestamp.now(),
        lastUpdated: Timestamp.now(),
      });

      console.log("📊 Conversation summary created:", summary.id);
    } catch (error) {
      console.error("❌ Failed to create conversation summary:", error);
      throw error;
    }
  }

  // Update conversation summary
  static async updateConversationSummary(
    conversationId: string,
    updates: any
  ): Promise<void> {
    try {
      const summaryRef = doc(db, "conversation_summaries", conversationId);
      await setDoc(summaryRef, updates, { merge: true });
    } catch (error) {
      console.error("Failed to update conversation summary:", error);
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

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const messages: any[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        try {
          const decryptedMessage = EncryptionService.decryptMessage(
            data.encryptedMessage,
            this.userKeys!.messagingKey
          );
          messages.push({
            id: doc.id,
            message: decryptedMessage,
            senderAddress: data.senderAddress,
            recipientAddress: data.recipientAddress,
            timestamp: data.timestamp.toDate(),
            status: data.status,
          });
        } catch (decryptError) {
          console.warn("Failed to decrypt message:", doc.id, decryptError);
        }
      });

      // Sort messages by timestamp on client side
      messages.sort((a, b) => a.timestamp - b.timestamp);
      callback(messages);
    });

    return unsubscribe;
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
    const q = query(
      messagesRef,
      where("recipientAddress", "==", userAddress),
      orderBy("timestamp", "desc"),
      limit(100)
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
          console.warn("Failed to decrypt message:", doc.id);
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

  // Load matches from Firebase for a user
  static async loadMatches(userAddress: string): Promise<any[]> {
    console.log("💕 loadMatches called for:", userAddress);
    try {
      const loadMatchesRef = doc(db, "fused_users", userAddress);
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

  // Store a match for a user
  static async storeMatch(userAddress: string, matchData: any): Promise<void> {
    console.log(
      "💕 storeMatch called for:",
      userAddress,
      "with data:",
      matchData
    );
    try {
      const matchesRef = doc(db, "fused_users", userAddress);
      const currentMatches = await this.loadMatches(userAddress);

      // Clean the match data by removing undefined values
      const cleanMatchData = this.cleanDataForFirestore(matchData);

      // Check if match already exists
      const existingIndex = currentMatches.findIndex(
        (m: any) => m.address === cleanMatchData.address
      );
      if (existingIndex >= 0) {
        // Update existing match
        currentMatches[existingIndex] = cleanMatchData;
      } else {
        // Add new match
        currentMatches.push(cleanMatchData);
      }

      await setDoc(matchesRef, {
        matches: currentMatches.map((match) =>
          this.cleanDataForFirestore(match)
        ),
        lastUpdated: Timestamp.now(),
      });

      console.log("💕 Match stored for user:", userAddress);
    } catch (error) {
      console.error("Failed to store match:", error);
      throw error;
    }
  }

  // Listen to matches for real-time updates
  static listenToMatches(
    userAddress: string,
    callback: (matches: any[]) => void
  ): () => void {
    console.log("💕 listenToMatches called for:", userAddress);
    const matchesRef = doc(db, "fused_users", userAddress);
    console.log("💕 listenToMatches ref path:", matchesRef.path);

    return onSnapshot(matchesRef, (doc) => {
      console.log(
        "💕 listenToMatches snapshot received, doc exists:",
        doc.exists()
      );
      if (doc.exists()) {
        const data = doc.data();
        console.log("💕 listenToMatches data:", data);
        console.log("💕 listenToMatches matches array:", data.matches);
        callback(data.matches || []);
      } else {
        console.log("💕 listenToMatches: no document");
        callback([]);
      }
    });
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
    try {
      // First, store the request
      const requestsRef = doc(db, "fuse_requests", targetAddress);
      const requestSnap = await getDoc(requestsRef);

      let requests = [];
      if (requestSnap.exists()) {
        requests = requestSnap.data().requests || [];
      }

      // Check for existing request from same user
      const existingRequest = requests.find(
        (req: any) => req.requesterAddress === requestData.requesterAddress
      );

      if (existingRequest) {
        // Update existing request instead of adding duplicate
        console.log(
          "🔄 Updating existing fuse request from:",
          requestData.requesterAddress
        );
        Object.assign(
          existingRequest,
          this.cleanDataForFirestore(requestData),
          {
            timestamp: Timestamp.now(),
          }
        );
      } else {
        // Add new request
        requests.push({
          ...this.cleanDataForFirestore(requestData),
          timestamp: Timestamp.now(),
        });
      }

      await setDoc(requestsRef, {
        requests: requests.map((req: any) => this.cleanDataForFirestore(req)),
        lastUpdated: Timestamp.now(),
      });

      console.log("🔥 Fuse request stored in Firebase for:", targetAddress);

      // Check for mutual request: see if target has sent request to requester
      const mutualRequestsRef = doc(
        db,
        "fuse_requests",
        requestData.requesterAddress
      );
      const mutualSnap = await getDoc(mutualRequestsRef);
      let isMutual = false;
      if (mutualSnap.exists()) {
        const mutualRequests = mutualSnap.data().requests || [];
        console.log(
          "🔍 Checking mutual requests in",
          requestData.requesterAddress,
          ":",
          mutualRequests.map((r: any) => r.requesterAddress)
        );
        isMutual = mutualRequests.some(
          (req: any) => req.requesterAddress === targetAddress
        );
        console.log(
          "🔍 Mutual check result:",
          isMutual,
          "looking for requester:",
          targetAddress
        );
      } else {
        console.log(
          "🔍 No mutual requests document found for:",
          requestData.requesterAddress
        );
      }

      if (isMutual) {
        console.log(
          "🎯 MUTUAL FUSE DETECTED between",
          requestData.requesterAddress,
          "and",
          targetAddress
        );
        // Remove the requests since match is created
        await runTransaction(db, async (transaction) => {
          // First, read both documents
          const targetRef = doc(db, "fuse_requests", targetAddress);
          const requesterRef = doc(
            db,
            "fuse_requests",
            requestData.requesterAddress
          );

          const targetSnap = await transaction.get(targetRef);
          const requesterSnap = await transaction.get(requesterRef);

          // Then, write both updates
          if (targetSnap.exists()) {
            const targetRequests = targetSnap.data().requests || [];
            transaction.set(targetRef, {
              requests: targetRequests.filter(
                (req: any) =>
                  req.requesterAddress !== requestData.requesterAddress
              ),
              lastUpdated: Timestamp.now(),
            });
          }

          if (requesterSnap.exists()) {
            const requesterRequests = requesterSnap.data().requests || [];
            transaction.set(requesterRef, {
              requests: requesterRequests.filter(
                (req: any) => req.requesterAddress !== targetAddress
              ),
              lastUpdated: Timestamp.now(),
            });
          }
        });
      }

      return isMutual;
    } catch (error) {
      console.error("Failed to store fuse request:", error);
      throw error;
    }
  }

  // Get fuse requests for a user synchronously
  static async getFuseRequests(userAddress: string): Promise<any[]> {
    try {
      const requestsRef = doc(db, "fuse_requests", userAddress);
      const requestSnap = await getDoc(requestsRef);

      if (requestSnap.exists()) {
        return requestSnap.data().requests || [];
      }
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
    const requestsRef = doc(db, "fuse_requests", userAddress);

    const unsubscribe = onSnapshot(
      requestsRef,
      (doc) => {
        if (doc.exists()) {
          const data = doc.data();
          callback(data.requests || []);
        } else {
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

  // Store a sent request in Firebase
  static async storeSentRequest(
    fromAddress: string,
    toAddress: string,
    requestData: any
  ): Promise<void> {
    try {
      const sentRequestsRef = doc(db, "sent_requests", fromAddress);
      const sentSnap = await getDoc(sentRequestsRef);

      let sentRequests = [];
      if (sentSnap.exists()) {
        sentRequests = sentSnap.data().requests || [];
      }

      // Check if request already exists
      const existingRequest = sentRequests.find(
        (request: any) => request.toAddress === toAddress
      );

      if (!existingRequest) {
        sentRequests.push({
          toAddress,
          ...requestData,
          sentDate: Timestamp.now(),
        });

        await setDoc(sentRequestsRef, {
          requests: sentRequests,
          lastUpdated: Timestamp.now(),
        });
      }
    } catch (error) {
      console.error("Failed to store sent request:", error);
      throw error;
    }
  }

  // Load sent requests from Firebase
  static async loadSentRequests(fromAddress: string): Promise<any[]> {
    try {
      const sentRequestsRef = doc(db, "sent_requests", fromAddress);
      const sentSnap = await getDoc(sentRequestsRef);

      if (sentSnap.exists()) {
        return sentSnap.data().requests || [];
      }
      return [];
    } catch (error) {
      console.error("Failed to load sent requests:", error);
      return [];
    }
  }

  // Remove a sent request from Firebase
  static async removeSentRequest(
    fromAddress: string,
    toAddress: string
  ): Promise<void> {
    try {
      const sentRequestsRef = doc(db, "sent_requests", fromAddress);
      const sentSnap = await getDoc(sentRequestsRef);

      if (sentSnap.exists()) {
        let sentRequests = sentSnap.data().requests || [];
        sentRequests = sentRequests.filter(
          (request: any) => request.toAddress !== toAddress
        );

        await setDoc(sentRequestsRef, {
          requests: sentRequests,
          lastUpdated: Timestamp.now(),
        });
      }
    } catch (error) {
      console.error("Failed to remove sent request:", error);
      throw error;
    }
  }

  // Get user conversations
  static async getUserConversations(userAddress: string): Promise<any[]> {
    try {
      const conversationsRef = collection(db, "conversation_summaries");
      const q = query(
        conversationsRef,
        where("participants", "array-contains", userAddress),
        orderBy("lastMessageTime", "desc")
      );

      const querySnapshot = await getDocs(q);
      const conversations: any[] = [];

      querySnapshot.forEach((doc) => {
        conversations.push({
          id: doc.id,
          ...doc.data(),
        });
      });

      return conversations;
    } catch (error) {
      // If index is not ready, try without ordering
      if (error instanceof Error && error.message.includes("index")) {
        console.warn("Conversation index not ready, loading without ordering");
        try {
          const conversationsRef = collection(db, "conversation_summaries");
          const q = query(
            conversationsRef,
            where("participants", "array-contains", userAddress)
          );

          const querySnapshot = await getDocs(q);
          const conversations: any[] = [];

          querySnapshot.forEach((doc) => {
            conversations.push({
              id: doc.id,
              ...doc.data(),
            });
          });

          return conversations;
        } catch (fallbackError) {
          console.error(
            "Failed to load conversations even without ordering:",
            fallbackError
          );
          return [];
        }
      }
      console.error("Failed to get user conversations:", error);
      return [];
    }
  }

  // Get all users for discovery (public data only)
  static async getAllUsersForDiscovery(
    currentUserAddress: string
  ): Promise<any[]> {
    try {
      const usersRef = collection(db, "users");
      const querySnapshot = await getDocs(usersRef);

      const users: any[] = [];
      for (const docSnap of querySnapshot.docs) {
        // Skip current user
        if (docSnap.id === currentUserAddress) continue;

        try {
          // Get user profile (this will return public data)
          const userData = await this.getUserProfile(docSnap.id);
          if (userData) {
            users.push({
              address: docSnap.id,
              ...userData,
            });
          }
        } catch (error) {
          // Skip users we can't access
          console.warn("Failed to load user for discovery:", docSnap.id);
        }
      }

      return users;
    } catch (error) {
      console.error("Failed to get all users for discovery:", error);
      return [];
    }
  }

  // Check if two users have unfused before
  static async haveUsersUnfused(
    userA: string,
    userB: string
  ): Promise<boolean> {
    try {
      // Create a consistent pair ID by sorting the addresses
      const pairId = userA < userB ? `${userA}_${userB}` : `${userB}_${userA}`;
      const unfusedRef = doc(db, "unfused_pairs", pairId);
      const unfusedSnap = await getDoc(unfusedRef);
      return unfusedSnap.exists();
    } catch (error) {
      console.error("Failed to check if users have unfused:", error);
      return false;
    }
  }

  // Check if two users are currently matched
  static async areUsersMatched(userA: string, userB: string): Promise<boolean> {
    try {
      const matchesA = await this.loadMatches(userA);
      const matchesB = await this.loadMatches(userB);

      const hasMatchA = matchesA.some((match) => match.address === userB);
      const hasMatchB = matchesB.some((match) => match.address === userA);

      return hasMatchA && hasMatchB;
    } catch (error) {
      console.error("Failed to check if users are matched:", error);
      return false;
    }
  }

  static async updateUserBio(
    walletAddress: string,
    bio: string
  ): Promise<void> {
    try {
      if (!this.userKeys) {
        throw new Error("User keys not initialized");
      }

      const userRef = doc(db, "users", walletAddress);
      const encryptedBio = EncryptionService.encrypt(
        bio,
        this.userKeys.dataKey
      );

      await updateDoc(userRef, {
        bio: encryptedBio,
        updatedAt: Timestamp.now(),
      });

      console.log("✅ User bio updated successfully");
    } catch (error) {
      console.error("Failed to update user bio:", error);
      throw error;
    }
  }

  static async removeMatch(
    userAddress: string,
    matchAddress: string
  ): Promise<void> {
    try {
      if (!this.userKeys) {
        throw new Error("User keys not initialized");
      }

      // First, delete all messages between the two users
      console.log(
        "🗑️ Deleting messages between:",
        userAddress,
        "and",
        matchAddress
      );

      const messagesRef = collection(db, "messages");

      // Delete messages where user is sender and match is recipient
      const sentMessagesQuery = query(
        messagesRef,
        where("senderAddress", "==", userAddress),
        where("recipientAddress", "==", matchAddress)
      );

      // Delete messages where match is sender and user is recipient
      const receivedMessagesQuery = query(
        messagesRef,
        where("senderAddress", "==", matchAddress),
        where("recipientAddress", "==", userAddress)
      );

      const [sentSnapshot, receivedSnapshot] = await Promise.all([
        getDocs(sentMessagesQuery),
        getDocs(receivedMessagesQuery),
      ]);

      const deletePromises: Promise<void>[] = [];

      sentSnapshot.forEach((doc) => {
        deletePromises.push(deleteDoc(doc.ref));
      });

      receivedSnapshot.forEach((doc) => {
        deletePromises.push(deleteDoc(doc.ref));
      });

      await Promise.all(deletePromises);
      console.log(`🗑️ Deleted ${deletePromises.length} messages between users`);

      // Then remove the match from user's matches array
      const matchesRef = doc(db, "fused_users", userAddress);
      const currentMatches = await this.loadMatches(userAddress);
      const updatedMatches = currentMatches.filter(
        (match: any) => match.address !== matchAddress
      );

      await setDoc(matchesRef, {
        matches: updatedMatches,
        lastUpdated: Timestamp.now(),
      });

      // Add to unfused pairs to prevent future matching
      const pairId =
        userAddress < matchAddress
          ? `${userAddress}_${matchAddress}`
          : `${matchAddress}_${userAddress}`;
      const unfusedRef = doc(db, "unfused_pairs", pairId);
      await setDoc(unfusedRef, {
        userA: userAddress,
        userB: matchAddress,
        unfusedAt: Timestamp.now(),
      });

      console.log("✅ Match removed and messages deleted successfully");
    } catch (error) {
      console.error("Failed to remove match:", error);
      throw error;
    }
  }

  static getMessagingKey(): string {
    if (!this.userKeys) {
      throw new Error("User keys not initialized");
    }
    return this.userKeys.messagingKey;
  }

  static async storeConversationMessage(messageRecord: any): Promise<void> {
    try {
      if (!this.userKeys) {
        throw new Error("User keys not initialized");
      }

      const conversationId = messageRecord.conversationId;
      const messageRef = doc(
        collection(db, "conversations", conversationId, "messages")
      );

      const encryptedMessage = {
        ...messageRecord,
        content: EncryptionService.encrypt(
          messageRecord.content,
          this.userKeys.messagingKey
        ),
        timestamp: Timestamp.now(),
      };

      await setDoc(messageRef, encryptedMessage);
      console.log("✅ Conversation message stored successfully");
    } catch (error) {
      console.error("Failed to store conversation message:", error);
      throw error;
    }
  }

  static async getAllUserMessages(walletAddress: string): Promise<any[]> {
    try {
      if (!this.userKeys) {
        throw new Error("User keys not initialized");
      }

      // Query messages where recipientAddress matches the user's address
      const messagesQuery = query(
        collection(db, "messages"),
        where("recipientAddress", "==", walletAddress),
        orderBy("timestamp", "desc")
      );

      const querySnapshot = await getDocs(messagesQuery);
      const messages: any[] = [];

      querySnapshot.forEach((doc) => {
        const messageData = doc.data();
        try {
          const decryptedContent = EncryptionService.decryptMessage(
            messageData.content,
            this.userKeys!.messagingKey
          );
          messages.push({
            id: doc.id,
            ...messageData,
            content: decryptedContent,
          });
        } catch (decryptError) {
          console.error("Failed to decrypt message:", decryptError);
        }
      });

      return messages;
    } catch (error) {
      console.error("Failed to get all user messages:", error);
      throw error;
    }
  }
}
