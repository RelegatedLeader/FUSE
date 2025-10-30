import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "../contexts/ThemeContext";

export default function CyberspaceScreen() {
  const { theme } = useTheme();
  return (
    <View
      style={[styles.container, { backgroundColor: theme.backgroundColor }]}
    >
      <Text style={theme.title}>Cyberspace</Text>
      <Text style={theme.subtitle}>Your alliance unlocks new dimensions</Text>
      <Text
        style={{
          color: theme.textColor,
          textAlign: "center",
          fontSize: 16,
          marginTop: 20,
        }}
      >
        🌌 Form alliances with 4 compatible connections to unlock this social
        dimension.{"\n\n"}Share ideas, collaborate, and explore the infinite
        possibilities of connected networks!
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 24, marginBottom: 20 },
});
