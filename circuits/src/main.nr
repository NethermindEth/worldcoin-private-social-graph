use dep::std::hash::poseidon;

fn main(poseidonHash: pub Field, value1: Field, value2: Field) {
    assert(poseidonHash == poseidon::bn254::hash_2([value1, value2]));
}

