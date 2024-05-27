import { Tree } from "../src/core/tree";
import { verify_merkle_proof } from "../codegen";

describe("Integration Tests", () => {
    // TODO: fix `unwrap_throw` failed
    it("Should verify a merkle proof", () => {
        const tree = new Tree()
        const idx = tree.addMember("101")
        const idx_proof = tree.generateMerkleProof(idx)
        console.log(
            "Proof: \n", 
            "root:", idx_proof.root, "\n",
            "leaf:", idx_proof.leaf, "\n",
            "pathIndices:", idx_proof.pathIndices, "\n",
            "pathIndices length:", idx_proof.pathIndices.length, "\n",
            "siblings:", idx_proof.siblings, "\n",
            "siblings length:", idx_proof.siblings.length, "\n",
            "leafIndex:", idx_proof.leafIndex, "\n",
        )
        const leaf = idx_proof.leaf
        const siblings = idx_proof.siblings
        const pathIndices = idx_proof.pathIndices.map(i => i.toString())
        const root = idx_proof.root

        expect(verify_merkle_proof(leaf, siblings, pathIndices, root)).toBe(true)
    })

    it("Should verify a pour transaction", () => {

    })
})