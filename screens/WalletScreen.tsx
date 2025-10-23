import React from "react";
import { View, Text, Button, StyleSheet, Alert } from "react-native";
import { useWallet } from "../contexts/WalletContext";

export default function WalletScreen({ navigation }) {
  const { address, connectWallet, signMessage, disconnectWallet } = useWallet();

  const handleConnect = async () => {
    try {
      await connectWallet();
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };

  const handleSign = async () => {
    try {
      const signature = await signMessage(
        "Connect to Fuse on Galactica Network"
      );
      Alert.alert("Signed", `Signature: ${signature}`);
      navigation.navigate("Auth", { walletAddress: address });
    } catch (error: any) {
      Alert.alert("Error", error.message);
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
        <Button title="Sign to Proceed" onPress={handleSign} />
        <Button title="Disconnect" onPress={handleDisconnect} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Connect Your Wallet</Text>
      <Text>Connect via WalletConnect to access Fuse.</Text>
      <Button title="Connect Wallet" onPress={handleConnect} />
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
  qrContainer: { marginTop: 20, alignItems: "center" },
});
