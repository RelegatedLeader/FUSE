import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  Image,
  Dimensions,
} from "react-native";
import { useWallet } from "../contexts/WalletContext";
import { useTheme } from "../contexts/ThemeContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import CryptoJS from "crypto-js";
import { FirebaseService } from "../utils/firebaseService";
import { getUserData } from "../utils/contract";
import NavigationService from "../utils/navigationService";
import { Picker } from "@react-native-picker/picker";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");
const isLargeScreen = screenWidth > 768;

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
  mbti?: string;
  gender?: string;
  sexuality?: string;
  personalityTraits?: string[];
}

type MenuOption = "requests" | "matches";

export default function FusersScreen() {
  const { address } = useWallet();
  const { theme } = useTheme();
  const [matchedUsers, setMatchedUsers] = useState<MatchedUser[]>([]);
  const [connectionRequests, setConnectionRequests] = useState<
    ConnectionRequest[]
  >([]);
  const [selectedUser, setSelectedUser] = useState<MatchedUser | null>(null);
  const [selectedRequest, setSelectedRequest] =
    useState<ConnectionRequest | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [selectedMenu, setSelectedMenu] = useState<MenuOption>("matches");
  const scrollViewRef = useRef<ScrollView>(null);

  // Handle swipe down to close modal
  const handleScroll = (event: any) => {
    const { y } = event.nativeEvent.contentOffset;
    if (y < -50) {
      // If scrolled up more than 50px from top
      setShowProfileModal(false);
    }
  };

  useEffect(() => {
    // Load matched users from Firebase and listen for updates
    if (address) {
      loadMatchedUsers();
      const unsubscribeMatches = FirebaseService.listenToMatches(
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

      // Load connection requests and listen for updates
      loadConnectionRequests();
      const unsubscribeRequests = FirebaseService.listenToFuseRequests(
        address,
        (requests) => {
          const requestsWithDates = requests.map((req: any) => ({
            ...req,
            timestamp: req.timestamp ? req.timestamp.toDate() : new Date(),
          }));
          setConnectionRequests(requestsWithDates);
        }
      );

      return () => {
        unsubscribeMatches();
        unsubscribeRequests();
      };
    }
  }, [address]);

  const loadMatchedUsers = async () => {
    if (!address) return;

    try {
      const matches = await FirebaseService.loadMatches(address);
      console.log("🔍 Raw matches from Firebase:", matches);

      // Fetch complete profile data from blockchain for each match
      const matchesWithFullData = await Promise.all(
        matches.map(async (match: any) => {
          console.log(
            "🔍 Processing match:",
            match.address,
            "with data:",
            match
          );
          try {
            console.log("🌐 Fetching blockchain data for:", match.address);
            const blockchainData = await getUserData(match.address);
            console.log(
              "🌐 Blockchain data for",
              match.address,
              ":",
              blockchainData
            );

            // Parse personality traits if it's a string
            let personalityTraits: string[] = [];
            if (blockchainData.traits) {
              try {
                // Try to parse as JSON first
                personalityTraits = JSON.parse(blockchainData.traits);
              } catch {
                // If not JSON, split by comma
                personalityTraits = blockchainData.traits
                  .split(",")
                  .map((t: string) => t.trim());
              }
            }

            // Extract bio properly - blockchain stores traits as bio
            let bio = blockchainData.bio;
            if (typeof bio === "object") {
              bio = JSON.stringify(bio);
            }
            if (
              typeof bio === "string" &&
              bio.startsWith("{") &&
              bio.endsWith("}")
            ) {
              try {
                const parsed = JSON.parse(bio);
                bio = parsed.bio || parsed.traits || bio;
              } catch {
                // Keep as string if parsing fails
              }
            }

            const enrichedMatch = {
              ...match,
              name: blockchainData.name || match.name,
              age: blockchainData.age || match.age,
              city: blockchainData.city || match.city,
              bio: bio || match.bio,
              mbti: blockchainData.mbti,
              gender: blockchainData.gender,
              sexuality: blockchainData.id || match.sexuality, // Check blockchain ID field first
              personalityTraits: personalityTraits,
              matchedDate: match.matchedDate
                ? match.matchedDate.toDate()
                : new Date(),
            };

            console.log("✅ Enriched match data:", enrichedMatch);
            return enrichedMatch;
          } catch (error) {
            console.error(
              "❌ Error fetching blockchain data for",
              match.address,
              ":",
              error
            );
            // Try to fetch from Firebase user profile
            try {
              console.log(
                "🔄 Falling back to Firebase profile for:",
                match.address
              );
              const firebaseProfile = await FirebaseService.getUserProfile(
                match.address
              );
              console.log("🔄 Firebase profile data:", firebaseProfile);

              if (firebaseProfile) {
                // Calculate age from DOB if available
                let age = match.age;
                if (firebaseProfile.dob) {
                  try {
                    const birthDate = new Date(firebaseProfile.dob);
                    if (!isNaN(birthDate.getTime())) {
                      const currentYear = new Date().getFullYear();
                      age = currentYear - birthDate.getFullYear();
                    }
                  } catch (e) {
                    console.error("Error calculating age from DOB:", e);
                  }
                }

                // Extract bio properly from Firebase profile
                let bio = firebaseProfile.bio;
                if (typeof bio === "object") {
                  bio = JSON.stringify(bio);
                }
                if (
                  typeof bio === "string" &&
                  bio.startsWith("{") &&
                  bio.endsWith("}")
                ) {
                  try {
                    const parsed = JSON.parse(bio);
                    bio = parsed.bio || parsed.traits || bio;
                  } catch {
                    // Keep as string if parsing fails
                  }
                }

                return {
                  ...match,
                  name:
                    firebaseProfile.firstName && firebaseProfile.lastName
                      ? `${firebaseProfile.firstName} ${firebaseProfile.lastName}`
                      : match.name,
                  age: age,
                  city: firebaseProfile.location || match.city,
                  bio: bio || match.bio,
                  mbti: firebaseProfile.mbti,
                  gender: firebaseProfile.gender,
                  sexuality: firebaseProfile.sexuality,
                  personalityTraits: firebaseProfile.personalityTraits || [],
                  matchedDate: match.matchedDate
                    ? match.matchedDate.toDate()
                    : new Date(),
                };
              }
            } catch (firebaseError) {
              console.error(
                "❌ Firebase profile fetch also failed for",
                match.address,
                ":",
                firebaseError
              );
            }

            // Final fallback to basic match data
            return {
              ...match,
              matchedDate: match.matchedDate
                ? match.matchedDate.toDate()
                : new Date(),
            };
          }
        })
      );

      const deduplicatedMatches = deduplicateByAddress(matchesWithFullData);
      console.log(
        "🎯 Final matched users with full data:",
        deduplicatedMatches
      );
      setMatchedUsers(deduplicatedMatches);
    } catch (error) {
      console.error("💥 Error loading matched users:", error);
    }
  };

  const loadConnectionRequests = async () => {
    if (!address) return;

    try {
      const requests = await FirebaseService.getFuseRequests(address);
      console.log("🔥 Raw requests from Firebase:", requests);

      // Convert timestamps and set state
      const requestsWithDates = requests.map((req: any) => ({
        ...req,
        timestamp: req.timestamp ? req.timestamp.toDate() : new Date(),
      }));

      setConnectionRequests(requestsWithDates);
      console.log("🔥 Connection requests loaded:", requestsWithDates.length);
    } catch (error) {
      console.error("💥 Error loading connection requests:", error);
    }
  };

  const viewUserProfile = (user: MatchedUser) => {
    console.log("👤 Opening profile modal for user:", user);
    console.log("👤 User data:", {
      name: user.name,
      age: user.age,
      city: user.city,
      bio: user.bio,
      mbti: user.mbti,
      gender: user.gender,
      sexuality: user.sexuality,
      personalityTraits: user.personalityTraits,
      photosCount: user.photos?.length || 0,
    });
    setSelectedUser(user);
    setShowProfileModal(true);
  };

  const unfuseUser = async (userAddress: string, userName: string) => {
    Alert.alert(
      "Unfuse",
      `Are you sure you want to unfuse with ${userName}? This will:\n\n• Remove them from your Fusers list\n• Delete all messages between you\n• Prevent you from fusing again\n• Remove them from your main screen`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unfuse",
          style: "destructive",
          onPress: async () => {
            try {
              // Remove match from both users and clean up everything
              await FirebaseService.removeMatch(address, userAddress);

              // Local state will update via the listener
              Alert.alert(
                "Unfused",
                `${userName} has been completely unfused. You can no longer message each other or fuse again.`
              );
            } catch (error) {
              console.error("Error unfusing:", error);
              Alert.alert("Error", "Failed to unfuse. Please try again.");
            }
          },
        },
      ]
    );
  };

  const handleFuseIncoming = async (
    requesterAddress: string,
    requesterName: string
  ) => {
    try {
      // Get requester's profile data
      const requesterProfile = await FirebaseService.getUserProfile(
        requesterAddress
      );
      const requesterPhotos = await FirebaseService.getUserPhotoUrls(
        requesterAddress
      );

      // Get current user's profile data
      const currentUserProfile = await FirebaseService.getUserProfile(address);
      const currentUserPhotos = await FirebaseService.getUserPhotoUrls(address);

      const requestData = {
        address: address,
        name: `${currentUserProfile?.firstName || "Unknown"} ${
          currentUserProfile?.lastName || ""
        }`.trim(),
        age: currentUserProfile?.birthdate
          ? new Date().getFullYear() -
            new Date(currentUserProfile.birthdate).getFullYear()
          : 25,
        city: currentUserProfile?.location || "Unknown",
        bio: currentUserProfile?.bio || "",
        photos: currentUserPhotos,
        mbti: currentUserProfile?.mbti,
        gender: currentUserProfile?.gender,
        sexuality: currentUserProfile?.sexuality,
        personalityTraits: currentUserProfile?.personalityTraits || [],
        requesterAddress: address,
        targetAddress: requesterAddress,
      };

      // This will detect mutual match and store for both users
      const isMutual = await FirebaseService.storeFuseRequest(
        requesterAddress,
        requestData
      );

      if (isMutual) {
        // Mutual match! Store the match in Firebase for both users
        const matchDataForCurrent = {
          address: requesterAddress,
          name: requesterName,
          age:
            connectionRequests.find(
              (req) => req.requesterAddress === requesterAddress
            )?.age || 25,
          city:
            connectionRequests.find(
              (req) => req.requesterAddress === requesterAddress
            )?.city || "Unknown",
          bio:
            connectionRequests.find(
              (req) => req.requesterAddress === requesterAddress
            )?.bio || "",
          photos: [], // Will be loaded when viewing profile
          mbti: requesterProfile?.mbti,
          gender: requesterProfile?.gender,
          sexuality: requesterProfile?.sexuality,
          personalityTraits: requesterProfile?.personalityTraits || [],
        };

        const matchDataForOther = {
          address: address,
          name: requestData.name,
          age: requestData.age,
          city: requestData.city,
          bio: requestData.bio,
          photos: requestData.photos,
          mbti: requestData.mbti,
          gender: requestData.gender,
          sexuality: requestData.sexuality,
          personalityTraits: requestData.personalityTraits,
        };

        try {
          await FirebaseService.storeMatch(address, matchDataForCurrent);
          await FirebaseService.storeMatch(requesterAddress, matchDataForOther);
          console.log("💕 Mutual match stored from incoming request");
        } catch (error) {
          console.warn("Error storing mutual match from incoming:", error);
        }

        Alert.alert(
          "Mutual Fuse! 🔥❤️",
          `You and ${requesterName} have fused! You're now connected.`
        );
      } else {
        Alert.alert(
          "Request Sent",
          `Your fuse request has been sent to ${requesterName}.`
        );
      }
    } catch (error) {
      console.error("Error accepting fuse request:", error);
      Alert.alert("Error", "Failed to accept fuse request. Please try again.");
    }
  };

  const handleRejectIncoming = async (requesterAddress: string) => {
    try {
      await FirebaseService.removeFuseRequest(address, requesterAddress);
      Alert.alert("Request Rejected", "The fuse request has been rejected.");
    } catch (error) {
      console.error("Error rejecting fuse request:", error);
      Alert.alert("Error", "Failed to reject fuse request. Please try again.");
    }
  };

  return (
    <View
      style={[styles.container, { backgroundColor: theme.backgroundColor }]}
    >
      <Text style={theme.title}>Fusers</Text>
      <Text style={theme.subtitle}>Your connections and requests</Text>

      {/* Menu Picker  <View style={styles.pickerContainer}>
        <Picker
          selectedValue={selectedMenu}
          onValueChange={(itemValue) => setSelectedMenu(itemValue)}
          style={styles.picker}
        >
          <Picker.Item label="Fusers" value="matches" />
          <Picker.Item label="Want to Fuse" value="requests" />
        </Picker>
      </View>
*/}

      <ScrollView style={styles.requestsContainer}>
        {selectedMenu === "matches" ? (
          // Matches View
          matchedUsers.length === 0 ? (
            <Text style={styles.emptyText}>
              No matches yet. Start fusing to connect with people!
            </Text>
          ) : (
            matchedUsers.map((user, index) => (
              <View key={user.address} style={styles.matchedUserCard}>
                <TouchableOpacity
                  style={styles.matchedUserInfo}
                  onPress={() => viewUserProfile(user)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.matchedUserName}>
                    {user.name}, {calculateAge(user.age)}
                  </Text>
                  <Text style={styles.matchedUserLocation}>{user.city}</Text>
                  <Text style={styles.matchedUserDate}>
                    Matched {user.matchedDate.toLocaleDateString()}
                  </Text>
                </TouchableOpacity>
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
                      NavigationService.getInstance().navigateToTab(
                        "FuseChats"
                      );
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
          )
        ) : // Requests View
        connectionRequests.length === 0 ? (
          <Text style={styles.emptyText}>
            No incoming requests. Keep fusing to get more connections!
          </Text>
        ) : (
          connectionRequests.map((request, index) => (
            <View
              key={request.requesterAddress || request.address}
              style={styles.requestCard}
            >
              <View style={styles.requestInfo}>
                <Text style={styles.requestName}>
                  {request.name}, {request.age}
                </Text>
                <Text style={styles.requestLocation}>{request.city}</Text>
                <Text style={styles.requestBio}>{request.bio}</Text>
                <Text style={styles.requestDate}>
                  Requested {request.timestamp.toLocaleDateString()}
                </Text>
              </View>
              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={styles.acceptButton}
                  onPress={() =>
                    handleFuseIncoming(
                      request.requesterAddress || request.address,
                      request.name
                    )
                  }
                >
                  <Text style={styles.buttonText}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.rejectButton}
                  onPress={() =>
                    handleRejectIncoming(
                      request.requesterAddress || request.address
                    )
                  }
                >
                  <Text style={styles.rejectButtonText}>Reject</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Profile Modal */}
      <Modal
        visible={showProfileModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowProfileModal(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView
            ref={scrollViewRef}
            style={[
              styles.modalContent,
              { backgroundColor: theme.backgroundColor },
            ]}
            showsVerticalScrollIndicator={true}
            bounces={true}
            alwaysBounceVertical={true}
            contentContainerStyle={styles.scrollContent}
            onScroll={handleScroll}
            scrollEventThrottle={16}
          >
            <View style={styles.modalHeader}>
              <TouchableOpacity
                style={styles.closeArea}
                onPress={() => setShowProfileModal(false)}
              >
                <Text
                  style={[styles.closeButtonText, { color: theme.textColor }]}
                >
                  ✕
                </Text>
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: theme.textColor }]}>
                {selectedUser?.name}'s Profile
              </Text>
              <View style={styles.headerSpacer} />
            </View>

            {selectedUser && (
              <View style={styles.profileContent}>
                {/* Profile Images */}
                {selectedUser.photos && selectedUser.photos.length > 0 && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.photosContainer}
                    bounces={false}
                    pagingEnabled={false}
                  >
                    {selectedUser.photos.map((photo, index) => (
                      <TouchableOpacity
                        key={index}
                        activeOpacity={1}
                        style={styles.photoWrapper}
                      >
                        <Image
                          source={{ uri: photo }}
                          style={styles.profileImage}
                          resizeMode="cover"
                        />
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}

                {/* Profile Info */}
                <View style={styles.profileInfo}>
                  <Text
                    style={[styles.profileName, { color: theme.textColor }]}
                  >
                    {selectedUser.name}, {calculateAge(selectedUser.age)}
                  </Text>
                  <Text
                    style={[
                      styles.profileLocation,
                      { color: theme.textColor, opacity: 0.7 },
                    ]}
                  >
                    📍 {selectedUser.city}
                  </Text>

                  {selectedUser.bio &&
                    typeof selectedUser.bio === "string" &&
                    selectedUser.bio.trim() && (
                      <View style={styles.bioSection}>
                        <Text
                          style={[styles.bioLabel, { color: theme.textColor }]}
                        >
                          About
                        </Text>
                        <Text
                          style={[styles.bioText, { color: theme.textColor }]}
                        >
                          {selectedUser.bio}
                        </Text>
                      </View>
                    )}

                  {/* Additional Profile Fields */}
                  {selectedUser.mbti && (
                    <View style={styles.profileField}>
                      <Text
                        style={[styles.fieldLabel, { color: theme.textColor }]}
                      >
                        MBTI
                      </Text>
                      <Text
                        style={[styles.fieldValue, { color: theme.textColor }]}
                      >
                        {selectedUser.mbti}
                      </Text>
                    </View>
                  )}

                  {selectedUser.gender && (
                    <View style={styles.profileField}>
                      <Text
                        style={[styles.fieldLabel, { color: theme.textColor }]}
                      >
                        Gender
                      </Text>
                      <Text
                        style={[styles.fieldValue, { color: theme.textColor }]}
                      >
                        {selectedUser.gender}
                      </Text>
                    </View>
                  )}

                  {selectedUser.sexuality && (
                    <View style={styles.profileField}>
                      <Text
                        style={[styles.fieldLabel, { color: theme.textColor }]}
                      >
                        Sexuality
                      </Text>
                      <Text
                        style={[styles.fieldValue, { color: theme.textColor }]}
                      >
                        {selectedUser.sexuality}
                      </Text>
                    </View>
                  )}

                  {selectedUser.personalityTraits &&
                    selectedUser.personalityTraits.length > 0 && (
                      <View style={styles.profileField}>
                        <Text
                          style={[
                            styles.fieldLabel,
                            { color: theme.textColor },
                          ]}
                        >
                          Personality Traits
                        </Text>
                        <View style={styles.traitsContainer}>
                          {selectedUser.personalityTraits.map(
                            (trait, index) => (
                              <View key={index} style={styles.traitTag}>
                                <Text
                                  style={[
                                    styles.traitText,
                                    { color: theme.textColor },
                                  ]}
                                >
                                  {trait}
                                </Text>
                              </View>
                            )
                          )}
                        </View>
                      </View>
                    )}

                  <Text
                    style={[
                      styles.matchDate,
                      { color: theme.textColor, opacity: 0.6 },
                    ]}
                  >
                    Matched on {selectedUser.matchedDate.toLocaleDateString()}
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
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

// Utility function to calculate age from birthdate or return the age if it's already a number
const calculateAge = (age: number | string): string => {
  console.log("🧮 calculateAge called with:", age, "type:", typeof age);
  if (typeof age === "number" && !isNaN(age)) {
    console.log("🧮 Returning age as number:", age);
    return age.toString();
  }
  console.log("🧮 Age is not a valid number, returning N/A");
  return "N/A";
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    borderRadius: 20,
    width: isLargeScreen ? screenWidth * 0.9 : screenWidth * 0.95,
    maxWidth: isLargeScreen ? screenWidth * 0.9 : 400,
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 60,
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
    paddingBottom: 15,
  },
  closeArea: {
    padding: 10,
    marginLeft: -10,
  },
  headerSpacer: {
    width: 30, // To balance the close button on the left
  },
  modalTitle: {
    fontSize: isLargeScreen ? 24 : 20,
    fontWeight: "bold",
  },
  closeButton: {
    padding: 5,
  },
  closeButtonText: {
    fontSize: 24,
    fontWeight: "bold",
  },
  modalBody: {
    padding: 20,
  },
  scrollContent: {
    minHeight: Dimensions.get("window").height * 0.8,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  photosContainer: {
    marginBottom: 20,
    height: 320, // Fixed height for photo container
  },
  profileImage: {
    width: isLargeScreen ? 400 : 280,
    height: isLargeScreen ? 400 : 280,
    borderRadius: 15,
  },
  profileInfo: {
    marginBottom: 20,
  },
  profileName: {
    fontSize: isLargeScreen ? 28 : 24,
    fontWeight: "bold",
    marginBottom: 5,
  },
  profileLocation: {
    fontSize: isLargeScreen ? 18 : 16,
    marginBottom: 15,
  },
  bioSection: {
    marginBottom: 15,
  },
  bioLabel: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
  },
  bioText: {
    fontSize: isLargeScreen ? 18 : 16,
    lineHeight: isLargeScreen ? 26 : 24,
  },
  profileField: {
    marginBottom: 15,
  },
  fieldLabel: {
    fontSize: isLargeScreen ? 20 : 18,
    fontWeight: "600",
    marginBottom: 8,
  },
  fieldValue: {
    fontSize: isLargeScreen ? 18 : 16,
    lineHeight: isLargeScreen ? 26 : 24,
  },
  traitsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 5,
  },
  traitTag: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  traitText: {
    fontSize: 14,
    fontWeight: "500",
  },
  profileContent: {
    // flex: 1, // Removed to allow natural content height
  },
  photoWrapper: {
    marginRight: 10,
  },
  matchDate: {
    fontSize: 14,
    fontStyle: "italic",
    marginTop: 10,
  },
  pickerContainer: {
    backgroundColor: "#fff",
    borderRadius: 10,
    marginBottom: 15,
    elevation: 2,
  },
  picker: {
    height: 50,
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
    color: "#888",
    marginTop: 5,
  },
  requestDate: {
    fontSize: 14,
    color: "#333",
    marginTop: 5,
  },
  acceptButton: {
    backgroundColor: "#28a745",
    borderRadius: 25,
    paddingVertical: 10,
    paddingHorizontal: 15,
    alignItems: "center",
    marginRight: 10,
  },
  rejectButton: {
    backgroundColor: "#dc3545",
    borderRadius: 25,
    paddingVertical: 10,
    paddingHorizontal: 15,
    alignItems: "center",
  },
  rejectButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});
