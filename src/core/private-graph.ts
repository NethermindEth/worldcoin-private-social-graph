import { mint, verifyMint } from "./mint";
import { Tree } from "./tree";
import { Coin, ECDSA_address, Candidate, Mint } from "./structs";
import { pour } from "./pour";

export class private_graph {
    private voting_tree: Tree
    private candidates: Candidate[]
    public vote_nullifiers: bigint[]
    
    constructor() {
        this.voting_tree = new Tree
        this.candidates = []
        this.vote_nullifiers = []
    }

    public genAddress() {
        return new ECDSA_address()
    }

    public registerCandidate(name: string, epochV: number) {
        this.candidates.push(new Candidate(this.candidates.length + 1, name, epochV))
    }

    // Mint new coin and add coin commitment in voting tree
    public registerWorldID(pk: string) {
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
    public vote(old_coin: Coin, old_address: ECDSA_address, new__pk_address: string, userID: number, weight: bigint) {
        // generate pour transaction
        const Pour = pour(
            this.voting_tree,
            this.voting_tree.root,
            old_coin,
            old_address,
            this.voting_tree.generateMerkleProof(this.voting_tree.indexOf(old_coin.getCoinCm())),
            old_coin.value - weight,
            new__pk_address,
            weight,
            "info"
        )

        // check v_in does not exceed threshold
        if (this.candidates[userID].v_in + weight <= 10) {
            this.candidates[userID].v_in += weight
        }

        // add old nullifier to vote nullifiers to prevent double spending
        this.vote_nullifiers.push(Pour.tx_pour.sn_old)
        // add new cm to voting tree and get new position of cm
        const voting_pos = this.voting_tree.addMember(Pour.tx_pour.new_cm)

        // mint coin in userID tree
        const m: Mint = mint(old_address.get_pub(), weight)
        const cm = m.tx_mint[0]
        const userID_pos = this.candidates[userID].candidateTree.addMember(cm)

        return [Pour.tx_pour, voting_pos, m.tx_mint, userID_pos, BigInt("1"), userID]
    }
}
