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

interface FuseRequest {
  address: string;
  name: string;
  age: number;
  city: string;
  bio: string;
  timestamp: Date;
  requesterAddress: string;
  targetAddress: string;
}

export default function MessagesScreen() {
  const { address } = useWallet();
  const { theme } = useTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [matchedUsers, setMatchedUsers] = useState<MatchedUser[]>([]);
  const [fuseRequests, setFuseRequests] = useState<FuseRequest[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<
    string | null
  >(null);
  const [newMessage, setNewMessage] = useState("");
  const [messageListener, setMessageListener] = useState<(() => void) | null>(
    null
  );
  const [requestListener, setRequestListener] = useState<(() => void) | null>(
    null
  );
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
    loadFuseRequests();
  }, [address]);

  useEffect(() => {
    return () => {
      // Cleanup listeners on unmount
      if (messageListener) {
        messageListener();
      }
      if (requestListener) {
        requestListener();
      }
    };
  }, [messageListener, requestListener]);

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
        const parsedMatches = JSON.parse(decrypted);
        // Convert matchedDate strings back to Date objects
        const matchesWithDates = parsedMatches.map((match: any) => ({
          ...match,
          matchedDate: new Date(match.matchedDate),
        }));
        setMatchedUsers(matchesWithDates);
      }
    } catch (error) {
      console.error("Error loading matched users:", error);
    }
  };

  const loadFuseRequests = async () => {
    if (!address) return;

    try {
      console.log(`Loading fuse requests for user: ${address}`);
      
      // Initialize Firebase auth first
      const { initializeFirebaseAuth } = await import("../utils/firebase");
      await initializeFirebaseAuth();

      const { FirebaseService } = await import("../utils/firebaseService");
      await FirebaseService.initializeUser(address);
      
      // Set up real-time listener for fuse requests
      const unsubscribe = FirebaseService.listenToFuseRequests(
        address,
        (requests) => {
          console.log("Received fuse requests:", requests);
          // Convert Firestore timestamps to Date objects
          const requestsWithDates = requests.map((request: any) => ({
            ...request,
            timestamp: request.timestamp?.toDate ? request.timestamp.toDate() : new Date(request.timestamp),
          }));
          setFuseRequests(requestsWithDates);
        }
      );
      
      // Store unsubscribe function for cleanup
      setRequestListener(() => unsubscribe);
    } catch (error) {
      console.error("Error loading fuse requests:", error);
      setFuseRequests([]);
    }
  };

  const acceptFuseRequest = async (requestIndex: number) => {
    if (!address) return;

    const request = fuseRequests[requestIndex];
    if (!request) return;

    try {
      // Initialize Firebase auth first
      const { initializeFirebaseAuth } = await import("../utils/firebase");
      await initializeFirebaseAuth();

      // Remove the request from Firebase
      const { FirebaseService } = await import("../utils/firebaseService");
      await FirebaseService.initializeUser(address);
      await FirebaseService.removeFuseRequest(address, request.requesterAddress);

      // Create mutual match for current user
      const currentUserMatch = {
        address: request.requesterAddress,
        name: request.name,
        age: request.age,
        city: request.city,
        bio: request.bio,
        photos: [], // Will be loaded when needed
        matchedDate: new Date(),
      };

      // Load existing matches for current user
      const existingMatchesData = await AsyncStorage.getItem(
        `matched_users_${address}`
      );
      let existingMatches = [];
      if (existingMatchesData) {
        const decrypted = CryptoJS.AES.decrypt(
          existingMatchesData,
          address
        ).toString(CryptoJS.enc.Utf8);
        existingMatches = JSON.parse(decrypted);
      }

      // Add new match
      existingMatches.push(currentUserMatch);

      // Save back to storage
      const encrypted = CryptoJS.AES.encrypt(
        JSON.stringify(existingMatches),
        address
      ).toString();
      await AsyncStorage.setItem(`matched_users_${address}`, encrypted);

      // Create mutual match for the requester (with real user data)
      // Load current user's profile data
      const currentUserProfileData = await AsyncStorage.getItem(
        `user_profile_${address}`
      );
      let currentUserName = "Unknown User";
      let currentUserAge: number | string = "N/A";
      let currentUserCity = "Unknown";
      let currentUserBio = "No bio available";

      if (currentUserProfileData) {
        const profileDecrypted = CryptoJS.AES.decrypt(
          currentUserProfileData,
          address
        ).toString(CryptoJS.enc.Utf8);
        const profile = JSON.parse(profileDecrypted);
        currentUserName =
          profile.firstName && profile.lastName
            ? `${profile.firstName} ${profile.lastName}`
            : profile.firstName || profile.lastName || "Unknown User";
        currentUserAge = profile.birthdate
          ? new Date().getFullYear() -
            new Date(profile.birthdate).getFullYear()
          : "N/A";
        currentUserCity = profile.location || "Unknown";
        currentUserBio = profile.bio || "No bio available";
      }

      const requesterMatch = {
        address: address,
        name: currentUserName,
        age: currentUserAge,
        city: currentUserCity,
        bio: currentUserBio,
        photos: [], // Will be loaded when needed
        matchedDate: new Date(),
      };

      const requesterMatchesData = await AsyncStorage.getItem(
        `matched_users_${request.requesterAddress}`
      );
      let requesterMatches = [];
      if (requesterMatchesData) {
        const decrypted = CryptoJS.AES.decrypt(
          requesterMatchesData,
          request.requesterAddress
        ).toString(CryptoJS.enc.Utf8);
        requesterMatches = JSON.parse(decrypted);
      }

      requesterMatches.push(requesterMatch);

      const requesterEncrypted = CryptoJS.AES.encrypt(
        JSON.stringify(requesterMatches),
        request.requesterAddress
      ).toString();
      await AsyncStorage.setItem(
        `matched_users_${request.requesterAddress}`,
        requesterEncrypted
      );

      // Update state - the listener will handle removing from fuseRequests
      loadMatchedUsers(); // Refresh matches

      Alert.alert(
        "Fuse Accepted! 🎉",
        "You are now connected! Start a conversation to get to know each other."
      );
    } catch (error) {
      console.error("Error accepting fuse request:", error);
      Alert.alert("Error", "Failed to accept fuse request. Please try again.");
    }
  };

  const rejectFuseRequest = async (requestIndex: number) => {
    if (!address) return;

    const request = fuseRequests[requestIndex];
    if (!request) return;

    try {
      // Initialize Firebase auth first
      const { initializeFirebaseAuth } = await import("../utils/firebase");
      await initializeFirebaseAuth();

      // Remove the request from Firebase
      const { FirebaseService } = await import("../utils/firebaseService");
      await FirebaseService.initializeUser(address);
      await FirebaseService.removeFuseRequest(address, request.requesterAddress);

      // The listener will automatically update the state
      Alert.alert("Request Rejected", "The fuse request has been declined.");
    } catch (error) {
      console.error("Error rejecting fuse request:", error);
      Alert.alert("Error", "Failed to reject fuse request. Please try again.");
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
      "Are you sure you want to unfuse with this user? This will remove them from your matches and end the conversation.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unfuse",
          style: "destructive",
          onPress: async () => {
            try {
              // Remove from current user's matches
              const updatedMatches = matchedUsers.filter(
                (user) => user.address !== userAddress
              );
              const encrypted = CryptoJS.AES.encrypt(
                JSON.stringify(updatedMatches),
                address
              ).toString();
              await AsyncStorage.setItem(`matched_users_${address}`, encrypted);

              // Remove from other user's matches
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
                "You are no longer connected with this user."
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
          const isTypingNow = await MessagingService.getUserOnlineStatus(
            selectedConversation
          );
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
                <Text style={{ color: theme.buttonText, fontStyle: "italic" }}>
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

          {recipientTyping && (
            <View
              style={[
                styles.typingIndicator,
                { backgroundColor: theme.card.backgroundColor },
              ]}
            >
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

      {/* Fuse Requests Section */}
      {fuseRequests.length > 0 && (
        <View style={styles.fuseRequestsContainer}>
          <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
            Fuse Requests 🔥
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.fuseRequestsScroll}
          >
            {fuseRequests.map((request, index) => (
              <View
                key={index}
                style={[
                  styles.fuseRequestCard,
                  { backgroundColor: theme.card.backgroundColor },
                ]}
              >
                <View style={styles.requestInfo}>
                  <TouchableOpacity
                    onPress={() => viewUserProfile(request.requesterAddress, request.name)}
                  >
                    <Text
                      style={[styles.requestName, { color: theme.textColor }]}
                      numberOfLines={1}
                    >
                      {request.name}
                    </Text>
                  </TouchableOpacity>
                  <Text
                    style={[styles.requestDetails, { color: theme.textColor }]}
                  >
                    {request.age} • {request.city}
                  </Text>
                  <Text
                    style={[
                      styles.requestTime,
                      { color: theme.textColor, opacity: 0.6 },
                    ]}
                  >
                    {request.timestamp.toLocaleDateString()}
                  </Text>
                </View>
                <View style={styles.requestActions}>
                  <TouchableOpacity
                    onPress={() => acceptFuseRequest(index)}
                    style={[
                      styles.acceptButton,
                      { backgroundColor: "#28a745" },
                    ]}
                  >
                    <Text style={{ color: "#fff", fontSize: 12 }}>
                      ✓ Accept
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => rejectFuseRequest(index)}
                    style={[
                      styles.rejectButton,
                      { backgroundColor: "#dc3545" },
                    ]}
                  >
                    <Text style={{ color: "#fff", fontSize: 12 }}>
                      ✕ Reject
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

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
              <View
                key={user.address}
                style={[
                  styles.matchedUserCard,
                  { backgroundColor: theme.card.backgroundColor },
                ]}
              >
                <TouchableOpacity
                  style={styles.matchedUserContent}
                  onPress={() => {
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
                <TouchableOpacity
                  onPress={() => unfuseUser(user.address)}
                  style={[styles.unfuseButton, { backgroundColor: "#dc3545" }]}
                >
                  <Text style={{ color: "#fff", fontSize: 10 }}>Unfuse</Text>
                </TouchableOpacity>
              </View>
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
  fuseRequestsContainer: {
    marginBottom: 20,
  },
  fuseRequestsScroll: {
    marginBottom: 10,
  },
  fuseRequestCard: {
    width: 200,
    padding: 15,
    borderRadius: 10,
    marginRight: 15,
  },
  requestInfo: {
    marginBottom: 10,
  },
  requestName: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 5,
  },
  requestDetails: {
    fontSize: 14,
    marginBottom: 5,
  },
  requestTime: {
    fontSize: 12,
  },
  requestActions: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  acceptButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 5,
    alignItems: "center",
    marginRight: 5,
  },
  rejectButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 5,
    alignItems: "center",
    marginLeft: 5,
  },
});
