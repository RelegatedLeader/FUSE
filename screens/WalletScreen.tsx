import React, { useState, useEffect } from 'react';
import { View, Text, Button, StyleSheet, Linking, Alert, Platform } from 'react-native';

export default function WalletScreen({ navigation }) {
  const [hasMetaMask, setHasMetaMask] = useState(false);
  const [connectedAddress, setConnectedAddress] = useState('');

  useEffect(() => {
    checkMetaMask();
  }, []);

  const checkMetaMask = async () => {
    const supported = await Linking.canOpenURL('metamask://');
    setHasMetaMask(supported);
  };

  const downloadMetaMask = () => {
    const url = Platform.OS === 'ios' 
      ? 'https://apps.apple.com/app/metamask/id1438144202' 
      : 'https://play.google.com/store/apps/details?id=io.metamask';
    Linking.openURL(url);
  };

  const connectWallet = async () => {
    // Simulate connection
    const address = '0x1234567890abcdef'; // Simulated
    setConnectedAddress(address);
    // Sign message
    Alert.alert('Signature Required', 'Sign to connect to Fuse', [
      { text: 'Cancel' },
      { text: 'Sign', onPress: () => navigation.navigate('Auth', { walletAddress: address }) },
    ]);
  };

  if (connectedAddress) {
    return (
      <View style={styles.container}>
        <Text>Connected Wallet: {connectedAddress}</Text>
        <Button title="Proceed" onPress={() => navigation.navigate('Auth')} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Connect Your MetaMask Wallet</Text>
      <Text>MetaMask supports the Galactica Network (GNET) for secure identity storage.</Text>
      {!hasMetaMask ? (
        <Button title="Download MetaMask" onPress={downloadMetaMask} />
      ) : (
        <Button title="Connect MetaMask" onPress={connectWallet} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  title: { fontSize: 24, marginBottom: 20, textAlign: 'center' },
});