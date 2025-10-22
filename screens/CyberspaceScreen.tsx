import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function CyberspaceScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Cyberspace</Text>
      <Text>Unlocked with alliance. Post and share ideas.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 24, marginBottom: 20 },
});