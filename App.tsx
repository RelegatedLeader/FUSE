import "react-native-get-random-values";
import React, { useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator, StackNavigationProp } from "@react-navigation/stack";
import { View, Text, TouchableOpacity, StyleSheet, Alert, Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { WalletProvider, useWallet } from "./contexts/WalletContext";

// Conditionally import PagerView for native platforms only
let PagerView: any = null;
if (Platform.OS !== 'web') {
  PagerView = require('react-native-pager-view').default;
}

import WalletScreen from "./screens/WalletScreen";
import SignInScreen from "./screens/SignInScreen";
import SignUpScreen from "./screens/SignUpScreen";
import FuseScreen from "./screens/FuseScreen";
import AlliancesScreen from "./screens/AlliancesScreen";
import CyberspaceScreen from "./screens/CyberspaceScreen";
import SettingsScreen from "./screens/SettingsScreen";
import ProfileScreen from "./screens/ProfileScreen";

const Stack = createStackNavigator();

// Define navigation types
type RootStackParamList = {
  Wallet: undefined;
  SignUp: undefined;
  SignIn: undefined;
  Main: undefined;
  Settings: undefined;
  Profile: undefined;
};

type MainPagerNavigationProp = StackNavigationProp<
  RootStackParamList,
  "Main"
>;

function MainPager({ navigation }: { navigation: MainPagerNavigationProp }) {
  const { address, disconnectWallet } = useWallet();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleDisconnect = async () => {
    try {
      await disconnectWallet();
      setMenuOpen(false);
      navigation.reset({
        index: 0,
        routes: [{ name: 'Wallet' }],
      });
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };

  const navigateToProfile = () => {
    navigation.navigate("Profile");
    setMenuOpen(false);
  };

  const openSettings = () => {
    navigation.navigate("Settings");
    setMenuOpen(false);
  };

  return (
    <View style={{ flex: 1 }}>
      {address && (
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setMenuOpen(!menuOpen)} style={styles.menuButton}>
            <Text style={styles.headerText}>
              Wallet: {address.slice(0, 6)}...{address.slice(-4)} ▼
            </Text>
          </TouchableOpacity>
          {menuOpen && (
            <View style={styles.dropdown}>
              <TouchableOpacity onPress={navigateToProfile} style={styles.dropdownItem}>
                <Text>Profile</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={openSettings} style={styles.dropdownItem}>
                <Text>Settings</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDisconnect} style={styles.dropdownItem}>
                <Text>Logout</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
      {PagerView ? (
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
      ) : (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text>Web version - Navigation tabs not available</Text>
          <FuseScreen />
        </View>
      )}
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
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <WalletProvider>
        <NavigationContainer>
          <AppNavigator />
        </NavigationContainer>
      </WalletProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  header: { padding: 10, backgroundColor: "#eee", alignItems: "center" },
  headerText: { fontSize: 16, color: "#333" },
  menuButton: { padding: 5 },
  dropdown: { position: "absolute", top: 40, right: 10, backgroundColor: "white", borderRadius: 5, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 5, zIndex: 1 },
  dropdownItem: { padding: 10, borderBottomWidth: 1, borderBottomColor: "#eee" },
});
