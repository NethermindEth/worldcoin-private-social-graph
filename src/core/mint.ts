import { Address } from "viem";
import { poseidon2 } from "poseidon-lite";
import { Addresses, Coin } from "./structs";


export function createAddress() {}

export function mint(pk: Address, pk_enc: bigint) {
    // sample nullifier seed
    const seed = BigInt(Math.random() * 2**256)
    // sample trapdoors
    const r = BigInt(Math.random() * 2**256)
    const s = BigInt(Math.random() * 2**256)
    
    const k = poseidon2([r, poseidon2([pk, seed])])
    const cm = poseidon2([1, k])

    const addresses = new Addresses(pk, pk_enc)

    const coin = new Coin(
        addresses, BigInt(1), seed, r, s, cm
    )

    return [cm, k, coin];
}

export function verifyMint(cm: bigint, v: bigint, k: bigint) {
    if (cm == poseidon2([v, k])) {
        return true;
    } else {
        return false;
    }
}