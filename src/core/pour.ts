import { poseidon2, poseidon4 } from "poseidon-lite";
import { ECDSA_address, Coin, Tx_Pour, Pour, Address } from "./structs";
import { Tree } from "./tree";
import { IMTMerkleProof } from "@zk-kit/imt"
import { BN, ec } from "elliptic"
const EC = new ec('secp256k1')

export async function pour(
    tree: Tree,
    rt: bigint,
    old_coin: Coin,
    old_address: Address,
    path: IMTMerkleProof,
    new_value: bigint,
    new_pk_address: bigint,
    weight: bigint,
    info: string
    // will likely need to also set an option of which noir circuit to call
) : Promise<Pour> {
    // check merkle path validity
    if (tree.verifyMerkleProof(path) != true && tree.root != rt) {
        throw new Error("Merkle proof not valid") 
    }

    // generate old serial number
    const sn_old = poseidon2([old_address.sk, old_coin.getCoinSeed()])
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

    // generate One-time strongly-unforgeable digital signatures (ECDSA) key-pair
    const key = new ECDSA_address() 

    // generate signature hashes
    // hash sig pub key
    const h_sig = poseidon2([key.get_pub()])
    // hash of signature with old address secret key
    const h = poseidon4([old_address.sk, 2, 1, h_sig]) // padding taken from zcash doc

    // TODO: call Noir pour circuit
    const pour_instance: any = []
    const proof: any[] = []

    // Sign message
    let msg: any = [pour_instance, proof, info]
    let signature = key.sign(msg)

    // restrict the signature to only accept low S values- sigs are of the form (r,S) according to BIP 62: https://github.com/bitcoin/bips/blob/master/bip-0062.mediawiki#low-s-values-in-signatures
    
    // get order but since it is of value BN | undefined | null we need to ensure it is of type BN
    let order = EC.n; 
    let order_bn = await ensure_bn(order) // get promised value of type BN
    let halforder = order_bn.shrn(1)
    // must be smaller than halforder of BN -> 0xFFFFFFFF FFFFFFFF FFFFFFFF FFFFFFFE BAAEDCE6 AF48A03B BFD25E8C D0364140
    if (signature.s.gt(halforder)) {
        signature.s = halforder.sub(signature.s)
    }

    // generate transaction
    const tx_pour = new Tx_Pour(rt, sn_old, new_cm, weight, info, key.get_pub(), h, proof, signature)

    return new Pour(new_coin, tx_pour)
}

async function ensure_bn(value: BN | null | undefined) : Promise<BN> {
    return new Promise((reject, resolve) => {
        if (typeof value === null || typeof value === undefined) {
            throw new Error("Value is of type undefined or null");
        } else {
            resolve(value);
        }
    })
}

export function verifyPour(
    tree: Tree,
    pour: Pour,
    vote_nullifiers: bigint[]
) : boolean {
    // check sn_old is not part of old nullifiers
    if(vote_nullifiers.includes(pour.tx_pour.sn_old)) {
        return false
    }

    // check rt is part of old merkle roots
    if(!tree.roots.includes(pour.tx_pour.rt)) {
        return false
    }

    // check h corresponds h_sig
    if (pour.tx_pour.h != poseidon2([pour.coin.public_key])) {
        return false
    }

    // verify signature
    const pour_instance: any = []
    const msg: any = [pour_instance, pour.tx_pour.proof, pour.tx_pour.info]
    const key = ec.KeyPair.fromPublic(EC, pour.tx_pour.key)
    if (!key.verify(msg, pour.tx_pour.signature)) {
        return false
    }

    // TODO: verify circuit proof

    return true
} 