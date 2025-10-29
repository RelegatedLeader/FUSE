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
import { isUserRegistered } from "../utils/contract";

interface WalletContextType {
  provider: any;
  address: string;
  signClient: any;
  sessionTopic: string;
  isRegistered: boolean;
  isInitialized: boolean;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => Promise<void>;
  clearAllSessions: () => Promise<void>;
  signMessage: (message: string) => Promise<string>;
  checkRegistration: () => Promise<boolean>;
  signIn: () => Promise<void>;
  updateUserData: (
    firstName: string,
    lastName: string,
    birthdate: string,
    gender: string,
    location: string,
    id: string,
    traits: string,
    mbti: string
  ) => Promise<void>;
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
  const [isRegistered, setIsRegistered] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [signClient, setSignClient] = useState<any>(null);
  const [sessionTopic, setSessionTopic] = useState("");

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

        // Clear all existing sessions for fresh testing
        console.log("Clearing all existing sessions for fresh testing...");
        const existingSessions = client.session.getAll();
        if (existingSessions.length > 0) {
          console.log(`Found ${existingSessions.length} existing sessions, clearing them...`);
          for (const session of existingSessions) {
            try {
              await client.disconnect({
                topic: session.topic,
                reason: getSdkError("USER_DISCONNECTED"),
              });
              console.log(`Cleared session: ${session.topic}`);
            } catch (error) {
              console.error(`Failed to clear session ${session.topic}:`, error);
            }
          }
        }
        client.on("session_proposal", async (event) => {
          const { id, params } = event;
          console.log("Session proposal received:", params);

          try {
            // Approve the session with the namespaces requested by the wallet
            const namespaces = buildApprovedNamespaces({
              proposal: params,
              supportedNamespaces: {
                eip155: {
                  chains: ["eip155:137"], // Polygon mainnet
                  methods: ["eth_sendTransaction", "personal_sign", "eth_sign"],
                  events: ["accountsChanged", "chainChanged"],
                  accounts: [], // Will be filled by buildApprovedNamespaces
                },
              },
            });

            await client.approve({ id, namespaces });
            console.log("Session approved");
          } catch (error) {
            console.error("Session approval failed:", error);
            await client.reject({ id, reason: getSdkError("USER_REJECTED") });
          }
        });

        client.on("session_delete", () => {
          console.log("Session deleted");
          setAddress("");
          setSessionTopic("");
          Alert.alert("Disconnected", "Wallet disconnected");
        });

        client.on("session_event", (event) => {
          console.log("Session event:", event);
        });

        // Listen for session establishment
        client.on("session_update", (event) => {
          console.log("Session updated:", event);
        });

        // Also listen for when sessions are added
        client.core.relayer.on("message", (event: any) => {
          console.log("Relayer message:", event);
        });

        // Sessions are cleared on init for fresh testing - no restoration
      } catch (error) {
        console.error("Failed to initialize WalletConnect:", error);
      } finally {
        setIsInitialized(true);
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

      console.log("Creating WalletConnect session...");

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

      console.log("Connection URI generated:", uri);

      if (uri) {
        // Open MetaMask directly with the WalletConnect URI
        const metamaskUrl = `metamask://wc?uri=${encodeURIComponent(uri)}`;
        console.log("Opening MetaMask with URL:", metamaskUrl);

        const canOpen = await Linking.canOpenURL(metamaskUrl);

        if (canOpen) {
          await Linking.openURL(metamaskUrl);
          console.log("MetaMask opened, waiting for approval...");

          // Wait for approval with timeout
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error("Connection timeout")), 60000); // 60 second timeout
          });

          try {
            const session = await Promise.race([approval(), timeoutPromise]);
            console.log("Session established:", session);

            // Extract real address from session
            const accounts = session.namespaces.eip155.accounts;
            if (accounts && accounts.length > 0) {
              const address = accounts[0].split(":")[2];
              console.log("Connected to real wallet:", address);
              setAddress(address);
              setSessionTopic(session.topic);
            } else {
              console.error("No accounts in session");
              Alert.alert("Connection Failed", "No accounts found in session");
            }
          } catch (error) {
            console.error("Session approval failed:", error);
            Alert.alert(
              "Connection Failed",
              "Session approval timed out or was rejected"
            );
          }
        } else {
          Alert.alert(
            "MetaMask Required",
            "Please install MetaMask from the app store to connect your wallet.",
            [
              {
                text: "Open App Store",
                onPress: () =>
                  Linking.openURL("market://details?id=io.metamask"),
              },
              { text: "Cancel", style: "cancel" },
            ]
          );
        }
      }
    } catch (error: any) {
      console.error("Connection error:", error);
      Alert.alert(
        "Connection Failed",
        error.message || "Failed to connect to MetaMask"
      );
    }
  };

  const disconnectWallet = async () => {
    try {
      if (signClient && sessionTopic) {
        await signClient.disconnect({
          topic: sessionTopic,
          reason: getSdkError("USER_DISCONNECTED"),
        });
      }
      setProvider(null);
      setAddress("");
      setSessionTopic("");
      setIsRegistered(false);
      // Clear stored session data
      await AsyncStorage.removeItem("walletconnect");
      console.log("Wallet disconnected and session cleared");
      Alert.alert("Disconnected", "Wallet disconnected successfully.");
    } catch (error: any) {
      console.error("Disconnect error:", error);
      Alert.alert("Error", "Failed to disconnect wallet");
    }
  };

  const clearAllSessions = async () => {
    try {
      if (signClient) {
        const sessions = signClient.session.getAll();
        for (const session of sessions) {
          await signClient.disconnect({
            topic: session.topic,
            reason: getSdkError("USER_DISCONNECTED"),
          });
        }
      }
      setProvider(null);
      setAddress("");
      setSessionTopic("");
      setIsRegistered(false);
      await AsyncStorage.removeItem("walletconnect");
      console.log("All sessions cleared");
    } catch (error) {
      console.error("Clear sessions error:", error);
    }
  };

  const signMessage = async (message: string) => {
    if (!signClient || !sessionTopic || !address) throw new Error("No wallet connected");
    try {
      const signature = await signClient.request({
        topic: sessionTopic,
        chainId: "eip155:137",
        request: {
          method: "personal_sign",
          params: [message, address],
        },
      });
      return signature;
    } catch (error) {
      console.error("Sign message error:", error);
      throw error;
    }
  };

  const checkRegistration = async (): Promise<boolean> => {
    if (!address) return false;

    try {
      // Use public Polygon provider for view calls
      const provider = new ethers.JsonRpcProvider("https://polygon-rpc.com");
      const registered = await isUserRegistered(provider, address);
      setIsRegistered(registered);
      return registered;
    } catch (error) {
      console.error("Check registration error:", error);
      return false;
    }
  };

  const signIn = async () => {
    if (!signClient || !sessionTopic || !address) throw new Error("No wallet connected");
    try {
      const { signInUser } = await import("../utils/contract");
      await signInUser(signClient, sessionTopic, address);
      Alert.alert("Success", "Signed in successfully!");
    } catch (error) {
      console.error("Sign in error:", error);
      Alert.alert("Error", "Failed to sign in: " + (error as Error).message);
    }
  };

  const updateUserData = async (
    firstName: string,
    lastName: string,
    birthdate: string,
    gender: string,
    location: string,
    id: string,
    traits: string,
    mbti: string
  ) => {
    console.log("updateUserData called with:", { signClient: !!signClient, sessionTopic, address });
    if (!signClient || !sessionTopic || !address) throw new Error("No wallet connected");
    try {
      const { updateUserData: updateData } = await import("../utils/contract");
      console.log("Calling updateData from contract utils");
      await updateData(signClient, sessionTopic, address, firstName, lastName, birthdate, gender, location, id, traits, mbti);
      Alert.alert("Success", "Profile created successfully!");
    } catch (error) {
      console.error("Update user data error:", error);
      Alert.alert("Error", "Failed to create profile: " + (error as Error).message);
    }
  };

  return (
    <WalletContext.Provider
      value={{
        provider,
        address,
        signClient,
        sessionTopic,
        isRegistered,
        isInitialized,
        connectWallet,
        disconnectWallet,
        clearAllSessions,
        signMessage,
        checkRegistration,
        signIn,
        updateUserData,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};
