import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "../contexts/ThemeContext";

export default function NeuralNetworksScreen() {
  const { theme } = useTheme();

  return (
    <View
      style={[styles.container, { backgroundColor: theme.backgroundColor }]}
    >
      <Text style={[styles.title, { color: theme.textColor }]}>
        🧠 Neural Networks
      </Text>
      <Text style={[styles.description, { color: theme.textColor }]}>
        Connect with AI-powered matchmaking and personalized experiences. Our
        neural networks learn your preferences to create meaningful connections.
      </Text>
      <Text style={[styles.comingSoon, { color: theme.textColor + "80" }]}>
        AI enhancement features coming soon...
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
  description: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 20,
  },
  comingSoon: {
    fontSize: 14,
    fontStyle: "italic",
  },
});
