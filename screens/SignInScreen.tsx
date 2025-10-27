import React, { useEffect, useState } from "react";
import { View, Text, Button, StyleSheet, Alert } from "react-native";
import { useWallet } from "../contexts/WalletContext";
import { getContract, signInUser, isUserRegistered } from "../utils/contract";

export default function SignInScreen({ navigation }) {
  const { address, provider } = useWallet();
  const [isRegistered, setIsRegistered] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkRegistration();
  }, [address]);

  const checkRegistration = async () => {
    if (!address || !provider) return;
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Request timed out")), 10000)
    );
    try {
      const registered = await Promise.race([
        isUserRegistered(provider, address),
        timeout,
      ]);
      setIsRegistered(registered);
    } catch (error: any) {
      console.error("Check registration error:", error);
      setIsRegistered(false); // Assume not registered if check fails
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async () => {
    if (isRegistered) {
      try {
        await signInUser(provider);
        navigation.navigate("Main");
      } catch (error: any) {
        Alert.alert("Error", "Failed to sign in: " + error.message);
      }
    } else {
      navigation.navigate("Auth", { screen: "SignUp" });
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to Fuse</Text>
      <Text>Wallet Address: {address}</Text>
      <Button
        title={isRegistered ? "Sign In to Proceed" : "Sign Up to Proceed"}
        onPress={handleSignIn}
      />
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
});
