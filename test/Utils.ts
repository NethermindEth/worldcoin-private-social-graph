import hre from "hardhat";

export const deployVoting = async () => {
    const poseidon3Lib = await hre.ethers.deployContract("poseidon-solidity/PoseidonT3.sol:PoseidonT3")
    const poseidon3LibAddr = await poseidon3Lib.getAddress()

    const binaryIMTFactory = await hre.ethers.getContractFactory("BinaryIMT",
        {
            libraries: {
                PoseidonT3: poseidon3LibAddr
            }
        }
    )
    const binaryIMT= await binaryIMTFactory.deploy()
    const binaryIMTLibAddr = await binaryIMT.getAddress()
    
    const poseidon2Lib = await hre.ethers.deployContract("PoseidonT2")
    const poseidon2LibAddr = await poseidon2Lib.getAddress()

    const poseidon4Lib = await hre.ethers.deployContract("PoseidonT4")
    const poseidon4LibAddr = await poseidon4Lib.getAddress()
            
    const voteVerifier = await hre.ethers.deployContract("contracts/src/vote_plonk_vk.sol:UltraVerifier")
    const voteVerifierAddr = await voteVerifier.getAddress()

    const claimVerifier = await hre.ethers.deployContract("contracts/src/claim_plonk_vk.sol:UltraVerifier")
    const claimVerifierAddr = await claimVerifier.getAddress()
    
    const worldcoinVerifier = await hre.ethers.deployContract("WorldcoinVerifierMock")
    const worldcoinVerifierAddr = await worldcoinVerifier.getAddress()

    const votingFactory = await hre.ethers.getContractFactory("WorldcoinSocialGraphVoting", 
        {
            libraries: {
                PoseidonT4: poseidon4LibAddr,
                BinaryIMT: binaryIMTLibAddr
            }
        }
    )

    const voting = await votingFactory.deploy(worldcoinVerifierAddr, voteVerifierAddr, claimVerifierAddr)
  
    return { voting, worldcoinVerifier, voteVerifier, claimVerifier };
};