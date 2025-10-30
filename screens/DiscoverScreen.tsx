import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from "react-native";
import { useWallet } from "../contexts/WalletContext";
import { useTheme } from "../contexts/ThemeContext";

interface User {
  address: string;
  name: string;
  age: number;
  city: string;
  bio: string;
  photos: string[];
  interests: string[];
  musicGenres: string[];
  gaming: boolean;
}

export default function DiscoverScreen() {
  const { address } = useWallet();
  const { theme } = useTheme();
  const [users, setUsers] = useState<User[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    // Mock users with different interests for discovery
    const mockUsers: User[] = [
      {
        address: "0x123",
        name: "Alex",
        age: 25,
        city: "New York",
        bio: "Gamer and music lover. Into indie rock and RPGs.",
        photos: [],
        interests: ["Gaming", "Music"],
        musicGenres: ["Indie Rock", "Electronic"],
        gaming: true,
      },
      {
        address: "0x456",
        name: "Jordan",
        age: 28,
        city: "Los Angeles",
        bio: "Tech entrepreneur and jazz enthusiast.",
        photos: [],
        interests: ["Technology", "Jazz Music"],
        musicGenres: ["Jazz", "Classical"],
        gaming: false,
      },
      {
        address: "0x789",
        name: "Taylor",
        age: 23,
        city: "Austin",
        bio: "Live music lover and foodie. Always exploring new venues.",
        photos: [],
        interests: ["Live Music", "Food", "Travel"],
        musicGenres: ["Folk", "Country"],
        gaming: false,
      },
    ];
    setUsers(mockUsers);
  }, []);

  const handleLike = () => {
    // TODO: Store like on Arweave
    setCurrentIndex(currentIndex + 1);
  };

  const handlePass = () => {
    setCurrentIndex(currentIndex + 1);
  };

  const currentUser = users[currentIndex];

  if (!currentUser) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
        <Text style={{ color: theme.textColor, textAlign: 'center', fontSize: 18 }}>
          🔍 No more discoveries right now.{'\n'}Check back later for new connections!
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <Text style={theme.title}>Discover</Text>
      <Text style={theme.subtitle}>Find your perfect connections</Text>

      <View style={theme.card}>
        <Text style={[styles.name, { color: theme.textColor }]}>{currentUser.name}, {currentUser.age}</Text>
        <Text style={{ color: theme.textColor, fontSize: 16 }}>📍 {currentUser.city}</Text>

        <View style={styles.interestsContainer}>
          {currentUser.interests.map((interest, index) => (
            <View key={index} style={[styles.interestTag, { backgroundColor: theme.buttonBackground }]}>
              <Text style={{ color: theme.buttonText, fontSize: 12 }}>{interest}</Text>
            </View>
          ))}
        </View>

        <Text style={[styles.bio, { color: theme.textColor }]}>{currentUser.bio}</Text>

        <View style={styles.actionButtons}>
          <TouchableOpacity onPress={handlePass} style={[styles.passButton, { backgroundColor: '#666' }]}>
            <Text style={[styles.buttonText, { color: '#fff' }]}>❌ Pass</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleLike} style={[styles.likeButton, { backgroundColor: theme.buttonBackground }]}>
            <Text style={[styles.buttonText, { color: theme.buttonText }]}>💚 Like</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginVertical: 10,
  },
  interestTag: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    margin: 2,
  },
  bio: {
    fontSize: 16,
    lineHeight: 22,
    marginVertical: 15,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
  },
  passButton: {
    padding: 15,
    borderRadius: 25,
    minWidth: 100,
    alignItems: 'center',
  },
  likeButton: {
    padding: 15,
    borderRadius: 25,
    minWidth: 100,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});