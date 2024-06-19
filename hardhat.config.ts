import type { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-chai-matchers";

const config: HardhatUserConfig = {
  mocha: {
    timeout: 960000
  },
  networks: {
    hardhat: {
      blockGasLimit: 100_000_000,
      allowUnlimitedContractSize: true,
    }
  },
  defaultNetwork: "hardhat",
  paths: {
    sources: "./contracts/src",
  },
  
  solidity: {
    compilers: [
      {
        version: "0.8.4",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          }
        }
      },
      {
        version: "0.8.23",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          }
        }
      },
    ],
  },
};

export default config;