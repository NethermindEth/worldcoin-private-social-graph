use dep::socialGraph::vote_pour;

fn main(
    // public instances
    root: pub Field,
    old_sn: pub Field,
    new_cm_1: pub Field,
    new_cm_2: pub Field,
    v_pub: pub Field, // weight
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
    assert(vote_pour(
        root,
        old_sn,
        new_cm_1,
        new_cm_2,
        v_pub,
        h_sig,
        h,
        siblings, 
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
    ) == true);
}
