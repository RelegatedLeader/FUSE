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
      if (!address) return;

      try {
        // Check if user has local data
        const localData = await AsyncStorage.getItem("userData");
        if (!localData) return;

        // Initialize Firebase Auth first
        const { initializeFirebaseAuth } = await import("../utils/firebase");
        await initializeFirebaseAuth();

        // Check if user exists in Firebase
        await FirebaseService.initializeUser(address);
        const firebaseData = await FirebaseService.getUserProfile(address);

        // If local data exists but Firebase data doesn't, migration is needed
        setNeedsMigration(!firebaseData);
      } catch (error) {
        console.error("Error checking migration status:", error);
        // If we can't check Firebase, assume migration might be needed
        setNeedsMigration(true);
      }
    };

    checkMigrationNeeded();
  }, [address]);

  const handleMigrateProfile = async () => {
    if (!address || isMigrating) return;

    setIsMigrating(true);
    try {
      // Get local user data
      const localDataString = await AsyncStorage.getItem("userData");
      if (!localDataString) {
        Alert.alert("Error", "No local profile data found to migrate.");
        return;
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
        "Your profile has been successfully migrated to Firebase. You will now appear in the matching system!"
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
