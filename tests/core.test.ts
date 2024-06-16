import { poseidon2 } from "poseidon-lite";
import { mint, verifyMint } from "../src/core/mint";
import { PrivateGraph } from "../src/core/private-graph";
import { Tree } from "../src/core/tree";
import { pour, verifyPour } from "../src/core/pour";
import { Candidate } from "../src/core/structs";

describe("Core tests", () => {
    // Testing mint, pour functions
    describe("Sub function tests", () => {
        // setup private graph
        const social_graph = new PrivateGraph()
        const zcash_key_pair = social_graph.create_address()

        it("Should correctly mint a new coin and return a Mint transaction", () => {
            const m = mint(zcash_key_pair.pk, 100)
            expect(verifyMint(m.tx_mint.cm, m.coin.value, m.tx_mint.k)).toBe(true)
        })

        it("Should correctly pour an old coin into 2 new ones", async function () {
            
            // mint a new coin and construct the tx
            const m = mint(zcash_key_pair.pk, 100)

            // add coin cm to tree
            const tree = new Tree
            const pos = tree.addMember(m.tx_mint.cm)
            const path = tree.generateMerkleProof(pos)

            // create new zcash addresses
            const new_zcash_key_pair_1 = social_graph.create_address()
            const new_zcash_key_pair_2 = social_graph.create_address()
            
            // call pour function (through vote)
            const p = await pour(
                tree.root,
                m.coin,
                zcash_key_pair.sk,
                path,
                50, // v_1 + v_2 = value in old coin
                50,
                new_zcash_key_pair_1.pk,
                new_zcash_key_pair_2.pk,
                50,
                "test",
                true
            )

            // Verify pour tx
            expect(await verifyPour(
                tree,
                p,
                social_graph.vote_nullifiers,
                zcash_key_pair.sk
            )).toBe(true)            
        })
    })

    // Testing private graph class
    describe("Private graph tests", () => {
        it("Should correctly create a zcash address key pair", () => {
            const social_graph = new PrivateGraph()
            const zcash_address = social_graph.create_address()

            expect(poseidon2([zcash_address.sk, 0])).toBe(zcash_address.pk)
        })

        it("Should allow worldID users to sign up", () => {
            const social_graph = new PrivateGraph()
            const zcash_address = social_graph.create_address()

            const register = social_graph.registerWorldID(zcash_address.pk)

            expect(verifyMint(register.tx_mint.cm, 100, register.tx_mint.k)).toBe(true)
            expect(social_graph.voting_tree.indexOf(register.tx_mint.cm)).toBe(register.pos)
        })

        it("Should allow candidates to register", () => {
            const social_graph = new PrivateGraph()

            const userID = social_graph.registerCandidate("Jim", 10)

            const new_candidate = social_graph.candidates[userID]

            expect(new_candidate.cmp(new Candidate(userID+1, "Jim", 10))).toBe(true)
        })

        it("Should allow users with coins to vote", async function () {
            
            const social_graph = new PrivateGraph()
            const userID = social_graph.registerCandidate("Jim", 1)

            const old_zcash_address = social_graph.create_address()

            const register = social_graph.registerWorldID(old_zcash_address.pk)

            const new_zcash_key_pair_1 = social_graph.create_address()
            const new_zcash_key_pair_2 = social_graph.create_address()

            const weight = 50

            const voted = await social_graph.vote(register.coin, old_zcash_address, new_zcash_key_pair_1.pk, new_zcash_key_pair_2.pk, userID, weight)

            expect(social_graph.voting_tree.indexOf(voted.tx_pour.new_cm_1)).toBe(voted.voting_pos)
            expect(social_graph.vote_nullifiers[social_graph.vote_nullifiers.length-1]).toBe(voted.tx_pour.sn_old)
            expect(social_graph.candidates[userID].v_in).toBe(weight)
            expect(social_graph.candidates[userID].votes).toBe(1)
            expect(social_graph.candidates[userID].candidateTree.indexOf(voted.tx_pour.new_cm_2)).toBe(voted.userID_pos)
        })
        
        it("Should allow a candidate to become verified if enough users vote for it", async function () {
            
            const social_graph = new PrivateGraph()
            // user to become verified
            const userID = social_graph.registerCandidate("Jim", 10)

            const weight = 100

            for (var i = 0; i < 6; i++) {
                let old_zcash_address = social_graph.create_address()

                let register = social_graph.registerWorldID(old_zcash_address.pk)

                let new_zcash_key_pair_1 = social_graph.create_address()
                let new_zcash_key_pair_2 = social_graph.create_address()

                let voted = await social_graph.vote(register.coin, old_zcash_address, new_zcash_key_pair_1.pk, new_zcash_key_pair_2.pk, userID, weight)
                
                expect(social_graph.voting_tree.indexOf(voted.tx_pour.new_cm_1)).toBe(voted.voting_pos)
                expect(social_graph.vote_nullifiers[social_graph.vote_nullifiers.length-1]).toBe(voted.tx_pour.sn_old)
                expect(social_graph.candidates[userID].v_in).toBe(weight*(i+1))
                expect(social_graph.candidates[userID].votes).toBe(i+1)
                expect(social_graph.candidates[userID].candidateTree.indexOf(voted.tx_pour.new_cm_2)).toBe(voted.userID_pos)
            }

            const reg = social_graph.update_status_verified(userID, 10)

            expect(verifyMint(reg.tx_mint.cm, reg.coin.value, reg.tx_mint.k)).toBe(true)
            expect(social_graph.voting_tree.indexOf(reg.tx_mint.cm)).toBe(reg.pos)

            expect(social_graph.candidates[userID].status).toBe("Verified")
        })

        it("Should allow users to claim back their voting power and their rewards", async function () {
            
            const social_graph = new PrivateGraph()
            // user to become verified
            const userID = social_graph.registerCandidate("Jim", 10)

            const weight = 100

            let votes = []
            let addrs_2 = []

            for (var i = 0; i < 6; i++) {
                let old_zcash_address = social_graph.create_address()

                let register = social_graph.registerWorldID(old_zcash_address.pk)

                let new_zcash_key_pair_1 = social_graph.create_address()
                let new_zcash_key_pair_2 = social_graph.create_address()

                addrs_2.push(new_zcash_key_pair_2)

                let voted = await social_graph.vote(register.coin, old_zcash_address, new_zcash_key_pair_1.pk, new_zcash_key_pair_2.pk, userID, weight)
                
                votes.push(voted)
                
                expect(social_graph.voting_tree.indexOf(voted.tx_pour.new_cm_1)).toBe(voted.voting_pos)
                expect(social_graph.vote_nullifiers[social_graph.vote_nullifiers.length-1]).toBe(voted.tx_pour.sn_old)
                expect(social_graph.candidates[userID].v_in).toBe(weight*(i+1))
                expect(social_graph.candidates[userID].votes).toBe(i+1)
                expect(social_graph.candidates[userID].candidateTree.indexOf(voted.tx_pour.new_cm_2)).toBe(voted.userID_pos)
            }

            const reg = social_graph.update_status_verified(userID, 10)

            expect(verifyMint(reg.tx_mint.cm, reg.coin.value, reg.tx_mint.k)).toBe(true)
            expect(social_graph.voting_tree.indexOf(reg.tx_mint.cm)).toBe(reg.pos)

            expect(social_graph.candidates[userID].status).toBe("Verified")

            const old_coin = votes[0].coin_2
            const old_address = addrs_2[0]

            const new_zcash_key_pair_1 = social_graph.create_address()
            const new_zcash_key_pair_2 = social_graph.create_address()

            const claim_rewards = await social_graph.claim(old_coin, old_address, new_zcash_key_pair_1.pk, new_zcash_key_pair_2.pk, userID, 10)

            expect(social_graph.voting_tree.indexOf(claim_rewards.coin_1.cm)).toBe(claim_rewards.voting_pos)
            expect(social_graph.rewards_tree.indexOf(claim_rewards.coin_2.cm)).toBe(claim_rewards.reward_pos)
            expect(claim_rewards.coin_1.value).toBe(old_coin.value * social_graph.alpha)
            expect(claim_rewards.coin_2.value).toBe(
                Math.floor(old_coin.value * social_graph.C / social_graph.rewards[social_graph.candidates[userID].epochV].sum)
            )
        })

        it("Should penalise a userID by removing all votes", async function () {
            const social_graph = new PrivateGraph()
            const userID = social_graph.registerCandidate("Jim", 10)

            // check userID has no votes
            expect(social_graph.candidates[userID].v_in).toBe(0)
            expect(social_graph.candidates[userID].votes).toBe(0)
            expect(social_graph.candidates[userID].get_numLeaves()).toBe(0)

            // vote for userID
            const old_zcash_address = social_graph.create_address()

            const register = social_graph.registerWorldID(old_zcash_address.pk)

            const new_zcash_key_pair_1 = social_graph.create_address()
            const new_zcash_key_pair_2 = social_graph.create_address()

            const weight = 50

            const voted = await social_graph.vote(register.coin, old_zcash_address, new_zcash_key_pair_1.pk, new_zcash_key_pair_2.pk, userID, weight)

            // check userID has 1 vote
            expect(social_graph.voting_tree.indexOf(voted.tx_pour.new_cm_1)).toBe(voted.voting_pos)
            expect(social_graph.vote_nullifiers[social_graph.vote_nullifiers.length-1]).toBe(voted.tx_pour.sn_old)
            expect(social_graph.candidates[userID].v_in).toBe(weight)
            expect(social_graph.candidates[userID].votes).toBe(1)
            expect(social_graph.candidates[userID].candidateTree.indexOf(voted.tx_pour.new_cm_2)).toBe(voted.userID_pos)

            social_graph.penalise(userID)

            // check userID has no votes
            expect(social_graph.candidates[userID].v_in).toBe(0)
            expect(social_graph.candidates[userID].votes).toBe(0)
            expect(social_graph.candidates[userID].get_numLeaves()).toBe(0)
        })
    })
})