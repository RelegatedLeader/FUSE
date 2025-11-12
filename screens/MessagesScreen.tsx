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
} from "react-native";
import { useWallet } from "../contexts/WalletContext";
import { useTheme } from "../contexts/ThemeContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import CryptoJS from "crypto-js";
import { MessagingService } from "../utils/messagingService";

interface Message {
  id: string;
  from: string;
  fromName: string;
  message: string;
  timestamp: Date;
  isRead: boolean;
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
    loadMessages();
  }, [selectedConversation]);

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
      await MessagingService.sendMessage(selectedConversation, newMessage.trim());

      // Add the message to local state immediately for UI feedback
      const newMsg: Message = {
        id: `temp_${Date.now()}`,
        from: address,
        fromName: "You",
        message: newMessage.trim(),
        timestamp: new Date(),
        isRead: true,
      };

      setMessages((prev) => [...prev, newMsg]);
      setNewMessage("");

      // Reload messages to get the real one from Firebase
      setTimeout(() => loadMessages(), 1000);
    } catch (error) {
      console.error("Error sending message:", error);
      Alert.alert("Error", "Failed to send message. Please try again.");
    }
  };

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
            <View
              key={message.id}
              style={[
                styles.messageBubble,
                { backgroundColor: theme.buttonBackground },
              ]}
            >
              <Text style={{ color: theme.buttonText }}>{message.message}</Text>
              <Text
                style={[
                  styles.timestamp,
                  { color: theme.buttonText, opacity: 0.7 },
                ]}
              >
                {message.timestamp.toLocaleTimeString()}
              </Text>
            </View>
          ))}
        </ScrollView>

        <View
          style={[
            styles.inputContainer,
            { backgroundColor: theme.card.backgroundColor },
          ]}
        >
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
