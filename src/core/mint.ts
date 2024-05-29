import { poseidon2 } from "poseidon-lite";
import { Coin, Mint, Mint_Tx, modulus } from "./structs";

/**
 * 
 * @param pk - zcash public key
 * @param value - value of coin
 * @returns Produces the coin and tx
 * 
 * @description Will mint a coin and create the tx in the same way zcash does
 */
export function mint(pk: bigint, value: number) : Mint {
    // sample nullifier seed
    const seed = BigInt(Math.random() * modulus)
    // sample trapdoors
    const r = BigInt(Math.random() * modulus)
    const s = BigInt(Math.random() * modulus) // s is not used as specified in the zcash paper but like zcash we still inlcude it
    
    const k = poseidon2([r, poseidon2([pk, seed])])
    const cm = poseidon2([value, k])

    const coin : Coin = {
        public_key: pk, 
        value: value,
        seed: seed, 
        r: r, 
        s: s, 
        cm: cm
    }

    const tx_mint: Mint_Tx = {cm, value, k, s}
    const mint_final : Mint = {
        coin: coin,
        tx_mint: tx_mint
    }
    return mint_final
}

/**
 * 
 * @param cm - coin commitment
 * @param v - coin value
 * @param k - first part of 2-step commitment
 * @returns true if the commitment corresponds to the hash of the value with k, otherwise false
 */
export function verifyMint(cm: bigint, v: number, k: bigint) : boolean {
    return (cm == poseidon2([v, k]));
}
