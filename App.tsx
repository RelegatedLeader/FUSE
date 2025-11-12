import "react-native-get-random-values";
import React, { useState, useRef } from "react";
import { NavigationContainer } from "@react-navigation/native";
import {
  createStackNavigator,
  StackNavigationProp,
} from "@react-navigation/stack";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  Image,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { WalletProvider, useWallet } from "./contexts/WalletContext";
import { ThemeProvider, useTheme } from "./contexts/ThemeContext";
import { useNavigation } from "@react-navigation/native";

// Conditionally import PagerView for native platforms only
let PagerView: any = null;
if (Platform.OS !== "web") {
  PagerView = require("react-native-pager-view").default;
}

import WalletScreen from "./screens/WalletScreen";
import SignInScreen from "./screens/SignInScreen";
import SignUpScreen from "./screens/SignUpScreen";
import FuseScreen from "./screens/FuseScreen";
import AlliancesScreen from "./screens/AlliancesScreen";
import CyberspaceScreen from "./screens/CyberspaceScreen";
import SettingsScreen from "./screens/SettingsScreen";
import ProfileScreen from "./screens/ProfileScreen";
import DiscoverScreen from "./screens/DiscoverScreen";
import FusersScreen from "./screens/FusersScreen";
import MessagesScreen from "./screens/MessagesScreen";
import TeamsScreen from "./screens/TeamsScreen";
import GuildsScreen from "./screens/GuildsScreen";
import VirtualRealmsScreen from "./screens/VirtualRealmsScreen";
import NeuralNetworksScreen from "./screens/NeuralNetworksScreen";

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

type MainPagerNavigationProp = StackNavigationProp<RootStackParamList, "Main">;

function MainPager({ navigation }: { navigation: MainPagerNavigationProp }) {
  const { address, disconnectWallet } = useWallet();
  const { theme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);

  const [alliancesTab, setAlliancesTab] = useState("AlliancesMain");
  const [fuseTab, setFuseTab] = useState("FuseHome");
  const [cyberspaceTab, setCyberspaceTab] = useState("CyberspaceMain");
  const [isLocked, setIsLocked] = useState(true);

  const pagerRef = useRef<any>(null);

  const goToFuse = () => {
    pagerRef.current?.setPage(1);
    setFuseTab("FuseHome");
  };

  const handleDisconnect = async () => {
    try {
      await disconnectWallet();
      setMenuOpen(false);
      navigation.reset({
        index: 0,
        routes: [{ name: "Wallet" }],
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

  const renderAlliancesContent = () => {
    if (alliancesTab === "AlliancesTeams") return <TeamsScreen />;
    if (alliancesTab === "AlliancesGuilds") return <GuildsScreen />;
    return <AlliancesScreen />;
  };

  const renderFuseContent = () => {
    if (fuseTab === "FuseProfile") return <ProfileScreen />;
    if (fuseTab === "FuseDiscover") return <DiscoverScreen />;
    if (fuseTab === "FuseFusers") return <FusersScreen />;
    if (fuseTab === "FuseChats") return <MessagesScreen />;
    return <FuseScreen />;
  };

  const renderCyberspaceContent = () => {
    if (cyberspaceTab === "CyberspaceVirtual") return <VirtualRealmsScreen />;
    if (cyberspaceTab === "CyberspaceNeural") return <NeuralNetworksScreen />;
    return <CyberspaceScreen />;
  };

  return (
    <View style={{ flex: 1 }}>
      {address && (
        <View
          style={[styles.header, { backgroundColor: theme.backgroundColor }]}
        >
          <View style={styles.headerLeft}>
            <TouchableOpacity
              onPress={() => setIsLocked(!isLocked)}
              style={styles.lockButton}
            >
              <Text style={{ fontSize: 24 }}>{isLocked ? "🔒" : "🔓"}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={goToFuse} style={styles.logoContainer}>
            <Image
              source={require("./assets/puzzle_rocket_no_background.png")}
              style={styles.logo}
              resizeMode="contain"
            />
          </TouchableOpacity>
          <View style={styles.headerRight}>
            <TouchableOpacity
              onPress={() => setMenuOpen(!menuOpen)}
              style={styles.menuButton}
            >
              <Text style={[styles.headerText, { color: theme.textColor }]}>
                🔗 {address.slice(0, 6)}...{address.slice(-4)} ▼
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      {menuOpen && address && (
        <View style={styles.dropdownOverlay}>
          <TouchableOpacity
            style={styles.dropdownBackdrop}
            onPress={() => setMenuOpen(false)}
          />
          <View
            style={[
              styles.dropdown,
              {
                backgroundColor: theme.card.backgroundColor,
                borderColor: theme.buttonBackground,
              },
            ]}
          >
            <TouchableOpacity
              onPress={navigateToProfile}
              style={[
                styles.dropdownItem,
                { borderBottomColor: theme.buttonBackground },
              ]}
            >
              <Text style={{ color: theme.textColor }}>👤 Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={openSettings}
              style={[
                styles.dropdownItem,
                { borderBottomColor: theme.buttonBackground },
              ]}
            >
              <Text style={{ color: theme.textColor }}>⚙️ Settings</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleDisconnect}
              style={[
                styles.dropdownItem,
                { borderBottomColor: theme.buttonBackground },
              ]}
            >
              <Text style={{ color: theme.textColor }}>🚪 Logout</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      {PagerView ? (
        <PagerView
          style={{ flex: 1 }}
          initialPage={1}
          ref={pagerRef}
          scrollEnabled={!isLocked}
        >
          <View key="0" style={{ flex: 1 }}>
            <View style={{ flex: 1 }}>{renderAlliancesContent()}</View>
            <View
              style={[
                styles.bottomNav,
                {
                  backgroundColor: theme.card.backgroundColor,
                  borderTopColor: theme.buttonBackground,
                },
              ]}
            >
              <TouchableOpacity
                onPress={() => setAlliancesTab("AlliancesTeams")}
                style={styles.navItem}
              >
                <Text style={{ fontSize: 20 }}>🛡️</Text>
                <Text
                  style={[
                    styles.navText,
                    {
                      color:
                        alliancesTab === "AlliancesTeams"
                          ? theme.textColor
                          : theme.textColor + "80",
                    },
                  ]}
                >
                  Teams
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setAlliancesTab("AlliancesGuilds")}
                style={styles.navItem}
              >
                <Text style={{ fontSize: 20 }}>🏰</Text>
                <Text
                  style={[
                    styles.navText,
                    {
                      color:
                        alliancesTab === "AlliancesGuilds"
                          ? theme.textColor
                          : theme.textColor + "80",
                    },
                  ]}
                >
                  Guilds
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setAlliancesTab("AlliancesMain")}
                style={styles.navItem}
              >
                <Text style={{ fontSize: 20 }}>🤝</Text>
                <Text
                  style={[
                    styles.navText,
                    {
                      color:
                        alliancesTab === "AlliancesMain"
                          ? theme.textColor
                          : theme.textColor + "80",
                    },
                  ]}
                >
                  Alliances
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          <View key="1" style={{ flex: 1 }}>
            <View style={{ flex: 1 }}>{renderFuseContent()}</View>
            <View
              style={[
                styles.bottomNav,
                {
                  backgroundColor: theme.card.backgroundColor,
                  borderTopColor: theme.buttonBackground,
                },
              ]}
            >
              <TouchableOpacity
                onPress={() => setFuseTab("FuseProfile")}
                style={styles.navItem}
              >
                <Text style={{ fontSize: 20 }}>👤</Text>
                <Text
                  style={[
                    styles.navText,
                    {
                      color:
                        fuseTab === "FuseProfile"
                          ? theme.textColor
                          : theme.textColor + "80",
                    },
                  ]}
                >
                  Profile
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setFuseTab("FuseDiscover")}
                style={styles.navItem}
              >
                <Text style={{ fontSize: 20 }}>🔍</Text>
                <Text
                  style={[
                    styles.navText,
                    {
                      color:
                        fuseTab === "FuseDiscover"
                          ? theme.textColor
                          : theme.textColor + "80",
                    },
                  ]}
                >
                  Discover
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setFuseTab("FuseHome")}
                style={styles.navItem}
              >
                <Text style={{ fontSize: 20 }}>🚀</Text>
                <Text
                  style={[
                    styles.navText,
                    {
                      color:
                        fuseTab === "FuseHome"
                          ? theme.textColor
                          : theme.textColor + "80",
                    },
                  ]}
                >
                  Home
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setFuseTab("FuseFusers")}
                style={styles.navItem}
              >
                <Text style={{ fontSize: 20 }}>💫</Text>
                <Text
                  style={[
                    styles.navText,
                    {
                      color:
                        fuseTab === "FuseFusers"
                          ? theme.textColor
                          : theme.textColor + "80",
                    },
                  ]}
                >
                  Fusers
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setFuseTab("FuseChats")}
                style={styles.navItem}
              >
                <Text style={{ fontSize: 20 }}>💬</Text>
                <Text
                  style={[
                    styles.navText,
                    {
                      color:
                        fuseTab === "FuseChats"
                          ? theme.textColor
                          : theme.textColor + "80",
                    },
                  ]}
                >
                  Chats
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          <View key="2" style={{ flex: 1 }}>
            <View style={{ flex: 1 }}>{renderCyberspaceContent()}</View>
            <View
              style={[
                styles.bottomNav,
                {
                  backgroundColor: theme.card.backgroundColor,
                  borderTopColor: theme.buttonBackground,
                },
              ]}
            >
              <TouchableOpacity
                onPress={() => setCyberspaceTab("CyberspaceVirtual")}
                style={styles.navItem}
              >
                <Text style={{ fontSize: 20 }}>🌌</Text>
                <Text
                  style={[
                    styles.navText,
                    {
                      color:
                        cyberspaceTab === "CyberspaceVirtual"
                          ? theme.textColor
                          : theme.textColor + "80",
                    },
                  ]}
                >
                  Virtual
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setCyberspaceTab("CyberspaceNeural")}
                style={styles.navItem}
              >
                <Text style={{ fontSize: 20 }}>🧠</Text>
                <Text
                  style={[
                    styles.navText,
                    {
                      color:
                        cyberspaceTab === "CyberspaceNeural"
                          ? theme.textColor
                          : theme.textColor + "80",
                    },
                  ]}
                >
                  Neural
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setCyberspaceTab("CyberspaceMain")}
                style={styles.navItem}
              >
                <Text style={{ fontSize: 20 }}>🌐</Text>
                <Text
                  style={[
                    styles.navText,
                    {
                      color:
                        cyberspaceTab === "CyberspaceMain"
                          ? theme.textColor
                          : theme.textColor + "80",
                    },
                  ]}
                >
                  Cyberspace
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </PagerView>
      ) : (
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
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
      <ThemeProvider>
        <WalletProvider>
          <NavigationContainer>
            <AppNavigator />
          </NavigationContainer>
        </WalletProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  header: {
    padding: 10,
    backgroundColor: "#eee",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: Platform.OS === "ios" ? 50 : 10, // Account for status bar on iOS
  },
  headerLeft: { flex: 1 },
  lockButton: {
    padding: 5,
    alignItems: "center",
  },
  logoContainer: {
    flex: 1,
    alignItems: "center",
  },
  headerRight: {
    flex: 1,
    alignItems: "flex-end",
  },
  logo: {
    width: 60,
    height: 60,
  },
  headerText: { fontSize: 16, color: "#333" },
  menuButton: { padding: 5 },
  dropdownOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  dropdownBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  dropdown: {
    position: "absolute",
    top: Platform.OS === "ios" ? 90 : 50, // Adjust for header height
    right: 10,
    backgroundColor: "white",
    borderRadius: 8,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
    minWidth: 150,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  dropdownItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    alignItems: "center",
  },
  bottomNav: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 10,
    borderTopWidth: 1,
    height: 70,
  },
  navItem: {
    alignItems: "center",
    flex: 1,
  },
  navText: {
    fontSize: 12,
    fontWeight: "bold",
    marginTop: 2,
  },
});
