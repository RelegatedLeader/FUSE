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
import { Timestamp } from "firebase/firestore";
import { EnhancedMatchingEngine } from "../utils/enhancedMatchingEngine";

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
  const [compatibilityResult, setCompatibilityResult] = useState<any>(null);
  const [showCompatibilityDetails, setShowCompatibilityDetails] =
    useState(false);
  const [userCompatibilityScores, setUserCompatibilityScores] = useState<
    Map<string, number>
  >(new Map());
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
      // Real-time updates for matches
      const unsubscribeMatches = FirebaseService.listenToMatches(
        address,
        (matches) => {
          console.log("🔄 Real-time matches update received:", matches);
          const matchesWithDates = matches.map((match: any) => ({
            ...match,
            matchedDate: match.matchedDate
              ? match.matchedDate.toDate()
              : new Date(),
          }));
          const deduplicatedMatches = deduplicateByAddress(matchesWithDates);
          console.log("🔄 Setting matched users:", deduplicatedMatches);
          setMatchedUsers(deduplicatedMatches);
          // Calculate compatibility for all matched users
          calculateCompatibilityForUsers(deduplicatedMatches);
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
      // Load matched users from Firebase
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
      console.log(
        "🔍 Loaded matched users from Firebase:",
        deduplicatedMatches
      );
      setMatchedUsers(deduplicatedMatches);
      // Calculate compatibility for all matched users
      calculateCompatibilityForUsers(deduplicatedMatches);
    } catch (error) {
      console.error("💥 Error loading matched users:", error);
      setMatchedUsers([]);
    }
  };

  const calculateCompatibilityForUsers = async (users: MatchedUser[]) => {
    if (!address) return;

    console.log("🔄 Calculating compatibility for users:", users.length);
    const scores = new Map<string, number>();

    for (const user of users) {
      try {
        console.log(
          `🔄 Calculating compatibility for ${user.name} (${user.address})`
        );
        const compatibility =
          await EnhancedMatchingEngine.calculateCompatibility(
            address,
            user.address
          );
        scores.set(user.address, compatibility.overallScore);
        console.log(
          `✅ Compatibility for ${user.name}: ${compatibility.overallScore}%`
        );
      } catch (error) {
        console.error(
          `❌ Failed to calculate compatibility for ${user.name}:`,
          error
        );
        scores.set(user.address, 50); // Default score
      }
    }

    console.log("🔄 Setting compatibility scores:", Object.fromEntries(scores));
    setUserCompatibilityScores(scores);
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

  const viewUserProfile = async (user: MatchedUser) => {
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

    // Calculate compatibility in background
    if (address && user.address) {
      try {
        const compatibility =
          await EnhancedMatchingEngine.calculateCompatibility(
            address,
            user.address
          );
        setCompatibilityResult(compatibility);
        console.log("Compatibility calculated:", compatibility.overallScore);
      } catch (error) {
        console.error("Failed to calculate compatibility:", error);
        setCompatibilityResult(null);
      }
    }
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

  const handleCreateAlliance = () => {
    if (matchedUsers.length < 4) {
      Alert.alert(
        "Not Enough Fusers",
        "You need at least 4 fusers to create an alliance. Keep connecting!"
      );
      return;
    }

    // Navigate to alliances page
    NavigationService.getInstance().navigateToTab("AlliancesMain");
  };

  const handleFuseIncoming = async (
    requesterAddress: string,
    requesterName: string
  ) => {
    console.log(
      "🎯 handleFuseIncoming STARTED for:",
      requesterAddress,
      requesterName
    );
    console.log(
      "🔥 handleFuseIncoming called with:",
      requesterAddress,
      requesterName
    );
    try {
      // Check if there's a pending request from this user
      const requests = await FirebaseService.getFuseRequests(address);
      console.log("🔥 Got requests:", requests);
      const existingRequest = requests.find(
        (req: any) => req.requesterAddress === requesterAddress
      );

      if (!existingRequest) {
        console.log("❌ No pending request found from:", requesterAddress);
        Alert.alert("Error", "No pending request found from this user.");
        return;
      }

      console.log("✅ Found existing request:", existingRequest);

      // Get requester's profile data
      const requesterProfile = await FirebaseService.getUserProfile(
        requesterAddress
      );

      // Get current user's profile data
      const currentUserProfile = await FirebaseService.getUserProfile(address);
      const currentUserPhotos = await FirebaseService.getUserPhotoUrls(address);

      // Create match data for both users
      const matchDataForCurrent = {
        address: requesterAddress,
        name: requesterName,
        age: existingRequest.age || 25,
        city: existingRequest.city || "Unknown",
        bio: existingRequest.bio || "",
        photos: [], // Will be loaded when viewing profile
        mbti: requesterProfile?.mbti,
        gender: requesterProfile?.gender,
        sexuality: requesterProfile?.sexuality,
        personalityTraits: requesterProfile?.personalityTraits || [],
        matchedDate: Timestamp.now(),
      };

      const matchDataForOther = {
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
        mbti: currentUserProfile?.mbti || null,
        gender: currentUserProfile?.gender || null,
        sexuality: currentUserProfile?.sexuality || null,
        personalityTraits: currentUserProfile?.personalityTraits || [],
        matchedDate: Timestamp.now(),
      };

      // Store matches for both users
      console.log("💕 Storing match for current user:", address);
      try {
        await FirebaseService.storeMatch(address, matchDataForCurrent);
        console.log("✅ Match stored for current user");
      } catch (error) {
        console.error("❌ Failed to store match for current user:", error);
        throw error;
      }

      console.log("💕 Storing match for other user:", requesterAddress);
      try {
        await FirebaseService.storeMatch(requesterAddress, matchDataForOther);
        console.log("✅ Match stored for other user");
      } catch (error) {
        console.error("❌ Failed to store match for other user:", error);
        throw error;
      }

      // Remove the request
      console.log("🗑️ Removing fuse request");
      await FirebaseService.removeFuseRequest(address, requesterAddress);

      // Update local state
      setConnectionRequests((prev) =>
        prev.filter((req) => req.requesterAddress !== requesterAddress)
      );

      Alert.alert(
        "Fuse Complete! 🔥❤️",
        `You and ${requesterName} have fused! You're now connected.`
      );

      console.log("💕 Fuse request accepted and matches created");
      // Manually refresh matches as backup to real-time listener
      loadMatchedUsers();
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
      <View style={styles.headerContainer}>
        <Text style={theme.title}>Fusers</Text>
        {matchedUsers.length >= 4 && (
          <TouchableOpacity
            style={[theme.button, styles.createAllianceButton]}
            onPress={handleCreateAlliance}
          >
            <Text style={theme.buttonTextStyle}>🤝 Create an Alliance</Text>
          </TouchableOpacity>
        )}
      </View>
      <Text style={theme.subtitle}>Your connections</Text>

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
                  <View style={styles.userHeader}>
                    <Text style={styles.matchedUserName}>
                      {user.name}, {calculateAge(user.age)}
                    </Text>
                    {userCompatibilityScores.has(user.address) ? (
                      <View style={styles.compatibilityBadge}>
                        <Text style={styles.compatibilityBadgeText}>
                          🚀 {userCompatibilityScores.get(user.address)}%
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.compatibilityBadge}>
                        <Text style={styles.compatibilityBadgeText}>
                          🚀 Calculating...
                        </Text>
                      </View>
                    )}
                  </View>
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

                {/* Compatibility Summary */}
                {compatibilityResult && (
                  <View style={styles.compatibilitySummary}>
                    <Text
                      style={[
                        styles.compatibilitySummaryText,
                        { color: theme.textColor },
                      ]}
                    >
                      💕{" "}
                      {compatibilityResult.insights.length > 0
                        ? compatibilityResult.insights[0].description
                        : `You are ${compatibilityResult.overallScore}% compatible!`}
                    </Text>
                  </View>
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
                    Object.keys(selectedUser.personalityTraits).length > 0 && (
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
                          {Object.entries(selectedUser.personalityTraits).map(
                            ([trait, value]: [string, any]) => (
                              <View key={trait} style={styles.traitTag}>
                                <Text
                                  style={[
                                    styles.traitText,
                                    { color: theme.textColor },
                                  ]}
                                >
                                  {trait}:{" "}
                                  {typeof value === "number"
                                    ? value.toFixed(1)
                                    : value}
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

                {/* Compatibility Score */}
                {compatibilityResult && (
                  <View style={styles.compatibilityContainer}>
                    <TouchableOpacity
                      style={styles.compatibilityScore}
                      onPress={() =>
                        setShowCompatibilityDetails(!showCompatibilityDetails)
                      }
                    >
                      <Text
                        style={[
                          styles.compatibilityLabel,
                          { color: theme.textColor },
                        ]}
                      >
                        Compatibility
                      </Text>
                      <View style={styles.compatibilityRow}>
                        <Text
                          style={[
                            styles.compatibilityPercent,
                            { color: theme.textColor },
                          ]}
                        >
                          {compatibilityResult.overallScore}%
                        </Text>
                        <Text
                          style={[
                            styles.compatibilityTapHint,
                            { color: theme.textColor + "80" },
                          ]}
                        >
                          Tap for details
                        </Text>
                      </View>
                      <View style={styles.compatibilityBar}>
                        <View
                          style={[
                            styles.compatibilityFill,
                            {
                              width: `${compatibilityResult.overallScore}%`,
                              backgroundColor:
                                compatibilityResult.overallScore >= 80
                                  ? "#4CAF50"
                                  : compatibilityResult.overallScore >= 60
                                  ? "#FFC107"
                                  : "#F44336",
                            },
                          ]}
                        />
                      </View>
                    </TouchableOpacity>

                    {showCompatibilityDetails && (
                      <ScrollView
                        style={styles.compatibilityDetails}
                        showsVerticalScrollIndicator={true}
                        nestedScrollEnabled={true}
                      >
                        {compatibilityResult.breakdown.map(
                          (item: any, index: number) => (
                            <View key={index} style={styles.compatibilityItem}>
                              <View style={styles.compatibilityItemHeader}>
                                <Text
                                  style={[
                                    styles.compatibilityCategory,
                                    { color: theme.textColor },
                                  ]}
                                >
                                  {item.category}
                                </Text>
                                <Text
                                  style={[
                                    styles.compatibilityScore,
                                    { color: theme.textColor },
                                  ]}
                                >
                                  {item.score}%
                                </Text>
                              </View>
                              <Text
                                style={[
                                  styles.compatibilityDescription,
                                  { color: theme.textColor + "CC" },
                                ]}
                              >
                                {item.description}
                              </Text>
                              <View style={styles.compatibilityFactors}>
                                {item.factors.map(
                                  (factor: string, idx: number) => (
                                    <Text
                                      key={idx}
                                      style={[
                                        styles.compatibilityFactor,
                                        { color: theme.textColor + "99" },
                                      ]}
                                    >
                                      • {factor}
                                    </Text>
                                  )
                                )}
                              </View>
                            </View>
                          )
                        )}

                        {compatibilityResult.insights.length > 0 && (
                          <View style={styles.compatibilityInsights}>
                            <Text
                              style={[
                                styles.insightsTitle,
                                { color: theme.textColor },
                              ]}
                            >
                              💡 Match Insights
                            </Text>
                            {compatibilityResult.insights.map(
                              (insight: any, index: number) => (
                                <View key={index} style={styles.insightItem}>
                                  <Text
                                    style={[
                                      styles.insightTitle,
                                      { color: theme.textColor },
                                    ]}
                                  >
                                    {insight.title}
                                  </Text>
                                  <Text
                                    style={[
                                      styles.insightDescription,
                                      { color: theme.textColor + "CC" },
                                    ]}
                                  >
                                    {insight.description}
                                  </Text>
                                </View>
                              )
                            )}
                          </View>
                        )}
                      </ScrollView>
                    )}
                  </View>
                )}
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
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  createAllianceButton: {
    marginLeft: 15,
    paddingHorizontal: 15,
    paddingVertical: 8,
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
  userHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 5,
  },
  matchedUserName: {
    fontSize: 18,
    fontWeight: "bold",
    flex: 1,
  },
  compatibilityBadge: {
    backgroundColor: "#ff8c00",
    borderRadius: 15,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  compatibilityBadgeText: {
    color: "#fff",
    fontSize: 14,
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
  // Compatibility Styles
  compatibilityContainer: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  compatibilityScore: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 12,
    padding: 15,
  },
  compatibilityLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
    opacity: 0.8,
  },
  compatibilityRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  compatibilityPercent: {
    fontSize: 28,
    fontWeight: "bold",
  },
  compatibilityTapHint: {
    fontSize: 12,
  },
  compatibilityBar: {
    height: 4,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 2,
    overflow: "hidden",
  },
  compatibilityFill: {
    height: "100%",
    borderRadius: 2,
  },
  compatibilityDetails: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.1)",
    maxHeight: 300,
  },
  compatibilityItem: {
    marginBottom: 15,
  },
  compatibilityItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 5,
  },
  compatibilityCategory: {
    fontSize: 16,
    fontWeight: "600",
  },
  compatibilityDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
    opacity: 0.9,
  },
  compatibilityFactors: {
    marginLeft: 10,
  },
  compatibilityFactor: {
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.8,
  },
  compatibilityInsights: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.1)",
  },
  insightsTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 10,
  },
  insightItem: {
    marginBottom: 12,
  },
  insightTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  insightDescription: {
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.9,
  },
  compatibilitySummary: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "rgba(76, 175, 80, 0.1)",
    borderRadius: 8,
    marginHorizontal: 20,
    marginBottom: 15,
  },
  compatibilitySummaryText: {
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 20,
  },
});
