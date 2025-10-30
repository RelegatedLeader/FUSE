import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Animated, Alert } from "react-native";
import { useWallet } from "../contexts/WalletContext";
import { getUserData } from "../utils/contract";

interface User {
  address: string;
  name: string;
  age: number;
  city: string;
  bio: string;
  photos: string[];
}

export default function FuseScreen() {
  const { address } = useWallet();
  const [users, setUsers] = useState<User[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showBio, setShowBio] = useState(false);
  const fuseAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    // Mock users for now - in real app, fetch from algorithm
    const mockUsers: User[] = [
      {
        address: "0x123",
        name: "Alice",
        age: 25,
        city: "New York",
        bio: "Loves hiking and coding.",
        photos: [],
      },
      {
        address: "0x456",
        name: "Bob",
        age: 30,
        city: "San Francisco",
        bio: "Enjoys music and travel.",
        photos: [],
      },
    ];
    setUsers(mockUsers);
  }, []);

  const handleFuse = () => {
    // Animate fusing
    Animated.sequence([
      Animated.timing(fuseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(fuseAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
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
      <View style={styles.container}>
        <Text>No more users to match with.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.card}>
          <TouchableOpacity onPress={() => setShowBio(!showBio)} style={styles.leftTap}>
            <Text>Tap for Bio</Text>
          </TouchableOpacity>
          <View style={styles.userInfo}>
            <Text style={styles.name}>{currentUser.name}, {currentUser.age}</Text>
            <Text>{currentUser.city}</Text>
            {showBio && <Text style={styles.bio}>{currentUser.bio}</Text>}
          </View>
          <TouchableOpacity onPress={handleFuse} style={styles.fuseButton}>
            <Animated.Text style={[styles.fuseText, { transform: [{ scale: fuseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] }) }] }]}>
              🚀 Fuse
            </Animated.Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
          <Text>Skip</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContainer: { alignItems: "center", padding: 20 },
  card: { width: "90%", backgroundColor: "white", borderRadius: 10, padding: 20, marginBottom: 20, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 5 },
  leftTap: { position: "absolute", left: 10, top: 10, backgroundColor: "lightgray", padding: 5, borderRadius: 5 },
  userInfo: { alignItems: "center" },
  name: { fontSize: 24, fontWeight: "bold" },
  bio: { marginTop: 10, fontStyle: "italic" },
  fuseButton: { marginTop: 20, backgroundColor: "blue", padding: 15, borderRadius: 10 },
  fuseText: { color: "white", fontSize: 18 },
  skipButton: { padding: 10, backgroundColor: "gray" },
});
