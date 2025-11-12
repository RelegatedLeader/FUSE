import { ethers } from "ethers";
import fs from "fs";

async function main() {
  console.log("🚀 Deploying UserDataStorage contract to Polygon...");

  // Connect to Polygon
  const provider = new ethers.JsonRpcProvider("https://polygon-rpc.com");
  const privateKey = process.env.PRIVATE_KEY;

  if (!privateKey) {
    console.error("❌ Please set PRIVATE_KEY environment variable");
    console.log("Example: export PRIVATE_KEY=your_private_key_here");
    process.exit(1);
  }

  const wallet = new ethers.Wallet(privateKey, provider);
  console.log("📱 Deploying from address:", wallet.address);

  // Read contract artifacts
  const artifactsPath = "./artifacts/UserDataStorage.json";
  const artifacts = JSON.parse(fs.readFileSync(artifactsPath, "utf8"));
  const contractBytecode = artifacts.bytecode;
  const contractABI = artifacts.abi;

  console.log("📄 Contract bytecode loaded, length:", contractBytecode.length);

  // Deploy contract
  const factory = new ethers.ContractFactory(
    contractABI,
    contractBytecode,
    wallet
  );

  console.log("⏳ Deploying contract...");
  const contract = await factory.deploy();
  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();
  console.log("✅ Contract deployed successfully!");
  console.log("📍 Contract address:", contractAddress);
  console.log(
    "🔗 PolygonScan:",
    `https://polygonscan.com/address/${contractAddress}`
  );

  // Update the contract address in utils/contract.ts
  const contractFile = "./utils/contract.ts";
  let content = fs.readFileSync(contractFile, "utf8");
  content = content.replace(
    /const CONTRACT_ADDRESS = "0x[a-fA-F0-9]{40}"/,
    `const CONTRACT_ADDRESS = "${contractAddress}"`
  );
  fs.writeFileSync(contractFile, content);
  console.log("📝 Updated contract address in utils/contract.ts");

  return contractAddress;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
