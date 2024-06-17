import type { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-chai-matchers";

const config: HardhatUserConfig = {
  networks: {
    hardhat: {
      blockGasLimit: 100_000_000,
      allowUnlimitedContractSize: true
    }
  },
  defaultNetwork: "hardhat",
  solidity: {
    version:  "0.8.13",
    settings: {
      optimizer: {
        enabled: true,
        runs: 5,
      }
    },
  },
};

export default config;
