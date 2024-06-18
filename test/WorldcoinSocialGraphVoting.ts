import hre from "hardhat";
import { ethers } from "ethers";
import { expect, assert} from 'chai';
import { IMTMerkleProof } from "@zk-kit/imt"
import { poseidon1, poseidon2, poseidon3, poseidon4 } from "poseidon-lite";

import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";

import { PrivateGraph } from "../src/core/private-graph";
import { Address, Coin, Pour, Register, Voting } from "../src/core/structs";
import { mint, verifyMint } from "../src/core/mint";
import { pour } from "../src/core/pour";

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
    it("Should verifiy mint tx", async () => {
        const [deployer, candidate] = await hre.ethers.getSigners()
        const { voting, worldcoinVerifier, voteVerifier, claimVerifier } = await loadFixture(deployVoting);

        const m = mint(10n, 100)
        expect(verifyMint(m.coin.cm, m.tx_mint.value, m.tx_mint.k)).to.be.true
        const mint_tx = {
            commitment: m.tx_mint.cm,
            value: m.tx_mint.value,
            k: m.tx_mint.k,
            s: m.tx_mint.s
    
        }
        expect(await voting.verifyMint(mint_tx)).to.be.true
    })
    
    it("Should register a candidate", async () => {
        const [deployer, candidate] = await hre.ethers.getSigners()
        const { voting, worldcoinVerifier, voteVerifier, claimVerifier } = await loadFixture(deployVoting);
        expect(await voting.connect(candidate).registerAsCandidate("Bob")).to.emit(voting, "UserRegistered")
        const can = await voting.users(candidate.address)
        assert(can.name == "Bob", "Must have correct name")
        assert(can.v_in == 0, "Must have v_in = 0")
        assert(can.epochV == 0, "Must have epochV = 0")
    })

    it("Should not register a candidate twice", async () => {
        const [deployer, candidate] = await hre.ethers.getSigners()
        const { voting, worldcoinVerifier, voteVerifier, claimVerifier } = await loadFixture(deployVoting);
        expect(voting.connect(candidate).registerAsCandidate("Bob")).to.emit(voting, "UserRegistered");
        expect(voting.connect(candidate).registerAsCandidate("Bob")).to.be.reverted;
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
        
        const [deployer, worldID] = await hre.ethers.getSigners()
        const { voting, worldcoinVerifier, voteVerifier, claimVerifier } = await loadFixture(deployVoting);
        
        expect(await voting.connect(worldID).registerAsWorldIDHolder(
            worldID.address, 1234, 1234, [1234,1234,1234,1234,1234,1234,1234,1234], tx_mint
        )).to.emit(voting, "WorldIDRegistered")

        const rootExists = await voting.voteMerkleRootExists(hre.ethers.toBeHex(social_graph.voting_tree.root))
        assert(rootExists, "Must have added root to tree")
    })

    it("Should penalise a malicious voter", async () => {
        const social_graph = new PrivateGraph();
        
        const old_zcash_address = social_graph.create_address()

        const worldIDRegister = social_graph.registerWorldID(old_zcash_address.pk)
        
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

        const [worldID, candidate] = await hre.ethers.getSigners();
        const { voting, worldcoinVerifier, voteVerifier, claimVerifier } = await loadFixture(deployVoting);

        // Register candidate
        const userID = social_graph.registerCandidate("Jim")
        await expect(voting.connect(candidate).registerAsCandidate("Jim"))
            .to.emit(voting, "UserRegistered");

        // register worldID
        expect(await voting.connect(worldID).registerAsWorldIDHolder(
            worldID.address, 1234, 1234, [1234,1234,1234,1234,1234,1234,1234,1234], tx_mint
        )).to.emit(voting, "WorldIDRegistered")

        // vote for user
        const new_zcash_key_pair_1 = social_graph.create_address()
        const new_zcash_key_pair_2 = social_graph.create_address()

        const weight = 50

        const voted = await social_graph.vote(worldIDRegister.coin, old_zcash_address, new_zcash_key_pair_1.pk, new_zcash_key_pair_2.pk, userID, weight)
        const tx_pour = {
            rt: voted.tx_pour.rt,
            sn_old: voted.tx_pour.sn_old,
            cm_1: voted.tx_pour.new_cm_1,
            cm_2: voted.tx_pour.new_cm_2,
            v_pub: voted.tx_pour.v_pub,
            info: voted.tx_pour.info,
            // pk_sig: voted.tx_pour.key,
            pk_sig: hre.ethers.encodeBytes32String("A"),
            h: voted.tx_pour.h,
            proof: hre.ethers.toUtf8Bytes(voted.tx_pour.proof.toString()),
            // sig: voted.tx_pour.signature,
            sig: hre.ethers.encodeBytes32String("B"),
        }

        expect(await voting.connect(worldID).recommendCandidate (
            tx_pour, weight, candidate.address
        )).to.emit(voting, "CandidateRecommended")


        const user = await voting.users(candidate.address)
        expect(user.v_in).to.be.equal(50)
        expect(user.numberOfVotes).to.equal(1);
        
        // Penalize the candidate
        await expect(voting.connect(candidate).penalise())
            .to.emit(voting, "Penalised")

        const candidateTree = await voting.candidateTrees(candidate.address);
        const userAfterPenalise = await voting.users(candidate.address);

        expect(userAfterPenalise.v_in).to.equal(0);
        expect(userAfterPenalise.numberOfVotes).to.equal(0);
    });

    it("Should recommend a candidate", async () => {   
        const social_graph = new PrivateGraph()
        const [candidate, worldID] = await hre.ethers.getSigners()
        const { voting, worldcoinVerifier, voteVerifier, claimVerifier } = await loadFixture(deployVoting);

        const userID = social_graph.registerCandidate("Jim", 1)
        expect(await voting.connect(candidate).registerAsCandidate("Jim")).to.emit(voting, "UserRegistered")

        const old_zcash_address = social_graph.create_address()

        const worldIDRegister = social_graph.registerWorldID(old_zcash_address.pk)

        const tx_mint = {
            commitment: worldIDRegister.tx_mint.cm,
            value: worldIDRegister.tx_mint.value,
            k: worldIDRegister.tx_mint.k,
            s: worldIDRegister.tx_mint.s
        }

        expect(await voting.connect(worldID).registerAsWorldIDHolder(
            worldID.address, 1234, 1234, [1234,1234,1234,1234,1234,1234,1234,1234], tx_mint
        )).to.emit(voting, "WorldIDRegistered")

        const new_zcash_key_pair_1 = social_graph.create_address()
        const new_zcash_key_pair_2 = social_graph.create_address()

        const weight = 50

        const voted = await social_graph.vote(worldIDRegister.coin, old_zcash_address, new_zcash_key_pair_1.pk, new_zcash_key_pair_2.pk, userID, weight)
        const tx_pour = {
            rt: voted.tx_pour.rt,
            sn_old: voted.tx_pour.sn_old,
            cm_1: voted.tx_pour.new_cm_1,
            cm_2: voted.tx_pour.new_cm_2,
            v_pub: voted.tx_pour.v_pub,
            info: voted.tx_pour.info,
            // pk_sig: voted.tx_pour.key,
            pk_sig: hre.ethers.encodeBytes32String("A"),
            h: voted.tx_pour.h,
            proof: hre.ethers.toUtf8Bytes(voted.tx_pour.proof.toString()),
            // sig: voted.tx_pour.signature,
            sig: hre.ethers.encodeBytes32String("B"),
        }

        expect(await voting.connect(worldID).recommendCandidate (
            tx_pour, weight, candidate.address
        )).to.emit(voting, "CandidateRecommended")
    })

    it("Should update status of to verified", async () => {
        const social_graph = new PrivateGraph()
        
        const [candidate, worldID1, worldID2, worldID3, worldID4, worldID5, worldID6, worldID7] = await hre.ethers.getSigners()
        const { voting, worldcoinVerifier, voteVerifier, claimVerifier } = await loadFixture(deployVoting);
        
        const worldIDs = [worldID1, worldID2, worldID3, worldID4, worldID5, worldID6, worldID7]
        
        await expect(voting.connect(candidate).registerAsCandidate("Jim"))
            .to.emit(voting, "UserRegistered");
        const userID = social_graph.registerCandidate("Jim", 0)
        
        let old_zcash_address: Address
        let worldIDRegister: Register
        let new_zcash_key_pair_1: Address
        let new_zcash_key_pair_2: Address
        let voted: Voting

        const weight = 100     

        for (var i = 0; i < 7; i++) {
            old_zcash_address = social_graph.create_address();
            worldIDRegister = social_graph.registerWorldID(old_zcash_address.pk)
            let tx_mint = {
                commitment: worldIDRegister.tx_mint.cm,
                value: worldIDRegister.tx_mint.value,
                k: worldIDRegister.tx_mint.k,
                s: worldIDRegister.tx_mint.s        
            }
            expect(await voting.connect(worldIDs[i]).registerAsWorldIDHolder(
                worldIDs[i].address, 1234, 1234, [1234,1234,1234,1234,1234,1234,1234,1234], tx_mint
            )).to.emit(voting, "WorldIDRegistered");

            new_zcash_key_pair_1 = social_graph.create_address()
            new_zcash_key_pair_2 = social_graph.create_address()
            voted = await social_graph.vote(worldIDRegister.coin, old_zcash_address, new_zcash_key_pair_1.pk, new_zcash_key_pair_2.pk, userID, weight)
            let tx_pour = {
                rt: voted.tx_pour.rt,
                sn_old: voted.tx_pour.sn_old,
                cm_1: voted.tx_pour.new_cm_1,
                cm_2: voted.tx_pour.new_cm_2,
                v_pub: voted.tx_pour.v_pub,
                info: voted.tx_pour.info,
                // pk_sig: voted.tx_pour.key,
                pk_sig: hre.ethers.encodeBytes32String("A"),
                h: voted.tx_pour.h,
                proof: hre.ethers.toUtf8Bytes(voted.tx_pour.proof.toString()),
                // sig: voted.tx_pour.signature,
                sig: hre.ethers.encodeBytes32String("B"),
            }
            
            expect(await voting.connect(worldIDs[i]).recommendCandidate (
                tx_pour, weight, candidate.address
            )).to.emit(voting, "CandidateRecommended")
        }

        let update_status = social_graph.update_status_verified(userID, 10)
        const mint_tx = {
            commitment: update_status.tx_mint.cm,
            value: update_status.tx_mint.value,
            k: update_status.tx_mint.k,
            s: update_status.tx_mint.s
        }                
        await expect(voting.connect(candidate).updateStatusVerified(mint_tx))
            .to.emit(voting, "CandidateVerified");
    });

    it("Should allow the user to claim back voting power and get rewards", async () => {
        const social_graph = new PrivateGraph()
        const [candidate, worldID1, worldID2, worldID3, worldID4, worldID5, worldID6, worldID7] = await hre.ethers.getSigners()
        const { voting, worldcoinVerifier, voteVerifier, claimVerifier } = await loadFixture(deployVoting);
        
        const worldIDs = [worldID1, worldID2, worldID3, worldID4, worldID5, worldID6, worldID7]

        await expect(voting.connect(candidate).registerAsCandidate("Jim"))
            .to.emit(voting, "UserRegistered");

        let curr_epoch = (await hre.ethers.provider.getBlockNumber() / 50064) + 1
        console.log(curr_epoch)
        const userID = social_graph.registerCandidate("Jim", curr_epoch)

        const weight = 100

        let votes = []
        let addrs_2 = []

        for (var i = 0; i < 6; i++) {
            let old_zcash_address = social_graph.create_address()

            let register = social_graph.registerWorldID(old_zcash_address.pk)
            let tx_mint = {
                commitment: register.tx_mint.cm,
                value: register.tx_mint.value,
                k: register.tx_mint.k,
                s: register.tx_mint.s        
            }
            expect(await voting.connect(worldIDs[i]).registerAsWorldIDHolder(
                worldIDs[i].address, 1234, 1234, [1234,1234,1234,1234,1234,1234,1234,1234], tx_mint
            )).to.emit(voting, "WorldIDRegistered");


            let new_zcash_key_pair_1 = social_graph.create_address()
            let new_zcash_key_pair_2 = social_graph.create_address()

            addrs_2.push(new_zcash_key_pair_2)

            let voted = await social_graph.vote(register.coin, old_zcash_address, new_zcash_key_pair_1.pk, new_zcash_key_pair_2.pk, userID, weight)

            let tx_pour = {
                rt: voted.tx_pour.rt,
                sn_old: voted.tx_pour.sn_old,
                cm_1: voted.tx_pour.new_cm_1,
                cm_2: voted.tx_pour.new_cm_2,
                v_pub: voted.tx_pour.v_pub,
                info: voted.tx_pour.info,
                // pk_sig: voted.tx_pour.key,
                pk_sig: hre.ethers.encodeBytes32String("A"),
                h: voted.tx_pour.h,
                proof: hre.ethers.toUtf8Bytes(voted.tx_pour.proof.toString()),
                // sig: voted.tx_pour.signature,
                sig: hre.ethers.encodeBytes32String("B"),
            }

            expect(await voting.connect(worldIDs[i]).recommendCandidate (
                tx_pour, weight, candidate.address
            )).to.emit(voting, "CandidateRecommended")

            
            votes.push(voted)
        }

        curr_epoch = (await hre.ethers.provider.getBlockNumber() / 50064) + 1
        console.log(curr_epoch)
        let update_status = social_graph.update_status_verified(userID, curr_epoch)
        const mint_tx = {
            commitment: update_status.tx_mint.cm,
            value: update_status.tx_mint.value,
            k: update_status.tx_mint.k,
            s: update_status.tx_mint.s
        }                

        await expect(voting.connect(candidate).updateStatusVerified(mint_tx))
            .to.emit(voting, "CandidateVerified");

        const old_coin = votes[0].coin_2
        const old_address = addrs_2[0]

        const new_zcash_key_pair_1 = social_graph.create_address()
        const new_zcash_key_pair_2 = social_graph.create_address()

        const claim_rewards = await social_graph.claim(old_coin, old_address, new_zcash_key_pair_1.pk, new_zcash_key_pair_2.pk, userID, curr_epoch)
        const claim_tx = {
            rt: claim_rewards.pour_tx.rt,
            sn_old: claim_rewards.pour_tx.sn_old,
            cm_1: claim_rewards.pour_tx.new_cm_1,
            cm_2: claim_rewards.pour_tx.new_cm_2,
            v_pub: claim_rewards.pour_tx.v_pub,
            info: claim_rewards.pour_tx.info,
            // pk_sig: voted.tx_pour.key,
            pk_sig: hre.ethers.encodeBytes32String("A"),
            h: claim_rewards.pour_tx.h,
            proof: hre.ethers.toUtf8Bytes(claim_rewards.pour_tx.proof.toString()),
            // sig: voted.tx_pour.signature,
            sig: hre.ethers.encodeBytes32String("B"),
        }

        expect(await voting.connect(worldID1).claimRewards(candidate.address, claim_tx)).to.emit(voting, "RewardClaimed")
    })

    it.only("Should verify signature created from pour function", async () => {
        const [deployer, candidate] = await hre.ethers.getSigners();
        const { voting, worldcoinVerifier, voteVerifier, claimVerifier } = await loadFixture(deployVoting);
    
        // Create sample data for the pour function
        const rt = BigInt(123456);
        const old_coin: Coin = {
            public_key: BigInt(987654),
            value: 100,
            seed: BigInt(111222),
            r: BigInt(333444),
            s: BigInt(555666),
            cm: BigInt(777888)
        };
        const old_sk = BigInt(999000);
        const path: IMTMerkleProof = {
            pathIndices: Array(32).fill(0),
            siblings: Array(32).fill(BigInt(0))
        };
        const v_1 = 60;
        const v_2 = 40;
        const new_pk_address_1 = BigInt(123456789);
        const new_pk_address_2 = BigInt(987654321);
        const v_pub = 0;
        const info = "Sample info";
        const is_called_by_vote = false;
    
        // Call the pour function
        const pourResult = await pour(
            rt,
            old_coin,
            old_sk,
            path,
            v_1,
            v_2,
            new_pk_address_1,
            new_pk_address_2,
            v_pub,
            info,
            is_called_by_vote
        );
        // Perform assertions on the pour result
        // expect(pourResult.coin_1.value).to.equal(v_1);
        // expect(pourResult.coin_2.value).to.equal(v_2);
        // expect(pourResult.coin_1.public_key).to.equal(new_pk_address_1);
        // expect(pourResult.coin_2.public_key).to.equal(new_pk_address_2);
        
        // Extract the necessary fields from the pour result
        const txPour = {
            rt: pourResult.tx_pour.rt,
            sn_old: pourResult.tx_pour.sn_old,
            cm_1: pourResult.coin_1.cm,
            cm_2: pourResult.coin_2.cm,
            v_pub: pourResult.tx_pour.v_pub,
            info: pourResult.tx_pour.info,
            pk_sig: pourResult.tx_pour.key.get_pub_key(),
            pubkey: pourResult.tx_pour.pubkey,
            h: pourResult.tx_pour.h,
            proof: pourResult.tx_pour.proof,
            sig: pourResult.tx_pour.signatureString
        };
        const h_sig = poseidon1([pourResult.tx_pour.key.get_pub()]);
        expect(await voting.connect(candidate).verifySignature(txPour, h_sig)).to.eq(true);
    });
});
