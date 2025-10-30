import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from "react-native";
import { useWallet } from "../contexts/WalletContext";
import { useTheme } from "../contexts/ThemeContext";

interface Message {
  id: string;
  from: string;
  fromName: string;
  message: string;
  timestamp: Date;
  isRead: boolean;
}

export default function MessagesScreen() {
  const { address } = useWallet();
  const { theme } = useTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");

  useEffect(() => {
    // Mock messages
    const mockMessages: Message[] = [
      {
        id: "1",
        from: "0x123",
        fromName: "Alex",
        message: "Hey! I saw we both love indie rock. Want to chat about new albums?",
        timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
        isRead: false,
      },
      {
        id: "2",
        from: "0x456",
        fromName: "Jordan",
        message: "Thanks for fusing! What's your favorite jazz artist?",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
        isRead: true,
      },
      {
        id: "3",
        from: "0x789",
        fromName: "Taylor",
        message: "The live music scene in Austin is amazing! Have you been to any good shows lately?",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
        isRead: true,
      },
    ];
    setMessages(mockMessages);
  }, []);

  const handleSendMessage = () => {
    if (newMessage.trim() && selectedConversation) {
      // TODO: Send message via Arweave/blockchain
      setNewMessage("");
    }
  };

  const markAsRead = (messageId: string) => {
    setMessages(messages.map(msg =>
      msg.id === messageId ? { ...msg, isRead: true } : msg
    ));
  };

  const unreadCount = messages.filter(msg => !msg.isRead).length;

  if (selectedConversation) {
    const conversationMessages = messages.filter(msg => msg.from === selectedConversation);

    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
        <View style={[styles.header, { backgroundColor: theme.card.backgroundColor }]}>
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
            <View key={message.id} style={[styles.messageBubble, { backgroundColor: theme.buttonBackground }]}>
              <Text style={{ color: theme.buttonText }}>{message.message}</Text>
              <Text style={[styles.timestamp, { color: theme.buttonText, opacity: 0.7 }]}>
                {message.timestamp.toLocaleTimeString()}
              </Text>
            </View>
          ))}
        </ScrollView>

        <View style={[styles.inputContainer, { backgroundColor: theme.card.backgroundColor }]}>
          <TextInput
            style={[styles.input, { backgroundColor: theme.input.backgroundColor, color: theme.textColor }]}
            placeholder="Type a message..."
            placeholderTextColor={theme.textColor}
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
          />
          <TouchableOpacity onPress={handleSendMessage} style={[styles.sendButton, { backgroundColor: theme.buttonBackground }]}>
            <Text style={{ color: theme.buttonText }}>📤</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <Text style={theme.title}>Chats</Text>
      <Text style={theme.subtitle}>Connect through conversation</Text>

      <ScrollView style={styles.messagesList}>
        {messages.length === 0 ? (
          <View style={theme.card}>
            <Text style={{ color: theme.textColor, textAlign: 'center', fontSize: 16 }}>
              💬 No messages yet.{'\n'}Start fusing to begin conversations!
            </Text>
          </View>
        ) : (
          messages.map((message) => (
            <TouchableOpacity
              key={message.id}
              style={[styles.messageItem, { backgroundColor: theme.card.backgroundColor }]}
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
              <Text style={[styles.messagePreview, { color: theme.textColor, opacity: 0.8 }]}>
                {message.message.length > 50 ? message.message.substring(0, 50) + "..." : message.message}
              </Text>
              <Text style={[styles.messageTime, { color: theme.textColor, opacity: 0.6 }]}>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    marginBottom: 10,
    borderRadius: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  senderName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#007AFF',
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
    maxWidth: '80%',
    alignSelf: 'flex-start',
  },
  timestamp: {
    fontSize: 10,
    marginTop: 5,
    textAlign: 'right',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
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
    justifyContent: 'center',
    alignItems: 'center',
  },
});