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
  const [placeholderImages, setPlaceholderImages] = useState<string[]>([]); // Images waiting for payment
  const [trashedImages, setTrashedImages] = useState<
    { url: string; data: string; index: number }[]
  >([]); // Images moved to trash
  const [showUploadedImages, setShowUploadedImages] = useState(false); // Toggle for uploaded images view
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
              await FirebaseService.downloadUserImageFromArweave(url);
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

        setPlaceholderImages([...placeholderImages, dataUrl]);

        showCustomModal(
          "Image Added",
          "Perfect! Your photo is ready. Just a tiny $0.0008 fee secures it forever on decentralized storage.",
          [
            {
              text: "OK",
              onPress: () => setModalVisible(false),
            },
          ]
        );
      }
    } catch (error) {
      console.error("Error picking image:", error);
      showCustomModal("Error", "Failed to pick image");
    }
  };

  const finalizePlaceholderImages = async () => {
    if (placeholderImages.length === 0) return;

    try {
      setUploading(true);

      // Check Arweave balance first
      const balance = await FirebaseService.checkArweaveBalance();
      if (!balance?.hasBalance) {
        // Show payment required modal
        showCustomModal(
          "Payment Required",
          `You have ${
            placeholderImages.length
          } placeholder image(s) that need to be uploaded to Arweave.\n\nCost: ${
            (balance?.costPerImage.matic || 0.001) * placeholderImages.length
          } MATIC ($${
            (balance?.costPerImage.usd || 0.0008) * placeholderImages.length
          })\n\nCurrent balance: ${balance?.balance} MATIC`,
          [
            {
              text: "Cancel",
              style: "cancel",
              onPress: () => setUploading(false),
            },
            {
              text: "Pay & Upload",
              onPress: async () => {
                setModalVisible(false); // Close the payment modal
                try {
                  const totalCost =
                    (balance?.costPerImage.matic || 0.001) *
                    placeholderImages.length;
                  const paidAmount = await FirebaseService.fundArweaveStorage(
                    totalCost,
                    signClient,
                    sessionTopic,
                    address
                  );

                  // Now upload the images
                  await uploadPlaceholderImages(paidAmount);
                } catch (error) {
                  showCustomModal(
                    "Error",
                    "Failed to fund storage. Please try again."
                  );
                  setUploading(false);
                }
              },
            },
          ]
        );
        return;
      }

      // If balance is sufficient, upload directly
      await uploadPlaceholderImages();
    } catch (error) {
      console.error("Error finalizing images:", error);
      showCustomModal("Error", "Failed to finalize images");
      setUploading(false);
    }
  };

  const uploadPlaceholderImages = async (paidAmount?: number) => {
    try {
      // Initialize Firebase user keys if needed
      await FirebaseService.initializeUser(address);

      const uploadedUrls: string[] = [];

      for (let i = 0; i < placeholderImages.length; i++) {
        const placeholderImage = placeholderImages[i];
        const imageIndex = photos.length + i;

        // Extract base64 from data URL
        const base64Match = placeholderImage.match(
          /^data:image\/[^;]+;base64,(.+)$/
        );
        if (!base64Match) continue;

        const base64Data = base64Match[1];

        // Upload to Arweave
        const downloadUrl = await FirebaseService.uploadUserImageFromBase64(
          base64Data,
          address,
          imageIndex,
          paidAmount
        );

        uploadedUrls.push(downloadUrl);
      }

      // Update photo URLs in Firebase
      const newPhotoUrls = [...photoUrls, ...uploadedUrls];
      await FirebaseService.updateUserPhotoUrls(address, newPhotoUrls);

      // Move placeholder images to photos
      setPhotos([...photos, ...placeholderImages]);
      setPhotoUrls(newPhotoUrls);
      setPlaceholderImages([]);

      showCustomModal(
        "Success",
        `${uploadedUrls.length} image(s) uploaded successfully!`,
        [
          {
            text: "OK",
            onPress: () => setModalVisible(false),
          },
        ]
      );
    } catch (error) {
      console.error("Error uploading placeholder images:", error);
      showCustomModal("Error", "Failed to upload some images", [
        {
          text: "OK",
          onPress: () => setModalVisible(false),
        },
      ]);
    } finally {
      setUploading(false);
    }
  };

  const deletePhoto = async (index: number) => {
    showCustomModal(
      "Remove Photo",
      "What would you like to do with this photo?",
      [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => setModalVisible(false),
        },
        {
          text: "Move to Trash",
          onPress: async () => {
            try {
              setModalVisible(false);
              // Move to trash - keep in local state but hide from main view
              const trashedPhoto = {
                url: photoUrls[index],
                data: photos[index],
                index: index,
              };
              setTrashedImages([...trashedImages, trashedPhoto]);

              // Remove from main view
              const newPhotoUrls = photoUrls.filter((_, i) => i !== index);
              const newPhotos = photos.filter((_, i) => i !== index);
              setPhotos(newPhotos);
              setPhotoUrls(newPhotoUrls);

              // Update Firebase to reflect the change
              await FirebaseService.updateUserPhotoUrls(address, newPhotoUrls);

              showCustomModal("Success", "Photo moved to trash!", [
                { text: "OK", onPress: () => setModalVisible(false) },
              ]);
            } catch (error) {
              console.error("Error moving photo to trash:", error);
              showCustomModal("Error", "Failed to move photo to trash", [
                { text: "OK", onPress: () => setModalVisible(false) },
              ]);
            }
          },
        },
        {
          text: "Remove Completely",
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

              showCustomModal("Success", "Photo removed completely!", [
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
    // Check against placeholder images
    for (const existingUri of placeholderImages) {
      if (existingUri === newImageUri) {
        return true;
      }
    }
    return false;
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
          📸 Your Photos ({photos.length + placeholderImages.length}/4 pieces)
        </Text>
        <View style={styles.photosGrid}>
          {/* Toggle for uploaded images management */}
          <TouchableOpacity
            style={[styles.toggleButton, { borderColor: theme.textColor }]}
            onPress={() => setShowUploadedImages(!showUploadedImages)}
          >
            <Text style={[styles.toggleButtonText, { color: theme.textColor }]}>
              {showUploadedImages ? "⬆️ Hide" : "⬇️ Show"} Uploaded Arweave
              Images ({trashedImages.length} in trash)
            </Text>
          </TouchableOpacity>

          {showUploadedImages && (
            <View style={styles.trashSection}>
              <Text style={[styles.subTitle, { color: theme.textColor }]}>
                🗑️ Trashed Images (Can be restored)
              </Text>
              <View style={styles.photosGrid}>
                {trashedImages.map((trashed, index) => (
                  <View key={`trashed-${index}`} style={styles.photoContainer}>
                    <Image
                      source={{ uri: trashed.data }}
                      style={styles.photo}
                    />
                    <View style={styles.trashActions}>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.restoreButton]}
                        onPress={() => {
                          // Restore from trash
                          const restoredPhoto = trashedImages[index];
                          setPhotos([...photos, restoredPhoto.data]);
                          setPhotoUrls([...photoUrls, restoredPhoto.url]);
                          setTrashedImages(
                            trashedImages.filter((_, i) => i !== index)
                          );
                          // Update Firebase
                          FirebaseService.updateUserPhotoUrls(address, [
                            ...photoUrls,
                            restoredPhoto.url,
                          ]);
                          showCustomModal("Success", "Photo restored!", [
                            {
                              text: "OK",
                              onPress: () => setModalVisible(false),
                            },
                          ]);
                        }}
                      >
                        <Text style={styles.actionText}>↩️ Restore</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.deleteButton]}
                        onPress={() => {
                          // Permanently delete
                          setTrashedImages(
                            trashedImages.filter((_, i) => i !== index)
                          );
                          showCustomModal(
                            "Success",
                            "Photo permanently deleted!",
                            [
                              {
                                text: "OK",
                                onPress: () => setModalVisible(false),
                              },
                            ]
                          );
                        }}
                      >
                        <Text style={styles.actionText}>🗑️ Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Render existing photos */}
          {photos.map((uri, index) => (
            <View key={`photo-${index}`} style={styles.photoContainer}>
              <Image source={{ uri }} style={styles.photo} />
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => deletePhoto(index)}
                disabled={uploading}
              >
                <Text style={styles.deleteText}>❌</Text>
              </TouchableOpacity>
            </View>
          ))}

          {/* Render placeholder images */}
          {placeholderImages.map((uri, index) => (
            <View key={`placeholder-${index}`} style={styles.photoContainer}>
              <Image
                source={{ uri }}
                style={[styles.photo, styles.placeholderPhoto]}
              />
              <View style={styles.placeholderOverlay}>
                <Text style={styles.placeholderText}>💰 Pending Payment</Text>
              </View>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => {
                  // Remove this placeholder image
                  setPlaceholderImages(placeholderImages.filter((_, i) => i !== index));
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
              length: Math.max(0, 4 - photos.length - placeholderImages.length),
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

        <TouchableOpacity
          onPress={pickImage}
          style={[theme.button, { marginTop: 10 }]}
          disabled={uploading || photos.length >= 4}
        >
          <Text style={theme.buttonTextStyle}>📷 Add Photo Piece</Text>
        </TouchableOpacity>

        {placeholderImages.length > 0 && (
          <TouchableOpacity
            onPress={finalizePlaceholderImages}
            style={[
              theme.button,
              { marginTop: 10, backgroundColor: "#4CAF50" },
            ]}
            disabled={uploading}
          >
            <Text style={theme.buttonTextStyle}>
              💰 Finalize {placeholderImages.length} Photo
              {placeholderImages.length > 1 ? "s" : ""} ($
              {(0.0008 * placeholderImages.length).toFixed(4)})
            </Text>
          </TouchableOpacity>
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
  photosGrid: { flexDirection: "row", flexWrap: "wrap" },
  photoContainer: { position: "relative", margin: 5 },
  photo: { width: 100, height: 100 },
  deleteButton: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: "red",
    width: 20,
    height: 20,
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
    fontSize: 12,
    fontWeight: "bold",
    textAlign: "center",
  },
  toggleButton: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    alignItems: "center",
  },
  toggleButtonText: {
    fontSize: 14,
    fontWeight: "bold",
  },
  trashSection: {
    marginBottom: 20,
    padding: 10,
    backgroundColor: "rgba(0,0,0,0.1)",
    borderRadius: 8,
  },
  subTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 10,
  },
  trashActions: {
    position: "absolute",
    bottom: 5,
    left: 5,
    right: 5,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  actionButton: {
    padding: 5,
    borderRadius: 4,
    minWidth: 60,
    alignItems: "center",
  },
  restoreButton: {
    backgroundColor: "green",
  },
  actionText: {
    color: "white",
    fontSize: 10,
    fontWeight: "bold",
  },
  preferencesContainer: { marginBottom: 20 },
});
