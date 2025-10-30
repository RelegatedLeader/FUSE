import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "../contexts/ThemeContext";

export default function TeamsScreen() {
  const { theme } = useTheme();

  return (
    <View
      style={[styles.container, { backgroundColor: theme.backgroundColor }]}
    >
      <Text style={[styles.title, { color: theme.textColor }]}>🛡️ Teams</Text>
      <Text style={[styles.description, { color: theme.textColor }]}>
        Form strategic alliances with like-minded individuals. Build teams for
        collaborative projects and shared victories in the FUSE ecosystem.
      </Text>
      <Text style={[styles.comingSoon, { color: theme.textColor + "80" }]}>
        Feature coming soon...
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
