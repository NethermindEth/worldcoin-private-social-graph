use dep::std::hash::poseidon;
mod structs;

#[export]
fn verify_merkle_proof(leaf: Field, siblings: [Field; 64], indices: [Field; 64], root: Field) -> bool {
    let mut node = leaf;

    for i in 0..64 {
        if (indices[i] == 0) {
                node = hash2([node, siblings[i]]);
        } else {
                node = hash2([siblings[i], node]);        
        }
    }
    
    assert(root == node);
    true
}

#[export]
pub fn claim_pour(
    // public instances
    root: Field,
    old_sn: Field,
    new_cm_1: Field,
    new_cm_2: Field,
    v_pub: [Field; 3], // layout: [alpha, C, sum_i]
    h_sig: Field,
    h: Field,
    // private witnesses
    siblings: [Field; 64], 
    indices: [Field; 64],
    // old coin
    old_coin_pk_address: Field,
    old_coin_value: Field,
    old_coin_nullifier_seed: Field,
    old_coin_r: Field,
    old_coin_s: Field,
    old_coin_commitment: Field,
    old_sk: Field,
    // new coin 1
    new_coin_1_pk_address: Field,
    new_coin_1_value: Field,
    new_coin_1_nullifier_seed: Field,
    new_coin_1_r: Field,
    new_coin_1_s: Field,
    new_coin_1_commitment: Field,
    // new coin 2
    new_coin_2_pk_address: Field,
    new_coin_2_value: Field,
    new_coin_2_nullifier_seed: Field,
    new_coin_2_r: Field,
    new_coin_2_s: Field,
    new_coin_2_commitment: Field,
) -> bool {
    // 1. check merkle proof
    assert(verify_merkle_proof(old_coin_commitment, siblings, indices, root));
    
    // 2. verify address => address public key = PRF(sk || 0)
    assert(old_coin_pk_address == hash2([old_sk, 0]));

    // 3. verify old serial number is computed correctly
    assert(old_sn == hash2([old_sk, old_coin_nullifier_seed]));

    // 4. coins are well formed
    // a. verify old commitment is computed correctly
    let hash_pk_null = hash2([old_coin_pk_address, old_coin_nullifier_seed]);
    let k = hash2([old_coin_r, hash_pk_null]);
    assert(old_coin_commitment == hash2([1, k]));
    // b. verify new commitment is computed correctly - Coin 1
    let hash_pk_null = hash2([new_coin_1_pk_address, new_coin_1_nullifier_seed]);
    let k = hash2([new_coin_1_r, hash_pk_null]);
    assert(new_cm_1 == hash2([1, k])); 
    assert(new_cm_1 == new_coin_1_commitment);
    // c. verify new commitment is computed correctly - Coin 2
    let hash_pk_null = hash2([new_coin_2_pk_address, new_coin_2_nullifier_seed]);
    let k = hash2([new_coin_2_r, hash_pk_null]);
    assert(new_cm_2 == hash2([1, k])); 
    assert(new_cm_2 == new_coin_2_commitment);

    // 5. check hash is correctly computed
    assert(h == hash4([old_sk, 2, 1, h_sig]));

    // 6. check value is consistent between old and new coins
    assert(new_coin_1_value == old_coin_value * v_pub[0]);
    assert(new_coin_2_value == (old_coin_value * v_pub[1] / v_pub[2]));
    true
}

#[export]
pub fn hash2(x: [Field; 2]) -> Field {
    poseidon::bn254::hash_2(x)
}

#[export]
fn hash4(x: [Field; 4]) -> Field {
    poseidon::bn254::hash_4(x)
}

#[test]
fn test_hash2() {
    println(hash2([10,10]));
    assert(hash2([10,10]) == 2056449770998421094693270621231289260402432781619773239530425938274273592166);
}

#[test]
fn test_hash4() {
    println(hash4([10,10,10,10]));
    assert(hash4([10,10,10,10]) == 12501290995084169344073844953692250674022814101925614641583223360631835071976);
}