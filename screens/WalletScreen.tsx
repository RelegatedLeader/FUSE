import React, { useState, useEffect } from 'react';
import { View, Text, Button, StyleSheet, Linking, Modal, TouchableOpacity, Alert } from 'react-native';

export default function WalletScreen({ navigation }) {
  const [isFirstTime, setIsFirstTime] = useState(true); // Assume first time for now
  const [hasMetaMask, setHasMetaMask] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [connectedAddress, setConnectedAddress] = useState('');

  useEffect(() => {
    checkMetaMask();
  }, []);

  const checkMetaMask = async () => {
    const supported = await Linking.canOpenURL('metamask://');
    setHasMetaMask(supported);
  };

  const downloadWallet = (wallet) => {
    let url = '';
    if (wallet === 'MetaMask') url = 'https://play.google.com/store/apps/details?id=io.metamask'; // Android, adjust for iOS
    Linking.openURL(url);
    setShowDownloadModal(false);
  };

  const connectWallet = async () => {
    // Simulate connection
    // In real, use WalletConnect or deep link
    const address = '0x123...'; // Simulated
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
      <Text style={styles.title}>Connect Your Galactica Wallet</Text>
      {isFirstTime && !hasMetaMask ? (
        <Button title="Download Wallet" onPress={() => setShowDownloadModal(true)} />
      ) : (
        <Button title="Connect MetaMask" onPress={connectWallet} />
      )}

      <Modal visible={showDownloadModal} transparent>
        <View style={styles.modal}>
          <Text>Choose a wallet supporting GNET:</Text>
          <TouchableOpacity onPress={() => downloadWallet('MetaMask')}>
            <Text>MetaMask</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => downloadWallet('Trust')}>
            <Text>Trust Wallet</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => downloadWallet('BitGet')}>
            <Text>BitGet Wallet</Text>
          </TouchableOpacity>
          <Button title="Close" onPress={() => setShowDownloadModal(false)} />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  title: { fontSize: 24, marginBottom: 20, textAlign: 'center' },
  modal: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
});