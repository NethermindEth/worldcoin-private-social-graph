import { mint, createAddress, verifyMint } from "./mint";
import { Tree } from "./tree";
import { Address } from "viem";
import { Coin, Addresses } from "./structs";

class private_graph {
    private voting_tree: Tree
    
    constructor() {
        this.voting_tree = new Tree
    }

    public genAddress() {
        return createAddress()
    }

    public registerWorldID(pk_address: Address, pk_enc: bigint) {
        // generate mint tx
        const tx_mint = mint(pk_address, pk_enc)
        // get values from mint tx
        const cm = tx_mint[0]
        const coin = tx_mint[2]
        
        const pos = this.voting_tree.addMember(cm)
        return [tx_mint, coin, pos]
    }
}