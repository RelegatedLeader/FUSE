import "react-native-get-random-values";
import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import PagerView from "react-native-pager-view";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { WalletProvider, useWallet } from "./contexts/WalletContext";

import WelcomeScreen from "./screens/WelcomeScreen";
import WalletScreen from "./screens/WalletScreen";
import SignInScreen from "./screens/SignInScreen";
import SignUpScreen from "./screens/SignUpScreen";
import LoginScreen from "./screens/LoginScreen";
import FuseScreen from "./screens/FuseScreen";
import AlliancesScreen from "./screens/AlliancesScreen";
import CyberspaceScreen from "./screens/CyberspaceScreen";
import ProfileScreen from "./screens/ProfileScreen";
import RandomArenaScreen from "./screens/RandomArenaScreen";

const Stack = createStackNavigator();

function MainPager() {
  const { address, disconnectWallet } = useWallet();

  const handleDisconnect = async () => {
    try {
      await disconnectWallet();
      Alert.alert("Disconnected", "Wallet disconnected successfully.");
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      {address && (
        <View style={styles.header}>
          <TouchableOpacity onPress={handleDisconnect}>
            <Text>
              Wallet: {address.slice(0, 6)}...{address.slice(-4)}
            </Text>
          </TouchableOpacity>
        </View>
      )}
      <View style={styles.tabBar}>
        <TouchableOpacity style={styles.tab}>
          <Text>Alliances</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tab}>
          <Text>Fuse</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tab}>
          <Text>Cyberspace</Text>
        </TouchableOpacity>
      </View>
      <PagerView style={{ flex: 1 }} initialPage={1}>
        <View key="1">
          <AlliancesScreen />
        </View>
        <View key="2">
          <FuseScreen />
        </View>
        <View key="3">
          <CyberspaceScreen />
        </View>
      </PagerView>
    </View>
  );
}

function AppNavigator() {
  const { address, isRegistered, checkRegistration } = useWallet();
  const [initialCheckDone, setInitialCheckDone] = React.useState(false);

  React.useEffect(() => {
    const initializeApp = async () => {
      if (address) {
        await checkRegistration();
      }
      setInitialCheckDone(true);
    };

    if (!initialCheckDone) {
      initializeApp();
    }
  }, [address, checkRegistration, initialCheckDone]);

  if (!initialCheckDone) {
    // Show loading screen while checking registration
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text>Loading...</Text>
      </View>
    );
  }

  // Determine initial route based on wallet and registration status
  let initialRoute = "Wallet";
  if (address) {
    initialRoute = isRegistered ? "SignIn" : "SignUp"; // Go to SignIn if registered, SignUp if not
  }

  return (
    <Stack.Navigator
      initialRouteName={initialRoute}
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Wallet" component={WalletScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
      <Stack.Screen name="SignIn" component={SignInScreen} />
      <Stack.Screen name="Main" component={MainPager} />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <WalletProvider>
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
    </WalletProvider>
  );
}

const styles = StyleSheet.create({
  header: { padding: 10, backgroundColor: "#eee", alignItems: "center" },
  tabBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    padding: 10,
    backgroundColor: "#f0f0f0",
  },
  tab: { padding: 10 },
});
