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
} from "react-native";
import { useWallet } from "../contexts/WalletContext";
import { useTheme } from "../contexts/ThemeContext";
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
  personalityTraits?: string[];
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

export default function DiscoverScreen() {
  const { address } = useWallet();
  const { theme } = useTheme();
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchPlaceholder, setSearchPlaceholder] = useState("Describe your connection");
  const [allUsers, setAllUsers] = useState<DiscoverUser[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const scrollViewRef = useRef<ScrollView>(null);

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
      if (!address || !isUnlocked) return;

      try {
        // Load user's own profile
        const userData = await getUserData(address);
        const firebaseProfile = await FirebaseService.getUserProfile(address);
        setUserProfile({
          ...userData,
          ...firebaseProfile,
        });

        // For now, load some mock users (in real app, this would be all users minus matches/blocked)
        // TODO: Replace with real user discovery algorithm
        const mockUsers: DiscoverUser[] = [
          {
            address: "0x001",
            name: "Sarah",
            age: 26,
            city: "New York",
            bio: "Creative artist who loves painting and hiking. Looking for someone who appreciates nature and art.",
            photos: [],
            mbti: "ENFP",
            gender: "female",
            sexuality: "bisexual",
            personalityTraits: ["Creative", "Adventurous", "Empathetic"],
            interests: ["Art", "Hiking", "Nature"],
          },
          {
            address: "0x002",
            name: "Mike",
            age: 29,
            city: "Los Angeles",
            bio: "Tech entrepreneur and fitness enthusiast. Love coding, gym, and good conversations.",
            photos: [],
            mbti: "INTJ",
            gender: "male",
            sexuality: "straight",
            personalityTraits: ["Analytical", "Ambitious", "Honest"],
            interests: ["Technology", "Fitness", "Coding"],
          },
          {
            address: "0x003",
            name: "Jamie",
            age: 24,
            city: "Austin",
            bio: "Music lover and foodie. Always exploring new restaurants and live shows.",
            photos: [],
            mbti: "ESFP",
            gender: "non-binary",
            sexuality: "pansexual",
            personalityTraits: ["Energetic", "Social", "Curious"],
            interests: ["Music", "Food", "Travel"],
          },
          // Add more mock users as needed
        ];

        setAllUsers(mockUsers);
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
          users: allUsers.filter(user =>
            user.city === userProfile.location ||
            user.age === userProfile.age ||
            (user.interests && userProfile.interests &&
             user.interests.some(interest => userProfile.interests?.includes(interest)))
          ).slice(0, 20),
          shownCount: 3,
        },
        {
          id: "compatible",
          title: "More Compatible with",
          users: allUsers.filter(user =>
            (user.mbti && userProfile.mbti && user.mbti !== userProfile.mbti) ||
            (user.personalityTraits && userProfile.personalityTraits &&
             user.personalityTraits.some(trait => userProfile.personalityTraits?.includes(trait)))
          ).slice(0, 20),
          shownCount: 3,
        },
        {
          id: "matches-vibe",
          title: "Matches your vibe",
          users: allUsers.filter(user =>
            user.bio && userProfile.bio &&
            (user.bio.toLowerCase().includes("creative") && userProfile.bio.toLowerCase().includes("art") ||
             user.bio.toLowerCase().includes("tech") && userProfile.bio.toLowerCase().includes("coding"))
          ).slice(0, 20),
          shownCount: 3,
        },
        {
          id: "enjoys-what-you-do",
          title: "Enjoys what you do",
          users: allUsers.filter(user =>
            user.interests && userProfile.interests &&
            user.interests.some(interest =>
              userProfile.interests?.some((userInterest: string) =>
                userInterest.toLowerCase().includes(interest.toLowerCase().split(' ')[0])
              )
            )
          ).slice(0, 20),
          shownCount: 3,
        },
        {
          id: "new-in-area",
          title: "New in your area",
          users: allUsers.filter(user =>
            user.city === userProfile.location
          ).slice(0, 20),
          shownCount: 3,
        },
        {
          id: "adventure-seekers",
          title: "Adventure seekers",
          users: allUsers.filter(user =>
            user.interests && (user.interests.includes("Travel") || user.interests.includes("Hiking"))
          ).slice(0, 20),
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
    setCategories(prevCategories =>
      prevCategories.map(category =>
        category.id === categoryId
          ? { ...category, shownCount: Math.min(category.shownCount + 5, category.users.length) }
          : category
      )
    );
  };

  const handleUserPress = (user: DiscoverUser) => {
    // TODO: Navigate to user profile or start conversation
    Alert.alert("User Selected", `View profile for ${user.name}?`);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    // TODO: Implement search algorithm based on bio, traits, etc.
    // For now, just filter by name or bio containing the query
    if (query.trim()) {
      const filteredUsers = allUsers.filter(user =>
        user.name.toLowerCase().includes(query.toLowerCase()) ||
        user.bio.toLowerCase().includes(query.toLowerCase()) ||
        (user.interests && user.interests.some(interest =>
          interest.toLowerCase().includes(query.toLowerCase())
        ))
      );
      // TODO: Show search results
      console.log("Search results:", filteredUsers);
    }
  };

  if (!isUnlocked) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
        <Text style={theme.title}>Discover</Text>
        <View style={[styles.lockedContainer, { backgroundColor: theme.card.backgroundColor }]}>
          <Text style={[styles.lockedIcon, { color: theme.textColor }]}>🔒</Text>
          <Text style={[styles.lockedTitle, { color: theme.textColor }]}>
            Discover Locked
          </Text>
          <Text style={[styles.lockedText, { color: theme.textColor }]}>
            Fuse with at least 4 people to unlock the Discover feature and find your perfect connections!
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <Text style={theme.title}>Discover</Text>

      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: theme.card.backgroundColor }]}>
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
                  style={[styles.userCard, { backgroundColor: theme.card.backgroundColor }]}
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
                      {item.bio.length > 60 ? item.bio.substring(0, 60) + "..." : item.bio}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
              showsHorizontalScrollIndicator={false}
              ListFooterComponent={
                category.shownCount < category.users.length ? (
                  <TouchableOpacity
                    style={[styles.showMoreButton, { backgroundColor: theme.buttonBackground }]}
                    onPress={() => handleShowMore(category.id)}
                  >
                    <Text style={[styles.showMoreText, { color: theme.buttonText }]}>
                      Show More
                    </Text>
                  </TouchableOpacity>
                ) : null
              }
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

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
});
