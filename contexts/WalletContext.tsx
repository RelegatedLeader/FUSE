import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from "react";
import { Alert, Linking } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ethers } from "ethers";
import EthereumProvider from "@walletconnect/ethereum-provider";

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
  const [ethereumProvider, setEthereumProvider] = useState<any>(null);

  useEffect(() => {
    // Initialize WalletConnect on app start
    const initWalletConnect = async () => {
      try {
        const ethProvider = await EthereumProvider.init({
          projectId: "REPLACE_WITH_YOUR_WALLETCONNECT_PROJECT_ID", // Get this from https://cloud.walletconnect.com/
          chains: [137], // Polygon mainnet
          optionalChains: [137, 80001], // Polygon mainnet and testnet
          showQrModal: false, // We'll handle the modal ourselves
          methods: ["eth_sendTransaction", "personal_sign", "eth_sign"],
          events: ["accountsChanged", "chainChanged", "disconnect"],
        });

        setEthereumProvider(ethProvider);

        // Handle connection events
        ethProvider.on("accountsChanged", (accounts: string[]) => {
          if (accounts.length > 0) {
            setAddress(accounts[0]);
            // Create ethers signer
            const ethersProvider = new ethers.BrowserProvider(ethProvider);
            const ethersSigner = ethersProvider.getSigner();
            setSigner(ethersSigner);
          }
        });

        ethProvider.on("chainChanged", (chainId: string) => {
          console.log("Chain changed to:", chainId);
          if (parseInt(chainId) !== 137) {
            Alert.alert(
              "Network Warning",
              "Please switch to Polygon network for optimal experience."
            );
          }
        });

        ethProvider.on("disconnect", () => {
          setProvider(null);
          setAddress("");
          setSigner(null);
          Alert.alert("Disconnected", "Wallet disconnected");
        });

        // Check if already connected
        if (ethProvider.connected) {
          const accounts = ethProvider.accounts;
          if (accounts.length > 0) {
            setAddress(accounts[0]);
            const ethersProvider = new ethers.BrowserProvider(ethProvider);
            const ethersSigner = ethersProvider.getSigner();
            setSigner(ethersSigner);
          }
        }
      } catch (error) {
        console.error("Failed to initialize WalletConnect:", error);
      }
    };

    initWalletConnect();
  }, []);

  const connectWallet = async () => {
    try {
      if (!ethereumProvider) {
        Alert.alert(
          "Error",
          "WalletConnect not initialized. Please restart the app."
        );
        return;
      }

      // Connect to MetaMask
      await ethereumProvider.connect();

      // The accountsChanged event will handle setting the address and signer
      Alert.alert("Connected", "Successfully connected to MetaMask!");
    } catch (error: any) {
      console.error("Wallet connection error:", error);
      Alert.alert(
        "Connection Failed",
        error.message || "Failed to connect to MetaMask"
      );
    }
  };

  const disconnectWallet = async () => {
    try {
      if (ethereumProvider) {
        await ethereumProvider.disconnect();
      }
      setProvider(null);
      setAddress("");
      setSigner(null);
      Alert.alert("Disconnected", "Wallet disconnected successfully.");
    } catch (error: any) {
      console.error("Disconnect error:", error);
      Alert.alert("Error", "Failed to disconnect wallet");
    }
  };

  const signMessage = async (message: string) => {
    if (!ethereumProvider) throw new Error("No wallet connected");
    try {
      const signature = await ethereumProvider.request({
        method: "personal_sign",
        params: [message, address],
      });
      return signature;
    } catch (error) {
      console.error("Sign message error:", error);
      throw error;
    }
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
