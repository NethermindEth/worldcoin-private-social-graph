import hre from "hardhat";
import { expect, assert} from 'chai';
import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";

const deployVoting = async () => {
    console.log("Deploy Voting")
    
    const poseidon3Lib = await hre.ethers.deployContract("poseidon-solidity/PoseidonT3.sol:PoseidonT3")
    const poseidon3LibAddr = await poseidon3Lib.getAddress()
    console.log("Deploy Poseidon 3:", poseidon3LibAddr)
    
    const binaryIMTFactory = await hre.ethers.getContractFactory("BinaryIMT",
        {
            libraries: {
                PoseidonT3: poseidon3LibAddr
            }
        }
    )
    const binaryIMT= await binaryIMTFactory.deploy()
    const binaryIMTLibAddr = await binaryIMT.getAddress()
    console.log("Deploy IMT:", binaryIMTLibAddr)
    
    const poseidon2Lib = await hre.ethers.deployContract("PoseidonT2")
    const poseidon2LibAddr = await poseidon2Lib.getAddress()
    console.log("Deploy Poseidon 2:", poseidon2LibAddr)
            
    const voteVerifier = await hre.ethers.deployContract("contracts/src/vote-plonk-verifier.sol:UltraVerifier")
    const voteVerifierAddr = await voteVerifier.getAddress()
    console.log("Deploy vote verifier:", voteVerifierAddr)

    const claimVerifier = await hre.ethers.deployContract("contracts/src/claim-plonk-verifier.sol:UltraVerifier")
    const claimVerifierAddr = await claimVerifier.getAddress()
    console.log("Deploy claim verifier:", claimVerifierAddr)
    
    const worldcoinVerifier = await hre.ethers.deployContract("FakeWorldcoinVerifier")
    const worldcoinVerifierAddr = await worldcoinVerifier.getAddress()
    console.log("Deploy worldcoin verifier:", worldcoinVerifierAddr)

    const votingFactory = await hre.ethers.getContractFactory("WorldcoinSocialGraphVoting", 
        {
            libraries: {
                PoseidonT2: poseidon2LibAddr,
                PoseidonT3: poseidon3LibAddr,
                BinaryIMT: binaryIMTLibAddr
            }
        }
    )

    const voting = await votingFactory.deploy(worldcoinVerifierAddr, voteVerifierAddr, claimVerifierAddr)
    const votingAddr = await voting.getAddress()
    console.log("Deploy voting: ", votingAddr)
  
    return { voting, worldcoinVerifier, voteVerifier, claimVerifier };
};

describe("Voting Contract Tests", function () {
    it("Should deploy voting contract", async () => {
        const { voting, worldcoinVerifier, voteVerifier, claimVerifier } = await loadFixture(deployVoting);
    })

});
  