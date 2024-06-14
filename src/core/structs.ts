import { BNInput, ec, SignatureInput } from "elliptic"
const EC = new ec('secp256k1')
import { Tree } from "./tree"
import { getRandomValues } from "crypto"

export type Coin = {
    public_key: bigint // address pk
    value: number // coin value
    seed: bigint // nullifier/serial number seed
    r: bigint // trapdoor
    s: bigint // trapdoor
    cm: bigint // final commitment of value and k
}

// Used to sign the pour message
export class ECDSA_address {
    public key_pair: ec.KeyPair

    constructor() {
        this.key_pair = EC.genKeyPair()
    }

    // getters
    public get_key_pair() {
        return this.key_pair
    }

    public get_priv() {
        return this.key_pair.getPrivate().toString()
    }

    public get_pub() {
        return "0x" + this.key_pair.getPublic().encode('hex', true).toString()
    }

    // setters
    public set_key_pair(
        new_key_pair: any
    ) {
        this.key_pair = new_key_pair
    }

    public change_key_pair() {
        this.key_pair = EC.genKeyPair()
    }

    public sign(msg: BNInput) {
        return this.key_pair.sign(msg)
    }

    public verify(
        msg: BNInput,
        sig: SignatureInput,
    ) {
        return this.key_pair.verify(msg, sig)
    }
}

// represents the user in the zcash way
export type Address = {
    sk: bigint
    pk: bigint
}

export class Candidate {
    readonly userID: number
    readonly name: string
    readonly epochV: number
    public status: string
    public candidateTree: Tree
    public v_in: number
    public votes: number
    public address?: Address 
    public nullifiers: bigint[]

    constructor(
        userID: number,
        name: string,
        epochV: number,
    ) {
        this.userID = userID
        this.name = name
        this.epochV = epochV
        this.status = "Candidate"
        this.candidateTree = new Tree
        this.v_in = 0
        this.votes = 0
        this.nullifiers = []
    }

    // getters
    public get_userID() : number {
        return this.userID
    }

    public get_name() : string {
        return this.name
    }

    public get_epochV() : number {
        return this.epochV
    }

    public get_status() : string {
        return this.status
    }

    public get_numLeaves() : number {
        return this.candidateTree.members.length
    }

    // setters
    public update_status() {
        this.status = "Verified"
    }

    public cmp(candidate : Candidate) : boolean {
        if (this.userID != candidate.userID) {
            console.error("userID failed")
            return false
        }

        if (this.name != candidate.name) {
            console.error("name failed")
            return false
        }

        if (this.epochV != candidate.epochV) {
            console.error("epochV failed")
            return false
        }

        if (this.status != candidate.status) {
            console.error("status failed")
            return false
        }

        if (this.candidateTree.members.length != candidate.candidateTree.members.length) {
            console.error("tree failed")
            return false
        }

        if (this.v_in != candidate.v_in) {
            console.error("v_in failed")
            return false
        }

        if (this.votes != candidate.votes) {
            console.error("votes failed")
            return false
        }

        if (JSON.stringify(this.nullifiers) != JSON.stringify(candidate.nullifiers)) {
            console.error("nullifiers failed")
            return false
        }

        if (this.address != candidate.address) {
            console.error("address failed")
            return false
        }

        return true
    }
}

// Result of the mint function producing the coin and tx
export type Mint = {
    // secret coin minted in voting tree
    coin: Coin
    // public mint transaction
    tx_mint: Mint_Tx
}

// Mint transaction
export type Mint_Tx = {
    cm: bigint;
    value: number;
    k: bigint;
    s: bigint;
}

// Result of WorldID registration
export type Register = {
    tx_mint: Mint_Tx;
    coin: Coin;
    pos: number;
}

// Pour transaction
export type Tx_Pour = {
    rt: bigint // merkle root when generating pour
    sn_old: bigint // serial number of coin being poured from
    new_cm_1: bigint // commitment of new coin in voting tree (value = old coin - weight) ||  (u * alpha)
    new_cm_2: bigint // commitment of new coin in candidate tree (value = weight) || u * C / sum_i
    v_pub: number // public values to verify correct values of coins
    info: string // arbitrary string
    key: ECDSA_address // one time signature public key
    h: bigint // hash of signature pk
    proof: string // noir proof
    signature: ec.Signature // signature of public instances, proof and info
}

// Result of the pour function producing the coins and tx
export type Pour = {
    // the secret two coins produced from the pour
    coin_1: Coin
    coin_2: Coin
    // the public pour transaction to be sent to the SC for verification
    tx_pour: Tx_Pour
    is_called_by_vote: boolean
}

// Result of having voted
export type Voting = {
    tx_pour: Tx_Pour
    voting_pos: number
    userID_pos: number
    userID: number
    coin_1: Coin
    coin_2: Coin
}

export type reward = {
    // total voting power allocated to candidates to become verified
    sum: number
    // total voting power claimed back in the rewards for the epoch
    claimed: number 
}

export type RewardMap = {
    // epoch to reward map
    [key: number]: reward
}

export type claimed = {
    voting_pos: number
    reward_pos: number
    pour_tx: Tx_Pour
    coin_1: Coin
    coin_2: Coin
}

export const modulus = BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617")

export function secureRandom(max: bigint): bigint {
    const array = new Uint32Array(1);
    getRandomValues(array);
    return (BigInt(array[0]) % (max + BigInt(1)));
}