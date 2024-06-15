import { poseidon1, poseidon2, poseidon3, poseidon4 } from "poseidon-lite";
import { ECDSA_address, Coin, Tx_Pour, Pour, modulus, secureRandom } from "./structs";
import { Tree } from "./tree";
import { IMTMerkleProof } from "@zk-kit/imt"
import { writeFileSync, readFileSync } from "fs"
import { exec } from "child_process";
import { ec } from "elliptic"
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

    // generate signature hashes
    // hash sig pub key
    const h_sig = poseidon1([sig_key_pair.get_pub()])
    // hash of signature with old address secret key
    const h = poseidon4([old_sk, 2, 0, h_sig]) // padding taken from zcash doc

    // TODO: HAVE THIS READ THE PROOF FROM CIRCUITS
    let pour_instance: any[] = []
    let proof = ""

    // call Noir pour circuit
    if (!is_called_by_vote) {
        // call claim pour
        const claim_path = "circuits/claimPour/Prover.toml"

        let pathIndicesString = "["
        let siblingsString = "["

        for (var i = 0; i < 64 ; i++) {
            pathIndicesString += "\"" + path.pathIndices[i] + "\","
            siblingsString += "\"" + path.siblings[i] + "\","
        }

        pathIndicesString += "]"
        siblingsString += "]"

        const inputs = "h=\"" + h + "\"\n" + 
        "h_sig=\"" + h_sig + "\"\n" + 
        "indices=" + pathIndicesString + "\n" + 
        "new_cm_1=\"" + new_cm_1 + "\"\n" + 
        "new_cm_2=\"" + new_cm_2 + "\"\n" + 
        "new_coin_1_commitment=\"" + coin_1.cm + "\"\n" + 
        "new_coin_1_nullifier_seed=\"" + coin_1.seed + "\"\n" + 
        "new_coin_1_pk_address=\"" + coin_1.public_key + "\"\n" + 
        "new_coin_1_r=\"" + coin_1.r + "\"\n" + 
        "new_coin_1_value=\"" + coin_1.value + "\"\n" + 
        "new_coin_2_commitment=\"" + coin_2.cm + "\"\n" + 
        "new_coin_2_nullifier_seed=\"" + coin_2.seed + "\"\n" + 
        "new_coin_2_pk_address=\"" + coin_2.public_key + "\"\n" + 
        "new_coin_2_r=\"" + coin_2.r + "\"\n" + 
        "new_coin_2_value=\"" + coin_2.value + "\"\n" + 
        "old_coin_commitment=\"" + old_coin.cm + "\"\n" + 
        "old_coin_nullifier_seed=\"" + old_coin.seed + "\"\n" + 
        "old_coin_pk_address=\"" + old_coin.public_key + "\"\n" + 
        "old_coin_r=\"" + old_coin.r + "\"\n" + 
        "old_coin_value=\"" + old_coin.value + "\"\n" + 
        "old_sk=\"" + old_sk + "\"\n" + 
        "old_sn=\"" + sn_old + "\"\n" + 
        "root=\"" + rt + "\"\n" + 
        "siblings=" + siblingsString + "\n" + 
        "v_pub=" + v_pub.toString() + "\n";

        writeFileSync(claim_path, inputs)

        await runCommand('./circuits/claimPour/gen_proof.sh')

        const claim_proof_path = "circuits/claimPour/proofs/claimPour.proof"
        pour_instance = [rt, sn_old, new_cm_1, new_cm_2, v_pub, h_sig, h]
        proof = readFileSync(claim_proof_path, 'utf-8')
    } else {
        // call vote pour
        const vote_path = "circuits/votePour/Prover.toml"

        let pathIndicesString = "["
        let siblingsString = "["

        for (var i = 0; i < 64 ; i++) {
            pathIndicesString += "\"" + path.pathIndices[i] + "\","
            siblingsString += "\"" + path.siblings[i] + "\","
        }

        pathIndicesString += "]"
        siblingsString += "]"

        const inputs = "h=\"" + h + "\"\n" + 
        "h_sig=\"" + h_sig + "\"\n" + 
        "indices=" + pathIndicesString + "\n" + 
        "new_cm_1=\"" + new_cm_1 + "\"\n" + 
        "new_cm_2=\"" + new_cm_2 + "\"\n" + 
        "new_coin_1_commitment=\"" + coin_1.cm + "\"\n" + 
        "new_coin_1_nullifier_seed=\"" + coin_1.seed + "\"\n" + 
        "new_coin_1_pk_address=\"" + coin_1.public_key + "\"\n" + 
        "new_coin_1_r=\"" + coin_1.r + "\"\n" + 
        "new_coin_1_value=\"" + coin_1.value + "\"\n" + 
        "new_coin_2_commitment=\"" + coin_2.cm + "\"\n" + 
        "new_coin_2_nullifier_seed=\"" + coin_2.seed + "\"\n" + 
        "new_coin_2_pk_address=\"" + coin_2.public_key + "\"\n" + 
        "new_coin_2_r=\"" + coin_2.r + "\"\n" + 
        "new_coin_2_value=\"" + coin_2.value + "\"\n" + 
        "old_coin_commitment=\"" + old_coin.cm + "\"\n" + 
        "old_coin_nullifier_seed=\"" + old_coin.seed + "\"\n" + 
        "old_coin_pk_address=\"" + old_coin.public_key + "\"\n" + 
        "old_coin_r=\"" + old_coin.r + "\"\n" + 
        "old_coin_value=\"" + old_coin.value + "\"\n" + 
        "old_sk=\"" + old_sk + "\"\n" + 
        "old_sn=\"" + sn_old + "\"\n" + 
        "root=\"" + rt + "\"\n" + 
        "siblings=" + siblingsString + "\n" + 
        "v_pub=" + v_pub.toString() + "\n";

        writeFileSync(vote_path, inputs)

        await runCommand('./circuits/votePour/gen_proof.sh')

        // TODO: HAVE THIS READ THE PROOF FROM CIRCUITS
        const vote_proof_path = "circuits/votePour/proofs/votePour.proof"
        pour_instance = [rt, sn_old, new_cm_1, new_cm_2, v_pub, h_sig, h]
        proof = readFileSync(vote_proof_path, 'utf-8')
    }

    // Sign message
    let msg: any = [pour_instance, proof, info]
    let signature = sig_key_pair.sign(msg)
    if(!sig_key_pair.verify(msg, signature)) {
        throw new Error("Signature did not verify")
    }

    // restrict the signature to only accept low S values- sigs are of the form (r,S) according to BIP 62: https://github.com/bitcoin/bips/blob/master/bip-0062.mediawiki#low-s-values-in-signatures
    
    // get order but since it is of value BN | undefined | null we need to ensure it is of type BN
    let order = EC.n
    // let order_bn = await ensure_bn(order) // get promised value of type BN
    if (order === null || order === undefined) {
        throw new Error("Value is of type undefined or null")
    } else {
        let halforder = order.shrn(1)
        // must be smaller than halforder of BN -> 0xFFFFFFFF FFFFFFFF FFFFFFFF FFFFFFFE BAAEDCE6 AF48A03B BFD25E8C D0364140
        if (signature.s.gt(halforder)) {
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
            is_called_by_vote: is_called_by_vote
        }

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
export async function verifyPour(
    tree: Tree,
    pour: Pour,
    vote_nullifiers: bigint[],
    old_sk: bigint
) : Promise<boolean> {
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
    if (pour.tx_pour.h != poseidon4([old_sk, 2, 0, h_sig])) {
        return false
    }

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

    // verify circuit proof
    if (!pour.is_called_by_vote) {
        await runCommand('./circuits/claimPour/verify_proof.sh')
    } else {
        await runCommand('./circuits/votePour/verify_proof.sh')
    }
    return true 
} 

// Utility function to promisify exec
const execAsync = (command: string): Promise<{ stdout: string, stderr: string }> => {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject({ error, stderr });
            } else {
                resolve({ stdout, stderr });
            }
        });
    });
};

// Example function that uses the execAsync function
const runCommand = async (command: string): Promise<void> => {
    try {
        const { stdout, stderr } = await execAsync(command);
        console.log('stdout:', stdout);
        if (stderr != "") {
            console.log('stderr:', stderr);
            throw new Error(stderr)
        }
    } catch (error) {
        console.error('Error:', error);
    }
};

