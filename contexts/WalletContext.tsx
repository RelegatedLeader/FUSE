import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { Alert, Linking } from "react-native";
import { ethers } from 'ethers';

interface WalletContextType {
  provider: any;
  address: string;
  signer: any;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => Promise<void>;
  signMessage: (message: string) => Promise<string>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
};

interface WalletProviderProps {
  children: ReactNode;
}

export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
  const [provider, setProvider] = useState<any>(null);
  const [address, setAddress] = useState("");
  const [signer, setSigner] = useState<any>(null);

  useEffect(() => {
    // Check for deep link responses from MetaMask
    const handleDeepLink = (event: any) => {
      console.log('Deep link received:', event.url);
      // Handle MetaMask connection response here
    };

    const subscription = Linking.addEventListener('url', handleDeepLink);
    return () => subscription?.remove();
  }, []);

  const connectWallet = async () => {
    try {
      // Create Polygon provider
      const polygonProvider = new ethers.JsonRpcProvider('https://polygon-rpc.com');

      // Check if MetaMask is installed
      const canOpen = await Linking.canOpenURL('metamask://');

      if (canOpen) {
        // Open MetaMask app
        await Linking.openURL('metamask://');

        // Simulate connection for now - in production you'd handle the actual response
        setTimeout(() => {
          setProvider(polygonProvider);
          setAddress("0x742d35Cc6634C0532925a3b844Bc454e4438f44e");

          // Create a mock signer that would normally come from MetaMask
          const mockSigner = {
            getAddress: async () => "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
            signMessage: async (message: string) => {
              console.log('Signing message:', message);
              return "0x" + Math.random().toString(16).substr(2, 130);
            },
            sendTransaction: async (tx: any) => {
              console.log('Sending transaction:', tx);
              return {
                hash: "0x" + Math.random().toString(16).substr(2, 64),
                wait: async () => ({ status: 1 })
              };
            }
          };
          setSigner(mockSigner);

          Alert.alert("Connected", "MetaMask connected to Polygon!");
        }, 3000);

      } else {
        Alert.alert(
          "MetaMask Required",
          "Please install MetaMask mobile app",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Install MetaMask",
              onPress: () => Linking.openURL("https://metamask.io/download/")
            }
          ]
        );
      }
    } catch (error: any) {
      console.error('Wallet connection error:', error);
      Alert.alert("Connection Error", error.message);
    }
  };

  const disconnectWallet = async () => {
    setProvider(null);
    setAddress("");
    Alert.alert("Disconnected", "Wallet disconnected successfully.");
  };

  const signMessage = async (message: string) => {
    if (!signer) throw new Error("No signer available");
    return await signer.signMessage(message);
  };

  return (
    <WalletContext.Provider
      value={{
        provider,
        address,
        signer,
        connectWallet,
        disconnectWallet,
        signMessage,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};
