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
  const [needsBioMigration, setNeedsBioMigration] = useState(false);
  const [isBioMigrating, setIsBioMigrating] = useState(false);
  const [isVerifyingIntegrity, setIsVerifyingIntegrity] = useState(false);

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
    const checkAndMigrate = async () => {
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
            console.log(
              "Settings: Found data under old key - will validate ownership during migration"
            );
          }
        }

        console.log(
          "Settings: Local data exists:",
          !!localData,
          "source:",
          dataSource
        );

        // Initialize Firebase Auth first
        const { initializeFirebaseAuth } = await import("../utils/firebase");
        await initializeFirebaseAuth();

        // Check if user exists in Firebase
        await FirebaseService.initializeUser(address);
        const firebaseData = await FirebaseService.getUserProfile(address);
        console.log("Settings: Firebase data exists:", !!firebaseData);

        // If Firebase data doesn't exist or is incomplete (missing bio), perform automatic migration
        const needsMigration = !firebaseData || !firebaseData.bio || firebaseData.bio.trim() === "";
        console.log("Settings: Needs migration:", needsMigration, "hasFirebaseData:", !!firebaseData, "hasBio:", firebaseData?.bio ? "yes" : "no");

        if (needsMigration && localData) {
          console.log("Settings: Performing automatic migration...");
          await performAutomaticMigration(localData, dataSource);
        }

        // Check if user has Firebase profile but missing bio (needs bio migration)
        if (
          firebaseData &&
          (!firebaseData.bio || firebaseData.bio.trim() === "")
        ) {
          console.log(
            "Settings: Firebase profile exists but bio is missing or empty:",
            firebaseData.bio
          );
          // Check if there's bio data in local storage that could be migrated
          let hasBioToMigrate = false;

          try {
            let localDataString = await AsyncStorage.getItem(
              `userData_${address}`
            );
            if (!localDataString) {
              localDataString = await AsyncStorage.getItem("userData");
            }
            if (localDataString) {
              const localData = JSON.parse(localDataString);
              if (localData.bio && localData.bio.trim()) {
                console.log(
                  "Settings: Found bio in local data:",
                  localData.bio.substring(0, 50) + "..."
                );
                hasBioToMigrate = true;
              }
            }
          } catch (error) {
            console.log("Settings: Could not check local data for bio:", error);
          }

          if (hasBioToMigrate) {
            console.log("Settings: Performing automatic bio migration...");
            await performAutomaticBioMigration();
          }
        }
      } catch (error) {
        console.error("Error during automatic migration check:", error);
      }
    };

    checkAndMigrate();
  }, [address]);

  const handleVerifyDataIntegrity = async () => {
    if (!address || isVerifyingIntegrity) return;

    setIsVerifyingIntegrity(true);
    try {
      console.log("Verifying data integrity for address:", address);

      // Get Firebase data
      const { initializeFirebaseAuth } = await import("../utils/firebase");
      await initializeFirebaseAuth();
      await FirebaseService.initializeUser(address);
      const firebaseData = await FirebaseService.getUserProfile(address);

      if (!firebaseData) {
        Alert.alert("Error", "No Firebase profile found to verify.");
        return;
      }

      // Get Polygon data
      const { getUserData } = await import("../utils/contract");
      const polygonData = await getUserData(address);

      if (!polygonData) {
        Alert.alert(
          "Error",
          "Could not retrieve Polygon data for verification."
        );
        return;
      }

      // Parse Polygon traits
      let polygonTraits: any = {};
      if (polygonData.traits) {
        try {
          polygonTraits =
            typeof polygonData.traits === "string"
              ? JSON.parse(polygonData.traits)
              : polygonData.traits;
        } catch (e) {
          console.log("Could not parse Polygon traits");
        }
      }

      // Compare key fields
      const mismatches: string[] = [];

      if (firebaseData.firstName !== polygonData.firstName) {
        mismatches.push(
          `First Name: Firebase="${firebaseData.firstName}" vs Polygon="${polygonData.firstName}"`
        );
      }
      if (firebaseData.lastName !== polygonData.lastName) {
        mismatches.push(
          `Last Name: Firebase="${firebaseData.lastName}" vs Polygon="${polygonData.lastName}"`
        );
      }
      if (firebaseData.birthdate !== polygonData.birthdate) {
        mismatches.push(
          `Birthdate: Firebase="${firebaseData.birthdate}" vs Polygon="${polygonData.birthdate}"`
        );
      }
      if (firebaseData.gender !== polygonData.gender) {
        mismatches.push(
          `Gender: Firebase="${firebaseData.gender}" vs Polygon="${polygonData.gender}"`
        );
      }
      if (firebaseData.location !== polygonData.location) {
        mismatches.push(
          `Location: Firebase="${firebaseData.location}" vs Polygon="${polygonData.location}"`
        );
      }
      if (firebaseData.mbti !== polygonData.mbti) {
        mismatches.push(
          `MBTI: Firebase="${firebaseData.mbti}" vs Polygon="${polygonData.mbti}"`
        );
      }

      // Compare personality traits
      if (firebaseData.personalityTraits && polygonTraits.personalityTraits) {
        const firebaseTraits = firebaseData.personalityTraits;
        const polygonTraitsData = polygonTraits.personalityTraits;

        [
          "agreeableness",
          "conscientiousness",
          "extroversion",
          "neuroticism",
          "openness",
        ].forEach((trait) => {
          const firebaseValue = firebaseTraits[trait];
          const polygonValue = polygonTraitsData[trait];
          if (Math.abs(firebaseValue - polygonValue) > 0.001) {
            // Allow small floating point differences
            mismatches.push(
              `${trait}: Firebase=${firebaseValue} vs Polygon=${polygonValue}`
            );
          }
        });
      }

      // Compare bio
      const firebaseBio = firebaseData.bio || firebaseData.traits?.bio || "";
      const polygonBio = polygonTraits.bio || "";
      if (firebaseBio.trim() !== polygonBio.trim()) {
        mismatches.push(
          `Bio: Firebase="${firebaseBio.substring(
            0,
            50
          )}..." vs Polygon="${polygonBio.substring(0, 50)}..."`
        );
      }

      if (mismatches.length === 0) {
        Alert.alert(
          "✅ Data Integrity Verified",
          "Your Firebase data matches the immutable Polygon blockchain data. No tampering detected."
        );
      } else {
        Alert.alert(
          "🚨 DATA TAMPERING DETECTED!",
          `Critical security issue: ${
            mismatches.length
          } data mismatches found:\n\n${mismatches.join(
            "\n"
          )}\n\nYour profile may have been compromised. Contact support immediately.`,
          [{ text: "OK", style: "destructive" }]
        );
      }
    } catch (error) {
      console.error("Data integrity verification error:", error);
      Alert.alert(
        "Error",
        "Failed to verify data integrity. Please try again."
      );
    } finally {
      setIsVerifyingIntegrity(false);
    }
  };

  const performAutomaticMigration = async (localDataString: string, dataSource: string) => {
    try {
      // If data was from old key, validate it belongs to current wallet and migrate it
      if (dataSource === "old-key") {
        const localData = JSON.parse(localDataString);
        // Check if the data contains wallet address and matches current wallet
        if (
          localData.walletAddress &&
          localData.walletAddress.toLowerCase() === address.toLowerCase()
        ) {
          await AsyncStorage.setItem(`userData_${address}`, localDataString);
          await AsyncStorage.removeItem("userData");
          console.log(
            "Migration: Migrated validated data from old key to wallet-specific key"
          );
        } else {
          console.log("Migration: Data doesn't belong to current wallet, skipping");
          return;
        }
      }

      // If data was from blockchain, store it locally
      if (dataSource === "blockchain") {
        await AsyncStorage.setItem(`userData_${address}`, localDataString);
        console.log("Migration: Stored blockchain data locally");
      }

      const localData = JSON.parse(localDataString);

      // Prepare profile data for Firebase (this will be properly encrypted by FirebaseService)
      const profileData = {
        firstName: localData.firstName,
        lastName: localData.lastName,
        email: localData.email,
        dob: localData.dob,
        gender: localData.gender,
        sexuality: localData.sexuality || "", // Add sexuality field
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

      // Initialize Firebase Auth first
      const { initializeFirebaseAuth } = await import("../utils/firebase");
      await initializeFirebaseAuth();

      // Initialize Firebase for this user
      await FirebaseService.initializeUser(address);

      // Store in Firebase using the proper service (this handles encryption)
      await FirebaseService.storeUserProfile(address, profileData);

      console.log("Automatic migration: Successfully migrated profile to Firebase");
    } catch (error) {
      console.error("Automatic migration failed:", error);
    }
  };

  const performAutomaticBioMigration = async () => {
    try {
      let bioToMigrate = "";
      let localDataString = null;

      // Check local data for bio (since contract doesn't support retrieval yet)
      console.log("Bio migration: Checking local storage for bio data");
      try {
        localDataString = await AsyncStorage.getItem(`userData_${address}`);
        if (!localDataString) {
          localDataString = await AsyncStorage.getItem("userData");
        }
        if (localDataString) {
          const localData = JSON.parse(localDataString);
          if (localData.bio && localData.bio.trim()) {
            bioToMigrate = localData.bio.trim();
            console.log(
              "Bio migration: Found bio in local data:",
              `"${bioToMigrate}"`
            );
          } else {
            console.log("Bio migration: No bio found in local data");
          }
        } else {
          console.log("Bio migration: No local data found");
        }
      } catch (error) {
        console.log("Bio migration: Could not check local data:", error);
      }

      if (!bioToMigrate.trim()) {
        console.log("Bio migration: No bio to migrate");
        return;
      }

      // Initialize Firebase
      const { initializeFirebaseAuth } = await import("../utils/firebase");
      await initializeFirebaseAuth();
      await FirebaseService.initializeUser(address);

      // Get current Firebase profile
      const currentProfile = await FirebaseService.getUserProfile(address);
      console.log("Bio migration: Current Firebase profile:", currentProfile);

      let profileData;

      if (currentProfile) {
        // Update existing Firebase profile with bio
        profileData = {
          ...currentProfile,
          bio: bioToMigrate.trim(),
        };
        console.log("Bio migration: Updated existing profile with bio");
      } else {
        // Create new complete profile from local data
        console.log(
          "Bio migration: No existing Firebase profile, creating complete profile"
        );

        if (localDataString) {
          // Use local data as base
          const localData = JSON.parse(localDataString);
          profileData = {
            firstName: localData.firstName || "",
            lastName: localData.lastName || "",
            email: localData.email || "",
            dob: localData.dob || "",
            gender: localData.gender || "",
            sexuality: localData.sexuality || "",
            location: localData.location || "",
            occupation: localData.occupation || "",
            careerAspiration: localData.careerAspiration || "",
            mbti: localData.mbti || "",
            bio: bioToMigrate.trim(),
            id: localData.id || "",
            openEnded: localData.openEnded || "",
            personalityTraits: localData.personalityTraits || {},
            transactionHash: localData.transactionHash || "",
            walletAddress: address,
          };
          console.log("Bio migration: Created profile from local data");
        } else {
          // Create minimal profile with just bio
          profileData = {
            firstName: "",
            lastName: "",
            email: "",
            dob: "",
            gender: "",
            sexuality: "",
            location: "",
            occupation: "",
            careerAspiration: "",
            mbti: "",
            bio: bioToMigrate.trim(),
            id: "",
            openEnded: "",
            personalityTraits: {},
            transactionHash: "",
            walletAddress: address,
          };
          console.log("Bio migration: Created minimal profile with bio only");
        }
      }

      await FirebaseService.storeUserProfile(address, profileData);

      console.log(
        "Bio migration: Successfully stored profile with bio:",
        profileData.bio
      );
    } catch (error) {
      console.error("Automatic bio migration failed:", error);
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

      <TouchableOpacity
        onPress={() =>
          Alert.alert(
            "Feature Coming Soon",
            "Data integrity verification will be available in the next update to ensure your Firebase data matches the immutable Polygon blockchain."
          )
        }
        style={[theme.button, { backgroundColor: "#6f42c1" }]}
      >
        <Text style={[theme.buttonTextStyle, { color: "#fff" }]}>
          🔒 Verify Data Integrity
        </Text>
      </TouchableOpacity>

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
