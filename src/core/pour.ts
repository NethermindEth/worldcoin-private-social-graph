import { poseidon1, poseidon2, poseidon3, poseidon4 } from "poseidon-lite";
import { ECDSA_address, Coin, Tx_Pour, Pour, modulus, secureRandom } from "./structs";
import { Tree } from "./tree";
import { IMTMerkleProof } from "@zk-kit/imt"
import { writeFileSync, readFileSync } from "fs"
import { exec } from "child_process";
import { ec } from "elliptic"
import { ethers } from "ethers"
import 'keccak256';
import keccak256 from "keccak256";

const EC = new ec('secp256k1')

import { proveVote, proveClaim, verifyClaim, verifyVote  } from "./prover";
import { InputMap, ProofData } from "@noir-lang/noir_js";

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
export async function pour(
    rt: bigint,
    old_coin: Coin,
    old_sk: bigint,
    path: IMTMerkleProof,
    v_1: number,
    v_2: number,
    // generate new zcash address for each coin
    new_pk_address_1: bigint,
    new_pk_address_2: bigint,
    v_pub: number,
    info: string,
    is_called_by_vote: boolean
) : Promise<Pour> {
    // generate old serial number
    const sn_old = poseidon3([old_sk,1,old_coin.seed]) // following zcash serial number PRF

    // Compute coin 1:
    // sample nullifier seed
    const seed_1 = secureRandom(modulus)
    // sample trapdoors
    let r_1 = secureRandom(modulus)
    let s_1 = secureRandom(modulus)
    // compute 2-step commitment
    const new_k_1 = poseidon2([r_1, poseidon2([new_pk_address_1, seed_1])])
    const new_cm_1 = poseidon3([new_k_1, 0, v_1])
    const coin_1: Coin = {
        public_key: new_pk_address_1, 
        value: v_1, 
        seed: seed_1, 
        r: r_1, 
        s: s_1, 
        cm: new_cm_1
    }

    // Compute coin 2:
    // sample nullifier seed
    const seed_2 = secureRandom(modulus)
    // sample trapdoors
    let r_2 = secureRandom(modulus)
    let s_2 = secureRandom(modulus)
    // compute 2-step commitment
    const new_k_2 = poseidon2([r_2, poseidon2([new_pk_address_2, seed_2])])
    const new_cm_2 = poseidon3([new_k_2, 0, v_2])
    const coin_2: Coin = {
        public_key:new_pk_address_2, 
        value: v_2, 
        seed: seed_2, 
        r: r_2, 
        s: s_2, 
        cm: new_cm_2
    }

    // generate One-time strongly-unforgeable digital signatures (ECDSA) key-pair
    const sig_key_pair : ECDSA_address = new ECDSA_address()
    const wallet = new ethers.Wallet(sig_key_pair.get_priv())

    // generate signature hashes
    // hash sig pub key
    const ethereumAddress = await wallet.getAddress();
    const pubke = ethers.getUint(ethereumAddress);
    const h_sig = poseidon1([pubke]);

    // hash of signature with old address secret key
    const h = poseidon4([old_sk, 2, 0, h_sig]) // padding taken from zcash doc

    // TODO: HAVE THIS READ THE PROOF FROM CIRCUITS
    let pour_instance: any[] = [rt, sn_old, new_cm_1, new_cm_2, v_pub, h_sig, h]

    const inputs = {
        h: h.toString(),
        h_sig: h_sig.toString(),
        indices: path.pathIndices.map(i => i.toString()),
        new_cm_1: new_cm_1.toString(),
        new_cm_2: new_cm_2.toString(),
        new_coin_1_commitment: coin_1.cm.toString(),
        new_coin_1_nullifier_seed: coin_1.seed.toString(),
        new_coin_1_pk_address: coin_1.public_key.toString(),
        new_coin_1_r: coin_1.r.toString(),
        new_coin_1_value: coin_1.value.toString(),
        new_coin_2_commitment: coin_2.cm.toString(),
        new_coin_2_nullifier_seed: coin_2.seed.toString(),
        new_coin_2_pk_address: coin_2.public_key.toString(),
        new_coin_2_r: coin_2.r.toString(),
        new_coin_2_value: coin_2.value.toString(),
        old_coin_commitment: old_coin.cm.toString(),
        old_coin_nullifier_seed: old_coin.seed.toString(),
        old_coin_pk_address: old_coin.public_key.toString(),
        old_coin_r: old_coin.r.toString(),
        old_coin_value: old_coin.value.toString(),
        old_sk: old_sk.toString(),
        old_sn: sn_old.toString(),
        root: rt.toString(),
        siblings: path.siblings.map(i => i.toString()),
        v_pub: v_pub.toString()
    };
    let proof: ProofData
    
    // call Noir pour circuit
    if (!is_called_by_vote) {
        proof = await proveClaim(inputs)
    } else {        
        proof = await proveVote(inputs)
    }

    // Sign message
    let msg: any = [...pour_instance, ethers.hexlify(proof.proof), info];
    // Encode the data using ethers.solidityPack
    const encodedData = ethers.solidityPacked(
        ["uint256", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256", "bytes", "string"],
        msg
    );
    
    const msgHash = ethers.keccak256(encodedData);
    const hashBytes = ethers.getBytes(msgHash);
    let signature = await wallet.signMessage(hashBytes);
    // verify signature
    if(ethers.verifyMessage(hashBytes, signature) !== ethereumAddress) {
        throw new Error("Signature is invalid");
    }

    const tx_pour: Tx_Pour = {
        rt: rt,
        sn_old: sn_old,
        new_cm_1: coin_1.cm,
        new_cm_2: coin_2.cm,
        v_pub: v_pub,
        info: info,
        key: sig_key_pair,
        pubkey: ethereumAddress,
        h: h,
        proof: proof,
        signatureString: signature
    }

    const new_pour : Pour = {
        coin_1: coin_1, 
        coin_2: coin_2, 
        tx_pour: tx_pour,
        is_called_by_vote: is_called_by_vote
    }

    return new_pour
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
export async function verifyPour(
    tree: Tree,
    pour: Pour,
    voteNullifiers: bigint[],
    oldSk: bigint
): Promise<boolean> {
    const { tx_pour } = pour;

    // Check if sn_old is part of old nullifiers
    if (voteNullifiers.includes(tx_pour.sn_old)) {
        return false;
    }

    // Check if rt is part of old merkle roots
    if (!tree.roots.includes(tx_pour.rt)) {
        return false;
    }

    // Check if h corresponds to h_sig
    const hSig = poseidon1([ethers.getUint(tx_pour.pubkey as string)]);
    if (tx_pour.h !== poseidon4([oldSk, 2, 0, hSig])) {
        return false;
    }

    // Check signature
    const message: any = [
        tx_pour.rt,
        tx_pour.sn_old,
        tx_pour.new_cm_1,
        tx_pour.new_cm_2,
        tx_pour.v_pub,
        hSig,
        tx_pour.h,
        ethers.hexlify(tx_pour.proof.proof),
        tx_pour.info,
    ];
    const encodedData = ethers.solidityPacked(
        ["uint256", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256", "bytes", "string"],
        message
    );
    const msgHash = ethers.keccak256(encodedData);
    const hashBytes = ethers.getBytes(msgHash);
    const signature = tx_pour.signatureString as string;
    if (ethers.verifyMessage(hashBytes, signature) !== tx_pour.pubkey) {
        return false;
    }

    // Verify circuit proof
    if (!pour.is_called_by_vote) {
        return verifyClaim(tx_pour.proof);
    } else {
        return verifyVote(tx_pour.proof);
    }
}

