import { Address } from "viem";
import { poseidon2 } from "poseidon-lite";
import { Addresses, Coin } from "./structs";
import { Tree } from "./tree";
import { IMT, IMTMerkleProof, IMTNode } from "@zk-kit/imt"

export function pour(
    rt: bigint,
    old_coin: Coin,
    old_sk_addr: Addresses,
    path: IMTMerkleProof,
    new_value: bigint,
    new_pk_addr: Addresses,
    weight: bigint,
    info: String
) {
    // generate old serial number
    const sn_old = poseidon2([old_sk_addr.getKey(), old_coin.getCoinSeed()])
    // sample nullifier seed
    const new_seed = BigInt(Math.random() * 2**256)
    // sample trapdoors
    const new_r = BigInt(Math.random() * 2**256)
    const new_s = BigInt(Math.random() * 2**256)

    // compute 2-step commitment
    const new_k = poseidon2([new_r, poseidon2([new_pk_addr.getKey(), new_seed])])
    const new_cm = poseidon2([1, new_k])

    // set new coin
    const new_coin: Coin = new Coin(new_pk_addr, new_value, new_seed, new_r, new_s, new_cm)
}