import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { useWallet } from "../contexts/WalletContext";
import { useTheme } from "../contexts/ThemeContext";

type RootStackParamList = {
  Wallet: undefined;
  SignUp: undefined;
  SignIn: undefined;
  Main: undefined;
  Settings: undefined;
  Profile: undefined;
};

type SettingsScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  "Settings"
>;

export default function SettingsScreen() {
  const { disconnectWallet } = useWallet();
  const { theme, themeType, toggleTheme } = useTheme();
  const navigation = useNavigation<SettingsScreenNavigationProp>();

  const handleLogout = async () => {
    try {
      await disconnectWallet();
      navigation.reset({
        index: 0,
        routes: [{ name: 'Wallet' }],
      });
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <ScrollView style={theme.container}>
      <Text style={theme.title}>Settings</Text>
      
      <TouchableOpacity onPress={toggleTheme} style={theme.button}>
        <Text style={theme.buttonTextStyle}>
          Switch to {themeType === 'light' ? 'Dark' : 'Light'} Theme
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity onPress={handleLogout} style={[theme.button, { backgroundColor: 'red' }]}>
        <Text style={[theme.buttonTextStyle, { color: 'white' }]}>Logout</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}