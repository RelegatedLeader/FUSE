import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Linking } from 'react-native';
import EthereumProvider from '@walletconnect/ethereum-provider';

interface WalletContextType {
  provider: EthereumProvider | null;
  address: string;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => Promise<void>;
  signMessage: (message: string) => Promise<string>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};

interface WalletProviderProps {
  children: ReactNode;
}

export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
  const [provider, setProvider] = useState<EthereumProvider | null>(null);
  const [address, setAddress] = useState('');

  const connectWallet = async () => {
    if (provider) return; // Already connected
    try {
      const ethProvider = await EthereumProvider.init({
        projectId: '11f9f6ae9378114a4baf1c23e5547728', // TODO: Replace with valid project ID from https://cloud.walletconnect.com/
        chains: [62621], // Galactica Network mainnet chain ID
        rpcMap: {
          62621: 'https://galactica-mainnet.g.alchemy.com/public',
        },
        showQrModal: false,
        methods: ['personal_sign'],
        events: ['accountsChanged', 'chainChanged'],
      });
      setProvider(ethProvider);

      ethProvider.on('display_uri', (uri) => {
        Linking.openURL(uri);
      });

      ethProvider.on('disconnect', () => {
        setProvider(null);
        setAddress('');
      });

      await ethProvider.connect();
      const accounts = await ethProvider.request({ method: 'eth_requestAccounts' }) as string[];
      setAddress(accounts[0]);
    } catch (error: any) {
      throw error;
    }
  };

  const disconnectWallet = async () => {
    if (!provider) return;
    try {
      await provider.disconnect();
      setProvider(null);
      setAddress('');
    } catch (error: any) {
      throw error;
    }
  };

  const signMessage = async (message: string) => {
    if (!provider) throw new Error('No provider');
    const signature = await provider.request({
      method: 'personal_sign',
      params: [message, address],
    });
    return signature as string;
  };

  return (
    <WalletContext.Provider value={{ provider, address, connectWallet, disconnectWallet, signMessage }}>
      {children}
    </WalletContext.Provider>
  );
};