import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";
import { useWallet } from "../contexts/WalletContext";
import { useTheme } from "../contexts/ThemeContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import CryptoJS from "crypto-js";
import { FirebaseService } from "../utils/firebaseService";
import NavigationService from "../utils/navigationService";

interface ConnectionRequest {
  address: string; // The requester's address
  name: string;
  age: number;
  city: string;
  bio: string;
  timestamp: Date;
  requesterAddress?: string; // Optional for backward compatibility
  targetAddress?: string; // Optional for backward compatibility
}

interface MatchedUser {
  address: string;
  name: string;
  age: number | string;
  city: string;
  bio: string;
  photos: string[];
  matchedDate: Date;
}

type MenuOption = "fusers";

export default function FusersScreen() {
  const { address } = useWallet();
  const { theme } = useTheme();
  const [matchedUsers, setMatchedUsers] = useState<MatchedUser[]>([]);

  useEffect(() => {
    // Load matched users from Firebase and listen for updates
    if (address) {
      loadMatchedUsers();
      const unsubscribe = FirebaseService.listenToMatches(
        address,
        (matches) => {
          const matchesWithDates = matches.map((match: any) => ({
            ...match,
            matchedDate: match.matchedDate
              ? match.matchedDate.toDate()
              : new Date(),
          }));
          const deduplicatedMatches = deduplicateByAddress(matchesWithDates);
          setMatchedUsers(deduplicatedMatches);
        }
      );
      return unsubscribe; // Cleanup listener on unmount
    }
  }, [address]);

  const loadMatchedUsers = async () => {
    if (!address) return;

    try {
      const matches = await FirebaseService.loadMatches(address);
      const matchesWithDates = matches.map((match: any) => ({
        ...match,
        matchedDate: match.matchedDate
          ? match.matchedDate.toDate()
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

  const unfuseUser = async (userAddress: string, userName: string) => {
    Alert.alert(
      "Unfuse",
      `Are you sure you want to unfuse with ${userName}? This will remove them from your matches.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unfuse",
          style: "destructive",
          onPress: async () => {
            try {
              // Remove from Firebase
              await FirebaseService.removeMatch(address, userAddress);

              // Local state will update via the listener
              Alert.alert("Unfused", `You have unfused with ${userName}.`);
            } catch (error) {
              console.error("Error unfusing:", error);
              Alert.alert("Error", "Failed to unfuse. Please try again.");
            }
          },
        },
      ]
    );
  };

  return (
    <View
      style={[styles.container, { backgroundColor: theme.backgroundColor }]}
    >
      <Text style={theme.title}>Fusers</Text>
      <Text style={theme.subtitle}>Your matched connections</Text>

      <ScrollView style={styles.requestsContainer}>
        {matchedUsers.length === 0 ? (
          <Text style={styles.emptyText}>
            No matches yet. Start fusing to connect with people!
          </Text>
        ) : (
          matchedUsers.map((user, index) => (
            <View key={user.address} style={styles.matchedUserCard}>
              <View style={styles.matchedUserInfo}>
                <TouchableOpacity
                  onPress={() => viewUserProfile(user.address, user.name)}
                >
                  <Text style={styles.matchedUserName}>
                    {user.name}, {user.age}
                  </Text>
                </TouchableOpacity>
                <Text style={styles.matchedUserLocation}>{user.city}</Text>
                <Text style={styles.matchedUserDate}>
                  Matched {user.matchedDate.toLocaleDateString()}
                </Text>
              </View>
              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={styles.messageButton}
                  onPress={async () => {
                    // Set the selected user for messaging
                    await AsyncStorage.setItem(
                      "selected_chat_user",
                      user.address
                    );
                    // Navigate directly to Chats tab
                    NavigationService.getInstance().navigateToTab("FuseChats");
                  }}
                >
                  <Text style={styles.buttonText}>💬 Message</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.unfuseButton}
                  onPress={() => unfuseUser(user.address, user.name)}
                >
                  <Text style={styles.unfuseButtonText}>Unfuse</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

// Utility function to deduplicate array by address
const deduplicateByAddress = (items: MatchedUser[]): MatchedUser[] => {
  return items.filter(
    (item, index, arr) =>
      arr.findIndex((i) => i.address === item.address) === index
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  requestsContainer: {
    flex: 1,
  },
  emptyText: {
    textAlign: "center",
    color: "#999",
    fontSize: 16,
    marginTop: 20,
  },
  matchedUserCard: {
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    elevation: 3,
  },
  matchedUserInfo: {
    marginBottom: 10,
  },
  matchedUserName: {
    fontSize: 18,
    fontWeight: "bold",
  },
  matchedUserLocation: {
    fontSize: 16,
    color: "#666",
  },
  matchedUserDate: {
    fontSize: 14,
    color: "#333",
  },
  messageButton: {
    backgroundColor: "#007bff",
    borderRadius: 25,
    paddingVertical: 10,
    paddingHorizontal: 15,
    alignItems: "center",
    marginRight: 10,
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  unfuseButton: {
    backgroundColor: "#dc3545",
    borderRadius: 25,
    paddingVertical: 10,
    paddingHorizontal: 15,
    alignItems: "center",
  },
  unfuseButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});
