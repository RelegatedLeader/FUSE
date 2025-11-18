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
    // Load matched users from storage
    loadMatchedUsers();
  }, [address]);

  const loadMatchedUsers = async () => {
    if (!address) return;

    try {
      // Load matched users
      const matchesData = await AsyncStorage.getItem(
        `matched_users_${address}`
      );
      if (matchesData) {
        const decrypted = CryptoJS.AES.decrypt(matchesData, address).toString(
          CryptoJS.enc.Utf8
        );
        const parsedMatches = JSON.parse(decrypted);
        // Convert matchedDate strings back to Date objects and deduplicate by address
        const matchesWithDates = parsedMatches.map((match: any) => ({
          ...match,
          matchedDate: new Date(match.matchedDate),
        }));

        const deduplicatedMatches = deduplicateByAddress(matchesWithDates);
        setMatchedUsers(deduplicatedMatches);

        // If we removed duplicates, save the cleaned data back
        if (deduplicatedMatches.length !== matchesWithDates.length) {
          const cleanedEncrypted = CryptoJS.AES.encrypt(
            JSON.stringify(deduplicatedMatches),
            address
          ).toString();
          await AsyncStorage.setItem(
            `matched_users_${address}`,
            cleanedEncrypted
          );
          console.log(
            `Cleaned up ${
              matchesWithDates.length - deduplicatedMatches.length
            } duplicate matches`
          );
        }
      }
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
              <TouchableOpacity
                style={styles.messageButton}
                onPress={() => {
                  // Navigate to MessagesScreen with this user selected
                  // This will be handled by navigation
                  Alert.alert("Message", `Start chatting with ${user.name}!`);
                }}
              >
                <Text style={styles.buttonText}>💬 Message</Text>
              </TouchableOpacity>
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
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});
