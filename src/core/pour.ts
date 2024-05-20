import { poseidon1, poseidon2, poseidon4 } from "poseidon-lite";
import { ECDSA_address, Coin, Tx_Pour, Pour, Address } from "./structs";
import { Tree } from "./tree";
import { IMTMerkleProof } from "@zk-kit/imt"
import { BN, ec } from "elliptic"
const EC = new ec('secp256k1')

/**
 * 
 * @param rt - voting tree root || candidate tree root
 * @param old_coin - coin found in voting tree || candidate tree
 * @param old_sk - old address secret key
 * @param path - path to old coin commitment in voting tree || candidate tree
 * @param v_1 - old coin value - weight || u * alpha
 * @param v_2 - weight || u * C / sum_i
 * @param new_pk_address_1 - new zcash address to store voting coin 
 * @param new_pk_address_2 - new zcash address to store candidate coin || rewards coin
 * @param v_pub - public values to verify in circuit correct values
 * @param info - arbitrary transaction string info
 * @returns Produces two coins and a pour tx
 * 
 * @description will spend the old coin and create two new coins who's summed value equal to the old coins original value
 */
export function pour(
    rt: bigint,
    old_coin: Coin,
    old_sk: bigint,
    path: IMTMerkleProof,
    v_1: number,
    v_2: number,
    // generate new zcash address for each coin
    new_pk_address_1: bigint,
    new_pk_address_2: bigint,
    v_pub: number[],
    info: string
) {
    // generate old serial number
    const sn_old = poseidon2([old_sk, old_coin.seed])
    // Compute coin 1:
    // sample nullifier seed
    const seed_1 = BigInt(Math.random() * 2**256)
    // sample trapdoors
    let r_1 = BigInt(Math.random() * 2**256)
    let s_1 = BigInt(Math.random() * 2**256)
    // compute 2-step commitment
    const new_k_1 = poseidon2([r_1, poseidon2([new_pk_address_1, seed_1])])
    const new_cm_1 = poseidon2([v_1, new_k_1])
    const coin_1: Coin = {
        public_key: new_pk_address_1, 
        value: v_1, 
        seed: seed_1, 
        r: r_1, 
        s:s_1, 
        cm:new_cm_1
    }

    // Compute coin 2:
    // sample nullifier seed
    const seed_2 = BigInt(Math.random() * 2**256)
    // sample trapdoors
    let r_2 = BigInt(Math.random() * 2**256)
    let s_2 = BigInt(Math.random() * 2**256)
    // compute 2-step commitment
    const new_k_2 = poseidon2([r_2, poseidon2([new_pk_address_2, seed_2])])
    const new_cm_2 = poseidon2([v_2, new_k_2])
    const coin_2: Coin = {
        public_key:new_pk_address_2, 
        value: v_2, 
        seed: seed_2, 
        r: r_2, 
        s:s_2, 
        cm:new_cm_2
    }

    // generate One-time strongly-unforgeable digital signatures (ECDSA) key-pair
    const sig_key_pair : ECDSA_address = new ECDSA_address()

    // generate signature hashes
    // hash sig pub key
    const h_sig = poseidon1([sig_key_pair.get_pub()])
    // hash of signature with old address secret key
    const h = poseidon4([old_sk, 2, 1, h_sig]) // padding taken from zcash doc

    // TODO: call Noir pour circuit
    const pour_instance: any = []
    const proof: any[] = []

    // Sign message
    let msg: any = [pour_instance, proof, info]
    let signature = sig_key_pair.sign(msg)
    if(!sig_key_pair.verify(msg, signature)) {
        throw new Error("poop")
    }

    // restrict the signature to only accept low S values- sigs are of the form (r,S) according to BIP 62: https://github.com/bitcoin/bips/blob/master/bip-0062.mediawiki#low-s-values-in-signatures
    
    // get order but since it is of value BN | undefined | null we need to ensure it is of type BN
    let order = EC.n
    // let order_bn = await ensure_bn(order) // get promised value of type BN
    if (order === null || order === undefined) {
        throw new Error("Value is of type undefined or null")
    } else {
        let changed = false
        let halforder = order.shrn(1)
        // must be smaller than halforder of BN -> 0xFFFFFFFF FFFFFFFF FFFFFFFF FFFFFFFE BAAEDCE6 AF48A03B BFD25E8C D0364140
        if (signature.s.gt(halforder)) {
            changed = true
            signature.s = signature.s.sub(halforder)
        }
        
        const tx_pour: Tx_Pour = {
            rt: rt,
            sn_old: sn_old,
            new_cm_1: coin_1.cm,
            new_cm_2: coin_2.cm,
            v_pub: v_pub,
            info: info,
            key: sig_key_pair,
            h: h,
            proof: proof,
            signature: signature
        }
    
        const new_pour : Pour = {
            coin_1: coin_1, 
            coin_2: coin_2, 
            tx_pour: tx_pour,
        }

        console.log(changed)

        return new_pour
    }
}

/**
 * 
 * @param tree - the tree the old coin was found
 * @param pour - the result of the pour function: the two new coins and the tx
 * @param vote_nullifiers - the list of revealed coins in the voting tree
 * @param old_sk - old secret signing key
 * @returns true if the pour transaction was correctly crafted, otherwise false
 * 
 * @description checks the nullifiers, roots and correctness of the pour tx
 */
export function verifyPour(
    tree: Tree,
    pour: Pour,
    vote_nullifiers: bigint[],
    old_sk: bigint
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
    const h_sig = poseidon1([pour.tx_pour.key.get_pub()])
    if (pour.tx_pour.h != poseidon4([old_sk, 2, 1, h_sig])) {
        return false
    }

    // TODO: verify signature: fix issue that signatures wont match if they have been forced to lower value
    // verify signature
    const pour_instance: any = []
    
    const msg: any = [pour_instance, pour.tx_pour.proof, pour.tx_pour.info]

    const sig = pour.tx_pour.signature
    

    if (!pour.tx_pour.key.verify(msg, pour.tx_pour.signature)) {
            let order = EC.n
            if (order === null || order === undefined) {
                throw new Error("Value is of type undefined or null")
            } else {
                let halforder = order.shrn(1)
                // must be smaller than halforder of BN -> 0xFFFFFFFF FFFFFFFF FFFFFFFF FFFFFFFE BAAEDCE6 AF48A03B BFD25E8C D0364140
                sig.s = sig.s.add(halforder)
                if (!pour.tx_pour.key.verify(msg, sig)){
                    return false
                }
            }
    }

    // TODO: verify circuit proof
    // verify circuit proof
    return true
} 
