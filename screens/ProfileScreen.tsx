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
import * as ImagePicker from "expo-image-picker";
import { FirebaseService } from "../utils/firebaseService";
import { getUserData } from "../utils/contract";

export default function ProfileScreen() {
  const { address } = useWallet();
  const { theme } = useTheme();
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [preferences, setPreferences] = useState<Record<string, boolean>>({
    showAge: true,
    showLocation: true,
    // add more
  });

  useEffect(() => {
    if (address) {
      loadUserData();
      loadPhotos();
    }
  }, [address]);

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
      for (const url of urls) {
        try {
          const decryptedUri = await FirebaseService.downloadUserImage(
            url,
            address
          );
          decryptedPhotos.push(decryptedUri);
        } catch (error) {
          console.error("Failed to decrypt photo:", error);
        }
      }
      setPhotos(decryptedPhotos);
    } catch (error) {
      console.error("Error loading photos:", error);
    }
  };

  const pickImage = async () => {
    if (photos.length >= 4) {
      Alert.alert("Limit", "You can add up to 4 photos");
      return;
    }

    try {
      setUploading(true);
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
          Alert.alert("Error", "Failed to get image data");
          return;
        }

        // Initialize Firebase if needed
        await FirebaseService.initializeUser(address);

        // Upload encrypted image to Firebase
        const imageIndex = photos.length;
        const downloadUrl = await FirebaseService.uploadUserImageFromBase64(
          address,
          asset.base64,
          imageIndex
        );

        // Update photo URLs in Firebase
        const newPhotoUrls = [...photoUrls, downloadUrl];
        await FirebaseService.updateUserPhotoUrls(address, newPhotoUrls);

        // Add to local state (create data URL for display)
        const dataUrl = `data:image/jpeg;base64,${asset.base64}`;
        setPhotos([...photos, dataUrl]);
        setPhotoUrls(newPhotoUrls);
        Alert.alert("Success", "Photo uploaded successfully!");
      }
    } catch (error) {
      console.error("Error uploading photo:", error);
      Alert.alert("Error", "Failed to upload photo. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const deletePhoto = async (index: number) => {
    Alert.alert("Delete Photo", "Are you sure you want to delete this photo?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        onPress: async () => {
          try {
            setUploading(true);

            // Delete from Firebase Storage
            await FirebaseService.deleteUserImage(address, index);

            // Update photo URLs in Firebase (remove the URL at this index)
            const newPhotoUrls = photoUrls.filter((_, i) => i !== index);
            await FirebaseService.updateUserPhotoUrls(address, newPhotoUrls);

            // Update local state
            const newPhotos = photos.filter((_, i) => i !== index);
            setPhotos(newPhotos);
            setPhotoUrls(newPhotoUrls);

            Alert.alert("Success", "Photo deleted successfully!");
          } catch (error) {
            console.error("Error deleting photo:", error);
            Alert.alert("Error", "Failed to delete photo. Please try again.");
          } finally {
            setUploading(false);
          }
        },
      },
    ]);
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
                onPress={() => deletePhoto(index)}
                disabled={uploading}
              >
                <Text style={styles.deleteText}>❌</Text>
              </TouchableOpacity>
            </View>
          ))}

          {/* Render empty slots for adding photos */}
          {Array.from(
            { length: Math.max(0, 4 - photos.length) },
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
  preferencesContainer: { marginBottom: 20 },
});
