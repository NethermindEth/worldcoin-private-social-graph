import hre from "hardhat";
import { expect, assert} from 'chai';

import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";

import { PrivateGraph } from "../src/core/private-graph";

import { poseidon2, poseidon3 } from "poseidon-lite";

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

    const poseidon4Lib = await hre.ethers.deployContract("PoseidonT4")
    const poseidon4LibAddr = await poseidon4Lib.getAddress()
    console.log("Deploy Poseidon 4:", poseidon4LibAddr)
            
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
                PoseidonT4: poseidon4LibAddr,
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
    it("Should register a candidate", async () => {
        const [deployer, candidate] = await hre.ethers.getSigners()
        const { voting, worldcoinVerifier, voteVerifier, claimVerifier } = await loadFixture(deployVoting);
        expect(await voting.connect(candidate).registerAsCandidate("Bob")).to.emit(voting, "UserRegistered")

    })

    it("Should register a worldid user", async () => {
        const social_graph = new PrivateGraph()
        const keys = social_graph.create_address()
        
        const worldIDRegister = social_graph.registerWorldID(keys.pk)
        const cm = worldIDRegister.tx_mint.cm
        const value = worldIDRegister.tx_mint.value
        const k = worldIDRegister.tx_mint.k
        const s = worldIDRegister.tx_mint.s
        const tx_mint = {
            commitment: cm,
            value: value,
            k: k,
            s: s
        }
        expect(poseidon3([k, 0 ,value])).to.be.equal(cm)
        
        const [deployer, worldID] = await hre.ethers.getSigners()
        const { voting, worldcoinVerifier, voteVerifier, claimVerifier } = await loadFixture(deployVoting);
        
        expect(await voting.connect(worldID).registerAsWorldIDHolder(
            worldID.address, 1234, 1234, [1234,1234,1234,1234,1234,1234,1234,1234], tx_mint)).to.emit(voting, "WorldIDRegistered")
    })
});
  