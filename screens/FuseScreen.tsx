import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Animated,
  Alert,
  Dimensions,
  Modal,
  PanResponder,
  RefreshControl,
} from "react-native";
import {
  PanGestureHandler,
  State,
  ScrollView as GestureScrollView,
  PinchGestureHandler,
} from "react-native-gesture-handler";
import { useWallet } from "../contexts/WalletContext";
import { useTheme } from "../contexts/ThemeContext";
import { MatchingEngine } from "../utils/matchingEngine";
import {
  EnhancedMatchingEngine,
  CompatibilityResult,
} from "../utils/enhancedMatchingEngine";
import AsyncStorage from "@react-native-async-storage/async-storage";
import CryptoJS from "crypto-js";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");
const isLargeScreen = screenWidth > 768;

const AnimatedTouchableOpacity =
  Animated.createAnimatedComponent(TouchableOpacity);

interface User {
  address: string;
  name: string;
  age: number | null;
  city: string;
  bio: string;
  photos: string[];
  compatibilityScore?: number;
  compatibilityResult?: CompatibilityResult;
  skipped?: boolean;
  mbti?: string;
  gender?: string;
  sexuality?: string;
  personalityTraits?: { [key: string]: number };
}

export default function FuseScreen() {
  const { address } = useWallet();
  const { theme } = useTheme();
  const [users, setUsers] = useState<User[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showBio, setShowBio] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // Add loading state
  const fuseAnim = useState(new Animated.Value(0))[0];
  const flatListRef = useRef<FlatList<User> | null>(null);
  const fullScreenScrollRef = useRef<ScrollView>(null);
  const scrollY = new Animated.Value(0);
  const cardOpacities = useRef(new Map<string, Animated.Value>());

  // Track which users have been skipped
  const [skippedUsers, setSkippedUsers] = useState<Set<string>>(new Set());

  // Track sent requests and matches for filtering
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());
  const [matchedAddresses, setMatchedAddresses] = useState<Set<string>>(
    new Set()
  );

  // Raw matches before filtering
  const [rawMatches, setRawMatches] = useState<any[]>([]);

  // Track users who have had requests sent (for button state)
  const [requestedUsers, setRequestedUsers] = useState<Set<string>>(new Set());

  // Track incoming fuse requests for rocket indicator
  const [incomingRequests, setIncomingRequests] = useState<Set<string>>(
    new Set()
  );

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

  // Pull to refresh state
  const [refreshing, setRefreshing] = useState(false);

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
  }, [
    isLoading,
    rocketRotation,
    rocketScale,
    trailOpacity1,
    trailOpacity2,
    trailOpacity3,
  ]);

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

  const fetchMatches = async () => {
    if (!address) return;

    try {
      setIsLoading(true); // Start loading
      console.log("Fetching matches for user:", address);

      // Clear local filtering state for fresh start
      setSkippedUsers(new Set());
      setMatchedAddresses(new Set());
      setRequestedUsers(new Set());

      // Clear AsyncStorage data for fresh start
      try {
        await AsyncStorage.removeItem(`sent_requests_${address}`);
        console.log("Cleared AsyncStorage sent requests for fresh start");
      } catch (error) {
        console.warn("Error clearing AsyncStorage:", error);
      }

      // First check if user has migrated their profile to Firebase
      const { initializeFirebaseAuth } = await import("../utils/firebase");
      await initializeFirebaseAuth();

      const { FirebaseService } = await import("../utils/firebaseService");
      await FirebaseService.initializeUser(address);
      const userProfile = await FirebaseService.getUserProfile(address);

      if (!userProfile) {
        console.log(
          "User profile not found in Firebase - migrating from Polygon"
        );

        try {
          // Retrieve user data from Polygon contract
          const { getUserData } = await import("../utils/contract");
          const polygonData = await getUserData(address);

          if (polygonData && polygonData.birthdate) {
            console.log("Retrieved data from Polygon:", polygonData);

            // Convert Polygon data format to Firebase format
            const firebaseProfileData = {
              firstName: polygonData.firstName,
              lastName: polygonData.lastName,
              dob: polygonData.birthdate, // This will be stored as birthdate in Firebase
              gender: polygonData.gender,
              location: polygonData.city || polygonData.location,
              bio: polygonData.bio || polygonData.traits,
              mbti: polygonData.mbti,
              personalityTraits: {}, // Will be empty for now, can be updated later
              email: "", // Not available from Polygon data
              occupation: "", // Not available from Polygon data
              careerAspiration: "", // Not available from Polygon data
              id: polygonData.id || "",
              openEnded: "", // Not available from Polygon data
              transactionHash: "", // Not available from Polygon data
              walletAddress: address,
            };

            // Store the profile in Firebase
            await FirebaseService.storeUserProfile(
              address,
              firebaseProfileData
            );
            console.log("Successfully migrated user profile to Firebase");
          } else {
            console.log("No data found in Polygon contract for user:", address);
            setUsers([]);
            setIsLoading(false);
            return;
          }
        } catch (error) {
          console.error("Failed to migrate user profile from Polygon:", error);
          setUsers([]);
          setIsLoading(false);
          return;
        }
      }

      const matches = await MatchingEngine.findMatchesForUser(address);
      console.log("Found matches:", matches.length);
      console.log(
        "Match addresses:",
        matches.map((m) => m.address)
      );

      // Load current user's sent requests and matched users to filter them out
      let localSentRequests = new Set<string>();
      let localMatchedAddresses = new Set<string>();

      try {
        // Load sent requests from Firebase (persistent across sessions)
        const firebaseSentRequests = await FirebaseService.loadSentRequests(
          address
        );
        localSentRequests = firebaseSentRequests;
        setSentRequests(localSentRequests);
        console.log(
          "📤 Loaded sent requests from Firebase:",
          Array.from(firebaseSentRequests)
        );

        // Also load from AsyncStorage for backward compatibility (can be removed later)
        const sentRequestsData = await AsyncStorage.getItem(
          `sent_requests_${address}`
        );
        if (sentRequestsData) {
          const decrypted = CryptoJS.AES.decrypt(
            sentRequestsData,
            address
          ).toString(CryptoJS.enc.Utf8);
          const requests: string[] = JSON.parse(decrypted);
          const asyncStorageRequests = new Set(requests);
          // Merge with Firebase requests
          const mergedRequests = new Set<string>([
            ...Array.from(localSentRequests),
            ...Array.from(asyncStorageRequests),
          ]);
          localSentRequests = mergedRequests;
          setSentRequests(mergedRequests);
          console.log(
            "📤 Merged sent requests (Firebase + AsyncStorage):",
            Array.from(mergedRequests)
          );
        }

        // Load matched users from Firebase
        const matchedUsers = await FirebaseService.loadMatches(address);
        const addresses = matchedUsers.map((match: any) => match.address);
        localMatchedAddresses = new Set(addresses);
        setMatchedAddresses(localMatchedAddresses);
        console.log("💕 Loaded matched addresses:", addresses);
      } catch (error) {
        console.warn("Error loading sent requests and matches:", error);
        setSentRequests(new Set());
        setMatchedAddresses(new Set());
      }

      // Load incoming fuse requests for rocket indicator
      try {
        const incomingRequestsData = await FirebaseService.listenToFuseRequests(
          address,
          (requests) => {
            const requesterAddresses = requests.map(
              (req: any) => req.requesterAddress
            );
            setIncomingRequests(new Set(requesterAddresses));
          }
        );
        // Note: We don't store the unsubscribe function here as it's handled by the listener
      } catch (error) {
        console.warn("Error loading incoming requests:", error);
        setIncomingRequests(new Set());
      }

      // Convert MatchResult to User format - optimize by processing in parallel
      const formattedUsers: User[] = [];

      // Filter matches after async loading is complete and deduplicate by address
      const filteredMatches = matches
        .filter((match, index, arr) => {
          const isFirst =
            arr.findIndex((m) => m.address === match.address) === index;
          if (!isFirst) console.log("Removing duplicate match:", match.address);
          return isFirst;
        })
        .filter(
          (match) =>
            !skippedUsers.has(match.address) &&
            !localMatchedAddresses.has(match.address) &&
            !localSentRequests.has(match.address)
        );

      console.log("After filtering - skipped users:", Array.from(skippedUsers));
      console.log(
        "After filtering - matched addresses:",
        Array.from(localMatchedAddresses)
      );
      console.log("Filtered matches count:", filteredMatches.length);
      console.log(
        "Filtered match addresses:",
        filteredMatches.map((m) => m.address)
      );

      const photoPromises = filteredMatches.map(async (match) => {
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

        // Calculate compatibility score
        let compatibilityScore = 42; // fallback like DiscoverScreen
        let compatibilityResult: CompatibilityResult | undefined;
        try {
          console.log(
            `🔄 Calculating compatibility for ${match.address} vs ${address}`
          );
          compatibilityResult =
            await EnhancedMatchingEngine.calculateCompatibility(
              address,
              match.address
            );
          compatibilityScore = compatibilityResult.overallScore || 42;
          console.log(
            `✅ Compatibility result overallScore: ${compatibilityResult.overallScore}, final score: ${compatibilityScore}`
          );
          console.log(
            `✅ Compatibility result: ${JSON.stringify(compatibilityResult)}`
          );
          console.log(
            `Compatibility for ${match.address}: ${compatibilityScore}%`
          );
          // Update the match with calculated compatibility
          match.compatibilityScore = compatibilityScore;
          match.compatibilityResult = compatibilityResult;
        } catch (error) {
          console.warn(
            "Error calculating compatibility for",
            match.address,
            error
          );
          compatibilityScore = 42; // fallback
        }

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
          compatibilityScore: compatibilityScore,
          compatibilityResult: compatibilityResult,
          skipped: false,
          mbti: match.profile?.mbti,
          gender: match.profile?.gender,
          sexuality: match.profile?.sexuality,
          personalityTraits: match.profile?.personalityTraits || [],
        };

        console.log("Formatted user data:", userData);
        return userData;
      });

      // Wait for all photo loading to complete in parallel
      const results = await Promise.all(photoPromises);
      formattedUsers.push(...results);

      setRawMatches(matches); // Store raw matches for filtering
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

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMatches();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchMatches();
  }, [address]);

  // Filter and format matches whenever raw matches or filter sets change
  useEffect(() => {
    if (rawMatches.length === 0) return;

    const filterAndFormatMatches = async () => {
      try {
        const { FirebaseService } = await import("../utils/firebaseService");

        // Define calculateAge function
        const calculateAge = (birthdate: string): number | null => {
          if (!birthdate || birthdate.trim() === "") return null;
          try {
            // Parse MM/DD/YYYY format explicitly
            const parts = birthdate.split("/");
            if (parts.length !== 3) return null;

            const month = parseInt(parts[0], 10) - 1; // Month is 0-based
            const day = parseInt(parts[1], 10);
            const year = parseInt(parts[2], 10);

            if (isNaN(month) || isNaN(day) || isNaN(year)) return null;
            if (
              month < 0 ||
              month > 11 ||
              day < 1 ||
              day > 31 ||
              year < 1900 ||
              year > 2025
            )
              return null;

            const birth = new Date(year, month, day);
            if (isNaN(birth.getTime())) return null; // Invalid date

            const today = new Date();
            let age = today.getFullYear() - birth.getFullYear();
            const monthDiff = today.getMonth() - birth.getMonth();
            if (
              monthDiff < 0 ||
              (monthDiff === 0 && today.getDate() < birth.getDate())
            ) {
              age--;
            }
            return age > 0 && age < 120 ? age : null; // Sanity check
          } catch (error) {
            console.warn("Error calculating age:", error);
            return null;
          }
        };

        // Filter matches synchronously
        const filteredMatches = rawMatches
          .filter((match, index, arr) => {
            const isFirst =
              arr.findIndex((m) => m.address === match.address) === index;
            if (!isFirst)
              console.log("Removing duplicate match:", match.address);
            return isFirst;
          })
          .filter(
            (match) =>
              !skippedUsers.has(match.address) &&
              !matchedAddresses.has(match.address) &&
              !sentRequests.has(match.address)
          );

        console.log(
          "After filtering - skipped users:",
          Array.from(skippedUsers)
        );
        console.log(
          "After filtering - matched addresses:",
          Array.from(matchedAddresses)
        );
        console.log(
          "After filtering - sent requests:",
          Array.from(sentRequests)
        );
        console.log("Filtered matches count:", filteredMatches.length);
        console.log(
          "Filtered match addresses:",
          filteredMatches.map((m) => m.address)
        );

        // If no matches after filtering, set empty users
        if (filteredMatches.length === 0) {
          setUsers([]);
          return;
        }

        // Convert MatchResult to User format - optimize by processing in parallel
        const formattedUsers: User[] = [];

        const photoPromises = filteredMatches.map(async (match) => {
          console.log("Processing match:", match.address, match.profile);

          // Load photos for this user
          const photos = await FirebaseService.getUserPhotoUrls(match.address);
          console.log(
            "Loaded",
            photos.length,
            "photos for user:",
            match.address
          );

          const userData: User = {
            address: match.address,
            name: match.profile?.firstName + " " + match.profile?.lastName,
            age: calculateAge(match.profile?.birthdate),
            city: match.profile?.location || "Unknown",
            bio:
              match.profile?.bio ||
              match.profile?.traits?.bio ||
              "This user hasn't written a bio yet",
            photos: photos,
            compatibilityScore: match.compatibilityScore,
            compatibilityResult: match.compatibilityResult,
            skipped: false,
            mbti: match.profile?.mbti,
            gender: match.profile?.gender,
            sexuality: match.profile?.sexuality,
            personalityTraits: match.profile?.personalityTraits || {},
          };

          console.log("Formatted user data:", userData);
          return userData;
        });

        // Wait for all photo loading to complete in parallel
        const results = await Promise.all(photoPromises);
        formattedUsers.push(...results);

        setUsers(formattedUsers);
      } catch (error) {
        console.error("Error filtering and formatting matches:", error);
        setUsers([]);
      }
    };

    filterAndFormatMatches();
  }, [rawMatches, skippedUsers, matchedAddresses, sentRequests]);

  const handleFuse = async (userAddress: string) => {
    if (!address) return;

    // Find the user data
    const user = users.find((u) => u.address === userAddress);
    if (!user) return;

    // Prevent self-fusing
    if (address === userAddress) {
      Alert.alert("Cannot Fuse", "You cannot fuse with yourself.");
      return;
    }

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
      try {
        // Initialize Firebase auth first
        const { initializeFirebaseAuth } = await import("../utils/firebase");
        await initializeFirebaseAuth();

        // Store request in Firebase
        const { FirebaseService } = await import("../utils/firebaseService");
        await FirebaseService.initializeUser(address);

        // Get current user profile data
        const currentUserProfile = await FirebaseService.getUserProfile(
          address
        );
        const currentUserPhotos = await FirebaseService.getUserPhotoUrls(
          address
        );

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
          targetAddress: userAddress,
        };

        const isMutual = await FirebaseService.storeFuseRequest(
          userAddress,
          requestData
        );

        console.log(`Fuse request sent from ${address} to ${userAddress}`);
        console.log("Request data:", requestData);
        console.log("isMutual result:", isMutual);

        if (isMutual) {
          console.log("🎯 MUTUAL MATCH DETECTED! Storing matches...");
          // Mutual match! Store the match in Firebase for both users
          const matchDataForCurrent = {
            address: userAddress,
            name: user.name,
            age: user.age,
            city: user.city,
            bio: user.bio,
            photos: user.photos,
            mbti: user.mbti,
            gender: user.gender,
            sexuality: user.sexuality,
            personalityTraits: user.personalityTraits,
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
            // Store for current user
            console.log("💕 Storing match for current user:", address);
            await FirebaseService.storeMatch(address, matchDataForCurrent);
            // Store for the other user
            console.log("💕 Storing match for other user:", userAddress);
            await FirebaseService.storeMatch(userAddress, matchDataForOther);

            // Update local state
            setMatchedAddresses((prev) => new Set([...prev, userAddress]));

            console.log("💕 Mutual match stored for both users");
          } catch (error) {
            console.warn("Error storing mutual match:", error);
          }

          Alert.alert(
            "Mutual Fuse! 🔥❤️",
            `You and ${user.name} have fused! You're now connected.`
          );
        } else {
          console.log("📤 Regular one-way request sent");
          // Regular one-way request
          // Mark as requested but keep in list for scrolling back
          setRequestedUsers((prev) => new Set([...prev, userAddress]));
          const newSentRequests = new Set([...sentRequests, userAddress]);
          setSentRequests(newSentRequests);

          // Store sent request in Firebase for persistence
          try {
            console.log(
              "📤 Calling FirebaseService.storeSentRequest with:",
              address,
              userAddress
            );
            await FirebaseService.storeSentRequest(address, userAddress);
            console.log("📤 Sent request stored in Firebase successfully");
          } catch (error) {
            console.warn("Error storing sent request in Firebase:", error);
          }

          try {
            const encrypted = CryptoJS.AES.encrypt(
              JSON.stringify(Array.from(newSentRequests)),
              address
            ).toString();
            await AsyncStorage.setItem(`sent_requests_${address}`, encrypted);
          } catch (error) {
            console.warn("Error saving sent requests:", error);
          }
        }
      } catch (error) {
        console.error("Error sending connection request:", error);
        Alert.alert("Error", "Failed to send fuse request. Please try again.");
      }
    });
  };

  const handleSkip = (userAddress: string) => {
    // Mark user as skipped but keep in list for scrolling back
    setSkippedUsers((prev) => new Set(Array.from(prev).concat(userAddress)));
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
    hasIncomingRequest: boolean;
    requestedUsers: Set<string>;
    skippedUsers: Set<string>;
    opacity: Animated.Value;
  }

  const UserCardComponent = ({
    user,
    onFuse,
    onSkip,
    theme,
    fuseAnim,
    hasIncomingRequest,
    requestedUsers,
    skippedUsers,
    opacity,
  }: UserCardProps) => {
    const scrollViewRef = useRef<ScrollView>(null);
    const modalScrollRef = useRef<GestureScrollView>(null);
    const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [showCompatibilityModal, setShowCompatibilityModal] = useState(false);
    const [gestureY, setGestureY] = useState(0);

    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      ).start();
      return () => pulseAnim.stopAnimation();
    }, []);

    const onGestureEvent = (event: any) => {
      setGestureY(event.nativeEvent.translationY);
    };

    const onHandlerStateChange = (event: any) => {
      if (event.nativeEvent.state === State.END) {
        if (gestureY > 30) {
          setShowProfileModal(false);
        }
        setGestureY(0);
      }
    };

    const handleScroll = (event: any) => {
      const slideSize = 400; // Updated to match new image width
      const index = Math.round(event.nativeEvent.contentOffset.x / slideSize);
      setCurrentPhotoIndex(index);
    };

    const scrollToPhoto = (index: number) => {
      if (scrollViewRef.current) {
        const slideSize = 400; // Updated to match new image width
        scrollViewRef.current.scrollTo({
          x: index * slideSize,
          animated: true,
        });
      }
    };

    const viewUserProfile = () => {
      console.log("👤 Opening profile modal for user:", user);
      setShowProfileModal(true);
    };

    const generateSummary = (result: CompatibilityResult) => {
      const score = result.overallScore;
      const topFactors = result.factors.slice(0, 3).join(", ");
      if (score >= 90) {
        return `This is an exceptional match! With a ${score}% compatibility score, you share ${topFactors}. This connection has the potential to be truly transformative - don't miss this opportunity to meet someone who aligns so perfectly with your values and interests.`;
      } else if (score >= 80) {
        return `An outstanding match with ${score}% compatibility! You both excel in ${topFactors}, creating a strong foundation for a meaningful connection. This person could be the perfect complement to your personality and lifestyle.`;
      } else if (score >= 70) {
        return `A very good match at ${score}% compatibility. Your shared ${topFactors} provide a good starting point. With mutual effort and communication, this could develop into a rewarding relationship.`;
      } else if (score >= 60) {
        return `A solid match with ${score}% compatibility. While you have some differences, your ${topFactors} provide a good starting point. With open-mindedness, this could develop into a rewarding relationship.`;
      } else {
        return `A moderate match at ${score}% compatibility. Though you have differences in ${topFactors}, every connection starts somewhere. Sometimes the most unexpected pairings lead to the most interesting journeys.`;
      }
    };

    const getInsightColor = (type: string) => {
      switch (type) {
        case "strength":
          return "#4CAF50";
        case "consideration":
          return "#FF9800";
        case "opportunity":
          return "#2196F3";
        default:
          return theme.textColor;
      }
    };

    const getCategoryIcon = (category: string) => {
      switch (category) {
        case "Profile Basics":
          return "👤";
        case "Communication Style":
          return "💬";
        case "Interaction History":
          return "🤝";
        case "Personality Match":
          return "🧠";
        case "Shared Interests":
          return "🎯";
        case "Values Alignment":
          return "❤️";
        default:
          return "📊";
      }
    };

    const getScoreColor = (score: number) => {
      if (score >= 80) return "#4CAF50";
      if (score >= 60) return "#FF9800";
      return "#F44336";
    };

    const getInsightBackground = (type: string, theme: any) => {
      const baseColor = getInsightColor(type);
      return theme.isDark ? `${baseColor}20` : `${baseColor}15`; // Add transparency
    };

    const getInsightEmoji = (type: string) => {
      switch (type) {
        case "strength":
          return "💪";
        case "consideration":
          return "⚠️";
        case "opportunity":
          return "🚀";
        default:
          return "💡";
      }
    };

    return (
      <Animated.View style={{ opacity }}>
        <TouchableOpacity
          onPress={viewUserProfile}
          activeOpacity={0.8}
          style={[
            styles.compactCard,
            { backgroundColor: theme?.card?.backgroundColor || "#ffffff" },
          ]}
        >
          {/* Profile Image with Overlay Button */}
          <View style={styles.imageContainer}>
            {user.photos && user.photos.length > 0 ? (
              <View style={styles.photoCarousel}>
                <ScrollView
                  ref={scrollViewRef}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  onScroll={handleScroll}
                  scrollEventThrottle={16}
                  style={styles.photoScrollView}
                  snapToInterval={isLargeScreen ? 600 : 400}
                  snapToAlignment="start"
                  decelerationRate="fast"
                  contentContainerStyle={{ alignItems: "center" }}
                  bounces={false}
                  scrollEnabled={true}
                >
                  {user.photos.map((photo, index) => (
                    <TouchableOpacity
                      key={index}
                      activeOpacity={1}
                      onPress={() =>
                        openFullScreenImage(photo, index, user.photos)
                      }
                    >
                      <Image
                        source={{ uri: photo }}
                        style={styles.photoImage}
                      />
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
                {/* FUSE Button Overlay */}
                <View style={styles.fuseButtonOverlay}>
                  <AnimatedTouchableOpacity
                    onPress={
                      requestedUsers.has(user.address)
                        ? undefined
                        : () => onFuse(user.address)
                    }
                    disabled={requestedUsers.has(user.address)}
                    style={[
                      styles.overlayFuseButton,
                      {
                        backgroundColor: requestedUsers.has(user.address)
                          ? "#ccc"
                          : fuseAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: ["#ff6347", "#00bfff"],
                            }),
                        borderColor: requestedUsers.has(user.address)
                          ? "transparent"
                          : fuseAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: ["#00ff00", "#ff0000"],
                            }),
                        shadowOpacity: 0.8,
                        shadowRadius: 15,
                      },
                      { transform: [{ scale: pulseAnim }] },
                    ]}
                  >
                    <Animated.Text
                      style={[
                        styles.overlayButtonText,
                        {
                          color: requestedUsers.has(user.address)
                            ? "#666"
                            : fuseAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: ["#ffffff", "#ff6b6b"],
                              }),
                        },
                      ]}
                    >
                      {requestedUsers.has(user.address) ? "Request sent" : "🚀"}
                    </Animated.Text>
                  </AnimatedTouchableOpacity>
                </View>
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
                {/* FUSE Button Overlay for placeholder */}
                <View style={styles.fuseButtonOverlay}>
                  <AnimatedTouchableOpacity
                    onPress={
                      requestedUsers.has(user.address)
                        ? undefined
                        : () => onFuse(user.address)
                    }
                    disabled={requestedUsers.has(user.address)}
                    style={[
                      styles.overlayFuseButton,
                      {
                        backgroundColor: requestedUsers.has(user.address)
                          ? "#ccc"
                          : fuseAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: ["#ff6347", "#00bfff"],
                            }),
                      },
                    ]}
                  >
                    <Animated.Text
                      style={[
                        styles.overlayButtonText,
                        {
                          color: requestedUsers.has(user.address)
                            ? "#666"
                            : fuseAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: ["#ffffff", "#ff6b6b"],
                              }),
                        },
                      ]}
                    >
                      {requestedUsers.has(user.address) ? "Request sent" : "🚀"}
                    </Animated.Text>
                  </AnimatedTouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {/* Compact User Info */}
          <View style={styles.compactUserInfo}>
            <View style={styles.nameContainer}>
              <Text
                style={[
                  { color: theme?.textColor || "#333" },
                  styles.compactName,
                ]}
              >
                {String(user.name || "Unknown User")},{" "}
                {String(user.age || "N/A")}
              </Text>
              {hasIncomingRequest && (
                <Text style={styles.rocketIndicator}>🚀</Text>
              )}
              {user.compatibilityScore !== undefined &&
                user.compatibilityScore !== null && (
                  <AnimatedTouchableOpacity
                    onPress={() => setShowCompatibilityModal(true)}
                    style={[styles.compatibilityBadge, { transform: [{ scale: pulseAnim }] }]}
                  >
                    <Text style={styles.compatibilityBadgeText}>
                      🚀 {Math.round(user.compatibilityScore)}%
                    </Text>
                  </AnimatedTouchableOpacity>
                )}
            </View>

            <Text
              style={[
                { color: theme?.textColor || "#666" },
                styles.compactLocation,
              ]}
            >
              {String("📍 " + (user.city || "Unknown Location"))}
            </Text>
            <Text
              style={[{ color: theme?.textColor || "#666" }, styles.compactBio]}
              numberOfLines={isLargeScreen ? 8 : 4}
            >
              {String(user.bio || "No bio available")}
            </Text>
            <Text style={styles.tapToViewText}>Tap to view full profile</Text>
          </View>

          {/* Profile Modal */}
          <Modal
            visible={showProfileModal}
            animationType="slide"
            transparent={true}
            onRequestClose={() => setShowProfileModal(false)}
          >
            <View style={styles.modalOverlay}>
              <PanGestureHandler
                onGestureEvent={onGestureEvent}
                onHandlerStateChange={onHandlerStateChange}
                simultaneousHandlers={[modalScrollRef]}
              >
                <View style={{ flex: 1 }}>
                  <GestureScrollView
                    ref={modalScrollRef}
                    style={[
                      styles.modalContent,
                      { backgroundColor: theme.backgroundColor },
                    ]}
                    showsVerticalScrollIndicator={true}
                    bounces={true}
                    alwaysBounceVertical={true}
                    contentContainerStyle={styles.scrollContent}
                    scrollEventThrottle={16}
                  >
                    <View style={styles.modalHeader}>
                      <View style={styles.headerSpacer} />
                      <View
                        style={{ flexDirection: "row", alignItems: "center" }}
                      >
                        <Text
                          style={[
                            styles.modalTitle,
                            { color: theme.textColor },
                          ]}
                        >
                          {user.name}'s Profile
                        </Text>
                        <TouchableOpacity
                          style={[styles.closeArea, { marginLeft: 10 }]}
                          onPress={() => setShowProfileModal(false)}
                        >
                          <Text
                            style={[
                              styles.closeButtonText,
                              { color: theme.textColor },
                            ]}
                          >
                            ✕
                          </Text>
                        </TouchableOpacity>
                      </View>
                      <View style={styles.headerSpacer} />
                    </View>

                    <View style={styles.profileContent}>
                      {/* Profile Images */}
                      {user.photos && user.photos.length > 0 && (
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          style={styles.photosContainer}
                          bounces={false}
                          pagingEnabled={false}
                        >
                          {user.photos.map((photo, index) => (
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
                          style={[
                            styles.profileName,
                            { color: theme.textColor },
                          ]}
                        >
                          {user.name}, {user.age || "N/A"}
                        </Text>
                        <Text
                          style={[
                            styles.profileLocation,
                            { color: theme.textColor, opacity: 0.7 },
                          ]}
                        >
                          📍 {user.city}
                        </Text>

                        {user.bio &&
                          typeof user.bio === "string" &&
                          user.bio.trim() && (
                            <View style={styles.bioSection}>
                              <Text
                                style={[
                                  styles.bioLabel,
                                  { color: theme.textColor },
                                ]}
                              >
                                About
                              </Text>
                              <Text
                                style={[
                                  styles.bioText,
                                  { color: theme.textColor },
                                ]}
                              >
                                {user.bio}
                              </Text>
                            </View>
                          )}

                        {/* Additional Profile Fields */}
                        {user.mbti && (
                          <View style={styles.profileField}>
                            <Text
                              style={[
                                styles.fieldLabel,
                                { color: theme.textColor },
                              ]}
                            >
                              MBTI
                            </Text>
                            <Text
                              style={[
                                styles.fieldValue,
                                { color: theme.textColor },
                              ]}
                            >
                              {user.mbti}
                            </Text>
                          </View>
                        )}

                        {user.gender && (
                          <View style={styles.profileField}>
                            <Text
                              style={[
                                styles.fieldLabel,
                                { color: theme.textColor },
                              ]}
                            >
                              Gender
                            </Text>
                            <Text
                              style={[
                                styles.fieldValue,
                                { color: theme.textColor },
                              ]}
                            >
                              {user.gender}
                            </Text>
                          </View>
                        )}

                        {user.sexuality && (
                          <View style={styles.profileField}>
                            <Text
                              style={[
                                styles.fieldLabel,
                                { color: theme.textColor },
                              ]}
                            >
                              Sexuality
                            </Text>
                            <Text
                              style={[
                                styles.fieldValue,
                                { color: theme.textColor },
                              ]}
                            >
                              {user.sexuality}
                            </Text>
                          </View>
                        )}

                        {user.personalityTraits &&
                          Object.keys(user.personalityTraits).length > 0 && (
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
                                {Object.entries(user.personalityTraits).map(
                                  ([traitName, traitValue]) => (
                                    <View
                                      key={traitName}
                                      style={styles.traitTag}
                                    >
                                      <Text
                                        style={[
                                          styles.traitText,
                                          { color: theme.textColor },
                                        ]}
                                      >
                                        {traitName.charAt(0).toUpperCase() +
                                          traitName.slice(1)}
                                        : {Math.round(traitValue)}%
                                      </Text>
                                    </View>
                                  )
                                )}
                              </View>
                            </View>
                          )}

                        {user.compatibilityScore !== undefined &&
                          user.compatibilityScore !== null && (
                            <Text
                              style={[
                                { color: theme.textColor, opacity: 0.6 },
                                styles.compatibilityScore,
                              ]}
                            >
                              Compatibility:{" "}
                              {Math.round(user.compatibilityScore)}%
                            </Text>
                          )}
                      </View>
                    </View>
                  </GestureScrollView>
                </View>
              </PanGestureHandler>
            </View>
          </Modal>
          {/* Compatibility Modal */}
          <Modal
            visible={showCompatibilityModal}
            animationType="slide"
            transparent={true}
            onRequestClose={() => setShowCompatibilityModal(false)}
          >
            <View style={styles.modalOverlay}>
              <View
                style={[
                  styles.compatibilityModalContent,
                  {
                    backgroundColor: "#1a1a1a",
                    borderWidth: 1,
                    borderColor: "#333",
                  },
                ]}
              >
                <View style={styles.modalHeader}>
                  <View style={styles.headerContent}>
                    <Text style={[styles.modalTitle, { color: "#fff" }]}>
                      🚀 Compatibility Analysis
                    </Text>
                    {user.compatibilityResult && (
                      <View style={styles.scoreBadge}>
                        <Text style={styles.scoreText}>
                          {Math.round(user.compatibilityResult.overallScore)}%
                        </Text>
                      </View>
                    )}
                  </View>
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={() => setShowCompatibilityModal(false)}
                  >
                    <Text style={styles.closeButtonText}>✖</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView
                  style={styles.scrollContent}
                  contentInset={{ bottom: 20 }}
                >
                  {/* Summary */}
                  <View style={styles.summaryContainer}>
                    <Text style={[styles.summaryTitle, { color: "#fff" }]}>
                      ✨ Why Fuse with {user.name}?
                    </Text>
                    <Text style={[styles.summaryText, { color: "#fff" }]}>
                      {user.compatibilityResult
                        ? generateSummary(user.compatibilityResult)
                        : "No compatibility data available."}
                    </Text>
                  </View>
                  {/* Detailed Breakdown */}
                  {user.compatibilityResult && (
                    <View style={styles.breakdownContainer}>
                      <Text style={[styles.breakdownTitle, { color: "#fff" }]}>
                        🔍 Detailed Analysis
                      </Text>
                      {user.compatibilityResult.breakdown.map((item, index) => (
                        <View key={index} style={styles.breakdownItem}>
                          <View style={styles.breakdownHeader}>
                            <Text
                              style={[
                                styles.breakdownCategory,
                                { color: "#fff" },
                              ]}
                            >
                              {getCategoryIcon(item.category)} {item.category}
                            </Text>
                            <View
                              style={[
                                styles.scoreCircle,
                                { backgroundColor: getScoreColor(item.score) },
                              ]}
                            >
                              <Text style={styles.breakdownScore}>
                                {item.score}%
                              </Text>
                            </View>
                          </View>
                          <Text
                            style={[
                              styles.breakdownDescription,
                              { color: "#fff" },
                            ]}
                          >
                            {item.description}
                          </Text>
                          {item.factors && item.factors.length > 0 && (
                            <View style={styles.breakdownFactors}>
                              {item.factors.map((factor, idx) => (
                                <Text
                                  key={idx}
                                  style={[
                                    styles.breakdownFactor,
                                    { color: "#fff" },
                                  ]}
                                >
                                  • {factor}
                                </Text>
                              ))}
                            </View>
                          )}
                        </View>
                      ))}
                      {/* Insights */}
                      {user.compatibilityResult.insights &&
                        user.compatibilityResult.insights.length > 0 && (
                          <View style={styles.insightsContainer}>
                            <Text
                              style={[styles.insightsTitle, { color: "#fff" }]}
                            >
                              💡 Key Insights
                            </Text>
                            {user.compatibilityResult.insights.map(
                              (insight, index) => (
                                <View
                                  key={index}
                                  style={[
                                    styles.insightItem,
                                    {
                                      backgroundColor: getInsightBackground(
                                        insight.type,
                                        { isDark: true }
                                      ),
                                    },
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.insightType,
                                      { color: getInsightColor(insight.type) },
                                    ]}
                                  >
                                    {getInsightEmoji(insight.type)}{" "}
                                    {insight.type.toUpperCase()}
                                  </Text>
                                  <Text
                                    style={[
                                      styles.insightTitle,
                                      { color: "#fff" },
                                    ]}
                                  >
                                    {insight.title}
                                  </Text>
                                  <Text
                                    style={[
                                      styles.insightDescription,
                                      { color: "#fff" },
                                    ]}
                                  >
                                    {insight.description}
                                  </Text>
                                </View>
                              )
                            )}
                          </View>
                        )}
                    </View>
                  )}
                </ScrollView>
              </View>
            </View>
          </Modal>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const UserCard = React.memo(UserCardComponent);

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
              <Animated.Text
                style={[styles.trailParticle, { opacity: trailOpacity1 }]}
              >
                ✨
              </Animated.Text>
              <Animated.Text
                style={[styles.trailParticle, { opacity: trailOpacity2 }]}
              >
                💫
              </Animated.Text>
              <Animated.Text
                style={[styles.trailParticle, { opacity: trailOpacity3 }]}
              >
                ⭐
              </Animated.Text>
            </View>
          </Animated.View>
          <Text
            style={[styles.loadingText, { color: theme?.textColor || "#333" }]}
          >
            Finding your perfect matches...
          </Text>
          <Text
            style={[
              styles.loadingSubtext,
              { color: theme?.textColor || "#666" },
            ]}
          >
            This may take a moment while we analyze compatibility
          </Text>
        </View>
      ) : users.length <= 1 ? (
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
            const opacity =
              cardOpacities.current.get(item.address) ||
              (() => {
                const newOpacity = new Animated.Value(1);
                cardOpacities.current.set(item.address, newOpacity);
                return newOpacity;
              })();
            return (
              <View>
                <UserCard
                  user={item}
                  onFuse={handleFuse}
                  onSkip={handleSkip}
                  theme={theme}
                  fuseAnim={fuseAnim}
                  hasIncomingRequest={incomingRequests.has(item.address)}
                  requestedUsers={requestedUsers}
                  skippedUsers={skippedUsers}
                  opacity={opacity}
                />
              </View>
            );
          }}
          keyExtractor={(item, index) => `${item.address}-${index}`}
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
          getItemLayout={(data, index) => ({
            length: 650,
            offset: 650 * index,
            index,
          })}
          snapToInterval={Dimensions.get("window").height - 100}
          snapToAlignment="start"
          decelerationRate="fast"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          onMomentumScrollEnd={(event) => {
            const slideSize = Dimensions.get("window").height - 100;
            const index = Math.round(
              event.nativeEvent.contentOffset.y / slideSize
            );
            // Handle profile change if needed
          }}
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
              ref={fullScreenScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={Dimensions.get("window").width}
              snapToAlignment="start"
              decelerationRate="fast"
              onMomentumScrollEnd={(event) => {
                const index = Math.round(
                  event.nativeEvent.contentOffset.x /
                    Dimensions.get("window").width
                );
                setFullScreenImageIndex(index);
              }}
            >
              {fullScreenImages.map((image, index) => (
                <Image
                  key={index}
                  source={{ uri: image }}
                  style={styles.fullScreenImage}
                />
              ))}
            </ScrollView>
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
  fullScreenCard: {
    width: Dimensions.get("window").width,
    height: Dimensions.get("window").height,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 60, // Account for status bar and title
    paddingHorizontal: 20,
  },
  fullScreenImageContainer: {
    height: Dimensions.get("window").height * 0.5, // Half screen height for images
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  fullScreenPhotoScrollView: {
    width: Dimensions.get("window").width - 40, // Full width minus padding
    height: Dimensions.get("window").height * 0.5,
  },
  fullScreenPhotoImage: {
    width: Dimensions.get("window").width - 40,
    height: Dimensions.get("window").height * 0.5,
    resizeMode: "cover",
  },
  fullScreenPlaceholderImage: {
    width: Dimensions.get("window").width - 40,
    height: Dimensions.get("window").height * 0.5,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
  },
  fullScreenPlaceholderEmoji: {
    fontSize: Dimensions.get("window").width * 0.2,
  },
  fullScreenUserInfo: {
    flex: 1,
    width: "100%",
    paddingHorizontal: 10,
    marginBottom: 20,
  },
  fullScreenName: {
    fontSize: 32,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 10,
  },
  fullScreenLocation: {
    fontSize: 18,
    textAlign: "center",
    marginBottom: 5,
  },
  fullScreenCompatibility: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 15,
    fontWeight: "bold",
  },
  fullScreenBioScrollView: {
    maxHeight: 150,
    marginTop: 10,
  },
  fullScreenBio: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
  },
  fullScreenActionButtons: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    width: "100%",
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  fullScreenSkipButton: {
    padding: 20,
    backgroundColor: "#666",
    borderRadius: 15,
    flex: 1,
    marginRight: 15,
    alignItems: "center",
  },
  fullScreenFuseButton: {
    padding: 20,
    backgroundColor: "#ff4757",
    borderRadius: 15,
    flex: 1,
    marginLeft: 15,
    alignItems: "center",
  },
  fullScreenButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  fullScreenListContainer: {
    alignItems: "center",
  },
  compactCard: {
    width: Dimensions.get("window").width,
    height: Dimensions.get("window").height - 100, // Adjusted for title
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 20, // Space for title
    paddingHorizontal: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  fuseButtonOverlay: {
    position: "absolute",
    top: 20,
    right: 20,
    zIndex: 10,
  },
  overlayFuseButton: {
    padding: 15,
    backgroundColor: "#ff4757",
    borderRadius: 30,
    alignItems: "center",
    borderWidth: 3,
  },
  overlayButtonText: {
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
  },
  compactUserInfo: {
    flex: 1,
    width: "100%",
    paddingHorizontal: 10,
    paddingTop: 20,
  },
  compactName: {
    fontSize: isLargeScreen ? 36 : 28,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
    color: "#bfcafd", // Light blue for visibility in dark mode
  },
  compactLocation: {
    fontSize: isLargeScreen ? 20 : 18,
    textAlign: "center",
    marginBottom: 5,
    color: "#bfcafd", // Light blue for visibility
  },
  compactCompatibility: {
    fontSize: isLargeScreen ? 18 : 16,
    textAlign: "center",
    marginBottom: 10,
    fontWeight: "600",
    color: "#bfcafd", // Light blue
  },
  compactBio: {
    fontSize: isLargeScreen ? 18 : 16,
    lineHeight: isLargeScreen ? 26 : 22,
    textAlign: "center",
    marginBottom: 15,
    color: "#bfcafd", // Light blue
  },
  tapToViewText: {
    fontSize: 14,
    textAlign: "center",
    color: "#888",
    fontStyle: "italic",
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
    width: 30,
  },
  modalTitle: {
    fontSize: isLargeScreen ? 24 : 20,
    fontWeight: "bold",
  },
  scrollContent: {
    minHeight: Dimensions.get("window").height * 0.8,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  profileContent: {
    flex: 1,
  },
  photosContainer: {
    marginBottom: 20,
    height: 320,
  },
  photoWrapper: {
    marginRight: 10,
  },
  profileImage: {
    width: isLargeScreen ? 400 : 280,
    height: isLargeScreen ? 400 : 280,
    borderRadius: 15,
  },
  profileInfo: {
    paddingHorizontal: 10,
  },
  profileName: {
    fontSize: isLargeScreen ? 28 : 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8,
  },
  profileLocation: {
    fontSize: isLargeScreen ? 18 : 16,
    textAlign: "center",
    marginBottom: 15,
  },
  bioSection: {
    marginBottom: 20,
  },
  bioLabel: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 8,
  },
  bioText: {
    fontSize: isLargeScreen ? 18 : 14,
    lineHeight: isLargeScreen ? 26 : 20,
  },
  profileField: {
    marginBottom: 15,
  },
  fieldLabel: {
    fontSize: isLargeScreen ? 16 : 14,
    fontWeight: "bold",
    marginBottom: 4,
    opacity: 0.8,
  },
  fieldValue: {
    fontSize: isLargeScreen ? 18 : 16,
  },
  traitsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 5,
  },
  traitTag: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    marginRight: 8,
    marginBottom: 5,
  },
  traitText: {
    fontSize: 12,
    fontWeight: "500",
  },
  compatibilityScore: {
    fontSize: 14,
    textAlign: "center",
    marginTop: 10,
    fontWeight: "bold",
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
    height: isLargeScreen ? 600 : 400, // Larger on big screens
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  userImage: {
    width: isLargeScreen ? 600 : 400,
    height: isLargeScreen ? 600 : 400,
    maxWidth: isLargeScreen ? 600 : 400,
    maxHeight: isLargeScreen ? 600 : 400,
    borderRadius: 0, // Square instead of circular
    borderWidth: 3,
    borderColor: "#e1e5e9",
  },
  placeholderImage: {
    width: isLargeScreen ? 600 : 400,
    height: isLargeScreen ? 600 : 400,
    borderRadius: 20, // Square instead of circular
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#e1e5e9",
  },
  placeholderEmoji: {
    fontSize: screenWidth * (isLargeScreen ? 0.15 : 0.1),
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
  cardContainer: {
    width: Dimensions.get("window").width * 0.9,
    maxWidth: 400,
    marginVertical: 10,
  },
  cardSeparator: {
    height: 20,
  },
  separator: {
    height: 15,
  },
  photoCarousel: {
    position: "relative",
  },
  photoScrollView: {
    width: isLargeScreen ? 600 : 400,
    height: isLargeScreen ? 600 : 400,
    alignSelf: "center",
  },
  photoImage: {
    width: isLargeScreen ? 600 : 400, // Larger on big screens
    height: isLargeScreen ? 600 : 400, // Larger on big screens
    borderRadius: 20,
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
    width: 10,
    height: 10,
    borderRadius: 5,
    marginHorizontal: 3,
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
  nameContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 5,
  },
  rocketIndicator: {
    fontSize: 18,
    marginLeft: 8,
  },
  compatibilityBadge: {
    backgroundColor: "#E55A2B", // Darker orange for better glow contrast
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 8,
    shadowColor: "#E55A2B",
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 10,
    borderWidth: 2,
    borderColor: "rgba(229, 90, 43, 0.5)", // Semi-transparent darker orange for glow effect
  },
  compatibilityBadgeText: {
    color: "white",
    fontSize: 14,
    fontWeight: "bold",
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
  compatibilityModalContent: {
    backgroundColor: "#1a1a1a",
    margin: 20,
    borderRadius: 20,
    maxHeight: Dimensions.get("window").height * 0.8,
    width: Dimensions.get("window").width - 40,
    borderWidth: 2,
    borderColor: "#FF6B6B",
    shadowColor: "#FF6B6B",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
  },
  scrollContent: {
    padding: 15,
  },
  overallScore: {
    alignItems: "center",
    marginBottom: 20,
    padding: 15,
    backgroundColor: "#FFF8E1",
    borderRadius: 10,
  },
  overallScoreText: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 5,
  },
  confidenceText: {
    fontSize: 16,
    opacity: 0.8,
  },
  breakdownSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
  },
  breakdownItem: {
    backgroundColor: "#F5F5F5",
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  breakdownHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 5,
  },
  breakdownCategory: {
    fontSize: 16,
    fontWeight: "bold",
  },
  breakdownScore: {
    fontSize: 16,
    fontWeight: "bold",
  },
  breakdownDescription: {
    fontSize: 14,
    marginBottom: 5,
  },
  factorsList: {
    marginTop: 5,
  },
  factorText: {
    fontSize: 14,
    marginBottom: 2,
  },
  insightsSection: {
    marginBottom: 20,
  },
  insightItem: {
    backgroundColor: "#E8F5E8",
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 5,
  },
  insightDescription: {
    fontSize: 14,
  },
  factorsSection: {
    marginBottom: 20,
  },
  noDataText: {
    fontSize: 16,
    textAlign: "center",
    marginTop: 20,
  },
  compatibilityDetails: {
    marginTop: 10,
    padding: 15,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  compatibilityItem: {
    marginBottom: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  compatibilityItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 5,
  },
  compatibilityCategory: {
    fontSize: 16,
    fontWeight: "bold",
  },
  compatibilityScore: {
    fontSize: 16,
    fontWeight: "bold",
  },
  compatibilityDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 5,
  },
  compatibilityFactors: {
    marginTop: 5,
  },
  compatibilityFactor: {
    fontSize: 12,
    marginBottom: 2,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flex: 1,
  },
  scoreBadge: {
    backgroundColor: "#FF6B6B",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  scoreText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  summaryContainer: {
    marginBottom: 25,
    padding: 25,
    borderRadius: 20,
    backgroundColor: "rgba(33, 150, 243, 0.2)",
    borderWidth: 1,
    borderColor: "#2196F3",
    shadowColor: "#2196F3",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  summaryTitle: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 15,
    textAlign: "center",
  },
  summaryText: {
    fontSize: 17,
    lineHeight: 26,
    textAlign: "center",
  },
  breakdownContainer: {
    paddingHorizontal: 5,
  },
  breakdownTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  breakdownItem: {
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  breakdownHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  breakdownCategory: {
    fontSize: 16,
    fontWeight: "bold",
  },
  scoreCircle: {
    borderRadius: 25,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 10,
  },
  breakdownScore: {
    fontSize: 14,
    fontWeight: "bold",
    color: "white",
  },
  breakdownDescription: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 10,
  },
  breakdownFactors: {
    marginTop: 8,
  },
  breakdownFactor: {
    fontSize: 14,
    marginBottom: 4,
    lineHeight: 20,
  },
  insightsContainer: {
    marginTop: 25,
  },
  insightsTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  insightItem: {
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  insightType: {
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 5,
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 5,
  },
  insightDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
});
