import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Button,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useWallet } from "../contexts/WalletContext";
import { StackNavigationProp } from "@react-navigation/stack";

// Define navigation types
type RootStackParamList = {
  Wallet: undefined;
  SignUp: undefined;
  SignIn: undefined;
  Main: undefined;
};

type WalletScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Wallet'>;

type Props = {
  navigation: WalletScreenNavigationProp;
};

export default function WalletScreen({ navigation }: Props) {
  const { address, connectWallet, disconnectWallet, clearAllSessions, isConnecting } = useWallet();

  useEffect(() => {
    if (address) {
      navigation.navigate("SignIn");
    }
  }, [address, navigation]);

  const handleConnect = async () => {
    try {
      await connectWallet();
      // Navigation will happen automatically when address is set
    } catch (error: any) {
      Alert.alert("Connection Error", error.message);
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

  const handleClearSessions = async () => {
    try {
      await clearAllSessions();
      Alert.alert("Cleared", "All sessions cleared. App will restart fresh.");
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
        <Button title="Clear All Sessions" onPress={handleClearSessions} color="red" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Connect Your Wallet</Text>
      <Text>Connect MetaMask to access Fuse on Polygon.</Text>
      {isConnecting ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0000ff" />
          <Text style={styles.loadingText}>Connecting to MetaMask...</Text>
        </View>
      ) : (
        <Button title="Connect MetaMask" onPress={handleConnect} />
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
  subtitle: {
    fontSize: 16,
    marginBottom: 10,
    color: "#666",
    textAlign: "center",
  },
  loadingContainer: { marginTop: 20, alignItems: "center" },
  loadingText: { marginTop: 10, fontSize: 16 },
});
