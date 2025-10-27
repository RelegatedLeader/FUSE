import React, { useState, useEffect } from "react";
import { View, Text, Button, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { useWallet } from "../contexts/WalletContext";

export default function WalletScreen({ navigation }) {
  const { address, connectWallet, disconnectWallet } = useWallet();
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    if (address) {
      setConnecting(false);
      navigation.navigate("SignIn");
    }
  }, [address, navigation]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      await connectWallet();
      // Navigation will happen automatically when address is set
    } catch (error: any) {
      Alert.alert("Connection Error", error.message);
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectWallet();
      Alert.alert("Disconnected", "Wallet disconnected successfully.");
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };

  if (address) {
    return (
      <View style={styles.container}>
        <Text>Connected Wallet: {address}</Text>
        <Button title="Proceed" onPress={() => navigation.navigate("SignIn")} />
        <Button title="Disconnect" onPress={handleDisconnect} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Connect Your Wallet</Text>
      <Text>Connect via WalletConnect to access Fuse.</Text>
      {connecting ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0000ff" />
          <Text style={styles.loadingText}>Connecting to wallet...</Text>
        </View>
      ) : (
        <Button title="Connect Wallet" onPress={handleConnect} />
      )}
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
  title: { fontSize: 24, marginBottom: 20, textAlign: "center" },
  loadingContainer: { marginTop: 20, alignItems: "center" },
  loadingText: { marginTop: 10, fontSize: 16 },
});
