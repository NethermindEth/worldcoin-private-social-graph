use dep::std::hash::poseidon;

pub fn verify_merkle_proof(leaf: Field, siblings: [Field], indices: [Field], root: Field) {
    let n = siblings.len();
    let mut node = leaf;

    for i in 0..n {
        if (indices[i] == 0) {
                node = poseidon::bn254::hash_2([node, siblings[i]]);
        } else {
                node = poseidon::bn254::hash_2([siblings[i], node]);        
        }
    }
    assert(root == node);
}

pub fn pour(
    // public instances
    root: Field,
    old_sn: Field,
    new_cm: Field,
    weight: Field,
    h_sig: Field,
    h: Field,
    // private witnesses
    siblings: [Field], 
    indices: [Field],
    old_coin: Field, // TODO: Define coin struct
    old_sk: Field,
    new_coin: Field // TODO: Convert to coin struct
) {
    // 1. check merkle proof
    verify_merkle_proof(old_coin.commitment, siblings, indices, root);
    // 2. verify address

    // 3. verify old serial number is computed correctly

    // 4. verify new commitment is computed correctly

    // 5. check hash is correctly computed

    // 6. check value is consistent between old and new coins
}