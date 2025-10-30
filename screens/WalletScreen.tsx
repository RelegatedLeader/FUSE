import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Button,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
  TouchableOpacity,
} from "react-native";
import { useWallet } from "../contexts/WalletContext";
import { useTheme } from "../contexts/ThemeContext";
import { StackNavigationProp } from "@react-navigation/stack";

// Define navigation types
type RootStackParamList = {
  Wallet: undefined;
  SignUp: undefined;
  SignIn: undefined;
  Main: undefined;
};

type WalletScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  "Wallet"
>;

type Props = {
  navigation: WalletScreenNavigationProp;
};

export default function WalletScreen({ navigation }: Props) {
  const {
    address,
    connectWallet,
    disconnectWallet,
    clearAllSessions,
    isConnecting,
  } = useWallet();
  const { theme } = useTheme();

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
      <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
        {/* Logo */}
        <Image
          source={require('../assets/puzzle_rocket_no_background.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        
        {/* Title */}
        <Text style={theme.title}>Fuse</Text>
        
        {/* Gimmick */}
        <Text style={theme.subtitle}>Connected & Ready to Launch</Text>
        
        <Text style={{ color: theme.textColor, textAlign: 'center', marginBottom: 30 }}>
          Wallet: {address.slice(0, 6)}...{address.slice(-4)}
        </Text>
        
        <TouchableOpacity style={theme.button} onPress={() => navigation.navigate("SignIn")}>
          <Text style={theme.buttonTextStyle}>🚀 Proceed to Fuse</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={[theme.button, { backgroundColor: 'red', marginTop: 10 }]} onPress={handleDisconnect}>
          <Text style={[theme.buttonTextStyle, { color: 'white' }]}>Disconnect</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      {/* Logo */}
      <Image
        source={require('../assets/puzzle_rocket_no_background.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      
      {/* Title */}
      <Text style={theme.title}>Fuse</Text>
      
      {/* Gimmick */}
      <Text style={theme.subtitle}>Connect your network pieces</Text>
      
      <Text style={{ color: theme.textColor, textAlign: 'center', marginBottom: 30, fontSize: 16 }}>
        Piece together connections that launch your social network into orbit
      </Text>
      
      {isConnecting ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.buttonBackground} />
          <Text style={[styles.loadingText, { color: theme.textColor }]}>Connecting to MetaMask...</Text>
        </View>
      ) : (
        <TouchableOpacity style={theme.button} onPress={handleConnect}>
          <Text style={theme.buttonTextStyle}>🚀 Fuse with MetaMask</Text>
        </TouchableOpacity>
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
  logo: {
    width: 150,
    height: 150,
    marginBottom: 20,
  },
  loadingContainer: { marginTop: 20, alignItems: "center" },
  loadingText: { marginTop: 10, fontSize: 16 },
});
