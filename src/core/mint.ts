import { Address } from "viem";
import { poseidon2 } from "poseidon-lite";
import { ECDSA_address, Coin, Mint } from "./structs";

var EC = require('elliptic').ec;
var ec = new EC('secp256k1');

export function mint(pk: string, value: bigint) : Mint {
    // sample nullifier seed
    const seed = BigInt(Math.random() * 2**256)
    // sample trapdoors
    const r = BigInt(Math.random() * 2**256)
    const s = BigInt(Math.random() * 2**256)
    
    const k = poseidon2([r, poseidon2([pk, seed])])
    const cm = poseidon2([value, k])

    const coin = new Coin(
        pk, BigInt(1), seed, r, s, cm
    )

    const tx_mint: bigint[] = [cm, BigInt(1), k, s]

    return new Mint(coin, tx_mint);
}

export function verifyMint(cm: bigint, v: bigint, k: bigint) : boolean {
    return (cm == poseidon2([v, k]));
}