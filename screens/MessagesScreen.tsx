import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  Alert,
  Platform,
} from "react-native";
import { useWallet } from "../contexts/WalletContext";
import { useTheme } from "../contexts/ThemeContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import CryptoJS from "crypto-js";
import { MessagingService } from "../utils/messagingService";
import * as ImagePicker from "expo-image-picker";

interface Message {
  id: string;
  from: string;
  fromName: string;
  message: string;
  timestamp: Date;
  isRead: boolean;
  mediaUrl?: string;
  mediaType?: "image" | "gif" | "file";
  edited?: boolean;
  deleted?: boolean;
}

interface MatchedUser {
  address: string;
  name: string;
  age: number;
  city: string;
  bio: string;
  photos: string[];
  matchedDate: Date;
}

export default function MessagesScreen() {
  const { address } = useWallet();
  const { theme } = useTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [matchedUsers, setMatchedUsers] = useState<MatchedUser[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<
    string | null
  >(null);
  const [newMessage, setNewMessage] = useState("");
  const [messageListener, setMessageListener] = useState<(() => void) | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [recipientTyping, setRecipientTyping] = useState(false);

  useEffect(() => {
    const initializeMessaging = async () => {
      if (address) {
        try {
          await MessagingService.initialize(address);
          console.log("Messaging initialized for:", address);
        } catch (error) {
          console.error("Failed to initialize messaging:", error);
        }
      }
    };

    initializeMessaging();
    loadMatchedUsers();
  }, [address]);

  useEffect(() => {
    return () => {
      // Cleanup listener on unmount
      if (messageListener) {
        messageListener();
      }
    };
  }, [messageListener]);

  const setupRealTimeListener = () => {
    if (!selectedConversation || !address) return;

    // Clean up existing listener
    if (messageListener) {
      messageListener();
    }

    // Set up real-time listener
    const unsubscribe = MessagingService.listenToConversation(
      selectedConversation,
      (newMessages) => {
        setMessages(
          newMessages.map((msg) => {
            let parsedMessage;
            try {
              parsedMessage = JSON.parse(msg.message);
            } catch {
              parsedMessage = { content: msg.message, messageType: "text" };
            }

            return {
              id: msg.id,
              from: msg.senderAddress,
              fromName: msg.senderAddress === address ? "You" : "Them",
              message: parsedMessage.content || "",
              timestamp: msg.timestamp,
              isRead: true,
              mediaUrl: parsedMessage.mediaUrl,
              mediaType: parsedMessage.mediaType,
              edited: parsedMessage.edited,
              deleted: parsedMessage.deleted,
            };
          })
        );
      }
    );

    setMessageListener(() => unsubscribe);
  };

  const loadMatchedUsers = async () => {
    if (!address) return;

    try {
      const matchesData = await AsyncStorage.getItem(
        `matched_users_${address}`
      );
      if (matchesData) {
        const decrypted = CryptoJS.AES.decrypt(matchesData, address).toString(
          CryptoJS.enc.Utf8
        );
        setMatchedUsers(JSON.parse(decrypted));
      }
    } catch (error) {
      console.error("Error loading matched users:", error);
    }
  };

  const loadMessages = async () => {
    if (!address || !selectedConversation) return;

    try {
      const messages = await MessagingService.getConversationMessages(
        selectedConversation
      );
      setMessages(
        messages.map((msg) => ({
          id: msg.id,
          from: msg.senderAddress,
          fromName: msg.senderAddress === address ? "You" : "Them", // TODO: Get real names
          message:
            typeof msg.message === "string"
              ? msg.message
              : JSON.parse(msg.message).content,
          timestamp: msg.timestamp,
          isRead: true, // TODO: Implement read status
        }))
      );
    } catch (error) {
      console.error("Error loading messages:", error);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !address) return;

    try {
      await MessagingService.sendMessage(
        selectedConversation,
        newMessage.trim()
      );

      // Clear input - real-time listener will update the messages
      setNewMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
      Alert.alert("Error", "Failed to send message. Please try again.");
    }
  };

  const handleSendMedia = async () => {
    if (!selectedConversation || !address) return;

    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Please grant access to your photos to send images.");
        return;
      }

      // Pick image
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        const base64Data = `data:image/jpeg;base64,${result.assets[0].base64}`;
        
        await MessagingService.sendMediaMessage(
          selectedConversation,
          base64Data,
          "image",
          newMessage.trim() || undefined
        );

        // Clear input if it was used as caption
        setNewMessage("");
      }
    } catch (error) {
      console.error("Error sending media:", error);
      Alert.alert("Error", "Failed to send image. Please try again.");
    }
  };

  const handleEditMessage = async () => {
    if (!editingMessageId || !selectedConversation || !address) return;

    try {
      await MessagingService.editMessage(
        selectedConversation,
        editingMessageId,
        editingText.trim()
      );

      setEditingMessageId(null);
      setEditingText("");
    } catch (error) {
      console.error("Error editing message:", error);
      Alert.alert("Error", "Failed to edit message. Please try again.");
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!selectedConversation || !address) return;

    Alert.alert(
      "Delete Message",
      "Are you sure you want to delete this message?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await MessagingService.deleteMessage(selectedConversation, messageId);
            } catch (error) {
              console.error("Error deleting message:", error);
              Alert.alert("Error", "Failed to delete message. Please try again.");
            }
          },
        },
      ]
    );
  };

  const startEditingMessage = (message: Message) => {
    if (message.from !== address || message.deleted) return;
    
    setEditingMessageId(message.id);
    setEditingText(message.message);
  };

  const handleTypingStart = () => {
    if (!isTyping && selectedConversation) {
      setIsTyping(true);
      MessagingService.sendTypingIndicator(selectedConversation, true);
      
      // Auto-stop typing after 3 seconds of inactivity
      setTimeout(() => {
        handleTypingStop();
      }, 3000);
    }
  };

  const handleTypingStop = () => {
    if (isTyping && selectedConversation) {
      setIsTyping(false);
      MessagingService.sendTypingIndicator(selectedConversation, false);
    }
  };

  // Listen for typing indicators (simplified - would need real-time listener)
  useEffect(() => {
    if (selectedConversation) {
      // In a real implementation, you'd set up a listener for typing indicators
      // For now, this is a placeholder
      const checkTypingStatus = async () => {
        try {
          const isTypingNow = await MessagingService.getUserOnlineStatus(selectedConversation);
          setRecipientTyping(isTypingNow);
        } catch (error) {
          console.warn("Failed to check typing status:", error);
        }
      };

      checkTypingStatus();
      const interval = setInterval(checkTypingStatus, 2000);
      return () => clearInterval(interval);
    }
  }, [selectedConversation]);

  const markAsRead = (messageId: string) => {
    setMessages(
      messages.map((msg) =>
        msg.id === messageId ? { ...msg, isRead: true } : msg
      )
    );
  };

  const unreadCount = messages.filter((msg) => !msg.isRead).length;

  if (selectedConversation) {
    const conversationMessages = messages.filter(
      (msg) => msg.from === selectedConversation
    );

    return (
      <View
        style={[styles.container, { backgroundColor: theme.backgroundColor }]}
      >
        <View
          style={[
            styles.header,
            { backgroundColor: theme.card.backgroundColor },
          ]}
        >
          <TouchableOpacity onPress={() => setSelectedConversation(null)}>
            <Text style={{ color: theme.textColor, fontSize: 18 }}>← Back</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.textColor }]}>
            {conversationMessages[0]?.fromName || "Chat"}
          </Text>
          <View style={{ width: 50 }} />
        </View>

        <ScrollView style={styles.messagesContainer}>
          {conversationMessages.map((message) => (
            <TouchableOpacity
              key={message.id}
              onLongPress={() => startEditingMessage(message)}
              style={[
                styles.messageBubble,
                { backgroundColor: theme.buttonBackground },
                message.deleted && styles.deletedMessage,
              ]}
            >
              {message.mediaUrl && message.mediaType === "image" && !message.deleted && (
                <Image
                  source={{ uri: message.mediaUrl }}
                  style={styles.messageImage}
                  resizeMode="cover"
                />
              )}
              {message.message && !message.deleted && (
                <Text style={{ color: theme.buttonText }}>{message.message}</Text>
              )}
              {message.deleted && (
                <Text style={{ color: theme.buttonText, fontStyle: "italic" }}>
                  {message.message}
                </Text>
              )}
              <View style={styles.messageFooter}>
                {message.edited && !message.deleted && (
                  <Text style={[styles.editedLabel, { color: theme.buttonText, opacity: 0.7 }]}>
                    edited
                  </Text>
                )}
                <Text
                  style={[
                    styles.timestamp,
                    { color: theme.buttonText, opacity: 0.7 },
                  ]}
                >
                  {message.timestamp.toLocaleTimeString()}
                </Text>
              </View>
              {message.from === address && !message.deleted && (
                <TouchableOpacity
                  onPress={() => handleDeleteMessage(message.id)}
                  style={styles.deleteButton}
                >
                  <Text style={{ color: theme.buttonText, fontSize: 12 }}>🗑️</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          ))}
          
          {recipientTyping && (
            <View style={[styles.typingIndicator, { backgroundColor: theme.card.backgroundColor }]}>
              <Text style={{ color: theme.textColor, fontSize: 14 }}>
                💬 Typing...
              </Text>
            </View>
          )}
        </ScrollView>

        <View
          style={[
            styles.inputContainer,
            { backgroundColor: theme.card.backgroundColor },
          ]}
        >
          {editingMessageId ? (
            <>
              <TouchableOpacity
                onPress={() => {
                  setEditingMessageId(null);
                  setEditingText("");
                }}
                style={[
                  styles.cancelButton,
                  { backgroundColor: "#dc3545" },
                ]}
              >
                <Text style={{ color: "#fff" }}>✕</Text>
              </TouchableOpacity>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.input.backgroundColor,
                    color: theme.textColor,
                  },
                ]}
                placeholder="Edit message..."
                placeholderTextColor={theme.textColor}
                value={editingText}
                onChangeText={setEditingText}
                multiline
                autoFocus
              />
              <TouchableOpacity
                onPress={handleEditMessage}
                style={[
                  styles.sendButton,
                  { backgroundColor: theme.buttonBackground },
                ]}
              >
                <Text style={{ color: theme.buttonText }}>✓</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                onPress={handleSendMedia}
                style={[
                  styles.mediaButton,
                  { backgroundColor: theme.buttonBackground },
                ]}
              >
                <Text style={{ color: theme.buttonText }}>📎</Text>
              </TouchableOpacity>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.input.backgroundColor,
                    color: theme.textColor,
                  },
                ]}
                placeholder="Type a message..."
                placeholderTextColor={theme.textColor}
                value={newMessage}
                onChangeText={(text) => {
                  setNewMessage(text);
                  handleTypingStart();
                }}
                onBlur={handleTypingStop}
                multiline
              />
              <TouchableOpacity
                onPress={handleSendMessage}
                style={[
                  styles.sendButton,
                  { backgroundColor: theme.buttonBackground },
                ]}
              >
                <Text style={{ color: theme.buttonText }}>📤</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  }

  return (
    <View
      style={[styles.container, { backgroundColor: theme.backgroundColor }]}
    >
      <Text style={theme.title}>Chats</Text>
      <Text style={theme.subtitle}>Connect through conversation</Text>

      {/* Matched Users Section */}
      {matchedUsers.length > 0 && (
        <View style={styles.matchedUsersContainer}>
          <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
            Your Matches
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.matchedUsersScroll}
          >
            {matchedUsers.map((user) => (
              <TouchableOpacity
                key={user.address}
                style={[
                  styles.matchedUserCard,
                  { backgroundColor: theme.card.backgroundColor },
                ]}
                onPress={() => {
                  // Navigate to user profile/chat
                  // For now, just set as selected conversation
                  setSelectedConversation(user.address);
                }}
              >
                <Image
                  source={{
                    uri:
                      user.photos && user.photos.length > 0
                        ? user.photos[0]
                        : "https://via.placeholder.com/60x60?text=👤",
                  }}
                  style={styles.matchedUserImage}
                />
                <Text
                  style={[styles.matchedUserName, { color: theme.textColor }]}
                  numberOfLines={1}
                >
                  {user.name}
                </Text>
                <Text
                  style={[styles.matchedUserAge, { color: theme.textColor }]}
                >
                  {user.age}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <ScrollView style={styles.messagesList}>
        {messages.length === 0 ? (
          <View style={theme.card}>
            <Text
              style={{
                color: theme.textColor,
                textAlign: "center",
                fontSize: 16,
              }}
            >
              💬 No messages yet.{"\n"}Start fusing to begin conversations!
            </Text>
          </View>
        ) : (
          messages.map((message) => (
            <TouchableOpacity
              key={message.id}
              style={[
                styles.messageItem,
                { backgroundColor: theme.card.backgroundColor },
              ]}
              onPress={() => {
                setSelectedConversation(message.from);
                markAsRead(message.id);
              }}
            >
              <View style={styles.messageHeader}>
                <Text style={[styles.senderName, { color: theme.textColor }]}>
                  {message.fromName}
                </Text>
                {!message.isRead && <View style={styles.unreadDot} />}
              </View>
              <Text
                style={[styles.messagePreview, { color: theme.textColor }]}
                numberOfLines={2}
              >
                {message.message}
              </Text>
              <Text
                style={[
                  styles.messageTime,
                  { color: theme.textColor, opacity: 0.6 },
                ]}
              >
                {message.timestamp.toLocaleDateString()}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 15,
    marginBottom: 10,
    borderRadius: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  messagesList: {
    flex: 1,
  },
  messageItem: {
    padding: 15,
    marginBottom: 10,
    borderRadius: 10,
  },
  messageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 5,
  },
  senderName: {
    fontSize: 16,
    fontWeight: "bold",
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#007AFF",
  },
  messagePreview: {
    fontSize: 14,
    marginBottom: 5,
  },
  messageTime: {
    fontSize: 12,
  },
  messagesContainer: {
    flex: 1,
    padding: 10,
  },
  messageBubble: {
    padding: 12,
    borderRadius: 15,
    marginBottom: 10,
    maxWidth: "80%",
    alignSelf: "flex-start",
  },
  deletedMessage: {
    opacity: 0.6,
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 10,
    marginBottom: 5,
  },
  messageFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 5,
  },
  editedLabel: {
    fontSize: 10,
    fontStyle: "italic",
  },
  deleteButton: {
    position: "absolute",
    top: 5,
    right: 5,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  typingIndicator: {
    padding: 10,
    borderRadius: 15,
    marginBottom: 10,
    alignSelf: "flex-start",
    opacity: 0.7,
  },
  timestamp: {
    fontSize: 10,
    marginTop: 5,
    textAlign: "right",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 10,
    marginTop: 10,
  },
  mediaButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  cancelButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  input: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginRight: 10,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  matchedUsersContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
    marginLeft: 5,
  },
  matchedUsersScroll: {
    marginBottom: 10,
  },
  matchedUserCard: {
    width: 80,
    alignItems: "center",
    marginRight: 15,
    padding: 10,
    borderRadius: 10,
  },
  matchedUserImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 5,
  },
  matchedUserName: {
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
  },
  matchedUserAge: {
    fontSize: 12,
    color: "#666",
  },
});
