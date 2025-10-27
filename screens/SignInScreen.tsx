import React, { useEffect, useState } from "react";
import { View, Text, Button, StyleSheet, Alert } from "react-native";
import { useWallet } from "../contexts/WalletContext";

export default function SignInScreen({ navigation }) {
  const { address, isRegistered, signIn, checkRegistration } = useWallet();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initialize = async () => {
      if (address) {
        await checkRegistration();
      }
      setLoading(false);
    };
    initialize();
  }, [address, checkRegistration]);

  const handleSignIn = async () => {
    if (isRegistered) {
      try {
        await signIn();
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
