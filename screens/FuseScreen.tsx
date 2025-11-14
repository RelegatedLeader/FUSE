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

const AnimatedTouchableOpacity =
  Animated.createAnimatedComponent(TouchableOpacity);

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
  const [isLoading, setIsLoading] = useState(true); // Add loading state
  const fuseAnim = useState(new Animated.Value(0))[0];
  const flatListRef = useRef<FlatList<User>>(null);

  // Track which users have been skipped
  const [skippedUsers, setSkippedUsers] = useState<Set<string>>(new Set());

  // Full-screen image viewer state
  const [fullScreenImageVisible, setFullScreenImageVisible] = useState(false);
  const [fullScreenImageUri, setFullScreenImageUri] = useState<string>("");
  const [fullScreenImageIndex, setFullScreenImageIndex] = useState(0);
  const [fullScreenImages, setFullScreenImages] = useState<string[]>([]);

  // Rocket loading animation
  const rocketRotation = useState(new Animated.Value(0))[0];
  const rocketScale = useState(new Animated.Value(1))[0];
  const trailOpacity1 = useState(new Animated.Value(1))[0];
  const trailOpacity2 = useState(new Animated.Value(0.7))[0];
  const trailOpacity3 = useState(new Animated.Value(0.4))[0];

  // Start rocket animation when loading
  useEffect(() => {
    if (isLoading) {
      // Continuous rotation
      Animated.loop(
        Animated.timing(rocketRotation, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        })
      ).start();

      // Pulsing scale effect
      Animated.loop(
        Animated.sequence([
          Animated.timing(rocketScale, {
            toValue: 1.2,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(rocketScale, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Twinkling trail particles
      const animateTrail = (trailAnim: Animated.Value, delay: number) => {
        Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(trailAnim, {
              toValue: 1,
              duration: 500,
              useNativeDriver: true,
            }),
            Animated.timing(trailAnim, {
              toValue: 0.3,
              duration: 500,
              useNativeDriver: true,
            }),
          ])
        ).start();
      };

      animateTrail(trailOpacity1, 0);
      animateTrail(trailOpacity2, 200);
      animateTrail(trailOpacity3, 400);
    } else {
      rocketRotation.setValue(0);
      rocketScale.setValue(1);
      trailOpacity1.setValue(1);
      trailOpacity2.setValue(0.7);
      trailOpacity3.setValue(0.4);
    }
  }, [isLoading, rocketRotation, rocketScale, trailOpacity1, trailOpacity2, trailOpacity3]);

  const loadUserPhotos = async (userAddress: string): Promise<string[]> => {
    try {
      // Initialize Firebase for the target user
      const { FirebaseService } = await import("../utils/firebaseService");
      await FirebaseService.initializeUser(userAddress);

      // Get photo URLs from Firebase - images are now stored unencrypted
      const photoUrls = await FirebaseService.getUserPhotoUrls(userAddress);

      // Return URLs directly since images are stored unencrypted
      console.log(`Loaded ${photoUrls.length} photos for user:`, userAddress);
      return photoUrls;
    } catch (error) {
      console.error("Error loading photos for user:", userAddress, error);
      return [];
    }
  };

  useEffect(() => {
    const fetchMatches = async () => {
      if (!address) return;

      try {
        setIsLoading(true); // Start loading
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
          setIsLoading(false);
          return;
        }

        const matches = await MatchingEngine.findMatchesForUser(address);
        console.log("Found matches:", matches.length);

        // Convert MatchResult to User format - optimize by processing in parallel
        const formattedUsers: User[] = [];
        const photoPromises = matches
          .filter((match) => !skippedUsers.has(match.address))
          .map(async (match) => {
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
            return userData;
          });

        // Wait for all photo loading to complete in parallel
        const results = await Promise.all(photoPromises);
        formattedUsers.push(...results);

        setUsers(formattedUsers);
        setIsLoading(false); // Stop loading
      } catch (error) {
        console.error("Error fetching matches:", error);
        Alert.alert(
          "Error",
          "Failed to load potential matches. Please try again."
        );
        setUsers([]);
        setIsLoading(false);
      }
    };

    fetchMatches();
  }, [address, skippedUsers]);

  const handleFuse = async (userAddress: string) => {
    if (!address) return;

    // Find the user data
    const user = users.find((u) => u.address === userAddress);
    if (!user) return;

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
    ]).start(async () => {
      // Create connection request for the other user
      const connectionRequest = {
        address: address, // Current user is requesting connection
        name: "Anonymous", // For privacy, we'll use anonymous until accepted
        age: 0, // Will be filled when profile is viewed
        city: "Unknown",
        bio: "Someone wants to connect with you!",
        timestamp: new Date(),
        requesterAddress: address,
        targetAddress: userAddress,
      };

      try {
        // Load existing requests for the target user
        const existingRequestsData = await AsyncStorage.getItem(
          `fuse_requests_${userAddress}`
        );
        let existingRequests = [];
        if (existingRequestsData) {
          const decrypted = CryptoJS.AES.decrypt(
            existingRequestsData,
            userAddress
          ).toString(CryptoJS.enc.Utf8);
          existingRequests = JSON.parse(decrypted);
        }

        // Add new request
        existingRequests.push(connectionRequest);

        // Save back to storage
        const encrypted = CryptoJS.AES.encrypt(
          JSON.stringify(existingRequests),
          userAddress
        ).toString();
        await AsyncStorage.setItem(`fuse_requests_${userAddress}`, encrypted);

        Alert.alert(
          "Request Sent!",
          "Your connection request has been sent. Check back later to see if they accept!"
        );
      } catch (error) {
        console.error("Error sending connection request:", error);
        Alert.alert(
          "Error",
          "Failed to send connection request. Please try again."
        );
      }

      // Remove this user from the list
      setUsers((prev) => prev.filter((user) => user.address !== userAddress));
    });
  };

  const handleSkip = (userAddress: string) => {
    // Mark user as skipped
    setSkippedUsers((prev) => new Set(Array.from(prev).concat(userAddress)));
    // Remove from current list
    setUsers((prev) => prev.filter((user) => user.address !== userAddress));
  };

  const openFullScreenImage = (
    uri: string,
    index: number,
    images: string[]
  ) => {
    setFullScreenImageUri(uri);
    setFullScreenImageIndex(index);
    setFullScreenImages(images);
    setFullScreenImageVisible(true);
  };

  const closeFullScreenImage = () => {
    setFullScreenImageVisible(false);
    setFullScreenImageUri("");
    setFullScreenImageIndex(0);
    setFullScreenImages([]);
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
      onStartShouldSetPanResponder: (evt, gestureState) => {
        // Only respond to pan gestures that are more vertical than horizontal
        // This allows horizontal scrolling in the photo carousel
        return Math.abs(gestureState.dx) < Math.abs(gestureState.dy);
      },
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
      const slideSize = 300; // Updated to match new image width
      const index = Math.round(event.nativeEvent.contentOffset.x / slideSize);
      setCurrentPhotoIndex(index);
    };

    const scrollToPhoto = (index: number) => {
      if (scrollViewRef.current) {
        const slideSize = 300; // Updated to match new image width
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
                showsHorizontalScrollIndicator={true}
                onScroll={handleScroll}
                scrollEventThrottle={16}
                style={styles.photoScrollView}
                snapToInterval={300}
                decelerationRate="fast"
                contentContainerStyle={{ alignItems: "center" }}
                bounces={false}
                scrollEnabled={true}
              >
                {user.photos.map((photo, index) => (
                  <TouchableOpacity
                    key={index}
                    onPress={() =>
                      openFullScreenImage(photo, index, user.photos)
                    }
                  >
                    <Image source={{ uri: photo }} style={styles.photoImage} />
                  </TouchableOpacity>
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
          <ScrollView
            style={styles.bioScrollView}
            showsVerticalScrollIndicator={true}
            bounces={false}
          >
            <Text style={[{ color: theme?.textColor || "#666" }, styles.bio]}>
              {String(user.bio || "No bio available")}
            </Text>
          </ScrollView>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <AnimatedTouchableOpacity
            onPress={() => onFuse(user.address)}
            style={[
              styles.fuseButton,
              {
                backgroundColor: fuseAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["#ff4757", "#ff3838"],
                }),
                shadowColor: fuseAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["#ff4757", "#ff6b6b"],
                }),
                shadowOpacity: fuseAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.3, 0.8],
                }),
                shadowRadius: fuseAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [5, 15],
                }),
                elevation: fuseAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [5, 15],
                }),
                transform: [
                  {
                    scale: fuseAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.05],
                    }),
                  },
                ],
              },
            ]}
          >
            <Animated.Text
              style={[
                styles.buttonText,
                {
                  transform: [
                    {
                      scale: fuseAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.3],
                      }),
                    },
                    {
                      rotate: fuseAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ["0deg", "5deg"],
                      }),
                    },
                  ],
                  color: fuseAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["#ffffff", "#ff6b6b"],
                  }),
                  textShadowColor: fuseAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["transparent", "rgba(255, 107, 107, 0.8)"],
                  }),
                  textShadowOffset: { width: 0, height: 0 },
                  textShadowRadius: fuseAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 10],
                  }),
                },
              ]}
            >
              FUSE
            </Animated.Text>
          </AnimatedTouchableOpacity>
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

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Animated.View
            style={[
              styles.rocketContainer,
              {
                transform: [
                  {
                    rotate: rocketRotation.interpolate({
                      inputRange: [0, 1],
                      outputRange: ["0deg", "360deg"],
                    }),
                  },
                  {
                    scale: rocketScale,
                  },
                ],
              },
            ]}
          >
            <Text style={styles.rocketEmoji}>🚀</Text>
            <View style={styles.rocketTrail}>
              <Animated.Text style={[styles.trailParticle, { opacity: trailOpacity1 }]}>✨</Animated.Text>
              <Animated.Text style={[styles.trailParticle, { opacity: trailOpacity2 }]}>💫</Animated.Text>
              <Animated.Text style={[styles.trailParticle, { opacity: trailOpacity3 }]}>⭐</Animated.Text>
            </View>
          </Animated.View>
          <Text style={[styles.loadingText, { color: theme?.textColor || "#333" }]}>
            Finding your perfect matches...
          </Text>
          <Text style={[styles.loadingSubtext, { color: theme?.textColor || "#666" }]}>
            This may take a moment while we analyze compatibility
          </Text>
        </View>
      ) : users.length === 0 ? (
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

      {/* Full-Screen Image Viewer */}
      {fullScreenImageVisible && (
        <View style={styles.fullScreenContainer}>
          <TouchableOpacity
            style={styles.fullScreenOverlay}
            onPress={closeFullScreenImage}
          />
          <View style={styles.fullScreenContent}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={closeFullScreenImage}
            >
              <Text style={styles.closeButtonText}>✖</Text>
            </TouchableOpacity>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.fullScreenScrollView}
            >
              {fullScreenImages.map((image, index) => (
                <Image
                  key={index}
                  source={{ uri: image }}
                  style={styles.fullScreenImage}
                />
              ))}
            </ScrollView>
            <View style={styles.fullScreenNav}>
              <TouchableOpacity
                onPress={() => {
                  const newIndex =
                    fullScreenImageIndex > 0
                      ? fullScreenImageIndex - 1
                      : fullScreenImages.length - 1;
                  setFullScreenImageIndex(newIndex);
                }}
                style={styles.navButton}
              >
                <Text style={styles.navButtonText}>‹</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  const newIndex =
                    fullScreenImageIndex < fullScreenImages.length - 1
                      ? fullScreenImageIndex + 1
                      : 0;
                  setFullScreenImageIndex(newIndex);
                }}
                style={styles.navButton}
              >
                <Text style={styles.navButtonText}>›</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContainer: { alignItems: "center", padding: 20 },
  card: {
    width: Dimensions.get("window").width * 0.95,
    maxWidth: 450,
    height: 650, // Increased height for scrollable bio
    backgroundColor: "white",
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    flexDirection: "column",
    alignItems: "stretch",
  },
  leftTap: {
    position: "absolute",
    left: 10,
    top: 10,
    backgroundColor: "lightgray",
    padding: 5,
    borderRadius: 5,
  },
  userInfo: {
    flex: 1, // Take remaining space
    justifyContent: "flex-start",
    alignItems: "center",
    paddingVertical: 5,
    paddingHorizontal: 5,
  },
  name: { fontSize: 24, fontWeight: "bold", textAlign: "center" },
  compatibility: {
    fontSize: 16,
    fontWeight: "600",
    marginTop: 5,
    textAlign: "center",
  },
  bio: {
    fontStyle: "italic",
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 8,
    fontSize: 14,
  },
  bioScrollView: {
    flex: 1, // Take remaining space in userInfo
    width: "100%",
    minHeight: 100, // Minimum height to show some content
  },
  fuseButton: {
    flex: 1,
    backgroundColor: "blue",
    padding: 12,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
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
    height: 300, // Increased for larger images
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  userImage: {
    width: 300,
    height: 300,
    maxWidth: 300,
    maxHeight: 300,
    borderRadius: 0, // Square instead of circular
    borderWidth: 3,
    borderColor: "#e1e5e9",
  },
  placeholderImage: {
    width: 300,
    height: 300,
    borderRadius: 0, // Square instead of circular
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#e1e5e9",
  },
  placeholderEmoji: {
    fontSize: Dimensions.get("window").width * 0.1,
  },
  location: {
    fontSize: 16,
    marginTop: 5,
    textAlign: "center",
  },
  actionButtons: {
    height: 50, // Fixed height for buttons
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 5,
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
    width: Dimensions.get("window").width * 0.95 - 30, // Card width minus padding
    maxWidth: 420, // Max width minus padding
    height: 300, // Increased to match image height
  },
  photoImage: {
    width: 300, // Increased from 200
    height: 300, // Increased from 200
    borderRadius: 0,
    borderWidth: 3,
    borderColor: "#e1e5e9",
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
  // Full-Screen Image Viewer styles
  fullScreenContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  fullScreenOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  fullScreenContent: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  closeButton: {
    position: "absolute",
    top: 40,
    right: 20,
    zIndex: 1001,
  },
  closeButtonText: {
    color: "white",
    fontSize: 24,
    fontWeight: "bold",
  },
  fullScreenScrollView: {
    width: "100%",
    height: "100%",
    flexDirection: "row",
  },
  fullScreenImage: {
    width: Dimensions.get("window").width,
    height: Dimensions.get("window").height,
    resizeMode: "contain",
  },
  fullScreenNav: {
    position: "absolute",
    top: "50%",
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 1001,
  },
  navButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    justifyContent: "center",
    alignItems: "center",
  },
  // Loading animation styles
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  rocketContainer: {
    marginBottom: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  rocketEmoji: {
    fontSize: 80,
    textAlign: "center",
  },
  rocketTrail: {
    position: "absolute",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    bottom: -20,
  },
  trailParticle: {
    fontSize: 20,
    marginHorizontal: 5,
    opacity: 0.8,
  },
  loadingText: {
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 10,
  },
  loadingSubtext: {
    fontSize: 16,
    textAlign: "center",
    opacity: 0.8,
  },
});
