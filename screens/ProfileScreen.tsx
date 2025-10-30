import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Alert } from "react-native";
import { useWallet } from "../contexts/WalletContext";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import CryptoJS from "crypto-js";
import { getUserData } from "../utils/contract";

export default function ProfileScreen() {
  const { address } = useWallet();
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
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
      if (data.bio && data.bio.startsWith('{')) {
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
      Alert.alert("Error", "Failed to load user data: " + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const loadPhotos = async () => {
    try {
      const stored = await AsyncStorage.getItem(`photos_${address}`);
      if (stored) {
        const decrypted = CryptoJS.AES.decrypt(stored, address).toString(CryptoJS.enc.Utf8);
        setPhotos(JSON.parse(decrypted));
      }
    } catch (error) {
      console.error("Error loading photos:", error);
    }
  };

  const savePhotos = async (newPhotos: string[]) => {
    try {
      const encrypted = CryptoJS.AES.encrypt(JSON.stringify(newPhotos), address).toString();
      await AsyncStorage.setItem(`photos_${address}`, encrypted);
    } catch (error) {
      console.error("Error saving photos:", error);
    }
  };

  const pickImage = async () => {
    if (photos.length >= 4) {
      Alert.alert("Limit", "You can add up to 4 photos");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      const newPhotos = [...photos, result.assets[0].uri];
      setPhotos(newPhotos);
      await savePhotos(newPhotos);
    }
  };

  const deletePhoto = async (index: number) => {
    Alert.alert(
      "Delete Photo",
      "Are you sure you want to delete this photo?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          onPress: async () => {
            const newPhotos = photos.filter((_, i) => i !== index);
            setPhotos(newPhotos);
            await savePhotos(newPhotos);
          },
        },
      ]
    );
  };

  const togglePreference = (key: string) => {
    setPreferences({ ...preferences, [key]: !preferences[key] });
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Profile</Text>
      {loading && <Text>Loading user data...</Text>}
      {userData && (
        <View style={styles.dataContainer}>
          <Text style={styles.label}>Name: {userData.name}</Text>
          {userData.age !== null && <Text style={styles.label}>Age: {userData.age}</Text>}
          <Text style={styles.label}>City: {userData.city}</Text>
          <Text style={styles.label}>MBTI: {userData.mbti}</Text>
          <Text style={styles.label}>Gender: {userData.gender}</Text>
          {userData.parsedBio && (
            <View>
              <Text style={styles.label}>Bio:</Text>
              <Text style={styles.bioText}>{userData.parsedBio}</Text>
            </View>
          )}
          {userData.personality && (
            <View>
              <Text style={styles.label}>Personality Traits:</Text>
              <Text>Extroversion: {userData.personality.extroversion?.toFixed(1)}%</Text>
              <Text>Openness: {userData.personality.openness?.toFixed(1)}%</Text>
              <Text>Conscientiousness: {userData.personality.conscientiousness?.toFixed(1)}%</Text>
              <Text>Agreeableness: {userData.personality.agreeableness?.toFixed(1)}%</Text>
              <Text>Neuroticism: {userData.personality.neuroticism?.toFixed(1)}%</Text>
            </View>
          )}
          <Text style={styles.immutableNote}>This data is immutable and stored on the Polygon blockchain.</Text>
        </View>
      )}
      {!loading && !userData && <Text>No user data found. Please sign up first.</Text>}
      <View style={styles.photosContainer}>
        <Text>Photos (up to 4):</Text>
        <View style={styles.photosGrid}>
          {photos.map((uri, index) => (
            <View key={index} style={styles.photoContainer}>
              <Image source={{ uri }} style={styles.photo} />
              <TouchableOpacity style={styles.deleteButton} onPress={() => deletePhoto(index)}>
                <Text style={styles.deleteText}>X</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
        <TouchableOpacity onPress={pickImage} style={styles.addPhoto}>
          <Text>Add Photo</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.preferencesContainer}>
        <Text>Preferences:</Text>
        <TouchableOpacity onPress={() => togglePreference('showAge')}>
          <Text>Show Age: {preferences.showAge ? 'Yes' : 'No'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => togglePreference('showLocation')}>
          <Text>Show Location: {preferences.showLocation ? 'Yes' : 'No'}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 24, marginBottom: 20 },
  dataContainer: { marginBottom: 20 },
  label: { fontSize: 16, fontWeight: 'bold', marginBottom: 5 },
  bioText: { fontSize: 14, marginBottom: 10 },
  immutableNote: { fontStyle: 'italic', color: 'red' },
  photosContainer: { marginBottom: 20 },
  photosGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  photoContainer: { position: 'relative', margin: 5 },
  photo: { width: 100, height: 100 },
  deleteButton: { position: 'absolute', top: 0, right: 0, backgroundColor: 'red', width: 20, height: 20, justifyContent: 'center', alignItems: 'center' },
  deleteText: { color: 'white', fontSize: 12 },
  addPhoto: { padding: 10, backgroundColor: 'lightblue', margin: 5 },
  preferencesContainer: { marginBottom: 20 },
});
