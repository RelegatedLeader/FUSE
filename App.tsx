import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import PagerView from 'react-native-pager-view';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

import WelcomeScreen from './screens/WelcomeScreen';
import SignUpScreen from './screens/SignUpScreen';
import LoginScreen from './screens/LoginScreen';
import FuseScreen from './screens/FuseScreen';
import AlliancesScreen from './screens/AlliancesScreen';
import CyberspaceScreen from './screens/CyberspaceScreen';
import ProfileScreen from './screens/ProfileScreen';
import RandomArenaScreen from './screens/RandomArenaScreen';

const Stack = createStackNavigator();

function MainPager() {
  return (
    <View style={{ flex: 1 }}>
      <View style={styles.tabBar}>
        <TouchableOpacity style={styles.tab}>
          <Text>Fuse</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tab}>
          <Text>Alliances</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tab}>
          <Text>Cyberspace</Text>
        </TouchableOpacity>
      </View>
      <PagerView style={{ flex: 1 }} initialPage={0}>
        <View key="1">
          <FuseScreen />
        </View>
        <View key="2">
          <AlliancesScreen />
        </View>
        <View key="3">
          <CyberspaceScreen />
        </View>
      </PagerView>
    </View>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Auth">
        <Stack.Screen name="Auth" component={AuthStack} options={{ headerShown: false }} />
        <Stack.Screen name="Main" component={MainPager} options={{ headerShown: false }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

function AuthStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: { flexDirection: 'row', justifyContent: 'space-around', padding: 10, backgroundColor: '#f0f0f0' },
  tab: { padding: 10 },
});
