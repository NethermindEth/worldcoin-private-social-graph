import hre from "hardhat";
import { expect, assert} from 'chai';
import { Contract } from "ethers";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";

import { PrivateGraph } from "../src/core/private-graph";
import { Address, Register, Voting } from "../src/core/structs";
import { mint, verifyMint } from "../src/core/mint";
import { deployVoting } from "./Utils";
import { poseidon1 } from "poseidon-lite";

describe("Voting Contract Tests", function () {
    let voting: Contract, worldcoinVerifier: Contract, voteVerifier: Contract, claimVerifier: Contract;

    beforeEach(async () => {
        const deploymentResult = await loadFixture(deployVoting);
        voting = deploymentResult.voting;
        worldcoinVerifier = deploymentResult.worldcoinVerifier;
        voteVerifier = deploymentResult.voteVerifier;
        claimVerifier = deploymentResult.claimVerifier;
    });

    it("Should verify mint tx", async () => {
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

    it("Should not verify incorrect mint tx", async () => {
        const [deployer, candidate] = await hre.ethers.getSigners()
        const mint_tx = {
            commitment: 10,
            value: 10,
            k: 10,
            s: 10
    
        }
        expect(await voting.verifyMint(mint_tx)).to.be.false
    })

    it("Should register a candidate", async () => {
        const [deployer, candidate] = await hre.ethers.getSigners()
        expect(await voting.connect(candidate).registerAsCandidate("Bob")).to.emit(voting, "UserRegistered")
        const can = await voting.users(candidate.address)
        assert(can.name == "Bob", "Must have correct name")
        assert(can.v_in == 0, "Must have v_in = 0")
        assert(can.epochV == 0, "Must have epochV = 0")
    })

    it("Should not register a candidate twice", async () => {
        const [deployer, candidate] = await hre.ethers.getSigners()
        expect(await voting.connect(candidate).registerAsCandidate("Bob")).to.emit(voting, "UserRegistered");
        const can = await voting.users(candidate.address)
        await expect(voting.connect(candidate).registerAsCandidate("Bob")).to.revertedWith("msg.sender is already registered");
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
        
        const [deployer, worldID] = await hre.ethers.getSigners();
        expect(await voting.connect(worldID).registerAsWorldIDHolder(
            worldID.address, 1234, 1234, [1234,1234,1234,1234,1234,1234,1234,1234], tx_mint
        )).to.emit(voting, "WorldIDRegistered")

        const rootExists = await voting.voteMerkleRootExists(hre.ethers.toBeHex(social_graph.voting_tree.root))
        assert(rootExists, "Must have added root to tree")
    })

    it("Should not register a worldID user with incorrect mint", async () => {
        const [deployer, worldID] = await hre.ethers.getSigners();
        const tx_mint = {
            commitment: 10,
            value: 10,
            k: 10,
            s: 10
        }

        await expect( voting.connect(worldID).registerAsWorldIDHolder(
            worldID.address, 1234, 1234, [1234,1234,1234,1234,1234,1234,1234,1234], tx_mint
        )).to.be.revertedWith("Mint did not verify")
    })

    it("Should not register a worldID user with coin value not 100", async () => {
        const [deployer, worldID] = await hre.ethers.getSigners();
        
        const m = mint(10n, 0)
        const mint_tx = {
            commitment: m.tx_mint.cm,
            value: m.tx_mint.value,
            k: m.tx_mint.k,
            s: m.tx_mint.s
        }
        await expect(voting.connect(worldID).registerAsWorldIDHolder(
            worldID.address, 1234, 1234, [1234,1234,1234,1234,1234,1234,1234,1234], mint_tx
        )).to.be.revertedWith("Coin minted with incorrect value != 100")
    })

    it("Should recommend a candidate", async () => {   
        const social_graph = new PrivateGraph()
        const [candidate, worldID] = await hre.ethers.getSigners();
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
            proof: hre.ethers.hexlify(voted.tx_pour.proof.proof),
            // sig: voted.tx_pour.signature,
            sig: hre.ethers.encodeBytes32String("B"),
            publicInputs: voted.tx_pour.proof.publicInputs
        }

        expect(await voting.connect(worldID).recommendCandidate (
            tx_pour, weight, candidate.address
        )).to.emit(voting, "CandidateRecommended")
    })

    it("Should not verify a double pour", async function () {
        const social_graph = new PrivateGraph()
        const [candidate, worldID] = await hre.ethers.getSigners();
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
            proof: hre.ethers.hexlify(voted.tx_pour.proof.proof),
            // sig: voted.tx_pour.signature,
            sig: hre.ethers.encodeBytes32String("B"),
            publicInputs: voted.tx_pour.proof.publicInputs
        }

        expect(await voting.connect(worldID).recommendCandidate (
            tx_pour, weight, candidate.address
        )).to.emit(voting, "CandidateRecommended")

        expect(await voting.verifyPour(tx_pour, true)).to.be.false
    })

    it("Should not verify a vote pour when its a claim", async function () {
        const social_graph = new PrivateGraph()
        const [candidate, worldID] = await hre.ethers.getSigners();
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
            proof: hre.ethers.hexlify(voted.tx_pour.proof.proof),
            // sig: voted.tx_pour.signature,
            sig: hre.ethers.encodeBytes32String("B"),
            publicInputs: voted.tx_pour.proof.publicInputs
        }

        await expect(voting.verifyPour(tx_pour, false)).to.be.reverted
    })

    it("Should not recommend a candidate that is not on-chain", async () => {   
        const social_graph = new PrivateGraph()
        const [candidate, worldID] = await hre.ethers.getSigners();
        const userID = social_graph.registerCandidate("Jim", 1)

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
            proof: hre.ethers.hexlify(voted.tx_pour.proof.proof),
            // sig: voted.tx_pour.signature,
            sig: hre.ethers.encodeBytes32String("B"),
            publicInputs: voted.tx_pour.proof.publicInputs
        }

        await expect(voting.connect(worldID).recommendCandidate (
            tx_pour, weight, candidate.address
        )).to.be.revertedWith("User voted for not a candidate")
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
            proof: hre.ethers.hexlify(voted.tx_pour.proof.proof),
            // sig: voted.tx_pour.signature,
            sig: hre.ethers.encodeBytes32String("B"),
            publicInputs: voted.tx_pour.proof.publicInputs
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
    })

    it("Should update status to verified", async () => {
        const social_graph = new PrivateGraph()
        
        const [candidate, worldID1, worldID2, worldID3, worldID4, worldID5, worldID6, worldID7] = await hre.ethers.getSigners();
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
                proof: hre.ethers.hexlify(voted.tx_pour.proof.proof),
                // sig: voted.tx_pour.signature,
                sig: hre.ethers.encodeBytes32String("B"),
                publicInputs: voted.tx_pour.proof.publicInputs
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

    it("Should not update status to verified if under threshold on-chain", async () => {
        const social_graph = new PrivateGraph()
        
        const [candidate] = await hre.ethers.getSigners();
        
        await expect(voting.connect(candidate).registerAsCandidate("Jim"))
            .to.emit(voting, "UserRegistered");
        const userID = social_graph.registerCandidate("Jim", 0)
        
        let old_zcash_address: Address
        let worldIDRegister: Register
        let new_zcash_key_pair_1: Address
        let new_zcash_key_pair_2: Address
        let voted: Voting

        const weight = 100     

        for (var i = 0; i < 6; i++) {
            old_zcash_address = social_graph.create_address();
            worldIDRegister = social_graph.registerWorldID(old_zcash_address.pk)

            new_zcash_key_pair_1 = social_graph.create_address()
            new_zcash_key_pair_2 = social_graph.create_address()
            voted = await social_graph.vote(worldIDRegister.coin, old_zcash_address, new_zcash_key_pair_1.pk, new_zcash_key_pair_2.pk, userID, weight)
        }

        let update_status = social_graph.update_status_verified(userID, 10)
        const mint_tx = {
            commitment: update_status.tx_mint.cm,
            value: update_status.tx_mint.value,
            k: update_status.tx_mint.k,
            s: update_status.tx_mint.s
        }                
        await expect(voting.connect(candidate).updateStatusVerified(mint_tx))
            .to.revertedWith("v_in lower than threshold to update status");
    });


    it("Should allow the user to claim back voting power and get rewards", async () => {
        const social_graph = new PrivateGraph()
        const [candidate, worldID1, worldID2, worldID3, worldID4, worldID5, worldID6, worldID7] = await hre.ethers.getSigners();
        const worldIDs = [worldID1, worldID2, worldID3, worldID4, worldID5, worldID6, worldID7]

        await expect(voting.connect(candidate).registerAsCandidate("Jim"))
            .to.emit(voting, "UserRegistered");

        let curr_epoch = (await hre.ethers.provider.getBlockNumber() / 50064) + 1
        const userID = social_graph.registerCandidate("Jim", curr_epoch)

        const weight = 100

        let votes = []
        let addrs_2 = []

        for (var i = 0; i < 7; i++) {
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
                proof: hre.ethers.hexlify(voted.tx_pour.proof.proof),
                // sig: voted.tx_pour.signature,
                sig: hre.ethers.encodeBytes32String("B"),
                publicInputs: voted.tx_pour.proof.publicInputs
            }
    

            expect(await voting.connect(worldIDs[i]).recommendCandidate(
                tx_pour, weight, candidate.address
            )).to.emit(voting, "CandidateRecommended")

            votes.push(voted)
        }

        curr_epoch = (await hre.ethers.provider.getBlockNumber() / 50064) + 1
        let update_status = social_graph.update_status_verified(userID, curr_epoch)
        const mint_tx = {
            commitment: update_status.tx_mint.cm,
            value: update_status.tx_mint.value,
            k: update_status.tx_mint.k,
            s: update_status.tx_mint.s
        }                

        await expect(voting.connect(candidate).updateStatusVerified(mint_tx))
            .to.emit(voting, "CandidateVerified");

        for (var i = 0; i < 50065; i++) {
            await hre.ethers.provider.send("evm_mine")
        }
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
            proof: hre.ethers.hexlify(claim_rewards.pour_tx.proof.proof),
            // sig: voted.tx_pour.signature,
            sig: hre.ethers.encodeBytes32String("B"),
            publicInputs: claim_rewards.pour_tx.proof.publicInputs
        }

        expect(await voting.connect(worldID1).claimRewards(candidate.address, claim_tx)).to.emit(voting, "RewardClaimed")
    })

    it("Should recommend a candidate", async () => {   
        const social_graph = new PrivateGraph()
        const [candidate, worldID] = await hre.ethers.getSigners();
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
            proof: hre.ethers.hexlify(voted.tx_pour.proof.proof),
            // sig: voted.tx_pour.signature,
            sig: hre.ethers.encodeBytes32String("B"),
            publicInputs: voted.tx_pour.proof.publicInputs
        }

        await expect(voting.connect(worldID).claimRewards(
            candidate.address, tx_pour
        )).to.be.reverted
    })


});
  