import { BNInput, ec, SignatureInput } from "elliptic"
const EC = new ec('secp256k1')
import { Tree } from "./tree"

export class Coin {
    public public_key: any
    public value: bigint
    public seed: bigint
    public r: bigint
    public s: bigint
    public cm: bigint

    constructor(
        public_key: any,
        value: bigint, // value should always be 1 in the case of 
        seed: bigint,
        r: bigint,
        s: bigint,
        cm: bigint,
    ) {
        this.public_key = public_key
        this.value = value
        this.seed = seed
        this.r = r
        this.s = s
        this.cm = cm
    }

    // getters
    public getCoinPk() {
        return this.public_key
    }

    public getCoinValue() {
        return this.value
    }

    public getCoinSeed() {
        return this.seed
    }

    public getCoinR() {
        return this.r
    }

    public getCoinS() {
        return this.s
    }

    public getCoinCm() {
        return this.cm
    }

    // setters
    public setCoinValue(value: bigint) {
        this.value = value
    }

    public setCoinSeed(seed: bigint) {
        this.seed = seed
    }

    public setCoinR(r: bigint) {
        this.r = r
    }

    public setCoinS(s: bigint) {
        this.s = s
    }

    public setCoinCm(cm: bigint) {
        this.cm = cm
    }
}

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
        return this.key_pair.getPublic().toString()
    }

    public get_pub_X() {
        return this.key_pair.getPublic().getX()
    }

    public get_pub_Y() {
        return this.key_pair.getPublic().getY()
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

export class Candidate {
    readonly userID: number
    readonly name: string
    readonly epochV: number
    public status: string
    public candidateTree: Tree
    public v_in: bigint

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
        this.v_in = BigInt(0)
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
}

export class Mint {
    public coin: Coin
    public tx_mint: bigint[]

    constructor(coin: Coin, tx_mint: bigint[]){
        this.coin = coin
        this.tx_mint = tx_mint
    }
}

export class Tx_Pour {
    public rt: bigint
    public sn_old: bigint
    public new_cm: bigint
    public weight: bigint
    public info: string
    public key: string
    public h: bigint
    public proof: any[]
    public signature: ec.Signature

    constructor (
        rt: bigint,
        sn_old: bigint,
        new_cm: bigint,
        weight: bigint,
        info: string,
        key: string,
        h: bigint,
        proof: any[],
        signature: ec.Signature,
    ) {
        this.rt = rt
        this.sn_old = sn_old
        this.new_cm = new_cm
        this.weight = weight
        this.info = info
        this.key = key
        this.h = h
        this.proof = proof
        this.signature = signature
    }
}

export class Pour {
    public coin: Coin
    public tx_pour: Tx_Pour

    constructor(coin: Coin, tx_pour: Tx_Pour) {
        this.coin = coin
        this.tx_pour = tx_pour
    }
}
