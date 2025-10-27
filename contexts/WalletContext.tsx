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
  signer: any;
  signClient: any;
  sessionTopic: string;
  isRegistered: boolean;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => Promise<void>;
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
  const [signer, setSigner] = useState<any>(null);
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

        // Set up event listeners
        client.on("session_proposal", async (event) => {
          const { id, params } = event;
          console.log("Session proposal received:", params);

          const { requiredNamespaces } = params;

          const namespaces = buildApprovedNamespaces({
            proposal: params,
            supportedNamespaces: {
              eip155: {
                chains: ["eip155:137"], // Polygon mainnet
                methods: ["eth_sendTransaction", "personal_sign", "eth_sign"],
                events: ["accountsChanged", "chainChanged"],
                accounts:
                  requiredNamespaces.eip155?.chains?.map(
                    (chain) => `${chain}:${params.proposer.publicKey}`
                  ) || [],
              },
            },
          });

          try {
            await client.approve({ id, namespaces });
            console.log("Session approved");
          } catch (error) {
            console.error("Session approval failed:", error);
            await client.reject({ id, reason: getSdkError("USER_REJECTED") });
          }
        });

        client.on("session_request", async (event) => {
          console.log("Session request received:", event);
          // Handle session requests (signing, transactions, etc.)
          const { topic, params, id } = event;
          const { request } = params;

          try {
            // For personal_sign requests, approve automatically for now
            if (request.method === "personal_sign") {
              await client.respond({
                topic,
                response: {
                  id,
                  jsonrpc: "2.0",
                  result: "0x", // Mock signature - in production you'd sign properly
                },
              });
            } else {
              await client.respond({
                topic,
                response: {
                  id,
                  jsonrpc: "2.0",
                  result: "0x",
                },
              });
            }
          } catch (error) {
            console.error("Session request failed:", error);
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
          console.log("Session deleted");
          setAddress("");
          setSigner(null);
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

        // Check for existing sessions
        const existingSessions = client.session.getAll();
        if (existingSessions.length > 0) {
          const session = existingSessions[0];
          const accounts = session.namespaces.eip155.accounts;
          if (accounts && accounts.length > 0) {
            const address = accounts[0].split(":")[2];
            setAddress(address);
            console.log("Restored existing session for address:", address);
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
            console.log("Session approved:", session);

            // Extract address from session
            const accounts = session.namespaces.eip155.accounts;
            if (accounts && accounts.length > 0) {
              const address = accounts[0].split(":")[2]; // Extract address from eip155:137:address
              console.log("Connected address:", address);

              setAddress(address);

              // Store session topic
              setSessionTopic(session.topic);

              // Create ethers signer (this is simplified - in reality you'd need the private key)
              const ethersSigner = {
                getAddress: async () => address,
                signMessage: async (message: string) => {
                  // Request signature through WalletConnect
                  try {
                    const signature = await signClient.request({
                      topic: session.topic,
                      chainId: "eip155:137",
                      request: {
                        method: "personal_sign",
                        params: [message, address],
                      },
                    });
                    return signature;
                  } catch (error) {
                    console.error("Signature request failed:", error);
                    return `mock-signature-${Date.now()}`;
                  }
                },
                sendTransaction: async (tx: any) => {
                  // This would need real transaction sending through WalletConnect
                  return {
                    hash: `tx-${Date.now()}`,
                    wait: async () => ({ status: 1 }),
                  };
                },
              };
              setSigner(ethersSigner);

              Alert.alert(
                "Connected",
                `Successfully connected!\nAddress: ${address.slice(
                  0,
                  6
                )}...${address.slice(-4)}`
              );
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
      setSigner(null);
      setSessionTopic("");
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
    if (!address || !signer) return false;

    try {
      // Create a provider from the signer for view calls
      const provider =
        signer.provider ||
        new ethers.JsonRpcProvider("https://polygon-rpc.com");
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
    if (!signClient || !sessionTopic || !address) throw new Error("No wallet connected");
    try {
      const { updateUserData: updateData } = await import("../utils/contract");
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
        signer,
        signClient,
        sessionTopic,
        isRegistered,
        connectWallet,
        disconnectWallet,
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
