import { Tree } from "../src/core/tree";
import { verify_merkle_proof, claim_pour, vote_pour } from "../codegen";
import { PrivateGraph } from "../src/core/private-graph";
import { poseidon1 } from "poseidon-lite";

describe("Integration Tests", () => {
    it("Should verify a merkle proof", async () => {
        const tree = new Tree()
        const idx = tree.addMember("101")
        const idx_proof = tree.generateMerkleProof(idx)

        const leaf = idx_proof.leaf.toString()
        const siblings = idx_proof.siblings.map(i => i.toString())
        const pathIndices = idx_proof.pathIndices.map(i => i.toString())
        const root = idx_proof.root.toString()

        const pass = await verify_merkle_proof(leaf, siblings, pathIndices, root)

        expect(pass).toBe(true)
    }, 1920 * 1000)

    it("Should verify a valid vote transaction", async () => {
        const social_graph = new PrivateGraph()
        const userID = social_graph.registerCandidate("Jim", 1)

        const old_zcash_address = social_graph.create_address()

        const register = social_graph.registerWorldID(old_zcash_address.pk)

        const new_zcash_key_pair_1 = social_graph.create_address()
        const new_zcash_key_pair_2 = social_graph.create_address()

        const weight = 50

        const voted = await social_graph.vote(register.coin, old_zcash_address, new_zcash_key_pair_1.pk, new_zcash_key_pair_2.pk, userID, weight)

        const old_coin = register.coin

        const root = voted.tx_pour.rt

        const old_sn = voted.tx_pour.sn_old

        const new_cm_1 = voted.coin_1.cm

        const new_cm_2 = voted.coin_2.cm

        const v_pub = voted.tx_pour.v_pub

        const h_sig = poseidon1([voted.tx_pour.key.get_pub()])

        const h = voted.tx_pour.h

        const candidate_tree = social_graph.candidates[userID].candidateTree
        const idx_proof = candidate_tree.generateMerkleProof(candidate_tree.indexOf(voted.coin_2.cm))
        const siblings = idx_proof.siblings
        const pathIndices = idx_proof.pathIndices

        const old_coin_pk_address = old_coin.public_key

        const old_coin_value = old_coin.value

        const old_coin_nullifier_seed = old_coin.seed

        const old_coin_r = old_coin.r

        const old_coin_s = old_coin.s

        const old_coin_commitment = old_coin.cm

        const old_sk = old_zcash_address.sk

        const new_coin_1_pk_address = voted.coin_1.public_key

        const new_coin_1_value = voted.coin_1.value

        const new_coin_1_nullifier_seed = voted.coin_1.seed

        const new_coin_1_r = voted.coin_1.r

        const new_coin_1_s = voted.coin_1.s

        const new_coin_1_commitment = voted.coin_1.cm

        const new_coin_2_pk_address = voted.coin_2.public_key

        const new_coin_2_value = voted.coin_2.value

        const new_coin_2_nullifier_seed = voted.coin_2.seed

        const new_coin_2_r = voted.coin_2.r

        const new_coin_2_s = voted.coin_2.s

        const new_coin_2_commitment = voted.coin_2.cm

        expect(await vote_pour(root.toString(), old_sn.toString(), new_cm_1.toString(), new_cm_2.toString(), v_pub[0].toString(), h_sig.toString(), h.toString(), siblings.map(i => i.toString()), pathIndices.map(i => i.toString()), old_coin_pk_address.toString(), old_coin_value.toString(), old_coin_nullifier_seed.toString(), old_coin_r.toString(), old_coin_s.toString(), old_coin_commitment.toString(), old_sk.toString(), new_coin_1_pk_address.toString(), new_coin_1_value.toString(), new_coin_1_nullifier_seed.toString(), new_coin_1_r.toString(), new_coin_1_s.toString(), new_coin_1_commitment.toString(), new_coin_2_pk_address.toString(), new_coin_2_value.toString(), new_coin_2_nullifier_seed.toString(), new_coin_2_r.toString(), new_coin_2_s.toString(), new_coin_2_commitment.toString())).toBe(true)
    }, 960 * 1000)

    it("Should verify a valid claim pour transaction", async () => {
        const social_graph = new PrivateGraph()
        // user to become verified
        const userID = social_graph.registerCandidate("Jim", 10)

        // weight every user will vote with
        const weight = 100

        // results of each worldID vote
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
        }

        const reg = social_graph.update_status_verified(userID, 10)

        const old_coin = votes[0].coin_2
        const old_address = addrs_2[0]

        const new_zcash_key_pair_1 = social_graph.create_address()
        const new_zcash_key_pair_2 = social_graph.create_address()

        const claim_rewards = await social_graph.claim(old_coin, old_address, new_zcash_key_pair_1.pk, new_zcash_key_pair_2.pk, userID, 10)
        
        const root = claim_rewards.pour_tx.rt

        const old_sn = claim_rewards.pour_tx.sn_old

        const new_cm_1 = claim_rewards.coin_1.cm

        const new_cm_2 = claim_rewards.coin_2.cm

        const v_pub = claim_rewards.pour_tx.v_pub

        const h_sig = poseidon1([claim_rewards.pour_tx.key.get_pub()])

        const h = claim_rewards.pour_tx.h

        const candidate_tree = social_graph.candidates[userID].candidateTree
        const idx_proof = candidate_tree.generateMerkleProof(candidate_tree.indexOf(old_coin.cm))
        const siblings = idx_proof.siblings
        const pathIndices = idx_proof.pathIndices

        const old_coin_pk_address = old_coin.public_key

        const old_coin_value = old_coin.value

        const old_coin_nullifier_seed = old_coin.seed

        const old_coin_r = old_coin.r

        const old_coin_s = old_coin.s

        const old_coin_commitment = old_coin.cm

        const old_sk = old_address.sk

        const new_coin_1_pk_address = claim_rewards.coin_1.public_key

        const new_coin_1_value = claim_rewards.coin_1.value

        const new_coin_1_nullifier_seed = claim_rewards.coin_1.seed

        const new_coin_1_r = claim_rewards.coin_1.r

        const new_coin_1_s = claim_rewards.coin_1.s

        const new_coin_1_commitment = claim_rewards.coin_1.cm

        const new_coin_2_pk_address = claim_rewards.coin_2.public_key

        const new_coin_2_value = claim_rewards.coin_2.value

        const new_coin_2_nullifier_seed = claim_rewards.coin_2.seed

        const new_coin_2_r = claim_rewards.coin_2.r

        const new_coin_2_s = claim_rewards.coin_2.s

        const new_coin_2_commitment = claim_rewards.coin_2.cm

        // console.log("\n root: ", root.toString(), "\n",
        //             "old_sn: ", old_sn.toString(), "\n",
        //             "new_cm_1: ", new_cm_1.toString(), "\n",
        //             "new_cm_2: ", new_cm_2.toString(), "\n",
        //             "v_pub: ", v_pub.map(i => i.toString()), "\n",
        //             "h_sig: ", h_sig.toString(), "\n",
        //             "h: ", h.toString(), "\n",
        //             "siblings: ", siblings.map(i => i.toString()), "\n",
        //             "path indices: ", pathIndices.map(i => i.toString()), "\n",
        //             "old coin pk address: ", old_coin_pk_address.toString(), "\n",
        //             "old coin value: ", old_coin_value.toString(), "\n",
        //             "old coin nullifier: ", old_coin_nullifier_seed.toString(), "\n",
        //             "old coin r: ", old_coin_r.toString(), "\n",
        //             "old coin s: ", old_coin_s.toString(), "\n",
        //             "old coin commitment: ", old_coin_commitment.toString(), "\n",
        //             "old sk: ", old_sk.toString(), "\n",
        //             "new coin 1 pk address: ", new_coin_1_pk_address.toString(), "\n",
        //             "new coin 1 value: ", new_coin_1_value.toString(), "\n",
        //             "new coin 1 nullifier: ", new_coin_1_nullifier_seed.toString(), "\n",
        //             "new coin 1 r: ", new_coin_1_r.toString(), "\n",
        //             "new coin 1 s: ", new_coin_1_s.toString(), "\n",
        //             "new coin 1 commitment: ", new_coin_1_commitment.toString(), "\n",
        //             "new coin 2 pk address", new_coin_2_pk_address.toString(), "\n",
        //             "new coin 2 value: ", new_coin_2_value.toString(), "\n",
        //             "new coin 2 nullifier seed: ", new_coin_2_nullifier_seed.toString(), "\n",
        //             "new coin 2 r: ", new_coin_2_r.toString(), "\n",
        //             "new coin 2 s: ", new_coin_2_s.toString(), "\n",
        //             "new coin 2 commitment: ", new_coin_2_commitment.toString())

        expect(await claim_pour(root.toString(), old_sn.toString(), new_cm_1.toString(), new_cm_2.toString(), v_pub.map(i => i.toString()), h_sig.toString(), h.toString(), siblings.map(i => i.toString()), pathIndices.map(i => i.toString()), old_coin_pk_address.toString(), old_coin_value.toString(), old_coin_nullifier_seed.toString(), old_coin_r.toString(), old_coin_s.toString(), old_coin_commitment.toString(), old_sk.toString(), new_coin_1_pk_address.toString(), new_coin_1_value.toString(), new_coin_1_nullifier_seed.toString(), new_coin_1_r.toString(), new_coin_1_s.toString(), new_coin_1_commitment.toString(), new_coin_2_pk_address.toString(), new_coin_2_value.toString(), new_coin_2_nullifier_seed.toString(), new_coin_2_r.toString(), new_coin_2_s.toString(), new_coin_2_commitment.toString())).toBe(true)
    }, 1920 * 1000)
})