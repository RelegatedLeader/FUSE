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

        // Check if user has Firebase profile but missing bio (needs bio migration)
        if (firebaseData && (!firebaseData.bio || firebaseData.bio.trim() === "")) {
          console.log("Settings: Firebase profile exists but bio is missing or empty:", firebaseData.bio);
          // Check if there's bio data on Polygon or local storage that could be migrated
          let hasBioToMigrate = false;

          try {
            const { getUserData } = await import("../utils/contract");
            const blockchainData = await getUserData(address);
            if (blockchainData) {
              let traits: any = {};
              if (blockchainData.traits) {
                try {
                  traits = typeof blockchainData.traits === 'string'
                    ? JSON.parse(blockchainData.traits)
                    : blockchainData.traits;
                } catch (e) {
                  console.log("Bio check: Could not parse traits");
                }
              }
              const polygonBio = traits.bio || blockchainData.bio || "";
              console.log("Settings: Polygon bio available:", polygonBio);
              if (polygonBio.trim() !== "") {
                hasBioToMigrate = true;
              }
            }
          } catch (error) {
            console.log("Settings: Could not check Polygon for bio:", error);
          }

          // If no bio on Polygon, check local data
          if (!hasBioToMigrate) {
            try {
              let localDataString = await AsyncStorage.getItem(`userData_${address}`);
              if (!localDataString) {
                localDataString = await AsyncStorage.getItem("userData");
              }
              if (localDataString) {
                const localData = JSON.parse(localDataString);
                if (localData.bio && localData.bio.trim()) {
                  console.log("Settings: Found bio in local data");
                  hasBioToMigrate = true;
                }
              }
            } catch (error) {
              console.log("Settings: Could not check local data for bio:", error);
            }
          }

          if (hasBioToMigrate) {
            console.log("Settings: Bio migration available");
            setNeedsBioMigration(true);
          } else {
            console.log("Settings: No bio found to migrate");
          }
        } else {
          console.log("Settings: Bio migration not needed - Firebase bio exists:", firebaseData?.bio);
        }
      } catch (error) {
        console.error("Error checking migration status:", error);
        // If we can't check Firebase, assume migration might be needed
        setNeedsMigration(true);
      }
    };

    checkMigrationNeeded();
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
        Alert.alert("Error", "Could not retrieve Polygon data for verification.");
        return;
      }

      // Parse Polygon traits
      let polygonTraits: any = {};
      if (polygonData.traits) {
        try {
          polygonTraits = typeof polygonData.traits === 'string'
            ? JSON.parse(polygonData.traits)
            : polygonData.traits;
        } catch (e) {
          console.log("Could not parse Polygon traits");
        }
      }

      // Compare key fields
      const mismatches: string[] = [];

      if (firebaseData.firstName !== polygonData.firstName) {
        mismatches.push(`First Name: Firebase="${firebaseData.firstName}" vs Polygon="${polygonData.firstName}"`);
      }
      if (firebaseData.lastName !== polygonData.lastName) {
        mismatches.push(`Last Name: Firebase="${firebaseData.lastName}" vs Polygon="${polygonData.lastName}"`);
      }
      if (firebaseData.birthdate !== polygonData.birthdate) {
        mismatches.push(`Birthdate: Firebase="${firebaseData.birthdate}" vs Polygon="${polygonData.birthdate}"`);
      }
      if (firebaseData.gender !== polygonData.gender) {
        mismatches.push(`Gender: Firebase="${firebaseData.gender}" vs Polygon="${polygonData.gender}"`);
      }
      if (firebaseData.location !== polygonData.location) {
        mismatches.push(`Location: Firebase="${firebaseData.location}" vs Polygon="${polygonData.location}"`);
      }
      if (firebaseData.mbti !== polygonData.mbti) {
        mismatches.push(`MBTI: Firebase="${firebaseData.mbti}" vs Polygon="${polygonData.mbti}"`);
      }

      // Compare personality traits
      if (firebaseData.personalityTraits && polygonTraits.personalityTraits) {
        const firebaseTraits = firebaseData.personalityTraits;
        const polygonTraitsData = polygonTraits.personalityTraits;

        ['agreeableness', 'conscientiousness', 'extroversion', 'neuroticism', 'openness'].forEach(trait => {
          const firebaseValue = firebaseTraits[trait];
          const polygonValue = polygonTraitsData[trait];
          if (Math.abs(firebaseValue - polygonValue) > 0.001) { // Allow small floating point differences
            mismatches.push(`${trait}: Firebase=${firebaseValue} vs Polygon=${polygonValue}`);
          }
        });
      }

      // Compare bio
      const firebaseBio = firebaseData.bio || firebaseData.traits?.bio || '';
      const polygonBio = polygonTraits.bio || '';
      if (firebaseBio.trim() !== polygonBio.trim()) {
        mismatches.push(`Bio: Firebase="${firebaseBio.substring(0, 50)}..." vs Polygon="${polygonBio.substring(0, 50)}..."`);
      }

      if (mismatches.length === 0) {
        Alert.alert("✅ Data Integrity Verified", "Your Firebase data matches the immutable Polygon blockchain data. No tampering detected.");
      } else {
        Alert.alert(
          "🚨 DATA TAMPERING DETECTED!",
          `Critical security issue: ${mismatches.length} data mismatches found:\n\n${mismatches.join('\n')}\n\nYour profile may have been compromised. Contact support immediately.`,
          [{ text: "OK", style: "destructive" }]
        );
      }

    } catch (error) {
      console.error("Data integrity verification error:", error);
      Alert.alert("Error", "Failed to verify data integrity. Please try again.");
    } finally {
      setIsVerifyingIntegrity(false);
    }
  };

  const handleMigrateBio = async () => {
    if (!address || isBioMigrating) return;

    setIsBioMigrating(true);
    try {
      console.log("Bio migration: Starting for address:", address);

      // First try to get bio from Polygon blockchain
      const { getUserData } = await import("../utils/contract");
      const blockchainData = await getUserData(address);
      console.log("Bio migration: Blockchain data:", blockchainData);

      let polygonBio = "";
      if (blockchainData) {
        // Parse traits to get bio
        let traits: any = {};
        if (blockchainData.traits) {
          try {
            traits = typeof blockchainData.traits === 'string'
              ? JSON.parse(blockchainData.traits)
              : blockchainData.traits;
            console.log("Bio migration: Parsed traits:", traits);
          } catch (e) {
            console.log("Bio migration: Could not parse traits");
          }
        }
        polygonBio = traits.bio || (blockchainData as any).bio || "";
        console.log("Bio migration: Polygon bio:", polygonBio);
      }

      // If no bio on Polygon, check local data
      if (!polygonBio.trim()) {
        console.log("Bio migration: No bio on Polygon, checking local data");
        try {
          let localDataString = await AsyncStorage.getItem(`userData_${address}`);
          if (!localDataString) {
            localDataString = await AsyncStorage.getItem("userData");
          }
          if (localDataString) {
            const localData = JSON.parse(localDataString);
            if (localData.bio && localData.bio.trim()) {
              polygonBio = localData.bio.trim();
              console.log("Bio migration: Found bio in local data:", polygonBio);
            }
          }
        } catch (error) {
          console.log("Bio migration: Could not check local data:", error);
        }
      }

      if (!polygonBio.trim()) {
        Alert.alert("Info", "No bio found on Polygon blockchain or local storage to migrate.");
        return;
      }

      // Initialize Firebase
      const { initializeFirebaseAuth } = await import("../utils/firebase");
      await initializeFirebaseAuth();
      await FirebaseService.initializeUser(address);

      // Get current Firebase profile
      const currentProfile = await FirebaseService.getUserProfile(address);
      console.log("Bio migration: Current Firebase profile:", currentProfile);

      if (!currentProfile) {
        Alert.alert("Error", "Firebase profile not found. Please complete profile migration first.");
        return;
      }

      // Update Firebase profile with bio
      const updatedProfile = {
        ...currentProfile,
        bio: polygonBio.trim(),
      };
      console.log("Bio migration: Updated profile:", updatedProfile);

      await FirebaseService.storeUserProfile(address, updatedProfile);

      console.log("Bio migration: Successfully stored profile");
      Alert.alert("Success", "Bio migrated successfully!");
      setNeedsBioMigration(false);

    } catch (error) {
      console.error("Bio migration error:", error);
      Alert.alert("Error", "Failed to migrate bio. Please try again.");
    } finally {
      setIsBioMigrating(false);
    }
  };

  const handleMigrateProfile = async () => {
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
            // Parse traits if it's a JSON string
            let traits: any = {};
            if (blockchainData.traits) {
              try {
                traits = typeof blockchainData.traits === 'string'
                  ? JSON.parse(blockchainData.traits)
                  : blockchainData.traits;
              } catch (e) {
                console.log("Migration: Could not parse traits, using empty object");
              }
            }

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
              bio: traits.bio || blockchainData.bio || "",
              id: blockchainData.id,
              openEnded: traits.openEnded || "",
              personalityTraits: traits.personalityTraits || (blockchainData as any).personalityTraits || {},
              transactionHash: "", // Will be set during migration
              walletAddress: address,
            });
            dataSource = "blockchain";
            console.log("Migration: Retrieved data from blockchain, bio:", traits.bio || blockchainData.bio || "none");
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

      {needsBioMigration && (
        <TouchableOpacity
          onPress={handleMigrateBio}
          disabled={isBioMigrating}
          style={[theme.button, { backgroundColor: "#17a2b8" }]}
        >
          <Text style={[theme.buttonTextStyle, { color: "#fff" }]}>
            {isBioMigrating ? "🔄 Migrating Bio..." : "📝 Migrate Bio from Polygon"}
          </Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        onPress={() => Alert.alert("Feature Coming Soon", "Data integrity verification will be available in the next update to ensure your Firebase data matches the immutable Polygon blockchain.")}
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
