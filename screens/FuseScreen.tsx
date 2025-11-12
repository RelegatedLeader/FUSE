import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Animated,
  Alert,
  Dimensions,
  FlatList,
  PanResponder,
} from "react-native";
import { useWallet } from "../contexts/WalletContext";
import { useTheme } from "../contexts/ThemeContext";
import { MatchingEngine } from "../utils/matchingEngine";
import AsyncStorage from "@react-native-async-storage/async-storage";
import CryptoJS from "crypto-js";

interface User {
  address: string;
  name: string;
  age: number;
  city: string;
  bio: string;
  photos: string[];
  compatibilityScore?: number;
  skipped?: boolean;
}

export default function FuseScreen() {
  const { address } = useWallet();
  const { theme } = useTheme();
  const [users, setUsers] = useState<User[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showBio, setShowBio] = useState(false);
  const fuseAnim = useState(new Animated.Value(0))[0];
  const flatListRef = useRef<FlatList<User>>(null);

  // Track which users have been skipped
  const [skippedUsers, setSkippedUsers] = useState<Set<string>>(new Set());

  const loadUserPhotos = async (userAddress: string): Promise<string[]> => {
    try {
      const stored = await AsyncStorage.getItem(`photos_${userAddress}`);
      if (stored) {
        const decrypted = CryptoJS.AES.decrypt(stored, userAddress).toString(
          CryptoJS.enc.Utf8
        );
        return JSON.parse(decrypted);
      }
    } catch (error) {
      console.error("Error loading photos for user:", userAddress, error);
    }
    return [];
  };

  useEffect(() => {
    const fetchMatches = async () => {
      if (!address) return;

      try {
        console.log("Fetching matches for user:", address);

        // First check if user has migrated their profile to Firebase
        const { initializeFirebaseAuth } = await import("../utils/firebase");
        await initializeFirebaseAuth();

        const { FirebaseService } = await import("../utils/firebaseService");
        await FirebaseService.initializeUser(address);
        const userProfile = await FirebaseService.getUserProfile(address);

        if (!userProfile) {
          console.log("User profile not found in Firebase - needs migration");
          setUsers([]);
          return;
        }

        const matches = await MatchingEngine.findMatchesForUser(address);
        console.log("Found matches:", matches.length);

        // Convert MatchResult to User format
        const formattedUsers: User[] = [];
        for (const match of matches.filter(
          (match) => !skippedUsers.has(match.address)
        )) {
          console.log("Processing match:", match.address, match.profile);

          // Calculate age from birthdate
          let age = 25; // default
          if (match.profile?.birthdate) {
            try {
              // Handle MM/DD/YYYY format
              const [month, day, year] = match.profile.birthdate.split("/");
              const birthDate = new Date(
                parseInt(year),
                parseInt(month) - 1,
                parseInt(day)
              );
              const today = new Date();
              age = today.getFullYear() - birthDate.getFullYear();
              const monthDiff = today.getMonth() - birthDate.getMonth();
              if (
                monthDiff < 0 ||
                (monthDiff === 0 && today.getDate() < birthDate.getDate())
              ) {
                age--;
              }
            } catch (error) {
              console.warn("Error parsing birthdate:", match.profile.birthdate);
            }
          }

          // Format name from firstName and lastName
          const name =
            match.profile?.firstName && match.profile?.lastName
              ? `${match.profile.firstName} ${match.profile.lastName}`
              : match.profile?.firstName ||
                match.profile?.lastName ||
                "Unknown User";

          // Load photos from local storage
          const photos = await loadUserPhotos(match.address);

          const userData: User = {
            address: match.address,
            name: name,
            age: age,
            city: match.profile?.location || "Unknown",
            bio:
              match.profile?.bio ||
              match.profile?.traits?.bio ||
              "This user hasn't written a bio yet",
            photos: photos,
            compatibilityScore: match.compatibilityScore,
            skipped: false,
          };

          console.log("Formatted user data:", userData);
          formattedUsers.push(userData);
        }

        setUsers(formattedUsers);
      } catch (error) {
        console.error("Error fetching matches:", error);
        Alert.alert(
          "Error",
          "Failed to load potential matches. Please try again."
        );
        setUsers([]);
      }
    };

    fetchMatches();
  }, [address, skippedUsers]);

  const handleFuse = (userAddress: string) => {
    // Animate fusing
    Animated.sequence([
      Animated.timing(fuseAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(fuseAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start(() => {
      Alert.alert("Fused!", "You have matched with this user!");
      // Remove this user from the list (they've been matched)
      setUsers((prev) => prev.filter((user) => user.address !== userAddress));
    });
  };

  const handleSkip = (userAddress: string) => {
    // Mark user as skipped
    setSkippedUsers((prev) => new Set(Array.from(prev).concat(userAddress)));
    // Remove from current list
    setUsers((prev) => prev.filter((user) => user.address !== userAddress));
  };

  interface UserCardProps {
    user: User;
    onFuse: (address: string) => void;
    onSkip: (address: string) => void;
    theme: any;
    fuseAnim: Animated.Value;
  }

  const UserCard: React.FC<UserCardProps> = ({
    user,
    onFuse,
    onSkip,
    theme,
    fuseAnim,
  }) => {
    const pan = useRef(new Animated.ValueXY()).current;
    const scrollViewRef = useRef<ScrollView>(null);
    const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

    const panResponder = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (evt, gestureState) => {
        if (Math.abs(gestureState.dx) > 120) {
          // Swipe threshold
          const direction = gestureState.dx > 0 ? "right" : "left";
          Animated.spring(pan, {
            toValue: {
              x: direction === "right" ? 500 : -500,
              y: gestureState.dy,
            },
            useNativeDriver: false,
          }).start(() => {
            if (direction === "right") {
              onFuse(user.address);
            } else {
              onSkip(user.address);
            }
            pan.setValue({ x: 0, y: 0 });
          });
        } else {
          // Return to center
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false,
          }).start();
        }
      },
    });

    const handleScroll = (event: any) => {
      const slideSize = Dimensions.get("window").width * 0.4;
      const index = Math.round(event.nativeEvent.contentOffset.x / slideSize);
      setCurrentPhotoIndex(index);
    };

    const scrollToPhoto = (index: number) => {
      if (scrollViewRef.current) {
        const slideSize = Dimensions.get("window").width * 0.4;
        scrollViewRef.current.scrollTo({
          x: index * slideSize,
          animated: true,
        });
      }
    };

    return (
      <Animated.View
        style={[
          styles.card,
          { backgroundColor: theme?.card?.backgroundColor || "#ffffff" },
          {
            transform: [{ translateX: pan.x }, { translateY: pan.y }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        {/* User Image */}
        <View style={styles.imageContainer}>
          {user.photos && user.photos.length > 0 ? (
            <View style={styles.photoCarousel}>
              <ScrollView
                ref={scrollViewRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={handleScroll}
                scrollEventThrottle={16}
                style={styles.photoScrollView}
              >
                {user.photos.map((photo, index) => (
                  <Image
                    key={index}
                    source={{ uri: photo }}
                    style={styles.userImage}
                  />
                ))}
              </ScrollView>
              {user.photos.length > 1 && (
                <View style={styles.photoIndicators}>
                  {user.photos.map((_, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.photoIndicator,
                        {
                          backgroundColor:
                            index === currentPhotoIndex ? "#007AFF" : "#ccc",
                        },
                      ]}
                      onPress={() => scrollToPhoto(index)}
                    />
                  ))}
                </View>
              )}
            </View>
          ) : (
            <View
              style={[
                styles.placeholderImage,
                { backgroundColor: theme?.buttonBackground || "#8b9dc3" },
              ]}
            >
              <Text
                style={[
                  { color: theme?.textColor || "#333" },
                  styles.placeholderEmoji,
                ]}
              >
                {String("👤")}
              </Text>
            </View>
          )}
        </View>

        {/* User Info */}
        <View style={styles.userInfo}>
          <Text style={[{ color: theme?.textColor || "#333" }, styles.name]}>
            {String(user.name || "Unknown User")}, {String(user.age || "N/A")}
          </Text>
          <Text
            style={[{ color: theme?.textColor || "#666" }, styles.location]}
          >
            {String("Location: " + (user.city || "Unknown Location"))}
          </Text>
          {user.compatibilityScore !== undefined &&
            user.compatibilityScore !== null && (
              <Text
                style={[
                  { color: theme?.textColor || "#666" },
                  styles.compatibility,
                ]}
              >
                {String(
                  "Compatibility: " + Math.round(user.compatibilityScore) + "%"
                )}
              </Text>
            )}
          <Text style={[{ color: theme?.textColor || "#666" }, styles.bio]}>
            {String(user.bio || "No bio available")}
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            onPress={() => onFuse(user.address)}
            style={[styles.fuseButton, { backgroundColor: "#28a745" }]}
          >
            <Animated.Text
              style={[
                styles.buttonText,
                {
                  transform: [
                    {
                      scale: fuseAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.2],
                      }),
                    },
                  ],
                },
              ]}
            >
              Fuse & Connect
            </Animated.Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  };

  if (!address) {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.backgroundColor }]}
      >
        <Text style={[styles.centerText, { color: theme.textColor }]}>
          Please connect your wallet to start matching!
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme?.backgroundColor || "#bfcafd" },
      ]}
    >
      <Text style={[styles.title, { color: theme?.textColor || "#333" }]}>
        Find Your Fuse
      </Text>

      {users.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text
            style={[styles.centerText, { color: theme?.textColor || "#333" }]}
          >
            {address
              ? "No potential matches yet.\nMake sure you've migrated your profile in Settings first!\n\nOnce migrated, you'll start seeing other users."
              : "No more potential matches right now.\nCheck back later or invite friends to join!"}
          </Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={users}
          renderItem={({ item, index }) => {
            return (
              <UserCard
                user={item}
                onFuse={handleFuse}
                onSkip={handleSkip}
                theme={theme}
                fuseAnim={fuseAnim}
              />
            );
          }}
          keyExtractor={(item) => item.address}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContainer}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContainer: { alignItems: "center", padding: 20 },
  card: {
    width: Dimensions.get("window").width * 0.85,
    maxWidth: 350,
    minHeight: Dimensions.get("window").height * 0.5,
    maxHeight: Dimensions.get("window").height * 0.7,
    backgroundColor: "white",
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    justifyContent: "space-between",
  },
  leftTap: {
    position: "absolute",
    left: 10,
    top: 10,
    backgroundColor: "lightgray",
    padding: 5,
    borderRadius: 5,
  },
  userInfo: { alignItems: "center" },
  name: { fontSize: 24, fontWeight: "bold", textAlign: "center" },
  compatibility: {
    fontSize: 16,
    fontWeight: "600",
    marginTop: 5,
    textAlign: "center",
  },
  bio: {
    marginTop: 10,
    fontStyle: "italic",
    textAlign: "center",
    lineHeight: 20,
  },
  fuseButton: {
    marginTop: 20,
    backgroundColor: "blue",
    padding: 15,
    borderRadius: 10,
  },
  fuseText: { color: "white", fontSize: 18 },
  skipButton: {
    padding: 15,
    backgroundColor: "gray",
    borderRadius: 10,
    flex: 1,
    marginRight: 10,
  },
  // New styles for card-based UI
  imageContainer: {
    alignItems: "center",
    marginBottom: 15,
  },
  userImage: {
    width: Dimensions.get("window").width * 0.4,
    height: Dimensions.get("window").width * 0.4,
    maxWidth: 200,
    maxHeight: 200,
    borderRadius: 0, // Square instead of circular
    borderWidth: 3,
    borderColor: "#e1e5e9",
  },
  placeholderImage: {
    width: Dimensions.get("window").width * 0.4,
    height: Dimensions.get("window").width * 0.4,
    maxWidth: 200,
    maxHeight: 200,
    borderRadius: 0, // Square instead of circular
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#e1e5e9",
  },
  placeholderEmoji: {
    fontSize: Dimensions.get("window").width * 0.15,
  },
  location: {
    fontSize: 16,
    marginTop: 5,
    textAlign: "center",
  },
  actionButtons: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 20,
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
  },
  centerText: {
    fontSize: 18,
    textAlign: "center",
    lineHeight: 24,
  },
  debugText: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 10,
    fontWeight: "bold",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
    marginVertical: 20,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  listContainer: {
    paddingVertical: 20,
    paddingHorizontal: 10,
    alignItems: "center",
  },
  separator: {
    height: 15,
  },
  photoCarousel: {
    position: "relative",
  },
  photoScrollView: {
    width: Dimensions.get("window").width * 0.4,
    height: Dimensions.get("window").width * 0.4,
  },
  photoIndicators: {
    position: "absolute",
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  photoIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 2,
  },
  photoNavButton: {
    position: "absolute",
    top: "50%",
    transform: [{ translateY: -15 }],
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  leftNavButton: {
    left: 10,
  },
  rightNavButton: {
    right: 10,
  },
  navButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
});
