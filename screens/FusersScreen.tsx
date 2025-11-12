import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
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

type MenuOption = "want-to-fuse" | "fusers";

export default function FusersScreen() {
  const { address } = useWallet();
  const { theme } = useTheme();
  const [requests, setRequests] = useState<ConnectionRequest[]>([]);
  const [matchedUsers, setMatchedUsers] = useState<MatchedUser[]>([]);
  const [selectedMenu, setSelectedMenu] = useState<MenuOption>("want-to-fuse");
  const [animatingIndex, setAnimatingIndex] = useState<number | null>(null);
  const [animationType, setAnimationType] = useState<
    "rocket" | "blackhole" | null
  >(null);
  const rocketAnim = useRef(new Animated.Value(0)).current;
  const blackHoleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Load connection requests and matched users from storage
    loadRequestsAndMatches();
  }, [address]);

  const loadRequestsAndMatches = async () => {
    if (!address) return;

    try {
      // Load connection requests
      const requestsData = await AsyncStorage.getItem(
        `fuse_requests_${address}`
      );
      if (requestsData) {
        const decrypted = CryptoJS.AES.decrypt(requestsData, address).toString(
          CryptoJS.enc.Utf8
        );
        setRequests(JSON.parse(decrypted));
      }

      // Load matched users
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
      console.error("Error loading requests and matches:", error);
    }
  };

  const handleFuse = async (index: number) => {
    if (!address) return;

    const request = requests[index];
    setAnimatingIndex(index);
    setAnimationType("rocket");

    // Rocket launch animation
    Animated.sequence([
      Animated.timing(rocketAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(rocketAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start(async () => {
      setAnimatingIndex(null);
      setAnimationType(null);

      try {
        // Load the matched user's profile data
        const profileData = await AsyncStorage.getItem(
          `user_profile_${request.address}`
        );
        let userPhotos = [];
        try {
          const photosData = await AsyncStorage.getItem(
            `photos_${request.address}`
          );
          if (photosData) {
            const photosDecrypted = CryptoJS.AES.decrypt(
              photosData,
              request.address
            ).toString(CryptoJS.enc.Utf8);
            userPhotos = JSON.parse(photosDecrypted);
          }
        } catch (error) {
          console.error("Error loading photos:", error);
        }

        // Create matched user entry for current user
        const newMatch: MatchedUser = {
          address: request.address,
          name: request.name,
          age: request.age,
          city: request.city,
          bio: request.bio,
          photos: userPhotos,
          matchedDate: new Date(),
        };

        // Add to current user's matched users
        const updatedMatches = [...matchedUsers, newMatch];
        setMatchedUsers(updatedMatches);

        // Save to current user's storage
        const encrypted = CryptoJS.AES.encrypt(
          JSON.stringify(updatedMatches),
          address
        ).toString();
        await AsyncStorage.setItem(`matched_users_${address}`, encrypted);

        // Also add current user to the other user's matched users
        const otherUserMatchesData = await AsyncStorage.getItem(
          `matched_users_${request.address}`
        );
        let otherUserMatches = [];
        if (otherUserMatchesData) {
          const decrypted = CryptoJS.AES.decrypt(
            otherUserMatchesData,
            request.address
          ).toString(CryptoJS.enc.Utf8);
          otherUserMatches = JSON.parse(decrypted);
        }

        // Load current user's profile for the other user
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

        // Load current user's photos
        let currentUserPhotos = [];
        try {
          const photosData = await AsyncStorage.getItem(`photos_${address}`);
          if (photosData) {
            const photosDecrypted = CryptoJS.AES.decrypt(
              photosData,
              address
            ).toString(CryptoJS.enc.Utf8);
            currentUserPhotos = JSON.parse(photosDecrypted);
          }
        } catch (error) {
          console.error("Error loading current user photos:", error);
        }

        const currentUserMatch: MatchedUser = {
          address: address,
          name: currentUserName,
          age: currentUserAge,
          city: currentUserCity,
          bio: currentUserBio,
          photos: currentUserPhotos,
          matchedDate: new Date(),
        };

        otherUserMatches.push(currentUserMatch);

        // Save to other user's storage
        const otherEncrypted = CryptoJS.AES.encrypt(
          JSON.stringify(otherUserMatches),
          request.address
        ).toString();
        await AsyncStorage.setItem(
          `matched_users_${request.address}`,
          otherEncrypted
        );
      } catch (error) {
        console.error("Error processing match:", error);
        Alert.alert("Error", "Failed to complete the match. Please try again.");
        return;
      }

      // Remove from requests
      const updatedRequests = requests.filter((_, i) => i !== index);
      setRequests(updatedRequests);

      // Save updated requests
      try {
        const encrypted = CryptoJS.AES.encrypt(
          JSON.stringify(updatedRequests),
          address
        ).toString();
        await AsyncStorage.setItem(`fuse_requests_${address}`, encrypted);
      } catch (error) {
        console.error("Error saving requests:", error);
      }
    });
  };

  const handleReject = async (index: number) => {
    if (!address) return;

    setAnimatingIndex(index);
    setAnimationType("blackhole");

    // Black hole animation
    Animated.sequence([
      Animated.timing(blackHoleAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(blackHoleAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(async () => {
      setAnimatingIndex(null);
      setAnimationType(null);

      // Remove from requests
      const updatedRequests = requests.filter((_, i) => i !== index);
      setRequests(updatedRequests);

      // Save updated requests
      try {
        const encrypted = CryptoJS.AES.encrypt(
          JSON.stringify(updatedRequests),
          address
        ).toString();
        await AsyncStorage.setItem(`fuse_requests_${address}`, encrypted);
      } catch (error) {
        console.error("Error saving requests:", error);
      }
    });
  };

  const rocketTranslateY = rocketAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -200],
  });

  const rocketScale = rocketAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 1.2, 0.8],
  });

  const blackHoleScale = blackHoleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.1],
  });

  const blackHoleOpacity = blackHoleAnim.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [1, 0.5, 0],
  });

  return (
    <View
      style={[styles.container, { backgroundColor: theme.backgroundColor }]}
    >
      <Text style={theme.title}>Fusers</Text>

      {/* Dropdown Menu */}
      <View style={styles.dropdownContainer}>
        <TouchableOpacity
          style={[
            styles.dropdownButton,
            selectedMenu === "want-to-fuse" && styles.dropdownButtonActive,
          ]}
          onPress={() => setSelectedMenu("want-to-fuse")}
        >
          <Text
            style={[
              styles.dropdownText,
              selectedMenu === "want-to-fuse" && styles.dropdownTextActive,
            ]}
          >
            Want to Fuse
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.dropdownButton,
            selectedMenu === "fusers" && styles.dropdownButtonActive,
          ]}
          onPress={() => setSelectedMenu("fusers")}
        >
          <Text
            style={[
              styles.dropdownText,
              selectedMenu === "fusers" && styles.dropdownTextActive,
            ]}
          >
            Fusers
          </Text>
        </TouchableOpacity>
      </View>

      {selectedMenu === "want-to-fuse" ? (
        <View style={{ flex: 1 }}>
          <Text style={theme.subtitle}>
            Connection requests waiting for you
          </Text>
          <ScrollView style={styles.requestsContainer}>
            {requests.length === 0 ? (
              <Text style={styles.emptyText}>
                No connection requests at the moment. Keep swiping!
              </Text>
            ) : (
              requests.map((request, index) => 
                <Animated.View
                  key={request.address}
                  style={[
                    styles.requestCard,
                    animatingIndex === index &&
                      animationType === "rocket" && {
                        transform: [
                          { translateY: rocketTranslateY },
                          { scale: rocketScale },
                        ],
                      },
                    animatingIndex === index &&
                      animationType === "blackhole" && {
                        transform: [{ scale: blackHoleScale }],
                        opacity: blackHoleOpacity,
                      },
                  ]}
                >
                  <View style={styles.requestInfo}>
                    <Text style={styles.requestName}>
                      {request.name}, {request.age}
                    </Text>
                    <Text style={styles.requestLocation}>{request.city}</Text>
                    <Text style={styles.requestBio}>{request.bio}</Text>
                  </View>
                  <View style={styles.requestActions}>
                    <TouchableOpacity
                      style={styles.rejectButton}
                      onPress={() => handleReject(index)}
                    >
                      <Text style={styles.buttonText}>Reject</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.fuseButton}
                      onPress={() => handleFuse(index)}
                    >
                      <Text style={styles.buttonText}>Fuse</Text>
                    </TouchableOpacity>
                  </View>
                </Animated.View>
              )
            )}
          </ScrollView>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <Text style={theme.subtitle}>Your matched connections</Text>
          <ScrollView style={styles.requestsContainer}>
            {matchedUsers.length === 0 ? (
              <Text style={styles.emptyText}>
                No matches yet. Start fusing to connect with people!
              </Text>
            ) : (
              matchedUsers.map((user) => 
                <View key={user.address} style={styles.matchedUserCard}>
                  <View style={styles.matchedUserInfo}>
                    <Text style={styles.matchedUserName}>
                      {user.name}, {user.age}
                    </Text>
                    <Text style={styles.matchedUserLocation}>{user.city}</Text>
                    <Text style={styles.matchedUserDate}>
                      Matched {user.matchedDate.toLocaleDateString()}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.messageButton}
                    onPress={() => {
                      // TODO: Navigate to MessagesScreen with this user selected
                      // For now, users can manually go to Messages tab
                    }}
                  >
                    <Text style={styles.buttonText}>Message</Text>
                  </TouchableOpacity>
                </View>
              )
            )}
          </ScrollView>
        </View>
      )}

      {/* Rocket Animation */}
      {animatingIndex !== null && animationType === "rocket" && (
        <Animated.View
          style={{
            transform: [
              { translateY: rocketTranslateY },
              { scale: rocketScale },
            ],
          }}
        >
          <Text style={styles.rocketText}>🚀</Text>
        </Animated.View>
      )}

      {/* Black Hole Animation */}
      {animatingIndex !== null && animationType === "blackhole" && (
        <Animated.View
          style={{
            transform: [{ scale: blackHoleScale }],
            opacity: blackHoleOpacity,
          }}
        >
          <Text style={styles.blackHoleText}>🕳️</Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  requestsContainer: {
    flex: 1,
  },
  name: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 8,
  },
  bio: {
    fontSize: 16,
    lineHeight: 22,
    marginVertical: 15,
  },
  actionButtons: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 20,
  },
  rejectButton: {
    padding: 15,
    borderRadius: 25,
    minWidth: 100,
    alignItems: "center",
  },
  fuseButton: {
    padding: 15,
    borderRadius: 25,
    minWidth: 100,
    alignItems: "center",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  animationOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    zIndex: 10,
    borderRadius: 15,
  },
  rocket: {
    fontSize: 60,
  },
  blackHole: {
    justifyContent: "center",
    alignItems: "center",
  },
  blackHoleEmoji: {
    fontSize: 60,
  },
  dropdownContainer: {
    flexDirection: "row",
    marginVertical: 15,
    paddingHorizontal: 20,
  },
  dropdownButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginHorizontal: 5,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: "#ddd",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
  },
  dropdownButtonActive: {
    backgroundColor: "#007bff",
    borderColor: "#007bff",
  },
  dropdownText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#666",
  },
  dropdownTextActive: {
    color: "#fff",
  },
  requestCard: {
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    elevation: 3,
  },
  requestInfo: {
    marginBottom: 10,
  },
  requestName: {
    fontSize: 18,
    fontWeight: "bold",
  },
  requestLocation: {
    fontSize: 16,
    color: "#666",
  },
  requestBio: {
    fontSize: 14,
    color: "#333",
  },
  requestActions: {
    flexDirection: "row",
    justifyContent: "space-between",
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
  rocketText: {
    fontSize: 60,
  },
  blackHoleText: {
    fontSize: 60,
  },
});
