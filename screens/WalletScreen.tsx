import React from "react";
import { View, Text, Button, StyleSheet, Alert } from "react-native";
import { useWallet } from "../contexts/WalletContext";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { updateUserData, addUserEmail } from '../utils/contract';

export default function WalletScreen({ navigation }) {
  const { address, connectWallet, signMessage, disconnectWallet, provider } = useWallet();

  const handleConnect = async () => {
    try {
      await connectWallet();
      navigation.navigate("SignIn");
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };

  const handleSign = async () => {
    try {
      const signature = await signMessage(
        "Connect to Fuse on Polygon Network"
      );
      Alert.alert("Signed", `Signature: ${signature}`);

      // Store user data on blockchain
      const userDataStr = await AsyncStorage.getItem('userData');
      if (userDataStr) {
        const userData = JSON.parse(userDataStr);
        const traitsStr = JSON.stringify(userData.traits);
        const faceStr = userData.faceScanned ? 'face_scanned' : 'not_scanned';
        try {
          await updateUserData(provider, userData.firstName, userData.lastName, userData.id || '', traitsStr, userData.mbti, faceStr, userData.bio);
          if (userData.email) {
            await addUserEmail(provider, userData.email);
          }
          Alert.alert("Success", "Data stored on blockchain!");
          await AsyncStorage.removeItem('userData');
        } catch (error: any) {
          Alert.alert("Error", "Failed to store data: " + error.message);
        }
      }

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
        <Button title="Proceed" onPress={() => navigation.navigate("SignIn")} />
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
