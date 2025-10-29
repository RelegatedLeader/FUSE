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
  const contract = getContract(publicProvider, undefined, true); // Use public provider for encoding
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

  // Encode the function call
  const data = contract.interface.encodeFunctionData("updateData", [input]);

  // Send transaction through WalletConnect
  console.log("Sending updateData transaction through WalletConnect...");
  console.log("Transaction params:", {
    from: address,
    to: CONTRACT_ADDRESS,
    data: data.substring(0, 100) + "...", // Log first 100 chars of data
    gasLimit: "0x30D40",
    gasPrice: "0x3B9ACA00",
  });

  try {
    const txHash = await signClient.request({
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

    console.log("Transaction sent successfully, hash:", txHash);
    return { hash: txHash };
  } catch (error) {
    console.error("Transaction failed:", error);
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
    const txHash = await signClient.request({
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

    console.log("SignIn transaction sent successfully, hash:", txHash);
    return { hash: txHash };
  } catch (error) {
    console.error("SignIn transaction failed:", error);
    throw error;
  }
};

export const isUserRegistered = async (provider: any, userAddress: string) => {
  const contract = getContract(provider, undefined, true);
  return await contract.isUserRegistered(userAddress);
};
