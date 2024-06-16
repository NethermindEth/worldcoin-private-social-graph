import hre from "hardhat";
import { expect, assert} from 'chai';
import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";

// A deployment function to set up the initial state

const deployVoting = async () => {
    console.log("Deploy Voting")
    
    const poseidon3Lib = await hre.viem.deployContract("poseidon-solidity/PoseidonT3.sol:PoseidonT3")
    console.log("Deploy Poseidon 3:", poseidon3Lib.address)
    
    const binaryIMTLib = await hre.viem.deployContract("BinaryIMT", [], 
        {
            libraries: {
                PoseidonT3: poseidon3Lib.address
            }
        }
    )
    console.log("Deploy IMT:", binaryIMTLib.address)
    
    const poseidon2Lib = await hre.viem.deployContract("PoseidonT2")
    console.log("Deploy Poseidon 2:", poseidon2Lib.address)
            
    const voteVerifier = await hre.viem.deployContract("contracts/src/vote-plonk-verifier.sol:UltraVerifier")
    console.log("Deploy vote verifier:", voteVerifier.address)

    const claimVerifier = await hre.viem.deployContract("contracts/src/claim-plonk-verifier.sol:UltraVerifier")
    console.log("Deploy claim verifier:", claimVerifier.address)
    
    const worldcoinVerifier = await hre.viem.deployContract("FakeWorldcoinVerifier")
    console.log("Deploy worldcoin verifier:", worldcoinVerifier.address)

    const voting = await hre.viem.deployContract("WorldcoinSocialGraphVoting", 
        [worldcoinVerifier.address, voteVerifier.address, claimVerifier.address],
        {
            libraries: {
                PoseidonT2: poseidon2Lib.address,
                PoseidonT3: poseidon3Lib.address,
                BinaryIMT: binaryIMTLib.address,
            }
        }
    );
    console.log("Deploy voting: ", voting.address)
  
    return { voting };
};

describe("Voting Contract Tests", function () {
    it("Should deploy voting contract", async () => {
        const { voting } = await loadFixture(deployVoting);
    })
});
  