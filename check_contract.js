import { ethers } from 'ethers';

const CONTRACT_ADDRESS = "0xE4fC636D0da367f402b33e413442b43B1b103c01";
const POLYGON_RPC = "https://polygon-rpc.com";

const ABI = [
  {
    inputs: [
      {
        components: [
          { internalType: "string", name: "encryptedFirstName", type: "string" },
          { internalType: "string", name: "encryptedLastName", type: "string" },
          { internalType: "string", name: "encryptedBirthdate", type: "string" },
          { internalType: "string", name: "encryptedGender", type: "string" },
          { internalType: "string", name: "encryptedLocation", type: "string" },
          { internalType: "string", name: "encryptedID", type: "string" },
          { internalType: "string", name: "encryptedTraits", type: "string" },
          { internalType: "string", name: "encryptedMBTI", type: "string" }
        ],
        internalType: "struct UserDataStorage.UserData",
        name: "data",
        type: "tuple"
      }
    ],
    name: "updateData",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  }
];

async function checkContract() {
  const provider = new ethers.JsonRpcProvider(POLYGON_RPC);

  try {
    // Check if contract exists
    const code = await provider.getCode(CONTRACT_ADDRESS);
    console.log("Contract code length:", code.length);

    if (code === "0x") {
      console.log("❌ Contract does not exist at this address!");
      return;
    }

    console.log("✅ Contract exists at address");

    // Try to create contract instance
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

    // Check if the function exists
    try {
      const functionData = contract.interface.getFunction("updateData");
      console.log("✅ updateData function exists:", functionData);
      console.log("Function inputs:", functionData.inputs);
      if (functionData.inputs[0] && functionData.inputs[0].components) {
        console.log("Tuple components:", functionData.inputs[0].components);
      }
    } catch (error) {
      console.log("❌ updateData function not found:", error.message);
    }

    // Try to call a view function if it exists
    try {
      // Check if there's a getUserData function
      const getFunction = contract.interface.getFunction("getUserData");
      console.log("✅ getUserData function exists:", getFunction);
    } catch (error) {
      console.log("ℹ️  getUserData function not found (this is ok if it doesn't exist)");
    }

  } catch (error) {
    console.error("❌ Error checking contract:", error.message);
  }
}

checkContract();