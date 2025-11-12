import { ethers } from "ethers";

const CONTRACT_ADDRESS = "0xE4fC636D0da367f402b33e413442b43B1b103c01";
const POLYGON_RPC = "https://polygon-rpc.com";

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
          { internalType: "string", name: "encryptedLastName", type: "string" },
          {
            internalType: "string",
            name: "encryptedBirthdate",
            type: "string",
          },
          { internalType: "string", name: "encryptedGender", type: "string" },
          { internalType: "string", name: "encryptedLocation", type: "string" },
          { internalType: "string", name: "encryptedID", type: "string" },
          { internalType: "string", name: "encryptedTraits", type: "string" },
          { internalType: "string", name: "encryptedMBTI", type: "string" },
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
];

async function testContractCall() {
  const provider = new ethers.JsonRpcProvider(POLYGON_RPC);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

  // Test data
  const testData = [
    "encrypted_first",
    "encrypted_last",
    "encrypted_birthdate",
    "encrypted_gender",
    "encrypted_location",
    "encrypted_id",
    "encrypted_traits",
    "encrypted_mbti",
  ];

  try {
    // Check if user is registered first
    const testAddress = "0xec854d732747b7c4e9ec0392fc81a470c4c500e9"; // The address from the logs
    const isRegistered = await contract.isUserRegistered(testAddress);
    console.log("User registered:", isRegistered);

    // Try to estimate gas for the transaction
    try {
      const gasEstimate = await contract.updateData.estimateGas(testData);
      console.log("Gas estimate:", gasEstimate.toString());
    } catch (gasError) {
      console.log("Gas estimation failed:", gasError.message);
    }

    // Try to call the function (this will fail but give us the revert reason)
    try {
      const tx = await contract.updateData(testData);
      console.log("Transaction sent:", tx.hash);
      await tx.wait();
      console.log("Transaction confirmed!");
    } catch (callError) {
      console.log("Contract call failed:", callError.message);
      if (callError.data) {
        console.log("Revert data:", callError.data);
      }
    }
  } catch (error) {
    console.error("Error:", error.message);
  }
}

testContractCall();
