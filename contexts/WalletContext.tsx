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
import { Core } from "@walletconnect/core";
import { buildApprovedNamespaces, getSdkError } from "@walletconnect/utils";
import { SignClient } from "@walletconnect/sign-client";

interface WalletContextType {
  provider: any;
  address: string;
  signer: any;
  isRegistered: boolean;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => Promise<void>;
  signMessage: (message: string) => Promise<string>;
  checkRegistration: () => Promise<boolean>;
  signIn: () => Promise<void>;
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
  const [isRegistered, setIsRegistered] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [signClient, setSignClient] = useState<any>(null);

  useEffect(() => {
    // Initialize WalletConnect Sign Client
    const initWalletConnect = async () => {
      if (isInitialized) return;

      try {
        const client = await SignClient.init({
          projectId: "11f9f6ae9378114a4baf1c23e5547728",
          metadata: {
            name: "FUSE",
            description: "Social app on Polygon",
            url: "https://fuse-app.com",
            icons: ["https://walletconnect.com/walletconnect-logo.png"],
          },
        });

        setSignClient(client);

        // Set up event listeners
        client.on("session_proposal", async (event) => {
          // Auto-approve session proposals for simplicity
          const { id, params } = event;
          const { requiredNamespaces } = params;

          const namespaces = buildApprovedNamespaces({
            proposal: params,
            supportedNamespaces: {
              eip155: {
                chains: ["eip155:137"], // Polygon mainnet
                methods: ["eth_sendTransaction", "personal_sign", "eth_sign"],
                events: ["accountsChanged", "chainChanged"],
                accounts: ["eip155:137:" + params.proposer.publicKey], // This will be updated with real address
              },
            },
          });

          await client.approve({ id, namespaces });
        });

        client.on("session_request", async (event) => {
          // Handle session requests (signing, transactions, etc.)
          const { topic, params, id } = event;
          const { request } = params;
          const session = client.session.get(topic);

          try {
            // For now, approve all requests (in production, you'd validate)
            await client.respond({
              topic,
              response: {
                id,
                jsonrpc: "2.0",
                result: "0x", // Mock response
              },
            });
          } catch (error) {
            await client.respond({
              topic,
              response: {
                id,
                jsonrpc: "2.0",
                error: getSdkError("USER_REJECTED"),
              },
            });
          }
        });

        client.on("session_delete", () => {
          setAddress("");
          setSigner(null);
          Alert.alert("Disconnected", "Wallet disconnected");
        });

        // Create ethers provider
        const ethersProvider = new ethers.JsonRpcProvider("https://polygon-rpc.com");
        setProvider(ethersProvider);
        setIsInitialized(true);
      } catch (error) {
        console.error("Failed to initialize WalletConnect:", error);
      }
    };

    initWalletConnect();
  }, []);

  const connectWallet = async () => {
    try {
      if (!signClient) {
        Alert.alert("Error", "WalletConnect not initialized");
        return;
      }

      // Create connection
      const { uri, approval } = await signClient.connect({
        requiredNamespaces: {
          eip155: {
            methods: ["eth_sendTransaction", "personal_sign", "eth_sign"],
            chains: ["eip155:137"], // Polygon mainnet
            events: ["accountsChanged", "chainChanged"],
          },
        },
      });

      if (uri) {
        // Open MetaMask directly with the WalletConnect URI
        const metamaskUrl = `metamask://wc?uri=${encodeURIComponent(uri)}`;
        const canOpen = await Linking.canOpenURL(metamaskUrl);

        if (canOpen) {
          await Linking.openURL(metamaskUrl);

          // Wait for approval
          const session = await approval();
          
          // Extract address from session
          const accounts = session.namespaces.eip155.accounts;
          if (accounts && accounts.length > 0) {
            const address = accounts[0].split(":")[2]; // Extract address from eip155:137:address
            setAddress(address);

            // Create ethers signer (this is simplified - in reality you'd need the private key)
            const ethersSigner = {
              getAddress: async () => address,
              signMessage: async (message: string) => {
                // This would need real signing implementation
                return `signed-${message}-${Date.now()}`;
              },
              sendTransaction: async (tx: any) => {
                // This would need real transaction sending
                return { hash: `tx-${Date.now()}`, wait: async () => ({ status: 1 }) };
              },
            };
            setSigner(ethersSigner);

            Alert.alert("Connected", `Successfully connected!\nAddress: ${address.slice(0, 6)}...${address.slice(-4)}`);
          }
        } else {
          Alert.alert(
            "MetaMask Required",
            "Please install MetaMask from the app store to connect your wallet.",
            [
              {
                text: "Open App Store",
                onPress: () => Linking.openURL("market://details?id=io.metamask")
              },
              { text: "Cancel", style: "cancel" }
            ]
          );
        }
      }
    } catch (error: any) {
      console.error("Connection error:", error);
      Alert.alert("Connection Failed", error.message || "Failed to connect to MetaMask");
    }
  };

  const disconnectWallet = async () => {
    try {
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
    if (!signer) throw new Error("No wallet connected");
    try {
      const signature = await signer.signMessage(message);
      return signature;
    } catch (error) {
      console.error("Sign message error:", error);
      throw error;
    }
  };

  const checkRegistration = async (): Promise<boolean> => {
    if (!address) return false;

    // For demo/testing, check local storage
    try {
      const userData = await AsyncStorage.getItem("userData");
      const registered = !!userData;
      setIsRegistered(registered);
      return registered;
    } catch (error) {
      console.error("Check registration error:", error);
      return false;
    }
  };

  const signIn = async () => {
    if (!signer) throw new Error("No wallet connected");
    try {
      // For demo, just show success
      Alert.alert("Success", "Signed in successfully!");
    } catch (error) {
      console.error("Sign in error:", error);
      Alert.alert("Error", "Failed to sign in: " + (error as Error).message);
    }
  };

  return (
    <WalletContext.Provider
      value={{
        provider,
        address,
        signer,
        isRegistered,
        connectWallet,
        disconnectWallet,
        signMessage,
        checkRegistration,
        signIn,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};
