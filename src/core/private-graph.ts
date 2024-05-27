import { mint, verifyMint } from "./mint";
import { Tree } from "./tree";
import { Coin, Candidate, Mint, Address, Register, Voting, RewardMap, claimed } from "./structs";
import { pour, verifyPour } from "./pour";
import { poseidon2 } from "poseidon-lite";

export class PrivateGraph {
    // setup voting tree
    public voting_tree: Tree
    public vote_nullifiers: bigint[]

    // list of candidates that wish to be verified
    public candidates: Candidate[]

    // setup reward maps and tree
    public rewards: RewardMap;
    public rewards_tree: Tree
    public reward_nullifiers: bigint[]

    // declare reward parameters
    readonly x: number = 600
    readonly alpha: number = 60
    readonly C: number = 140000 
    
    constructor() {
        this.voting_tree = new Tree
        this.rewards_tree = new Tree
        this.candidates = []
        this.vote_nullifiers = []
        this.rewards = []
        this.reward_nullifiers = []
    }

    /**
     * 
     * @returns Zcash Address Pair
     * 
     * @description will produce a key pair like zcash by sampling a random number as the secret key and hashing it for the public key
     */
    public create_address() : Address {
        const sk = BigInt(Math.random() * 2**256)
        const pk = poseidon2([sk, 0])
        const addr: Address = {sk, pk}
        return addr
    }

    /**
     * 
     * @param name - User name of candidate
     * @param epochV - Ethereum epoch user is currently in
     * @returns userID - the position of the candidate in the candidate list
     * 
     * @description Will create a new candidate with paramaters passed to it and add to the list of candidates
     */
    public registerCandidate(name: string, epochV: number) : number {
        this.candidates.push(new Candidate(this.candidates.length + 1, name, epochV))
        const userID = this.candidates.length - 1       
        return userID
    }

    /**
     * 
     * @param pk - public key of Zcash Address
     * @returns Result of the mint function producing the coin and tx with cm's position in the voting tree
     * 
     * @description Will mint new coin and add coin commitment to voting tree
     */
    public registerWorldID(pk: bigint) : Register {
        // generate mint tx
        const m = mint(pk, 100)
        // get values from mint tx
        const cm = m.tx_mint.cm
        const k = m.tx_mint.k
        const coin = m.coin
        
        if(!verifyMint(cm, 100, k)) {
            throw Error("Could not veriify mint")
        }

        const pos = this.voting_tree.addMember(cm)

        const reg : Register = {
            tx_mint: m.tx_mint,
            coin: coin,
            pos: pos
        }

        return reg
    }

    /**
     * 
     * @param old_coin - old coin to be consumed
     * @param old_address - old zcash address referring to the old coin
     * @param new_pk_address_1 - new zcash address public key for the cm in the voting tree
     * @param new_pk_address_2 - new zcash address public key for the cm in the candidate tree
     * @param userID - position of candidate in candidate list to be voted for
     * @param weight - weight of vote to be cast for candidate
     * @returns Result of the pour function producing the coins and tx with each cm in the voting || candidate tree
     * 
     * @description consume old coin to create a new one in voting tree and candidate tree
     */
    public vote(old_coin: Coin, old_address: Address, new_pk_address_1: bigint, new_pk_address_2: bigint, userID: number, weight: number) : Voting {
        if (weight < 0) {
            throw new Error("weight must be non-negative")
        }
        // generate pour transaction
        const Pour = pour(
            this.voting_tree.root,
            old_coin,
            old_address.sk,
            this.voting_tree.generateMerkleProof(this.voting_tree.indexOf(old_coin.cm)),
            old_coin.value - weight,
            weight,
            new_pk_address_1,
            new_pk_address_2,
            [weight],
            "vote"
        )

        if(!verifyPour(this.voting_tree, Pour, this.vote_nullifiers, old_address.sk)){
            throw new Error("Pour transaction is invalid")
        }

        // check v_in does not exceed threshold
        if (this.candidates[userID].v_in + weight <= 10*100) {
            this.candidates[userID].v_in += weight
        } else {
            throw new Error("Weight too high, please vote with less power to not overcome threshold")
        }

        // add old nullifier to vote nullifiers to prevent double spending
        this.vote_nullifiers.push(Pour.tx_pour.sn_old)
        // add new cm to voting tree and get new position of cm related to voting
        const voting_pos = this.voting_tree.addMember(Pour.tx_pour.new_cm_1)

        // add new cm to candidate tree and get new position of cm related to candidate
        const userID_pos = this.candidates[userID].candidateTree.addMember(Pour.tx_pour.new_cm_2)
        this.candidates[userID].votes += 1

        const pour_parts : Voting = {
            tx_pour: Pour.tx_pour, 
            voting_pos: voting_pos, 
            userID_pos: userID_pos, 
            userID: userID,
            coin_1: Pour.coin_1,
            coin_2: Pour.coin_2,
        }

        return pour_parts
    }

    /**
     * 
     * @param userID - position of candidate in candidate list to be updated
     * @param curr_epoch - current epoch to be supplied as verified epoch
     * @returns Result of the mint function producing the coin and tx with cm's position in the voting tree
     * 
     * @description The candidate that wants to become a Verified Identity creates a tx that mints a coin in the voting tree
     */
    public update_status_verified(userID: number, curr_epoch: number) {
        const candidate = this.candidates[userID]

        if (candidate.v_in < this.x) {
            throw new Error("Not enough voting power to become verified");
        }

        let v_in = candidate.v_in
        let y = this.f(v_in)
        candidate.address = this.create_address()
        const m: Mint = mint(candidate.address.pk, y)

        if (!verifyMint(m.tx_mint.cm, y, m.tx_mint.k)) {
            throw new Error("Verification of mint did not succeed")
        }
        const pos = this.voting_tree.addMember(m.coin.cm)
        candidate.update_status()

        if (this.rewards[curr_epoch] == null || this.rewards[curr_epoch] == undefined) {
            this.rewards[curr_epoch] = {
                sum: v_in,
                claimed: 0
            }
        } else {
            this.rewards[curr_epoch].sum += v_in
        }

        const reg: Register = {
            tx_mint: m.tx_mint,
            coin: m.coin,
            pos: pos
        }

        return reg
    }

    /**
     * 
     * @param v_in - voting power accumulated by other peoples voting
     * @returns total voting power of candidate once it has been verified
     */
    private f(v_in: number) : number { 
        return 100 - (Math.E**(-0.5 * v_in))
    }

    /**
     * 
     * @param old_coin - old coin in candidate tree to be consumed
     * @param old_address - zcash address of old coin
     * @param new_pk_address_1 - new zcash address public key for voting coin
     * @param new_pk_address_2 - new zcash address public key for rewards coin
     * @param userID - position of candidate in candidate list to be claimed
     * @param curr_epoch - Ethereum epoch user is currently in
     * 
     * @description Claims back a fraction of the voting power allocated to the Verified Candidate and its rewards
     */
    public claim(old_coin: Coin, old_address: Address, new_pk_address_1: bigint, new_pk_address_2: bigint, userID: number, curr_epoch: number) : claimed {
        // checks candidate is verified
        if (this.candidates[userID].status != "Verified") {
            throw new Error("Candidate not verified yet")
        }

        const verified_epoch = this.candidates[userID].epochV
        
        // check that the supplied current epoch is a valid epoch in relation to the verification epoch
        if (verified_epoch > curr_epoch) {
            throw new Error("Incorrect epoch number")
        }

        // check that there is still votig power to claim back
        if (this.rewards[curr_epoch].claimed == this.rewards[curr_epoch].sum) {
            throw new Error("All voting power claimed for this epoch")
        }
        
        const u = old_coin.value // spends a coin from the candidate tree of value u        
        const v_1 = u * this.alpha // creates a new coin of value v_1 in the voting merkle tree - claimed back
        const sum = this.rewards[verified_epoch].sum // get total number of rewards are epoch user was verified
        const h = Math.floor(u * this.C / sum) // creates a new coin of value h in the rewards tree

        const candidate_tree = this.candidates[userID].candidateTree

        const Pour = pour(
            candidate_tree.root,
            old_coin,
            old_address.sk,
            candidate_tree.generateMerkleProof(candidate_tree.indexOf(old_coin.cm)),
            v_1,
            h,
            new_pk_address_1,
            new_pk_address_2,
            [this.alpha, this.C, sum],
            "claim"
        )

        if(!verifyPour(candidate_tree, Pour, this.vote_nullifiers, old_address.sk)){
            throw new Error("Pour transaction is invalid")
        }

        // add old nullifier to candidate nullifiers
        this.candidates[userID].nullifiers.push(Pour.tx_pour.sn_old)

        // add coin commitment 1 to voting tree
        const vote_pos = this.voting_tree.addMember(Pour.coin_1.cm)

        // add coin commitment 2 to rewards tree
        const reward_pos = this.rewards_tree.addMember(Pour.coin_2.cm)

        // TODO: CHECK USER ID SIZE = NUMBER OF VOTES IF SO DELETE THE USER TREE
        this.rewards[verified_epoch].claimed += this.candidates[userID].v_in
    
        const claimed_rewards : claimed = {
            voting_pos: vote_pos,
            reward_pos: reward_pos,
            pour_tx: Pour.tx_pour,
            coin_1: Pour.coin_1,
            coin_2: Pour.coin_2,
        }

        return claimed_rewards
    }

    /**
     * 
     * @param userID - position of candidate in candidate list to be penalised
     * 
     * @description will delete the candidate tree and voting power of a candidate that is not verified
     */
    public penalise(userID: number) {
        if (this.candidates[userID].status != "Candidate") {
            throw new Error("User must be a candidate")
        }
        this.candidates[userID].candidateTree = new Tree
        this.candidates[userID].v_in = 0
        this.candidates[userID].votes = 0
    }
}
