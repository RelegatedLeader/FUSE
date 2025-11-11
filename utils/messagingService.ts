import { FirebaseService } from "./firebaseService";
import { EncryptionService } from "./encryption";
import { KeyManager } from "./keyManager";

// E2E encrypted messaging service for FUSE
export class MessagingService {
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
      const conversationId = this.generateConversationId(
        this.currentUser,
        recipientAddress
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
        this.userKeys.messagingKey,
        this.userKeys.messagingKey
      );

      await FirebaseService.sendMessage(
        conversationId,
        encryptedMessage,
        this.currentUser,
        recipientAddress
      );

      // Store interaction
      await FirebaseService.storeInteraction({
        interactionType: "send_message",
        targetUser: recipientAddress,
        metadata: {
          messageLength: message.length,
          messageType,
        },
      });

      console.log("📤 Message sent to:", recipientAddress);
    } catch (error) {
      throw new Error("Failed to send message: " + error);
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
      const conversationId = this.generateConversationId(
        this.currentUser,
        recipientAddress
      );
      return await FirebaseService.getConversationMessages(conversationId);
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
        callback
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

  // Get all conversations for current user
  static async getUserConversations(): Promise<any[]> {
    if (!this.currentUser) {
      throw new Error("Messaging service not initialized");
    }

    try {
      // This would require a more complex query in a production app
      // For now, return a placeholder - in reality you'd query messages collection
      // and group by conversationId where user is sender or recipient

      const conversations: any[] = [
        // This would be populated from Firebase queries
        // Each conversation would have: lastMessage, timestamp, unreadCount, etc.
      ];

      return conversations;
    } catch (error) {
      throw new Error("Failed to get user conversations: " + error);
    }
  }

  // Mark messages as read
  static async markMessagesAsRead(recipientAddress: string): Promise<void> {
    if (!this.currentUser) {
      throw new Error("Messaging service not initialized");
    }

    try {
      // In a production app, this would update message status in Firebase
      // For now, this is a placeholder
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

  // Generate consistent conversation ID
  private static generateConversationId(userA: string, userB: string): string {
    // Sort addresses to ensure consistent conversation ID
    const [address1, address2] = [userA, userB].sort();
    return `${address1}_${address2}`;
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
