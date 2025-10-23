import React, { useState } from 'react';
import { View, Text, Button, StyleSheet, Alert } from 'react-native';
import EthereumProvider from '@walletconnect/ethereum-provider';
import QRCode from 'react-native-qrcode-svg';

export default function WalletScreen({ navigation }) {
  const [provider, setProvider] = useState<EthereumProvider | null>(null);
  const [address, setAddress] = useState('');
  const [uri, setUri] = useState('');

  const connectWallet = async () => {
    try {
      const ethProvider = await EthereumProvider.init({
        projectId: '11f9f6ae9378114a4baf1c23e5547728', // WalletConnect Project ID
        chains: [613419], // Galactica Mainnet
        rpcMap: {
          613419: 'https://galactica-mainnet.g.alchemy.com/public',
        },
        showQrModal: false, // We'll handle the modal
        methods: ['personal_sign'],
        events: ['accountsChanged', 'chainChanged'],
      });
      setProvider(ethProvider);

      ethProvider.on('display_uri', (uri) => {
        setUri(uri);
      });

      await ethProvider.connect();
      const accounts = await ethProvider.request({ method: 'eth_requestAccounts' }) as string[];
      setAddress(accounts[0]);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const signMessage = async () => {
    if (!provider) return;
    try {
      const message = 'Connect to Fuse on Galactica Network';
      const signature = await provider.request({
        method: 'personal_sign',
        params: [message, address],
      });
      Alert.alert('Signed', `Signature: ${signature}`);
      navigation.navigate('Auth', { walletAddress: address });
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  if (address) {
    return (
      <View style={styles.container}>
        <Text>Connected Wallet: {address}</Text>
        <Button title="Sign to Proceed" onPress={signMessage} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Connect Your Wallet</Text>
      <Text>Connect via WalletConnect to access Fuse.</Text>
      <Button title="Connect Wallet" onPress={connectWallet} />
      {uri ? (
        <View style={styles.qrContainer}>
          <Text>Scan this QR code with MetaMask:</Text>
          <QRCode value={uri} size={200} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  title: { fontSize: 24, marginBottom: 20, textAlign: 'center' },
  qrContainer: { marginTop: 20, alignItems: 'center' },
});