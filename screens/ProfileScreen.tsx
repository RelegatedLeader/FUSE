import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
} from "react-native";
import { useWallet } from "../contexts/WalletContext";
import { useTheme } from "../contexts/ThemeContext";
import CustomModal from "../components/CustomModal";
import * as ImagePicker from "expo-image-picker";
import { FirebaseService } from "../utils/firebaseService";
import { getUserData } from "../utils/contract";

export default function ProfileScreen() {
  const { address, signClient, sessionTopic } = useWallet();
  const { theme } = useTheme();
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [arweaveInitialized, setArweaveInitialized] = useState(false);
  const [arweaveBalance, setArweaveBalance] = useState<{
    hasBalance: boolean;
    balance: string;
    costPerImage: { matic: number; usd: number };
  } | null>(null);
  const [placeholderImages, setPlaceholderImages] = useState<string[]>([]); // Not used anymore, but keeping for compatibility
  const [preferences, setPreferences] = useState<Record<string, boolean>>({
    showAge: true,
    showLocation: true,
    // add more
  });

  // Custom modal states
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] = useState("");
  const [modalButtons, setModalButtons] = useState<any[]>([]);

  // Helper function to show custom modal
  const showCustomModal = (
    title: string,
    message: string,
    buttons: any[] = []
  ) => {
    setModalTitle(title);
    setModalMessage(message);
    setModalButtons(buttons);
    setModalVisible(true);
  };

  useEffect(() => {
    if (address) {
      loadUserData();
      loadPhotos();
      initializeArweaveStorage();
    }
  }, [address]);

  const initializeArweaveStorage = async () => {
    try {
      // Initialize Arweave storage with MetaMask signer
      // Note: This requires the wallet context to provide the signer
      console.log("Initializing Arweave storage...");

      // For now, we'll initialize when needed during upload
      // This will be called with the proper signer from WalletContext
    } catch (error) {
      console.error("Failed to initialize Arweave storage:", error);
    }
  };

  const checkArweaveBalance = async () => {
    try {
      const balance = await FirebaseService.checkArweaveBalance();
      setArweaveBalance(balance);
      return balance;
    } catch (error) {
      console.error("Failed to check Arweave balance:", error);
      return null;
    }
  };

  const loadUserData = async () => {
    setLoading(true);
    try {
      const data: any = await getUserData(address);
      // Parse bio if it's JSON
      if (data.bio && data.bio.startsWith("{")) {
        try {
          const bioObj = JSON.parse(data.bio);
          data.parsedBio = bioObj.bio || data.bio;
          data.personality = bioObj.personalityTraits;
        } catch (e) {
          data.parsedBio = data.bio;
        }
      } else {
        data.parsedBio = data.bio;
      }
      setUserData(data);
    } catch (error) {
      console.error("Error loading user data:", error);
      Alert.alert(
        "Error",
        "Failed to load user data: " + (error as Error).message
      );
    } finally {
      setLoading(false);
    }
  };

  const loadPhotos = async () => {
    try {
      // Initialize Firebase if needed
      await FirebaseService.initializeUser(address);

      // Get photo URLs from Firebase
      const urls = await FirebaseService.getUserPhotoUrls(address);
      setPhotoUrls(urls);

      // Load and decrypt photos for display
      const decryptedPhotos: string[] = [];
      const validUrls: string[] = [];

      for (const url of urls) {
        try {
          // Check if it's an Arweave URL (starts with arweave.net)
          if (url.includes("arweave.net")) {
            const decryptedUri =
              await FirebaseService.downloadUserImageFromStorage(url);
            decryptedPhotos.push(decryptedUri);
            validUrls.push(url);
          } else {
            // Fallback for old Firebase Storage URLs
            const decryptedUri = await FirebaseService.downloadUserImage(
              url,
              address
            );
            decryptedPhotos.push(decryptedUri);
            validUrls.push(url);
          }
        } catch (error) {
          console.error("Failed to decrypt photo:", error);
          // Skip invalid URLs instead of breaking
        }
      }

      // Update with only valid URLs
      if (validUrls.length !== urls.length) {
        await FirebaseService.updateUserPhotoUrls(address, validUrls);
      }

      setPhotos(decryptedPhotos);
      setPhotoUrls(validUrls);
    } catch (error) {
      console.error("Error loading photos:", error);
    }
  };

  const pickImage = async () => {
    const totalImages = photos.length + placeholderImages.length;
    if (totalImages >= 4) {
      showCustomModal("Limit", "You can add up to 4 photos", [
        {
          text: "OK",
          onPress: () => setModalVisible(false),
        },
      ]);
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
        base64: true,
      });

      if (!result.canceled) {
        const asset = result.assets[0];
        if (!asset.base64) {
          showCustomModal("Error", "Failed to get image data");
          return;
        }

        // Add as placeholder image first
        const dataUrl = `data:image/jpeg;base64,${asset.base64}`;

        // Check for duplicates
        if (checkForDuplicate(dataUrl)) {
          showCustomModal(
            "Duplicate Image",
            "This image has already been added. Please select a different image.",
            [
              {
                text: "OK",
                onPress: () => setModalVisible(false),
              },
            ]
          );
          return;
        }

        // Upload immediately
        await uploadImageDirectly(dataUrl);
      }
    } catch (error) {
      console.error("Error picking image:", error);
      showCustomModal("Error", "Failed to pick image");
    }
  };

  const deletePhoto = async (index: number) => {
    showCustomModal(
      "Remove Photo",
      "Are you sure you want to remove this photo?",
      [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => setModalVisible(false),
        },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              setModalVisible(false);
              setUploading(true);

              // Remove from Firebase completely
              await FirebaseService.deleteUserImage(address, index);

              // Update photo URLs in Firebase (remove the URL at this index)
              const newPhotoUrls = photoUrls.filter((_, i) => i !== index);
              await FirebaseService.updateUserPhotoUrls(address, newPhotoUrls);

              // Update local state
              const newPhotos = photos.filter((_, i) => i !== index);
              setPhotos(newPhotos);
              setPhotoUrls(newPhotoUrls);

              showCustomModal("Success", "Photo removed!", [
                { text: "OK", onPress: () => setModalVisible(false) },
              ]);
            } catch (error) {
              console.error("Error removing photo:", error);
              showCustomModal("Error", "Failed to remove photo", [
                { text: "OK", onPress: () => setModalVisible(false) },
              ]);
            } finally {
              setUploading(false);
            }
          },
        },
      ]
    );
  };

  const checkForDuplicate = (newImageUri: string): boolean => {
    // Check against existing photos
    for (const existingUri of photos) {
      if (existingUri === newImageUri) {
        return true;
      }
    }
    return false;
  };

  const uploadImageDirectly = async (dataUrl: string) => {
    try {
      setUploading(true);

      // Initialize Firebase user keys if needed
      await FirebaseService.initializeUser(address);

      // Extract base64 from data URL
      const base64Match = dataUrl.match(/^data:image\/[^;]+;base64,(.+)$/);
      if (!base64Match) {
        showCustomModal("Error", "Failed to process image");
        return;
      }

      const base64Data = base64Match[1];
      const imageIndex = photos.length;

      // Upload to Firebase Storage
      const downloadUrl = await FirebaseService.uploadUserImageFromBase64(
        base64Data,
        address,
        imageIndex
      );

      // Update photo URLs in Firebase
      const newPhotoUrls = [...photoUrls, downloadUrl];
      await FirebaseService.updateUserPhotoUrls(address, newPhotoUrls);

      // Add to photos
      setPhotos([...photos, dataUrl]);
      setPhotoUrls(newPhotoUrls);

      showCustomModal("Success", "Photo uploaded successfully!", [
        { text: "OK", onPress: () => setModalVisible(false) },
      ]);
    } catch (error) {
      console.error("Error uploading image:", error);
      showCustomModal("Error", "Failed to upload photo");
    } finally {
      setUploading(false);
    }
  };

  const togglePreference = (key: string) => {
    setPreferences({ ...preferences, [key]: !preferences[key] });
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundColor }]}
    >
      <Text style={theme.title}>Your Profile</Text>
      {loading && (
        <Text style={{ color: theme.textColor }}>
          Loading your network data...
        </Text>
      )}
      {userData && (
        <View style={theme.card}>
          <Text style={[styles.label, { color: theme.textColor }]}>
            👤 Name: {userData.name}
          </Text>
          {userData.age !== null && (
            <Text style={[styles.label, { color: theme.textColor }]}>
              🎂 Age: {userData.age}
            </Text>
          )}
          <Text style={[styles.label, { color: theme.textColor }]}>
            📍 City: {userData.city}
          </Text>
          <Text style={[styles.label, { color: theme.textColor }]}>
            🧠 MBTI: {userData.mbti}
          </Text>
          <Text style={[styles.label, { color: theme.textColor }]}>
            ⚧️ Gender: {userData.gender}
          </Text>
          {userData.parsedBio && (
            <View>
              <Text style={[styles.label, { color: theme.textColor }]}>
                📝 Bio:
              </Text>
              <Text style={[styles.bioText, { color: theme.textColor }]}>
                {userData.parsedBio}
              </Text>
            </View>
          )}
          {userData.personality && (
            <View>
              <Text style={[styles.label, { color: theme.textColor }]}>
                🧩 Personality Traits:
              </Text>
              <Text style={{ color: theme.textColor }}>
                Extroversion: {userData.personality.extroversion?.toFixed(1)}%
              </Text>
              <Text style={{ color: theme.textColor }}>
                Openness: {userData.personality.openness?.toFixed(1)}%
              </Text>
              <Text style={{ color: theme.textColor }}>
                Conscientiousness:{" "}
                {userData.personality.conscientiousness?.toFixed(1)}%
              </Text>
              <Text style={{ color: theme.textColor }}>
                Agreeableness: {userData.personality.agreeableness?.toFixed(1)}%
              </Text>
              <Text style={{ color: theme.textColor }}>
                Neuroticism: {userData.personality.neuroticism?.toFixed(1)}%
              </Text>
            </View>
          )}
          <Text style={[styles.immutableNote, { color: "red" }]}>
            🔒 This data is immutable and stored on the Polygon blockchain.
          </Text>
        </View>
      )}
      {!loading && !userData && (
        <Text style={{ color: theme.textColor }}>
          No profile data found. Complete sign-up to connect your pieces!
        </Text>
      )}
      <View style={styles.photosContainer}>
        <Text
          style={{
            color: theme.textColor,
            fontSize: 18,
            fontWeight: "bold",
            marginBottom: 10,
          }}
        >
          📸 Your Photos ({photos.length}/4 pieces)
        </Text>
        <View style={styles.photosGrid}>
          {/* Render existing photos */}
          {photos.map((uri, index) => (
            <View key={`photo-${index}`} style={styles.photoContainer}>
              <Image source={{ uri }} style={styles.photo} />
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => {
                  showCustomModal(
                    "Remove Photo",
                    "Are you sure you want to remove this photo?",
                    [
                      {
                        text: "Cancel",
                        style: "cancel",
                        onPress: () => setModalVisible(false),
                      },
                      {
                        text: "Remove",
                        style: "destructive",
                        onPress: () => {
                          setModalVisible(false);
                          deletePhoto(index);
                        },
                      },
                    ]
                  );
                }}
                disabled={uploading}
              >
                <Text style={styles.deleteText}>❌</Text>
              </TouchableOpacity>
            </View>
          ))}

          {/* Render empty slots for adding photos */}
          {Array.from(
            {
              length: Math.max(0, 4 - photos.length),
            },
            (_, index) => (
              <TouchableOpacity
                key={`empty-${index}`}
                style={[styles.photoContainer, styles.emptyPhotoContainer]}
                onPress={pickImage}
                disabled={uploading}
              >
                <View style={styles.emptyPhoto}>
                  <Text style={styles.addPhotoText}>+</Text>
                </View>
              </TouchableOpacity>
            )
          )}
        </View>

        {uploading && (
          <Text
            style={{
              color: theme.textColor,
              textAlign: "center",
              marginTop: 10,
            }}
          >
            Uploading photo...
          </Text>
        )}
      </View>
      <View style={styles.preferencesContainer}>
        <Text
          style={{
            color: theme.textColor,
            fontSize: 18,
            fontWeight: "bold",
            marginBottom: 10,
          }}
        >
          ⚙️ Connection Preferences
        </Text>
        <TouchableOpacity
          onPress={() => togglePreference("showAge")}
          style={[theme.button, { padding: 12 }]}
        >
          <Text style={theme.buttonTextStyle}>
            Show Age: {preferences.showAge ? "Yes" : "No"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => togglePreference("showLocation")}
          style={[theme.button, { padding: 12 }]}
        >
          <Text style={theme.buttonTextStyle}>
            Show Location: {preferences.showLocation ? "Yes" : "No"}
          </Text>
        </TouchableOpacity>
      </View>
      <CustomModal
        visible={modalVisible}
        title={modalTitle}
        message={modalMessage}
        buttons={modalButtons}
        onClose={() => setModalVisible(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 24, marginBottom: 20 },
  dataContainer: { marginBottom: 20 },
  label: { fontSize: 16, fontWeight: "bold", marginBottom: 5 },
  bioText: { fontSize: 14, marginBottom: 10 },
  immutableNote: { fontStyle: "italic", color: "red" },
  photosContainer: { marginBottom: 20 },
  photosGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  photoContainer: { width: "23%", aspectRatio: 1, marginBottom: 10 },
  photo: { width: "100%", height: "100%", borderRadius: 8 },
  deleteButton: {
    position: "absolute",
    top: -5,
    right: -5,
    backgroundColor: "red",
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  deleteText: { color: "white", fontSize: 12 },
  emptyPhotoContainer: {
    borderWidth: 2,
    borderColor: "#ccc",
    borderStyle: "dashed",
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  emptyPhoto: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  addPhotoText: {
    fontSize: 32,
    color: "#ccc",
    fontWeight: "bold",
  },
  addPhoto: { padding: 10, backgroundColor: "lightblue", margin: 5 },
  placeholderPhoto: { opacity: 0.7 },
  placeholderOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: {
    color: "white",
    fontSize: 10,
    fontWeight: "bold",
    textAlign: "center",
  },
  preferencesContainer: { marginBottom: 20 },
});
