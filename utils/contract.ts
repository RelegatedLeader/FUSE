import { ethers } from 'ethers';
import CryptoJS from 'crypto-js';

// Placeholder contract address - replace after deployment
const CONTRACT_ADDRESS = '0xe82803d68aE5610101c83b42667ccE437Dc6D73B'; // Deployed on Polygon mainnet

const ABI = [
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "_encryptedFirstName",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "_encryptedLastName",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "_encryptedID",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "_encryptedTraits",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "_encryptedMBTI",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "_encryptedFace",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "_encryptedBio",
        "type": "string"
      }
    ],
    "name": "updateData",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "_encryptedEmail",
        "type": "string"
      }
    ],
    "name": "addEmail",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "_encryptedPost",
        "type": "string"
      }
    ],
    "name": "addPost",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_allianceId",
        "type": "uint256"
      }
    ],
    "name": "joinAlliance",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_user",
        "type": "address"
      }
    ],
    "name": "getIdentityData",
    "outputs": [
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      },
      {
        "internalType": "string[]",
        "name": "",
        "type": "string[]"
      },
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_user",
        "type": "address"
      }
    ],
    "name": "getPersonalityData",
    "outputs": [
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      },
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      },
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_user",
        "type": "address"
      }
    ],
    "name": "getExtendedData",
    "outputs": [
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      },
      {
        "internalType": "string[]",
        "name": "",
        "type": "string[]"
      },
      {
        "internalType": "uint256[]",
        "name": "",
        "type": "uint256[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_user",
        "type": "address"
      }
    ],
    "name": "getPostCount",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_user",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "_index",
        "type": "uint256"
      }
    ],
    "name": "getPost",
    "outputs": [
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_user",
        "type": "address"
      }
    ],
    "name": "getAllianceCount",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "name": "userData",
    "outputs": [
      {
        "internalType": "string",
        "name": "encryptedFirstName",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "encryptedLastName",
        "type": "string"
      },
      {
        "internalType": "string[]",
        "name": "encryptedEmails",
        "type": "string[]"
      },
      {
        "internalType": "string",
        "name": "encryptedID",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "encryptedTraits",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "encryptedMBTI",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "encryptedFace",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "encryptedBio",
        "type": "string"
      },
      {
        "internalType": "string[]",
        "name": "encryptedPosts",
        "type": "string[]"
      },
      {
        "internalType": "uint256[]",
        "name": "alliances",
        "type": "uint256[]"
      },
      {
        "internalType": "uint256",
        "name": "lastUpdate",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "interactionCount",
        "type": "uint256"
      },
      {
        "internalType": "bool",
        "name": "isVerified",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "user",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "timestamp",
        "type": "uint256"
      }
    ],
    "name": "DataUpdated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "user",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "postIndex",
        "type": "uint256"
      }
    ],
    "name": "PostAdded",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "user",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "allianceId",
        "type": "uint256"
      }
    ],
    "name": "AllianceJoined",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "user",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "emailIndex",
        "type": "uint256"
      }
    ],
    "name": "EmailAdded",
    "type": "event"
  }
];

// Simple encryption key - in production, derive from wallet signature or use better key management
const ENCRYPTION_KEY = 'fuse-secret-key-2025'; // Replace with secure key

export const encryptData = (data: string): string => {
  return CryptoJS.AES.encrypt(data, ENCRYPTION_KEY).toString();
};

export const decryptData = (encryptedData: string): string => {
  const bytes = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
};

export const getContract = (provider: any, signer?: any) => {
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
  id: string,
  traits: string,
  mbti: string,
  faceData: string,
  bio: string
) => {
  const contract = getContract(provider);
  const encryptedFirstName = encryptData(firstName);
  const encryptedLastName = encryptData(lastName);
  const encryptedID = id ? encryptData(id) : '';
  const encryptedTraits = encryptData(traits);
  const encryptedMBTI = encryptData(mbti);
  const encryptedFace = encryptData(faceData);
  const encryptedBio = encryptData(bio);

  const tx = await contract.updateData(
    encryptedFirstName,
    encryptedLastName,
    encryptedID,
    encryptedTraits,
    encryptedMBTI,
    encryptedFace,
    encryptedBio
  );
  await tx.wait();
  return tx;
};

export const addUserEmail = async (provider: any, email: string) => {
  const contract = getContract(provider);
  const encryptedEmail = encryptData(email);
  const tx = await contract.addEmail(encryptedEmail);
  await tx.wait();
  return tx;
};

export const addUserPost = async (provider: any, post: string) => {
  const contract = getContract(provider);
  const encryptedPost = encryptData(post);
  const tx = await contract.addPost(encryptedPost);
  await tx.wait();
  return tx;
};

export const joinUserAlliance = async (provider: any, allianceId: number) => {
  const contract = getContract(provider);
  const tx = await contract.joinAlliance(allianceId);
  await tx.wait();
  return tx;
};

export const getUserData = async (provider: any, userAddress: string) => {
  const contract = getContract(provider);
  const identityData = await contract.getIdentityData(userAddress);
  const personalityData = await contract.getPersonalityData(userAddress);
  const extendedData = await contract.getExtendedData(userAddress);
  return {
    encryptedFirstName: identityData[0],
    encryptedLastName: identityData[1],
    encryptedEmails: identityData[2],
    encryptedID: identityData[3],
    encryptedTraits: personalityData[0],
    encryptedMBTI: personalityData[1],
    encryptedFace: personalityData[2],
    lastUpdate: personalityData[3].toNumber(),
    interactionCount: personalityData[4].toNumber(),
    isVerified: personalityData[5],
    encryptedBio: extendedData[0],
    encryptedPosts: extendedData[1],
    alliances: extendedData[2].map((id: any) => id.toNumber()),
  };
};

export const decryptUserData = (encryptedData: any) => {
  return {
    firstName: decryptData(encryptedData.encryptedFirstName),
    lastName: decryptData(encryptedData.encryptedLastName),
    emails: encryptedData.encryptedEmails.map((e: string) => decryptData(e)),
    id: encryptedData.encryptedID ? decryptData(encryptedData.encryptedID) : '',
    traits: JSON.parse(decryptData(encryptedData.encryptedTraits)),
    mbti: decryptData(encryptedData.encryptedMBTI),
    faceData: decryptData(encryptedData.encryptedFace),
    bio: decryptData(encryptedData.encryptedBio),
    posts: encryptedData.encryptedPosts.map((p: string) => decryptData(p)),
    alliances: encryptedData.alliances,
    lastUpdate: encryptedData.lastUpdate,
    interactionCount: encryptedData.interactionCount,
    isVerified: encryptedData.isVerified,
  };
};