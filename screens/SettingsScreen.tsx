import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useWallet } from "../contexts/WalletContext";
import { useTheme } from "../contexts/ThemeContext";
import { FirebaseService } from "../utils/firebaseService";

type RootStackParamList = {
  Wallet: undefined;
  SignUp: undefined;
  SignIn: undefined;
  Main: undefined;
  Settings: undefined;
  Profile: undefined;
};

type SettingsScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  "Settings"
>;

export default function SettingsScreen() {
  const { disconnectWallet, address } = useWallet();
  const { theme, themeType, toggleTheme } = useTheme();
  const navigation = useNavigation<SettingsScreenNavigationProp>();
  const [needsMigration, setNeedsMigration] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);

  const handleLogout = async () => {
    try {
      await disconnectWallet();
      navigation.reset({
        index: 0,
        routes: [{ name: "Wallet" }],
      });
    } catch (error) {
      console.error(error);
    }
  };

  // Check if user needs migration (has local data but not in Firebase)
  useEffect(() => {
    const checkMigrationNeeded = async () => {
      if (!address) {
        console.log("Settings: No address, skipping migration check");
        return;
      }

      try {
        console.log("Settings: Checking migration for address:", address);

        // Check if user has local data (wallet-specific key first, then check old key for any wallet)
        let localData = await AsyncStorage.getItem(`userData_${address}`);
        let dataSource = "wallet-specific";

        if (!localData) {
          // Check old key for any available data - we'll validate ownership during migration
          localData = await AsyncStorage.getItem("userData");
          if (localData) {
            dataSource = "old-key";
            console.log("Settings: Found data under old key - will validate ownership during migration");
          }
        }

        console.log("Settings: Local data exists:", !!localData, "source:", dataSource);

        // Initialize Firebase Auth first
        const { initializeFirebaseAuth } = await import("../utils/firebase");
        await initializeFirebaseAuth();

        // Check if user exists in Firebase
        await FirebaseService.initializeUser(address);
        const firebaseData = await FirebaseService.getUserProfile(address);
        console.log("Settings: Firebase data exists:", !!firebaseData);

        // If Firebase data doesn't exist (regardless of local data), migration is needed
        // This allows migration even if local data is in an unexpected location
        const needsMigration = !firebaseData || !firebaseData.matchingData;
        console.log("Settings: Needs migration:", needsMigration);
        setNeedsMigration(needsMigration);
      } catch (error) {
        console.error("Error checking migration status:", error);
        // If we can't check Firebase, assume migration might be needed
        setNeedsMigration(true);
      }
    };

    checkMigrationNeeded();
  }, [address]);  const handleMigrateProfile = async () => {
    if (!address || isMigrating) return;

    setIsMigrating(true);
    try {
      // Get local user data (check both keys)
      let localDataString = await AsyncStorage.getItem(`userData_${address}`);
      let dataSource = "wallet-specific";

      if (!localDataString) {
        localDataString = await AsyncStorage.getItem("userData");
        if (localDataString) {
          dataSource = "old-key";
        }
      }

      if (!localDataString) {
        // If no local data found, try to get data from blockchain as fallback
        console.log("Migration: No local data found, attempting to fetch from blockchain");
        try {
          const { getUserData } = await import("../utils/contract");
          const blockchainData = await getUserData(address);
          if (blockchainData && blockchainData.firstName) {
            // Convert blockchain data to local format
            localDataString = JSON.stringify({
              firstName: blockchainData.firstName,
              lastName: blockchainData.lastName,
              email: "", // Not stored on blockchain
              dob: blockchainData.birthdate,
              gender: blockchainData.gender,
              location: blockchainData.location,
              occupation: "", // Not stored on blockchain
              careerAspiration: "", // Not stored on blockchain
              mbti: blockchainData.mbti,
              bio: blockchainData.traits ? JSON.parse(blockchainData.traits).bio || "" : "",
              id: blockchainData.id,
              openEnded: blockchainData.traits ? JSON.parse(blockchainData.traits).openEnded || "" : "",
              personalityTraits: blockchainData.traits ? JSON.parse(blockchainData.traits).personalityTraits || {} : {},
              transactionHash: "", // Will be set during migration
              walletAddress: address,
            });
            dataSource = "blockchain";
            console.log("Migration: Retrieved data from blockchain");
          }
        } catch (blockchainError) {
          console.error("Migration: Failed to fetch from blockchain:", blockchainError);
        }
      }

      if (!localDataString) {
        Alert.alert("Error", "No profile data found to migrate. Please ensure you have completed the sign-up process.");
        return;
      }

      // If data was from old key, validate it belongs to current wallet and migrate it
      if (dataSource === "old-key") {
        const localData = JSON.parse(localDataString);
        // Check if the data contains wallet address and matches current wallet
        if (localData.walletAddress && localData.walletAddress.toLowerCase() === address.toLowerCase()) {
          await AsyncStorage.setItem(`userData_${address}`, localDataString);
          await AsyncStorage.removeItem("userData");
          console.log("Migration: Migrated validated data from old key to wallet-specific key");
        } else {
          Alert.alert("Error", "The stored profile data doesn't match your current wallet address. Please ensure you're using the correct wallet.");
          return;
        }
      }

      // If data was from blockchain, store it locally
      if (dataSource === "blockchain") {
        await AsyncStorage.setItem(`userData_${address}`, localDataString);
        console.log("Migration: Stored blockchain data locally");
      }

      const localData = JSON.parse(localDataString);

      // Initialize Firebase Auth first
      const { initializeFirebaseAuth } = await import("../utils/firebase");
      await initializeFirebaseAuth();

      // Initialize Firebase for this user
      await FirebaseService.initializeUser(address);

      // Prepare profile data for Firebase (exclude faceScans as they're not needed for matching)
      const profileData = {
        firstName: localData.firstName,
        lastName: localData.lastName,
        email: localData.email,
        dob: localData.dob,
        gender: localData.gender,
        location: localData.location,
        occupation: localData.occupation,
        careerAspiration: localData.careerAspiration,
        mbti: localData.mbti,
        bio: localData.bio,
        id: localData.id,
        openEnded: localData.openEnded,
        personalityTraits: localData.personalityTraits,
        transactionHash: localData.transactionHash,
        walletAddress: address,
      };

      // Store in Firebase
      await FirebaseService.storeUserProfile(address, profileData);

      // Mark migration as complete
      setNeedsMigration(false);

      Alert.alert(
        "Migration Complete",
        "Your profile has been migrated to Firebase and updated to the latest format. You will now appear in the matching system!"
      );
    } catch (error) {
      console.error("Migration failed:", error);
      Alert.alert(
        "Migration Failed",
        "Failed to migrate your profile. Please try again or contact support."
      );
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <ScrollView style={theme.container}>
      <Text style={theme.title}>Settings</Text>
      <Text style={theme.subtitle}>Customize your network experience</Text>

      <TouchableOpacity onPress={toggleTheme} style={theme.button}>
        <Text style={theme.buttonTextStyle}>
          🎨 Switch to {themeType === "light" ? "Dark" : "Light"} Mode
        </Text>
      </TouchableOpacity>

      {needsMigration && (
        <TouchableOpacity
          onPress={handleMigrateProfile}
          disabled={isMigrating}
          style={[theme.button, { backgroundColor: "#28a745" }]}
        >
          <Text style={[theme.buttonTextStyle, { color: "#fff" }]}>
            {isMigrating ? "🔄 Migrating Profile..." : "📤 Migrate Profile to Matching"}
          </Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        onPress={handleLogout}
        style={[theme.button, { backgroundColor: "#dc3545" }]}
      >
        <Text style={[theme.buttonTextStyle, { color: "#fff" }]}>
          🚪 Logout & Disconnect
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
