import { FirebaseService } from "./firebaseService";
import { EncryptionService } from "./encryption";
import { KeyManager } from "./keyManager";
import AsyncStorage from "@react-native-async-storage/async-storage";
import CryptoJS from "crypto-js";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  QuerySnapshot,
} from "firebase/firestore";
import { db } from "./firebase";

// E2E encrypted messaging service for FUSE
export class MessagingService {
  // Shared messaging key for demo purposes (in production, use proper E2E encryption)
  private static readonly SHARED_MESSAGING_KEY =
    "fuse_shared_messaging_key_2024";

  private static userKeys: {
    masterKey: string;
    dataKey: string;
    messagingKey: string;
  } | null = null;
  private static currentUser: string | null = null;
  private static messageListeners: Map<string, () => void> = new Map();

  // Initialize messaging for user
  static async initialize(userAddress: string): Promise<void> {
    try {
      this.currentUser = userAddress;
      this.userKeys = await KeyManager.getUserKeys(userAddress);

      if (!this.userKeys) {
        this.userKeys = await KeyManager.generateUserKeys(userAddress);
      }

      await FirebaseService.initializeUser(userAddress);
      console.log("💬 Messaging service initialized for:", userAddress);
    } catch (error) {
      throw new Error("Failed to initialize messaging: " + error);
    }
  }

  // Generate consistent conversation ID for two users
  private static generateConversationId(user1: string, user2: string): string {
    return [user1, user2].sort().join("_");
  }

  // Get or create conversation key for E2E encryption
  private static async getConversationKey(
    recipientAddress: string
  ): Promise<string> {
    if (!this.currentUser) {
      throw new Error("Messaging service not initialized");
    }

    const conversationId = this.generateConversationId(
      this.currentUser,
      recipientAddress
    );

    // Always generate the key deterministically
    const hash = CryptoJS.SHA256(conversationId + this.SHARED_MESSAGING_KEY);
    const conversationKey = CryptoJS.enc.Hex.stringify(hash).substring(0, 64); // 64 hex chars = 32 bytes

    console.log(
      "🔑 Messaging conversation key:",
      conversationKey.substring(0, 16) + "..."
    );

    return conversationKey;
  }

  // Send encrypted message
  static async sendMessage(
    recipientAddress: string,
    message: string,
    messageType: "text" | "image" | "system" = "text"
  ): Promise<void> {
    if (!this.currentUser || !this.userKeys) {
      throw new Error("Messaging service not initialized");
    }

    try {
      // Check if users are currently matched/fused
      const isMatched = await FirebaseService.areUsersMatched(
        this.currentUser,
        recipientAddress
      );

      if (!isMatched) {
        throw new Error(
          "You can only message users you are currently fused with"
        );
      }

      const conversationId = this.generateConversationId(
        this.currentUser,
        recipientAddress
      );

      // Get the conversation-specific key
      const conversationKey = await this.getConversationKey(recipientAddress);

      console.log(
        "🔑 Messaging conversation key:",
        conversationKey.substring(0, 16) + "..."
      );

      const messageData = {
        content: message,
        messageType,
        metadata: {
          timestamp: Date.now(),
          sender: this.currentUser,
        },
      };

      const encryptedMessage = EncryptionService.encryptMessage(
        JSON.stringify(messageData),
        conversationKey
      );

      console.log(
        "🔒 Final encrypted message to send:",
        encryptedMessage.substring(0, 50) + "..."
      );

      await FirebaseService.sendMessage(
        conversationId,
        encryptedMessage,
        this.currentUser,
        recipientAddress
      );

      console.log(
        "📤 Message sent successfully to:",
        recipientAddress,
        "conversation:",
        conversationId
      );
    } catch (error) {
      throw new Error("Failed to send message: " + error);
    }
  }

  // Send media message (image, GIF, file)
  static async sendMediaMessage(
    recipientAddress: string,
    mediaUri: string,
    mediaType: "image" | "gif" | "file",
    caption?: string
  ): Promise<void> {
    if (!this.currentUser || !this.userKeys) {
      throw new Error("Messaging service not initialized");
    }

    try {
      const conversationId = this.generateConversationId(
        this.currentUser,
        recipientAddress
      );

      // Get the conversation-specific key
      const conversationKey = await this.getConversationKey(recipientAddress);

      // Upload media to Firebase Storage first
      const mediaUrl = await FirebaseService.uploadUserImageFromBase64(
        mediaUri,
        this.currentUser,
        Date.now() // Use timestamp as image index for messaging
      );

      const messageData = {
        content: caption || "",
        mediaUrl,
        mediaType,
        metadata: {
          timestamp: Date.now(),
          sender: this.currentUser,
        },
      };

      const encryptedMessage = EncryptionService.encryptMessage(
        JSON.stringify(messageData),
        conversationKey
      );

      await FirebaseService.sendMessage(
        conversationId,
        encryptedMessage,
        this.currentUser,
        recipientAddress
      );

      // Store interaction
      await FirebaseService.storeInteraction({
        interactionType: "send_media",
        targetUser: recipientAddress,
        metadata: {
          mediaType,
          hasCaption: !!caption,
        },
      });

      console.log("📎 Media message sent to:", recipientAddress);
    } catch (error) {
      throw new Error("Failed to send media message: " + error);
    }
  }

  // Edit message
  static async editMessage(
    recipientAddress: string,
    messageId: string,
    newContent: string
  ): Promise<void> {
    if (!this.currentUser || !this.userKeys) {
      throw new Error("Messaging service not initialized");
    }

    try {
      const conversationId = this.generateConversationId(
        this.currentUser,
        recipientAddress
      );

      // Get the conversation-specific key
      const conversationKey = await this.getConversationKey(recipientAddress);

      // Get the original message to preserve metadata
      const messages = await FirebaseService.getConversationMessages(
        this.currentUser,
        recipientAddress
      );
      const originalMessage = messages.find((msg) => msg.id === messageId);

      if (
        !originalMessage ||
        originalMessage.senderAddress !== this.currentUser
      ) {
        throw new Error("Message not found or not owned by user");
      }

      let originalData;
      try {
        originalData = JSON.parse(originalMessage.message);
      } catch {
        originalData = {
          content: originalMessage.message,
          messageType: "text",
        };
      }

      // Update the content and mark as edited
      const updatedData = {
        ...originalData,
        content: newContent,
        edited: true,
        editedAt: Date.now(),
      };

      const encryptedMessage = EncryptionService.encryptMessage(
        JSON.stringify(updatedData),
        conversationKey
      );

      // Note: In a production app, you'd update the existing document
      // For now, we'll create a new message with edited status
      await FirebaseService.sendMessage(
        conversationId,
        encryptedMessage,
        this.currentUser,
        recipientAddress
      );

      console.log("✏️ Message edited:", messageId);
    } catch (error) {
      throw new Error("Failed to edit message: " + error);
    }
  }

  // Delete message permanently
  static async deleteMessage(
    recipientAddress: string,
    messageId: string
  ): Promise<void> {
    if (!this.currentUser) {
      throw new Error("Messaging service not initialized");
    }

    try {
      const conversationId = this.generateConversationId(
        this.currentUser,
        recipientAddress
      );

      // For now, just try to delete the message
      // In a real app, you'd check if the user owns the message
      await FirebaseService.deleteMessage(messageId);

      console.log("🗑️ Message permanently deleted:", messageId);
    } catch (error) {
      throw new Error("Failed to delete message: " + error);
    }
  }

  // Delete entire conversation (mark all messages as deleted)
  static async deleteConversation(recipientAddress: string): Promise<void> {
    if (!this.currentUser || !this.userKeys) {
      throw new Error("Messaging service not initialized");
    }

    try {
      const conversationId = this.generateConversationId(
        this.currentUser,
        recipientAddress
      );

      // Get all messages in the conversation
      const messages = await FirebaseService.getConversationMessages(
        this.currentUser,
        recipientAddress
      );

      // Mark each message as deleted
      for (const message of messages) {
        if (message.senderAddress === this.currentUser) {
          // Only delete messages sent by current user
          await this.deleteMessage(recipientAddress, message.id);
        }
      }

      console.log(
        "🗑️ Conversation deleted between:",
        this.currentUser,
        "and",
        recipientAddress
      );
    } catch (error) {
      throw new Error("Failed to delete conversation: " + error);
    }
  }

  // Analyze conversation for AI insights (optional Arweave storage)
  static async analyzeConversationForAI(
    recipientAddress: string,
    storeOnArweave: boolean = false
  ): Promise<any> {
    if (!this.currentUser || !this.userKeys) {
      throw new Error("Messaging service not initialized");
    }

    try {
      const conversationId = this.generateConversationId(
        this.currentUser,
        recipientAddress
      );

      // Get conversation messages
      const messages = await FirebaseService.getConversationMessages(
        this.currentUser,
        recipientAddress
      );

      if (messages.length === 0) {
        return { insights: "No messages to analyze" };
      }

      // Basic AI analysis (in production, this would use a real AI service)
      const analysis = {
        conversationLength: messages.length,
        averageMessageLength:
          messages.reduce((acc, msg) => {
            const content =
              typeof msg.message === "string"
                ? msg.message
                : JSON.parse(msg.message).content || "";
            return acc + content.length;
          }, 0) / messages.length,
        userMessageCount: messages.filter(
          (msg) => msg.senderAddress === this.currentUser
        ).length,
        recipientMessageCount: messages.filter(
          (msg) => msg.senderAddress === recipientAddress
        ).length,
        hasMedia: messages.some((msg) => {
          try {
            const parsed = JSON.parse(msg.message);
            return parsed.mediaUrl;
          } catch {
            return false;
          }
        }),
        conversationDuration:
          messages.length > 1
            ? messages[messages.length - 1].timestamp - messages[0].timestamp
            : 0,
        sentiment: "neutral", // Would be calculated by AI service
        topics: [], // Would be extracted by AI service
        compatibility: Math.random() * 100, // Mock compatibility score
      };

      // If user opted in for algorithm improvement, store on Arweave
      if (storeOnArweave) {
        try {
          // Store anonymized analysis on Arweave (simplified - would need Arweave integration)
          const anonymizedAnalysis = {
            ...analysis,
            userId: "anonymous", // Remove personal identifiers
            timestamp: Date.now(),
            conversationId: "hashed_" + conversationId.substring(0, 10),
          };

          // TODO: Implement Arweave storage for AI analysis
          console.log(
            "📊 Would store conversation analysis on Arweave:",
            anonymizedAnalysis
          );
        } catch (arweaveError) {
          console.warn("Failed to store analysis on Arweave:", arweaveError);
          // Don't fail the whole analysis if Arweave storage fails
        }
      }

      // Store analysis locally for user's reference
      await FirebaseService.storeInteraction({
        interactionType: "conversation_analysis",
        targetUser: recipientAddress,
        metadata: {
          analysis,
          storedOnArweave: storeOnArweave,
        },
      });

      console.log("🧠 Conversation analyzed for AI insights");
      return analysis;
    } catch (error) {
      throw new Error("Failed to analyze conversation: " + error);
    }
  }

  // Get conversation messages

  static async getConversationMessages(
    recipientAddress: string
  ): Promise<any[]> {
    if (!this.currentUser) {
      throw new Error("Messaging service not initialized");
    }

    try {
      return await FirebaseService.getConversationMessages(
        this.currentUser,
        recipientAddress
      );
    } catch (error) {
      throw new Error("Failed to get conversation messages: " + error);
    }
  }

  // Listen to real-time messages for a conversation
  static listenToConversation(
    recipientAddress: string,
    callback: (messages: any[]) => void
  ): () => void {
    if (!this.currentUser) {
      throw new Error("Messaging service not initialized");
    }

    try {
      const conversationId = this.generateConversationId(
        this.currentUser,
        recipientAddress
      );

      // Remove existing listener if any
      const existingListener = this.messageListeners.get(conversationId);
      if (existingListener) {
        existingListener();
      }

      const unsubscribe = FirebaseService.listenToMessages(
        conversationId,
        (messages) => {
          console.log(
            "💬 Conversation messages received:",
            messages.length,
            "for conversation:",
            conversationId
          );
          callback(messages);
        }
      );
      this.messageListeners.set(conversationId, unsubscribe);

      return unsubscribe;
    } catch (error) {
      throw new Error("Failed to listen to conversation: " + error);
    }
  }

  // Stop listening to a conversation
  static stopListeningToConversation(recipientAddress: string): void {
    if (!this.currentUser) return;

    const conversationId = this.generateConversationId(
      this.currentUser,
      recipientAddress
    );
    const listener = this.messageListeners.get(conversationId);

    if (listener) {
      listener();
      this.messageListeners.delete(conversationId);
    }
  }

  // Listen to all messages for current user (for Chats tab)
  static listenToAllUserMessages(
    callback: (messages: any[]) => void
  ): () => void {
    if (!this.currentUser) {
      throw new Error("Messaging service not initialized");
    }

    try {
      const unsubscribe = FirebaseService.listenToAllUserMessages(
        this.currentUser,
        callback
      );

      return unsubscribe;
    } catch (error) {
      throw new Error("Failed to listen to all user messages: " + error);
    }
  }

  // Get all conversations for current user
  static async getUserConversations(): Promise<any[]> {
    // Return empty array for now - conversations not implemented yet
    return [];
  }

  // Mark messages as read
  static async markMessagesAsRead(recipientAddress: string): Promise<void> {
    if (!this.currentUser) {
      throw new Error("Messaging service not initialized");
    }

    try {
      const conversationId = this.generateConversationId(
        this.currentUser,
        recipientAddress
      );

      // Update all unread messages in this conversation to "read"
      await FirebaseService.markMessagesAsRead(
        conversationId,
        this.currentUser
      );
      console.log("✓ Marked messages as read for:", recipientAddress);
    } catch (error) {
      throw new Error("Failed to mark messages as read: " + error);
    }
  }

  // Send typing indicator
  static async sendTypingIndicator(
    recipientAddress: string,
    isTyping: boolean
  ): Promise<void> {
    if (!this.currentUser) {
      throw new Error("Messaging service not initialized");
    }

    try {
      const sessionId = await FirebaseService.createSession({
        type: "typing_indicator",
        userAddress: this.currentUser,
        targetAddress: recipientAddress,
        isTyping,
        timestamp: Date.now(),
      });

      // Auto-cleanup after 10 seconds
      setTimeout(() => {
        // Session will auto-expire in Firebase
      }, 10000);

      console.log("⌨️ Typing indicator sent to:", recipientAddress);
    } catch (error) {
      throw new Error("Failed to send typing indicator: " + error);
    }
  }

  // Get online status (simplified)
  static async getUserOnlineStatus(userAddress: string): Promise<boolean> {
    try {
      // In production, this would check a presence system
      // For now, return true for all users
      return true;
    } catch (error) {
      return false;
    }
  }

  // Block user
  static async blockUser(userAddress: string): Promise<void> {
    if (!this.currentUser) {
      throw new Error("Messaging service not initialized");
    }

    try {
      await FirebaseService.storeInteraction({
        interactionType: "block",
        targetUser: userAddress,
        metadata: {},
      });

      // Stop listening to their messages
      this.stopListeningToConversation(userAddress);

      console.log("🚫 Blocked user:", userAddress);
    } catch (error) {
      throw new Error("Failed to block user: " + error);
    }
  }

  // Report user/message
  static async reportUser(userAddress: string, reason: string): Promise<void> {
    if (!this.currentUser) {
      throw new Error("Messaging service not initialized");
    }

    try {
      await FirebaseService.storeInteraction({
        interactionType: "report",
        targetUser: userAddress,
        metadata: {
          reason,
          reportedBy: this.currentUser,
        },
      });

      console.log("🚨 Reported user:", userAddress);
    } catch (error) {
      throw new Error("Failed to report user: " + error);
    }
  }

  // Send system message
  static async sendSystemMessage(
    recipientAddress: string,
    systemMessage: string
  ): Promise<void> {
    await this.sendMessage(recipientAddress, systemMessage, "system");
  }

  // Cleanup all listeners
  static cleanup(): void {
    this.messageListeners.forEach((unsubscribe) => {
      unsubscribe();
    });
    this.messageListeners.clear();
    this.currentUser = null;
    this.userKeys = null;
    console.log("🧹 Messaging service cleaned up");
  }

  // Get message statistics
  static async getMessageStats(): Promise<{
    totalMessages: number;
    conversationsCount: number;
    unreadCount: number;
  }> {
    if (!this.currentUser) {
      throw new Error("Messaging service not initialized");
    }

    try {
      // In production, this would query Firebase for actual stats
      return {
        totalMessages: 0,
        conversationsCount: 0,
        unreadCount: 0,
      };
    } catch (error) {
      throw new Error("Failed to get message stats: " + error);
    }
  }

  // Search messages (encrypted search would be complex)
  static async searchMessages(query: string): Promise<any[]> {
    if (!this.currentUser) {
      throw new Error("Messaging service not initialized");
    }

    try {
      // Note: Searching encrypted messages is challenging
      // In production, you might implement searchable encrypted indexes
      // or search in decrypted client-side cache
      console.log("🔍 Searching messages for:", query);
      return [];
    } catch (error) {
      throw new Error("Failed to search messages: " + error);
    }
  }
}

// Message types and interfaces
export interface Message {
  id: string;
  content: string;
  messageType: "text" | "image" | "system";
  senderAddress: string;
  recipientAddress: string;
  timestamp: Date;
  status: "sent" | "delivered" | "read";
  metadata?: any;
}

export interface Conversation {
  id: string;
  participants: string[];
  lastMessage: Message;
  lastActivity: Date;
  unreadCount: number;
  isBlocked: boolean;
}

export interface TypingIndicator {
  userAddress: string;
  isTyping: boolean;
  timestamp: number;
}
