import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { useWallet } from "../contexts/WalletContext";

export default function SettingsScreen() {
  const { address, disconnectWallet } = useWallet();

  const handleDisconnect = async () => {
    try {
      await disconnectWallet();
      // Navigate back or something
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Settings</Text>
      <TouchableOpacity onPress={handleDisconnect} style={styles.button}>
        <Text>Logout</Text>
      </TouchableOpacity>
      {/* Add more settings */}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 24, marginBottom: 20 },
  button: { padding: 15, backgroundColor: "red", marginBottom: 10 },
});