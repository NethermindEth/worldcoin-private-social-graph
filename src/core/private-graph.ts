import { mint, verifyMint } from "./mint";
import { Tree } from "./tree";
import { Coin, Candidate, Mint, Address, Pour } from "./structs";
import { pour, verifyPour } from "./pour";
import { poseidon2 } from "poseidon-lite";

export class private_graph {
    private voting_tree: Tree
    private candidates: Candidate[]
    public vote_nullifiers: bigint[]
    
    constructor() {
        this.voting_tree = new Tree
        this.candidates = []
        this.vote_nullifiers = []
    }

    public create_address() : Address {
        const sk = BigInt(Math.random() * 2**256)
        const pk = poseidon2([sk, 0])
        return new Address(sk, pk)
    }

    public registerCandidate(name: string, epochV: number) {
        this.candidates.push(new Candidate(this.candidates.length + 1, name, epochV))
    }

    // Mint new coin and add coin commitment in voting tree
    public registerWorldID(pk: bigint) {
        // generate mint tx
        const m = mint(pk, BigInt(1))
        // get values from mint tx
        const cm = m.tx_mint[0]
        const k = m.tx_mint[1]
        const coin = m.tx_mint[2]
        
        const pos = this.voting_tree.addMember(cm)

        if(!verifyMint(cm, BigInt(1), k)) {
            throw Error("Could not veriify mint")
        }

        return [m.tx_mint, coin, pos]
    }

    // consume old coin to 
    public async vote(old_coin: Coin, old_address: Address, new_pk_address: bigint, userID: number, weight: bigint) {
        if (weight < 0) {
            throw new Error("weight must be non-negative")
        }
        // generate pour transaction
        const Pour = await pour(
            this.voting_tree,
            this.voting_tree.root,
            old_coin,
            old_address,
            this.voting_tree.generateMerkleProof(this.voting_tree.indexOf(old_coin.getCoinCm())),
            old_coin.value - weight,
            new_pk_address,
            weight,
            "info"
        )

        if(!verifyPour(this.voting_tree, Pour, this.vote_nullifiers)){
            throw new Error("Pour transaction is invalid")
        }

        // check v_in does not exceed threshold
        if (this.candidates[userID].v_in + weight <= 10) {
            this.candidates[userID].v_in += weight
        }

        // add old nullifier to vote nullifiers to prevent double spending
        this.vote_nullifiers.push(Pour.tx_pour.sn_old)
        // add new cm to voting tree and get new position of cm
        const voting_pos = this.voting_tree.addMember(Pour.tx_pour.new_cm)

        // mint coin in userID tree
        const m: Mint = mint(old_address.pk, weight)
        const cm = m.tx_mint[0]
        const userID_pos = this.candidates[userID].candidateTree.addMember(cm)

        return [Pour.tx_pour, voting_pos, m.tx_mint, userID_pos, BigInt("1"), userID]
    }
}
