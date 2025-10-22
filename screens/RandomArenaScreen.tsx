import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function RandomArenaScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Random Arena</Text>
      <Text>Connect with random groups.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 24, marginBottom: 20 },
});