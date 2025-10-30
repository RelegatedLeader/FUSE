import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

export default function GuildsScreen() {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <Text style={[styles.title, { color: theme.textColor }]}>🏰 Guilds</Text>
      <Text style={[styles.description, { color: theme.textColor }]}>
        Join powerful guilds that unite players with common goals. Participate in guild wars, share resources, and climb the leaderboards together.
      </Text>
      <Text style={[styles.comingSoon, { color: theme.textColor + '80' }]}>
        Guild system launching soon...
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  comingSoon: {
    fontSize: 14,
    fontStyle: 'italic',
  },
});