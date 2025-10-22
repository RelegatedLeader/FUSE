import React from 'react';
import { View, Text, Button, StyleSheet, Linking } from 'react-native';

export default function WalletScreen({ navigation }) {
  const downloadWallet = () => {
    Linking.openURL('https://galactica.com'); // Link to Galactica wallet
  };

  const connectWallet = () => {
    // TODO: Integrate Galactica wallet connection
    // For now, simulate
    navigation.navigate('Auth');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Connect Your Galactica Wallet</Text>
      <Text>Download the Galactica wallet to store your identity securely on the blockchain.</Text>
      <Button title="Download Galactica Wallet" onPress={downloadWallet} />
      <Button title="Connect Wallet" onPress={connectWallet} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  title: { fontSize: 24, marginBottom: 20, textAlign: 'center' },
});