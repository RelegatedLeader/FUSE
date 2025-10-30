import React, { useState } from "react";
import { View, Text, TextInput, Button, StyleSheet } from "react-native";
import { useTheme } from "../contexts/ThemeContext";

export default function AlliancesScreen() {
  const { theme } = useTheme();
  const [search, setSearch] = useState("");

  const handleSearch = () => {
    // AI search for alliances
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <Text style={[styles.title, { color: theme.textColor }]}>Alliances</Text>
      <TextInput
        style={[styles.input, { backgroundColor: theme.buttonBackground, color: theme.buttonText, borderColor: theme.textColor }]}
        placeholder="AI Search for groups"
        placeholderTextColor={theme.textColor}
        value={search}
        onChangeText={setSearch}
      />
      <Button title="Search" onPress={handleSearch} />
      <Text style={{ color: theme.textColor }}>Form alliances with 4 compatible people.</Text>
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
  title: { fontSize: 24, marginBottom: 20 },
  input: { borderWidth: 1, padding: 10, marginBottom: 10, width: "100%" },
});
