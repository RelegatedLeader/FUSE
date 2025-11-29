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
  KeyboardAvoidingView,
} from "react-native";
import { useWallet } from "../contexts/WalletContext";
import { useTheme } from "../contexts/ThemeContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import CryptoJS from "crypto-js";
import { MessagingService } from "../utils/messagingService";
import { FirebaseService } from "../utils/firebaseService";
import * as ImagePicker from "expo-image-picker";

interface Message {
  id: string;
  from: string;
  to: string;
  fromName: string;
  message: string;
  timestamp: Date;
  isRead: boolean;
  mediaUrl?: string;
  mediaType?: "image" | "gif" | "file";
  edited?: boolean;
  deleted?: boolean;
}

interface Conversation {
  id: string;
  partnerAddress: string;
  partnerName: string;
  lastMessage: string;
  lastMessageTime: Date;
  unreadCount: number;
  lastMessageId: string;
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
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [matchedUsers, setMatchedUsers] = useState<MatchedUser[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<
    string | null
  >(null);
  const [newMessage, setNewMessage] = useState("");
  const [messageListener, setMessageListener] = useState<(() => void) | null>(
    null
  );
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");

  useEffect(() => {
    const initializeMessaging = async () => {
      if (address) {
        try {
          await MessagingService.initialize(address);
          console.log("Messaging initialized for:", address);

          // Check if there's a selected chat user from navigation
          const selectedChatUser = await AsyncStorage.getItem(
            "selected_chat_user"
          );
          if (selectedChatUser) {
            console.log("Found selected chat user:", selectedChatUser);
            await AsyncStorage.removeItem("selected_chat_user"); // Clear it
            setSelectedConversation(selectedChatUser);
          }

          // Set up listener for all user messages (for Chats tab)
          const allMessagesListener = MessagingService.listenToAllUserMessages(
            (newMessages) => {
              // Group messages by conversation partner and get the latest message for each
              const conversationMap = new Map<string, any>();

              newMessages.forEach((msg) => {
                // Determine the partner address (the other person in the conversation)
                const partnerAddress =
                  msg.senderAddress === address
                    ? msg.recipientAddress
                    : msg.senderAddress;
                const existing = conversationMap.get(partnerAddress);

                // Get partner name from matched users
                const matchedUser = matchedUsers.find(
                  (user) => user.address === partnerAddress
                );
                const partnerName = matchedUser
                  ? matchedUser.name
                  : partnerAddress;

                if (!existing || msg.timestamp > existing.timestamp) {
                  conversationMap.set(partnerAddress, {
                    id: msg.id,
                    partnerAddress,
                    partnerName,
                    lastMessage: msg.message,
                    lastMessageTime: msg.timestamp,
                    unreadCount:
                      msg.status !== "read" && msg.senderAddress !== address
                        ? 1
                        : 0,
                    lastMessageId: msg.id,
                  });
                } else if (
                  msg.status !== "read" &&
                  msg.senderAddress !== address
                ) {
                  // Increment unread count for existing conversation (only for received messages)
                  existing.unreadCount += 1;
                }
              });

              const conversationList = Array.from(conversationMap.values())
                .sort(
                  (a, b) =>
                    b.lastMessageTime.getTime() - a.lastMessageTime.getTime()
                )
                .slice(0, 20);

              // Only update conversations state if not in a conversation
              if (!selectedConversation) {
                setConversations(conversationList);
              }
            }
          );
          setMessageListener(allMessagesListener);
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
      // Cleanup listeners on unmount
      if (messageListener) {
        messageListener();
      }
    };
  }, [messageListener]);

  // Update conversation names when matched users change
  useEffect(() => {
    if (conversations.length > 0 && matchedUsers.length > 0) {
      setConversations((prevConversations) =>
        prevConversations.map((conversation) => {
          const matchedUser = matchedUsers.find(
            (user) => user.address === conversation.partnerAddress
          );
          return {
            ...conversation,
            partnerName: matchedUser
              ? matchedUser.name
              : conversation.partnerAddress,
          };
        })
      );
    }
  }, [matchedUsers, conversations.length]);

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
        console.log("📨 Real-time messages received:", newMessages.length);
        const processedMessages = newMessages.map((msg) => {
          // msg.message is already the parsed content from Firebase listener
          return {
            id: msg.id,
            from: msg.senderAddress,
            to: msg.recipientAddress,
            fromName: msg.senderAddress === address ? "You" : "Them",
            message: msg.message,
            timestamp: msg.timestamp,
            isRead: true,
            mediaUrl: msg.rawMessage?.mediaUrl,
            mediaType: msg.rawMessage?.mediaType,
            edited: msg.rawMessage?.edited,
            deleted: msg.rawMessage?.deleted,
          };
        });

        // Replace messages, but keep optimistic messages that haven't been confirmed yet
        setMessages((prevMessages) => {
          const confirmedMessages = processedMessages;
          const optimisticMessages = prevMessages.filter((msg) =>
            msg.id.startsWith("temp_")
          );

          // Remove optimistic messages that are now confirmed
          const filteredOptimistic = optimisticMessages.filter((optMsg) => {
            return !confirmedMessages.some(
              (confMsg) =>
                confMsg.message === optMsg.message &&
                Math.abs(
                  confMsg.timestamp.getTime() - optMsg.timestamp.getTime()
                ) < 5000 // Within 5 seconds
            );
          });

          return [...confirmedMessages, ...filteredOptimistic];
        });
      }
    );

    setMessageListener(() => unsubscribe);
  };

  const loadMatchedUsers = async () => {
    if (!address) return;

    try {
      const matches = await FirebaseService.loadMatches(address);
      // Convert matchedDate timestamps to Date objects
      const matchesWithDates = matches.map((match: any) => ({
        ...match,
        matchedDate: match.matchedDate
          ? new Date(
              match.matchedDate.toDate
                ? match.matchedDate.toDate()
                : match.matchedDate
            )
          : new Date(),
      }));

      const deduplicatedMatches = deduplicateByAddress(matchesWithDates);
      setMatchedUsers(deduplicatedMatches);
    } catch (error) {
      console.error("Error loading matched users:", error);
    }
  };

  const viewUserProfile = (userAddress: string, userName: string) => {
    // For now, just show an alert with user info
    // TODO: Navigate to a profile screen or show modal
    Alert.alert(
      `${userName}'s Profile`,
      `Address: ${userAddress}\n\nProfile viewing will be implemented in the next update.`
    );
  };

  const unfuseUser = async (userAddress: string) => {
    if (!address) return;

    Alert.alert(
      "Unfuse User",
      "Are you sure you want to unfuse with this user? This will permanently delete all messages and prevent future fusions.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unfuse",
          style: "destructive",
          onPress: async () => {
            try {
              // Delete all messages between these users
              await MessagingService.deleteConversation(userAddress);

              // Block the user to prevent future fusions
              await MessagingService.blockUser(userAddress);

              // Remove from current user's matches
              const updatedMatches = matchedUsers.filter(
                (user) => user.address !== userAddress
              );
              const encrypted = CryptoJS.AES.encrypt(
                JSON.stringify(updatedMatches),
                address
              ).toString();
              await AsyncStorage.setItem(`matched_users_${address}`, encrypted);

              // Remove from other user's matches and delete their messages too
              const otherUserMatchesData = await AsyncStorage.getItem(
                `matched_users_${userAddress}`
              );
              if (otherUserMatchesData) {
                const decrypted = CryptoJS.AES.decrypt(
                  otherUserMatchesData,
                  userAddress
                ).toString(CryptoJS.enc.Utf8);
                const otherUserMatches = JSON.parse(decrypted);
                const updatedOtherMatches = otherUserMatches.filter(
                  (match: any) => match.address !== address
                );
                const otherEncrypted = CryptoJS.AES.encrypt(
                  JSON.stringify(updatedOtherMatches),
                  userAddress
                ).toString();
                await AsyncStorage.setItem(
                  `matched_users_${userAddress}`,
                  otherEncrypted
                );
              }

              // Update state
              setMatchedUsers(updatedMatches);

              // If currently chatting with this user, go back to main view
              if (selectedConversation === userAddress) {
                setSelectedConversation(null);
                setMessages([]);
              }

              Alert.alert(
                "Unfused",
                "You are no longer connected with this user. All messages have been deleted and future fusions are blocked."
              );
            } catch (error) {
              console.error("Error unfusing user:", error);
              Alert.alert("Error", "Failed to unfuse user. Please try again.");
            }
          },
        },
      ]
    );
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
          to: msg.recipientAddress,
          fromName: msg.senderAddress === address ? "You" : "Them", // TODO: Get real names
          message: msg.message, // Already parsed by getConversationMessages
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

    const messageToSend = newMessage.trim();

    try {
      // Optimistically add the message to local state immediately
      const optimisticMessage: Message = {
        id: `temp_${Date.now()}`,
        from: address,
        to: selectedConversation,
        fromName: "You",
        message: messageToSend,
        timestamp: new Date(),
        isRead: true,
      };

      setMessages((prevMessages) => [...prevMessages, optimisticMessage]);

      await MessagingService.sendMessage(selectedConversation, messageToSend);

      // Clear input
      setNewMessage("");

      // The real-time listener will update with the actual message from Firebase
      console.log("📤 Message sent optimistically:", messageToSend);
    } catch (error) {
      console.error("Error sending message:", error);
      // Remove the optimistic message on error
      setMessages((prevMessages) =>
        prevMessages.filter((msg) => !msg.id.startsWith("temp_"))
      );
      Alert.alert("Error", "Failed to send message. Please try again.");
    }
  };

  const handleSendMedia = async () => {
    if (!selectedConversation || !address) return;

    try {
      // Request permissions
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission needed",
          "Please grant access to your photos to send images."
        );
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
              await MessagingService.deleteMessage(
                selectedConversation,
                messageId
              );
            } catch (error) {
              console.error("Error deleting message:", error);
              Alert.alert(
                "Error",
                "Failed to delete message. Please try again."
              );
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

  useEffect(() => {
    if (selectedConversation) {
      setupRealTimeListener();
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
    // Filter messages for this conversation (messages between current user and selected conversation partner)
    const conversationMessages = messages.filter(
      (msg) =>
        (msg.from === selectedConversation && msg.to === address) ||
        (msg.from === address && msg.to === selectedConversation)
    );

    // Find the matched user for the selected conversation
    const matchedUser = matchedUsers.find(
      (user) => user.address === selectedConversation
    );
    const displayName = matchedUser
      ? `${matchedUser.name} (${selectedConversation.slice(0, 8)}...${selectedConversation.slice(-6)})`
      : `${selectedConversation.slice(0, 8)}...${selectedConversation.slice(-6)}`;

    return (
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
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
              <Text style={{ color: theme.textColor, fontSize: 18 }}>
                ← Back
              </Text>
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: theme.textColor }]}>
              {displayName}
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
                {message.mediaUrl &&
                  message.mediaType === "image" &&
                  !message.deleted && (
                    <Image
                      source={{ uri: message.mediaUrl }}
                      style={styles.messageImage}
                      resizeMode="cover"
                    />
                  )}
                {message.message && !message.deleted && (
                  <Text style={{ color: theme.buttonText }}>
                    {message.message}
                  </Text>
                )}
                {message.deleted && (
                  <Text
                    style={{ color: theme.buttonText, fontStyle: "italic" }}
                  >
                    {message.message}
                  </Text>
                )}
                <View style={styles.messageFooter}>
                  {message.edited && !message.deleted && (
                    <Text
                      style={[
                        styles.editedLabel,
                        { color: theme.buttonText, opacity: 0.7 },
                      ]}
                    >
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
                    <Text style={{ color: theme.buttonText, fontSize: 12 }}>
                      🗑️
                    </Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            ))}
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
                  style={[styles.cancelButton, { backgroundColor: "#dc3545" }]}
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
                  onChangeText={setNewMessage}
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
      </KeyboardAvoidingView>
    );
  }

  return (
    <View
      style={[styles.container, { backgroundColor: theme.backgroundColor }]}
    >
      <Text style={theme.title}>Chats</Text>
      <Text style={theme.subtitle}>Connect through conversation</Text>

      <ScrollView style={styles.messagesList}>
        {conversations.length === 0 ? (
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
          conversations.map((conversation) => (
            <TouchableOpacity
              key={conversation.id}
              style={[
                styles.messageItem,
                { backgroundColor: theme.card.backgroundColor },
              ]}
              onPress={() => {
                setSelectedConversation(conversation.partnerAddress);
                // Mark messages as read when opening conversation
                MessagingService.markMessagesAsRead(
                  conversation.partnerAddress
                );
              }}
            >
              <View style={styles.messageHeader}>
                <Text style={[styles.senderName, { color: theme.textColor }]}>
                  {conversation.partnerName}
                </Text>
                {conversation.unreadCount > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadBadgeText}>
                      {conversation.unreadCount}
                    </Text>
                  </View>
                )}
              </View>
              <Text
                style={[styles.messagePreview, { color: theme.textColor }]}
                numberOfLines={1}
              >
                {conversation.lastMessage}
              </Text>
              <Text
                style={[
                  styles.messageTime,
                  { color: theme.textColor, opacity: 0.6 },
                ]}
              >
                {conversation.lastMessageTime.toLocaleDateString()}
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
    paddingHorizontal: 15,
  },
  messageItem: {
    padding: 15,
    marginBottom: 10,
    borderRadius: 10,
    elevation: 2,
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
  unreadBadge: {
    backgroundColor: "#007AFF",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  unreadBadgeText: {
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
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
  matchedUserDetails: {
    fontSize: 12,
    textAlign: "center",
  },
  matchedUserContent: {
    alignItems: "center",
    flex: 1,
  },
  unfuseButton: {
    marginTop: 5,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 10,
    alignItems: "center",
  },
  matchedUserActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 8,
  },
  messageButton: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 10,
    alignItems: "center",
    marginRight: 5,
  },
  othersContainer: {
    marginBottom: 20,
    padding: 15,
    borderRadius: 10,
    backgroundColor: "#f8f9fa",
  },
  sectionSubtitle: {
    fontSize: 14,
    marginBottom: 10,
  },
  discoverButton: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  discoverButtonText: {
    fontSize: 16,
    fontWeight: "bold",
  },
});

// Utility function to deduplicate array by address
const deduplicateByAddress = (items: MatchedUser[]): MatchedUser[] => {
  return items.filter(
    (item, index, arr) =>
      arr.findIndex((i) => i.address === item.address) === index
  );
};
