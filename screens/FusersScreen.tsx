import React, { useState, useEffect } from "react";
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

type MenuOption = "fusers";

export default function FusersScreen() {
  const { address } = useWallet();
  const { theme } = useTheme();
  const [matchedUsers, setMatchedUsers] = useState<MatchedUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<MatchedUser | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);

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
      console.log("🔍 Raw matches from Firebase:", matches);

      // Fetch complete profile data from blockchain for each match
      const matchesWithFullData = await Promise.all(
        matches.map(async (match: any) => {
          console.log("🔍 Processing match:", match.address, "with data:", match);
          try {
            console.log("🌐 Fetching blockchain data for:", match.address);
            const blockchainData = await getUserData(match.address);
            console.log("🌐 Blockchain data for", match.address, ":", blockchainData);

            // Parse personality traits if it's a string
            let personalityTraits: string[] = [];
            if (blockchainData.traits) {
              try {
                // Try to parse as JSON first
                personalityTraits = JSON.parse(blockchainData.traits);
              } catch {
                // If not JSON, split by comma
                personalityTraits = blockchainData.traits.split(',').map((t: string) => t.trim());
              }
            }

            // Extract bio properly - blockchain stores traits as bio
            let bio = blockchainData.bio;
            if (typeof bio === 'object') {
              bio = JSON.stringify(bio);
            }
            if (typeof bio === 'string' && bio.startsWith('{') && bio.endsWith('}')) {
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
              sexuality: match.sexuality, // Keep from Firebase match data
              personalityTraits: personalityTraits,
              matchedDate: match.matchedDate
                ? match.matchedDate.toDate()
                : new Date(),
            };

            console.log("✅ Enriched match data:", enrichedMatch);
            return enrichedMatch;
          } catch (error) {
            console.error("❌ Error fetching blockchain data for", match.address, ":", error);
            // Try to fetch from Firebase user profile
            try {
              console.log("🔄 Falling back to Firebase profile for:", match.address);
              const firebaseProfile = await FirebaseService.getUserProfile(match.address);
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
                if (typeof bio === 'object') {
                  bio = JSON.stringify(bio);
                }
                if (typeof bio === 'string' && bio.startsWith('{') && bio.endsWith('}')) {
                  try {
                    const parsed = JSON.parse(bio);
                    bio = parsed.bio || parsed.traits || bio;
                  } catch {
                    // Keep as string if parsing fails
                  }
                }

                return {
                  ...match,
                  name: firebaseProfile.firstName && firebaseProfile.lastName
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
              console.error("❌ Firebase profile fetch also failed for", match.address, ":", firebaseError);
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
      console.log("🎯 Final matched users with full data:", deduplicatedMatches);
      setMatchedUsers(deduplicatedMatches);
    } catch (error) {
      console.error("💥 Error loading matched users:", error);
    }
  };

  const viewUserProfile = (user: MatchedUser) => {
    console.log("👤 Viewing profile for user:", user);
    console.log("👤 User data:", {
      name: user.name,
      age: user.age,
      city: user.city,
      bio: user.bio,
      mbti: user.mbti,
      gender: user.gender,
      sexuality: user.sexuality,
      personalityTraits: user.personalityTraits,
    });
    setSelectedUser(user);
    setShowProfileModal(true);
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
                  onPress={() => viewUserProfile(user)}
                >
                  <Text style={styles.matchedUserName}>
                    {user.name}, {calculateAge(user.age)}
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

      {/* Profile Modal */}
      <Modal
        visible={showProfileModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowProfileModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowProfileModal(false)}
        >
          <TouchableOpacity
            style={[styles.modalContent, { backgroundColor: theme.backgroundColor }]}
            activeOpacity={1}
            onPress={() => {}} // Prevent closing when tapping inside modal
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.textColor }]}>
                {selectedUser?.name}'s Profile
              </Text>
              <TouchableOpacity
                onPress={() => setShowProfileModal(false)}
                style={styles.closeButton}
              >
                <Text style={[styles.closeButtonText, { color: theme.textColor }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={styles.modalBody}
              showsVerticalScrollIndicator={true}
              bounces={false}
            >
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
                    <Text style={[styles.profileName, { color: theme.textColor }]}>
                      {selectedUser.name}, {calculateAge(selectedUser.age)}
                    </Text>
                    <Text style={[styles.profileLocation, { color: theme.textColor, opacity: 0.7 }]}>
                      📍 {selectedUser.city}
                    </Text>

                    {selectedUser.bio && typeof selectedUser.bio === 'string' && selectedUser.bio.trim() && (
                      <View style={styles.bioSection}>
                        <Text style={[styles.bioLabel, { color: theme.textColor }]}>
                          About
                        </Text>
                        <Text style={[styles.bioText, { color: theme.textColor }]}>
                          {selectedUser.bio}
                        </Text>
                      </View>
                    )}

                    {/* Additional Profile Fields */}
                    {selectedUser.mbti && (
                      <View style={styles.profileField}>
                        <Text style={[styles.fieldLabel, { color: theme.textColor }]}>
                          MBTI
                        </Text>
                        <Text style={[styles.fieldValue, { color: theme.textColor }]}>
                          {selectedUser.mbti}
                        </Text>
                      </View>
                    )}

                    {selectedUser.gender && (
                      <View style={styles.profileField}>
                        <Text style={[styles.fieldLabel, { color: theme.textColor }]}>
                          Gender
                        </Text>
                        <Text style={[styles.fieldValue, { color: theme.textColor }]}>
                          {selectedUser.gender}
                        </Text>
                      </View>
                    )}

                    {selectedUser.sexuality && (
                      <View style={styles.profileField}>
                        <Text style={[styles.fieldLabel, { color: theme.textColor }]}>
                          Sexuality
                        </Text>
                        <Text style={[styles.fieldValue, { color: theme.textColor }]}>
                          {selectedUser.sexuality}
                        </Text>
                      </View>
                    )}

                    {selectedUser.personalityTraits && selectedUser.personalityTraits.length > 0 && (
                      <View style={styles.profileField}>
                        <Text style={[styles.fieldLabel, { color: theme.textColor }]}>
                          Personality Traits
                        </Text>
                        <View style={styles.traitsContainer}>
                          {selectedUser.personalityTraits.map((trait, index) => (
                            <View key={index} style={styles.traitTag}>
                              <Text style={[styles.traitText, { color: theme.textColor }]}>
                                {trait}
                              </Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}

                    <Text style={[styles.matchDate, { color: theme.textColor, opacity: 0.6 }]}>
                      Matched on {selectedUser.matchedDate.toLocaleDateString()}
                    </Text>
                  </View>
                </View>
              )}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
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
  if (typeof age === 'number' && !isNaN(age)) {
    console.log("🧮 Returning age as number:", age);
    return age.toString();
  }
  console.log("🧮 Age is not a valid number, returning N/A");
  return 'N/A';
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    borderRadius: 20,
    maxHeight: Dimensions.get('window').height * 0.9,
    width: Dimensions.get('window').width * 0.95,
    maxWidth: 400,
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 5,
  },
  closeButtonText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  modalBody: {
    padding: 20,
    maxHeight: Dimensions.get('window').height * 0.7,
  },
  photosContainer: {
    marginBottom: 20,
    height: 320, // Fixed height for photo container
  },
  profileImage: {
    width: 280,
    height: 280,
    borderRadius: 15,
  },
  profileInfo: {
    marginBottom: 20,
  },
  profileName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  profileLocation: {
    fontSize: 16,
    marginBottom: 15,
  },
  bioSection: {
    marginBottom: 15,
  },
  bioLabel: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  bioText: {
    fontSize: 16,
    lineHeight: 24,
  },
  profileField: {
    marginBottom: 15,
  },
  fieldLabel: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  fieldValue: {
    fontSize: 16,
    lineHeight: 24,
  },
  traitsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 5,
  },
  traitTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  traitText: {
    fontSize: 14,
    fontWeight: '500',
  },
  profileContent: {
    flex: 1,
  },
  photoWrapper: {
    marginRight: 10,
  },
  matchDate: {
    fontSize: 14,
    fontStyle: 'italic',
    marginTop: 10,
  },
});
