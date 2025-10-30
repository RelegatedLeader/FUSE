import React, { useState } from "react";
import { View, Text, TextInput, Button, StyleSheet, TouchableOpacity } from "react-native";
import { useTheme } from "../contexts/ThemeContext";

export default function AlliancesScreen() {
  const { theme } = useTheme();
  const [search, setSearch] = useState("");

  const handleSearch = () => {
    // AI search for alliances
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <Text style={theme.title}>Alliances</Text>
      <Text style={theme.subtitle}>Form powerful network connections</Text>
      <Text style={{ color: theme.textColor, textAlign: 'center', marginBottom: 20, fontSize: 16 }}>
        🤝 Connect with 4 compatible pieces to unlock alliance powers
      </Text>
      <TextInput
        style={theme.input}
        placeholder="🔍 AI Search for alliance partners"
        placeholderTextColor={theme.textColor}
        value={search}
        onChangeText={setSearch}
      />
      <TouchableOpacity style={theme.button} onPress={handleSearch}>
        <Text style={theme.buttonTextStyle}>🔍 Search & Connect</Text>
      </TouchableOpacity>
      <Text style={{ color: theme.textColor, textAlign: 'center', marginTop: 20, fontSize: 16 }}>
        Build your alliance network and unlock new social dimensions!
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
  title: { fontSize: 24, marginBottom: 20 },
  input: { borderWidth: 1, padding: 10, marginBottom: 10, width: "100%" },
});
