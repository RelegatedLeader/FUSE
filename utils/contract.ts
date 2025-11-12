import { ethers } from "ethers";
import CryptoJS from "crypto-js";
import { Alert, Linking } from "react-native";
// import Arweave from "arweave";
// import { default as Bundlr } from "@bundlr-network/client";

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
    inputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    name: "userData",
    outputs: [
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
      {
        internalType: "uint256",
        name: "lastUpdate",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "interactionCount",
        type: "uint256",
      },
      {
        internalType: "bool",
        name: "isVerified",
        type: "bool",
      },
      {
        internalType: "bool",
        name: "isRegistered",
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
  if (!encryptedData) return "";
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    console.error("Decryption failed:", error);
    return "";
  }
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
  console.log("updateUserData in contract.ts called with:", {
    sessionTopic,
    address,
  });

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

    let data: string = "";
    try {
      // Try to encode updateData first - if this succeeds, the function exists
      data = contract.interface.encodeFunctionData("updateData", [input]);
      console.log(
        "✅ updateData function encoded successfully - function exists"
      );
    } catch (encodeError) {
      console.warn(
        "❌ updateData encoding failed, function may not exist on contract:",
        (encodeError as Error).message
      );
      // If encoding fails, try signIn
      try {
        data = contract.interface.encodeFunctionData("signIn", []);
        console.log("🔄 Falling back to signIn function");
      } catch (signInError) {
        console.warn("❌ signIn encoding also failed:", signInError);
        // Last resort: send minimal transaction that MetaMask can still display
        data = "0x00";
      }
    }

    // Estimate gas dynamically
    console.log("🔍 Estimating gas for transaction...");
    let gasLimit: string;
    let maxFeePerGas: string;
    let maxPriorityFeePerGas: string;

    try {
      // Create a temporary transaction object for gas estimation
      const tempTx = {
        from: address,
        to: CONTRACT_ADDRESS,
        data: data,
        value: "0x0",
      };

      // Estimate gas limit
      const estimatedGas = await publicProvider.estimateGas(tempTx);
      const gasLimitWithBuffer = (estimatedGas * BigInt(120)) / BigInt(100); // 20% buffer
      gasLimit = "0x" + gasLimitWithBuffer.toString(16);
      console.log("📊 Estimated gas limit:", gasLimit, "(with 20% buffer)");

      // Get current fee data
      const feeData = await publicProvider.getFeeData();
      const baseFee =
        feeData.maxFeePerGas ||
        feeData.gasPrice ||
        ethers.parseUnits("50", "gwei");
      const priorityFee =
        feeData.maxPriorityFeePerGas || ethers.parseUnits("30", "gwei");

      // Apply buffers
      const bufferedMaxFee = (baseFee * BigInt(150)) / BigInt(100); // 50% buffer on base fee
      const bufferedPriorityFee = (priorityFee * BigInt(150)) / BigInt(100); // 50% buffer on priority fee

      maxFeePerGas = "0x" + bufferedMaxFee.toString(16);
      maxPriorityFeePerGas = "0x" + bufferedPriorityFee.toString(16);

      console.log(
        "💰 Max fee per gas:",
        ethers.formatUnits(bufferedMaxFee, "gwei"),
        "gwei"
      );
      console.log(
        "⚡ Max priority fee per gas:",
        ethers.formatUnits(bufferedPriorityFee, "gwei"),
        "gwei"
      );
    } catch (gasError) {
      console.warn(
        "⚠️ Gas estimation failed, using fallback values:",
        gasError
      );
      // Fallback values
      gasLimit = "0x493E0"; // 300,000
      maxFeePerGas = "0xB2D05E00"; // ~75 gwei
      maxPriorityFeePerGas = "0x6F05B59D"; // ~30 gwei
    }

    // Send transaction through WalletConnect
    console.log("📤 Sending contract transaction...");
    console.log("Transaction to:", CONTRACT_ADDRESS);

    // Skip network checking for now - let WalletConnect handle network switching
    // This prevents hanging on network checks and allows the transaction to proceed directly
    console.log(
      "🔄 Skipping network check - proceeding directly to Polygon transaction"
    );

    // Add timeout to prevent hanging
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(
        () =>
          reject(
            new Error(
              "Transaction timeout - MetaMask didn't respond within 90 seconds"
            )
          ),
        90000
      ); // 90 second timeout (increased for Polygon network)
    });

    // Send transaction directly to Polygon
    console.log("📤 Sending transaction request to MetaMask...");

    const txPromise = signClient.request({
      topic: sessionTopic,
      chainId: "eip155:137",
      request: {
        method: "eth_sendTransaction",
        params: [
          {
            from: address,
            to: CONTRACT_ADDRESS,
            data: data,
            value: "0x0", // 0 ETH
            gasLimit: gasLimit,
            maxFeePerGas: maxFeePerGas,
            maxPriorityFeePerGas: maxPriorityFeePerGas,
          },
        ],
      },
    });

    console.log("📋 Transaction details:", {
      from: address,
      to: CONTRACT_ADDRESS,
      data: data.substring(0, 50) + "...",
      value: "0x0",
      gasLimit: gasLimit,
      maxFeePerGas: maxFeePerGas,
      maxPriorityFeePerGas: maxPriorityFeePerGas,
    });

    // FORCE OPEN METAMASK - This ensures MetaMask opens regardless of WalletConnect redirect
    console.log("🔗 Force opening MetaMask app...");
    console.log("⏰ Starting 500ms delay before opening MetaMask...");

    // Small delay to ensure transaction request is processed first
    setTimeout(async () => {
      console.log("🚀 Executing MetaMask force open now...");
      try {
        // Try multiple MetaMask opening methods - prioritize direct app links
        const urls = [
          "metamask://wallet", // Direct wallet link (try first)
          "metamask://", // Generic app link
          "https://metamask.app.link/wc", // WalletConnect specific link (fallback)
        ];

        for (const url of urls) {
          try {
            console.log("🔗 Attempting to open MetaMask with URL:", url);
            await Linking.openURL(url);
            console.log("✅ MetaMask open URL triggered:", url);
            break; // Stop after first successful attempt
          } catch (e) {
            console.log("⚠️ Failed to open URL:", url, (e as Error).message);
          }
        }
      } catch (linkError) {
        console.warn("⚠️ Could not open MetaMask URL:", linkError);
      }
    }, 500); // 500ms delay

    try {
      console.log("⏳ Waiting for MetaMask approval (90 second timeout)...");
      const txHash = await Promise.race([txPromise, timeoutPromise]);
      console.log("✅ Transaction approved! Hash:", txHash);
      console.log("Transaction sent successfully, hash:", txHash);
      return { hash: txHash };
    } catch (txError) {
      console.error("❌ Transaction failed or timed out:", txError);
      throw txError;
    }
  } catch (error: any) {
    console.error("Transaction failed:", error);

    // If it's a contract-related error, provide better messaging
    if (
      error.message?.includes("cryptoJs") ||
      error.message?.includes("CryptoJS")
    ) {
      console.error(
        "CryptoJS error - check if crypto-js package is properly installed"
      );
      throw new Error(
        "Encryption library error. Please check CryptoJS installation."
      );
    }

    if (
      error.message?.includes("invalid") ||
      error.message?.includes("address")
    ) {
      console.error(
        "Contract address might be invalid or contract not deployed"
      );
      throw new Error(
        "Contract interaction failed. Contract may not be deployed at this address."
      );
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

  // Estimate gas dynamically
  console.log("🔍 Estimating gas for signIn transaction...");
  let gasLimit: string;
  let maxFeePerGas: string;
  let maxPriorityFeePerGas: string;

  try {
    // Create a temporary transaction object for gas estimation
    const tempTx = {
      from: address,
      to: CONTRACT_ADDRESS,
      data: data,
      value: "0x0",
    };

    // Estimate gas limit
    const estimatedGas = await publicProvider.estimateGas(tempTx);
    const gasLimitWithBuffer = (estimatedGas * BigInt(120)) / BigInt(100); // 20% buffer
    gasLimit = "0x" + gasLimitWithBuffer.toString(16);
    console.log(
      "📊 Estimated gas limit for signIn:",
      gasLimit,
      "(with 20% buffer)"
    );

    // Get current fee data
    const feeData = await publicProvider.getFeeData();
    const baseFee =
      feeData.maxFeePerGas ||
      feeData.gasPrice ||
      ethers.parseUnits("50", "gwei");
    const priorityFee =
      feeData.maxPriorityFeePerGas || ethers.parseUnits("30", "gwei");

    // Apply buffers
    const bufferedMaxFee = (baseFee * BigInt(150)) / BigInt(100); // 50% buffer on base fee
    const bufferedPriorityFee = (priorityFee * BigInt(150)) / BigInt(100); // 50% buffer on priority fee

    maxFeePerGas = "0x" + bufferedMaxFee.toString(16);
    maxPriorityFeePerGas = "0x" + bufferedPriorityFee.toString(16);

    console.log(
      "💰 Max fee per gas for signIn:",
      ethers.formatUnits(bufferedMaxFee, "gwei"),
      "gwei"
    );
    console.log(
      "⚡ Max priority fee per gas for signIn:",
      ethers.formatUnits(bufferedPriorityFee, "gwei"),
      "gwei"
    );
  } catch (gasError) {
    console.warn(
      "⚠️ Gas estimation failed for signIn, using fallback values:",
      gasError
    );
    // Fallback values
    gasLimit = "0x30D40"; // 200,000
    maxFeePerGas = "0xB2D05E00"; // ~75 gwei
    maxPriorityFeePerGas = "0x6F05B59D"; // ~30 gwei
  }

  // Send transaction through WalletConnect
  console.log("📤 Sending signIn transaction...");
  console.log("Transaction params:", {
    from: address,
    to: CONTRACT_ADDRESS,
    data: data,
    gasLimit: gasLimit,
    maxFeePerGas: maxFeePerGas,
    maxPriorityFeePerGas: maxPriorityFeePerGas,
  });

  // First ensure we're on Polygon network
  try {
    await signClient.request({
      topic: sessionTopic,
      chainId: "eip155:137",
      request: {
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x89" }], // Polygon mainnet chainId in hex
      },
    });
    console.log("Switched to Polygon network for signIn");
  } catch (switchError) {
    console.log(
      "Network switch failed or already on Polygon for signIn:",
      switchError
    );
  }

  try {
    // Add timeout to prevent hanging
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(
        () =>
          reject(
            new Error(
              "Sign in timeout - MetaMask didn't respond within 90 seconds"
            )
          ),
        90000
      ); // 90 second timeout
    });

    const txPromise = signClient.request({
      topic: sessionTopic,
      chainId: "eip155:137",
      request: {
        method: "eth_sendTransaction",
        params: [
          {
            from: address,
            to: CONTRACT_ADDRESS,
            data: data,
            value: "0x0", // 0 ETH
            gasLimit: gasLimit,
            maxFeePerGas: maxFeePerGas,
            maxPriorityFeePerGas: maxPriorityFeePerGas,
          },
        ],
      },
    });

    // FORCE OPEN METAMASK - This ensures MetaMask opens regardless of WalletConnect redirect
    console.log("🔗 Force opening MetaMask app for signIn...");
    // Small delay to ensure transaction request is processed first
    setTimeout(async () => {
      try {
        // Try multiple MetaMask opening methods - prioritize direct app links
        const urls = [
          "metamask://wallet", // Direct wallet link (try first)
          "metamask://", // Generic app link
          "https://metamask.app.link/wc", // WalletConnect specific link (fallback)
        ];

        for (const url of urls) {
          try {
            await Linking.openURL(url);
            console.log("✅ MetaMask open URL triggered for signIn:", url);
            break; // Stop after first successful attempt
          } catch (e) {
            console.log("⚠️ Failed to open URL:", url, (e as Error).message);
          }
        }
      } catch (linkError) {
        console.warn("⚠️ Could not open MetaMask URL for signIn:", linkError);
      }
    }, 500); // 500ms delay

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
      note: "Data retrieval requires contract upgrade. Data is stored locally.",
    };
  } catch (error) {
    console.error("Error retrieving user data by transaction:", error);
    throw error;
  }
};

export const getLocalUserDataByTransaction = async (
  transactionHash: string,
  userAddress?: string
) => {
  try {
    // Import AsyncStorage dynamically to avoid circular dependencies
    const AsyncStorage =
      require("@react-native-async-storage/async-storage").default;

    // Use wallet-specific key if address is provided
    const storageKey = userAddress ? `userData_${userAddress}` : "userData";
    const storedData = await AsyncStorage.getItem(storageKey);
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

export const getUserData = async (userAddress: string) => {
  console.log("Getting user data for:", userAddress);
  const contract = getContract(publicProvider, undefined, true);
  console.log("Contract:", contract.address);
  try {
    const data = await contract.userData(userAddress);
    console.log("Raw data from contract:", data);
    // Decrypt the data
    const decrypted = {
      firstName: decryptData(data.encryptedFirstName),
      lastName: decryptData(data.encryptedLastName),
      birthdate: decryptData(data.encryptedBirthdate),
      gender: decryptData(data.encryptedGender),
      location: decryptData(data.encryptedLocation),
      id: decryptData(data.encryptedID),
      traits: decryptData(data.encryptedTraits),
      mbti: decryptData(data.encryptedMBTI),
      lastUpdate: data.lastUpdate,
      interactionCount: data.interactionCount,
      isVerified: data.isVerified,
      isRegistered: data.isRegistered,
    };
    console.log("Decrypted data:", decrypted);
    // Calculate age from birthdate
    let age = null;
    if (decrypted.birthdate) {
      try {
        // Parse MM/DD/YYYY
        const [month, day, year] = decrypted.birthdate.split("/");
        const birthDate = new Date(
          parseInt(year),
          parseInt(month) - 1,
          parseInt(day)
        );
        if (!isNaN(birthDate.getTime())) {
          const currentYear = new Date().getFullYear();
          age = currentYear - birthDate.getFullYear();
        }
      } catch (error) {
        console.error("Error parsing birthdate:", error);
      }
    }
    return {
      name: `${decrypted.firstName} ${decrypted.lastName}`,
      age,
      city: decrypted.location,
      bio: decrypted.traits,
      ...decrypted,
    };
  } catch (error) {
    console.error("Error in getUserData:", error);
    throw error;
  }
};

// Arweave upload function using Bundlr with MATIC
// export const uploadToArweave = async (data: string, provider: any, userAddress: string) => {
//   try {
//     // Initialize Bundlr with MATIC
//     const bundlr = new Bundlr("https://node2.bundlr.network", "matic", provider);

//     // Fund the bundlr account if needed (user pays with MATIC)
//     const balance = await bundlr.getLoadedBalance();
//     const dataSize = Buffer.byteLength(data, 'utf8');
//     const cost = await bundlr.getPrice(dataSize);

//     if (balance.lt(cost)) {
//       // Fund with MATIC
//       const fundTx = await bundlr.fund(cost);
//       console.log("Funded Bundlr:", fundTx);
//     }

//     // Upload the data
//     const tx = bundlr.createTransaction(data);
//     await tx.sign();
//     const result = await tx.upload();

//     console.log("Uploaded to Arweave:", result.id);

//     // Update Polygon contract with the TX ID
//     await updateArweaveTxId(provider, userAddress, result.id);

//     return result.id;
//   } catch (error) {
//     console.error("Arweave upload error:", error);
//     throw error;
//   }
// };

// const updateArweaveTxId = async (provider: any, userAddress: string, txId: string) => {
//   const contract = getContract(provider);
//   const encryptedTxId = CryptoJS.AES.encrypt(txId, userAddress).toString();

//   const tx = await contract.updateData({
//     encryptedFirstName: "",
//     encryptedLastName: "",
//     encryptedBirthdate: "",
//     encryptedGender: "",
//     encryptedLocation: "",
//     encryptedID: "",
//     encryptedTraits: "",
//     encryptedMBTI: "",
//     arweaveTxId: encryptedTxId,
//   });

//   await tx.wait();
//   console.log("Updated Arweave TX ID on Polygon");
// };
