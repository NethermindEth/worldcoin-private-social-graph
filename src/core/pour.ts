import { poseidon2, poseidon4 } from "poseidon-lite";
import { ECDSA_address, Coin, Tx_Pour, Pour } from "./structs";
import { Tree } from "./tree";
import { IMTMerkleProof } from "@zk-kit/imt"
import { ec } from "elliptic"
const EC = new ec('secp256k1')

export function pour(
    tree: Tree,
    rt: bigint,
    old_coin: Coin,
    old_address: ECDSA_address,
    path: IMTMerkleProof,
    new_value: bigint,
    new_pk_address: string,
    weight: bigint,
    info: string
    // will likely need to also set an option of which noir circuit to call
) : Pour {
    // check merkle path validity
    if (tree.verifyMerkleProof(path) != true && tree.root != rt) {
        throw new Error("Merkle proof not valid") 
    }

    // generate old serial number
    const sn_old = poseidon2([old_address.get_priv(), old_coin.getCoinSeed()])
    // sample nullifier seed
    const new_seed = BigInt(Math.random() * 2**256)
    // sample trapdoors
    const new_r = BigInt(Math.random() * 2**256)
    const new_s = BigInt(Math.random() * 2**256)

    // compute 2-step commitment
    const new_k = poseidon2([new_r, poseidon2([new_pk_address, new_seed])])
    const new_cm = poseidon2([1, new_k])

    // set new coin
    const new_coin: Coin = new Coin(new_pk_address, new_value, new_seed, new_r, new_s, new_cm)

    // generate One-time strongly-unforgeable digital signatures (ECDSA)
    const key = new ECDSA_address() 

    // generate signature hashes
    const h_sig = poseidon2([key.get_pub()])
    const h = poseidon4([old_address.get_priv(), 2, 1, h_sig]) // padding taken from zcash doc

    // TODO: call Noir pour circuit
    const pour_instance: any = []
    const proof: any[] = []

    // restrict the signature to only accept low S values- sigs are of the form (r,S)
    let msg: any = [pour_instance, proof, info]
    let signature = key.sign(msg)

    // generate transaction
    const tx_pour = new Tx_Pour(rt, sn_old, new_cm, weight, info, key.get_pub(), h, proof, signature)

    return new Pour(new_coin, tx_pour)
}

export function verifyPour(
    tree: Tree,
    rt: bigint,
    sn_old: bigint,
    info: string,
    pk: string,
    h: bigint,
    proof: any[],
    signature: ec.Signature,
    vote_nullifiers: bigint[]
) : boolean {
    // check sn_old is not part of old nullifiers
    if(vote_nullifiers.includes(sn_old)) {
        return false
    }

    // check rt is part of old merkle roots
    if(!tree.roots.includes(rt)) {
        return false
    }

    // check h corresponds h_sig
    if (h != poseidon2([pk])) {
        return false
    }

    // verify signature
    const pour_instance: any = []
    const msg: any = [pour_instance, proof, info]
    const key = ec.KeyPair.fromPublic(EC, pk)
    if (!key.verify(msg, signature)) {
        return false
    }

    // TODO: verify circuit proof

    return true
} 