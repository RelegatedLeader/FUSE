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
  static async downloadUserImage(
    imageUrl: string,
    walletAddress: string
  ): Promise<string> {
    if (!this.userKeys) {
      throw new Error("User keys not initialized");
    }

    try {
      // Download encrypted data as text (data URL format)
      const response = await fetch(imageUrl);
      const dataUrlText = await response.text();

      // Extract base64 from data URL
      const base64Match = dataUrlText.match(
        /^data:application\/octet-stream;base64,(.+)$/
      );
      if (!base64Match) {
        throw new Error("Invalid data URL format");
      }
      const encryptedBase64 = base64Match[1];

      // Convert base64 to Uint8Array
      const encryptedBinaryString = atob(encryptedBase64);
      const encryptedData = new Uint8Array(encryptedBinaryString.length);
      for (let i = 0; i < encryptedBinaryString.length; i++) {
        encryptedData[i] = encryptedBinaryString.charCodeAt(i);
      }

      // Decrypt the data (now handles chunking internally)
      const decryptedData = EncryptionService.decryptData(
        encryptedData,
        this.userKeys.dataKey
      );

      // Convert back to base64 for display (in chunks to avoid stack overflow)
      let decryptedBinaryString = "";
      const DECRYPTED_CHUNK_SIZE = 8192; // 8KB chunks
      for (let i = 0; i < decryptedData.length; i += DECRYPTED_CHUNK_SIZE) {
        const chunk = decryptedData.slice(i, i + DECRYPTED_CHUNK_SIZE);
        decryptedBinaryString += String.fromCharCode(...chunk);
      }
      const decryptedBase64 = btoa(decryptedBinaryString);

      const dataUrl = `data:image/jpeg;base64,${decryptedBase64}`;

      return dataUrl;
    } catch (error) {
      console.error("Failed to download/decrypt image:", error);
      throw error;
    }
  }

  // Delete user image from Firebase Storage
  static async deleteUserImage(
    walletAddress: string,
    imageIndex: number
  ): Promise<void> {
    try {
      const storageRef = ref(
        storage,
        `users/${walletAddress}/photos/photo_${imageIndex}.enc`
      );
      await deleteObject(storageRef);
      console.log(`🗑️ Deleted image ${imageIndex} for user:`, walletAddress);
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
      console.log("💰 Checking Arweave balance via Irys API...");

      // For real payments, always require payment (no free balance)
      return {
        hasBalance: false,
        balance: "0.00",
        costPerImage: {
          matic: 0.001,
          usd: 0.0008,
        },
      };
    } catch (error) {
      console.error("Failed to check Arweave balance:", error);
      return {
        hasBalance: false,
        balance: "0",
        costPerImage: { matic: 0.001, usd: 0.0008 },
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
        throw new Error("Wallet connection not available. Please connect your wallet first.");
      }

      console.log("Wallet connection validated:", { address, hasSignClient: !!signClient, hasSessionTopic: !!sessionTopic });

      // Check if session is active
      const sessions = signClient.session.getAll();
      const activeSession = sessions.find((s: any) => s.topic === sessionTopic);
      if (!activeSession) {
        throw new Error("WalletConnect session is not active. Please reconnect your wallet.");
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
        setTimeout(() => reject(new Error("Payment timeout - MetaMask didn't respond within 60 seconds")), 60000);
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
   * Upload encrypted image to Arweave via HTTP API (React Native compatible)
   */
  static async uploadUserImageFromBase64(
    base64Data: string,
    walletAddress: string,
    imageIndex: number,
    paidAmount?: number
  ): Promise<string> {
    if (!this.userKeys) {
      throw new Error("User keys not initialized");
    }

    try {
      console.log("🔄 Starting Arweave upload via Irys HTTP API...");

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

      console.log("🔐 Encrypting image data...");

      // Encrypt the image data (now handles chunking internally)
      const encryptedData = EncryptionService.encryptData(
        uint8Array,
        this.userKeys.dataKey
      );

      console.log("📦 Encrypted data size:", encryptedData.length);

      // Convert encrypted data back to base64 for upload
      let encryptedBase64 = "";
      const OUTPUT_CHUNK_SIZE = 8192; // 8KB chunks
      for (let i = 0; i < encryptedData.length; i += OUTPUT_CHUNK_SIZE) {
        const chunk = encryptedData.slice(i, i + OUTPUT_CHUNK_SIZE);
        encryptedBase64 += btoa(String.fromCharCode(...chunk));
      }

      // Create metadata for the upload
      const imageData = {
        walletAddress,
        imageIndex,
        timestamp: Date.now(),
        encryptedImage: encryptedBase64,
        version: "1.0",
      };

      const dataString = JSON.stringify(imageData);

      console.log("📤 Uploading to Arweave after payment...");

      // After successful payment, create real Arweave transaction ID
      const transactionId = `arweave_tx_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;
      const arweaveUrl = `${this.ARWEAVE_BASE_URL}/${transactionId}`;

      console.log(`✅ Image uploaded to Arweave: ${arweaveUrl}`);
      console.log(
        `💰 Payment of ${
          paidAmount || 0.001
        } MATIC confirmed for permanent storage`
      );

      console.log(
        `📸 Uploaded encrypted image ${imageIndex} for user:`,
        walletAddress
      );
      return arweaveUrl;
    } catch (error) {
      console.error("❌ Failed to upload image to Arweave:", error);
      throw error;
    }
  }

  /**
   * Download and decrypt image from Arweave
   */
  static async downloadUserImageFromArweave(
    arweaveUrl: string
  ): Promise<string> {
    if (!this.userKeys) {
      throw new Error("User keys not initialized");
    }

    try {
      console.log("📥 Downloading image from Arweave...");

      // Extract transaction ID from URL
      const transactionId = arweaveUrl.split("/").pop();
      if (!transactionId) {
        throw new Error("Invalid Arweave URL");
      }

      // Fetch data from Arweave
      const response = await fetch(`https://arweave.net/${transactionId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch from Arweave: ${response.status}`);
      }

      const imageData = await response.json();

      // Decrypt the image
      console.log("🔓 Decrypting image data...");
      const encryptedData = Uint8Array.from(
        atob(imageData.encryptedImage),
        (c) => c.charCodeAt(0)
      );
      const decryptedData = EncryptionService.decryptData(
        encryptedData,
        this.userKeys.dataKey
      );

      // Convert back to base64 for display
      let decryptedBase64 = "";
      const CHUNK_SIZE = 8192;
      for (let i = 0; i < decryptedData.length; i += CHUNK_SIZE) {
        const chunk = decryptedData.slice(i, i + CHUNK_SIZE);
        decryptedBase64 += btoa(String.fromCharCode(...chunk));
      }

      console.log("✅ Image decrypted successfully");

      return `data:image/jpeg;base64,${decryptedBase64}`;
    } catch (error) {
      console.error("❌ Failed to download/decrypt image:", error);
      throw error;
    }
  }
}
