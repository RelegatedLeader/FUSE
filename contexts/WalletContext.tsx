import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from "react";
import { Alert, Linking, Clipboard } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ethers } from "ethers";
import { Core } from "@walletconnect/core";
import { buildApprovedNamespaces, getSdkError } from "@walletconnect/utils";
import { SignClient } from "@walletconnect/sign-client";
import { FirebaseService } from "../utils/firebaseService";

interface WalletContextType {
  provider: any;
  address: string;
  signClient: any;
  sessionTopic: string;
  isRegistered: boolean;
  isInitialized: boolean;
  isConnecting: boolean;
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
  ) => Promise<{ hash: any; note?: string }>;
  getUserDataByTransaction: (transactionHash: string) => Promise<any>;
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
  const [isConnecting, setIsConnecting] = useState(false);
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
            url: "https://fuse-social-app.vercel.app", // Updated to a valid demo URL
            icons: ["https://walletconnect.com/walletconnect-logo.png"],
          },
        });

        setSignClient(client);

        // Clear all existing sessions for fresh testing
        console.log("Clearing all existing sessions for fresh testing...");
        const existingSessions = client.session.getAll();
        if (existingSessions.length > 0) {
          console.log(
            `Found ${existingSessions.length} existing sessions, clearing them...`
          );
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
    if (isConnecting) {
      console.log("Already connecting, ignoring request");
      return;
    }

    try {
      setIsConnecting(true);
      console.log("Starting wallet connection...");

      if (!signClient) {
        Alert.alert("Error", "WalletConnect not initialized");
        return;
      }

      // Disconnect any existing session first
      if (sessionTopic) {
        console.log("Disconnecting existing session before connecting...");
        try {
          await signClient.disconnect({
            topic: sessionTopic,
            reason: getSdkError("USER_DISCONNECTED"),
          });
          setSessionTopic("");
          setAddress("");
        } catch (disconnectError) {
          console.log("Error disconnecting existing session:", disconnectError);
          // Continue anyway
        }
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
        console.log("Connection URI generated:", uri);

        // Try to open MetaMask with multiple fallback methods for iOS compatibility
        let opened = false;

        // Method 1: iOS Universal Link (primary method for iOS)
        const universalLink = `https://metamask.app.link/wc?uri=${encodeURIComponent(
          uri
        )}`;
        console.log("Trying MetaMask universal link:", universalLink);

        try {
          const canOpenUniversal = await Linking.canOpenURL(universalLink);
          if (canOpenUniversal) {
            await Linking.openURL(universalLink);
            console.log("MetaMask universal link opened successfully");
            opened = true;
          }
        } catch (error) {
          console.log("Universal link failed:", error);
        }

        // Method 2: Standard MetaMask deep link (fallback for Android/other platforms)
        if (!opened) {
          const metamaskUrl = `metamask://wc?uri=${encodeURIComponent(uri)}`;
          console.log("Trying MetaMask deep link:", metamaskUrl);

          try {
            const canOpenDeepLink = await Linking.canOpenURL(metamaskUrl);
            if (canOpenDeepLink) {
              await Linking.openURL(metamaskUrl);
              console.log("MetaMask deep link opened successfully");
              opened = true;
            }
          } catch (error) {
            console.log("Deep link failed:", error);
          }
        }

        // Method 3: Fallback to showing connection URI if app opening failed
        if (!opened) {
          console.log(
            "Could not open MetaMask app, showing manual connection option"
          );
          Alert.alert(
            "MetaMask Connection",
            "Could not open MetaMask automatically. Please copy the connection URI and paste it manually in MetaMask.",
            [
              {
                text: "Copy URI",
                onPress: async () => {
                  // Copy URI to clipboard for manual connection
                  console.log("URI for manual connection:", uri);
                  try {
                    Clipboard.setString(uri);
                    Alert.alert(
                      "URI Copied",
                      "The connection URI has been copied to your clipboard. Open MetaMask and paste it in the WalletConnect section."
                    );
                  } catch (clipboardError) {
                    console.error("Clipboard error:", clipboardError);
                    Alert.alert(
                      "Copy Failed",
                      "Please manually copy this URI and paste it in MetaMask:\n\n" +
                        uri
                    );
                  }
                },
              },
              {
                text: "Continue Waiting",
                style: "default",
              },
            ]
          );
        }

        console.log("MetaMask opened, waiting for approval...");

        // Wait for approval with timeout
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(
            () => reject(new Error("Connection timeout - please try again")),
            60000
          ); // 60 second timeout
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

            // Initialize Firebase with user keys
            try {
              console.log("Initializing Firebase for user:", address);

              // Initialize Firebase Auth first
              const { initializeFirebaseAuth } = await import(
                "../utils/firebase"
              );
              await initializeFirebaseAuth();

              await FirebaseService.initializeUser(address);
              console.log("Firebase initialized successfully");
            } catch (firebaseError: any) {
              console.error(
                "Firebase initialization failed:",
                firebaseError.message
              );
              // Continue anyway for testing - Firebase auth errors won't block wallet connection
              if (!firebaseError.message?.includes("api-key-not-valid")) {
                console.log("Non-auth Firebase error, still proceeding...");
              }
            }

            setIsConnecting(false);
          } else {
            console.error("No accounts in session");
            Alert.alert("Connection Failed", "No accounts found in session");
            setIsConnecting(false);
          }
        } catch (error: any) {
          console.error("Session approval failed:", error);

          let errorMessage = "Failed to connect to MetaMask";
          if (error.message?.includes("timeout")) {
            errorMessage = "Connection timed out. Please try again.";
          } else if (error.message?.includes("rejected")) {
            errorMessage = "Connection was rejected by MetaMask.";
          } else if (error.message?.includes("network")) {
            errorMessage = "Network error. Please check your connection.";
          }

          Alert.alert("Connection Failed", errorMessage);
          setIsConnecting(false);
        }
      } else {
        Alert.alert(
          "MetaMask Required",
          "Please install MetaMask from the app store to connect your wallet.",
          [
            {
              text: "Open App Store",
              onPress: () => Linking.openURL("market://details?id=io.metamask"),
            },
            { text: "Cancel", style: "cancel" },
          ]
        );
        setIsConnecting(false);
      }
    } catch (error: any) {
      console.error("Connection error:", error);
      Alert.alert(
        "Connection Failed",
        error.message || "Failed to connect to MetaMask"
      );
      setIsConnecting(false);
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
    if (!signClient || !sessionTopic || !address)
      throw new Error("No wallet connected");
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
      const { isUserRegistered } = await import("../utils/contract");
      const registered = await isUserRegistered(provider, address);
      setIsRegistered(registered);
      return registered;
    } catch (error) {
      console.error("Check registration error:", error);
      return false;
    }
  };

  const signIn = async () => {
    if (!signClient || !sessionTopic || !address)
      throw new Error("No wallet connected");

    console.log("SignIn called with:", {
      hasSignClient: !!signClient,
      sessionTopic: sessionTopic?.substring(0, 10) + "...",
      address,
    });

    try {
      const { signInUser } = await import("../utils/contract");
      await signInUser(signClient, sessionTopic, address);
      // Update registration status after successful sign in
      await checkRegistration();
    } catch (error) {
      console.error("Sign in error:", error);
      throw error; // Re-throw so SignInScreen can handle the error modal
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
  ): Promise<{ hash: any; note?: string }> => {
    console.log("updateUserData called with:", {
      signClient: !!signClient,
      sessionTopic,
      address,
    });
    if (!signClient || !sessionTopic || !address)
      throw new Error("No wallet connected");
    try {
      const { updateUserData: updateData } = await import("../utils/contract");
      console.log("Calling updateData from contract utils");
      const result = await updateData(
        signClient,
        sessionTopic,
        address,
        firstName,
        lastName,
        birthdate,
        gender,
        location,
        id,
        traits,
        mbti
      );
      if (!result) {
        throw new Error("Transaction failed - no hash returned");
      }
      return result; // Return transaction hash
    } catch (error) {
      console.error("Update user data error:", error);
      throw error; // Re-throw to let caller handle
    }
  };

  const getUserDataByTransaction = async (transactionHash: string) => {
    if (!address) throw new Error("No wallet connected");
    const { getLocalUserDataByTransaction } = await import("../utils/contract");
    return await getLocalUserDataByTransaction(transactionHash, address);
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
        isConnecting,
        connectWallet,
        disconnectWallet,
        clearAllSessions,
        signMessage,
        checkRegistration,
        signIn,
        updateUserData,
        getUserDataByTransaction,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};
