use dep::std::hash::poseidon;
mod structs;

fn verify_merkle_proof(leaf: Field, siblings: [Field], indices: [Field], root: Field) {
    let n = siblings.len();
    let mut node = leaf;

    for i in 0..n {
        if (indices[i] == 0) {
                node = hash2([node, siblings[i]]);
        } else {
                node = hash2([siblings[i], node]);        
        }
    }
    assert(root == node);
}

fn pour (
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
    old_coin: structs::Coin,
    old_sk: Field,
    new_coin: structs::Coin
) {
    // 1. check merkle proof
    verify_merkle_proof(old_coin.commitment, siblings, indices, root);
    
    // 2. verify address => address public key = PRF(sk || 0)
    assert(old_coin.pk_address == hash2([old_sk, 0]));

    // 3. verify old serial number is computed correctly
    assert(old_sn == hash2([old_sk, old_coin.nullifier_seed]));

    // 4. coins are well formed
    // a. verify old commitment is computed correctly
    let hash_pk_null = hash2([old_coin.pk_address, old_coin.nullifier_seed]);
    let k = hash2([old_coin.r, hash_pk_null]);
    assert(old_coin.commitment == hash2([1, k]));
    // b. verify new commitment is computed correctly
    let hash_pk_null = hash2([new_coin.pk_address, new_coin.nullifier_seed]);
    let k = hash2([new_coin.r, hash_pk_null]);
    assert(new_cm == hash2([1, k])); 

    // 5. check hash is correctly computed
    assert(h == hash4([old_sk, 2, 1, h_sig]));

    // 6. check value is consistent between old and new coins
    assert(old_coin.value == new_coin.value + weight);
}

#[export]
fn hash2(x: [Field; 2]) -> Field {
    poseidon::bn254::hash_2(x)
}

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