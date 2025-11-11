import { ethers } from "hardhat";
import fs from 'fs';

async function main() {
  console.log("🚀 Deploying UserDataStorage contract to Polygon...");

  const UserDataStorage = await ethers.getContractFactory("UserDataStorage");
  const contract = await UserDataStorage.deploy();

  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();

  console.log("✅ Contract deployed successfully!");
  console.log("📍 Contract address:", contractAddress);
  console.log("🔗 PolygonScan:", `https://polygonscan.com/address/${contractAddress}`);

  // Update the contract address in utils/contract.ts
  const contractFile = './utils/contract.ts';
  let content = fs.readFileSync(contractFile, 'utf8');
  content = content.replace(
    /const CONTRACT_ADDRESS = "0x[a-fA-F0-9]{40}"/,
    `const CONTRACT_ADDRESS = "${contractAddress}"`
  );
  fs.writeFileSync(contractFile, content);
  console.log('📝 Updated contract address in utils/contract.ts');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });