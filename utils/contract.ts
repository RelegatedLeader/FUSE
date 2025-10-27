import { ethers } from "ethers";
import CryptoJS from "crypto-js";

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
    const ethersProvider = new ethers.BrowserProvider(provider);
    signer = ethersProvider.getSigner();
  }
  return new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
};

export const updateUserData = async (
  provider: any,
  firstName: string,
  lastName: string,
  birthdate: string,
  gender: string,
  location: string,
  id: string,
  traits: string,
  mbti: string
) => {
  const contract = getContract(provider);
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

  const tx = await contract.updateData(input);
  await tx.wait();
  return tx;
};

export const signInUser = async (provider: any) => {
  const contract = getContract(provider);
  const tx = await contract.signIn();
  await tx.wait();
  return tx;
};

export const isUserRegistered = async (provider: any, userAddress: string) => {
  const contract = getContract(provider, undefined, true);
  return await contract.isUserRegistered(userAddress);
};
