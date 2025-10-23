import React from "react";
import { View, Text, Button, StyleSheet } from "react-native";

export default function HomeScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Home</Text>
      <Text>Find your matches here.</Text>
      <Button title="Profile" onPress={() => navigation.navigate("Profile")} />
      <Button
        title="Random Arena"
        onPress={() => navigation.navigate("RandomArena")}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 24, marginBottom: 20 },
});
