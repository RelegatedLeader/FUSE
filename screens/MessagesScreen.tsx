import React, { useState, useEffect, useRef } from "react";
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
  RefreshControl,
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
  lastMessageId: string | null;
  hasMessages?: boolean;
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
  const scrollViewRef = useRef<ScrollView>(null);
  const [conversationsLoaded, setConversationsLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

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

          await loadMatchedUsers();
          if (matchedUsers.length > 0) {
            await loadConversationsWithMessages();
          }

          // Set up listener for all user messages (for Chats tab)
          const allMessagesListener = MessagingService.listenToAllUserMessages(
            (newMessages) => {
              // Update conversations in real-time
              buildConversationsFromMessages(newMessages);
            }
          );
          setMessageListener(allMessagesListener);
        } catch (error) {
          console.error("Failed to initialize messaging:", error);
        }
      }
    };

    initializeMessaging();
  }, [address]);

  useEffect(() => {
    return () => {
      // Cleanup listeners on unmount
      if (messageListener) {
        messageListener();
      }
    };
  }, [messageListener]);

  // Load last messages for all matched users
  const loadConversationsWithMessages = async () => {
    if (matchedUsers.length === 0 || !address) return;

    setConversationsLoaded(true);

    try {
      const conversationPromises = matchedUsers.map(async (user) => {
        try {
          const messages = await MessagingService.getConversationMessages(
            user.address
          );
          console.log(`📨 Loaded ${messages.length} messages for ${user.name}`);

          // Find the latest message that has content
          const validMessages = messages.filter(
            (msg) =>
              msg.message &&
              typeof msg.message === "string" &&
              msg.message.trim()
          );
          const latestMessage =
            validMessages.length > 0
              ? validMessages[validMessages.length - 1]
              : messages.length > 0
              ? messages[messages.length - 1]
              : null;

          if (latestMessage) {
            console.log(
              `📨 Latest message: "${latestMessage.message}" at ${latestMessage.timestamp}`
            );
            const displayName = `${user.name} (${user.address.slice(
              0,
              6
            )}...${user.address.slice(-4)})`;

            return {
              id: latestMessage.id,
              partnerAddress: user.address,
              partnerName: displayName,
              lastMessage:
                latestMessage.message &&
                typeof latestMessage.message === "string" &&
                latestMessage.message.trim()
                  ? latestMessage.message
                  : "No message content",
              lastMessageTime: latestMessage.timestamp,
              unreadCount: messages.filter(
                (msg) => msg.status !== "read" && msg.senderAddress !== address
              ).length,
              lastMessageId: latestMessage.id,
              hasMessages: true,
            };
          } else {
            // No messages yet
            const displayName = `${user.name} (${user.address.slice(
              0,
              6
            )}...${user.address.slice(-4)})`;
            return {
              id: `conversation_${user.address}`,
              partnerAddress: user.address,
              partnerName: displayName,
              lastMessage: "Start a conversation...",
              lastMessageTime: user.matchedDate,
              unreadCount: 0,
              lastMessageId: null,
              hasMessages: false,
            };
          }
        } catch (error) {
          console.error(`Error loading messages for ${user.address}:`, error);
          // Return placeholder on error
          const displayName = `${user.name} (${user.address.slice(
            0,
            6
          )}...${user.address.slice(-4)})`;
          return {
            id: `conversation_${user.address}`,
            partnerAddress: user.address,
            partnerName: displayName,
            lastMessage: "Start a conversation...",
            lastMessageTime: user.matchedDate,
            unreadCount: 0,
            lastMessageId: null,
            hasMessages: false,
          };
        }
      });

      const conversations = await Promise.all(conversationPromises);
      const sortedConversations = conversations
        .sort(
          (a, b) => b.lastMessageTime.getTime() - a.lastMessageTime.getTime()
        )
        .slice(0, 50);

      setConversations(sortedConversations);
    } catch (error) {
      console.error("Error loading conversations:", error);
    }
  };

  // Load conversations when matched users are available
  // Removed separate useEffect, now handled in initializeMessaging

  const onRefresh = async () => {
    setRefreshing(true);
    await loadConversationsWithMessages();
    setRefreshing(false);
  };

  const buildConversationsFromMessages = (newMessages: any[]) => {
    setConversations((prevConversations) => {
      const updatedConversations = [...prevConversations];

      newMessages.forEach((msg) => {
        const partnerAddress =
          msg.senderAddress === address
            ? msg.recipientAddress
            : msg.senderAddress;

        const conversationIndex = updatedConversations.findIndex(
          (conv) => conv.partnerAddress === partnerAddress
        );

        if (conversationIndex !== -1) {
          const existing = updatedConversations[conversationIndex];

          if (
            !existing.hasMessages ||
            msg.timestamp > existing.lastMessageTime
          ) {
            updatedConversations[conversationIndex] = {
              id: msg.id,
              partnerAddress,
              partnerName: existing.partnerName,
              lastMessage: msg.message,
              lastMessageTime: msg.timestamp,
              unreadCount:
                msg.status !== "read" && msg.senderAddress !== address
                  ? existing.hasMessages
                    ? existing.unreadCount + 1
                    : 1
                  : existing.unreadCount,
              lastMessageId: msg.id,
              hasMessages: true,
            };
          } else if (
            msg.status !== "read" &&
            msg.senderAddress !== address &&
            existing.hasMessages
          ) {
            // Increment unread count for existing conversation
            updatedConversations[conversationIndex].unreadCount += 1;
          }
        }
      });

      return updatedConversations
        .sort(
          (a, b) => b.lastMessageTime.getTime() - a.lastMessageTime.getTime()
        )
        .slice(0, 50);
    });
  };

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

      // Optimistically update the conversation in the list
      setConversations((prevConversations) => {
        const updatedConversations = prevConversations.map((conv) => {
          if (conv.partnerAddress === selectedConversation) {
            return {
              ...conv,
              lastMessage: messageToSend,
              lastMessageTime: new Date(),
              hasMessages: true,
              id: `temp_${Date.now()}`, // Temporary ID
            };
          }
          return conv;
        });
        return updatedConversations.sort(
          (a, b) => b.lastMessageTime.getTime() - a.lastMessageTime.getTime()
        );
      });

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

    // Find the message to check if user can delete it
    const message = messages.find((msg) => msg.id === messageId);
    if (!message || message.from !== address) {
      Alert.alert("Error", "You can only delete your own messages.");
      return;
    }

    Alert.alert(
      "Delete Message",
      "Are you sure you want to permanently delete this message? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Forever",
          style: "destructive",
          onPress: async () => {
            try {
              await MessagingService.deleteMessage(
                selectedConversation,
                messageId
              );
              // Remove the message from local state
              setMessages((prevMessages) =>
                prevMessages.filter((msg) => msg.id !== messageId)
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

  // Scroll to bottom when messages change
  useEffect(() => {
    if (selectedConversation && messages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages, selectedConversation]);

  const formatMessageTime = (timestamp: Date) => {
    const now = new Date();
    const diffInMs = now.getTime() - timestamp.getTime();
    const diffInHours = diffInMs / (1000 * 60 * 60);
    const diffInDays = diffInMs / (1000 * 60 * 60 * 24);

    if (diffInHours < 1) {
      const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
      return diffInMinutes <= 1 ? "now" : `${diffInMinutes}m ago`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else if (diffInDays < 7) {
      return `${Math.floor(diffInDays)}d ago`;
    } else {
      return timestamp.toLocaleDateString();
    }
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
      ? `${matchedUser.name} ${selectedConversation.slice(
          0,
          6
        )}...${selectedConversation.slice(-4)}`
      : `${selectedConversation.slice(0, 6)}...${selectedConversation.slice(
          -4
        )}`;

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

          <ScrollView
            ref={scrollViewRef}
            style={styles.messagesContainer}
            onContentSizeChange={() =>
              scrollViewRef.current?.scrollToEnd({ animated: true })
            }
          >
            {conversationMessages.map((message) => {
              const isFromCurrentUser = message.from === address;
              if (!message.message || !message.message.trim()) return null;
              return (
                <TouchableOpacity
                  key={message.id}
                  onLongPress={() => handleDeleteMessage(message.id)}
                  style={[
                    styles.messageBubble,
                    isFromCurrentUser
                      ? styles.sentMessage
                      : styles.receivedMessage,
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
                    <Text
                      style={[
                        styles.messageText,
                        isFromCurrentUser
                          ? styles.sentMessageText
                          : styles.receivedMessageText,
                      ]}
                    >
                      {message.message}
                    </Text>
                  )}
                  {message.deleted && (
                    <Text
                      style={[
                        styles.messageText,
                        isFromCurrentUser
                          ? styles.sentMessageText
                          : styles.receivedMessageText,
                        { fontStyle: "italic" },
                      ]}
                    >
                      {message.message}
                    </Text>
                  )}
                  <View style={styles.messageFooter}>
                    {message.edited && !message.deleted && (
                      <Text
                        style={[
                          styles.editedLabel,
                          isFromCurrentUser
                            ? styles.sentMessageText
                            : styles.receivedMessageText,
                          { opacity: 0.7 },
                        ]}
                      >
                        edited
                      </Text>
                    )}
                    <Text
                      style={[
                        styles.timestamp,
                        isFromCurrentUser
                          ? styles.sentMessageText
                          : styles.receivedMessageText,
                        { opacity: 0.7 },
                      ]}
                    >
                      {message.timestamp.toLocaleTimeString()}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
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

      <ScrollView
        style={styles.messagesList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {conversations.length === 0 ? (
          <View style={theme.card}>
            <Text
              style={{
                color: theme.textColor,
                textAlign: "center",
                fontSize: 16,
              }}
            >
              💬 No conversations yet.{"\n"}Start fusing to connect with people!
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
                // Also update local state immediately
                setConversations((prevConversations) =>
                  prevConversations.map((conv) =>
                    conv.partnerAddress === conversation.partnerAddress
                      ? { ...conv, unreadCount: 0 }
                      : conv
                  )
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
                {conversation.lastMessage && conversation.lastMessage.trim()
                  ? conversation.lastMessage
                  : "Start a conversation..."}
              </Text>
              <Text
                style={[
                  styles.messageTime,
                  { color: theme.textColor, opacity: 0.6 },
                ]}
              >
                {formatMessageTime(conversation.lastMessageTime)}
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
  sentMessage: {
    backgroundColor: "#007AFF",
    alignSelf: "flex-end",
  },
  receivedMessage: {
    backgroundColor: "#E5E5EA",
    alignSelf: "flex-start",
  },
  messageText: {
    fontSize: 16,
  },
  sentMessageText: {
    color: "white",
  },
  receivedMessageText: {
    color: "#333",
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
