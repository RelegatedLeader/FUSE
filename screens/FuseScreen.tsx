import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Animated,
  Alert,
} from "react-native";
import { useWallet } from "../contexts/WalletContext";
import { useTheme } from "../contexts/ThemeContext";
import { MatchingEngine } from "../utils/matchingEngine";

interface User {
  address: string;
  name: string;
  age: number;
  city: string;
  bio: string;
  photos: string[];
  compatibilityScore?: number;
}

export default function FuseScreen() {
  const { address } = useWallet();
  const { theme } = useTheme();
  const [users, setUsers] = useState<User[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showBio, setShowBio] = useState(false);
  const fuseAnim = useState(new Animated.Value(0))[0];

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
        const formattedUsers: User[] = matches.map((match) => {
          // Calculate age from birthdate
          let age = 25; // default
          if (match.profile?.birthdate) {
            const birthDate = new Date(match.profile.birthdate);
            const today = new Date();
            age = today.getFullYear() - birthDate.getFullYear();
            const monthDiff = today.getMonth() - birthDate.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
              age--;
            }
          }

          // Format name from firstName and lastName
          const name = match.profile?.firstName && match.profile?.lastName
            ? `${match.profile.firstName} ${match.profile.lastName}`
            : match.profile?.firstName || match.profile?.lastName || "Unknown User";

          return {
            address: match.address,
            name: name,
            age: age,
            city: match.profile?.location || "Unknown",
            bio: match.profile?.traits?.bio || match.profile?.bio || "No bio available",
            photos: match.profile?.photos || [],
            compatibilityScore: match.compatibilityScore,
          };
        });

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
  }, [address]);

  const handleFuse = () => {
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
      // Move to next user
      setCurrentIndex(currentIndex + 1);
      setShowBio(false);
    });
  };

  const handleSkip = () => {
    setCurrentIndex(currentIndex + 1);
    setShowBio(false);
  };

  const currentUser = users[currentIndex];

  if (!currentUser) {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.backgroundColor }]}
      >
        <Text
          style={{ color: theme.textColor, textAlign: "center", fontSize: 18 }}
        >
          {users.length === 0 && address ? (
            <>
              🚀 No potential matches yet.{"\n"}
              Make sure you've migrated your profile in Settings first!{"\n\n"}
              Once migrated, you'll start seeing other users.
            </>
          ) : (
            <>
              🎯 No more potential matches right now.{"\n"}Check back later or
              invite friends to join!
            </>
          )}
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[styles.container, { backgroundColor: theme.backgroundColor }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={theme.card}>
          <TouchableOpacity
            onPress={() => setShowBio(!showBio)}
            style={[
              styles.leftTap,
              { backgroundColor: theme.buttonBackground },
            ]}
          >
            <Text style={{ color: theme.buttonText, fontSize: 14 }}>
              🔍 View Bio
            </Text>
          </TouchableOpacity>
          <View style={styles.userInfo}>
            <Text style={[styles.name, { color: theme.textColor }]}>
              {currentUser.name}, {currentUser.age}
            </Text>
            <Text style={{ color: theme.textColor, fontSize: 16 }}>
              📍 {currentUser.city}
            </Text>
            {currentUser.compatibilityScore && (
              <Text style={[styles.compatibility, { color: theme.textColor }]}>
                💫 Compatibility: {Math.round(currentUser.compatibilityScore)}%
              </Text>
            )}
            {showBio && (
              <Text style={[styles.bio, { color: theme.textColor }]}>
                {currentUser.bio}
              </Text>
            )}
          </View>
          <TouchableOpacity
            onPress={handleFuse}
            style={[theme.button, { marginTop: 20 }]}
          >
            <Animated.Text
              style={[
                theme.buttonTextStyle,
                {
                  transform: [
                    {
                      scale: fuseAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.5],
                      }),
                    },
                  ],
                },
              ]}
            >
              🚀 Fuse & Connect
            </Animated.Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          onPress={handleSkip}
          style={[theme.button, { backgroundColor: "#666" }]}
        >
          <Text style={[theme.buttonTextStyle, { color: "#fff" }]}>
            ⏭️ Skip for Now
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContainer: { alignItems: "center", padding: 20 },
  card: {
    width: "90%",
    backgroundColor: "white",
    borderRadius: 10,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 5,
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
  name: { fontSize: 24, fontWeight: "bold" },
  compatibility: { fontSize: 16, fontWeight: "600", marginTop: 5 },
  bio: { marginTop: 10, fontStyle: "italic" },
  fuseButton: {
    marginTop: 20,
    backgroundColor: "blue",
    padding: 15,
    borderRadius: 10,
  },
  fuseText: { color: "white", fontSize: 18 },
  skipButton: { padding: 10, backgroundColor: "gray" },
});
