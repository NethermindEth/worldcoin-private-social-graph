import { Address } from "viem";

export class Coin {
    public addresses: Addresses
    public value: bigint
    public seed: bigint
    public r: bigint
    public s: bigint
    public cm: bigint

    constructor(
        addresses: Addresses,
        value: bigint, // value should always be 1 in the case of 
        seed: bigint,
        r: bigint,
        s: bigint,
        cm: bigint,
    ) {
        this.addresses = addresses
        this.value = value
        this.seed = seed
        this.r = r
        this.s = s
        this.cm = cm
    }

    // getters
    public getCoinAddresses() {
        return this.addresses
    }

    public getCoinValue() {
        return this.value
    }

    public getCoinSeed() {
        return this.seed
    }

    public getCoinR() {
        return this.r
    }

    public getCoinS() {
        return this.s
    }

    public getCoinCm() {
        return this.cm
    }

    // setters
    public setCoinValue(value: bigint) {
        this.value = value
    }

    public setCoinSeed(seed: bigint) {
        this.seed = seed
    }

    public setCoinR(r: bigint) {
        this.r = r
    }

    public setCoinS(s: bigint) {
        this.s = s
    }

    public setCoinCm(cm: bigint) {
        this.cm = cm
    }
}

export class Addresses {
    public key: Address
    public enc_key: bigint

    constructor(
        key: Address,
        enc_key: bigint
    ) {
        this.key = key
        this.enc_key = enc_key
    }

    // getters
    public getKey() {
        return this.key
    }

    public getEncKey() {
        return this.enc_key
    }

    public getAddresses() {
        return [this.key, this.enc_key]
    }

    // setters
    public setKey(new_key: Address) {
        this.key = new_key
    }

    public setEncKey(new_key: bigint) {
        this.enc_key = new_key
    }

    public setKeys(new_key: Address, new_enc_key: bigint) {
        this.key = new_key
        this.enc_key = new_enc_key
    }
}