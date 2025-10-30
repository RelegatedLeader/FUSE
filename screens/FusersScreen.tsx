import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
} from "react-native";
import { useWallet } from "../contexts/WalletContext";
import { useTheme } from "../contexts/ThemeContext";

interface ConnectionRequest {
  address: string;
  name: string;
  age: number;
  city: string;
  bio: string;
  timestamp: Date;
}

export default function FusersScreen() {
  const { address } = useWallet();
  const { theme } = useTheme();
  const [requests, setRequests] = useState<ConnectionRequest[]>([]);
  const [animatingIndex, setAnimatingIndex] = useState<number | null>(null);
  const [animationType, setAnimationType] = useState<
    "rocket" | "blackhole" | null
  >(null);
  const rocketAnim = useRef(new Animated.Value(0)).current;
  const blackHoleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Mock connection requests
    const mockRequests: ConnectionRequest[] = [
      {
        address: "0xabc",
        name: "Sam",
        age: 26,
        city: "Seattle",
        bio: "Software developer who loves hiking and board games.",
        timestamp: new Date(),
      },
      {
        address: "0xdef",
        name: "Casey",
        age: 24,
        city: "Portland",
        bio: "Artist and musician. Always up for new adventures!",
        timestamp: new Date(),
      },
    ];
    setRequests(mockRequests);
  }, []);

  const handleFuse = (index: number) => {
    setAnimatingIndex(index);
    setAnimationType("rocket");
    // Rocket launch animation
    Animated.sequence([
      Animated.timing(rocketAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(rocketAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setAnimatingIndex(null);
      setAnimationType(null);
      // Remove the request after animation
      setRequests(requests.filter((_, i) => i !== index));
    });
  };

  const handleReject = (index: number) => {
    setAnimatingIndex(index);
    setAnimationType("blackhole");
    // Black hole animation
    Animated.sequence([
      Animated.timing(blackHoleAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(blackHoleAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setAnimatingIndex(null);
      setAnimationType(null);
      // Remove the request after animation
      setRequests(requests.filter((_, i) => i !== index));
    });
  };

  const rocketTranslateY = rocketAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -200],
  });

  const rocketScale = rocketAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 1.2, 0.8],
  });

  const blackHoleScale = blackHoleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.1],
  });

  const blackHoleOpacity = blackHoleAnim.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [1, 0.5, 0],
  });

  return (
    <View
      style={[styles.container, { backgroundColor: theme.backgroundColor }]}
    >
      <Text style={theme.title}>Fusers</Text>
      <Text style={theme.subtitle}>Connection requests waiting for you</Text>

      <ScrollView style={styles.requestsContainer}>
        {requests.length === 0 ? (
          <View style={theme.card}>
            <Text
              style={{
                color: theme.textColor,
                textAlign: "center",
                fontSize: 16,
              }}
            >
              🚀 No connection requests yet.{"\n"}Keep fusing to attract more
              connections!
            </Text>
          </View>
        ) : (
          requests.map((request, index) => (
            <View key={index} style={theme.card}>
              {animatingIndex === index && (
                <View style={styles.animationOverlay}>
                  {animationType === "rocket" ? (
                    <Animated.Text
                      style={[
                        styles.rocket,
                        {
                          transform: [
                            { translateY: rocketTranslateY },
                            { scale: rocketScale },
                          ],
                        },
                      ]}
                    >
                      🚀
                    </Animated.Text>
                  ) : animationType === "blackhole" ? (
                    <Animated.View
                      style={[
                        styles.blackHole,
                        {
                          transform: [{ scale: blackHoleScale }],
                          opacity: blackHoleOpacity,
                        },
                      ]}
                    >
                      <Text style={styles.blackHoleEmoji}>🕳️</Text>
                    </Animated.View>
                  ) : null}
                </View>
              )}

              <Text style={[styles.name, { color: theme.textColor }]}>
                {request.name}, {request.age}
              </Text>
              <Text style={{ color: theme.textColor, fontSize: 16 }}>
                📍 {request.city}
              </Text>
              <Text style={[styles.bio, { color: theme.textColor }]}>
                {request.bio}
              </Text>

              <View style={styles.actionButtons}>
                <TouchableOpacity
                  onPress={() => handleReject(index)}
                  style={[styles.rejectButton, { backgroundColor: "#dc3545" }]}
                  disabled={animatingIndex !== null}
                >
                  <Text style={[styles.buttonText, { color: "#fff" }]}>
                    🕳️ Reject
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleFuse(index)}
                  style={[
                    styles.fuseButton,
                    { backgroundColor: theme.buttonBackground },
                  ]}
                  disabled={animatingIndex !== null}
                >
                  <Text
                    style={[styles.buttonText, { color: theme.buttonText }]}
                  >
                    🚀 Fuse
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  requestsContainer: {
    flex: 1,
  },
  name: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 8,
  },
  bio: {
    fontSize: 16,
    lineHeight: 22,
    marginVertical: 15,
  },
  actionButtons: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 20,
  },
  rejectButton: {
    padding: 15,
    borderRadius: 25,
    minWidth: 100,
    alignItems: "center",
  },
  fuseButton: {
    padding: 15,
    borderRadius: 25,
    minWidth: 100,
    alignItems: "center",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  animationOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    zIndex: 10,
    borderRadius: 15,
  },
  rocket: {
    fontSize: 60,
  },
  blackHole: {
    justifyContent: "center",
    alignItems: "center",
  },
  blackHoleEmoji: {
    fontSize: 60,
  },
});
