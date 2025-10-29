const { ethers } = require("ethers");

// Test the contract encoding fix
const CONTRACT_ADDRESS = "0xE4fC636D0da367f402b33e413442b43B1b103c01";

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
        internalType: "struct UserDataStorage.UserData",
        name: "data",
        type: "tuple",
      },
    ],
    name: "updateData",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
];

async function testContractEncoding() {
  const provider = new ethers.JsonRpcProvider("https://polygon-rpc.com");
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

  // Test data - using array format as fixed
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
    // Test encoding
    const encodedData = contract.interface.encodeFunctionData("updateData", [
      testData,
    ]);
    console.log("✅ Contract encoding successful!");
    console.log("Encoded data length:", encodedData.length, "characters");
    console.log("First 100 chars:", encodedData.substring(0, 100));

    // Test decoding
    const decoded = contract.interface.decodeFunctionData(
      "updateData",
      encodedData
    );
    console.log("✅ Contract decoding successful!");
    console.log("Decoded data:", decoded);
  } catch (error) {
    console.error("❌ Contract encoding/decoding failed:", error.message);
  }
}

testContractEncoding();
