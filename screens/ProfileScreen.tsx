import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Alert } from "react-native";
import { useWallet } from "../contexts/WalletContext";
import * as ImagePicker from "expo-image-picker";
import { getUserData } from "../utils/contract";

export default function ProfileScreen() {
  const { address } = useWallet();
  const [userData, setUserData] = useState<any>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [preferences, setPreferences] = useState<Record<string, boolean>>({
    showAge: true,
    showLocation: true,
    // add more
  });

  useEffect(() => {
    if (address) {
      loadUserData();
    }
  }, [address]);

  const loadUserData = async () => {
    try {
      const data = await getUserData(address);
      setUserData(data);
    } catch (error) {
      Alert.alert("Error", "Failed to load user data");
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
      setPhotos([...photos, result.assets[0].uri]);
    }
  };

  const togglePreference = (key: string) => {
    setPreferences({ ...preferences, [key]: !preferences[key] });
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Profile</Text>
      {userData && (
        <View style={styles.dataContainer}>
          <Text>Name: {userData.name}</Text>
          <Text>Age: {userData.age}</Text>
          <Text>City: {userData.city}</Text>
          <Text>Bio: {userData.bio}</Text>
          <Text style={styles.immutableNote}>This data is immutable and stored on the Polygon blockchain.</Text>
        </View>
      )}
      <View style={styles.photosContainer}>
        <Text>Photos (up to 4):</Text>
        {photos.map((uri, index) => (
          <Image key={index} source={{ uri }} style={styles.photo} />
        ))}
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
  immutableNote: { fontStyle: 'italic', color: 'red' },
  photosContainer: { marginBottom: 20 },
  photo: { width: 100, height: 100, margin: 5 },
  addPhoto: { padding: 10, backgroundColor: 'lightblue', margin: 5 },
  preferencesContainer: { marginBottom: 20 },
});
