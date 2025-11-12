import "@nomicfoundation/hardhat-ethers";

export default {
  solidity: "0.8.0",
  networks: {
    polygon: {
      url: "https://polygon-rpc.com",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
};
