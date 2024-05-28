import { Tree } from "../src/core/tree";
import { verify_merkle_proof } from "../codegen";

describe("Integration Tests", () => {
    it("Should verify a merkle proof", async () => {
        const tree = new Tree()
        const idx = tree.addMember("101")
        const idx_proof = tree.generateMerkleProof(idx)

        const leaf = idx_proof.leaf.toString()
        const siblings = idx_proof.siblings.map(i => i.toString())
        const pathIndices = idx_proof.pathIndices.map(i => i.toString())
        const root = idx_proof.root.toString()

        const pass = await verify_merkle_proof(leaf, siblings, pathIndices, root)

        expect(pass).toBe(true)
    })

    // TODO: verify pour circuit
    it("Should verify a pour transaction", () => {

    })
})