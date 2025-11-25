import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  FlatList,
  Alert,
  Modal,
  Image,
} from "react-native";
import { useWallet } from "../contexts/WalletContext";
import { useTheme } from "../contexts/ThemeContext";
import { MatchingEngine } from "../utils/matchingEngine";
import { FirebaseService } from "../utils/firebaseService";
import { getUserData } from "../utils/contract";

interface DiscoverUser {
  address: string;
  name: string;
  age: number | string;
  city: string;
  bio: string;
  photos: string[];
  mbti?: string;
  gender?: string;
  sexuality?: string;
  personalityTraits?: { [key: string]: number };
  interests?: string[];
}

interface Category {
  id: string;
  title: string;
  users: DiscoverUser[];
  shownCount: number;
}

const SEARCH_PLACEHOLDERS = [
  "Describe your soulmate",
  "Describe your other half",
  "Describe your friend",
  "Describe your best friend",
  "Describe your partner",
  "Describe your companion",
  "Describe your connection",
];

// Helper function to calculate age from birthdate
const calculateAge = (birthdate: string): number | string => {
  if (!birthdate) return "N/A";
  try {
    // Handle MM/DD/YYYY format
    const [month, day, year] = birthdate.split("/");
    const birthDate = new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day)
    );
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }
    return age;
  } catch (error) {
    console.warn("Error parsing birthdate:", birthdate);
    return "N/A";
  }
};

const DiscoverScreen: React.FC = () => {
  const { address } = useWallet();
  const { theme } = useTheme();
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchPlaceholder, setSearchPlaceholder] = useState(
    "Describe your connection"
  );
  const [allUsers, setAllUsers] = useState<DiscoverUser[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  // Profile modal state
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<DiscoverUser | null>(null);

  // Check if user has at least 4 matches to unlock Discover
  useEffect(() => {
    const checkUnlockStatus = async () => {
      if (!address) return;

      try {
        const matches = await FirebaseService.loadMatches(address);
        setIsUnlocked(matches.length >= 4);
      } catch (error) {
        console.error("Error checking unlock status:", error);
        setIsUnlocked(false);
      }
    };

    checkUnlockStatus();
  }, [address]);

  // Load user profile and all potential discover users
  useEffect(() => {
    const loadData = async () => {
      if (!address) return; // Temporarily removed isUnlocked check for testing

      try {
        // Load user's own profile
        const userData = await getUserData(address);
        const firebaseProfile = await FirebaseService.getUserProfile(address);
        setUserProfile({
          ...userData,
          ...firebaseProfile,
        });

        // Load all potential matches using the same logic as FuseScreen
        const allMatches = await MatchingEngine.findMatchesForUser(address);

        // Filter out users already matched with (this is already done by findMatchesForUser)
        // But we want ALL users for discovery, not just compatible ones
        // So let's get all users from Firebase directly using the public data

        // For now, let's use a simpler approach - get all users and filter manually
        const allUsersData = await FirebaseService.getAllUsersForDiscovery(
          address
        );

        // Convert to DiscoverUser format
        const discoverUsers: DiscoverUser[] = allUsersData.map((user: any) => ({
          address: user.address,
          name: user.name || user.firstName || "Anonymous",
          age:
            user.age || (user.birthdate ? calculateAge(user.birthdate) : "N/A"),
          city: user.location || user.city || "Unknown",
          bio: user.bio || user.description || "No bio available",
          photos: user.photos || [],
          mbti: user.mbti,
          gender: user.gender,
          sexuality: user.sexuality,
          personalityTraits: user.personalityTraits || {},
          interests: user.interests || [],
        }));

        setAllUsers(discoverUsers);
      } catch (error) {
        console.error("Error loading discover data:", error);
      }
    };

    loadData();
  }, [address, isUnlocked]);

  // Generate categories based on user profile and available users
  useEffect(() => {
    if (!userProfile || allUsers.length === 0) return;

    const generateCategories = (): Category[] => {
      // Basic category logic (will be enhanced with real algorithm later)
      const categories: Category[] = [
        {
          id: "more-like-you",
          title: "More like you",
          users: allUsers
            .filter(
              (user) =>
                user.city === userProfile.location ||
                user.age === userProfile.age ||
                (user.interests &&
                  Array.isArray(user.interests) &&
                  userProfile.interests &&
                  Array.isArray(userProfile.interests) &&
                  user.interests.some((interest) =>
                    userProfile.interests.includes(interest)
                  ))
            )
            .slice(0, 20),
          shownCount: 3,
        },
        {
          id: "compatible",
          title: "More Compatible with",
          users: allUsers
            .filter(
              (user) =>
                (user.mbti &&
                  userProfile.mbti &&
                  user.mbti !== userProfile.mbti) ||
                (user.personalityTraits &&
                  Array.isArray(user.personalityTraits) &&
                  userProfile.personalityTraits &&
                  Array.isArray(userProfile.personalityTraits) &&
                  user.personalityTraits.some((trait) =>
                    userProfile.personalityTraits.includes(trait)
                  ))
            )
            .slice(0, 20),
          shownCount: 3,
        },
        {
          id: "matches-vibe",
          title: "Matches your vibe",
          users: allUsers
            .filter(
              (user) =>
                user.bio &&
                userProfile.bio &&
                ((user.bio.toLowerCase().includes("creative") &&
                  userProfile.bio.toLowerCase().includes("art")) ||
                  (user.bio.toLowerCase().includes("tech") &&
                    userProfile.bio.toLowerCase().includes("coding")))
            )
            .slice(0, 20),
          shownCount: 3,
        },
        {
          id: "enjoys-what-you-do",
          title: "Enjoys what you do",
          users: allUsers
            .filter(
              (user) =>
                user.interests &&
                Array.isArray(user.interests) &&
                userProfile.interests &&
                Array.isArray(userProfile.interests) &&
                user.interests.some((interest) =>
                  userProfile.interests.some((userInterest: string) =>
                    userInterest
                      .toLowerCase()
                      .includes(interest.toLowerCase().split(" ")[0])
                  )
                )
            )
            .slice(0, 20),
          shownCount: 3,
        },
        {
          id: "new-in-area",
          title: "New in your area",
          users: allUsers
            .filter((user) => user.city === userProfile.location)
            .slice(0, 20),
          shownCount: 3,
        },
        {
          id: "adventure-seekers",
          title: "Adventure seekers",
          users: allUsers
            .filter(
              (user) =>
                user.interests &&
                Array.isArray(user.interests) &&
                (user.interests.includes("Travel") ||
                  user.interests.includes("Hiking"))
            )
            .slice(0, 20),
          shownCount: 3,
        },
      ];

      return categories;
    };

    setCategories(generateCategories());
  }, [userProfile, allUsers]);

  // Rotate search placeholder every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const currentIndex = SEARCH_PLACEHOLDERS.indexOf(searchPlaceholder);
      const nextIndex = (currentIndex + 1) % SEARCH_PLACEHOLDERS.length;
      setSearchPlaceholder(SEARCH_PLACEHOLDERS[nextIndex]);
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [searchPlaceholder]);

  const handleShowMore = (categoryId: string) => {
    setCategories((prevCategories) =>
      prevCategories.map((category) =>
        category.id === categoryId
          ? {
              ...category,
              shownCount: Math.min(
                category.shownCount + 5,
                category.users.length
              ),
            }
          : category
      )
    );
  };

  const handleUserPress = (user: DiscoverUser) => {
    setSelectedUser(user);
    setShowProfileModal(true);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    // TODO: Implement search algorithm based on bio, traits, etc.
    // For now, just filter by name or bio containing the query
    if (query.trim()) {
      const filteredUsers = allUsers.filter(
        (user) =>
          user.name.toLowerCase().includes(query.toLowerCase()) ||
          user.bio.toLowerCase().includes(query.toLowerCase()) ||
          (user.interests &&
            Array.isArray(user.interests) &&
            user.interests.some((interest) =>
              interest.toLowerCase().includes(query.toLowerCase())
            ))
      );
      // TODO: Show search results
      console.log("Search results:", filteredUsers);
    }
  };

  // Temporarily commented out for testing - uncomment when ready for production
  /*
  if (!isUnlocked) {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.backgroundColor }]}
      >
        <Text style={theme.title}>Discover</Text>
        <View
          style={[
            styles.lockedContainer,
            { backgroundColor: theme.card.backgroundColor },
          ]}
        >
          <Text style={[styles.lockedIcon, { color: theme.textColor }]}>
            🔒
          </Text>
          <Text style={[styles.lockedTitle, { color: theme.textColor }]}>
            Discover Locked
          </Text>
          <Text style={[styles.lockedText, { color: theme.textColor }]}>
            Fuse with at least 4 people to unlock the Discover feature and find
            your perfect connections!
          </Text>
        </View>
      </View>
    );
  }
  */

  return (
    <View
      style={[styles.container, { backgroundColor: theme.backgroundColor }]}
    >
      <Text style={theme.title}>Discover</Text>

      {/* Search Bar */}
      <View
        style={[
          styles.searchContainer,
          { backgroundColor: theme.card.backgroundColor },
        ]}
      >
        <TextInput
          style={[styles.searchInput, { color: theme.textColor }]}
          placeholder={searchPlaceholder}
          placeholderTextColor={theme.textColor + "80"}
          value={searchQuery}
          onChangeText={handleSearch}
        />
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {categories.map((category) => (
          <View key={category.id} style={styles.categoryContainer}>
            <Text style={[styles.categoryTitle, { color: theme.textColor }]}>
              {category.title}
            </Text>

            <FlatList
              horizontal
              data={category.users.slice(0, category.shownCount)}
              keyExtractor={(item) => item.address}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.userCard,
                    { backgroundColor: theme.card.backgroundColor },
                  ]}
                  onPress={() => handleUserPress(item)}
                  activeOpacity={0.8}
                >
                  <View style={styles.userCardContent}>
                    <Text style={[styles.userName, { color: theme.textColor }]}>
                      {item.name}, {item.age}
                    </Text>
                    <Text style={[styles.userCity, { color: theme.textColor }]}>
                      📍 {item.city}
                    </Text>
                    <Text style={[styles.userBio, { color: theme.textColor }]}>
                      {item.bio.length > 60
                        ? item.bio.substring(0, 60) + "..."
                        : item.bio}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
              showsHorizontalScrollIndicator={false}
              ListFooterComponent={
                category.shownCount < category.users.length ? (
                  <TouchableOpacity
                    style={[
                      styles.showMoreButton,
                      { backgroundColor: theme.buttonBackground },
                    ]}
                    onPress={() => handleShowMore(category.id)}
                  >
                    <Text
                      style={[styles.showMoreText, { color: theme.buttonText }]}
                    >
                      Show More
                    </Text>
                  </TouchableOpacity>
                ) : null
              }
            />
          </View>
        ))}
      </ScrollView>

      {/* Profile Modal */}
      <Modal
        visible={showProfileModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowProfileModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: theme.backgroundColor },
            ]}
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
              <ScrollView
                style={styles.profileScrollContent}
                showsVerticalScrollIndicator={false}
              >
                {/* Profile Images */}
                {selectedUser.photos && selectedUser.photos.length > 0 && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.photosContainer}
                  >
                    {selectedUser.photos.map((photo, index) => (
                      <Image
                        key={index}
                        source={{ uri: photo }}
                        style={styles.profileImage}
                        resizeMode="cover"
                      />
                    ))}
                  </ScrollView>
                )}

                {/* Basic Info */}
                <View style={styles.profileSection}>
                  <Text
                    style={[styles.profileName, { color: theme.textColor }]}
                  >
                    {selectedUser.name}, {selectedUser.age}
                  </Text>
                  <Text
                    style={[styles.profileLocation, { color: theme.textColor }]}
                  >
                    📍 {selectedUser.city}
                  </Text>
                </View>

                {/* Bio */}
                {selectedUser.bio && (
                  <View style={styles.profileSection}>
                    <Text
                      style={[styles.sectionTitle, { color: theme.textColor }]}
                    >
                      About
                    </Text>
                    <Text
                      style={[styles.profileBio, { color: theme.textColor }]}
                    >
                      {selectedUser.bio}
                    </Text>
                  </View>
                )}

                {/* Interests */}
                {selectedUser.interests &&
                  selectedUser.interests.length > 0 && (
                    <View style={styles.profileSection}>
                      <Text
                        style={[
                          styles.sectionTitle,
                          { color: theme.textColor },
                        ]}
                      >
                        Interests
                      </Text>
                      <View style={styles.interestsContainer}>
                        {selectedUser.interests.map((interest, index) => (
                          <View
                            key={index}
                            style={[
                              styles.interestTag,
                              { backgroundColor: theme.buttonBackground },
                            ]}
                          >
                            <Text
                              style={{ color: theme.buttonText, fontSize: 12 }}
                            >
                              {interest}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                {/* Personality Traits */}
                {selectedUser.personalityTraits &&
                  Object.keys(selectedUser.personalityTraits).length > 0 && (
                    <View style={styles.profileSection}>
                      <Text
                        style={[styles.sectionTitle, { color: theme.textColor }]}
                      >
                        Personality Traits
                      </Text>
                      <View style={styles.interestsContainer}>
                        {Object.entries(selectedUser.personalityTraits).map(
                          ([traitName, traitValue]) => (
                            <View
                              key={traitName}
                              style={[
                                styles.interestTag,
                                { backgroundColor: theme.buttonBackground },
                              ]}
                            >
                              <Text
                                style={{ color: theme.buttonText, fontSize: 12 }}
                              >
                                {traitName.charAt(0).toUpperCase() +
                                  traitName.slice(1)}
                                : {Math.round(traitValue as number)}%
                              </Text>
                            </View>
                          )
                        )}
                      </View>
                    </View>
                  )}

                {/* Gender */}
                {selectedUser.gender && (
                  <View style={styles.profileSection}>
                    <Text
                      style={[styles.sectionTitle, { color: theme.textColor }]}
                    >
                      Gender
                    </Text>
                    <Text
                      style={[styles.profileDetail, { color: theme.textColor }]}
                    >
                      {selectedUser.gender}
                    </Text>
                  </View>
                )}

                {/* Sexuality */}
                {selectedUser.sexuality && (
                  <View style={styles.profileSection}>
                    <Text
                      style={[styles.sectionTitle, { color: theme.textColor }]}
                    >
                      Sexuality
                    </Text>
                    <Text
                      style={[styles.profileDetail, { color: theme.textColor }]}
                    >
                      {selectedUser.sexuality}
                    </Text>
                  </View>
                )}

                {/* MBTI */}
                {selectedUser.mbti && (
                  <View style={styles.profileSection}>
                    <Text
                      style={[styles.sectionTitle, { color: theme.textColor }]}
                    >
                      MBTI
                    </Text>
                    <Text
                      style={[styles.profileDetail, { color: theme.textColor }]}
                    >
                      {selectedUser.mbti}
                    </Text>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  lockedContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
    borderRadius: 15,
    marginTop: 20,
  },
  lockedIcon: {
    fontSize: 48,
    marginBottom: 20,
  },
  lockedTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 15,
    textAlign: "center",
  },
  lockedText: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
  },
  searchContainer: {
    padding: 15,
    borderRadius: 25,
    marginVertical: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  searchInput: {
    fontSize: 16,
    paddingVertical: 0,
  },
  scrollContainer: {
    flex: 1,
  },
  categoryContainer: {
    marginBottom: 25,
  },
  categoryTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 15,
  },
  userCard: {
    width: 280,
    marginRight: 15,
    borderRadius: 15,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  userCardContent: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 5,
  },
  userCity: {
    fontSize: 14,
    marginBottom: 10,
    opacity: 0.8,
  },
  userBio: {
    fontSize: 14,
    lineHeight: 20,
  },
  showMoreButton: {
    width: 120,
    height: 120,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  showMoreText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    maxHeight: "80%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  closeArea: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  closeButtonText: {
    fontSize: 18,
    fontWeight: "bold",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
  },
  headerSpacer: {
    width: 40,
  },
  profileScrollContent: {
    padding: 20,
  },
  photosContainer: {
    marginBottom: 20,
  },
  profileImage: {
    width: 300,
    height: 300,
    borderRadius: 15,
    marginRight: 10,
  },
  profileSection: {
    marginBottom: 25,
  },
  profileName: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 5,
  },
  profileLocation: {
    fontSize: 16,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
  },
  profileBio: {
    fontSize: 16,
    lineHeight: 24,
  },
  profileDetail: {
    fontSize: 16,
  },
  interestsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  interestTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    margin: 4,
  },
});

export default DiscoverScreen;
