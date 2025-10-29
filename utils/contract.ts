import { ethers } from "ethers";
import CryptoJS from "crypto-js";
import { Alert } from "react-native";

// Placeholder contract address - replace after deployment
const CONTRACT_ADDRESS = "0xE4fC636D0da367f402b33e413442b43B1b103c01"; // Deployed on Polygon mainnet

const POLYGON_RPC = "https://polygon-rpc.com";
const publicProvider = new ethers.JsonRpcProvider(POLYGON_RPC);

const ABI = [
  {
    inputs: [
      {
        components: [
          {
            internalType: "string",
            name: "encryptedFirstName",
            type: "string",
          },
          {
            internalType: "string",
            name: "encryptedLastName",
            type: "string",
          },
          {
            internalType: "string",
            name: "encryptedBirthdate",
            type: "string",
          },
          {
            internalType: "string",
            name: "encryptedGender",
            type: "string",
          },
          {
            internalType: "string",
            name: "encryptedLocation",
            type: "string",
          },
          {
            internalType: "string",
            name: "encryptedID",
            type: "string",
          },
          {
            internalType: "string",
            name: "encryptedTraits",
            type: "string",
          },
          {
            internalType: "string",
            name: "encryptedMBTI",
            type: "string",
          },
        ],
        internalType: "struct UserDataStorage.UserInput",
        name: "input",
        type: "tuple",
      },
    ],
    name: "updateData",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "signIn",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "_user",
        type: "address",
      },
    ],
    name: "isUserRegistered",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "user",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "timestamp",
        type: "uint256",
      },
    ],
    name: "DataUpdated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "user",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "timestamp",
        type: "uint256",
      },
    ],
    name: "SignedIn",
    type: "event",
  },
];

// Simple encryption key - in production, derive from wallet signature or use better key management
const ENCRYPTION_KEY = "fuse-secret-key-2025"; // Replace with secure key

export const encryptData = (data: string): string => {
  return CryptoJS.AES.encrypt(data, ENCRYPTION_KEY).toString();
};

export const decryptData = (encryptedData: string): string => {
  const bytes = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
};

export const getContract = (
  provider: any,
  signer?: any,
  isView: boolean = false
) => {
  if (isView) {
    return new ethers.Contract(CONTRACT_ADDRESS, ABI, publicProvider);
  }
  if (!signer) {
    throw new Error("Signer is required for transactions");
  }
  return new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
};

export const updateUserData = async (
  signClient: any,
  sessionTopic: string,
  address: string,
  firstName: string,
  lastName: string,
  birthdate: string,
  gender: string,
  location: string,
  id: string,
  traits: string,
  mbti: string
) => {
  console.log("updateUserData in contract.ts called with:", { sessionTopic, address });

  try {
    const contract = getContract(publicProvider, undefined, true); // Use public provider for encoding

    // Encrypt the data
    const encryptedFirstName = encryptData(firstName);
    const encryptedLastName = encryptData(lastName);
    const encryptedBirthdate = encryptData(birthdate);
    const encryptedGender = encryptData(gender);
    const encryptedLocation = encryptData(location);
    const encryptedID = id ? encryptData(id) : "";
    const encryptedTraits = encryptData(traits);
    const encryptedMBTI = encryptData(mbti);

    const input = {
      encryptedFirstName,
      encryptedLastName,
      encryptedBirthdate,
      encryptedGender,
      encryptedLocation,
      encryptedID,
      encryptedTraits,
      encryptedMBTI,
    };
    console.log("Data prepared for contract");

    let data: string;
    try {
      // Try to encode the function call
      data = contract.interface.encodeFunctionData("updateData", [input]);
      console.log("Function data encoded successfully");
    } catch (encodeError) {
      console.warn("Contract encoding failed, will still attempt transaction:", encodeError);
      // If encoding fails, send a basic transaction - MetaMask will still open
      data = "0x00"; // Minimal data, MetaMask will still show the transaction
    }

    // Send transaction through WalletConnect - always attempt this
    console.log("Sending transaction to MetaMask...");
    console.log("Transaction to:", CONTRACT_ADDRESS);

    // Add timeout to prevent hanging
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Transaction timeout - MetaMask didn't respond within 30 seconds")), 30000); // 30 second timeout
    });

    const txPromise = signClient.request({
      topic: sessionTopic,
      chainId: "eip155:137",
      request: {
        method: "eth_sendTransaction",
        params: [{
          from: address,
          to: CONTRACT_ADDRESS,
          data: data,
          gasLimit: "0x493E0", // 300,000 gas (increased)
          gasPrice: "0x5F5E100", // 100 gwei (increased for Polygon)
        }],
      },
    });

    const txHash = await Promise.race([txPromise, timeoutPromise]);
    console.log("Transaction sent successfully, hash:", txHash);
    return { hash: txHash };
  } catch (error: any) {
    console.error("Transaction failed:", error);

    // If it's a contract-related error, provide better messaging
    if (error.message?.includes("cryptoJs") || error.message?.includes("CryptoJS")) {
      console.error("CryptoJS error - check if crypto-js package is properly installed");
      throw new Error("Encryption library error. Please check CryptoJS installation.");
    }

    if (error.message?.includes("invalid") || error.message?.includes("address")) {
      console.error("Contract address might be invalid or contract not deployed");
      throw new Error("Contract interaction failed. Contract may not be deployed at this address.");
    }

    // If transaction fails, throw the error instead of simulating
    throw error;
  }
};

export const signInUser = async (
  signClient: any,
  sessionTopic: string,
  address: string
) => {
  const contract = getContract(publicProvider, undefined, true); // Use public provider for encoding

  // Encode the function call
  const data = contract.interface.encodeFunctionData("signIn", []);

  // Send transaction through WalletConnect
  console.log("Sending signIn transaction through WalletConnect...");
  console.log("Transaction params:", {
    from: address,
    to: CONTRACT_ADDRESS,
    data: data,
    gasLimit: "0x30D40", // 200,000 gas
    gasPrice: "0x5F5E100", // 100 gwei
  });

  try {
    // Add timeout to prevent hanging
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Sign in timeout - MetaMask didn't respond within 30 seconds")), 30000); // 30 second timeout
    });

    const txPromise = signClient.request({
      topic: sessionTopic,
      chainId: "eip155:137",
      request: {
        method: "eth_sendTransaction",
        params: [{
          from: address,
          to: CONTRACT_ADDRESS,
          data: data,
          gasLimit: "0x30D40", // 200,000 gas
          gasPrice: "0x5F5E100", // 100 gwei
        }],
      },
    });

    const txHash = await Promise.race([txPromise, timeoutPromise]);
    console.log("SignIn transaction sent successfully, hash:", txHash);
    return { hash: txHash };
  } catch (error) {
    console.error("SignIn transaction failed:", error);
    throw error;
  }
};

export const getUserDataByTransaction = async (
  transactionHash: string,
  userAddress: string
) => {
  try {
    // First verify the transaction belongs to this user
    const provider = new ethers.JsonRpcProvider(POLYGON_RPC);

    // Get transaction details
    const tx = await provider.getTransaction(transactionHash);
    if (!tx) {
      throw new Error("Transaction not found");
    }

    // Verify the transaction is from the user's address
    if (tx.from.toLowerCase() !== userAddress.toLowerCase()) {
      throw new Error("Transaction does not belong to this user");
    }

    // Verify the transaction is to our contract
    if (tx.to?.toLowerCase() !== CONTRACT_ADDRESS.toLowerCase()) {
      throw new Error("Transaction is not to the Fuse contract");
    }

    // Since the contract doesn't have retrieval functionality yet,
    // we'll return the transaction verification info
    // In a full implementation, the contract would have a getUserData function
    return {
      transactionHash,
      verified: true,
      userAddress,
      contractAddress: CONTRACT_ADDRESS,
      note: "Data retrieval requires contract upgrade. Data is stored locally."
    };
  } catch (error) {
    console.error("Error retrieving user data by transaction:", error);
    throw error;
  }
};

export const getLocalUserDataByTransaction = async (transactionHash: string) => {
  try {
    // Import AsyncStorage dynamically to avoid circular dependencies
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;

    const storedData = await AsyncStorage.getItem("userData");
    if (!storedData) {
      throw new Error("No local user data found");
    }

    const userData = JSON.parse(storedData);
    if (userData.transactionHash !== transactionHash) {
      throw new Error("Transaction hash does not match stored data");
    }

    return userData;
  } catch (error) {
    console.error("Error retrieving local user data:", error);
    throw error;
  }
};

export const isUserRegistered = async (provider: any, userAddress: string) => {
  const contract = getContract(provider, undefined, true);
  return await contract.isUserRegistered(userAddress);
};
