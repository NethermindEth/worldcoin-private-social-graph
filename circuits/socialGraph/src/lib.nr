use dep::std::hash::poseidon;

/**
 * Will verify the merkle proof corresponding to a leaf
 *
 * leaf - leaf to be proven in the tree
 * siblings - values in the tree
 * indices - path indices of the values in the tree
 * root - final root of the tree
*/
#[export]
fn verify_merkle_proof(leaf: Field, siblings: [Field; 32], indices: [Field; 32], root: Field) -> bool {
    let mut node = leaf;

    for i in 0..32 {
        if (indices[i] == 0) {
                node = hash2([node, siblings[i]]);
        } else {
                node = hash2([siblings[i], node]);        
        }
    }

    assert(root == node);
    true
}

/**
 * Will prove the correctness of the vote pour where one vote coin is split into two new coins
 *  
 * root - vote tree root
 * old_sn - nullifier of old coin
 * new_cm_1 - coin 1's commitment
 * new_cm_2 - coin 2's commitment
 * v_pub - weight refered to as a  public value (notation taken from zcash) 
 * h_sig - hash of the one time digital signature private key 
 * h - hash of h_sig with old secret key 
 * siblings - values in the vote tree that correspond to the root
 * indices - path indices of the siblings in the vote tree
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
 * new_coin_2_pk_address - the public key corresponding to the user coin
 * new_coin_2_value - the value corresponding to the user coin
 * new_coin_2_nullifier_seed - the nullifier's seed corresponding to the user coin
 * new_coin_2_r - the r value corresponding to the user coin
 * new_coin_2_commitment - the commitment corresponding to the user coin
 *
 * Proof is as follows:
 * 1. check merkle proof
 * 2. verify address => address public key = PRF(sk || 0)
 * 3. verify old serial number is computed correctly
 * 4. coins are well formed
 *    a. verify old commitment is computed correctly
 *    b. verify new commitment is computed correctly - Coin 1
 *    c. verify new commitment is computed correctly - Coin 2
 * 5. check hash is correctly computed
 * 6. check value is consistent between old and new coins
*/
#[export]
pub fn vote_pour(
    // public instances
    root: Field,
    old_sn: Field,
    new_cm_1: Field,
    new_cm_2: Field,
    v_pub: Field, // weight
    h_sig: Field,
    h: Field,
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
) -> bool {
    assert(verify_merkle_proof(old_coin_commitment, siblings, indices, root));
    
    assert(old_coin_pk_address == hash2([old_sk, 0]));

    assert(old_sn == hash3([old_sk, 1, old_coin_nullifier_seed]));

    let hash_pk_null = hash2([old_coin_pk_address, old_coin_nullifier_seed]);
    let hash_r_pk_null = hash2([old_coin_r, hash_pk_null]);
    assert(old_coin_commitment == hash3([hash_r_pk_null, 0, old_coin_value]));

    let hash_pk_null = hash2([new_coin_1_pk_address, new_coin_1_nullifier_seed]);
    let hash_r_pk_null = hash2([new_coin_1_r, hash_pk_null]);
    assert(new_cm_1 == hash3([hash_r_pk_null, 0, new_coin_1_value])); 
    assert(new_cm_1 == new_coin_1_commitment);

    let hash_pk_null = hash2([new_coin_2_pk_address, new_coin_2_nullifier_seed]);
    let hash_r_pk_null = hash2([new_coin_2_r, hash_pk_null]);
    assert(new_cm_2 == hash3([hash_r_pk_null, 0, new_coin_2_value])); 
    assert(new_cm_2 == new_coin_2_commitment);

    assert(h == hash4([old_sk, 2, 0, h_sig]));

    assert(v_pub as u64 <= old_coin_value as u64);
    assert(new_coin_1_value == old_coin_value - v_pub);
    assert(new_coin_2_value == v_pub);
    true
}

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
 *
 * Proof is as follows:
 * 1. verify address => address public key = PRF(sk || 0)
 * 2. verify old serial number is computed correctly
 * 3. coins are well formed
 *   a. verify old commitment is computed correctly
 *   b. verify new commitment is computed correctly - Coin 1
 *   c. verify new commitment is computed correctly - Coin 2
 * 4. check hash is correctly computed
 * 5. check value is consistent between old and new coins
 * 6. check merkle proof
*/
#[export]
pub fn claim_pour(
    // public instances
    root: Field,
    old_sn: Field,
    new_cm_1: Field,
    new_cm_2: Field,
    v_pub: Field,
    h_sig: Field,
    h: Field,
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
) -> bool {
    let C: u64 = 140000;
    let alpha: Field = 60;
    
    assert(old_coin_pk_address == hash2([old_sk, 0]));

    assert(old_sn == hash3([old_sk, 1, old_coin_nullifier_seed]));

    let hash_pk_null = hash2([old_coin_pk_address, old_coin_nullifier_seed]);
    let hash_r_pk_null = hash2([old_coin_r, hash_pk_null]);
    assert(old_coin_commitment == hash3([hash_r_pk_null, 0, old_coin_value]));

    let hash_pk_null = hash2([new_coin_1_pk_address, new_coin_1_nullifier_seed]);
    let hash_r_pk_null= hash2([new_coin_1_r, hash_pk_null]);
    assert(new_cm_1 == hash3([hash_r_pk_null, 0, new_coin_1_value])); 
    assert(new_cm_1 == new_coin_1_commitment);

    let hash_pk_null = hash2([new_coin_2_pk_address, new_coin_2_nullifier_seed]);
    let hash_r_pk_null = hash2([new_coin_2_r, hash_pk_null]);
    assert(new_cm_2 == hash3([hash_r_pk_null, 0, new_coin_2_value])); 
    assert(new_cm_2 == new_coin_2_commitment);

    assert(h == hash4([old_sk, 2, 0, h_sig]));

    assert(new_coin_1_value == old_coin_value * alpha);
    assert(new_coin_2_value as u64 == (old_coin_value as u64 * C / v_pub as u64));

    assert(verify_merkle_proof(old_coin_commitment, siblings, indices, root));
    
    true
}

/**
 * Ease of use poseidon hash
 * x - values to be hashed using poseidon
*/
#[export]
pub fn hash2(x: [Field; 2]) -> Field {
    poseidon::bn254::hash_2(x)
}

/**
 * Ease of use poseidon hash
 * x - values to be hashed using poseidon
*/
#[export]
fn hash3(x: [Field; 3]) -> Field {
    poseidon::bn254::hash_3(x)
}

/**
 * Ease of use poseidon hash
 * x - values to be hashed using poseidon
*/
#[export]
fn hash4(x: [Field; 4]) -> Field {
    poseidon::bn254::hash_4(x)
}

#[test]
fn test_hash2() {
    assert(hash2([10,10]) == 2056449770998421094693270621231289260402432781619773239530425938274273592166);
}

#[test]
fn test_hash4() {
    assert(hash4([10,10,10,10]) == 12501290995084169344073844953692250674022814101925614641583223360631835071976);
}
