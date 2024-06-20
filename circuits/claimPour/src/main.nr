use dep::socialGraph::claim_pour;
/**
 * Will prove the correctness of the claim pour where one coin in the candidate tree is split into two new coins
 *  
 * root - candidate tree root
 * old_sn - nullifier of old coin
 * new_cm_1 - coin 1's commitment
 * new_cm_2 - coin 2's commitment
 * v_pub - weight refered to as a  public value (notation taken from zcash) 
 * h_sig - hash of the one time digital signature private key 
 * h - hash of h_sig with old secret key 
 * siblings - values in the vote tree that correspond to the root
 * indices - path indices of the siblings in the candidate tree
 * old_coin_pk_address - the public key corresponding to the old coin
 * old_coin_value - the value corresponding to the old coin
 * old_coin_nullifier_seed - the nullifier's seed corresponding to the old coin
 * old_coin_r - the r value corresponding to the old coin
 * old_coin_commitment - the commitment corresponding to the old coin
 * old_coin_sk - the secret key corresponding to the old coin
 * new_coin_1_pk_address - the public key corresponding to the vote coin
 * new_coin_1_value - the value corresponding to the vote coin
 * new_coin_1_nullifier_seed - the nullifier's seed corresponding to the vote coin
 * new_coin_1_r - the r value corresponding to the vote coin
 * new_coin_1_commitment - the commitment corresponding to the vote coin
 * new_coin_2_pk_address - the public key corresponding to the rewards coin
 * new_coin_2_value - the value corresponding to the rewards coin
 * new_coin_2_nullifier_seed - the nullifier's seed corresponding to the rewards coin
 * new_coin_2_r - the r value corresponding to the rewards coin
 * new_coin_2_commitment - the commitment corresponding to the rewards coin
*/
fn main(
    // public instances
    root: pub Field,
    old_sn: pub Field,
    new_cm_1: pub Field,
    new_cm_2: pub Field,
    v_pub: pub Field,
    h_sig: pub Field,
    h: pub Field,
    // private witnesses
    siblings: [Field; 32], 
    indices: [Field; 32],
    // old coin
    old_coin_pk_address: Field,
    old_coin_value: Field,
    old_coin_nullifier_seed: Field,
    old_coin_r: Field,
    old_coin_commitment: Field,
    old_sk: Field,
    // new coin 1
    new_coin_1_pk_address: Field,
    new_coin_1_value: Field,
    new_coin_1_nullifier_seed: Field,
    new_coin_1_r: Field,
    new_coin_1_commitment: Field,
    // new coin 2
    new_coin_2_pk_address: Field,
    new_coin_2_value: Field,
    new_coin_2_nullifier_seed: Field,
    new_coin_2_r: Field,
    new_coin_2_commitment: Field,

) {
    assert(claim_pour(
        root,
        old_sn, 
        new_cm_1, 
        new_cm_2, 
        v_pub, h_sig, 
        h, siblings, 
        indices, 
        old_coin_pk_address, 
        old_coin_value, 
        old_coin_nullifier_seed, 
        old_coin_r, 
        old_coin_commitment,
        old_sk, 
        new_coin_1_pk_address, 
        new_coin_1_value, 
        new_coin_1_nullifier_seed, 
        new_coin_1_r,
        new_coin_1_commitment,
        new_coin_2_pk_address,
        new_coin_2_value,
        new_coin_2_nullifier_seed,
        new_coin_2_r,
        new_coin_2_commitment
        ) == true
    );
}