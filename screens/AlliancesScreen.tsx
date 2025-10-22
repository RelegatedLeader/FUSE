import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet } from 'react-native';

export default function AlliancesScreen() {
  const [search, setSearch] = useState('');

  const handleSearch = () => {
    // AI search for alliances
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Alliances</Text>
      <TextInput
        style={styles.input}
        placeholder="AI Search for groups"
        value={search}
        onChangeText={setSearch}
      />
      <Button title="Search" onPress={handleSearch} />
      <Text>Form alliances with 4 compatible people.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  title: { fontSize: 24, marginBottom: 20 },
  input: { borderWidth: 1, padding: 10, marginBottom: 10, width: '100%' },
});